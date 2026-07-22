import { Playfair_Display, Inter } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Navbar from "@/components/Navbar";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "AuraRead — Tu biblioteca digital",
  description: "Sube tus libros en PDF y léelos desde cualquier dispositivo. AuraRead recuerda en qué página quedaste.",
  keywords: ["lector", "libros", "PDF", "biblioteca digital", "leer online", "audiolibros", "AuraRead"],
  authors: [{ name: "AuraRead Team" }],
  creator: "AuraRead",
  openGraph: {
    title: "AuraRead — Tu biblioteca digital inteligente",
    description: "Transforma tus PDFs en libros digitales interactivos. Lee o escucha tus libros en cualquier dispositivo.",
    url: "https://auraread.vercel.app",
    siteName: "AuraRead",
    images: [
      {
        url: "/landing-hero-purple.png",
        width: 1200,
        height: 630,
        alt: "AuraRead - Biblioteca Digital",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AuraRead — Tu biblioteca digital",
    description: "Sube tus libros en PDF y léelos desde cualquier dispositivo.",
    images: ["/landing-hero-purple.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${playfair.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  if (saved) {
                    document.documentElement.setAttribute('data-theme', saved);
                  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.documentElement.setAttribute('data-theme', 'dark');
                  }
                } catch (e) {}
              })();
            `
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;

                // 1. Bloquear click derecho
                document.addEventListener('contextmenu', function(e) {
                  e.preventDefault();
                });

                // 2. Bloquear shortcuts (F12, Ctrl+Shift+I, Cmd+Opt+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U)
                document.addEventListener('keydown', function(e) {
                  if (
                    e.key === 'F12' ||
                    ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
                    ((e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u'))
                  ) {
                    e.preventDefault();
                  }
                });

                // 3. Imprimir advertencia de consola en ASCII (¡Así te quería agarrar, perro!)
                var art = "\\n" +
" █████   ███████  ██      ███████  ███████       ██████   ██   ██  ███████  ██████   ██   █████  \\n" +
"██   ██  ██       ██         ██    ██           ██    ██  ██   ██  ██       ██   ██  ██  ██   ██ \\n" +
"███████  ███████  ██         ██    █████        ██  █ ██  ██   ██  █████    ██████   ██  ███████ \\n" +
"██   ██       ██  ██         ██    ██           ██   ██   ██   ██  ██       ██   ██  ██  ██   ██ \\n" +
"██   ██  ███████  ██         ██    ███████       ██████    █████   ███████  ██   ██  ██  ██   ██ \\n" +
"                                                                                            \\n" +
" █████   ██████    █████   ██████   ██████    █████   ██████        \\n" +
"██   ██ ██        ██   ██  ██   ██  ██   ██  ██   ██  ██   ██       \\n" +
"███████ ██   ██   ███████  ██████   ██████   ███████  ██████        \\n" +
"██   ██ ██   ██   ██   ██  ██   ██  ██   ██  ██   ██  ██   ██   ██  \\n" +
"██   ██  ██████   ██   ██  ██   ██  ██   ██  ██   ██  ██   ██  ██   \\n" +
"                                                                    \\n" +
"██████   ███████  ██████   ██████    ██████   ██ \\n" +
"██   ██  ██       ██   ██  ██   ██  ██    ██  ██ \\n" +
"██████   █████    ██████   ██████   ██    ██  ██ \\n" +
"██       ██       ██   ██  ██   ██  ██    ██     \\n" +
"██       ███████  ██   ██  ██   ██   ██████   ██ \\n";

                console.log("%c" + art, "color: #7B5CFA; font-family: monospace; font-weight: bold; line-height: 1.15;");
                console.log("%c¡Así te quería agarrar, perro! 🐶", "color: #ff4a5a; font-size: 22px; font-weight: bold; font-family: sans-serif; text-shadow: 1px 1px 2px rgba(0,0,0,0.15); padding: 10px 0;");
              })();
            `
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <Navbar />
            <main className="main-content">{children}</main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
