"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBooks } from "@/lib/firestore";
import BookCard from "@/components/BookCard";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function LibraryPage() {
  return (
    <ProtectedRoute>
      <LibraryContent />
    </ProtectedRoute>
  );
}

function LibraryContent() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await getBooks();
        setBooks(data);
      } catch (err) {
        setError("No se pudo cargar la biblioteca. Intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = books.filter((b) =>
    b.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="library-page">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <p className="page-eyebrow">Colección</p>
          <h1 className="page-title">Biblioteca</h1>
        </div>

        <div className="page-header-right">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              id="library-search"
              className="search-input"
              type="text"
              placeholder="Buscar libro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert--error">{error}</div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="page-loader" style={{ minHeight: 300 }}>
          <div className="loader-spinner" />
        </div>
      ) : (
        <div className="books-grid">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📚</div>
              <h2 className="empty-state-title">
                {search ? "Sin resultados" : "La biblioteca está vacía"}
              </h2>
              <p className="empty-state-desc">
                {search
                  ? `No hay libros que coincidan con "${search}"`
                  : "Sé el primero en subir un libro a la comunidad."}
              </p>
              {!search && (
                <Link href="/upload" className="btn-primary" id="empty-upload-btn">
                  Subir un libro
                </Link>
              )}
            </div>
          ) : (
            filtered.map((book) => <BookCard key={book.id} book={book} />)
          )}
        </div>
      )}
    </div>
  );
}
