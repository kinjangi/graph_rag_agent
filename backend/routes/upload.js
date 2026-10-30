/**
 * routes/upload.js
 * POST /api/documents/upload
 *
 * Accepts a single file (field "document"), extracts its text, chunks it,
 * and returns extraction + chunking metadata as JSON.
 */

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { createRequire } from "module";
import { chunkText } from "../utils/chunker.js";
import { getClient, GEMINI_MODEL } from "../services/geminiClient.js";

const router = express.Router();

// ── pdf-parse is CJS-only; use createRequire to import it in ESM ──────────
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

// ── Allowed MIME types & extensions ──────────────────────────────────────────
const ALLOWED_MIMES = new Set(["text/plain", "application/pdf"]);
const ALLOWED_EXTS  = new Set([".txt", ".pdf"]);

// ── Multer config: memory storage so we never write temp files ────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB cap

  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    // Accept if either the extension OR the declared MIME is recognised.
    // (Some browsers send generic MIME for .txt so we check both.)
    if (ALLOWED_EXTS.has(ext) || ALLOWED_MIMES.has(mime)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(
          new Error(
            `Unsupported file type "${ext || mime}". Only .txt and .pdf files are accepted.`
          ),
          { code: "UNSUPPORTED_FILE_TYPE" }
        )
      );
    }
  },
});

// ── Text extraction helpers ───────────────────────────────────────────────────

async function extractTextWithGeminiVision(buffer) {
  try {
    const client = getClient();
    const base64 = buffer.toString("base64");
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64,
                mimeType: "application/pdf",
              },
            },
            {
              text: "Extract all text, names, dates, credentials, institutions, and relationships verbatim from this document. Output clear readable paragraphs.",
            },
          ],
        },
      ],
    });
    return response?.text || "";
  } catch (err) {
    console.warn("[upload] Gemini vision fallback warning:", err?.message);
    return "";
  }
}

async function extractText(file) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext === ".txt" || file.mimetype === "text/plain") {
    // Read the in-memory buffer as UTF-8
    return file.buffer.toString("utf-8");
  }

  if (ext === ".pdf" || file.mimetype === "application/pdf") {
    let text = "";
    try {
      if (typeof pdfParse === "function") {
        const result = await pdfParse(file.buffer);
        text = result?.text || "";
      } else {
        const ParserClass = pdfParse?.PDFParse || pdfParse?.default?.PDFParse;
        if (ParserClass) {
          const parser = new ParserClass({ data: file.buffer });
          const result = await parser.getText();
          text = result?.text || "";
        }
      }
    } catch (pdfErr) {
      console.warn("[upload] Standard PDF text extraction warning:", pdfErr?.message);
    }

    // Check if the extracted text is sparse, placeholder only, or from an image-based PDF
    const meaningfulText = text.replace(/[-0-9\s_of]+/gi, "").trim();
    if (meaningfulText.length < 50) {
      console.log(`[upload] PDF has minimal extractable text (${meaningfulText.length} chars). Invoking Gemini Multimodal OCR...`);
      const visionText = await extractTextWithGeminiVision(file.buffer);
      if (visionText && visionText.trim().length > text.trim().length) {
        text = visionText;
      }
    }

    if (!text.trim()) {
      throw new Error("Unable to extract text from this PDF file.");
    }
    return text;
  }

  // Fallback — should never reach here due to fileFilter, but be explicit
  throw Object.assign(
    new Error(`Cannot extract text from file type "${ext}".`),
    { code: "UNSUPPORTED_FILE_TYPE" }
  );
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post(
  "/upload",
  upload.single("document"),
  async (req, res) => {
    try {
      // ── 1. Validate that a file was actually sent ─────────────────────
      if (!req.file) {
        return res.status(400).json({
          error: "No file received. Send a file in the \"document\" field.",
        });
      }

      // ── 2. Extract raw text ───────────────────────────────────────────
      let rawText;
      try {
        rawText = await extractText(req.file);
      } catch (err) {
        console.error("[upload] extractText failed:", err);
        return res.status(422).json({
          error: "Failed to extract text from the uploaded file.",
          detail: err.message,
        });
      }

      // ── 3. Guard against empty / whitespace-only documents ────────────
      const trimmed = rawText.trim();
      const meaningfulLetters = trimmed.replace(/[-0-9\s_of/\\.,;:|]+/gi, "").trim();
      if (!trimmed || meaningfulLetters.length < 10) {
        return res.status(422).json({
          error: "The uploaded file contains insufficient readable text.",
          detail: "Please upload a document with clear descriptive text or sentences.",
        });
      }

      // ── 4. Chunk the text ─────────────────────────────────────────────
      const allChunks = chunkText(trimmed, {
        chunkSize: 3500,
        overlap: 300,
        minChunkSize: 200,
      });

      // Limit to max 15 chunks (~50,000 characters) to prevent quota exhaustion
      const chunks = allChunks.slice(0, 15);

      // ── 5. Build response ─────────────────────────────────────────────
      const preview = trimmed.slice(0, 300);

      return res.status(200).json({
        // File metadata
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSizeBytes: req.file.size,

        // Extraction summary
        extraction: {
          charCount: trimmed.length,
          preview: preview + (trimmed.length > 300 ? "…" : ""),
        },

        // Chunking summary
        chunking: {
          chunkCount: chunks.length,
          totalChunksAvailable: allChunks.length,
          chunkSize: 3500,
          overlap: 300,
          firstChunks: chunks.slice(0, 2),   // full text of first 2 chunks
          chunks: chunks,
        },
      });
    } catch (err) {
      console.error("[upload] Unexpected error:", err);
      return res.status(500).json({
        error: "An unexpected server error occurred.",
        detail: err.message,
      });
    }
  }
);

// ── Multer error handler (must be a 4-arg middleware) ─────────────────────────
router.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File exceeds the 20 MB size limit." });
  }
  if (err.code === "UNSUPPORTED_FILE_TYPE") {
    return res.status(415).json({ error: err.message });
  }
  console.error("[upload] Multer error:", err);
  return res.status(500).json({ error: "File upload failed.", detail: err.message });
});

export default router;
