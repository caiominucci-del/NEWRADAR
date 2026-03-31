export default function Badge({
  children,
  tone = "neutral",
}: {
  children: import("react").ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const cls: Record<string, string> = {
    neutral: "bg-white/5 border border-white/10 text-slate-100",
    success: "bg-emerald-500/10 border border-emerald-400/20 text-emerald-100",
    warning: "bg-amber-500/10 border border-amber-400/20 text-amber-100",
    danger: "bg-rose-500/10 border border-rose-400/20 text-rose-100",
    info: "bg-indigo-500/10 border border-indigo-400/20 text-indigo-100",
  };

  return (
    <span className={["inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border", cls[tone]].join(" ")}>
      {children}
    </span>
  );
}

