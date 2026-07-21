"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getBook } from "@/lib/firestore";
import Link from "next/link";
import Navbar from "@/components/Navbar";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function BookProfilePage() {
  const { bookId } = useParams();
  const router = useRouter();
  
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBook() {
      try {
        const bookData = await getBook(bookId);
        if (bookData) {
          setBook(bookData);
        } else {
          console.error("Book not found");
        }
      } catch (err) {
        console.error("Failed to load book:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBook();
  }, [bookId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex h-screen items-center justify-center flex-col">
        <h2 className="text-2xl font-bold mb-4">Libro no encontrado</h2>
        <button onClick={() => router.push("/library")} className="px-6 py-2 bg-[var(--primary)] text-white rounded">
          Volver a la Biblioteca
        </button>
      </div>
    );
  }

  const coverUrl = book.coverUrl 
    ? (book.coverUrl.startsWith("http") ? book.coverUrl : `${BACKEND_URL}${book.coverUrl}`) 
    : null;

  return (
    <>
      <Navbar />
      <main className="book-profile-container">
        <div className="book-profile-content">
          
          <div className="book-profile-left">
            <div className="book-profile-cover-wrapper">
              {coverUrl ? (
                <img src={coverUrl} alt={`Portada de ${book.title}`} className="book-profile-cover" />
              ) : (
                <div className="book-profile-cover-placeholder">
                  <span>{book.title?.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            
            <div className="book-profile-actions">
              <Link href={`/read/${book.id}`} className="btn-read-now">
                Comenzar a leer
              </Link>
            </div>
          </div>

          <div className="book-profile-right">
            <h1 className="book-profile-title">{book.title}</h1>
            <h2 className="book-profile-author">de {book.author || "Autor Desconocido"}</h2>
            
            <div className="book-profile-meta">
              {book.publishedDate && (
                <span className="meta-tag">Publicado: {book.publishedDate}</span>
              )}
              {book.pageCount ? (
                <span className="meta-tag">{book.pageCount} páginas</span>
              ) : null}
            </div>

            <div className="book-profile-section">
              <h3>Resumen</h3>
              {book.description ? (
                <p>{book.description}</p>
              ) : (
                <p style={{ fontStyle: "italic", color: "var(--ink-muted)", opacity: 0.7 }}>No se encontró una sinopsis disponible para este libro.</p>
              )}
            </div>

            <div className="book-profile-section">
              <h3>Sobre el autor</h3>
              {book.authorBio ? (
                <p>{book.authorBio}</p>
              ) : (
                <p style={{ fontStyle: "italic", color: "var(--ink-muted)", opacity: 0.7 }}>No se encontró información biográfica del autor.</p>
              )}
            </div>
            
          </div>
        </div>
      </main>
    </>
  );
}
