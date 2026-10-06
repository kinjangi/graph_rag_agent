import { useState, useEffect } from "react";
import { Network, UploadCloud, MessageSquare, Share2, Activity } from "lucide-react";
import "./Navbar.css";

export default function Navbar({ activeTab, setActiveTab }) {
  const [health, setHealth] = useState({ status: "checking", online: false });

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch("http://localhost:4001/api/health");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setHealth({ status: "online", online: true, ...data });
        } else {
          if (isMounted) setHealth({ status: "offline", online: false });
        }
      } catch (err) {
        if (isMounted) setHealth({ status: "offline", online: false });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="navbar">
      <div className="nav-brand">
        <div className="brand-icon-wrapper">
          <Network size={22} />
        </div>
        <div className="brand-title-group">
          <span className="brand-title">Graph RAG Agent</span>
          <span className="brand-badge">Entity Graph &bull; Gemini RAG</span>
        </div>
      </div>

      <nav className="nav-tabs" aria-label="Main Navigation">
        <button
          className={`nav-tab-btn ${activeTab === "upload" ? "active" : ""}`}
          onClick={() => setActiveTab("upload")}
        >
          <span className="nav-tab-icon"><UploadCloud size={18} /></span>
          Upload &amp; Build
        </button>

        <button
          className={`nav-tab-btn ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          <span className="nav-tab-icon"><MessageSquare size={18} /></span>
          Ask &amp; Chat
        </button>

        <button
          className={`nav-tab-btn ${activeTab === "graph" ? "active" : ""}`}
          onClick={() => setActiveTab("graph")}
        >
          <span className="nav-tab-icon"><Share2 size={18} /></span>
          Graph Explorer
        </button>
      </nav>

      <div className="nav-status">
        <div className={`status-pill ${health.online ? "online" : "offline"}`}>
          <span className="status-dot" />
          <span>{health.online ? "Backend Ready" : "Backend Offline"}</span>
        </div>
      </div>
    </header>
  );
}
