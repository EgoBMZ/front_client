"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { getBook, getProgress, saveProgress, cleanBookTitle, saveReaderSettings, getReaderSettings } from "@/lib/firestore";

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

/**
 * Divide texto en oraciones para el resaltado por oración durante narración.
 */
function splitIntoSentences(text) {
  // Divide por puntos, signos de exclamación/interrogación, coma seguida de conjunción, etc.
  const parts = text.match(/[^.!?]+[.!?]*/g) || [text];
  return parts.map(s => s.trim()).filter(s => s.length > 0);
}

function renderElement(elem, globalIndex, activeId, narratorSentenceIdx, isNarrating, onClick) {
  if (!elem) return null;

  const type = (elem.type || "").toLowerCase();
  if (SKIP_TYPES.includes(type)) return null;

  const text = (elem.content || elem.text || "").trim();
  if (!text) return null;

  const id = `doc-el-${globalIndex}`;
  const isActive = activeId === globalIndex;
  const isNarratingThis = isNarrating && activeId === globalIndex;

  // Si está siendo narrado, renderizamos las oraciones individuales con resaltado
  let content;
  if (isNarratingThis && narratorSentenceIdx !== null) {
    const sentences = splitIntoSentences(text);
    content = sentences.map((sentence, idx) => (
      <span
        key={idx}
        className={`narrator-sentence ${idx === narratorSentenceIdx ? "narrator-sentence--active" : ""}`}
      >
        {sentence}{" "}
      </span>
    ));
  } else {
    content = text;
  }

  const cls = `doc-element ${isActive ? "doc-element--active" : ""}`;

  if (HEADING_TYPES.includes(type)) {
    const level = elem.headingLevel || elem["heading level"] || 1;
    if (level === 1) return <h2 key={id} id={id} className={`${cls} elem-heading1`} onClick={onClick}>{content}</h2>;
    if (level === 2) return <h3 key={id} id={id} className={`${cls} elem-heading2`} onClick={onClick}>{content}</h3>;
    return <h4 key={id} id={id} className={`${cls} elem-heading3`} onClick={onClick}>{content}</h4>;
  }
  if (LIST_TYPES.includes(type)) {
    return <p key={id} id={id} className={`${cls} elem-list-item`} onClick={onClick}>{content}</p>;
  }
  return <p key={id} id={id} className={`${cls} elem-paragraph`} onClick={onClick}>{content}</p>;
}

/**
 * Agrupa los elementos en capítulos completos.
 */
function buildChapters(elements) {
  const chapters = [];
  let currentChapter = { id: 0, title: "Inicio", elements: [], startIndex: 0 };

  const explicitChapterRegex = /^(capítulo|capitulo|chapter|sección|seccion|parte|libro)\s+([0-9]+|[ivxlc]+)/i;
  const exactNumberRegex = /^[0-9]+\.?$/;
  const exactRomanRegex = /^(?=[mdclxvi])m*(c[md]|d?c*)(x[cl]|l?x*)(i[xv]|v?i*)\.?$/i;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    let text = (el.content || el.text || "").trim();
    text = text.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();

    let isChapterHeading = false;
    if (text && text.length <= 80) {
      if (explicitChapterRegex.test(text) || exactNumberRegex.test(text) || exactRomanRegex.test(text)) {
        isChapterHeading = true;
      }
    }

    if (isChapterHeading) {
      if (currentChapter.elements.length > 0) chapters.push(currentChapter);
      currentChapter = {
        id: chapters.length, title: text,
        elements: [{ ...el, originalIndex: i }], startIndex: i
      };
    } else {
      currentChapter.elements.push({ ...el, originalIndex: i });
    }
  }
  if (currentChapter.elements.length > 0) chapters.push(currentChapter);
  return chapters;
}

// ─── Las 3 mejores voces en español compatibles con Safari & Chrome ───
// Paulina (México) es la voz por defecto
const PREFERRED_VOICES = [
  { name: "Paulina", lang: "es-MX", label: "Paulina (México)" },
  { name: "Mónica", lang: "es-ES", label: "Mónica (España)" },
  { name: "Jorge", lang: "es-ES", label: "Jorge (España)" },
];

// Velocidades predefinidas
const SPEED_PRESETS = [
  { value: 0.75, label: "0.75×" },
  { value: 1.0,  label: "1×"    },
  { value: 1.25, label: "1.25×" },
  { value: 1.5,  label: "1.5×"  },
  { value: 1.75, label: "1.75×" },
  { value: 2.0,  label: "2×"    },
];

