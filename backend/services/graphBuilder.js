/**
 * services/graphBuilder.js
 *
 * Builds and mutates a graphology MultiDirectedGraph from an array of
 * triple objects.  Handles:
 *   - Entity normalisation  (canonical display name, lowercase lookup key)
 *   - Similarity-based node merging  (conservative fuzzy dedup)
 *   - Edge deduplication  (same subject+predicate+object → accumulate chunkIds)
 *
 * Exported:
 *   buildGraphFromTriples(triples, existingGraph?) → { graph, stats }
 */

import Graph from "graphology";

import { toKey, areSimilar } from "../utils/textMatching.js";

// ── Graph builder ─────────────────────────────────────────────────────────────

/**
 * buildGraphFromTriples(triples, existingGraph?)
 *
 * @param {Array<{subject,predicate,object,subjectType,objectType,sourceChunkId}>} triples
 * @param {Graph|null} existingGraph   Graphology instance to mutate, or null for new graph
 * @returns {{ graph: Graph, stats: object }}
 */
export function buildGraphFromTriples(triples, existingGraph = null) {
  // multi:true → multiple predicate-distinct edges between the same node pair
  const graph = existingGraph ?? new Graph({ multi: true, type: "directed" });

  // Fast lookup: normalised key → canonical node id
  const keyToNodeId = new Map();
  for (const nodeId of graph.nodes()) {
    const attrs = graph.getNodeAttributes(nodeId);
    keyToNodeId.set(toKey(attrs.label ?? nodeId), nodeId);
  }

  const stats = {
    triplesProcessed: triples.length,
    nodesAdded: 0,
    nodesMerged: 0,
    edgesAdded: 0,
    edgesDeduplicated: 0,
    mergeLog: [],
  };

  // ── Edge dedup index: "srcId||normPredicate||tgtId" → edgeKey ───────────────
  const edgeIndex = new Map();
  for (const edgeKey of graph.edges()) {
    const src  = graph.source(edgeKey);
    const tgt  = graph.target(edgeKey);
    const pred = graph.getEdgeAttribute(edgeKey, "predicate") ?? "";
    edgeIndex.set(`${src}||${toKey(pred)}||${tgt}`, edgeKey);
  }

  // ── Resolve or create a node ──────────────────────────────────────────────────
  function resolveNode(name, type) {
    const key = toKey(name);

    // 1. Exact normalised match
    if (keyToNodeId.has(key)) return keyToNodeId.get(key);

    // 2. Conservative fuzzy match
    for (const [, existingId] of keyToNodeId) {
      const existingLabel = graph.getNodeAttribute(existingId, "label");
      if (areSimilar(name, existingLabel)) {
        const msg = `"${name}" → "${existingLabel}"`;
        console.log(`[graphBuilder] 🔗 Merged ${msg}`);
        stats.nodesMerged++;
        stats.mergeLog.push(msg);
        keyToNodeId.set(key, existingId);   // cache for subsequent lookups
        return existingId;
      }
    }

    // 3. New node
    const nodeId = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    graph.addNode(nodeId, {
      label: name,
      type:  type ?? "UNKNOWN",
      addedAt: new Date().toISOString(),
    });
    keyToNodeId.set(key, nodeId);
    stats.nodesAdded++;
    return nodeId;
  }

  // ── Process triples ──────────────────────────────────────────────────────────
  for (const triple of triples) {
    const { subject, predicate, object, subjectType, objectType, sourceChunkId } = triple;
    if (!subject?.trim() || !predicate?.trim() || !object?.trim()) continue;

    const srcId = resolveNode(subject.trim(), subjectType);
    const tgtId = resolveNode(object.trim(), objectType);

    const sig = `${srcId}||${toKey(predicate.trim())}||${tgtId}`;

    if (edgeIndex.has(sig)) {
      // Duplicate: accumulate sourceChunkId on existing edge
      const ek = edgeIndex.get(sig);
      const ids = graph.getEdgeAttribute(ek, "sourceChunkIds") ?? [];
      if (sourceChunkId !== undefined && !ids.includes(sourceChunkId)) {
        graph.setEdgeAttribute(ek, "sourceChunkIds", [...ids, sourceChunkId]);
      }
      stats.edgesDeduplicated++;
    } else {
      // New edge — use addDirectedEdge (explicit for multi graphs)
      const ek = graph.addDirectedEdge(srcId, tgtId, {
        predicate: predicate.trim(),
        sourceChunkIds: sourceChunkId !== undefined ? [sourceChunkId] : [],
        addedAt: new Date().toISOString(),
      });
      edgeIndex.set(sig, ek);
      stats.edgesAdded++;
    }
  }

  return { graph, stats };
}
