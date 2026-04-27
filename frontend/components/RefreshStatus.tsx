"use client";

import useSWR from "swr";
import { Clock, RefreshCw, AlertCircle } from "lucide-react";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

const API_BASE =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "")) ||
  "http://127.0.0.1:8000";

function formatBRT(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export default function RefreshStatus() {
  const { data, error } = useSWR(`${API_BASE}/status`, fetcher, {
    refreshInterval: 60_000,
  });

  if (error || !data) return null;

  const meta = data.last_refresh;

  if (!meta) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Aguardando primeira atualização (job diário às 07h)</span>
      </div>
    );
  }

  const topicsOk = meta.topics_ok ?? 0;
  const topicsTotal = meta.topics_total ?? 0;
  const allOk = topicsOk === topicsTotal;

  return (
    <div
      className={[
        "flex items-center gap-2 text-xs rounded-lg px-3 py-1.5 border",
        allOk
          ? "text-emerald-300/90 bg-emerald-500/10 border-emerald-500/20"
          : "text-amber-300/90 bg-amber-500/10 border-amber-500/20",
      ].join(" ")}
    >
      {allOk ? (
        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      )}
      <span>
        Atualizado em {formatBRT(meta.refreshed_at)}
        {!allOk && ` — ${topicsOk}/${topicsTotal} tópicos OK`}
      </span>
      <Clock className="w-3 h-3 text-slate-500 shrink-0" />
    </div>
  );
}
