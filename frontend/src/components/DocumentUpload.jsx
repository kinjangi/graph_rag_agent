import { useState, useRef } from "react";
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  ArrowRight, 
  Share2, 
  MessageSquare,
  Sparkles 
} from "lucide-react";
import { API_ENDPOINTS } from "../config/api";
import "./DocumentUpload.css";

export default function DocumentUpload({ onNavigate }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | processing | success | error
  const [currentStep, setCurrentStep] = useState(0); // 1: upload/chunk, 2: extract, 3: build
  const [errorMsg, setErrorMsg] = useState("");
  const [summaryData, setSummaryData] = useState(null);
  const fileInputRef = useRef(null);

  const [chunksCount, setChunksCount] = useState(0);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext !== "txt" && ext !== "pdf") {
      setErrorMsg("Please select a .txt or .pdf document.");
      return;
    }
    setErrorMsg("");
    setSelectedFile(file);
    setStatus("idle");
    setSummaryData(null);
    setChunksCount(0);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 120000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        throw new Error(`Request timed out after ${timeoutMs / 1000}s. The server may be busy or waiting on API rate limits.`);
      }
      throw err;
    }
  };

  const startPipeline = async () => {
    if (!selectedFile) return;
    setStatus("processing");
    setErrorMsg("");
    setCurrentStep(1);

    try {
      // Step 1: Upload & Chunk
      const formData = new FormData();
      formData.append("document", selectedFile);

      const uploadRes = await fetchWithTimeout(API_ENDPOINTS.UPLOAD, {
        method: "POST",
        body: formData
      }, 30000);

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}));
        const msg = errJson.detail ? `${errJson.error} (${errJson.detail})` : (errJson.error || `Upload failed with status ${uploadRes.status}`);
        throw new Error(msg);
      }

      const uploadData = await uploadRes.json();
      const chunks = uploadData.chunking?.chunks || [];

      if (!chunks.length) {
        throw new Error("No text chunks generated from document.");
      }

      setChunksCount(chunks.length);

      // Step 2: Extract Triples
      setCurrentStep(2);

      const extractRes = await fetchWithTimeout(API_ENDPOINTS.EXTRACT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunks })
      }, 300000);

      if (!extractRes.ok) {
        const errJson = await extractRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Extraction failed with status ${extractRes.status}`);
      }

      const extractData = await extractRes.json();
      const triples = extractData.triples || [];

      if (!triples.length) {
        throw new Error("No knowledge triples could be extracted from document.");
      }

      // Step 3: Build Graph
      setCurrentStep(3);

      const graphRes = await fetchWithTimeout(API_ENDPOINTS.GRAPH_BUILD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triples })
      }, 45000);

      if (!graphRes.ok) {
        const errJson = await graphRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Graph build failed with status ${graphRes.status}`);
      }

      const graphData = await graphRes.json();

      // All done!
      setStatus("success");
      setSummaryData({
        filename: uploadData.filename,
        fileSizeBytes: uploadData.fileSizeBytes,
        chunkCount: uploadData.chunking.chunkCount,
        triplesCount: extractData.summary.triplesExtracted,
        totalNodes: graphData.stats.totalNodes,
        totalEdges: graphData.stats.totalEdges,
        mergedNodes: graphData.stats.mergedNodesCount,
        duplicatesSkipped: graphData.stats.duplicatesSkipped
      });

    } catch (err) {
      console.error("Pipeline error:", err);
      setStatus("error");
      setErrorMsg(err.message || "An unexpected error occurred during ingestion.");
    }
  };

  return (
    <div className="upload-container animate-fade-in">
      <div className="upload-header">
        <h1>Document Knowledge Ingestion</h1>
        <p>Upload files to convert raw text into an interconnected entity-relationship graph</p>
      </div>

      {errorMsg && (
        <div className="error-banner">
          <AlertCircle size={20} className="error-banner-icon" />
          <div className="error-banner-body">
            <span className="error-banner-text">{errorMsg}</span>
          </div>
          {selectedFile && (
            <button 
              type="button" 
              className="retry-inline-btn" 
              onClick={startPipeline}
            >
              Retry Ingestion
            </button>
          )}
        </div>
      )}

      {status !== "processing" && status !== "success" && (
        <div 
          className={`dropzone-card ${dragActive ? "drag-active" : ""}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept=".txt,.pdf"
            className="file-input"
          />
          <div className="dropzone-icon">
            <Upload size={32} />
          </div>
          <div className="dropzone-title">
            {selectedFile ? "Change Document" : "Drag & drop document here"}
          </div>
          <div className="dropzone-hint">
            Supports .TXT and .PDF text documents (up to 20MB)
          </div>
          <button type="button" className="browse-btn" onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}>
            Browse Files
          </button>
        </div>
      )}

      {selectedFile && (status === "idle" || status === "error") && (
        <div className="file-selected-bar">
          <div className="file-info">
            <FileText size={20} className="accent-purple" />
            <div>
              <div className="file-name-text">{selectedFile.name}</div>
              <div className="file-size">{formatBytes(selectedFile.size)}</div>
            </div>
          </div>
          <button 
            className={`process-start-btn ${status === "error" ? "retry-btn" : ""}`} 
            onClick={startPipeline}
          >
            <Sparkles size={16} />
            {status === "error" ? "Retry Pipeline" : "Start Pipeline"}
          </button>
        </div>
      )}

      {status === "processing" && (
        <div className="pipeline-card">
          <div className="pipeline-title">
            <span>Knowledge Graph Ingestion Pipeline</span>
            <span className="file-size">{selectedFile?.name}</span>
          </div>

          <div className="pipeline-steps">
            {/* Step 1 */}
            <div className={`step-item ${currentStep === 1 ? "active" : currentStep > 1 ? "completed" : ""}`}>
              <div className="step-circle">
                {currentStep > 1 ? <CheckCircle2 size={18} /> : currentStep === 1 ? <Loader2 size={16} className="step-spinner" /> : "1"}
              </div>
              <div className="step-details">
                <div className="step-label">Stage 1: Text Extraction &amp; Chunking</div>
                <div className="step-desc">Parsing document structure and splitting into sliding window chunks</div>
              </div>
            </div>

            {/* Step 2 */}
            <div className={`step-item ${currentStep === 2 ? "active" : currentStep > 2 ? "completed" : ""}`}>
              <div className="step-circle">
                {currentStep > 2 ? <CheckCircle2 size={18} /> : currentStep === 2 ? <Loader2 size={16} className="step-spinner" /> : "2"}
              </div>
              <div className="step-details">
                <div className="step-label">Stage 2: LLM Knowledge Extraction {chunksCount > 0 && `(${chunksCount} chunks)`}</div>
                <div className="step-desc">
                  {chunksCount > 0 
                    ? `Extracting entity triples across ${chunksCount} chunks (pacing requests to stay within API rate limits)...`
                    : "Prompting Gemini to extract (Subject, Predicate, Object) entity triples..."}
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className={`step-item ${currentStep === 3 ? "active" : currentStep > 3 ? "completed" : ""}`}>
              <div className="step-circle">
                {currentStep > 3 ? <CheckCircle2 size={18} /> : currentStep === 3 ? <Loader2 size={16} className="step-spinner" /> : "3"}
              </div>
              <div className="step-details">
                <div className="step-label">Stage 3: Graph Construction &amp; Deduplication</div>
                <div className="step-desc">Normalizing entity nodes, resolving canonical titles, and storing graph</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === "success" && summaryData && (
        <div className="summary-box animate-fade-in">
          <div className="summary-header">
            <CheckCircle2 size={24} />
            <span>Ingestion Pipeline Completed Successfully!</span>
          </div>

          <div className="summary-grid">
            <div className="summary-stat-card">
              <span className="summary-stat-value">{summaryData.chunkCount}</span>
              <span className="summary-stat-label">Chunks Processed</span>
            </div>

            <div className="summary-stat-card">
              <span className="summary-stat-value">{summaryData.triplesCount}</span>
              <span className="summary-stat-label">Triples Extracted</span>
            </div>

            <div className="summary-stat-card">
              <span className="summary-stat-value">{summaryData.totalNodes}</span>
              <span className="summary-stat-label">Total Nodes</span>
            </div>

            <div className="summary-stat-card">
              <span className="summary-stat-value">{summaryData.totalEdges}</span>
              <span className="summary-stat-label">Total Edges</span>
            </div>
          </div>

          <div className="summary-actions">
            <button className="action-btn primary" onClick={() => onNavigate("chat")}>
              <MessageSquare size={16} />
              Ask Questions in Chat
            </button>
            <button className="action-btn secondary" onClick={() => onNavigate("graph")}>
              <Share2 size={16} />
              Explore Graph Structure
            </button>
            <button className="action-btn secondary" onClick={() => { setStatus("idle"); setSelectedFile(null); }}>
              Upload Another Document
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
