"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { getBook, getProgress, saveProgress, cleanBookTitle } from "@/lib/firestore";

export default function ReaderPage() {
  return (
    <ProtectedRoute>
      <ReaderContent />
    </ProtectedRoute>
  );
}

// Tipos de elemento reales de OpenDataLoader
const HEADING_TYPES = ["heading", "title", "chapter_title", "section_header", "header"];
const LIST_TYPES = ["list_item", "list", "list-item"];
const SKIP_TYPES = ["image", "table", "figure"];

function renderElement(elem, globalIndex, activeId) {
  if (!elem) return null;

  const type = (elem.type || "").toLowerCase();

  // Saltar imágenes y tablas en el reader de texto simple
  if (SKIP_TYPES.includes(type)) return null;

  const text = (elem.content || elem.text || "").trim();
  if (!text) return null;

  const id = `doc-el-${globalIndex}`;
  const isActive = activeId === globalIndex;
  const cls = `doc-element ${isActive ? "doc-element--active" : ""}`;

  if (HEADING_TYPES.includes(type)) {
    const level = elem.headingLevel || elem["heading level"] || 1;
    if (level === 1) return <h2 key={id} id={id} className={`${cls} elem-heading1`}>{text}</h2>;
    if (level === 2) return <h3 key={id} id={id} className={`${cls} elem-heading2`}>{text}</h3>;
    return <h4 key={id} id={id} className={`${cls} elem-heading3`}>{text}</h4>;
  }

  if (LIST_TYPES.includes(type)) {
    return <p key={id} id={id} className={`${cls} elem-list-item`}>{text}</p>;
  }

  // Párrafo por defecto
  return <p key={id} id={id} className={`${cls} elem-paragraph`}>{text}</p>;
}

/**
 * Agrupa los elementos en capítulos completos usando reglas extremadamente estrictas.
 */
function buildChapters(elements) {
  const chapters = [];
  let currentChapter = {
    id: 0,
    title: "Inicio",
    elements: [],
    startIndex: 0
  };

  const explicitChapterRegex = /^(capítulo|capitulo|chapter|sección|seccion|parte|libro)\s+([0-9]+|[ivxlc]+)/i;
  const exactNumberRegex = /^[0-9]+\.?$/;
  const exactRomanRegex = /^(?=[mdclxvi])m*(c[md]|d?c*)(x[cl]|l?x*)(i[xv]|v?i*)\.?$/i;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    let text = (el.content || el.text || "").trim();
    text = text.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();

    let isChapterHeading = false;
    
    // Ignorar textos muy largos que obviamente no son un título
    if (text && text.length <= 80) {
      if (explicitChapterRegex.test(text) || exactNumberRegex.test(text) || exactRomanRegex.test(text)) {
        isChapterHeading = true;
      }
    }

    if (isChapterHeading) {
      // Si el capítulo actual tiene contenido, lo guardamos y empezamos uno nuevo
      if (currentChapter.elements.length > 0) {
        chapters.push(currentChapter);
      }
      
      currentChapter = {
        id: chapters.length,
        title: text,
        elements: [{ ...el, originalIndex: i }],
        startIndex: i
      };
    } else {
      currentChapter.elements.push({ ...el, originalIndex: i });
    }
  }

  // Guardar el último capítulo
  if (currentChapter.elements.length > 0) {
    chapters.push(currentChapter);
  }

  return chapters;
}


