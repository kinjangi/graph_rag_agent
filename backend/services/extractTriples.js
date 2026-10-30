/**
 * services/extractTriples.js
 *
 * Extracts subject-predicate-object triples from a text chunk using Gemini.
 *
 * Exported:
 *   extractTriplesFromChunk(chunkText: string) → Promise<Triple[]>
 *
 * Triple shape:
 *   { subject, predicate, object, subjectType, objectType }
 */

import { getClient, GEMINI_MODEL } from "./geminiClient.js";

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a knowledge-graph construction assistant.
Your job is to read a passage of text and extract the most important entities
and the relationships between them as structured triples.

Rules:
- Entity types to recognise: PERSON, ORGANIZATION, LOCATION, CONCEPT, EVENT, TECHNOLOGY, DATE, PRODUCT.
- The predicate must be a short, active-voice phrase (2-5 words), e.g.
  "founded", "located in", "invented", "published", "succeeded by", "part of".
- Only extract relationships that are EXPLICITLY stated or CLEARLY and directly
  implied by the text. Do NOT invent or infer speculative connections.
- Normalise entity names (e.g. "Tim Berners-Lee" not "Berners-Lee"; "United States" not "US").
- Avoid duplicate triples. If the same fact appears multiple times, emit it once.
- Avoid trivially broad or meaningless objects. Do NOT use generic values like
  "data", "information", "things", "people", or "content" as the object of a
  triple unless they are the actual subject of the sentence. Be specific.
- If no meaningful triples can be extracted, return an empty array.

Respond ONLY with valid JSON matching this exact schema — no markdown fences,
no explanation, no extra keys:
{
  "triples": [
    {
      "subject":     "<entity name>",
      "predicate":   "<relationship phrase>",
      "object":      "<entity name or value>",
      "subjectType": "<entity type>",
      "objectType":  "<entity type>"
    }
  ]
}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resilient JSON parser that handles:
 * - Markdown fences
 * - Bare arrays [ { ... } ] or objects { triples: [ ... ] }
 * - Preceding / trailing prose or comments
 * - Trailing commas before closing braces/brackets
 */
function parseJsonSafely(raw) {
  if (!raw || typeof raw !== "string") return null;

  let cleaned = raw.trim();

  // Strip markdown code fences if present
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // Try parsing directly first
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Continue with resilient extraction
  }

  // Find either outer array [ ... ] or outer object { ... }
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  let candidate = null;
  // If array begins before object, prioritize array
  if (firstBracket !== -1 && lastBracket > firstBracket && (firstBrace === -1 || firstBracket < firstBrace)) {
    candidate = cleaned.slice(firstBracket, lastBracket + 1);
  } else if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidate = cleaned.slice(firstBrace, lastBrace + 1);
  }

  if (candidate) {
    try {
      return JSON.parse(candidate);
    } catch (_) {
      // Try stripping trailing commas e.g. [ { ... }, ]
      try {
        const noTrailingCommas = candidate.replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(noTrailingCommas);
      } catch (_) {}
    }
  }

  return null;
}

/**
 * Extracts and normalizes triples from various parsed response shapes.
 */
function extractTriplesList(parsed) {
  if (!parsed) return [];

  let list = [];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (Array.isArray(parsed.triples)) {
    list = parsed.triples;
  } else if (Array.isArray(parsed.relationships)) {
    list = parsed.relationships;
  } else if (Array.isArray(parsed.entities)) {
    list = parsed.entities;
  } else if (Array.isArray(parsed.data)) {
    list = parsed.data;
  } else if (Array.isArray(parsed.graph)) {
    list = parsed.graph;
  } else if (Array.isArray(parsed.facts)) {
    list = parsed.facts;
  }

  return list
    .filter((t) => t && typeof t === "object")
    .map((t) => {
      const subject = t.subject || t.source || t.head || t.entity1 || t.from;
      const predicate = t.predicate || t.relation || t.relationship || t.label || t.type;
      const object = t.object || t.target || t.tail || t.entity2 || t.to;
      const subjectType = t.subjectType || t.sourceType || "CONCEPT";
      const objectType = t.objectType || t.targetType || "CONCEPT";

      if (
        typeof subject === "string" && subject.trim() &&
        typeof predicate === "string" && predicate.trim() &&
        typeof object === "string" && object.trim()
      ) {
        return {
          subject: subject.trim(),
          predicate: predicate.trim(),
          object: object.trim(),
          subjectType: typeof subjectType === "string" && subjectType.trim() ? subjectType.trim() : "CONCEPT",
          objectType: typeof objectType === "string" && objectType.trim() ? objectType.trim() : "CONCEPT",
        };
      }
      return null;
    })
    .filter(Boolean);
}

// Candidate models in preference order for extraction
const CANDIDATE_MODELS = [
  GEMINI_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
].filter((m, i, arr) => arr.indexOf(m) === i && Boolean(m));

// ── Core extraction function ──────────────────────────────────────────────────

/**
 * extractTriplesFromChunk(chunkText)
 *
 * Calls Gemini with the extraction prompt and returns an array of triple objects.
 * Employs model fallback if a specific model encounters temporary high demand or rate limits.
 *
 * @param {string} chunkText  - Raw text of a single chunk.
 * @returns {Promise<Array<{subject,predicate,object,subjectType,objectType}>>}
 */
export async function extractTriplesFromChunk(chunkText) {
  if (!chunkText || !chunkText.trim()) return [];

  const client = getClient();
  let lastErr = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${SYSTEM_PROMPT}\n\n---\nTEXT:\n${chunkText.trim()}\n---`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          topP: 0.9,
        },
      });

      const rawText = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!rawText.trim()) {
        console.warn(`[extractTriples] Gemini (${modelName}) returned an empty response for chunk.`);
        continue;
      }

      const parsed = parseJsonSafely(rawText);
      const valid = extractTriplesList(parsed);

      if (valid.length > 0) {
        return valid;
      }

      console.warn(
        `[extractTriples] Model (${modelName}) produced no valid triples. Raw output:\n`,
        rawText.slice(0, 300)
      );
    } catch (err) {
      lastErr = err;
      const status = err?.status || err?.statusCode || "";
      const msg = (err?.message || "").toLowerCase();
      const isRecoverable =
        status === 404 ||
        status === 429 ||
        status === 503 ||
        msg.includes("503") ||
        msg.includes("429") ||
        msg.includes("high demand") ||
        msg.includes("exhausted") ||
        msg.includes("quota") ||
        msg.includes("unavailable");

      if (isRecoverable) {
        console.warn(`[extractTriples] Model ${modelName} transient issue (${status || msg.slice(0, 50)}). Trying fallback model...`);
        continue;
      }
      throw err;
    }
  }

  if (lastErr) {
    throw lastErr;
  }

  return [];
}

