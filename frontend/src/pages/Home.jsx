import "./Home.css";

export default function Home() {
  return (
    <main className="home">
      {/* Ambient glow orbs */}
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />

      <div className="hero">
        {/* Badge */}
        <span className="badge">
          <span className="badge-dot" />
          Knowledge Graph · RAG · LLM
        </span>

        {/* Heading */}
        <h1 className="title">
          Graph&nbsp;<span className="accent">RAG</span>&nbsp;Agent
        </h1>

        {/* Subtitle */}
        <p className="subtitle">
          Upload documents, build a knowledge graph, ask questions.
        </p>

        {/* Status indicator */}
        <div className="status-row">
          <HealthBadge />
        </div>
      </div>

      {/* Feature cards */}
      <section className="cards" aria-label="Core features">
        <FeatureCard
          icon="📄"
          title="Document Ingestion"
          description="Upload PDFs, text files, or paste raw content to seed the knowledge base."
          step="01"
        />
        <FeatureCard
          icon="🕸️"
          title="Graph Construction"
          description="Entities and relationships are extracted and woven into a rich knowledge graph."
          step="02"
        />
        <FeatureCard
          icon="💬"
          title="Intelligent Q&amp;A"
          description="Ask natural-language questions. The agent traverses the graph and reasons with an LLM."
          step="03"
        />
      </section>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FeatureCard({ icon, title, description, step }) {
  return (
    <article className="card">
      <span className="card-step">{step}</span>
      <div className="card-icon">{icon}</div>
      <h2 className="card-title">{title}</h2>
      <p className="card-desc" dangerouslySetInnerHTML={{ __html: description }} />
    </article>
  );
}

function HealthBadge() {
  return (
    <span className="health-badge" title="Backend health status will appear here">
      <span className="pulse" />
      Backend: coming soon
    </span>
  );
}
