import { useState, useEffect } from "react";
import { 
  Share2, 
  Search, 
  Trash2, 
  Loader2, 
  Layers, 
  ArrowRight, 
  RefreshCw,
  Box,
  FileCode2
} from "lucide-react";
import "./GraphExplorer.css";

export default function GraphExplorer({ onNavigate }) {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("nodes"); // "nodes" | "edges"
  const [selectedType, setSelectedType] = useState("ALL");

  const fetchGraph = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:4001/api/graph");
      if (!res.ok) {
        if (res.status === 404) {
          setGraphData({ summary: { nodeCount: 0, edgeCount: 0 }, nodes: [], edges: [] });
          return;
        }
        throw new Error(`Failed to fetch graph (${res.status})`);
      }
      const data = await res.json();
      setGraphData(data);
    } catch (err) {
      console.error("Fetch graph error:", err);
      setError(err.message || "Failed to load graph.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  const handleClearGraph = async () => {
    if (!window.confirm("Are you sure you want to clear the stored knowledge graph? This cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch("http://localhost:4001/api/graph", { method: "DELETE" });
      if (res.ok) {
        fetchGraph();
      } else {
        alert("Failed to clear graph.");
      }
    } catch (err) {
      alert(`Error clearing graph: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="graph-container animate-fade-in" style={{ textAlign: "center", padding: "4rem" }}>
        <Loader2 size={32} className="step-spinner" style={{ color: "var(--accent-purple)", margin: "0 auto 1rem auto" }} />
        <div>Loading Knowledge Graph...</div>
      </div>
    );
  }

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  // Extract unique entity types
  const typesSet = new Set(nodes.map((n) => n.type).filter(Boolean));
  const entityTypes = ["ALL", ...Array.from(typesSet)];

  // Filter nodes
  const filteredNodes = nodes.filter((n) => {
    const matchesSearch = !searchQuery || (n.label || n.id).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "ALL" || n.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Filter edges
  const filteredEdges = edges.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (e.sourceLabel || "").toLowerCase().includes(q) ||
      (e.predicate || "").toLowerCase().includes(q) ||
      (e.targetLabel || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="graph-container animate-fade-in">
      {/* Top Stats */}
      <div className="graph-stats-row">
        <div className="stat-card">
          <div className="stat-icon nodes">
            <Box size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-val">{nodes.length}</span>
            <span className="stat-lbl">Entity Nodes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon edges">
            <Share2 size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-val">{edges.length}</span>
            <span className="stat-lbl">Relationship Edges</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon types">
            <Layers size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-val">{typesSet.size}</span>
            <span className="stat-lbl">Entity Types</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="explorer-toolbar">
        <div className="search-box">
          <Search size={18} style={{ color: "var(--fg-muted)" }} />
          <input
            type="text"
            placeholder="Search nodes or predicates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="subnav-tabs">
          <button
            className={`subnav-btn ${viewMode === "nodes" ? "active" : ""}`}
            onClick={() => setViewMode("nodes")}
          >
            Nodes ({filteredNodes.length})
          </button>
          <button
            className={`subnav-btn ${viewMode === "edges" ? "active" : ""}`}
            onClick={() => setViewMode("edges")}
          >
            Edges ({filteredEdges.length})
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="clear-graph-btn" onClick={fetchGraph} title="Refresh graph data">
            <RefreshCw size={16} />
          </button>
          {nodes.length > 0 && (
            <button className="clear-graph-btn" onClick={handleClearGraph}>
              <Trash2 size={16} />
              Clear Graph
            </button>
          )}
        </div>
      </div>

      {/* Type Filters bar if in Nodes view */}
      {viewMode === "nodes" && entityTypes.length > 2 && (
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {entityTypes.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`type-filter-btn ${selectedType === t ? "active" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Main View */}
      {nodes.length === 0 ? (
        <div className="empty-state">
          <Share2 size={40} style={{ margin: "0 auto 1rem auto", opacity: 0.4 }} />
          <h3>Knowledge Graph is Empty</h3>
          <p style={{ marginTop: "0.5rem" }}>
            No entities or relations have been constructed yet. Upload a document to populate the graph!
          </p>
          <button 
            className="action-btn primary" 
            style={{ marginTop: "1.25rem" }}
            onClick={() => onNavigate("upload")}
          >
            Go to Upload Page
          </button>
        </div>
      ) : viewMode === "nodes" ? (
        <div className="nodes-grid">
          {filteredNodes.map((node) => (
            <div key={node.id} className="node-card">
              <div className="node-header">
                <span className="node-label">{node.label || node.id}</span>
                <span className="type-badge">{node.type || "Concept"}</span>
              </div>
              <div className="node-id">ID: {node.id}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="edges-list">
          {filteredEdges.map((edge) => (
            <div key={edge.id} className="edge-card">
              <div className="triple-flow">
                <span className="triple-node">{edge.sourceLabel}</span>
                <span className="triple-pred">
                  <ArrowRight size={14} />
                  {edge.predicate}
                  <ArrowRight size={14} />
                </span>
                <span className="triple-node">{edge.targetLabel}</span>
              </div>

              {edge.chunkId !== undefined && (
                <div className="edge-meta">
                  <span className="chunk-tag">
                    <FileCode2 size={12} style={{ display: "inline", marginRight: "3px" }} />
                    Chunk #{edge.chunkId}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
