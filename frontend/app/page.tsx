"use client";

import useSWR from "swr";
import { AlertCircle } from "lucide-react";

import Card from "../components/ui/Card";
import IsRealBadge from "../components/IsRealBadge";
import RefreshStatus from "../components/RefreshStatus";
import { apiCompetitionGaps, apiTrendsMacro, apiTopicsList } from "../lib/api";
import Skeleton from "../components/ui/Skeleton";
import Badge from "../components/ui/Badge";

const pollMs = 60_000;

function NoData({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-amber-400/80 py-2">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>{message ?? "Aguardando próxima atualização (07h diário)."}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: macro, isLoading: macroLoading, error: macroError } = useSWR(
    "trends:macro", apiTrendsMacro, { refreshInterval: pollMs }
  );
  const { data: topics, isLoading: topicsLoading, error: topicsError } = useSWR(
    "topics:list", apiTopicsList, { refreshInterval: pollMs }
  );
  const { data: gaps, isLoading: gapsLoading, error: gapsError } = useSWR(
    "competition:gaps", apiCompetitionGaps, { refreshInterval: pollMs * 2 }
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-2xl font-bold">Radar BP</div>
          <div className="text-slate-300/80 mt-1 text-sm">
            Visão geral — dados atualizados diariamente às 07h.
          </div>
        </div>
        <RefreshStatus />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Macro Trends */}
        <Card className="p-4 glass">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Top Macro Trends (BR)</div>
            {macro ? <IsRealBadge isReal={macro.is_real} /> : null}
          </div>
          <div className="mt-4">
            {macroError ? (
              <NoData message="Erro ao carregar macro trends." />
            ) : macroLoading || !macro ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-11/12" />
                <Skeleton className="h-8 w-10/12" />
              </div>
            ) : macro.topics.length === 0 ? (
              <NoData />
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

        {/* Temas em alta */}
        <Card className="p-4 glass">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Temas monitorados</div>
            {topics ? (
              <IsRealBadge
                isReal={topics.topics.some((t) => t.trend?.is_real)}
                pending={topics.topics.every((t) => !t.trend?.is_real)}
              />
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {topicsError ? (
              <NoData message="Erro ao carregar temas." />
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
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/25 to-emerald-500/20 border border-white/10 flex items-center justify-center text-lg shrink-0">
                      {t.emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{t.tema}</div>
                      <div className="text-xs text-slate-300/80 truncate">{t.categoria}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {t.trend?.is_real ? (
                      <>
                        <div className="text-sm font-bold text-indigo-100">{t.score}</div>
                        <div className="text-xs text-slate-400">peak {t.trend.peak}</div>
                      </>
                    ) : (
                      <div className="text-xs text-amber-400/70">sem dados</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Lacunas editoriais */}
        <Card className="p-4 glass">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Lacunas editoriais</div>
            <Badge tone="neutral">Concorrência</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {gapsError ? (
              <NoData message="Erro ao carregar lacunas." />
            ) : gapsLoading || !gaps ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : gaps.gaps.length === 0 ? (
              <NoData />
            ) : (
              gaps.gaps.slice(0, 4).map((g) => (
                <div key={g.tema} className="p-3 rounded-xl bg-white/5 border border-white/10">
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
    </div>
  );
}
