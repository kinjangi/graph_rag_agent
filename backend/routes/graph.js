/**
 * routes/graph.js
 *
 * POST   /api/graph/build   — ingest triples, merge into stored graph, save
 * GET    /api/graph         — return full graph (nodes + edges)
 * DELETE /api/graph         — clear stored graph
 */

import express from "express";
import { buildGraphFromTriples } from "../services/graphBuilder.js";
import { saveGraph, loadGraph, clearGraph } from "../utils/graphStore.js";

const router = express.Router();

// ── POST /api/graph/build ─────────────────────────────────────────────────────
router.post("/build", async (req, res) => {
  try {
    const { triples } = req.body;

    if (!triples || !Array.isArray(triples) || triples.length === 0) {
      return res.status(400).json({
        error: 'Request body must include a non-empty "triples" array.',
      });
    }

    // Load existing graph from disk (null if first build)
    const existingGraph = await loadGraph();

    // Merge new triples into the graph with dedup + entity normalisation
    const { graph, stats } = buildGraphFromTriples(triples, existingGraph);

    // Persist updated graph
    await saveGraph(graph);

    return res.status(200).json({
      message: "Graph built and saved successfully.",
      stats: {
        ...stats,
        totalNodes: graph.order,       // graphology: .order = node count
        totalEdges: graph.size,        // graphology: .size  = edge count
      },
    });
  } catch (err) {
    console.error("[graph/build] Error:", err);
    return res.status(500).json({ error: "Graph build failed.", detail: err.message });
  }
});

// ── GET /api/graph ────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const graph = await loadGraph();
    if (!graph) {
      return res.status(404).json({ error: "No graph found. Call POST /api/graph/build first." });
    }

    // Build a human-friendly representation alongside the raw export
    const nodes = [];
    graph.forEachNode((nodeId, attrs) => {
      nodes.push({ id: nodeId, ...attrs });
    });

    const edges = [];
    graph.forEachEdge((edgeKey, attrs, source, target) => {
      const srcLabel = graph.getNodeAttribute(source, "label");
      const tgtLabel = graph.getNodeAttribute(target, "label");
      edges.push({
        id: edgeKey,
        source,
        target,
        sourceLabel: srcLabel,
        targetLabel: tgtLabel,
        ...attrs,
      });
    });

    return res.status(200).json({
      summary: { nodeCount: nodes.length, edgeCount: edges.length },
      nodes,
      edges,
    });
  } catch (err) {
    console.error("[graph/get] Error:", err);
    return res.status(500).json({ error: "Failed to retrieve graph.", detail: err.message });
  }
});

// ── DELETE /api/graph ─────────────────────────────────────────────────────────
router.delete("/", async (req, res) => {
  try {
    await clearGraph();
    return res.status(200).json({ message: "Graph cleared successfully." });
  } catch (err) {
    console.error("[graph/delete] Error:", err);
    return res.status(500).json({ error: "Failed to clear graph.", detail: err.message });
  }
});

export default router;
