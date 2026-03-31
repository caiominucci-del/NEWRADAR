"""
Serviço de notícias — Google News RSS (público, sem API key).

Funções públicas:
    get_news(keyword, max_items, cache, settings) → NewsResult
"""

from __future__ import annotations

import re
from datetime import datetime

import feedparser

from app.core.cache import CacheStore
from app.core.config import Settings


class NewsResult:
    def __init__(self, items: list[dict], is_real: bool):
        self.items = items   # [{"title", "link", "published_at"}, ...]
        self.is_real = is_real

    def to_dict(self):
        return {"items": self.items, "is_real": self.is_real}


def _clean_title(raw: str) -> str:
    return re.sub(r"<[^>]+>", "", str(raw)).strip() or "Sem título"


def _parse_date(entry) -> str:
    try:
        pub = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
        if pub:
            return datetime(*pub[:5]).strftime("%Y-%m-%dT%H:%M:00")
    except Exception:
        pass
    return ""


async def get_news(
    keyword: str,
    max_items: int,
    cache: CacheStore,
    settings: Settings,
) -> NewsResult:
    cache_key = f"news:{keyword}:{max_items}"
    hit = await cache.get(cache_key)
    if hit:
        return NewsResult(hit["data"]["items"], hit["is_real"])

    result = _fetch_news(keyword, max_items)
    await cache.set(cache_key, result.to_dict(), is_real=result.is_real, ttl=settings.ttl_news)
    return result


def _fetch_news(keyword: str, max_items: int) -> NewsResult:
    try:
        q = keyword.replace(" ", "+")
        url = f"https://news.google.com/rss/search?q={q}&hl=pt-BR&gl=BR&ceid=BR:pt-419"
        feed = feedparser.parse(url)
        entries = feed.entries[:max_items]
        if not entries:
            return NewsResult([], is_real=False)

        items = [
            {
                "title": _clean_title(getattr(e, "title", "")),
                "link": getattr(e, "link", "#") or "#",
                "published_at": _parse_date(e),
            }
            for e in entries
        ]
        return NewsResult(items, is_real=True)
    except Exception:
        return NewsResult([], is_real=False)
