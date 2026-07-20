"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const features = [
  {
    icon: "📤",
    title: "Sube tu PDF",
    desc: "Arrastra tu libro en PDF y nuestra IA lo estructura automáticamente para una lectura óptima.",
  },
  {
    icon: "📚",
    title: "Biblioteca compartida",
    desc: "Todos los libros procesados están disponibles para la comunidad. Descubre nuevas lecturas.",
  },
  {
    icon: "🔖",
    title: "Reanuda donde quedaste",
    desc: "Tu progreso se sincroniza en la nube. Continúa desde cualquier dispositivo sin perder tu lugar.",
  },
  {
    icon: "🌙",
    title: "Lectura cómoda",
    desc: "Tipografía cuidadosamente elegida y diseño limpio para que puedas leer durante horas sin fatiga.",
  },
];

const previewColors = [
  ["#E8563A", "#F4A261"],
  ["#264653", "#2A9D8F"],
  ["#7B2D8B", "#C77DFF"],
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/library");
    }
  }, [user, loading, router]);

  if (loading || user) return null;

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="hero-bg-decoration hero-bg-1" />
        <div className="hero-bg-decoration hero-bg-2" />

        <div className="hero-badge">✨ Tu biblioteca digital</div>

        <h1 className="hero-title">
          Lee más,<br />
          <span className="hero-title-accent">recuerda todo.</span>
        </h1>

        <p className="hero-subtitle">
          Sube tus libros en PDF, léelos en cualquier dispositivo y
          retoma siempre donde lo dejaste.
        </p>

        <div className="hero-actions">
          <Link href="/login" className="btn-primary" id="hero-cta-login">
            Empezar gratis
          </Link>
          <Link href="/library" className="btn-outline" id="hero-cta-library">
            Ver biblioteca
          </Link>
        </div>

        {/* Portadas decorativas */}
        <div className="hero-books-preview">
          {previewColors.map(([from, to], i) => (
            <div
              key={i}
              className="preview-book"
              style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
            />
          ))}
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────── */}
      <section className="landing-features">
        <div className="container">
          <p className="section-label">¿Por qué Lexis?</p>
          <h2 className="section-title">Leer debería ser simple y placentero</h2>

          <div className="features-grid">
            {features.map((f) => (
              <div key={f.title} className="feature-card">
                <span className="feature-icon">{f.icon}</span>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────── */}
      <section className="landing-cta">
        <div className="cta-box">
          <h2 className="cta-title">¿Listo para empezar a leer?</h2>
          <p className="cta-subtitle">
            Crea tu cuenta gratis con Google y empieza en segundos.
          </p>
          <Link href="/login" className="btn-primary" id="cta-bottom-login">
            Crear cuenta gratis
          </Link>
        </div>
      </section>
    </>
  );
}
