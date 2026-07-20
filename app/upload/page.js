"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { saveBook } from "@/lib/firestore";
import { extractPdf } from "@/lib/api";
import Link from "next/link";

export default function UploadPage() {
  return (
    <ProtectedRoute>
      <UploadContent />
    </ProtectedRoute>
  );
}

function UploadContent() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | uploading | saving | done | error
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [savedBookId, setSavedBookId] = useState(null);
  const [error, setError] = useState(null);

  /* ── Animación de progreso ──────────────────────────────────────── */
  useEffect(() => {
    let interval;
    let msgInterval;
    if (status === "uploading") {
      // Incrementar el progreso poco a poco (asintótico hacia 90%)
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          const increment = (90 - prev) * 0.05;
          return prev + (increment > 0.1 ? increment : 0.1);
        });
      }, 500);
      
      // Cambiar el mensaje para dar feedback continuo
      msgInterval = setInterval(() => {
        setStatusMsg((prev) => {
          if (prev.includes("Extrayendo texto")) return "Analizando estructura...";
          if (prev.includes("Analizando estructura")) return "Generando capítulos...";
          if (prev.includes("Generando capítulos")) return "Buscando portadas y metadatos...";
          return "Extrayendo texto del PDF...";
        });
      }, 4000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
      if (msgInterval) clearInterval(msgInterval);
    };
  }, [status]);

  /* ── Drag & Drop ────────────────────────────────────────────────── */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "application/pdf") {
      setFile(droppedFile);
      setError(null);
    } else {
      setError("Solo se aceptan archivos PDF.");
    }
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected?.type === "application/pdf") {
      setFile(selected);
      setError(null);
    } else {
      setError("Solo se aceptan archivos PDF.");
    }
  };

  /* ── Upload flow ────────────────────────────────────────────────── */
  const handleUpload = async () => {
    if (!file || !user) return;
    setError(null);
    setStatus("uploading");
    setProgress(5);
    setStatusMsg("Iniciando procesamiento...");

    try {
      // 1. Enviar al backend con el token Firebase en el header (via lib/api.js)
      const bookData = await extractPdf(file);

      // 2. Guardar en Firestore
      setStatus("saving");
      setProgress(95);
      setStatusMsg("Guardando en la biblioteca...");

      const bookId = await saveBook(bookData, user.uid);

      setProgress(100);
      setSavedBookId(bookId);
      setStatus("done");
    } catch (err) {
      setError(err.message || "Ocurrió un error. Intenta de nuevo.");
      setStatus("error");
    }
  };

  /* ── Reset ──────────────────────────────────────────────────────── */
  const reset = () => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setStatusMsg("");
    setError(null);
    setSavedBookId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ── Render: Success ─────────────────────────────────────────────── */
  if (status === "done" && savedBookId) {
    return (
      <div className="upload-page">
        <div className="upload-success">
          <div className="upload-success-icon">🎉</div>
          <h2 className="upload-success-title">¡Libro añadido a la biblioteca!</h2>
          <p className="upload-success-subtitle">
            El libro fue procesado y ya está disponible para toda la comunidad.
          </p>
          <div className="upload-actions">
            <Link href={`/read/${savedBookId}`} className="btn-primary" id="go-read-btn">
              Leer ahora
            </Link>
            <button className="btn-outline" onClick={reset} id="upload-another-btn">
              Subir otro
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isProcessing = status === "uploading" || status === "saving";

  return (
    <div className="upload-page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div>
          <p className="page-eyebrow">Contribuir</p>
          <h1 className="page-title">Subir libro</h1>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert--error" id="upload-error">
          ⚠️ {error}
        </div>
      )}

      {/* Drop Zone */}
      <div
        id="upload-zone"
        className={`upload-zone ${isDragging ? "upload-zone--dragging" : ""} ${file ? "upload-zone--has-file" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={handleFileChange}
          id="file-input"
        />

        <div className="upload-icon">
          {file ? "📄" : "☁️"}
        </div>

        {file ? (
          <>
            <h2 className="upload-title">Archivo listo</h2>
            <p className="upload-subtitle">Haz clic en «Procesar» para continuar</p>
            <div className="upload-file-info">
              ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          </>
        ) : (
          <>
            <h2 className="upload-title">Arrastra tu PDF aquí</h2>
            <p className="upload-subtitle">o haz clic para seleccionar el archivo</p>
            <button className="btn-outline" style={{ pointerEvents: "none" }}>
              Seleccionar PDF
            </button>
          </>
        )}

        {/* Progress bar */}
        {isProcessing && (
          <>
            <div className="upload-progress-bar" style={{ marginTop: 28 }}>
              <div
                className="upload-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="upload-status-msg">{statusMsg}</p>
          </>
        )}
      </div>

      {/* Actions */}
      {!isProcessing && (
        <div className="upload-actions">
          {file && (
            <>
              <button
                id="process-btn"
                className="btn-primary"
                onClick={handleUpload}
              >
                Procesar y subir
              </button>
              <button
                id="clear-btn"
                className="btn-outline"
                onClick={reset}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      )}

      {/* Info */}
      <p style={{ marginTop: 32, fontSize: "0.82rem", color: "var(--ink-muted)", textAlign: "center" }}>
        Máximo 50 MB · Solo archivos PDF · El libro quedará disponible para toda la comunidad
      </p>
    </div>
  );
}
