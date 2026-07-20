"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import { useState } from "react";

export default function Navbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const navLinks = [
    { href: "/library", label: "Biblioteca" },
    { href: "/upload", label: "Subir libro" },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link href="/" className="navbar-logo">
          <span className="logo-icon">📖</span>
          <span className="logo-text">Lexis</span>
        </Link>

        {/* Links (desktop) */}
        {user && (
          <div className="navbar-links">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${pathname === link.href ? "nav-link--active" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}

        {/* User area */}
        <div className="navbar-user">
          {user ? (
            <div className="user-menu-wrapper">
              <button
                className="user-avatar-btn"
                onClick={() => setMenuOpen(!menuOpen)}
                id="user-avatar-btn"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="avatar-img"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="avatar-fallback">
                    {user.displayName?.[0] || user.email?.[0] || "U"}
                  </span>
                )}
              </button>

              {menuOpen && (
                <div className="user-dropdown" id="user-dropdown">
                  <div className="dropdown-user-info">
                    <p className="dropdown-name">{user.displayName}</p>
                    <p className="dropdown-email">{user.email}</p>
                  </div>
                  <hr className="dropdown-divider" />
                  <button
                    className="dropdown-item dropdown-item--danger"
                    onClick={handleSignOut}
                    id="sign-out-btn"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="btn-primary btn-sm" id="login-link-navbar">
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
