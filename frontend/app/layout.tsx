import "./globals.css";

import type { ReactNode } from "react";

import Sidebar from "../components/Sidebar";

export const metadata = {
  title: "Radar BP — Equipe",
  description: "Central de produção editorial e análise de tendências",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen flex bg-transparent">
          <Sidebar />
          <main className="flex-1 px-5 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

