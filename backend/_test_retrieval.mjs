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
      const response = await fetch("http://localhost:4001/api/query/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      
      const json = await response.json();
      
      if (json.noFacts) {
        console.log(`✅ Result: noFacts=true (Extracted entities: ${json.extractedEntities ? json.extractedEntities.join(', ') : 'none'})`);
      } else {
        console.log(`Matched Entities: ${json.matchedEntities.join(', ')}`);
        console.log(`Subgraph Nodes: ${json.subgraphNodes.length}`);
        console.log(`Subgraph Edges: ${json.subgraphEdges.length}`);
        
        console.log(`\nEdges found:`);
        json.subgraphEdges.forEach(e => {
          console.log(`  "${e.sourceLabel}" --[${e.predicate}]--> "${e.targetLabel}"`);
        });
      }
    } catch (e) {
      console.error("Request failed:", e.message);
    }
  }
}

runTests();
