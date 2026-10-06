/**
 * routes/query.js
 */
import express from "express";
import { loadGraph } from "../utils/graphStore.js";
import { retrieveRelevantSubgraph } from "../services/retrieval.js";
import { generateAnswer } from "../services/answerGenerator.js";

const router = express.Router();

router.post("/retrieve", async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: "Missing 'question' in request body." });
    }
    
    const graph = await loadGraph();
    if (!graph) {
      return res.status(404).json({ error: "Graph not found. Please build the graph first." });
    }
    
    const result = await retrieveRelevantSubgraph(question, graph);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[query/retrieve] Error:", err);
    return res.status(500).json({ error: "Retrieval failed.", detail: err.message });
  }
});

router.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: "Missing 'question' in request body." });
    }
    
    const graph = await loadGraph();
    if (!graph) {
      return res.status(404).json({ error: "Graph not found. Please build the graph first." });
    }
    
    const retrievalResult = await retrieveRelevantSubgraph(question, graph);
    const finalAnswer = await generateAnswer(question, retrievalResult);
    
    return res.status(200).json(finalAnswer);
  } catch (err) {
    console.error("[query/ask] Error:", err);
    return res.status(500).json({ error: "Answer generation failed.", detail: err.message });
  }
});

export default router;
