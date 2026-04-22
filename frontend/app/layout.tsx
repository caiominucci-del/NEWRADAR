"use client";

import "./globals.css";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, FormEvent } from "react";

import Sidebar from "../components/Sidebar";
import { getAuthToken, setAuthToken } from "../lib/auth";
import { apiLogin, apiMe } from "../lib/api";

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const auth = await apiLogin(username, password);
      setAuthToken(auth.access_token);
      await apiMe();
      onSuccess();
    } catch {
      setErr("Usuário ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <html lang="pt-BR">
      <head>
        <title>Radar BP — Acesso</title>
      </head>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] px-4">
          <div className="w-full max-w-sm">
            {/* Logo / branding */}
            <div className="flex flex-col items-center mb-8 gap-3">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500/40 to-emerald-500/30 border border-white/10 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/10">
                📡
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-slate-100">Radar BP</div>
                <div className="text-xs text-slate-400 mt-0.5">Inteligência Editorial</div>
              </div>
            </div>

            {/* Card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-xl shadow-black/30">
              <div className="text-base font-semibold text-slate-100 mb-4">Acesso restrito</div>

              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block">
                  <div className="text-xs text-slate-400 mb-1.5">Usuário</div>
                  <input
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-400/40 placeholder:text-slate-600 transition"
                    placeholder="admin"
                  />
                </label>

                <label className="block">
                  <div className="text-xs text-slate-400 mb-1.5">Senha</div>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-400/40 placeholder:text-slate-600 transition"
                    placeholder="••••••••"
                  />
                </label>

                {err && (
                  <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                    {err}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !username || !password}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white transition shadow-md shadow-indigo-900/40"
                >
                  {loading ? "Verificando..." : "Entrar"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  const checkAuth = () => {
    setIsAuth(Boolean(getAuthToken()));
  };

  useEffect(() => {
    checkAuth();
  }, [pathname]);

  // Resolving auth state — blank to avoid flash
  if (isAuth === null) {
    return (
      <html lang="pt-BR">
        <body>
          <div className="min-h-screen bg-[#0a0f1e]" />
        </body>
      </html>
    );
  }

  // Not authenticated → show login screen, block everything else
  if (!isAuth) {
    return <LoginScreen onSuccess={checkAuth} />;
  }

  // Authenticated → normal layout with sidebar
  // Redirect /login to / since login is now embedded in layout
  if (pathname === "/login") {
    router.replace("/");
    return null;
  }

  return (
    <html lang="pt-BR">
      <head>
        <title>Radar BP — Equipe</title>
        <meta name="description" content="Central de produção editorial e análise de tendências" />
      </head>
      <body>
        <div className="min-h-screen flex bg-transparent">
          <Sidebar onLogout={checkAuth} />
          <main className="flex-1 px-5 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
