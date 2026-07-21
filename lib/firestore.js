import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── BOOKS ────────────────────────────────────────────────────────────────────

/**
 * Aplana la estructura anidada de kids de OpenDataLoader en una lista plana de elementos.
 * Cada elemento del JSON puede tener sus propios `kids` (ej: paragraph > sentences).
 * Para el reader necesitamos una lista plana ordenada.
 *
 * Estructura real de OpenDataLoader:
 * {
 *   type: "paragraph" | "heading" | "footer" | "image" | ...
 *   content: "texto aquí"   ← campo de texto es 'content'
 *   "heading level": 1
 *   kids: [{ type: "...", content: "..." }]   ← hijos anidados
 * }
 */
function flattenElements(kids, depth = 0) {
  const result = [];
  if (!Array.isArray(kids)) return result;

  const SKIP_TYPES = ["image", "footer", "header"];

  for (const elem of kids) {
    const type = (elem.type || "").toLowerCase();

    // Imágenes, footers y headers los saltamos
    if (SKIP_TYPES.includes(type)) continue;

    const text = (elem.content || elem.text || "").trim();
    const headingLevel = elem["heading level"] || elem.headingLevel || elem.depth || null;

    // Si el elemento tiene texto propio, lo agregamos
    if (text) {
      result.push({
        type,
        content: text,
        headingLevel,
        pageNumber: elem["page number"] || elem.pageNumber || null,
      });
    }

    // Si tiene hijos, los procesamos recursivamente (hasta 2 niveles)
    if (Array.isArray(elem.kids) && elem.kids.length > 0 && depth < 3) {
      const childElems = flattenElements(elem.kids, depth + 1);
      result.push(...childElems);
    }
  }

  return result;
}

export function cleanBookTitle(rawTitle) {
  let title = rawTitle || "Sin título";
  // Remove unwanted prefixes like "Microsoft Word - "
  title = title.replace(/^Microsoft Word\s*-\s*/i, "");
  // Remove .pdf extension if it exists
  title = title.replace(/\.pdf$/i, "");
  // Replace underscores with spaces
  title = title.replace(/_/g, " ");
  // Separate PascalCase words (e.g., LaPanzaDelTepozteco -> La Panza Del Tepozteco)
  title = title.replace(/([a-z])([A-Z])/g, "$1 $2");
  return title.trim() || "Sin título";
}

async function fetchBookCover(title) {
  try {
    const q = encodeURIComponent(title);
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${q}`);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const volumeInfo = data.items[0].volumeInfo;
      // Get highest quality available
      const imageLinks = volumeInfo.imageLinks;
      if (imageLinks) {
        const cover = imageLinks.thumbnail || imageLinks.smallThumbnail;
        if (cover) return cover.replace("http:", "https:");
      }
    }
  } catch (error) {
    console.error("Error fetching book cover:", error);
  }
  return null;
}

/**
 * Guarda un libro procesado en la colección global `books/`.
 *
 * Estructura real del backend (OpenDataLoader):
 * {
 *   success: true,
 *   task_id: "...",
 *   document: {
 *     title: "Nombre del libro",      ← en la raíz del document dict
 *     author: "...",
 *     "number of pages": 276,
 *     kids: [ ... ]                   ← elementos (algunos anidados)
 *   }
 * }
 *
 * @param {object} backendResult - Respuesta completa del backend /api/extract
 * @param {string} uploadedByUid - UID del usuario que subió el libro.
 * @returns {string} - ID del documento creado en Firestore.
 */
export async function saveBook(backendResult, uploadedByUid) {
  const { task_id, document: rawDocument } = backendResult;

  let title = "Sin título";
  let author = "";
  let pageCount = 0;
  let rawKids = [];

  if (Array.isArray(rawDocument)) {
    // Si el document es directamente una lista de elementos
    rawKids = rawDocument;
  } else if (rawDocument && typeof rawDocument === "object") {
    // Estructura normal: dict con metadatos + kids
    const rawTitle = rawDocument.title || rawDocument["file name"] || "Sin título";
    title = cleanBookTitle(rawTitle);
    
    author = rawDocument.author || "";
    pageCount =
      rawDocument["number of pages"] ||
      rawDocument.page_count ||
      rawDocument.pageCount ||
      0;
    rawKids = rawDocument.kids || rawDocument.elements || [];
  }

  // Aplanar la estructura anidada en una lista plana legible
  const elements = flattenElements(rawKids);
  
  // Buscar portada
  const coverUrl = await fetchBookCover(title);

  const docRef = await addDoc(collection(db, "books"), {
    taskId: task_id || "",
    title: title,
    coverUrl: coverUrl || null,
    author: author.trim(),
    pageCount,
    elements,
    uploadedBy: uploadedByUid,
    uploadedAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Obtiene todos los libros de la colección global, ordenados por fecha.
 * @returns {Array} - Lista de libros con su ID de Firestore.
 */
export async function getBooks(maxBooks = 50) {
  const q = query(
    collection(db, "books"),
    orderBy("uploadedAt", "desc"),
    limit(maxBooks)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Obtiene un libro por su ID de Firestore.
 * @param {string} bookId - ID del documento en la colección `books/`.
 * @returns {object|null} - Datos del libro o null si no existe.
 */
export async function getBook(bookId) {
  const docRef = doc(db, "books", bookId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

// ─── PROGRESS ─────────────────────────────────────────────────────────────────

/**
 * Guarda o actualiza el progreso de lectura del usuario para un libro.
 * @param {string} userId - UID del usuario.
 * @param {string} bookId - ID del libro en Firestore.
 * @param {number} currentElementId - Índice del elemento actual.
 * @param {number} charOffset - Offset de carácter dentro del elemento.
 */
export async function saveProgress(userId, bookId, currentElementId, charOffset = 0) {
  const progressRef = doc(db, "users", userId, "progress", bookId);
  await setDoc(progressRef, {
    currentElementId,
    charOffset,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Obtiene el progreso de lectura del usuario para un libro.
 * @param {string} userId - UID del usuario.
 * @param {string} bookId - ID del libro en Firestore.
 * @returns {object|null} - Progreso guardado o null si no hay progreso.
 */
export async function getProgress(userId, bookId) {
  const progressRef = doc(db, "users", userId, "progress", bookId);
  const snapshot = await getDoc(progressRef);
  if (!snapshot.exists()) return null;
  return snapshot.data();
}

// ─── READER SETTINGS ──────────────────────────────────────────────────────────

/**
 * Guarda o actualiza las preferencias de la interfaz del lector (UI) para un usuario.
 * @param {string} userId - UID del usuario.
 * @param {object} settings - Objeto con las preferencias (fontSize, fontFamily, theme, etc.)
 */
export async function saveReaderSettings(userId, settings) {
  const settingsRef = doc(db, "users", userId, "settings", "reader");
  await setDoc(settingsRef, {
    ...settings,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Obtiene las preferencias de la interfaz del lector (UI) del usuario.
 * @param {string} userId - UID del usuario.
 * @returns {object|null} - Preferencias guardadas o null si no hay.
 */
export async function getReaderSettings(userId) {
  const settingsRef = doc(db, "users", userId, "settings", "reader");
  const snapshot = await getDoc(settingsRef);
  if (!snapshot.exists()) return null;
  return snapshot.data();
}
