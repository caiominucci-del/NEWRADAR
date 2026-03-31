"""
Dados dos temas padrão do Radar BP e helpers de pontuação.
Centralizado aqui para o router importar sem duplicar constantes.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException

from app.core.cache import CacheStore, get_cache
from app.core.config import Settings, get_settings
from app.services.gemini import get_editorial_angle
from app.services.news import get_news
from app.services.trends import get_interest_over_time

TOPICS_DEFAULT: list[dict] = [
    {
        "id": "bolsonaro",
        "tema": "Bolsonaro",
        "categoria": "Política",
        "keywords": ["Bolsonaro", "Jair Bolsonaro"],
        "canais": ["Jovem Pan", "Gazeta do Povo", "Nikolas Ferreira", "Eduardo Bolsonaro"],
        "descricao": "Ex-presidente e maior liderança da direita brasileira.",
        "emoji": "🇧🇷",
        "cor": "#2563eb",
    },
    {
        "id": "lula",
        "tema": "Lula",
        "categoria": "Política",
        "keywords": ["Lula", "governo Lula"],
        "canais": ["GloboNews", "Folha de SP", "PT Partido", "Carta Capital"],
        "descricao": "Governo Lula, PT e políticas do executivo federal.",
        "emoji": "🏛️",
        "cor": "#dc2626",
    },
    {
        "id": "economia",
        "tema": "Economia Brasil",
        "categoria": "Economia",
        "keywords": ["economia brasil", "dólar câmbio"],
        "canais": ["Mises Brasil", "InfoMoney", "Instituto Millenium", "B3"],
        "descricao": "Câmbio, inflação, reforma tributária e mercado financeiro.",
        "emoji": "📊",
        "cor": "#059669",
    },
    {
        "id": "stf",
        "tema": "STF",
        "categoria": "Política",
        "keywords": ["STF supremo", "Alexandre Moraes"],
        "canais": ["Consultor Jurídico", "Jota Info", "Jovem Pan", "Migalhas"],
        "descricao": "Supremo Tribunal Federal, decisões e impacto político-jurídico.",
        "emoji": "⚖️",
        "cor": "#7c3aed",
    },
]

CHANNELS_NATIONAL: list[dict] = [
    {"nome": "Jovem Pan News",  "query": "Jovem Pan",           "flag": "🇧🇷", "foco": "Notícias e Política",    "yt_id": "UCmq_n2-MFRGOU7C6JIzZOIg"},
    {"nome": "Gazeta do Povo",  "query": "Gazeta Povo",         "flag": "🇧🇷", "foco": "Jornalismo Conservador", "yt_id": None},
    {"nome": "MetaPolitica 17", "query": "MetaPolitica Brasil", "flag": "🇧🇷", "foco": "Análise Política",       "yt_id": None},
    {"nome": "Renova Mídia",    "query": "Renova Midia",        "flag": "🇧🇷", "foco": "Mídia Alternativa",      "yt_id": None},
    {"nome": "Senso Incomum",   "query": "Senso Incomum",       "flag": "🇧🇷", "foco": "Direita Liberal",        "yt_id": None},
]

CHANNELS_INTERNATIONAL: list[dict] = [
    {"nome": "PragerU",           "query": "PragerU",           "flag": "🇺🇸", "foco": "Conservadorismo Americano", "yt_id": "UCZWlSUNDvCCS1hBiXV0zKcA"},
    {"nome": "Daily Wire",        "query": "Daily Wire",        "flag": "🇺🇸", "foco": "Mídia Conservadora",        "yt_id": None},
    {"nome": "Tucker Carlson",    "query": "Tucker Carlson",    "flag": "🇺🇸", "foco": "Soberania e Populismo",     "yt_id": "UCkSDhOeXMo2hWhcxnFrJNVQ"},
    {"nome": "Jordan Peterson",   "query": "Jordan B Peterson", "flag": "🇨🇦", "foco": "Psicologia e Valores",      "yt_id": "UCL_f53ZEJxp8TtlOkHwMV9Q"},
    {"nome": "Hillsdale College", "query": "Hillsdale College", "flag": "🇺🇸", "foco": "Educação e Liberdade",      "yt_id": "UCnJ1r9DKBacFCRV5DJSPziA"},
]


def calculate_score(peak_trend: int, n_news: int) -> int:
    """
    Score de oportunidade 0-100.
    Alta tendência + baixa saturação de cobertura = maior score.
    """
    saturation = min(n_news / 15.0, 1.0) * 100
    score = peak_trend * 0.65 + (100 - saturation) * 0.35
    return max(0, min(100, int(score)))


def get_topic_by_id(topic_id: str) -> dict | None:
    return next((t for t in TOPICS_DEFAULT if t["id"] == topic_id), None)


# ── Router (FastAPI) ─────────────────────────────────────────────────────

router = APIRouter(prefix="/topics", tags=["topics"])


def _primary_keyword(topic: dict) -> str:
    keywords = topic.get("keywords") or []
    return keywords[0] if keywords else (topic.get("tema") or "")


async def _build_topic_summary(
    topic: dict,
    *,
    cache: CacheStore,
    settings: Settings,
    window: str = "today 3-m",
) -> dict:
    keyword = _primary_keyword(topic)
    if not keyword:
        return {**topic, "score": 0, "trend": {"peak": 0, "is_real": False}, "news": {"count": 0, "is_real": False}}

    trend = await get_interest_over_time(keyword, window, cache, settings)
    news = await get_news(keyword, settings.max_news_items, cache, settings)

    score = calculate_score(trend.peak, len(news.items))
    return {
        **topic,
        "score": score,
        "trend": {"peak": trend.peak, "is_real": trend.is_real},
        "news": {"count": len(news.items), "is_real": news.is_real},
    }


@router.get("")
async def list_topics(
    cache: CacheStore = Depends(get_cache),
    settings: Settings = Depends(get_settings),
):
    """Lista temas com score de oportunidade."""
    window = "today 3-m"

    tasks = [
        _build_topic_summary(t, cache=cache, settings=settings, window=window)
        for t in TOPICS_DEFAULT
    ]
    results = await asyncio.gather(*tasks)
    results.sort(key=lambda x: x.get("score", 0), reverse=True)
    return {"topics": results}


@router.get("/{topic_id}")
async def get_topic(
    topic_id: str,
    cache: CacheStore = Depends(get_cache),
    settings: Settings = Depends(get_settings),
):
    """Tema completo: trend + news + editorial IA."""
    topic = get_topic_by_id(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Tema não encontrado")

    keyword = _primary_keyword(topic)
    window = "today 3-m"

    trend_task = get_interest_over_time(keyword, window, cache, settings)
    news_task = get_news(keyword, settings.max_news_items, cache, settings)
    editorial_task = get_editorial_angle(
        topic["tema"],
        topic["categoria"],
        topic.get("keywords") or [],
        topic["descricao"],
        cache,
        settings,
    )

    trend, news, editorial = await asyncio.gather(
        trend_task,
        news_task,
        editorial_task,
    )

    score = calculate_score(trend.peak, len(news.items))

    return {
        "topic": {
            **topic,
            "trend": trend.to_dict(),
            "news": news.to_dict(),
            "editorial": editorial.to_dict(),
            "score": score,
        }
    }


@router.get("/{topic_id}/score")
async def get_topic_score(
    topic_id: str,
    cache: CacheStore = Depends(get_cache),
    settings: Settings = Depends(get_settings),
):
    """Score rápido (para polling/ordenar no frontend)."""
    topic = get_topic_by_id(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Tema não encontrado")

    result = await _build_topic_summary(topic, cache=cache, settings=settings)
    return {"topic": result}
