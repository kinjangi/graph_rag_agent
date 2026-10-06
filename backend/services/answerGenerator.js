/**
 * services/answerGenerator.js
 */

import { getModel, GEMINI_MODEL } from "./geminiClient.js";

function parseJsonSafely(text) {
  try {
    const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx >= 0 && endIdx > startIdx) {
      return JSON.parse(cleaned.substring(startIdx, endIdx + 1));
    }
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse Gemini output as JSON: ${err.message}\nRaw output: ${text}`);
  }
}

export async function generateAnswer(question, subgraphData) {
  if (subgraphData.noFacts) {
    return {
      answer: "I don't have information about that in the current knowledge graph.",
      confidence: "low",
      noFacts: true,
      factsUsed: [],
      sourceChunkIds: [],
      matchedEntities: [],
      subgraphEdges: []
    };
  }

  const { subgraphEdges = [], matchedEntities = [], sourceChunkIds = [] } = subgraphData;
  
  // Format facts for the prompt
  const formattedFacts = subgraphEdges.map((edge, idx) => {
    return `[Fact ${idx + 1}] ${edge.sourceLabel} -> ${edge.predicate} -> ${edge.targetLabel}`;
  }).join("\n");

  const prompt = `
You are a helpful and precise question-answering assistant.
Answer the user's question using ONLY the facts provided below.
Do not use outside knowledge.
If the facts don't fully answer the question, say what's missing.
Keep the answer concise and natural, not a bullet list of the raw facts.

Respond ONLY with a JSON object matching this schema:
{
  "answer": "Your natural language answer here",
  "confidence": "high" | "medium" | "low",
  "factsUsed": [1, 2, ...] // array of Fact numbers actually used in your answer
}

FACTS:
${formattedFacts}

QUESTION:
"${question}"
`;

  const client = getModel();
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt
  });
  
  const text = response.text;
  const parsed = parseJsonSafely(text);
  
  return {
    ...parsed,
    noFacts: false,
    matchedEntities,
    sourceChunkIds,
    subgraphEdges
  };
}
