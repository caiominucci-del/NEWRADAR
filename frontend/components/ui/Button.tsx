"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export default function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-50 disabled:pointer-events-none";

  const variants: Record<string, string> = {
    primary:
      "bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/25 text-indigo-100 shadow-glow",
    secondary:
      "bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100",
    ghost: "bg-transparent hover:bg-white/5 border border-transparent text-slate-100",
    danger: "bg-rose-500/10 hover:bg-rose-500/20 border border-rose-400/20 text-rose-100",
  };

  return (
    <button className={[base, variants[variant], className].join(" ")} {...props}>
      {children}
    </button>
  );
}

