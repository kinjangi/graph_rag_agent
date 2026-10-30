/**
 * routes/extract.js
 * POST /api/documents/extract
 *
 * Body: { chunks: [{ id, text, startIndex, endIndex }, ...] }
 *
 * Runs Gemini triple extraction on each chunk with:
 *   - Capped concurrency (MAX_CONCURRENT = 3) to stay within free-tier limits
 *   - Automatic 429 retry with exponential backoff (up to MAX_RETRIES attempts)
 *
 * Returns:
 *   { summary: { chunksProcessed, triplesExtracted }, triples: [...] }
 */

import express from "express";
import { extractTriplesFromChunk } from "../services/extractTriples.js";

const router = express.Router();

// ── Concurrency / rate-limit config ──────────────────────────────────────────
const MAX_CONCURRENT = 1;
const MAX_RETRIES    = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getRetryDelayMs(err, attempt) {
  const msg = err?.message || "";
  const match = msg.match(/retry in ([0-9.]+)s/i);
  if (match) {
    const sec = parseFloat(match[1]);
    if (!isNaN(sec) && sec > 0) {
      return Math.ceil(sec * 1000) + 1500; // wait specified seconds + buffer
    }
  }
  return Math.min(45000, 3000 * Math.pow(2, attempt - 1));
}

function isRateOrDemandError(err) {
  const status = err?.status || err?.statusCode || err?.code;
  const msg = (err?.message || "").toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    status === 500 ||
    status === 504 ||
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("quota") ||
    msg.includes("rate") ||
    msg.includes("exhausted") ||
    msg.includes("resource_exhausted") ||
    msg.includes("high demand") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("too many requests") ||
    msg.includes("temporarily unavailable")
  );
}

/**
 * Extract triples from one chunk, retrying on 429 and 503 with smart backoff.
 * Attaches `sourceChunkId` to every returned triple.
 */
async function extractWithRetry(chunk, attempt = 1) {
  try {
    const triples = await extractTriplesFromChunk(chunk.text);
    return triples.map((t) => ({ ...t, sourceChunkId: chunk.id }));
  } catch (err) {
    const isRateOrDemand = isRateOrDemandError(err);

    if (isRateOrDemand && attempt <= MAX_RETRIES) {
      const waitMs = getRetryDelayMs(err, attempt);
      console.warn(
        `[extract] Transient error on chunk ${chunk.id}. ` +
        `Waiting ${Math.round(waitMs / 1000)}s before retry ${attempt}/${MAX_RETRIES}…`
      );
      await sleep(waitMs);
      return extractWithRetry(chunk, attempt + 1);
    }

    console.error(
      `[extract] Failed to extract triples from chunk ${chunk.id} ` +
      `(attempt ${attempt}):`,
      err?.message ?? err
    );
    throw err;
  }
}

/**
 * Run async tasks with limited concurrency.
 * Accepts an array of zero-arg async factory functions.
 */
async function withConcurrency(limit, tasks) {
  const results = new Array(tasks.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      results[idx] = await tasks[idx]();
    }
  }

  // Spin up `limit` concurrent workers
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/extract", async (req, res) => {
  try {
    const { chunks } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({
        error: 'Request body must include a non-empty "chunks" array.',
        example: { chunks: [{ id: 0, text: "...", startIndex: 0, endIndex: 100 }] },
      });
    }

    const invalidChunk = chunks.find(
      (c) => typeof c?.text !== "string" || !c.text.trim()
    );
    if (invalidChunk !== undefined) {
      return res.status(400).json({
        error: 'Each chunk must have a non-empty "text" field.',
      });
    }

    console.log(`[extract] Processing ${chunks.length} chunk(s) …`);

    // ── Build task list and run with concurrency cap ─────────────────────────
    let lastChunkError = null;
    const tasks = chunks.map((chunk, idx) => async () => {
      try {
        if (idx > 0) await sleep(2000); // 2s spacing between chunk requests to stay within free-tier RPM
        return await extractWithRetry(chunk);
      } catch (err) {
        lastChunkError = err;
        console.error(`[extract] Chunk ${chunk.id} failed after retries:`, err.message);
        return [];
      }
    });

    const nestedResults = await withConcurrency(MAX_CONCURRENT, tasks);

    // Flatten all chunk arrays into one list
    const allTriples = nestedResults.flat();

    if (allTriples.length === 0) {
      const errDetail = lastChunkError?.message
        ? `Model error: ${lastChunkError.message.slice(0, 160)}`
        : "Text contained no clear entity relationships or model output was empty.";

      return res.status(503).json({
        error: "Gemini AI was unable to extract triples (model may be temporarily overloaded or text contained no clear entity relationships).",
        detail: errDetail
      });
    }

    const summary = {
      chunksProcessed: chunks.length,
      triplesExtracted: allTriples.length,
      averageTriplesPerChunk:
        chunks.length > 0
          ? parseFloat((allTriples.length / chunks.length).toFixed(2))
          : 0,
    };

    console.log(
      `[extract] Done. ${summary.triplesExtracted} triples from ${summary.chunksProcessed} chunks.`
    );

    return res.status(200).json({
      summary,
      triples: allTriples,
    });
  } catch (err) {
    console.error("[extract] Unexpected error:", err);
    return res.status(500).json({
      error: "An unexpected server error occurred during extraction.",
      detail: err.message,
    });
  }
});

export default router;
