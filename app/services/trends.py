"""
Serviço de Trends — SerpAPI Google Trends + fallback determinístico.

Funções públicas:
    get_interest_over_time(keyword, window, cache, settings) → InterestResult
    get_related_queries(keyword, cache, settings)           → RelatedResult
    get_macro_trends(cache, settings)                       → MacroResult
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Literal

import httpx
import numpy as np

from app.core.cache import CacheStore
from app.core.config import Settings

logger = logging.getLogger("radar_bp.trends")

# ── Tipos de retorno ──────────────────────────────────────────────────────────

Window = Literal["now 7-d", "today 1-m", "today 3-m"]


class InterestResult:
    def __init__(self, points: list[dict], peak: int, is_real: bool):
        self.points = points   # [{"date": "YYYY-MM-DD", "value": int}, ...]
        self.peak = peak
        self.is_real = is_real

    def to_dict(self):
        return {"points": self.points, "peak": self.peak, "is_real": self.is_real}


class RelatedResult:
    def __init__(self, items: list[dict], kind: str, is_real: bool):
        self.items = items     # [{"query": str, "value": int}, ...]
        self.kind = kind       # "rising" | "top" | ""
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


def _fallback_curve(keyword: str, n: int = 13) -> list[dict]:
    """Curva estimada reproduzível para o mesmo keyword. Marcada como is_real=False."""
    seed = abs(hash(keyword)) % 9_999
    rng = np.random.default_rng(seed)
    base = 35 + (seed % 35)
    raw = base + np.cumsum(rng.standard_normal(n) * 7)
    vals = [max(5, min(100, int(v))) for v in raw]
    dates = [
        datetime.fromtimestamp(
            datetime.today().timestamp() - (n - 1 - i) * 7 * 86400
        ).strftime("%Y-%m-%d")
        for i in range(n)
    ]
    return [{"date": d, "value": v} for d, v in zip(dates, vals)]


# ── Funções públicas ──────────────────────────────────────────────────────────

async def get_interest_over_time(
    keyword: str,
    window: Window,
    cache: CacheStore,
    settings: Settings,
) -> InterestResult:
    cache_key = f"trends:interest:{keyword}:{window}"
    hit = await cache.get(cache_key)
    if hit:
        d = hit["data"]
        return InterestResult(d["points"], d["peak"], hit["is_real"])

    result = await _fetch_interest(keyword, window, settings)
    await cache.set(cache_key, result.to_dict(), is_real=result.is_real, ttl=settings.ttl_trends)
    return result


async def _fetch_interest(keyword: str, window: Window, settings: Settings) -> InterestResult:
    if not settings.serpapi_key:
        points = _fallback_curve(keyword)
        return InterestResult(points, max(p["value"] for p in points), is_real=False)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
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

        return InterestResult(points, peak, is_real=True)

    except httpx.HTTPStatusError as e:
        logger.warning("SerpAPI HTTP %s para keyword='%s': %s", e.response.status_code, keyword, e.response.text[:200])
        points = _fallback_curve(keyword)
        return InterestResult(points, max(p["value"] for p in points), is_real=False)
    except Exception as e:
        logger.warning("SerpAPI erro para keyword='%s': %s", keyword, e)
        points = _fallback_curve(keyword)
        return InterestResult(points, max(p["value"] for p in points), is_real=False)


async def get_related_queries(
    keyword: str,
    cache: CacheStore,
    settings: Settings,
) -> RelatedResult:
    cache_key = f"trends:related:{keyword}"
    hit = await cache.get(cache_key)
    if hit:
        d = hit["data"]
        return RelatedResult(d["items"], d["kind"], hit["is_real"])

    result = await _fetch_related(keyword, settings)
    await cache.set(cache_key, result.to_dict(), is_real=result.is_real, ttl=settings.ttl_trends)
    return result


async def _fetch_related(keyword: str, settings: Settings) -> RelatedResult:
    if not settings.serpapi_key:
        return RelatedResult([], "", is_real=False)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
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
                    for r in rows[: settings.max_seo_items]
                ]
                return RelatedResult(items, kind, is_real=True)

        return RelatedResult([], "", is_real=False)

    except httpx.HTTPStatusError as e:
        logger.warning("SerpAPI related HTTP %s para keyword='%s': %s", e.response.status_code, keyword, e.response.text[:200])
        return RelatedResult([], "", is_real=False)
    except Exception as e:
        logger.warning("SerpAPI related erro para keyword='%s': %s", keyword, e)
        return RelatedResult([], "", is_real=False)


async def get_macro_trends(cache: CacheStore, settings: Settings) -> MacroResult:
    cache_key = "trends:macro:BR"
    hit = await cache.get(cache_key)
    if hit:
        return MacroResult(hit["data"]["topics"], hit["is_real"])

    result = await _fetch_macro()
    await cache.set(cache_key, result.to_dict(), is_real=result.is_real, ttl=settings.ttl_macro)
    return result


async def _fetch_macro() -> MacroResult:
    try:
        import feedparser  # leve, síncrono — ok em thread de I/O

        feed = feedparser.parse(
            "https://trends.google.com/trends/trendingsearches/daily/rss?geo=BR"
        )
        topics = [e.title for e in feed.entries if getattr(e, "title", "")][:10]
        if topics:
            return MacroResult(topics, is_real=True)
    except Exception:
        pass
    return MacroResult([], is_real=False)