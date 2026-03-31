"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

import Card from "../../components/ui/Card";
import Skeleton from "../../components/ui/Skeleton";
import Badge from "../../components/ui/Badge";
import IsRealBadge from "../../components/IsRealBadge";
import type { TopicSummaryResponse } from "../../lib/types";
import { apiTopicsList } from "../../lib/api";

const pollMs = 60_000;

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export default function TopicsPage() {
  const { data, isLoading, error } = useSWR("topics:list", apiTopicsList, {
    refreshInterval: pollMs,
  });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const topics = data?.topics ?? [];
  const categories = useMemo(() => {
    const set = new Set<string>();
    topics.forEach((t) => set.add(t.categoria));
    return ["all", ...Array.from(set).sort()];
  }, [topics]);

  const filtered = useMemo(() => {
    const nq = normalize(q);
    return topics
      .filter((t) => (cat === "all" ? true : t.categoria === cat))
      .filter((t) => {
        if (!nq) return true;
        const hay = normalize([t.tema, t.categoria, t.keywords.join(" ")].join(" "));
        return hay.includes(nq);
      })
      .sort((a, b) => b.score - a.score);
  }, [topics, q, cat]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-bold">Temas + Scores</div>
          <div className="text-sm text-slate-300/80 mt-1">Ordenado por oportunidade calculada.</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex">
            <Badge tone="info">Live</Badge>
          </div>
        </div>
      </div>

      <Card className="p-4 glass">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-xs text-slate-300/80">Buscar</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ex: Bolsonaro, Economia..."
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs text-slate-300/80">Categoria</span>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "Todas" : c}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-slate-300/80">Ordenação</span>
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm">
              Top score (desc)
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 glass">
        {error ? (
          <div className="text-sm text-rose-300">{String((error as any)?.message || error)}</div>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-left text-slate-300/80">
                  <th className="py-2 pr-3">Tema</th>
                  <th className="py-2 pr-3">Categoria</th>
                  <th className="py-2 pr-3">Trend</th>
                  <th className="py-2 pr-3">News</th>
                  <th className="py-2 pr-3">Score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: TopicSummaryResponse) => (
                  <tr
                    key={t.id}
                    className="border-t border-white/5 hover:bg-white/5 transition"
                  >
                    <td className="py-3 pr-3">
                      <Link
                        href={`/topics/${t.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/25 to-emerald-500/20 border border-white/10 flex items-center justify-center text-lg">
                          {t.emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{t.tema}</div>
                          <div className="text-xs text-slate-400 truncate">
                            {t.keywords.slice(0, 3).join(", ")}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 pr-3 text-slate-200/90">{t.categoria}</td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">peak {t.trend.peak}</Badge>
                        <IsRealBadge isReal={t.trend.is_real} />
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{t.news.count} itens</Badge>
                        <IsRealBadge isReal={t.news.is_real} />
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-bold text-indigo-100">{t.score}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

