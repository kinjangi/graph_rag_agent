import { getClient } from "../backend/services/geminiClient.js";

async function test() {
  const client = getClient();
  const candidates = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash-latest",
    "gemini-3.1-flash-lite"
  ];

  for (const model of candidates) {
    try {
      const res = await client.models.generateContent({
        model,
        contents: "Hi"
      });
      console.log(`SUCCESS: ${model} -> ${res.text.slice(0, 30)}`);
      break;
    } catch (e) {
      console.log(`FAILED: ${model} -> ${e.message.slice(0, 100)}`);
    }
  }
}

test();
