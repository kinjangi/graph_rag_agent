/**
 * services/retrieval.js
 * 
 * Given a question and a graph, extracts entities, finds matches,
 * and extracts a localized subgraph around them.
 */

import { getModel, GEMINI_MODEL } from "./geminiClient.js";
import { isContainedIn, areSimilar, toKey } from "../utils/textMatching.js";

// Utility to parse JSON safely if Gemini wraps it in markdown fences
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

/**
 * Step A: Entity Linking
 */
async function extractEntitiesFromQuestion(question) {
  const prompt = `
You are an entity extraction system.
Analyze the following user question and identify the key entities or concepts it is asking about.
Extract specific names, organizations, technologies, places, or dates.
Respond ONLY with a JSON object in this exact format:
{ "entities": ["entity1", "entity2"] }

Question: "${question}"
`;

  const client = getModel();
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt
  });
  const text = response.text;
  
  const parsed = parseJsonSafely(text);
  return parsed.entities || [];
}

/**
 * Step B: Graph Matching
 */
function findMatchingNodes(entities, graph) {
  const matchedNodeIds = new Set();
  const matchedEntities = [];

  for (const entity of entities) {
    let matchFound = false;
    graph.forEachNode((nodeId, attrs) => {
      const label = attrs.label;
      if (!label) return;
      
      // Check for similarity or if the entity is contained in the label (or vice versa)
      if (areSimilar(entity, label) || isContainedIn(entity, label) || isContainedIn(label, entity)) {
        matchedNodeIds.add(nodeId);
        matchFound = true;
      }
    });
    if (matchFound) {
      matchedEntities.push(entity);
    }
  }

  return { matchedNodeIds: Array.from(matchedNodeIds), matchedEntities };
}

/**
 * Step C: Subgraph Traversal
 */
function traverseSubgraph(startNodeIds, graph, maxEdges = 40) {
  const subgraphNodes = new Map();
  const subgraphEdges = new Map();
  const sourceChunkIds = new Set();
  
  let edgeCount = 0;
  
  // Helper to add a node
  const addNode = (nodeId) => {
    if (!subgraphNodes.has(nodeId)) {
      subgraphNodes.set(nodeId, { id: nodeId, ...graph.getNodeAttributes(nodeId) });
    }
  };
  
  // Helper to add an edge
  const addEdge = (edgeId, source, target) => {
    if (edgeCount >= maxEdges) return false;
    if (!subgraphEdges.has(edgeId)) {
      const attrs = graph.getEdgeAttributes(edgeId);
      
      subgraphEdges.set(edgeId, {
        id: edgeId,
        source,
        target,
        sourceLabel: graph.getNodeAttribute(source, "label"),
        targetLabel: graph.getNodeAttribute(target, "label"),
        ...attrs
      });
      
      if (attrs.sourceChunkIds) {
        attrs.sourceChunkIds.forEach(id => sourceChunkIds.add(id));
      }
      
      edgeCount++;
    }
    return true;
  };
  
  // 1-hop and 2-hop traversal
  const hop1Nodes = new Set(startNodeIds);
  const hop2Nodes = new Set();
  
  // Add start nodes
  startNodeIds.forEach(addNode);
  
  // Traverse 1-hop
  for (const nodeId of hop1Nodes) {
    if (edgeCount >= maxEdges) break;
    
    // Outbound edges
    graph.forEachOutEdge(nodeId, (edge, attrs, source, target) => {
      if (addEdge(edge, source, target)) {
        addNode(target);
        hop2Nodes.add(target);
      }
    });
    
    // Inbound edges
    graph.forEachInEdge(nodeId, (edge, attrs, source, target) => {
      if (addEdge(edge, source, target)) {
        addNode(source);
        hop2Nodes.add(source);
      }
    });
  }
  
  // Traverse 2-hop
  for (const nodeId of hop2Nodes) {
    if (edgeCount >= maxEdges) break;
    
    graph.forEachOutEdge(nodeId, (edge, attrs, source, target) => {
      // Only add edge if target is already in the subgraph (to avoid expanding too wide)
      // or if we really want full 2-hop. Let's add full 2-hop bounded by maxEdges.
      if (addEdge(edge, source, target)) {
        addNode(target);
      }
    });
    
    graph.forEachInEdge(nodeId, (edge, attrs, source, target) => {
      if (addEdge(edge, source, target)) {
        addNode(source);
      }
    });
  }
  
  return {
    subgraphNodes: Array.from(subgraphNodes.values()),
    subgraphEdges: Array.from(subgraphEdges.values()),
    sourceChunkIds: Array.from(sourceChunkIds)
  };
}

export async function retrieveRelevantSubgraph(question, graph) {
  // Step A
  const entities = await extractEntitiesFromQuestion(question);
  
  if (entities.length === 0) {
    return { noFacts: true };
  }
  
  // Step B
  const { matchedNodeIds, matchedEntities } = findMatchingNodes(entities, graph);
  
  if (matchedNodeIds.length === 0) {
    return { noFacts: true, extractedEntities: entities };
  }
  
  // Step C
  const { subgraphNodes, subgraphEdges, sourceChunkIds } = traverseSubgraph(matchedNodeIds, graph);
  
  return {
    matchedEntities,
    subgraphNodes,
    subgraphEdges,
    sourceChunkIds
  };
}
