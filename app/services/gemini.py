"""
Serviço editorial — Gemini.

Regras de acesso à API:
  - get_editorial_angle  → leitura de cache APENAS. Se ausente, retorna
    estado "aguardando análise" sem chamar Gemini.
  - refresh_editorial    → chamado EXCLUSIVAMENTE pelo job POST /refresh.
    Consulta Gemini, salva cache.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re

import httpx

from app.core.cache import CacheStore
from app.core.config import Settings

logger = logging.getLogger("radar_bp.gemini")

REQUIRED_FIELDS = ("angulo", "titulo", "gancho", "urgencia", "formatos", "por_que_agora")

# Limita chamadas simultâneas (free tier: 15 RPM)
_GEMINI_SEMAPHORE = asyncio.Semaphore(2)

PROMPT_TEMPLATE = """\
Você é estrategista de conteúdo do Brasil Paralelo — \
canal conservador brasileiro com 6M+ inscritos, focado em história, política e soberania. \
Seu tom é sério, profundo e patriótico.

TEMA: {tema} | CATEGORIA: {categoria}
KEYWORDS EM ALTA: {keywords}
CONTEXTO: {descricao}
PEAK DE INTERESSE (Google Trends): {peak}

Responda APENAS com JSON válido (sem markdown, sem texto extra):
{{
  "angulo": "Como o Brasil Paralelo deve abordar — 2 frases, tom do canal",
  "titulo": "Título YouTube — direto, sem clickbait barato, máx 70 chars",
  "gancho": "Frase de abertura impactante, máximo 18 palavras",
  "urgencia": "alta",
  "formatos": ["Documentário"],
  "por_que_agora": "Motivo de urgência atual — 1 frase"
}}"""

_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest"]


class EditorialResult:
    def __init__(
        self,
        angulo: str,
        titulo: str,
        gancho: str,
        urgencia: str,
        formatos: list[str],
        por_que_agora: str,
        is_real: bool,
        pending: bool = False,
    ):
        self.angulo = angulo
        self.titulo = titulo
        self.gancho = gancho
        self.urgencia = urgencia
        self.formatos = formatos
        self.por_que_agora = por_que_agora
        self.is_real = is_real
        self.pending = pending

    def to_dict(self):
        return {
            "angulo": self.angulo,
            "titulo": self.titulo,
            "gancho": self.gancho,
            "urgencia": self.urgencia,
            "formatos": self.formatos,
            "por_que_agora": self.por_que_agora,
            "is_real": self.is_real,
            "pending": self.pending,
        }

    @classmethod
    def awaiting(cls) -> "EditorialResult":
        return cls(
            angulo="",
            titulo="",
            gancho="",
            urgencia="",
            formatos=[],
            por_que_agora="",
            is_real=False,
            pending=True,
        )


# ── Leitura de cache (on-demand, NUNCA chama Gemini) ─────────────────────────

async def get_editorial_angle(
    tema: str,
    categoria: str,
    keywords: list[str],
    descricao: str,
    cache: CacheStore,
    settings: Settings,
) -> EditorialResult:
    """Lê do cache. Se ausente, retorna estado 'aguardando' — NÃO chama Gemini."""
    hit = await cache.get(f"editorial:{tema}:{categoria}")
    if hit:
        d = hit["data"]
        return EditorialResult(
            **{k: d[k] for k in REQUIRED_FIELDS},
            is_real=hit["is_real"],
            pending=d.get("pending", False),
        )
    return EditorialResult.awaiting()


# ── Refresh (exclusivo do job agendado POST /refresh) ─────────────────────────

async def refresh_editorial(
    tema: str,
    categoria: str,
    keywords: list[str],
    descricao: str,
    peak: int,
    cache: CacheStore,
    settings: Settings,
) -> EditorialResult:
    """Consulta Gemini e atualiza o cache. Usar APENAS no job /refresh."""
    if not settings.gemini_api_key:
        logger.error("GEMINI_API_KEY não configurada.")
        return EditorialResult.awaiting()

    prompt = PROMPT_TEMPLATE.format(
        tema=tema,
        categoria=categoria,
        keywords=", ".join(keywords[:4]),
        descricao=descricao,
        peak=peak,
    )

    last_error = "erro desconhecido"
    async with _GEMINI_SEMAPHORE:
        for model in _MODELS:
            try:
                url = (
                    "https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{model}:generateContent?key={settings.gemini_api_key}"
                )
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        url,
                        json={
                            "contents": [{"parts": [{"text": prompt}]}],
                            "generationConfig": {"temperature": 0.65, "maxOutputTokens": 600},
                        },
                    )
                    resp.raise_for_status()

                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                text = re.sub(r"```(?:json)?\s*|\s*```", "", text).strip()
                data = json.loads(text)

                for field in REQUIRED_FIELDS:
                    if field not in data:
                        raise ValueError(f"Campo ausente: {field}")

                result = EditorialResult(
                    angulo=data["angulo"],
                    titulo=data["titulo"],
                    gancho=data["gancho"],
                    urgencia=data["urgencia"],
                    formatos=data["formatos"],
                    por_que_agora=data["por_que_agora"],
                    is_real=True,
                    pending=False,
                )
                await cache.set(
                    f"editorial:{tema}:{categoria}",
                    result.to_dict(),
                    is_real=True,
                    ttl=settings.ttl_editorial,
                )
                logger.info("Gemini OK: tema='%s' modelo='%s'", tema, model)
                return result

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    last_error = f"modelo '{model}' não disponível (404)"
                    continue
                if e.response.status_code == 429:
                    logger.warning("Gemini 429 no modelo '%s' — backoff 15s", model)
                    await asyncio.sleep(15)
                    continue
                safe_url = str(e.request.url).split("?")[0]
                last_error = f"HTTP {e.response.status_code} em {safe_url}"
                break
            except Exception as e:
                last_error = str(e)
                break

    logger.error("Gemini falhou para tema='%s': %s", tema, last_error)
    return EditorialResult.awaiting()
