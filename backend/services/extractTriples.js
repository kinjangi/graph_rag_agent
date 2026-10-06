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
 * Strip ```json ... ``` fences that the model sometimes wraps around output
 * even when told not to, then parse JSON.
 */
function parseJsonSafely(raw) {
  if (!raw || typeof raw !== "string") return null;

  // Remove markdown code fences
  let cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  // Sometimes the model wraps output in a single outer object — try to
  // find the first '{' in case there's leading prose
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ── Core extraction function ──────────────────────────────────────────────────

/**
 * extractTriplesFromChunk(chunkText)
 *
 * Calls Gemini with the extraction prompt and returns an array of triple
 * objects. On parse failure or empty response, returns [] with a warning.
 *
 * @param {string} chunkText  - Raw text of a single chunk.
 * @returns {Promise<Array<{subject,predicate,object,subjectType,objectType}>>}
 */
export async function extractTriplesFromChunk(chunkText) {
  if (!chunkText || !chunkText.trim()) return [];

  const client = getClient();

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
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
      temperature: 0.1,   // low temp → more deterministic, fewer hallucinations
      topP: 0.9,
    },
  });

  const rawText = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!rawText.trim()) {
    console.warn("[extractTriples] Gemini returned an empty response for chunk.");
    return [];
  }

  const parsed = parseJsonSafely(rawText);

  if (!parsed || !Array.isArray(parsed.triples)) {
    console.warn(
      "[extractTriples] Could not parse triples from model response. Raw output:\n",
      rawText.slice(0, 400)
    );
    return [];
  }

  // Validate each triple has the required keys; drop malformed ones
  const valid = parsed.triples.filter(
    (t) =>
      t &&
      typeof t.subject === "string" && t.subject.trim() &&
      typeof t.predicate === "string" && t.predicate.trim() &&
      typeof t.object === "string" && t.object.trim()
  );

  return valid;
}
