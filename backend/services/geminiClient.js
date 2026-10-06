/**
 * services/geminiClient.js
 * Shared, lazily-initialised Gemini SDK client.
 *
 * Usage:
 *   import { getModel, GEMINI_MODEL } from "./geminiClient.js";
 *   const model = getModel();
 */

import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

let _client = null;

/**
 * Returns the shared GoogleGenAI client, creating it on first call.
 * Throws clearly if GEMINI_API_KEY is missing.
 */
export function getClient() {
  if (_client) return _client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    throw new Error(
      "GEMINI_API_KEY is not set. Copy backend/.env.example to backend/.env and add your key."
    );
  }

  _client = new GoogleGenAI({ apiKey });
  return _client;
}

/**
 * Convenience helper — returns a models handle pointing at GEMINI_MODEL.
 * The caller can then do: model.generateContent(...)
 */
export function getModel() {
  return getClient();        // caller accesses client.models directly
}
