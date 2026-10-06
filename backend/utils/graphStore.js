/**
 * utils/graphStore.js
 *
 * Persists a graphology Graph to/from a JSON file using graphology's
 * built-in export/import format.
 *
 * Exported:
 *   saveGraph(graph)  → Promise<void>
 *   loadGraph()       → Promise<Graph | null>
 *   clearGraph()      → Promise<void>
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Graph from "graphology";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.resolve(__dirname, "../data");
const GRAPH_PATH = path.join(DATA_DIR, "graph.json");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/**
 * Serialize and save the graph to disk.
 * @param {Graph} graph
 */
export async function saveGraph(graph) {
  await ensureDataDir();
  const serialized = JSON.stringify(graph.export(), null, 2);
  await fs.writeFile(GRAPH_PATH, serialized, "utf-8");
}

/**
 * Load the graph from disk. Returns null if no file exists yet.
 * @returns {Promise<Graph|null>}
 */
export async function loadGraph() {
  try {
    const raw = await fs.readFile(GRAPH_PATH, "utf-8");
    const data = JSON.parse(raw);
    return Graph.from(data, { multi: true, type: "directed" });
  } catch (err) {
    if (err.code === "ENOENT") return null;   // No graph file yet — fresh start
    throw err;
  }
}

/**
 * Delete the persisted graph file (reset to empty state).
 */
export async function clearGraph() {
  try {
    await fs.unlink(GRAPH_PATH);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;     // Ignore "already gone"
  }
}
