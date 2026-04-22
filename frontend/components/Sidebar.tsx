"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LogOut,
  BarChart3,
  Bot,
  LayoutDashboard,
  Search,
  Newspaper,
  Video,
  Radio,
} from "lucide-react";
import { clearAuthToken, getAuthToken } from "@/lib/auth";

const nav = [
  { href: "/",              label: "Dashboard",       icon: LayoutDashboard },
  { href: "/topics",        label: "Temas + Scores",  icon: BarChart3 },
  { href: "/competition",   label: "Concorrência",    icon: Video },
  { href: "/seo",           label: "SEO Booster",     icon: Newspaper },
  { href: "/keywords-live", label: "Keywords ao vivo",icon: Search },
  { href: "/editorial",     label: "Editorial IA",    icon: Bot },
];

export default function Sidebar({ onLogout }: { onLogout?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<string>("");

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUser(payload.sub || "admin");
      } catch {
        setUser("admin");
      }
    }
  }, []);

  function handleLogout() {
    clearAuthToken();
    onLogout?.();
    router.replace("/");
  }

  return (
    <aside className="w-[240px] hidden lg:flex flex-col gap-3 p-4 shrink-0">
      {/* Brand */}
      <div className="glass rounded-2xl p-4 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/30 to-emerald-500/25 border border-white/10 flex items-center justify-center text-lg">
            📡
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-sm">Radar BP</div>
            <div className="text-xs text-slate-400">Equipe de Produção</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="glass rounded-2xl p-2 flex flex-col gap-0.5">
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
                  : "text-slate-200/70 hover:bg-white/5 hover:text-slate-100 border border-transparent",
              ].join(" ")}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="glass rounded-2xl p-4 mt-auto text-xs text-slate-400 space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300 font-medium">Ao vivo</span>
        </div>
        <div className="text-slate-500">
          Conectado como <span className="text-slate-300">{user || "admin"}</span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-300 text-slate-300 transition text-xs"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </aside>
  );
}