function ReaderContent() {
  const { bookId } = useParams();
  const { user } = useAuth();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [elements, setElements] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [activeElementId, setActiveElementId] = useState(0);

  const saveTimerRef = useRef(null);

  // ── Cargar libro y progreso ──────────────────────────────────────
  useEffect(() => {
    if (!bookId || !user) return;

    (async () => {
      try {
        const [bookData, progress] = await Promise.all([
          getBook(bookId),
          getProgress(user.uid, bookId),
        ]);

        if (!bookData) {
          setError("Libro no encontrado.");
          return;
        }

        bookData.title = cleanBookTitle(bookData.title);
        setBook(bookData);

        const elems = bookData.elements || [];
        setElements(elems);

        const generatedChapters = buildChapters(elems);
        setChapters(generatedChapters);

        // Reanudar progreso (hacer scroll al elemento específico)
        if (progress?.currentElementId && progress.currentElementId < elems.length) {
          const targetId = progress.currentElementId;
          setActiveElementId(targetId);
          
          // Buscar a qué capítulo pertenece este elemento
          const targetChapterIdx = generatedChapters.findIndex((ch, idx) => {
            const nextCh = generatedChapters[idx + 1];
            if (nextCh) {
              return targetId >= ch.startIndex && targetId < nextCh.startIndex;
            }
            return targetId >= ch.startIndex;
          });

          if (targetChapterIdx !== -1) {
            setActiveChapterIndex(targetChapterIdx);
          }

          // Esperar renderizado y hacer scroll automático
          setTimeout(() => {
            document
              .getElementById(`doc-el-${targetId}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 400);
        }
      } catch (err) {
        setError("Error cargando el libro.");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [bookId, user]);

  // ── Seguimiento de scroll (Guardado automático) ───────────────────
  const handleScroll = useCallback(() => {
    const els = document.querySelectorAll(".doc-element");
    let closest = null;
    let closestDist = Infinity;

    els.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const dist = Math.abs(rect.top - window.innerHeight * 0.35);
      if (dist < closestDist) {
        closestDist = dist;
        const idAttr = el.id; // "doc-el-N"
        closest = parseInt(idAttr.replace("doc-el-", ""), 10);
      }
    });

    if (closest !== null) {
      setActiveElementId(closest);

      // Guardar el elemento exacto que se está leyendo
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (user && bookId) {
          saveProgress(user.uid, bookId, closest).catch(() => {});
        }
      }, 2000);
    }
  }, [user, bookId]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // ── Cambio de Capítulo manual ──────────────────────────────────────
  const handleChapterChange = (newIndex) => {
    if (newIndex < 0 || newIndex >= chapters.length) return;
    
    setActiveChapterIndex(newIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
    
    const newChapter = chapters[newIndex];
    if (newChapter) {
      setActiveElementId(newChapter.startIndex);
      if (user && bookId) {
        saveProgress(user.uid, bookId, newChapter.startIndex).catch(() => {});
      }
    }
  };

  // ── Cálculo de progreso exacto ─────────────────────────────────────
  const progressPct = elements.length > 1
    ? Math.min(100, Math.round((activeElementId / (elements.length - 1)) * 100))
    : (elements.length === 1 ? 100 : 0);

  // ── Color de portada ──────────────────────────────────────────────
  const coverColors = [
    ["#E8563A", "#F4A261"],
    ["#2D6A4F", "#74C69D"],
    ["#264653", "#2A9D8F"],
    ["#7B2D8B", "#C77DFF"],
    ["#C77B30", "#E9C46A"],
  ];
  const colorIndex = bookId ? bookId.charCodeAt(0) % coverColors.length : 0;
  const [coverFrom, coverTo] = coverColors[colorIndex];

  // ── Renders ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="reader-content" style={{ paddingTop: 80, textAlign: "center" }}>
        <p style={{ color: "var(--coral)", marginBottom: 24 }}>{error}</p>
        <Link href="/library" className="btn-outline">← Volver a la biblioteca</Link>
      </div>
    );
  }

  if (!book || chapters.length === 0) {
    return (
      <div className="reader-content" style={{ paddingTop: 80, textAlign: "center" }}>
        <p className="reader-empty">Este libro no tiene texto procesable.</p>
        <Link href="/library" className="btn-outline">← Volver a la biblioteca</Link>
      </div>
    );
  }

  const currentChapter = chapters[activeChapterIndex] || { elements: [] };

  return (
    <div className="reader-layout">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="reader-sidebar">
        <div className="sidebar-book-info">
          <div
            className="sidebar-book-cover"
            style={{
              background: book.coverUrl ? "#fff" : `linear-gradient(145deg, ${coverFrom}, ${coverTo})`,
              backgroundImage: book.coverUrl ? `url(${book.coverUrl})` : "none",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {!book.coverUrl && (book.title?.charAt(0).toUpperCase() || "L")}
          </div>
          <h2 className="sidebar-book-title">{book.title}</h2>
          {book.author && <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "var(--ink-muted)" }}>{book.author}</p>}
        </div>

        {/* Índice interactivo (ahora son capítulos reales) */}
        {chapters.length > 0 && (
          <>
            <p className="sidebar-section-label">Contenido</p>
            <ul className="toc-list">
              {chapters.map((chapter, idx) => (
                <li key={chapter.id} className="toc-item">
                  <button
                    className={`toc-link ${activeChapterIndex === idx ? "toc-link--active" : ""}`}
                    onClick={() => handleChapterChange(idx)}
                    style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
                  >
                    {chapter.title.length > 48 ? chapter.title.slice(0, 48) + "…" : chapter.title}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Progress Sidebar */}
        <div className="reader-progress-wrapper" style={{ marginTop: 24 }}>
          <div className="reader-progress-label">
            <span>Progreso</span>
            <span>{progressPct}%</span>
          </div>
          <div className="reader-progress-bar">
            <div
              className="reader-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <Link
            href="/library"
            style={{ display: "block", marginTop: 16, fontSize: "0.8rem", color: "var(--ink-muted)", textAlign: "center" }}
          >
            ← Biblioteca
          </Link>
        </div>
      </aside>

      {/* ── Content ─────────────────────────────────────────────── */}
      <article className="reader-content">
        <div className="reader-book-header">
          <h1 className="reader-book-title">{book.title}</h1>
          <p className="reader-book-meta">
            {currentChapter.title} · {progressPct}% leído
          </p>
        </div>

        <div className="chapter-container" style={{ minHeight: '60vh' }}>
          {currentChapter.elements.map((elem) => renderElement(elem, elem.originalIndex, activeElementId))}
        </div>

        {/* ── Navegación de Capítulos ──────────────────────────────────── */}
        {chapters.length > 1 && (
          <div className="chapter-navigation">
            <button
              className="btn-outline"
              disabled={activeChapterIndex === 0}
              onClick={() => handleChapterChange(activeChapterIndex - 1)}
            >
              ← Capítulo Anterior
            </button>
            
            <span className="chapter-indicator">
              {activeChapterIndex + 1} de {chapters.length}
            </span>
            
            <button
              className="btn-outline"
              disabled={activeChapterIndex === chapters.length - 1}
              onClick={() => handleChapterChange(activeChapterIndex + 1)}
            >
              Siguiente Capítulo →
            </button>
          </div>
        )}
      </article>
    </div>
  );
}