function findPreferredVoice(voices) {
  for (const pref of PREFERRED_VOICES) {
    const found = voices.find(v => v.name.toLowerCase().includes(pref.name.toLowerCase()) && v.lang.startsWith(pref.lang.split("-")[0]));
    if (found) return found;
  }
  // Fallback: cualquier voz en español
  return voices.find(v => v.lang.startsWith("es")) || voices[0];
}

// ─── Hook del narrador TTS ─────────────────────────────────────────────
function useNarrator({ elements, activeElementId, setActiveElementId, activeChapterIndex, setActiveChapterIndex, chapters, user, bookId }) {
  const [isNarrating, setIsNarrating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [rate, setRate] = useState(1.0);
  const [narratorSentenceIdx, setNarratorSentenceIdx] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const utteranceRef = useRef(null);
  const narratingRef = useRef(false);
  const currentElemIdxRef = useRef(0);
  const currentSentenceIdxRef = useRef(0);
  // Refs para leer el valor más reciente dentro de closures sin recrear narrateElement
  const rateRef = useRef(rate);
  const selectedVoiceRef = useRef(selectedVoice);
  const chaptersRef = useRef(chapters);
  // Flag para distinguir cambios de capítulo hechos por el narrador vs. el usuario
  const narratorChangedChapterRef = useRef(false);

  // ID de la sesión de narración para evitar colisiones asíncronas tras cancelar/saltar
  const narrationIdRef = useRef(0);
  const saveTimerRef = useRef(null);

  // Sincronizar refs con el state
  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { selectedVoiceRef.current = selectedVoice; }, [selectedVoice]);
  useEffect(() => { chaptersRef.current = chapters; }, [chapters]);

  // Cuando el rate cambia mientras se está narrando, interrumpir la frase actual
  // y repetirla desde el principio con la nueva velocidad
  const restartCurrentSentenceRef = useRef(null);
  useEffect(() => {
    if (!narratingRef.current) return; // No narrando: no hacer nada
    if (typeof restartCurrentSentenceRef.current === 'function') {
      restartCurrentSentenceRef.current();
    }
  }, [rate]);

  // Cargar voces disponibles
  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
        const preferred = findPreferredVoice(available);
        setSelectedVoice(preferred ? preferred.name : "");
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const stopNarrating = useCallback(() => {
    narratingRef.current = false;
    narrationIdRef.current += 1;
    window.speechSynthesis.cancel();
    setIsNarrating(false);
    setIsPaused(false);
    setNarratorSentenceIdx(null);
  }, []);

  // Navegar a un elemento y hacer scroll. También actualiza el capítulo activo visualmente.
  const goToElement = useCallback((elemIdx) => {
    setActiveElementId(elemIdx);
    // Guardar el progreso directamente ya que el scroll-spy no correrá mientras se narra
    if (user && bookId) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveProgress(user.uid, bookId, elemIdx).catch(() => {});
      }, 1000);
    }
    // Detectar si el elemento pertenece a un capítulo diferente y actualizar
    const chs = chaptersRef.current;
    for (let i = chs.length - 1; i >= 0; i--) {
      if (elemIdx >= chs[i].startIndex) {
        // Marcar que este cambio lo hace el narrador (no el usuario)
        narratorChangedChapterRef.current = true;
        setActiveChapterIndex(i);
        break;
      }
    }
    setTimeout(() => {
      document.getElementById(`doc-el-${elemIdx}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }, [setActiveElementId, setActiveChapterIndex, user, bookId]);

  const narrateElement = useCallback((elemGlobalIdx, sentenceStartIdx = 0, currentId) => {
    if (!narratingRef.current) return;
    if (currentId !== narrationIdRef.current) return;

    const elem = elements[elemGlobalIdx];
    if (!elem) {
      stopNarrating();
      return;
    }

    const type = (elem.type || "").toLowerCase();
    if (SKIP_TYPES.includes(type)) {
      narrateElement(elemGlobalIdx + 1, 0, currentId);
      return;
    }

    const fullText = (elem.content || elem.text || "").trim();
    if (!fullText) {
      narrateElement(elemGlobalIdx + 1, 0, currentId);
      return;
    }

    currentElemIdxRef.current = elemGlobalIdx;
    goToElement(elemGlobalIdx);

    const sentences = splitIntoSentences(fullText);
    let sentenceIdx = sentenceStartIdx;

    const narrateSentence = (fromIdx) => {
      if (!narratingRef.current) return;
      if (currentId !== narrationIdRef.current) return;

      if (fromIdx >= sentences.length) {
        narrateElement(elemGlobalIdx + 1, 0, currentId);
        return;
      }

      sentenceIdx = fromIdx;
      currentSentenceIdxRef.current = sentenceIdx;
      setNarratorSentenceIdx(sentenceIdx);

      const utterance = new SpeechSynthesisUtterance(sentences[sentenceIdx]);
      utterance.lang = "es-MX";
      utterance.rate = rateRef.current;
      utterance.volume = 1.0;

      const allVoices = window.speechSynthesis.getVoices();
      const voice = allVoices.find(v => v.name === selectedVoiceRef.current);
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        if (!narratingRef.current) return;
        if (currentId !== narrationIdRef.current) return;
        restartCurrentSentenceRef.current = null;
        narrateSentence(sentenceIdx + 1);
      };
      utterance.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        if (currentId !== narrationIdRef.current) return;
        restartCurrentSentenceRef.current = null;
        narrateSentence(sentenceIdx + 1);
      };

      utteranceRef.current = utterance;
      // Registrar callback para reiniciar esta frase con nueva velocidad
      restartCurrentSentenceRef.current = () => {
        window.speechSynthesis.cancel();
        // Pequeño delay para que cancel() termine antes de hablar de nuevo
        setTimeout(() => {
          if (narratingRef.current && currentId === narrationIdRef.current) {
            narrateSentence(sentenceIdx);
          }
        }, 80);
      };
      window.speechSynthesis.speak(utterance);
    };

    narrateSentence(sentenceStartIdx);
  }, [elements, goToElement, stopNarrating]);

  const startNarrating = useCallback(() => {
    if (isNarrating) {
      stopNarrating();
      return;
    }
    window.speechSynthesis.cancel();
    narratingRef.current = true;
    setIsNarrating(true);
    setIsPaused(false);
    narrationIdRef.current += 1;
    // Comenzar desde el elemento activo actual
    narrateElement(activeElementId, 0, narrationIdRef.current);
  }, [isNarrating, activeElementId, narrateElement, stopNarrating]);

  // Pausa / Reanuda
  const pauseResume = useCallback(() => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, []);

  const jumpToElement = useCallback((elemIdx) => {
    if (!narratingRef.current) {
      goToElement(elemIdx);
      return;
    }
    window.speechSynthesis.cancel();
    narrationIdRef.current += 1;
    const newId = narrationIdRef.current;
    setIsPaused(false);
    setTimeout(() => {
      if (narratingRef.current && newId === narrationIdRef.current) {
        narrateElement(elemIdx, 0, newId);
      }
    }, 100);
  }, [goToElement, narrateElement]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      narratingRef.current = false;
      window.speechSynthesis.cancel();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Cuando cambia el capítulo, detener narr. SOLO si lo cambió el usuario (no el narrador)
  useEffect(() => {
    if (narratorChangedChapterRef.current) {
      // El narrador lo cambió: no detener, resetear el flag
      narratorChangedChapterRef.current = false;
      return;
    }
    // El usuario lo cambió manualmente: detener narr.
    if (isNarrating) stopNarrating();
  }, [activeChapterIndex]); // eslint-disable-line

  // Filtrar las 3 voces preferidas que estén disponibles
  const availablePreferred = PREFERRED_VOICES.map(pref => {
    const match = voices.find(v =>
      v.name.toLowerCase().includes(pref.name.toLowerCase()) &&
      v.lang.startsWith(pref.lang.split("-")[0])
    );
    return match ? { ...pref, voiceName: match.name, available: true } : { ...pref, available: false };
  }).filter(v => v.available);

  // Si no hay ninguna de las preferidas, tomar las primeras 3 en español
  const voiceOptions = availablePreferred.length > 0
    ? availablePreferred
    : voices.filter(v => v.lang.startsWith("es")).slice(0, 3).map(v => ({
        name: v.name, label: v.name, voiceName: v.name, available: true
      }));

  return {
    isNarrating, isPaused, voices: voiceOptions, selectedVoice, setSelectedVoice,
    rate, setRate,
    narratorSentenceIdx, showSettings, setShowSettings,
    startNarrating, pauseResume, stopNarrating, jumpToElement,
  };
}

// ─── Panel de control del narrador ────────────────────────────────────
function NarratorBar({ narrator, bookTitle, chapterTitle, bookProgressPct, chapterProgressPct, remainingTimeStr }) {
  const {
    isNarrating, isPaused, voices, selectedVoice, setSelectedVoice,
    rate, setRate,
    showSettings, setShowSettings,
    startNarrating, pauseResume, stopNarrating,
  } = narrator;

  const handlePlayPause = () => {
    if (!isNarrating) {
      startNarrating();
    } else {
      stopNarrating();
    }
  };

  return (
    <div className={`narrator-bar ${isNarrating ? "narrator-bar--active" : ""}`}>
      {/* Columna Izquierda: Información del libro */}
      <div className="narrator-info-col">
        <div className="narrator-info-title" title={bookTitle}>{bookTitle}</div>
        <div className="narrator-info-chapter" title={chapterTitle}>{chapterTitle}</div>
      </div>

      {/* Columna Central: Controles principales */}
      <div className="narrator-controls-col">
        <button
          className={`narrator-btn narrator-btn--play ${isNarrating ? "narrator-btn--playing" : ""}`}
          onClick={handlePlayPause}
          title={isNarrating ? "Pausar narración" : "Narrar desde aquí"}
          id="narrator-play-btn"
        >
          {!isNarrating ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          )}
        </button>

        <button
          className={`narrator-btn narrator-btn--settings ${showSettings ? "narrator-btn--settings-open" : ""}`}
          onClick={() => setShowSettings(s => !s)}
          title="Configurar narrador"
          id="narrator-settings-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
          </svg>
        </button>
      </div>

      {/* Columna Derecha: Estadísticas de progreso */}
      <div className="narrator-stats-col">
        <div className="narrator-stat-badge" title="Progreso del capítulo">
          <span className="narrator-stat-icon">📖</span>
          <span className="narrator-stat-label">Cap:</span>
          <span className="narrator-stat-value">{chapterProgressPct}%</span>
        </div>
        <div className="narrator-stat-badge" title="Progreso total del libro">
          <span className="narrator-stat-icon">📚</span>
          <span className="narrator-stat-label">Libro:</span>
          <span className="narrator-stat-value">{bookProgressPct}%</span>
        </div>
        <div className="narrator-stat-badge" title="Tiempo restante para finalizar el capítulo">
          <span className="narrator-stat-icon">⏱️</span>
          <span className="narrator-stat-label">Faltan:</span>
          <span className="narrator-stat-value">{remainingTimeStr}</span>
        </div>
      </div>

      {/* Panel de configuración */}
      {showSettings && (
        <div className="narrator-settings" id="narrator-settings-panel">
          {/* Voz */}
          <div className="narrator-setting-row">
            <label className="narrator-setting-label">Voz</label>
            <div className="narrator-voices">
              {voices.length === 0 && (
                <p className="narrator-no-voices">Cargando voces...</p>
              )}
              {voices.map((v) => (
                <button
                  key={v.voiceName}
                  className={`narrator-voice-btn ${selectedVoice === v.voiceName ? "narrator-voice-btn--active" : ""}`}
                  onClick={() => setSelectedVoice(v.voiceName)}
                  id={`voice-btn-${v.name}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Velocidad */}
          <div className="narrator-setting-row">
            <label className="narrator-setting-label">Velocidad</label>
            <div className="narrator-speed-presets">
              {SPEED_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  className={`narrator-speed-btn ${rate === preset.value ? "narrator-speed-btn--active" : ""}`}
                  onClick={() => setRate(preset.value)}
                  id={`speed-btn-${String(preset.value).replace(".", "_")}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
  const [showSyncBtn, setShowSyncBtn] = useState(false);

  const saveTimerRef = useRef(null);

  // ── Narrador ──────────────────────────────────────────────────────
  const narrator = useNarrator({
    elements, activeElementId, setActiveElementId,
    activeChapterIndex, setActiveChapterIndex, chapters, user, bookId,
  });

  // ── Sidebar Toggle State ──────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("reader-sidebar-collapsed") === "true";
    }
    return false;
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("reader-sidebar-collapsed", String(next));
      return next;
    });
  };

  // ── UI Settings State ──────────────────────────────────────────────
  const [showUISettings, setShowUISettings] = useState(false);
  const [uiSettings, setUiSettings] = useState({
    fontSize: 18,
    fontFamily: "'Lora', Georgia, serif",
    theme: "day",
    customBg: "#FAF7F2",
    customText: "#1A1510",
  });

  // ── Isolated reader theme: --rd-* CSS vars, completely independent from global data-theme ──
  const READER_THEMES = {
    day:   { bg: '#FAFAF8', ink: '#1C1C1E', inkMuted: '#636366', border: 'rgba(0,0,0,0.08)' },
    night: { bg: '#141414', ink: '#E8E8E8', inkMuted: '#9A9A9A', border: 'rgba(255,255,255,0.08)' },
    sepia: { bg: '#F6F0E4', ink: '#3B2F1E', inkMuted: '#7A6348', border: 'rgba(59,47,30,0.1)' },
    forest:{ bg: '#1A2420', ink: '#C8D8C0', inkMuted: '#8FA887', border: 'rgba(200,216,192,0.1)' },
    custom:{ bg: uiSettings.customBg, ink: uiSettings.customText, inkMuted: uiSettings.customText, border: 'rgba(128,128,128,0.15)' },
  };
  const activeTheme = READER_THEMES[uiSettings.theme] || READER_THEMES.day;

  // CSS vars injected on the chapter-container: fully isolated from global theme
  const readerCSSVars = {
    '--rd-bg':       activeTheme.bg,
    '--rd-ink':      activeTheme.ink,
    '--rd-ink-muted':activeTheme.inkMuted,
    '--rd-border':   activeTheme.border,
    '--rd-font':     uiSettings.fontFamily,
    'fontSize':      `${uiSettings.fontSize}px`,
    'fontFamily':    uiSettings.fontFamily,
    'background':    activeTheme.bg,
    'color':         activeTheme.ink,
  };

  useEffect(() => {
    if (user) {
      getReaderSettings(user.uid).then((saved) => {
        if (saved) setUiSettings(prev => ({ ...prev, ...saved }));
      }).catch(console.error);
    }
  }, [user]);

  const updateUISetting = (key, val) => {
    const newSettings = { ...uiSettings, [key]: val };
    setUiSettings(newSettings);
    if (user) {
      saveReaderSettings(user.uid, newSettings).catch(console.error);
    }
  };



  // ── Spacebar play/pause shortcut ──────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space") {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) {
          return;
        }
        e.preventDefault();
        if (!narrator.isNarrating) {
          narrator.startNarrating();
        } else {
          narrator.pauseResume();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [narrator]);

  // ── Synchronize Active Chapter with Active Element ──────────────────
  useEffect(() => {
    if (chapters.length === 0) return;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (activeElementId >= chapters[i].startIndex) {
        if (activeChapterIndex !== i) {
          setActiveChapterIndex(i);
        }
        break;
      }
    }
  }, [activeElementId, chapters, activeChapterIndex]);

  // ── Cargar libro y progreso ──────────────────────────────────────
  useEffect(() => {
    if (!bookId || !user) return;

    (async () => {
      try {
        const [bookData, progress] = await Promise.all([
          getBook(bookId),
          getProgress(user.uid, bookId),
        ]);

        if (!bookData) { setError("Libro no encontrado."); return; }

        bookData.title = cleanBookTitle(bookData.title);
        setBook(bookData);

        const elems = bookData.elements || [];
        setElements(elems);

        const generatedChapters = buildChapters(elems);
        setChapters(generatedChapters);

        if (progress?.currentElementId && progress.currentElementId < elems.length) {
          const targetId = progress.currentElementId;
          setActiveElementId(targetId);

          const targetChapterIdx = generatedChapters.findIndex((ch, idx) => {
            const nextCh = generatedChapters[idx + 1];
            if (nextCh) return targetId >= ch.startIndex && targetId < nextCh.startIndex;
            return targetId >= ch.startIndex;
          });
          if (targetChapterIdx !== -1) setActiveChapterIndex(targetChapterIdx);

          setTimeout(() => {
            document.getElementById(`doc-el-${targetId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 400);
        }
      } catch (err) {
        setError("Error cargando el libro.");
      } finally {
        setLoading(false);
      }
    })();

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [bookId, user]);

  // ── Seguimiento de scroll (Guardado automático) ───────────────────
  const handleScroll = useCallback(() => {
    if (narrator.isNarrating) {
      const activeEl = document.getElementById(`doc-el-${activeElementId}`);
      if (activeEl) {
        const rect = activeEl.getBoundingClientRect();
        const isOut = rect.bottom < 80 || rect.top > (window.innerHeight - 80);
        setShowSyncBtn(isOut);
      }
      return;
    }
    
    // Normal scroll tracking when not narrating
    setShowSyncBtn(false);

    const els = document.querySelectorAll(".doc-element");
    let closest = null;
    let closestDist = Infinity;

    els.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const dist = Math.abs(rect.top - window.innerHeight * 0.35);
      if (dist < closestDist) {
        closestDist = dist;
        closest = parseInt(el.id.replace("doc-el-", ""), 10);
      }
    });

    if (closest !== null) {
      setActiveElementId(closest);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (user && bookId) saveProgress(user.uid, bookId, closest).catch(() => {});
      }, 2000);
    }
  }, [user, bookId, narrator.isNarrating, activeElementId]);

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
      if (user && bookId) saveProgress(user.uid, bookId, newChapter.startIndex).catch(() => {});
    }
  };



  // ── Color de portada ──────────────────────────────────────────────
  const coverColors = [
    ["#E8563A", "#F4A261"], ["#2D6A4F", "#74C69D"], ["#264653", "#2A9D8F"],
    ["#7B2D8B", "#C77DFF"], ["#C77B30", "#E9C46A"],
  ];
  const colorIndex = bookId ? bookId.charCodeAt(0) % coverColors.length : 0;
  const [coverFrom, coverTo] = coverColors[colorIndex];

  const currentChapter = chapters[activeChapterIndex] || { elements: [] };

  // ── Estadísticas de Lectura (Por Palabras y Frases) ────────────────
  const { chapterTotalWords, chapterWordsRead, chapterWordsRemaining, currentElementFraction } = useMemo(() => {
    let totalWords = 0;
    let wordsRead = 0;
    let currentFraction = 0;

    if (!currentChapter || !currentChapter.elements || currentChapter.elements.length === 0) {
      return { chapterTotalWords: 0, chapterWordsRead: 0, chapterWordsRemaining: 0, currentElementFraction: 0 };
    }

    currentChapter.elements.forEach((el) => {
      const text = (el.content || el.text || "").trim();
      if (!text) return;

      const isPastElement = el.originalIndex < activeElementId;
      const isCurrentElement = el.originalIndex === activeElementId;

      if (isPastElement) {
        const words = text.split(/\s+/).filter(w => w.length > 0).length;
        totalWords += words;
        wordsRead += words;
      } else if (isCurrentElement) {
        const sentences = splitIntoSentences(text);
        const sentenceIdx = narrator.isNarrating && narrator.narratorSentenceIdx !== null 
          ? Math.min(narrator.narratorSentenceIdx, Math.max(0, sentences.length - 1))
          : 0;

        let wordsInElement = 0;
        let wordsReadInElement = 0;

        sentences.forEach((sentence, idx) => {
          const words = sentence.split(/\s+/).filter(w => w.length > 0).length;
          wordsInElement += words;
          if (idx < sentenceIdx) {
            wordsReadInElement += words;
          }
        });
        
        if (wordsInElement > 0) {
          currentFraction = wordsReadInElement / wordsInElement;
        }

        totalWords += wordsInElement;
        wordsRead += wordsReadInElement;
      } else {
        const words = text.split(/\s+/).filter(w => w.length > 0).length;
        totalWords += words;
      }
    });

    const wordsRemaining = Math.max(0, totalWords - wordsRead);
    return { chapterTotalWords: totalWords, chapterWordsRead: wordsRead, chapterWordsRemaining: wordsRemaining, currentElementFraction: currentFraction };
  }, [currentChapter, activeElementId, narrator.isNarrating, narrator.narratorSentenceIdx]);

  if (loading) {
    return (<div className="page-loader"><div className="loader-spinner" /></div>);
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

  // 1. Progreso del capítulo
  const chapterProgressPct = chapterTotalWords > 0 
    ? Math.min(100, Math.floor((chapterWordsRead / chapterTotalWords) * 100))
    : 0;

  // 2. Progreso total del libro
  const progressPct = elements.length > 1
    ? Math.min(100, Math.floor(((activeElementId + currentElementFraction) / (elements.length - 1)) * 100))
    : (elements.length === 1 ? 100 : 0);

  // 3. Tiempo restante formateado
  const getRemainingTimeStr = () => {
    if (chapterWordsRemaining === 0) return "0 min";
    
    // Velocidad promedio de lectura TTS (130 palabras por minuto)
    const speedMultiplier = narrator.rate || 1.0;
    const wordsPerMinute = 130 * speedMultiplier;
    const totalMinutes = chapterWordsRemaining / wordsPerMinute;
    
    if (totalMinutes < 1) {
      const seconds = Math.max(0, Math.round(totalMinutes * 60));
      return `${seconds} s`;
    }
    const mins = Math.round(totalMinutes);
    return `${mins} min`;
  };
  const remainingTimeStr = getRemainingTimeStr();

  return (
    <div 
      className={`reader-layout ${sidebarCollapsed ? "reader-layout--sidebar-collapsed" : ""}`}
    >
      {/* Botón de control de Sidebar */}
      <button
        className="sidebar-toggle-btn"
        onClick={toggleSidebar}
        title={sidebarCollapsed ? "Mostrar menú lateral" : "Ocultar menú lateral"}
        aria-label="Toggle Sidebar"
      >
        {sidebarCollapsed ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 3v18"/>
            <path d="M14 9l3 3-3 3"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 3v18"/>
            <path d="M15 15l-3-3 3-3"/>
          </svg>
        )}
      </button>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="reader-sidebar">
        <div className="sidebar-book-info">
          <div
            className="sidebar-book-cover"
            style={{
              background: book.coverUrl ? "#fff" : `linear-gradient(145deg, ${coverFrom}, ${coverTo})`,
              backgroundImage: book.coverUrl ? `url(${book.coverUrl})` : "none",
              backgroundSize: "cover", backgroundPosition: "center",
            }}
          >
            {!book.coverUrl && (book.title?.charAt(0).toUpperCase() || "L")}
          </div>
          <h2 className="sidebar-book-title">{book.title}</h2>
          {book.author && <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "var(--ink-muted)" }}>{book.author}</p>}
        </div>



        {/* Índice interactivo */}
        {chapters.length > 0 && (
          <>
            <p className="sidebar-section-label">Contenido</p>
            <ul className="toc-list">
              {chapters.map((chapter, idx) => (
                <li key={chapter.id} className="toc-item">
                  <button
                    className={`toc-link ${activeChapterIndex === idx ? "toc-link--active" : ""}`}
                    onClick={() => handleChapterChange(idx)}
                    style={{ background: "none", border: "none", textAlign: "left", width: "100%", cursor: "pointer" }}
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
            <div className="reader-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <Link href="/library" style={{ display: "block", marginTop: 16, fontSize: "0.8rem", color: "var(--ink-muted)", textAlign: "center" }}>
            ← Biblioteca
          </Link>
        </div>
      </aside>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="reader-content-container" style={{ background: activeTheme.bg }}>
        <article className="reader-content" style={{ background: activeTheme.bg }}>
          <div className="reader-book-header">
            <h1 className="reader-book-title">{book.title}</h1>
            <p className="reader-book-meta">{currentChapter.title} · {progressPct}% leído</p>
          </div>

          {/* chapter-container carries all --rd-* vars and the font size in px so em units cascade correctly */}
          <div className="chapter-container" style={{ minHeight: "60vh", ...readerCSSVars }}>
            {currentChapter.elements.map((elem) =>
              renderElement(
                elem,
                elem.originalIndex,
                activeElementId,
                narrator.narratorSentenceIdx,
                narrator.isNarrating,
                () => narrator.jumpToElement(elem.originalIndex)
              )
            )}
          </div>

          {chapters.length > 1 && (
            <div className="chapter-navigation">
              <button className="btn-outline" disabled={activeChapterIndex === 0} onClick={() => handleChapterChange(activeChapterIndex - 1)}>
                ← Capítulo Anterior
              </button>
              <span className="chapter-indicator">{activeChapterIndex + 1} de {chapters.length}</span>
              <button className="btn-outline" disabled={activeChapterIndex === chapters.length - 1} onClick={() => handleChapterChange(activeChapterIndex + 1)}>
                Siguiente Capítulo →
              </button>
            </div>
          )}
        </article>
      </div>

      {/* Botón flotante para Sincronizar Narrador si el usuario scrolleó lejos */}
      {showSyncBtn && narrator.isNarrating && (
        <button 
          className="narrator-sync-btn" 
          onClick={() => {
            const activeEl = document.getElementById(`doc-el-${activeElementId}`);
            if (activeEl) {
              activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            setShowSyncBtn(false);
          }}
          title="Volver a la posición del narrador"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
          Sincronizar
        </button>
      )}

      {/* Reproductor flotante del narrador */}
      <NarratorBar
        narrator={narrator}
        bookTitle={book.title}
        chapterTitle={currentChapter.title}
        bookProgressPct={progressPct}
        chapterProgressPct={chapterProgressPct}
        remainingTimeStr={remainingTimeStr}
      />

      {/* Botón flotante para Settings de UI */}
      <button 
        className="reader-settings-trigger" 
        onClick={() => setShowUISettings(s => !s)}
        title="Apariencia"
        style={showUISettings ? { borderColor: 'var(--coral)', color: 'var(--coral)' } : {}}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      {/* Drawer de Configuración UI (se desliza desde la derecha, no bloquea la lectura) */}
      {showUISettings && (
        <div className="reader-settings-drawer">
          <div className="settings-header">
            <h3>Apariencia</h3>
            <button className="settings-close-btn" onClick={() => setShowUISettings(false)} title="Cerrar">
              ×
            </button>
          </div>

          {/* Tamaño de letra */}
          <div className="settings-section">
            <div className="settings-section-title">Tamaño de letra</div>
            <div className="settings-slider-wrap">
              <span>A</span>
              <input 
                type="range" min="14" max="32" step="2" 
                value={uiSettings.fontSize} 
                onChange={(e) => updateUISetting('fontSize', parseInt(e.target.value))} 
              />
              <span>A</span>
            </div>
            <div className="settings-font-size-display">{uiSettings.fontSize}px</div>
          </div>

          {/* Tipografía */}
          <div className="settings-section">
            <div className="settings-section-title">Tipografía</div>
            <div className="settings-row">
              {[
                { label: 'Lora',         value: "'Lora', Georgia, serif" },
                { label: 'Serif',        value: "'Playfair Display', Georgia, serif" },
                { label: 'Garamond',     value: "'EB Garamond', Georgia, serif" },
                { label: 'Merriweather', value: "'Merriweather', Georgia, serif" },
                { label: 'Source Serif', value: "'Source Serif 4', Georgia, serif" },
                { label: 'Sans',         value: "'Inter', system-ui, sans-serif" },
              ].map(f => (
                <button 
                  key={f.value}
                  className={`settings-opt-btn ${uiSettings.fontFamily === f.value ? 'settings-opt-btn--active' : ''}`}
                  onClick={() => updateUISetting('fontFamily', f.value)}
                  style={{ fontFamily: f.value }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tema */}
          <div className="settings-section">
            <div className="settings-section-title">Tema de color</div>
            <div className="settings-theme-circles">
              {[
                { key: 'day',    label: '☀️ Día',   bg: '#FAFAF8', ink: '#333' },
                { key: 'night',  label: '🌙 Noche',  bg: '#141414', ink: '#E8E8E8' },
                { key: 'sepia',  label: '📜 Sepia',  bg: '#F6F0E4', ink: '#3B2F1E' },
                { key: 'forest', label: '🌲 Bosque', bg: '#1A2420', ink: '#C8D8C0' },
                { key: 'custom', label: '🎨 Libre',  bg: 'conic-gradient(from 0deg, #FF9A9E, #FECFEF, #A8EDEA, #fed6e3, #FF9A9E)', ink: null },
              ].map(t => (
                <div key={t.key} className="settings-theme-option">
                  <button
                    className={`settings-theme-btn ${uiSettings.theme === t.key ? 'settings-theme-btn--active' : ''}`}
                    style={{ background: t.bg }}
                    onClick={() => updateUISetting('theme', t.key)}
                  />
                  <span className="settings-theme-label">{t.label}</span>
                </div>
              ))}
            </div>

            {uiSettings.theme === 'custom' && (
              <div className="settings-custom-colors">
                <div className="color-picker-wrap">
                  <label>Fondo</label>
                  <input 
                    type="color" className="color-picker-input" 
                    value={uiSettings.customBg} 
                    onChange={(e) => updateUISetting('customBg', e.target.value)} 
                  />
                </div>
                <div className="color-picker-wrap">
                  <label>Texto</label>
                  <input 
                    type="color" className="color-picker-input" 
                    value={uiSettings.customText} 
                    onChange={(e) => updateUISetting('customText', e.target.value)} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
