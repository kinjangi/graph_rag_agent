import { useState } from "react";
import Navbar from "./components/Navbar";
import DocumentUpload from "./components/DocumentUpload";
import ChatInterface from "./components/ChatInterface";
import GraphExplorer from "./components/GraphExplorer";

export default function App() {
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main style={{ flex: 1, paddingBottom: "2rem" }}>
        {activeTab === "upload" && <DocumentUpload onNavigate={setActiveTab} />}
        {activeTab === "chat" && <ChatInterface />}
        {activeTab === "graph" && <GraphExplorer onNavigate={setActiveTab} />}
      </main>
    </div>
  );
}
