"""
Testes básicos — rodam sem API keys (testam fallbacks e cache).

    pytest tests/ -v
"""

import asyncio
import pytest
from app.core.cache import CacheStore
from app.services.trends import get_interest_over_time, get_macro_trends, get_related_queries
from app.services.news import get_news
from app.services.gemini import get_editorial_angle, EditorialResult
from app.core.config import Settings


@pytest.fixture
async def cache(tmp_path):
    store = CacheStore()
    store.db_path = str(tmp_path / "test_cache.db")
    await store.init()
    yield store
    await store.close()


@pytest.fixture
def settings_no_keys():
    """Settings sem API keys — testa fallbacks."""
    return Settings(gemini_api_key="", serpapi_key="")


@pytest.mark.asyncio
async def test_cache_set_get(cache):
    await cache.set("test:key", {"foo": "bar"}, is_real=True, ttl=60)
    hit = await cache.get("test:key")
    assert hit is not None
    assert hit["data"]["foo"] == "bar"
    assert hit["is_real"] is True


@pytest.mark.asyncio
async def test_cache_miss_expired(cache):
    await cache.set("test:expired", {"x": 1}, is_real=True, ttl=-1)
    hit = await cache.get("test:expired")
    assert hit is None


@pytest.mark.asyncio
async def test_cache_invalidate(cache):
    await cache.set("news:bolsonaro", {"items": []}, is_real=False, ttl=60)
    await cache.set("news:lula", {"items": []}, is_real=False, ttl=60)
    await cache.set("trends:bolsonaro", {}, is_real=False, ttl=60)
    removed = await cache.invalidate("news:")
    assert removed == 2
    assert await cache.get("trends:bolsonaro") is not None


@pytest.mark.asyncio
async def test_trends_fallback_no_key(cache, settings_no_keys):
    result = await get_interest_over_time("Bolsonaro", "today 3-m", cache, settings_no_keys)
    assert result.is_real is False
    assert result.peak > 0
    assert len(result.points) > 0


@pytest.mark.asyncio
async def test_trends_related_no_key(cache, settings_no_keys):
    result = await get_related_queries("Bolsonaro", cache, settings_no_keys)
    assert result.is_real is False
    assert result.items == []


@pytest.mark.asyncio
async def test_news_fetch(cache, settings_no_keys):
    """Google News RSS é público — deve retornar is_real=True se houver conexão."""
    result = await get_news("brasil", 5, cache, settings_no_keys)
    # Pode falhar se sem internet; apenas valida estrutura
    assert isinstance(result.items, list)
    if result.is_real:
        assert all("title" in item and "link" in item for item in result.items)


@pytest.mark.asyncio
async def test_editorial_fallback_no_key(cache, settings_no_keys):
    result = await get_editorial_angle(
        "STF", "Política", ["STF"], "Supremo Tribunal Federal", cache, settings_no_keys
    )
    assert result.is_real is False
    assert "STF" in result.angulo or "GEMINI" in result.angulo.upper()


@pytest.mark.asyncio
async def test_trends_cached(cache, settings_no_keys):
    """Segunda chamada deve vir do cache (is_real permanece False)."""
    r1 = await get_interest_over_time("Lula", "today 3-m", cache, settings_no_keys)
    r2 = await get_interest_over_time("Lula", "today 3-m", cache, settings_no_keys)
    assert r1.peak == r2.peak
    assert r1.is_real == r2.is_real
