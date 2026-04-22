"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Skeleton from "../../components/ui/Skeleton";
import IsRealBadge from "../../components/IsRealBadge";
import TrendChart from "../../components/TrendChart";
import type { TrendInterestResponse, TrendRelatedResponse } from "../../lib/types";
import { apiTrendsInterest, apiTrendsRelated } from "../../lib/api";

const pollMs = 5 * 60_000;

function buildSeoSuggestions({
  keyword,
  peak,
  related,
}: {
  keyword: string;
  peak: number;
  related: TrendRelatedResponse | undefined;
}) {
  const top = related?.items?.slice(0, 5) ?? [];
  const rising = related?.kind === "rising" ? top : top;
  const relatedPhrase = rising.slice(0, 3).map((x) => x.query).join(" | ");

  const urgency = peak >= 70 ? "alta" : peak >= 40 ? "média" : "baixa";
  const title =
    peak >= 70
      ? `O que ${keyword} revela agora (e por que todo mundo está falando disso)`
      : `${keyword}: tendências que mudam a leitura do cenário`;
  const gancho = relatedPhrase
    ? `Palavras em alta: ${relatedPhrase}.`
    : `Keyword em alta: ${keyword}.`;
  const description = `Baseado em Google Trends e queries relacionadas. Urgência: ${urgency}.`;
  return { title, gancho, description, urgency };
}

export default function SeoBoosterPage() {
  const [keyword, setKeyword] = useState("Bolsonaro");
  const [window, setWindow] = useState<"now 7-d" | "today 1-m" | "today 3-m">("today 3-m");

  const { data: interest, isLoading: interestLoading, mutate: mutateInterest } = useSWR(
    keyword ? `trends:interest:${keyword}:${window}` : null,
    () => apiTrendsInterest(keyword, window),
    { refreshInterval: pollMs }
  );

  const { data: related, isLoading: relatedLoading, mutate: mutateRelated } = useSWR(
    keyword ? `trends:related:${keyword}` : null,
    () => apiTrendsRelated(keyword),
    { refreshInterval: pollMs }
  );

  const suggestions = useMemo(() => {
    const peak = interest?.peak ?? 0;
    return buildSeoSuggestions({ keyword, peak, related });
  }, [keyword, interest?.peak, related]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-bold">SEO Booster</div>
          <div className="text-sm text-slate-300/80 mt-1">
            Transforme trends + relacionadas em sugestões editoriais.
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge tone="neutral">REST / JSON</Badge>
          <Badge tone="info">Poll: 5m</Badge>
        </div>
      </div>

      <Card className="p-4 glass">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <label className="block md:col-span-1">
            <div className="text-xs text-slate-300/80 mb-2">Keyword</div>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
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
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={async () => {
                await Promise.all([mutateInterest(), mutateRelated()]);
              }}
            >
              Atualizar
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setKeyword("");
              }}
            >
              Limpar
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="p-4 glass xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold">Interest ({window})</div>
            {interest ? <IsRealBadge isReal={interest.is_real} /> : null}
          </div>

          <div className="mt-3">
            {interestLoading || !interest ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-2/5" />
                <Skeleton className="h-72 w-full" />
              </div>
            ) : (
              <TrendChart points={interest.points} height={280} />
            )}
          </div>

          {interest ? (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Badge tone="neutral">peak {interest.peak}</Badge>
              <Badge tone={interest.peak >= 70 ? "danger" : interest.peak >= 40 ? "warning" : "neutral"}>
                urgência {suggestions.urgency}
              </Badge>
            </div>
          ) : null}
        </Card>

        <Card className="p-4 glass">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold">Related queries</div>
            {related ? <IsRealBadge isReal={related.is_real} /> : null}
          </div>

          <div className="mt-2 text-xs text-slate-300/80">
            Tipo: <b className="text-slate-100">{related?.kind || "-"}</b>
          </div>

          <div className="mt-3 space-y-2 max-h-[360px] overflow-auto pr-1">
            {relatedLoading || !related ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : related.items.length ? (
              related.items.slice(0, 10).map((it) => (
                <div
                  key={it.query}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{it.query}</div>
                    <div className="text-xs text-slate-400">score {it.value}</div>
                  </div>
                  <Badge tone="info">{it.value}</Badge>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-300/80">Sem dados relacionados (fallback ou sem key).</div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-4 glass">
        <div className="flex items-center justify-between gap-3">
          <div className="font-semibold">Sugestões SEO (heurísticas)</div>
          <Badge tone="neutral">editável manualmente</Badge>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-slate-300/80 mb-2">Título sugerido</div>
            <div className="text-sm font-semibold leading-snug">{suggestions.title}</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-slate-300/80 mb-2">Gancho</div>
            <div className="text-sm leading-snug">{suggestions.gancho}</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-slate-300/80 mb-2">Descrição</div>
            <div className="text-sm leading-relaxed text-slate-200/90">{suggestions.description}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

