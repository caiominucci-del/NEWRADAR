"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Skeleton from "../../components/ui/Skeleton";
import IsRealBadge from "../../components/IsRealBadge";
import TrendChart from "../../components/TrendChart";
import type { TrendInterestResponse } from "../../lib/types";
import { apiTrendsInterest, apiTopicsList } from "../../lib/api";

const pollMs = 30 * 60_000;

function splitKeywords(s: string) {
  return s
    .split(/[,\n]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeKeyword(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function KeywordPanel({
  keyword,
  window,
  canRemove,
  onRemove,
}: {
  keyword: string;
  window: "now 7-d" | "today 1-m" | "today 3-m";
  canRemove?: boolean;
  onRemove?: () => void;
}) {
  const { data, isLoading } = useSWR(
    keyword ? `trends:interest:${keyword}:${window}` : null,
    () => apiTrendsInterest(keyword, window),
    { refreshInterval: pollMs }
  );

  return (
    <Card className="p-4 glass">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{keyword}</div>
          <div className="text-xs text-slate-400 mt-1">
            Janela: <b className="text-slate-200/90">{window}</b>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {data ? <IsRealBadge isReal={data.is_real} /> : <Badge tone="neutral">loading</Badge>}
          {canRemove ? (
            <Button variant="ghost" className="px-2 py-1" onClick={onRemove}>
              Remover
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        {isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-2/5" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone="neutral">Interesse máximo: {data.peak}/100</Badge>
            </div>
            <TrendChart points={data.points} height={220} />
          </div>
        )}
      </div>
    </Card>
  );
}

export default function KeywordsLivePage() {
  const [window, setWindow] = useState<"now 7-d" | "today 1-m" | "today 3-m">("today 3-m");
  const [draft, setDraft] = useState("Bolsonaro, STF, Economia Brasil");
  const [keywords, setKeywords] = useState<string[]>(["Bolsonaro", "STF", "Economia Brasil"]);

  const { data: topicsData } = useSWR("topics:list:for-keywords", apiTopicsList, {
    refreshInterval: pollMs * 2,
  });

  const suggested = useMemo(() => {
    const t = topicsData?.topics ?? [];
    return t.flatMap((x) => x.keywords.slice(0, 1)).slice(0, 20);
  }, [topicsData]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-bold">Keywords ao vivo</div>
          <div className="text-sm text-slate-300/80 mt-1">
            Monitoramento de keywords a partir dos dados do último refresh diário.
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge tone="neutral">Atualizado a cada 30min</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 glass lg:col-span-1">
          <div className="font-semibold">Adicionar keywords</div>
          <div className="mt-3 space-y-3">
            <label className="block">
              <div className="text-xs text-slate-300/80 mb-2">Input (separe por vírgula)</div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </label>

            <label className="block">
              <div className="text-xs text-slate-300/80 mb-2">Janela</div>
              <select
                value={window}
                onChange={(e) => setWindow(e.target.value as any)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
              >
                <option value="now 7-d">now 7-d</option>
                <option value="today 1-m">today 1-m</option>
                <option value="today 3-m">today 3-m</option>
              </select>
            </label>

            <Button
              variant="primary"
              onClick={() => {
                const next = splitKeywords(draft).map(normalizeKeyword);
                setKeywords(Array.from(new Set([...keywords, ...next])).slice(0, 8));
              }}
            >
              Adicionar
            </Button>
          </div>

          <div className="mt-4">
            <div className="text-xs text-slate-300/80 mb-2">Sugestões (dos temas)</div>
            <div className="flex flex-wrap gap-2">
              {suggested.slice(0, 12).map((k) => (
                <button
                  key={k}
                  className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition"
                  onClick={() => {
                    setKeywords((prev) => (prev.includes(k) ? prev : [...prev, k].slice(0, 8)));
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {keywords.length === 0 ? (
            <div className="md:col-span-2 flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <div className="text-3xl opacity-40">🔍</div>
              <div className="text-sm">Adicione keywords para monitorar.</div>
            </div>
          ) : (
            keywords.map((k) => (
              <KeywordPanel
                key={k}
                keyword={k}
                window={window}
                canRemove
                onRemove={() => setKeywords((prev) => prev.filter((x) => x !== k))}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

