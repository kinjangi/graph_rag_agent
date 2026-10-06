import "dotenv/config";
import express from "express";
import cors from "cors";
import uploadRouter from "./routes/upload.js";
import extractRouter from "./routes/extract.js";
import graphRouter from "./routes/graph.js";
import queryRouter from "./routes/query.js";

const app = express();
const PORT = process.env.PORT || 4001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/documents", uploadRouter);
app.use("/api/documents", extractRouter);
app.use("/api/graph", graphRouter);
app.use("/api/query", queryRouter);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Graph RAG backend listening on http://localhost:${PORT}`);
});
