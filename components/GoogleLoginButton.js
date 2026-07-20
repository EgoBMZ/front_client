"use client";

import { signInWithGoogle } from "@/lib/auth";
import { useState } from "react";

export default function GoogleLoginButton({ onSuccess, size = "default" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (onSuccess) onSuccess(user);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError("No se pudo iniciar sesión. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="google-login-wrapper">
      <button
        id="google-login-btn"
        className={`google-btn ${size === "large" ? "google-btn--large" : ""}`}
        onClick={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <span className="btn-spinner" />
        ) : (
          <svg className="google-icon" viewBox="0 0 48 48" fill="none">
            <path
              d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"
              fill="#FFC107"
            />
            <path
              d="M6.3 14.7l7.1 5.2C15.1 16.5 19.3 14 24 14c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"
              fill="#FF3D00"
            />
            <path
              d="M24 46c5.5 0 10.5-1.9 14.3-5.1l-6.6-5.5C29.7 37 27 38 24 38c-6 0-10.6-3.9-12.3-9.1l-7.1 5.5C8.1 41.3 15.5 46 24 46z"
              fill="#4CAF50"
            />
            <path
              d="M44.5 20H24v8.5h11.8c-.6 2.4-2 4.5-3.9 6L38.5 40C42.5 36.4 45 30.6 45 24c0-1.3-.2-2.7-.5-4z"
              fill="#1976D2"
            />
          </svg>
        )}
        <span>{loading ? "Iniciando sesión..." : "Continuar con Google"}</span>
      </button>
      {error && <p className="login-error">{error}</p>}
    </div>
  );
}
