/**
 * Centralized API configuration for Graph RAG Agent frontend.
 * Reads backend URL from Vite environment variables (VITE_API_URL),
 * falling back to localhost:4001 for local development.
 */

const RAW_API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";

// Ensure no trailing slash so path concatenation remains uniform
export const API_URL = RAW_API_URL.replace(/\/+$/, "");

export const API_ENDPOINTS = {
  HEALTH: `${API_URL}/api/health`,
  UPLOAD: `${API_URL}/api/documents/upload`,
  EXTRACT: `${API_URL}/api/documents/extract`,
  GRAPH_BUILD: `${API_URL}/api/graph/build`,
  GRAPH: `${API_URL}/api/graph`,
  QUERY_RETRIEVE: `${API_URL}/api/query/retrieve`,
  QUERY_ASK: `${API_URL}/api/query/ask`,
};

export default API_URL;
