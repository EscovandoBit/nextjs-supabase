import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Tarefas",
  description: "CRUD de tarefas com arquitetura hexagonal, Drizzle e Supabase",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:border focus:border-line focus:bg-surface-raised focus:px-3 focus:py-2 focus:text-sm"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
