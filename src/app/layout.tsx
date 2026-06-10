import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auditoría — Plataforma de Evaluaciones",
  description: "Crea cuestionarios, evalúa clientes y recomienda soluciones automáticamente.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Apply stored theme before first paint to avoid a light-mode flash */}
        <script dangerouslySetInnerHTML={{ __html:
          `try{if(localStorage.getItem("auditoria_theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
        }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
