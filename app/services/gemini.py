"""
Serviço editorial — Gemini 1.5 Flash.

Gera ângulo editorial, título, gancho e urgência para um tema.
Lança exceção limpa se a API key não estiver configurada ou se a resposta for inválida.

Funções públicas:
    get_editorial_angle(topic, cache, settings) → EditorialResult
"""

from __future__ import annotations

import json
import re

import httpx

from app.core.cache import CacheStore
from app.core.config import Settings


REQUIRED_FIELDS = ("angulo", "titulo", "gancho", "urgencia", "formatos", "por_que_agora")

PROMPT_TEMPLATE = """\
Você é estrategista de conteúdo do Brasil Paralelo — \
canal conservador brasileiro com 6M+ inscritos, focado em história, política e soberania. \
Seu tom é sério, profundo e patriótico.

TEMA: {tema} | CATEGORIA: {categoria}
KEYWORDS EM ALTA: {keywords}
CONTEXTO: {descricao}

Responda APENAS com JSON válido (sem markdown, sem texto extra):
{{
  "angulo": "Como o Brasil Paralelo deve abordar — 2 frases, tom do canal",
  "titulo": "Título YouTube — direto, sem clickbait barato, máx 70 chars",
  "gancho": "Frase de abertura impactante, máximo 18 palavras",
  "urgencia": "alta",
  "formatos": ["Documentário"],
  "por_que_agora": "Motivo de urgência atual — 1 frase"
}}"""


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
    ):
        self.angulo = angulo
        self.titulo = titulo
        self.gancho = gancho
        self.urgencia = urgencia
        self.formatos = formatos
        self.por_que_agora = por_que_agora
        self.is_real = is_real

    def to_dict(self):
        return {
            "angulo": self.angulo,
            "titulo": self.titulo,
            "gancho": self.gancho,
            "urgencia": self.urgencia,
            "formatos": self.formatos,
            "por_que_agora": self.por_que_agora,
            "is_real": self.is_real,
        }

    @classmethod
    def fallback(cls, tema: str, reason: str = "") -> "EditorialResult":
        if not reason:
            reason = "A API Gemini não foi chamada. Verifique a configuração e os logs."

        return cls(
            angulo=f"Simulação para '{tema}'. Razão: {reason}",
            titulo=f"A verdade sobre {tema} que ninguém conta (simulado)",
            gancho=f"O que está acontecendo com {tema} vai mudar o Brasil (simulado).",
            urgencia="media",
            formatos=["Análise", "Documentário"],
            por_que_agora="Tema em alta nas buscas brasileiras (simulado).",
            is_real=False,
        )


async def get_editorial_angle(
    tema: str,
    categoria: str,
    keywords: list[str],
    descricao: str,
    cache: CacheStore,
    settings: Settings,
) -> EditorialResult:
    cache_key = f"editorial:{tema}:{categoria}"
    hit = await cache.get(cache_key)
    if hit:
        d = hit["data"]
        return EditorialResult(**{k: d[k] for k in REQUIRED_FIELDS}, is_real=hit["is_real"])

    result = await _fetch_editorial(tema, categoria, keywords, descricao, settings)
    await cache.set(
        cache_key, result.to_dict(), is_real=result.is_real, ttl=settings.ttl_editorial
    )
    return result


async def _fetch_editorial(
    tema: str,
    categoria: str,
    keywords: list[str],
    descricao: str,
    settings: Settings,
) -> EditorialResult:
    if not settings.gemini_api_key:
        return EditorialResult.fallback(tema, reason="GEMINI_API_KEY não configurada.")

    prompt = PROMPT_TEMPLATE.format(
        tema=tema,
        categoria=categoria,
        keywords=", ".join(keywords[:4]),
        descricao=descricao,
    )

    # Modelos em ordem de preferência (mais novo → mais antigo como fallback)
    _MODELS = [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
    ]

    last_error: str = "erro desconhecido"
    for model in _MODELS:
        try:
            url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model}:generateContent?key={settings.gemini_api_key}"
            )
            async with httpx.AsyncClient(timeout=25) as client:
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
                    raise ValueError(f"Campo ausente na resposta Gemini: {field}")

            return EditorialResult(
                angulo=data["angulo"],
                titulo=data["titulo"],
                gancho=data["gancho"],
                urgencia=data["urgencia"],
                formatos=data["formatos"],
                por_que_agora=data["por_que_agora"],
                is_real=True,
            )
        except httpx.HTTPStatusError as e:
            # 404 = modelo indisponível nessa key → tenta o próximo
            if e.response.status_code == 404:
                last_error = f"modelo '{model}' não disponível (404)"
                continue
            # Outros erros HTTP: sanitiza URL para não vazar a API key
            safe_url = str(e.request.url).split("?")[0]
            last_error = f"HTTP {e.response.status_code} em {safe_url}"
            break
        except Exception as e:
            last_error = str(e)
            break

    return EditorialResult.fallback(tema, reason=f"Erro na API Gemini: {last_error}")
