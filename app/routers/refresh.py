"""
Endpoint POST /refresh — job de atualização diária.

Chamado exclusivamente pelo GitHub Actions às 07h BRT.
Nunca deve ser chamado pelo frontend ou pelo usuário diretamente.

Fluxo por tópico:
  1. SerpAPI TIMESERIES → cache (1 chamada de API por tópico)
  2. Google News RSS    → cache (gratuito, sem limite)
  3. Gemini editorial  → cache (1 chamada por tópico, só se trends OK)

Budget SerpAPI: 4 tópicos × 1 chamada × 30 dias = 120/mês.
Ajuste TTL_TRENDS para 86400 (24h) para garantir que o dado dure até o próximo refresh.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.auth import require_admin
from app.core.cache import CacheStore, get_cache
from app.core.config import Settings, get_settings
from app.routers.topics import TOPICS_DEFAULT, _primary_keyword
from app.services.gemini import refresh_editorial
from app.services.news import refresh_news
from app.services.trends import refresh_interest

logger = logging.getLogger("radar_bp.refresh")

router = APIRouter(tags=["refresh"])

_WINDOW = "today 3-m"


@router.post("/refresh", summary="Atualiza todos os dados (job diário)")
async def trigger_refresh(
    _user=Depends(require_admin),
    cache: CacheStore = Depends(get_cache),
    settings: Settings = Depends(get_settings),
):
    """
    Executa o pipeline completo de atualização:
    SerpAPI → News → Gemini para cada tópico.
    Retorna relatório detalhado com status de cada tópico.
    """
    started_at = datetime.now(timezone.utc)
    logger.info("=== REFRESH INICIADO: %s ===", started_at.isoformat())

    topic_results = []
    serpapi_calls = 0
    gemini_calls = 0

    for topic in TOPICS_DEFAULT:
        keyword = _primary_keyword(topic)
        tema = topic["tema"]
        logger.info("Processando tópico: %s (keyword: %s)", tema, keyword)

        # 1. SerpAPI TIMESERIES (pago, conta no budget)
        trend = await refresh_interest(keyword, _WINDOW, cache, settings)
        if trend.is_real:
            serpapi_calls += 1

        # 2. Google News RSS (gratuito)
        news = await refresh_news(keyword, settings.max_news_items, cache, settings)

        # 3. Gemini — roda sempre (usa peak=0 quando SerpAPI não retornou dados)
        editorial_ok = False
        editorial_error = None
        editorial = await refresh_editorial(
            tema=tema,
            categoria=topic["categoria"],
            keywords=topic.get("keywords") or [],
            descricao=topic["descricao"],
            peak=trend.peak,  # 0 se SerpAPI falhou — Gemini usa o contexto textual mesmo assim
            cache=cache,
            settings=settings,
        )
        editorial_ok = editorial.is_real
        if editorial.is_real:
            gemini_calls += 1
        # Pequena pausa entre tópicos para respeitar rate limit do Gemini
        await asyncio.sleep(2)

        topic_results.append({
            "tema": tema,
            "keyword": keyword,
            "trend": {"ok": trend.is_real, "peak": trend.peak, "points": len(trend.points)},
            "news": {"ok": news.is_real, "items": len(news.items)},
            "editorial": {"ok": editorial_ok},
        })

    finished_at = datetime.now(timezone.utc)
    duration_s = round((finished_at - started_at).total_seconds(), 1)

    # Salva metadados do último refresh (visível em GET /status)
    meta = {
        "refreshed_at": finished_at.isoformat(),
        "duration_seconds": duration_s,
        "topics_total": len(topic_results),
        "topics_ok": sum(1 for t in topic_results if t["trend"]["ok"]),
        "serpapi_calls_used": serpapi_calls,
        "gemini_calls_used": gemini_calls,
    }
    await cache.set("meta:last_refresh", meta, is_real=True, ttl=86400 * 7)

    logger.info(
        "=== REFRESH CONCLUÍDO em %.1fs | SerpAPI: %d calls | Gemini: %d calls ===",
        duration_s, serpapi_calls, gemini_calls,
    )

    return {
        "status": "ok",
        "refreshed_at": finished_at.isoformat(),
        "duration_seconds": duration_s,
        "budget": {
            "serpapi_calls_this_run": serpapi_calls,
            "gemini_calls_this_run": gemini_calls,
            "serpapi_estimate_monthly": serpapi_calls * 30,
        },
        "topics": topic_results,
    }
