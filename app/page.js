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
    <div className="landing-page-container">
      {/* ─── Hero Container (Magic Pages Style) ────────────────────── */}
      <section className="landing-hero-section">
        <div className="hero-outer-card">
          <div className="hero-inner-card">
            
            {/* Left Column: Content */}
            <div className="hero-text-side">
              <div className="platform-tag">✨ AuraRead</div>
              <h1 className="hero-title-main">
                TUS LIBROS,<br />CON VOZ PROPIA.
              </h1>
              <p className="hero-subtitle-text">
                Sube cualquier archivo PDF y conviértelo al instante en un libro digital interactivo con narrador de voz inteligente.
              </p>
              
              <div className="hero-cta-group">
                <Link href="/login" className="btn-neo-primary" id="hero-cta-login">
                  Comenzar ahora
                </Link>
                <Link href="/library" className="btn-neo-secondary" id="hero-cta-library">
                  Ver demo
                </Link>
              </div>
            </div>

            {/* Right Column: Integrated Illustration */}
            <div className="hero-graphic-side">
              <img 
                src="/landing-hero-purple.png" 
                alt="AuraRead ilustrado" 
                className="hero-illustration-img" 
              />
            </div>

          </div>
        </div>

        {/* Metrics/Trust bar below card */}
        <div className="hero-metrics-bar">
          <div className="metric-item">
            <span className="metric-star">✦</span> 10,000+ Libros Estructurados
          </div>
          <div className="metric-item">
            <span className="metric-star">✦</span> Narración Inteligente de Voz
          </div>
          <div className="metric-item">
            <span className="metric-star">✦</span> Sincronización en Cualquier Pantalla
          </div>
        </div>
      </section>

      {/* ─── Features (Cards style) ────────────────────────────────── */}
      <section className="landing-features-section">
        <div className="container">
          <h2 className="section-heading-neo">Una nueva forma de leer y escuchar</h2>

          <div className="features-grid-neo">
            {features.map((f) => (
              <div key={f.title} className="feature-card-neo">
                <span className="feature-icon-neo">{f.icon}</span>
                <h3 className="feature-title-neo">{f.title}</h3>
                <p className="feature-desc-neo">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA (Box Card style) ──────────────────────────────────── */}
      <section className="landing-cta-section">
        <div className="cta-outer-card">
          <div className="cta-inner-card">
            <h2 className="cta-title-neo">¿Listo para transformar tus PDFs?</h2>
            <p className="cta-subtitle-neo">
              Sube tu primer libro y llévalo contigo en cualquier dispositivo.
            </p>
            <Link href="/login" className="btn-neo-primary" id="cta-bottom-login">
              Crear cuenta ahora
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
