"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import IsRealBadge from "../../../components/IsRealBadge";
import Skeleton from "../../../components/ui/Skeleton";
import TrendChart from "../../../components/TrendChart";
import {
  apiClearCache,
  apiExportBriefing,
  apiGetBriefing,
  apiSaveBriefing,
  apiTopicDetail,
} from "../../../lib/api";
import type { EditorialResponse, TopicDetailResponse } from "../../../lib/types";

const pollMs = 120_000;
const storageKey = (topicId: string) => `briefing:${topicId}`;

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export default function TopicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const topicId = String(params.topic_id || "");

  const { data, isLoading, mutate, error } = useSWR(
    topicId ? `topic:${topicId}` : null,
    () => apiTopicDetail(topicId),
    { refreshInterval: pollMs }
  );

  const topic = data?.topic;
  const [draft, setDraft] = useState<EditorialResponse | null>(null);
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    if (!topic) return;
    const saved = safeJsonParse<EditorialResponse>(localStorage.getItem(storageKey(topicId)));
    setDraft(saved ?? topic.editorial);
  }, [topicId, topic]);

  const prefix = useMemo(() => {
    if (!topic) return "";
    return `editorial:${topic.tema}:${topic.categoria}`;
  }, [topic]);

  async function onRefazer() {
    if (!topic) return;
    try {
      await apiClearCache(prefix);
      await mutate();
      setActionMsg("Cache invalidado e editorial recarregado.");
    } catch (ex: any) {
      setActionMsg(ex?.message || "Falha ao limpar cache.");
    }
  }

  async function onSalvarBriefingLocal() {
    if (!draft) return;
    localStorage.setItem(storageKey(topicId), JSON.stringify(draft));
    setActionMsg("Rascunho salvo localmente.");
  }

  async function onSalvarServidor() {
    if (!draft || !topic) return;
    try {
      await apiSaveBriefing(topicId, {
        tema: topic.tema,
        categoria: topic.categoria,
        titulo: draft.titulo,
        gancho: draft.gancho,
        angulo: draft.angulo,
        urgencia: draft.urgencia,
        formatos: draft.formatos || [],
        por_que_agora: draft.por_que_agora,
        keywords: topic.keywords || [],
        score: topic.score ?? null,
        is_real: draft.is_real,
      });
      setActionMsg("Briefing salvo no servidor.");
    } catch (ex: any) {
      setActionMsg(ex?.message || "Falha ao salvar no servidor.");
    }
  }

  async function onCarregarServidor() {
    try {
      const row = await apiGetBriefing(topicId);
      setDraft({
        angulo: row.payload.angulo || "",
        titulo: row.payload.titulo || "",
        gancho: row.payload.gancho || "",
        urgencia: row.payload.urgencia || "",
        formatos: row.payload.formatos || [],
        por_que_agora: row.payload.por_que_agora || "",
        is_real: row.payload.is_real || false,
      });
      setActionMsg("Briefing carregado do servidor.");
    } catch (ex: any) {
      setActionMsg(ex?.message || "Falha ao carregar briefing.");
    }
  }

  async function onExport(format: "json" | "csv") {
    try {
      const file = await apiExportBriefing(topicId, format);
      const blob = new Blob([file.content], { type: format === "json" ? "application/json" : "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
      setActionMsg(`Exportado (${format.toUpperCase()}).`);
    } catch (ex: any) {
      setActionMsg(ex?.message || "Falha ao exportar.");
    }
  }

  if (error) {
    return (
      <Card className="p-4 glass">
        <div className="text-rose-300 font-semibold">Erro ao carregar tema</div>
        <div className="text-sm text-rose-200/90 mt-2">{String((error as any)?.message || error)}</div>
      </Card>
    );
  }

  if (isLoading || !topic || !draft) {
    return (
      <div className="space-y-4">
        <Card className="p-4 glass">
          <Skeleton className="h-8 w-2/5" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold flex items-center gap-3">
            <span className="text-3xl">{topic.emoji}</span>
            <span>{topic.tema}</span>
            <Badge tone="info">Score {topic.score}</Badge>
          </div>
          <div className="text-sm text-slate-300/80 mt-1">{topic.categoria}</div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="secondary" onClick={() => onRefazer()}>
            Refazer IA
          </Button>
          <Button variant="primary" onClick={() => onSalvarBriefingLocal()}>
            Salvar rascunho
          </Button>
          <Button variant="secondary" onClick={() => onSalvarServidor()}>
            Salvar servidor
          </Button>
        </div>
      </div>
      {actionMsg ? <div className="text-sm text-indigo-200/90">{actionMsg}</div> : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="p-4 glass xl:col-span-1">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Trend (SerpAPI)</div>
            <IsRealBadge isReal={topic.trend.is_real} pending={!topic.trend.is_real} />
          </div>
          <div className="mt-3">
            {topic.trend.is_real && topic.trend.points?.length > 0 ? (
              <TrendChart points={topic.trend.points} height={240} />
            ) : (
              <div className="flex flex-col items-center justify-center h-[240px] gap-3 text-center text-slate-400">
                <div className="text-3xl opacity-40">📡</div>
                <div className="text-sm">Dados de tendência indisponíveis.</div>
                <div className="text-xs text-slate-500">Próxima atualização: 07h (diário)</div>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            {topic.trend.is_real && <Badge tone="neutral">peak {topic.trend.peak}</Badge>}
            <Badge tone="neutral">{topic.news.items.length} news</Badge>
          </div>
        </Card>

        <Card className="p-4 glass xl:col-span-2">
          <div className="font-semibold">News + Contexto</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {topic.keywords.slice(0, 6).map((k) => (
              <span
                key={k}
                className="px-3 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-slate-100"
              >
                {k}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="font-semibold">Últimas manchetes</div>
              <IsRealBadge isReal={topic.news.is_real} />
            </div>
            <Link href="/topics" className="text-xs text-slate-300/80 hover:text-indigo-200">
              Voltar
            </Link>
          </div>

          <div className="mt-3 space-y-2 max-h-[420px] overflow-auto pr-1">
            {topic.news.items.map((n, idx) => (
              <a
                key={`${n.link}-${idx}`}
                href={n.link}
                target="_blank"
                rel="noreferrer"
                className="block p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                <div className="text-sm font-semibold leading-snug line-clamp-2">{n.title}</div>
                <div className="text-xs text-slate-400 mt-2">{n.published_at}</div>
              </a>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-4 glass">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Editorial IA</div>
            <IsRealBadge isReal={topic.editorial.is_real} pending={(topic.editorial as any).pending} />
          </div>
          {(topic.editorial as any).pending || !topic.editorial.is_real ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center text-slate-400">
              <div className="text-3xl opacity-40">🤖</div>
              <div className="text-sm">Análise ainda não realizada.</div>
              <div className="text-xs text-slate-500">
                A IA analisa automaticamente após cada atualização diária (07h).
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs text-slate-300/80">Título</div>
                <div className="mt-1 text-sm font-semibold">{draft.titulo}</div>
              </div>
              <div>
                <div className="text-xs text-slate-300/80">Gancho</div>
                <div className="mt-1 text-sm">{draft.gancho}</div>
              </div>
              <div>
                <div className="text-xs text-slate-300/80">Ângulo</div>
                <div className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{draft.angulo}</div>
              </div>
              <div>
                <div className="text-xs text-slate-300/80">Por que agora</div>
                <div className="mt-1 text-sm">{draft.por_que_agora}</div>
              </div>
              <div>
                <div className="text-xs text-slate-300/80">Urgência</div>
                <div className="mt-1">
                  <Badge tone={draft.urgencia?.toLowerCase().includes("alta") ? "danger" : "warning"}>
                    {draft.urgencia}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4 glass">
          <div className="font-semibold">Ângulos + Briefing (editor)</div>
          <div className="mt-2 text-xs text-slate-300/80">
            Edite para adaptar ao roteiro do canal. O rascunho fica no `localStorage`.
          </div>

          <div className="mt-4 space-y-4">
            <label className="block">
              <div className="text-xs text-slate-300/80 mb-2">Título</div>
              <input
                value={draft.titulo}
                onChange={(e) => setDraft({ ...draft, titulo: e.target.value })}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-300/80 mb-2">Gancho</div>
              <input
                value={draft.gancho}
                onChange={(e) => setDraft({ ...draft, gancho: e.target.value })}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-300/80 mb-2">Ângulo</div>
              <textarea
                value={draft.angulo}
                onChange={(e) => setDraft({ ...draft, angulo: e.target.value })}
                rows={8}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-300/80 mb-2">Por que agora</div>
              <textarea
                value={draft.por_que_agora}
                onChange={(e) => setDraft({ ...draft, por_que_agora: e.target.value })}
                rows={3}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </label>

            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" onClick={() => onSalvarBriefingLocal()}>
                Salvar
              </Button>
              <Button variant="secondary" onClick={() => onCarregarServidor()}>
                Carregar servidor
              </Button>
              <Button variant="secondary" onClick={() => onSalvarServidor()}>
                Salvar servidor
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  const json = JSON.stringify(draft, null, 2);
                  await navigator.clipboard.writeText(json);
                }}
              >
                Copiar JSON
              </Button>
              <Button variant="ghost" onClick={() => onExport("json")}>
                Export JSON
              </Button>
              <Button variant="ghost" onClick={() => onExport("csv")}>
                Export CSV
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

