"use client";

import useSWR from "swr";

import Card from "../components/ui/Card";
import IsRealBadge from "../components/IsRealBadge";
import { apiCompetitionGaps, apiTrendsMacro, apiTopicsList } from "../lib/api";

import Skeleton from "../components/ui/Skeleton";
import Badge from "../components/ui/Badge";

const pollMs = 60_000;

export default function DashboardPage() {

  const { data: macro, isLoading: macroLoading, error: macroError } = useSWR("trends:macro", apiTrendsMacro, {
    refreshInterval: pollMs,
  });
  const { data: topics, isLoading: topicsLoading, error: topicsError } = useSWR("topics:list", apiTopicsList, {
    refreshInterval: pollMs,
  });
  const { data: gaps, isLoading: gapsLoading, error: gapsError } = useSWR("competition:gaps", apiCompetitionGaps, {
    refreshInterval: pollMs * 2,
  });

  // Mini “trend preview”: pegamos o trend/peak do primeiro tema por score.
  const preview = topics?.topics?.[0]?.trend;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-bold">Radar BP</div>
          <div className="text-slate-300/80 mt-1 text-sm">
            Visão geral para decisão rápida da equipe.
          </div>
        </div>

        <div className="hidden md:flex gap-2">
          <Badge tone="info">Poll: 1m</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 glass">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Top Macro Trends (BR)</div>
            {macro ? <IsRealBadge isReal={macro.is_real} /> : null}
          </div>

          <div className="mt-4">
            {macroError ? (
              <div className="text-sm text-rose-300">{String((macroError as any)?.message || macroError)}</div>
            ) : macroLoading || !macro ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-11/12" />
                <Skeleton className="h-10 w-10/12" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {macro.topics.slice(0, 10).map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 text-xs rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-100"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 glass">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Temas em alta</div>
            {topics ? <IsRealBadge isReal={topics.topics[0]?.trend?.is_real ?? false} /> : null}
          </div>

          <div className="mt-4 space-y-3">
            {topicsError ? (
              <div className="text-sm text-rose-300">{String((topicsError as any)?.message || topicsError)}</div>
            ) : topicsLoading || !topics ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              topics.topics.slice(0, 4).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/25 to-emerald-500/20 border border-white/10 flex items-center justify-center text-lg">
                      {t.emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{t.tema}</div>
                      <div className="text-xs text-slate-300/80 truncate">{t.categoria}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-indigo-100">{t.score}</div>
                    <div className="text-xs text-slate-400">peak {t.trend.peak}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4 glass">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Lacunas editoriais</div>
            <Badge tone="neutral">Concorrência</Badge>
          </div>

          <div className="mt-4 space-y-3">
            {gapsError ? (
              <div className="text-sm text-rose-300">{String((gapsError as any)?.message || gapsError)}</div>
            ) : gapsLoading || !gaps ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              gaps.gaps.slice(0, 4).map((g) => (
                <div
                  key={g.tema}
                  className="p-3 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{g.tema}</div>
                      <div className="text-xs text-slate-300/80 line-clamp-2">{g.desc}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-amber-100">{g.gap}</div>
                      <div className="text-[11px] text-slate-400">gap</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="p-4 glass">
        <div className="flex items-center justify-between gap-4">
          <div className="font-semibold">Sinal do topo (preview)</div>
          {preview ? <Badge tone="info">Peak: {preview.peak}</Badge> : null}
        </div>

        <div className="mt-4 text-sm text-slate-300/80">
          Clique em <b>Temas + Scores</b> para ver a curva completa e a parte editorial.
        </div>
      </Card>
    </div>
  );
}

