"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Skeleton from "../../components/ui/Skeleton";
import IsRealBadge from "../../components/IsRealBadge";
import type { CompetitionChannel, TopicSummaryResponse } from "../../lib/types";
import { apiCompetitionChannels, apiCompetitionGaps, apiTopicsList, apiTrendsRelated } from "../../lib/api";

const pollMs = 2 * 60_000;

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function tokenize(s: string) {
  return normalize(s)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function computeOverlapPercent(videoTitle: string, keywords: string[]) {
  const titleN = normalize(videoTitle);
  const kws = keywords.filter(Boolean);

  const matched: string[] = [];
  for (const kw of kws) {
    const kwN = normalize(kw);
    if (!kwN) continue;
    // match frase (ou termo curto) no título
    if (kwN.length >= 3 && titleN.includes(kwN)) matched.push(kw);
  }

  const percent = kws.length ? Math.round((matched.length / kws.length) * 100) : 0;
  return { percent, matched };
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

type OverlapVideo = {
  title: string;
  link: string;
  published_at: string;
  thumbnail?: string;
  overlap_percent: number;
  overlap_keywords: string[];
};

export default function CompetitionPage() {
  const { data: topicsData, isLoading: topicsLoading } = useSWR("topics:list", apiTopicsList, {
    refreshInterval: pollMs * 2,
  });
  const { data: channels, isLoading: channelsLoading } = useSWR(
    "competition:channels",
    apiCompetitionChannels,
    { refreshInterval: pollMs }
  );
  const { data: gaps, isLoading: gapsLoading } = useSWR(
    "competition:gaps",
    apiCompetitionGaps,
    { refreshInterval: pollMs * 2 }
  );

  const topics = topicsData?.topics ?? [];
  const [selectedTopicId, setSelectedTopicId] = useState<string>(topics[0]?.id ?? "");

  const selectedTopic: TopicSummaryResponse | undefined = useMemo(() => {
    return topics.find((t) => t.id === selectedTopicId) ?? topics[0];
  }, [topics, selectedTopicId]);

  const keywordAnchor = selectedTopic?.keywords?.[0] ?? selectedTopic?.tema ?? "";
  const { data: relatedData } = useSWR(
    keywordAnchor ? `trends:related:competition:${keywordAnchor}` : null,
    () => apiTrendsRelated(keywordAnchor),
    { refreshInterval: pollMs }
  );

  const baseKeywords = selectedTopic?.keywords ?? [];
  const relatedKeywords = (relatedData?.items ?? []).map((it) => it.query);
  const keywords = Array.from(new Set([...baseKeywords, ...relatedKeywords])).slice(0, 12);
  const trendPeak = selectedTopic?.trend?.peak ?? 0;

  const channelsComputed: Array<CompetitionChannel & { _videosWithOverlap: OverlapVideo[] }> =
    useMemo(() => {
      const res: Array<CompetitionChannel & { _videosWithOverlap: OverlapVideo[] }> = [];
      (channels?.channels ?? []).forEach((ch) => {
        const vids = ch.videos.items.map((v) => {
          const ov = computeOverlapPercent(v.title, keywords);
          return { ...v, overlap_percent: ov.percent, overlap_keywords: ov.matched };
        });
        // ordenar por overlap desc (mais “copiável” no título)
        vids.sort((a, b) => (b.overlap_percent ?? 0) - (a.overlap_percent ?? 0));
        res.push({ ...ch, _videosWithOverlap: vids });
      });
      return res;
    }, [channels, keywords]);

  const channelRanking = useMemo(() => {
    return channelsComputed
      .map((ch) => ({
        nome: ch.nome,
        avgOverlap: avg(ch._videosWithOverlap.map((v) => v.overlap_percent || 0)),
        count: ch._videosWithOverlap.length,
      }))
      .sort((a, b) => b.avgOverlap - a.avgOverlap);
  }, [channelsComputed]);

  if (topicsLoading || channelsLoading) {
    return (
      <div className="space-y-4">
        <Card className="p-4 glass">
          <Skeleton className="h-8 w-1/2" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-bold">Concorrência</div>
          <div className="text-sm text-slate-300/80 mt-1">
            Vídeos + Overlap por palavras-chave do tema selecionado.
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Badge tone="info">Topic peak: {trendPeak}</Badge>
        </div>
      </div>

      <Card className="p-4 glass">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <label className="block">
            <div className="text-xs text-slate-300/80 mb-2">Tema para comparar</div>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tema} (score {t.score})
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2 text-sm text-slate-200/90 md:justify-start md:col-span-2">
            <Badge tone="neutral">{keywords.length} keywords</Badge>
            {relatedData?.items?.length ? <Badge tone="info">+ SEO relacionadas</Badge> : null}
            {selectedTopic ? <IsRealBadge isReal={selectedTopic.trend.is_real} /> : null}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 flex flex-col gap-4">
          <Card className="p-4 glass">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">Heatmap de overlap (canal x keyword)</div>
              <Badge tone="neutral">Heurística em título</Badge>
            </div>
            <div className="mt-3 overflow-auto">
              <table className="min-w-[920px] w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-300/80">
                    <th className="py-2 pr-3">Canal</th>
                    {keywords.slice(0, 8).map((kw) => (
                      <th key={kw} className="py-2 pr-3 whitespace-nowrap">
                        {kw}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {channelsComputed.map((ch) => (
                    <tr key={ch.nome} className="border-t border-white/5">
                      <td className="py-2 pr-3 whitespace-nowrap font-semibold">{ch.nome}</td>
                      {keywords.slice(0, 8).map((kw) => {
                        const hitCount = ch._videosWithOverlap.filter((v) =>
                          (v.overlap_keywords || []).some(
                            (k) => normalize(k) === normalize(kw)
                          )
                        ).length;
                        const intensity = Math.min(1, hitCount / Math.max(1, ch._videosWithOverlap.length));
                        const bg = `rgba(99,102,241,${0.12 + intensity * 0.5})`;
                        return (
                          <td key={`${ch.nome}-${kw}`} className="py-2 pr-3">
                            <div
                              className="rounded-lg border border-white/10 px-2 py-1 text-center"
                              style={{ background: bg }}
                            >
                              {hitCount}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {channelsComputed.map((ch) => (
            <Card key={ch.nome} className="p-4 glass">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <span className="text-lg">{ch.flag}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{ch.nome}</div>
                      <div className="text-xs text-slate-400 truncate">{ch.foco}</div>
                    </div>
                  </div>
                </div>
                <Badge tone="neutral">{ch._videosWithOverlap.length} vídeos</Badge>
              </div>

              <div className="mt-4 space-y-2 max-h-[420px] overflow-auto pr-1">
                {ch._videosWithOverlap.slice(0, 10).map((v, idx) => (
                  <div
                    key={`${v.link}-${idx}`}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <a
                        href={v.link}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0"
                      >
                        <div className="text-sm font-semibold line-clamp-2">{v.title}</div>
                        <div className="text-xs text-slate-400 mt-2">{v.published_at}</div>
                      </a>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-indigo-100">
                          {v.overlap_percent}%
                        </div>
                        <div className="text-[11px] text-slate-400">overlap</div>
                      </div>
                    </div>

                    {v.overlap_keywords?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {v.overlap_keywords.slice(0, 6).map((kw: string) => (
                          <span
                            key={kw}
                            className="px-2.5 py-1 text-[11px] rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-100"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-slate-400">
                        Nenhuma keyword detectada no título.
                      </div>
                    )}

                    {/* sugestão visual: quando overlap alto, compete diretamente; quando baixo, pode diferenciar */}
                    <div className="mt-3 flex items-center gap-2">
                      {v.overlap_percent >= 50 ? (
                        <Badge tone="warning">Alta competição</Badge>
                      ) : (
                        <Badge tone="success">Boa diferenciação</Badge>
                      )}
                      {ch.videos.is_real ? (
                        <Badge tone="info">is_real</Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-4 glass">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">Ranking competitivo</div>
              <Badge tone="neutral">avg overlap</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {channelRanking.map((ch) => (
                <div
                  key={ch.nome}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{ch.nome}</div>
                    <div className="text-xs text-slate-400">{ch.count} videos</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-indigo-100">{ch.avgOverlap}%</div>
                    <div className="text-[11px] text-slate-400">
                      {ch.avgOverlap >= 50 ? "copiar promessa" : "diferenciar ângulo"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 glass">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">Lacunas</div>
              <Badge tone="neutral">Gap</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {gapsLoading || !gaps ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                gaps.gaps.slice(0, 8).map((g) => (
                  <div key={g.tema} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-sm font-semibold">{g.tema}</div>
                    <div className="text-xs text-slate-400 mt-2 line-clamp-2">{g.desc}</div>
                    <div className="text-xs mt-2 text-amber-100 font-bold">{g.gap} gap</div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4 glass">
            <div className="font-semibold">Como usar</div>
            <div className="mt-2 text-sm text-slate-300/80 leading-relaxed">
              Se o overlap do concorrente é alto, você tende a competir por “mesma promessa”.
              Quando o overlap é baixo, há chance de fazer uma abordagem mais original (ângulo, formato e gancho).
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

