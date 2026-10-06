# Graph RAG Agent

> A question-answering system that builds a **knowledge graph** from your documents and answers questions by traversing that graph — powered by Gemini and graphology.

---

## What is this?

Graph RAG Agent combines two ideas:

1. **Knowledge Graph construction** — uploaded documents are parsed, entities and relationships are extracted, and woven into a directed graph using [graphology](https://graphology.github.io/).
2. **Graph-augmented RAG** — when you ask a question, the agent traverses the graph to find relevant context, then passes that context to a Gemini LLM for final answer generation.

This gives richer, more structured context than vanilla vector-similarity RAG.

---

## Project Structure

```
graph_rag_agent/
├── backend/          # Node.js + Express API
│   ├── index.js      # Entry point (Express app, /api/health, …)
│   ├── .env.example  # Copy to .env and fill in your GEMINI_API_KEY
│   └── package.json
│
├── frontend/         # React + Vite SPA
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route-level page components
│   │   │   └── Home.jsx  # Placeholder homepage
│   │   ├── state/        # Global state (Zustand / Context)
│   │   └── utils/        # Helper functions & API client
│   └── package.json
│
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/)

### 1 — Configure the backend

```bash
cd backend
cp .env.example .env          # Windows: copy .env.example .env
# Open .env and set GEMINI_API_KEY=<your key>
```

### 2 — Run the backend

```bash
# Terminal 1 — from the backend/ folder
cd backend
npm run dev
# → 🚀 Graph RAG backend listening on http://localhost:4001
```

### 3 — Run the frontend

```bash
# Terminal 2 — from the frontend/ folder
cd frontend
npm run dev
# → VITE ready at http://localhost:5173
```

### 4 — Verify

| Check | URL |
|---|---|
| Backend health | `GET http://localhost:4001/api/health` → `{ "status": "ok" }` |
| Frontend homepage | `http://localhost:5173` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js (ESM) |
| HTTP framework | Express 5 |
| File uploads | multer |
| Graph engine | graphology |
| LLM SDK | @google/genai (Gemini) |
| Frontend framework | React 19 + Vite 6 |
| Styling | Vanilla CSS (design tokens) |

---

## Roadmap

- [ ] Document upload endpoint (`POST /api/documents`)
- [ ] Entity / relationship extraction pipeline
- [ ] Graphology graph store & traversal
- [ ] Q&A endpoint (`POST /api/ask`)
- [ ] Frontend: file upload UI
- [ ] Frontend: graph visualisation
- [ ] Frontend: chat / Q&A interface
