"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Skeleton from "../../components/ui/Skeleton";
import IsRealBadge from "../../components/IsRealBadge";
import type { EditorialResponse } from "../../lib/types";
import {
  apiClearCache,
  apiExportBriefing,
  apiGetBriefing,
  apiSaveBriefing,
  apiTopicDetail,
  apiTopicsList,
} from "../../lib/api";

const pollMs = 2 * 60_000;

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function storageKey(topicId: string) {
  return `editorialDraft:${topicId}`;
}

export default function EditorialIaPage() {
  const { data: topicsData, isLoading: topicsLoading } = useSWR("topics:list", apiTopicsList, {
    refreshInterval: pollMs * 2,
  });
  const topics = topicsData?.topics ?? [];

  const [selectedTopicId, setSelectedTopicId] = useState<string>(topics[0]?.id ?? "");

  useEffect(() => {
    if (!selectedTopicId && topics[0]?.id) setSelectedTopicId(topics[0].id);
  }, [selectedTopicId, topics]);

  const { data, isLoading, mutate } = useSWR(
    selectedTopicId ? `topic:${selectedTopicId}:editorial` : null,
    () => apiTopicDetail(selectedTopicId),
    { refreshInterval: pollMs }
  );

  const topic = data?.topic;

  const [draft, setDraft] = useState<EditorialResponse | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!topic) return;
    const saved = safeJsonParse<EditorialResponse>(localStorage.getItem(storageKey(selectedTopicId)));
    setDraft(saved ?? topic.editorial);
  }, [selectedTopicId, topic]);

  const prefix = useMemo(() => {
    if (!topic) return "";
    return `editorial:${topic.tema}:${topic.categoria}`;
  }, [topic]);

  async function onRefazer() {
    if (!topic) return;
    try {
      await apiClearCache(prefix);
      await mutate();
      setMsg("Cache invalidado e editorial atualizado.");
    } catch (ex: any) {
      setMsg(ex?.message || "Falha ao refazer.");
    }
  }

  function onSalvarLocal() {
    if (!draft) return;
    localStorage.setItem(storageKey(selectedTopicId), JSON.stringify(draft));
    setMsg("Rascunho salvo localmente.");
  }

  async function onSalvarServidor() {
    if (!draft || !topic) return;
    try {
      await apiSaveBriefing(selectedTopicId, {
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
      setMsg("Briefing salvo no servidor.");
    } catch (ex: any) {
      setMsg(ex?.message || "Falha ao salvar no servidor.");
    }
  }

  async function onCarregarServidor() {
    try {
      const row = await apiGetBriefing(selectedTopicId);
      setDraft({
        angulo: row.payload.angulo || "",
        titulo: row.payload.titulo || "",
        gancho: row.payload.gancho || "",
        urgencia: row.payload.urgencia || "",
        formatos: row.payload.formatos || [],
        por_que_agora: row.payload.por_que_agora || "",
        is_real: row.payload.is_real || false,
      });
      setMsg("Briefing carregado do servidor.");
    } catch (ex: any) {
      setMsg(ex?.message || "Falha ao carregar briefing.");
    }
  }

  async function onExport(format: "json" | "csv") {
    try {
      const file = await apiExportBriefing(selectedTopicId, format);
      const blob = new Blob([file.content], { type: format === "json" ? "application/json" : "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`Exportado (${format.toUpperCase()}).`);
    } catch (ex: any) {
      setMsg(ex?.message || "Falha ao exportar.");
    }
  }

  if (topicsLoading || isLoading || !topic || !draft) {
    return (
      <div className="space-y-4">
        <Card className="p-4 glass">
          <Skeleton className="h-8 w-1/2" />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-bold">Editorial IA</div>
          <div className="text-sm text-slate-300/80 mt-1">
            Ângulos, título e briefing pronto pra produção.
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Badge tone="info">Score {topic.score}</Badge>
          <Button variant="secondary" onClick={onRefazer}>
            Refazer IA
          </Button>
          <Button variant="primary" onClick={onSalvarLocal}>
            Salvar rascunho
          </Button>
          <Button variant="secondary" onClick={onSalvarServidor}>
            Salvar servidor
          </Button>
        </div>
      </div>
      {msg ? <div className="text-sm text-indigo-200/90">{msg}</div> : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-1">
          <Card className="p-4 glass">
            <div className="font-semibold mb-3">Escolha o tema</div>
            <div className="space-y-2 max-h-[540px] overflow-auto pr-1">
              {topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTopicId(t.id)}
                  className={[
                    "w-full text-left p-3 rounded-xl border transition",
                    t.id === selectedTopicId
                      ? "bg-indigo-500/15 border-indigo-400/25"
                      : "bg-white/5 border-white/10 hover:bg-white/10",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{t.emoji}</span>
                        <div className="font-semibold truncate">{t.tema}</div>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 line-clamp-1">{t.categoria}</div>
                    </div>
                    <Badge tone="neutral">{t.score}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone="neutral">peak {t.trend.peak}</Badge>
                    <IsRealBadge isReal={t.trend.is_real} />
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="xl:col-span-2 flex flex-col gap-4">
          <Card className="p-4 glass">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold flex items-center gap-3">
                <span className="text-2xl">{topic.emoji}</span>
                <span>{topic.tema}</span>
              </div>
              <IsRealBadge isReal={topic.editorial.is_real} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {topic.keywords.slice(0, 8).map((k) => (
                <span key={k} className="px-3 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-slate-100">
                  {k}
                </span>
              ))}
            </div>
          </Card>

          <Card className="p-4 glass">
            <div className="font-semibold">Editor de Briefing</div>
            <div className="mt-2 text-xs text-slate-300/80">
              Você pode ajustar para o estilo do canal. Copie/cole o JSON ou copie o texto dos campos.
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
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
            </div>

            <div className="mt-3">
              <div className="text-xs text-slate-300/80 mb-2">Ângulo</div>
              <textarea
                value={draft.angulo}
                onChange={(e) => setDraft({ ...draft, angulo: e.target.value })}
                rows={7}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs text-slate-300/80 mb-2">Urgência</div>
                <input
                  value={draft.urgencia}
                  onChange={(e) => setDraft({ ...draft, urgencia: e.target.value })}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-300/80 mb-2">Por que agora</div>
                <input
                  value={draft.por_que_agora}
                  onChange={(e) => setDraft({ ...draft, por_que_agora: e.target.value })}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={onCarregarServidor}>
                Carregar servidor
              </Button>
              <Button variant="secondary" onClick={onSalvarServidor}>
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
              <Badge tone="neutral">is_real: {String(draft.is_real)}</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

