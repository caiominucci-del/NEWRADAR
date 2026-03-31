"""
Serviço de vídeos — YouTube RSS (sem API key) + fallback Google News.

Funções públicas:
    get_channel_videos(channel, cache, settings) → VideosResult
"""

from __future__ import annotations

import re
from datetime import datetime

import feedparser

from app.core.cache import CacheStore
from app.core.config import Settings


class VideosResult:
    def __init__(self, items: list[dict], source: str, is_real: bool):
        self.items = items   # [{"title", "link", "published_at", "thumbnail"?}, ...]
        self.source = source # "youtube_rss" | "google_news" | ""
        self.is_real = is_real

    def to_dict(self):
        return {"items": self.items, "source": self.source, "is_real": self.is_real}


def _clean(raw: str) -> str:
    return re.sub(r"<[^>]+>", "", str(raw)).strip()


def _parse_date(entry) -> str:
    try:
        pub = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
        if pub:
            return datetime(*pub[:5]).strftime("%Y-%m-%dT%H:%M:00")
    except Exception:
        pass
    return ""


def _thumbnail(entry) -> str:
    """Tenta extrair thumbnail do feed YouTube."""
    try:
        media = getattr(entry, "media_thumbnail", None)
        if media:
            return media[0].get("url", "")
    except Exception:
        pass
    return ""


async def get_channel_videos(
    channel_name: str,
    channel_query: str,
    youtube_id: str | None,
    max_items: int,
    cache: CacheStore,
    settings: Settings,
) -> VideosResult:
    cache_key = f"youtube:{channel_name}:{max_items}"
    hit = await cache.get(cache_key)
    if hit:
        d = hit["data"]
        return VideosResult(d["items"], d["source"], hit["is_real"])

    result = _fetch_videos(channel_name, channel_query, youtube_id, max_items)
    await cache.set(cache_key, result.to_dict(), is_real=result.is_real, ttl=settings.ttl_youtube)
    return result


def _fetch_videos(
    channel_name: str,
    channel_query: str,
    youtube_id: str | None,
    max_items: int,
) -> VideosResult:
    # 1. YouTube RSS direto (sem quota, sem key)
    if youtube_id:
        try:
            url = f"https://www.youtube.com/feeds/videos.xml?channel_id={youtube_id}"
            feed = feedparser.parse(url)
            if feed.entries:
                items = [
                    {
                        "title": _clean(getattr(e, "title", "")),
                        "link": getattr(e, "link", "#") or "#",
                        "published_at": _parse_date(e),
                        "thumbnail": _thumbnail(e),
                    }
                    for e in feed.entries[:max_items]
                ]
                return VideosResult(items, "youtube_rss", is_real=True)
        except Exception:
            pass

    # 2. Fallback: Google News com nome do canal
    try:
        q = channel_query.replace(" ", "+")
        url = f"https://news.google.com/rss/search?q={q}&hl=pt-BR&gl=BR&ceid=BR:pt-419"
        feed = feedparser.parse(url)
        if feed.entries:
            items = [
                {
                    "title": _clean(getattr(e, "title", "")),
                    "link": getattr(e, "link", "#") or "#",
                    "published_at": _parse_date(e),
                    "thumbnail": "",
                }
                for e in feed.entries[:max_items]
            ]
            return VideosResult(items, "google_news", is_real=True)
    except Exception:
        pass

    return VideosResult([], "", is_real=False)
