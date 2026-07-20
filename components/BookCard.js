"use client";

import Link from "next/link";
import { cleanBookTitle } from "@/lib/firestore";

export default function BookCard({ book }) {
  const { id, uploadedAt, pageCount, author, coverUrl } = book;
  const title = cleanBookTitle(book.title);

  // Genera un color de portada basado en el título
  const coverColors = [
    ["#E8563A", "#F4A261"],
    ["#2D6A4F", "#74C69D"],
    ["#264653", "#2A9D8F"],
    ["#7B2D8B", "#C77DFF"],
    ["#C77B30", "#E9C46A"],
    ["#1D3557", "#457B9D"],
    ["#6D2B2B", "#E07A5F"],
    ["#1B4332", "#52B788"],
  ];

  // Elige color determinista basado en el id
  const colorIndex = id
    ? id.charCodeAt(0) % coverColors.length
    : 0;
  const [from, to] = coverColors[colorIndex];

  // Letra inicial del título para la portada
  const initial = title?.charAt(0).toUpperCase() || "L";

  // Formatea la fecha
  const formattedDate = uploadedAt?.toDate
    ? uploadedAt.toDate().toLocaleDateString("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Fecha desconocida";

  return (
    <Link href={`/read/${id}`} className="book-card" id={`book-card-${id}`}>
      {/* Portada simulada o Real */}
      <div
        className="book-cover"
        style={{
          background: coverUrl ? "#fff" : `linear-gradient(145deg, ${from}, ${to})`,
          backgroundImage: coverUrl ? `url(${coverUrl})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!coverUrl && <span className="book-cover-initial">{initial}</span>}
        <div className="book-spine" style={{ background: coverUrl ? "rgba(0,0,0,0.1)" : from }} />
      </div>

      {/* Info */}
      <div className="book-info">
        <h3 className="book-title">{title || "Sin título"}</h3>
        {author && <p className="book-author">{author}</p>}
        <p className="book-meta">
          {pageCount ? `${pageCount} págs` : ""}
          {pageCount && formattedDate ? " · " : ""}
          {formattedDate}
        </p>
      </div>
    </Link>
  );
}

