import { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert,
  Database,
  FileCode2
} from "lucide-react";
import { API_ENDPOINTS } from "../config/api";
import "./ChatInterface.css";

const PRESET_QUESTIONS = [
  { text: "When was the World Wide Web created and who created it?", type: "relevant" },
  { text: "What was ARPANET?", type: "relevant" },
  { text: "When did the iPhone launch?", type: "relevant" },
  { text: "How do you bake a chocolate cake?", type: "irrelevant" }
];

export default function ChatInterface() {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      sender: "agent",
      text: "Hello! I am your Graph RAG assistant. Ask me anything about the ingested documents. I will retrieve facts from the knowledge graph and generate a grounded response.",
      confidence: "high"
    }
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryText) => {
    const question = (queryText || inputQuery).trim();
    if (!question || isLoading) return;

    setInputQuery("");
    
    // Add user message
    const userMsgId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: "user", text: question }
    ]);

    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.QUERY_ASK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "agent",
          text: data.answer,
          confidence: data.confidence || "low",
          noFacts: data.noFacts || false,
          matchedEntities: data.matchedEntities || [],
          factsUsed: data.factsUsed || [],
          subgraphEdges: data.subgraphEdges || [],
          sourceChunkIds: data.sourceChunkIds || []
        }
      ]);
    } catch (err) {
      console.error("Query error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "agent",
          text: `Sorry, an error occurred while processing your request: ${err.message}`,
          confidence: "low",
          noFacts: true
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container animate-fade-in">
      <div className="chat-card">
        {/* Header */}
        <div className="chat-header">
          <div className="chat-title-group">
            <div className="chat-icon-badge">
              <Bot size={20} />
            </div>
            <div>
              <div className="chat-title">Graph RAG Q&amp;A Chat</div>
              <div style={{ fontSize: "0.78rem", color: "var(--fg-muted)" }}>
                Strict Subgraph Traversal &bull; Zero hallucination mode
              </div>
            </div>
          </div>
        </div>

        {/* Quick Prompts Bar */}
        <div className="quick-prompts-bar">
          <span className="quick-prompt-label">Try Question:</span>
          {PRESET_QUESTIONS.map((q, i) => (
            <button
              key={i}
              className={`quick-prompt-chip ${q.type === "irrelevant" ? "irrelevant" : ""}`}
              onClick={() => handleSend(q.text)}
              disabled={isLoading}
            >
              {q.text}
            </button>
          ))}
        </div>

        {/* Messages Feed */}
        <div className="messages-feed">
          {messages.map((msg) => (
            <div key={msg.id} className={`message-row ${msg.sender}`}>
              <div className="avatar">
                {msg.sender === "user" ? <User size={18} /> : <Bot size={18} />}
              </div>

              <div className="message-bubble">
                {msg.sender === "agent" && (
                  <div className="badge-row">
                    <span className={`confidence-badge ${msg.confidence}`}>
                      {msg.confidence === "high" ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      {msg.confidence} confidence
                    </span>

                    {msg.noFacts && (
                      <span className="nofacts-banner">
                        <ShieldAlert size={14} />
                        No Graph Facts Matched (LLM Bypass Triggered)
                      </span>
                    )}
                  </div>
                )}

                <div className="message-text">{msg.text}</div>

                {/* Sources & Facts Accordion */}
                {msg.sender === "agent" && !msg.noFacts && (msg.matchedEntities?.length > 0 || msg.subgraphEdges?.length > 0) && (
                  <SourcesDrawer msg={msg} />
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message-row agent">
              <div className="avatar">
                <Bot size={18} />
              </div>
              <div className="message-bubble">
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--fg-muted)", fontSize: "0.9rem" }}>
                  <Loader2 size={16} className="step-spinner" />
                  <span>Traversing Knowledge Graph &amp; Generating Grounded Answer...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form 
          className="chat-input-form" 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            type="text"
            className="chat-input"
            placeholder="Ask a question about your knowledge graph..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isLoading}
          />
          <button type="submit" className="send-btn" disabled={isLoading || !inputQuery.trim()}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

function SourcesDrawer({ msg }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <button 
        type="button" 
        className="sources-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Database size={14} />
          View Retained Graph Facts &amp; Citations ({msg.subgraphEdges?.length || 0} facts)
        </span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isOpen && (
        <div className="sources-drawer animate-fade-in" style={{ marginTop: "0.4rem" }}>
          {msg.matchedEntities?.length > 0 && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--fg-muted)", marginBottom: "0.25rem", fontWeight: 600 }}>
                MATCHED ENTITIES:
              </div>
              <div className="matched-entities-group">
                {msg.matchedEntities.map((ent, idx) => (
                  <span key={idx} className="entity-tag">
                    {typeof ent === "object" ? ent.matchedNodeLabel || ent.extractedEntity : ent}
                  </span>
                ))}
              </div>
            </div>
          )}

          {msg.subgraphEdges?.length > 0 && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--fg-muted)", marginBottom: "0.25rem", fontWeight: 600 }}>
                RETRIEVED SUBGRAPH TRIPLES:
              </div>
              <div className="facts-list">
                {msg.subgraphEdges.map((edge, idx) => {
                  const isUsed = msg.factsUsed?.includes(idx + 1);
                  return (
                    <div 
                      key={idx} 
                      className="fact-item"
                      style={{ 
                        borderColor: isUsed ? "var(--accent-emerald)" : "var(--accent-purple)",
                        opacity: isUsed ? 1 : 0.7 
                      }}
                    >
                      <span style={{ color: isUsed ? "var(--accent-emerald)" : "var(--accent-purple)", fontWeight: 700, marginRight: "0.4rem" }}>
                        [Fact {idx + 1}] {isUsed ? "✓ Used" : ""}
                      </span>
                      {edge.sourceLabel} &rarr; <strong>{edge.predicate}</strong> &rarr; {edge.targetLabel}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {msg.sourceChunkIds?.length > 0 && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--fg-muted)", marginBottom: "0.25rem", fontWeight: 600 }}>
                SOURCE DOCUMENT CHUNKS:
              </div>
              <div className="chunk-citations">
                {msg.sourceChunkIds.map((cid, idx) => (
                  <span key={idx} className="chunk-tag">
                    <FileCode2 size={12} style={{ display: "inline", marginRight: "3px" }} />
                    Chunk #{cid}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
