"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LogIn,
  LogOut,
  BarChart3,
  Bot,
  LayoutDashboard,
  Search,
  Settings,
  Newspaper,
  Video,
} from "lucide-react";
import { clearAuthToken, getAuthToken } from "@/lib/auth";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/topics", label: "Temas + Scores", icon: BarChart3 },
  { href: "/competition", label: "Concorrência", icon: Video },
  { href: "/seo", label: "SEO Booster", icon: Newspaper },
  { href: "/keywords-live", label: "Keywords ao vivo", icon: Search },
  { href: "/editorial", label: "Editorial IA", icon: Bot },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(Boolean(getAuthToken()));
  }, [pathname]);

  return (
    <aside className="w-[260px] hidden lg:flex flex-col gap-4 p-4">
      <div className="glass rounded-2xl p-4 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-emerald-500/25 border border-white/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-slate-100" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold">Radar BP</div>
            <div className="text-xs text-slate-400">Equipe de Produção</div>
          </div>
        </div>
      </div>

      <nav className="glass rounded-2xl p-2 flex flex-col">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "px-3 py-2 rounded-xl text-sm flex items-center gap-3 transition",
                active
                  ? "bg-indigo-500/15 border border-indigo-400/20 text-indigo-100"
                  : "text-slate-200/80 hover:bg-white/5 border border-transparent",
              ].join(" ")}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="glass rounded-2xl p-4 mt-auto text-xs text-slate-400">
        <div className="font-semibold text-slate-200 mb-1">Status</div>
        <div>{hasToken ? "Admin autenticado." : "Não autenticado."}</div>
        <div>Cache + Briefings em SQLite.</div>
        <div className="mt-3 flex items-center gap-2">
          <Link
            href="/login"
            className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-100 inline-flex items-center gap-1"
          >
            <LogIn className="h-3.5 w-3.5" />
            Login
          </Link>
          <button
            className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-100 inline-flex items-center gap-1"
            onClick={() => {
              clearAuthToken();
              setHasToken(false);
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </div>
    </aside>
  );
}

