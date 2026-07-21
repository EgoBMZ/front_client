"use client";

import GoogleLoginButton from "@/components/GoogleLoginButton";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Si ya está autenticado, redirige a la biblioteca
  useEffect(() => {
    if (!loading && user) {
      router.replace("/library");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">📖 AuraRead</div>
        <p className="login-tagline">Tu biblioteca digital, en cualquier lugar</p>

        {/* Divider */}
        <div className="login-divider">Accede con tu cuenta de Google</div>

        {/* Google Button */}
        <GoogleLoginButton
          size="large"
          onSuccess={() => router.replace("/library")}
        />

        {/* Footer note */}
        <p className="login-footer-note">
          Al continuar aceptas nuestros términos de uso. Tu progreso
          de lectura se sincronizará automáticamente en todos tus dispositivos.
        </p>
      </div>
    </div>
  );
}
