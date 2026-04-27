"""
Serviço de Trends — SerpAPI Google Trends.

Regras de acesso à API (proteção de quota):
  - get_interest_over_time / get_related_queries  → leitura de cache APENAS.
    Se não há cache, retornam InterestResult/RelatedResult vazio (is_real=False).
    NUNCA chamam SerpAPI em fluxo on-demand.
  - refresh_interest / refresh_related             → chamados EXCLUSIVAMENTE
    pelo endpoint POST /refresh (job agendado). Consultam SerpAPI, salvam cache.

Isso garante que o limite de 100 buscas/mês do free tier só é consumido
pelo job diário agendado, nunca por navegação do usuário.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Literal

import httpx

from app.core.cache import CacheStore
from app.core.config import Settings

logger = logging.getLogger("radar_bp.trends")

Window = Literal["now 7-d", "today 1-m", "today 3-m"]


# ── Tipos de retorno ──────────────────────────────────────────────────────────

class InterestResult:
    def __init__(self, points: list[dict], peak: int, is_real: bool):
        self.points = points
        self.peak = peak
        self.is_real = is_real

    def to_dict(self):
        return {"points": self.points, "peak": self.peak, "is_real": self.is_real}


class RelatedResult:
    def __init__(self, items: list[dict], kind: str, is_real: bool):
        self.items = items
        self.kind = kind
        self.is_real = is_real

    def to_dict(self):
        return {"items": self.items, "kind": self.kind, "is_real": self.is_real}


class MacroResult:
    def __init__(self, topics: list[str], is_real: bool):
        self.topics = topics
        self.is_real = is_real

    def to_dict(self):
        return {"topics": self.topics, "is_real": self.is_real}


# ── Helpers de parsing ────────────────────────────────────────────────────────

def _parse_serp_date(date_str: str) -> str:
    """Converte 'Dec 29, 2024' ou 'Dec 29 – Jan 4, 2024' → 'YYYY-MM-DD'."""
    try:
        clean = date_str.split("–")[0].strip()
        year = date_str.split(",")[-1].strip() if "," in date_str else date_str[-4:]
        base = re.sub(r",", "", clean).strip()
        for fmt in ("%b %d %Y", "%B %d %Y"):
            try:
                return datetime.strptime(f"{base} {year}", fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
    except Exception:
        pass
    return datetime.today().strftime("%Y-%m-%d")


# ── Leitura de cache (on-demand, NUNCA chama SerpAPI) ─────────────────────────

async def get_interest_over_time(
    keyword: str,
    window: Window,
    cache: CacheStore,
    settings: Settings,
) -> InterestResult:
    """Lê do cache. Se ausente, retorna vazio — NÃO chama SerpAPI."""
    hit = await cache.get(f"trends:interest:{keyword}:{window}")
    if hit:
        d = hit["data"]
        return InterestResult(d["points"], d["peak"], hit["is_real"])
    return InterestResult([], 0, is_real=False)


async def get_related_queries(
    keyword: str,
    cache: CacheStore,
    settings: Settings,
) -> RelatedResult:
    """Lê do cache. Se ausente, retorna vazio — NÃO chama SerpAPI."""
    hit = await cache.get(f"trends:related:{keyword}")
    if hit:
        d = hit["data"]
        return RelatedResult(d["items"], d["kind"], hit["is_real"])
    return RelatedResult([], "", is_real=False)


async def get_macro_trends(cache: CacheStore, settings: Settings) -> MacroResult:
    """Macro trends via RSS do Google Trends (gratuito, sem key)."""
    cache_key = "trends:macro:BR"
    hit = await cache.get(cache_key)
    if hit:
        return MacroResult(hit["data"]["topics"], hit["is_real"])

    result = await _fetch_macro()
    await cache.set(cache_key, result.to_dict(), is_real=result.is_real, ttl=settings.ttl_macro)
    return result


# ── Refresh (exclusivo do job agendado POST /refresh) ─────────────────────────

async def refresh_interest(
    keyword: str,
    window: Window,
    cache: CacheStore,
    settings: Settings,
) -> InterestResult:
    """Consulta SerpAPI e atualiza o cache. Usar APENAS no job /refresh."""
    if not settings.serpapi_key:
        logger.error("SERPAPI_KEY não configurada — impossível atualizar trends.")
        return InterestResult([], 0, is_real=False)

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                "https://serpapi.com/search.json",
                params={
                    "engine": "google_trends",
                    "q": keyword,
                    "data_type": "TIMESERIES",
                    "date": window,
                    "geo": "BR",
                    "hl": "pt",
                    "api_key": settings.serpapi_key,
                },
            )
            resp.raise_for_status()
            timeline = resp.json().get("interest_over_time", {}).get("timeline_data", [])

        if not timeline:
            raise ValueError("SerpAPI retornou timeline vazia")

        points = []
        for pt in timeline:
            val = pt.get("values", [{}])[0].get("extracted_value", 0)
            points.append({"date": _parse_serp_date(pt.get("date", "")), "value": int(val)})

        peak = max(p["value"] for p in points) if points else 0
        if peak == 0:
            raise ValueError("Todos os valores são zero")

        result = InterestResult(points, peak, is_real=True)
        await cache.set(
            f"trends:interest:{keyword}:{window}",
            result.to_dict(),
            is_real=True,
            ttl=settings.ttl_trends,
        )
        logger.info("SerpAPI OK: keyword='%s' peak=%d", keyword, peak)
        return result

    except httpx.HTTPStatusError as e:
        logger.error(
            "SerpAPI HTTP %s para keyword='%s': %s",
            e.response.status_code, keyword, e.response.text[:300],
        )
        return InterestResult([], 0, is_real=False)
    except Exception as e:
        logger.error("SerpAPI erro para keyword='%s': %s", keyword, e)
        return InterestResult([], 0, is_real=False)


async def refresh_related(
    keyword: str,
    cache: CacheStore,
    settings: Settings,
) -> RelatedResult:
    """Consulta SerpAPI (related queries) e atualiza o cache. APENAS no job /refresh."""
    if not settings.serpapi_key:
        return RelatedResult([], "", is_real=False)

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                "https://serpapi.com/search.json",
                params={
                    "engine": "google_trends",
                    "q": keyword,
                    "data_type": "RELATED_QUERIES",
                    "date": "now 7-d",
                    "geo": "BR",
                    "hl": "pt",
                    "api_key": settings.serpapi_key,
                },
            )
            resp.raise_for_status()
            related = resp.json().get("related_queries", {})

        for kind in ("rising", "top"):
            rows = related.get(kind, [])
            if rows:
                items = [
                    {"query": r.get("query", ""), "value": r.get("extracted_value", 0)}
                    for r in rows[:settings.max_seo_items]
                ]
                result = RelatedResult(items, kind, is_real=True)
                await cache.set(
                    f"trends:related:{keyword}",
                    result.to_dict(),
                    is_real=True,
                    ttl=settings.ttl_trends,
                )
                return result

        return RelatedResult([], "", is_real=False)

    except Exception as e:
        logger.error("SerpAPI related erro para keyword='%s': %s", keyword, e)
        return RelatedResult([], "", is_real=False)


# ── Macro Trends (RSS gratuito) ───────────────────────────────────────────────

async def _fetch_macro() -> MacroResult:
    try:
        import feedparser
        feed = feedparser.parse(
            "https://trends.google.com/trends/trendingsearches/daily/rss?geo=BR"
        )
        topics = [e.title for e in feed.entries if getattr(e, "title", "")][:10]
        if topics:
            return MacroResult(topics, is_real=True)
    except Exception as e:
        logger.warning("Google Trends RSS erro: %s", e)
    return MacroResult([], is_real=False)
