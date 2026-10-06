import fetch from 'node-fetch';

const testQuestions = [
  "Who invented the World Wide Web?",
  "What happened during the dot-com boom?",
  "When was the iPhone debuted?",
  "How do you bake a chocolate cake?" // Irrelevant question
];

async function runTests() {
  for (const q of testQuestions) {
    console.log(`\n======================================`);
    console.log(`Question: "${q}"`);
    console.log(`======================================`);
    
    try {
      const response = await fetch("http://localhost:4001/api/query/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      
      const json = await response.json();
      
      if (json.error) {
        console.error("Error:", json.error, json.detail);
      } else {
        console.log(`Answer: ${json.answer}`);
        console.log(`Confidence: ${json.confidence}`);
        if (json.factsUsed && json.factsUsed.length > 0) {
            console.log(`Facts Used: [${json.factsUsed.join(', ')}]`);
        }
        if (json.sourceChunkIds && json.sourceChunkIds.length > 0) {
            console.log(`Source Chunks: [${json.sourceChunkIds.join(', ')}]`);
        }
      }
    } catch (e) {
      console.error("Request failed:", e.message);
    }
  }
}

runTests();
