"""
Cache assíncrono em SQLite.
- Chave = string arbitrária (ex: "trends:Bolsonaro:today 3-m")
- Valor = JSON serializado
- TTL por entrada (segundos)
- is_real = se o dado veio de uma API real ou é fallback

Uso:
    cache = CacheStore()
    await cache.init()

    hit = await cache.get("minha_chave")
    if hit:
        return hit["data"], hit["is_real"]

    # ... busca real ...
    await cache.set("minha_chave", data, is_real=True, ttl=1800)
"""

from __future__ import annotations

import json
import time
import aiosqlite
from typing import Any
from app.core.config import get_settings


class CacheStore:
    def __init__(self):
        self.db_path = get_settings().cache_db_path
        self._conn: aiosqlite.Connection | None = None

    async def init(self):
        self._conn = await aiosqlite.connect(self.db_path)
        await self._conn.execute("""
            CREATE TABLE IF NOT EXISTS cache (
                key       TEXT PRIMARY KEY,
                value     TEXT NOT NULL,
                is_real   INTEGER NOT NULL DEFAULT 0,
                expires   REAL NOT NULL
            )
        """)
        await self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_expires ON cache(expires)"
        )
        await self._conn.commit()

    async def close(self):
        if self._conn:
            await self._conn.close()
            self._conn = None

    async def get(self, key: str) -> dict | None:
        """Retorna {"data": ..., "is_real": bool} ou None se expirado/inexistente."""
        now = time.time()
        async with self._conn.execute(
            "SELECT value, is_real FROM cache WHERE key = ? AND expires > ?",
            (key, now),
        ) as cur:
            row = await cur.fetchone()
        if row is None:
            return None
        return {"data": json.loads(row[0]), "is_real": bool(row[1])}

    async def set(
        self, key: str, data: Any, *, is_real: bool, ttl: int
    ) -> None:
        """Armazena dado com TTL. Sobrescreve se já existir."""
        expires = time.time() + ttl
        await self._conn.execute(
            """
            INSERT INTO cache (key, value, is_real, expires)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE
              SET value=excluded.value,
                  is_real=excluded.is_real,
                  expires=excluded.expires
            """,
            (key, json.dumps(data, default=str), int(is_real), expires),
        )
        await self._conn.commit()

    async def invalidate(self, prefix: str) -> int:
        """Remove todas as entradas cujo key começa com `prefix`. Retorna qtd removida."""
        cur = await self._conn.execute(
            "DELETE FROM cache WHERE key LIKE ?", (prefix + "%",)
        )
        await self._conn.commit()
        return cur.rowcount

    async def purge_expired(self) -> int:
        """Remove entradas expiradas. Chame periodicamente (ou no startup)."""
        cur = await self._conn.execute(
            "DELETE FROM cache WHERE expires <= ?", (time.time(),)
        )
        await self._conn.commit()
        return cur.rowcount

    async def stats(self) -> dict:
        async with self._conn.execute(
            "SELECT COUNT(*), SUM(is_real), MIN(expires), MAX(expires) FROM cache WHERE expires > ?",
            (time.time(),),
        ) as cur:
            row = await cur.fetchone()
        return {
            "total": row[0] or 0,
            "real": row[1] or 0,
            "oldest_expires": row[2],
            "newest_expires": row[3],
        }


# Instância global — inicializada no lifespan do FastAPI
_store: CacheStore | None = None


def get_cache() -> CacheStore:
    if _store is None:
        raise RuntimeError("CacheStore não inicializado. Verifique o lifespan.")
    return _store


async def init_cache() -> CacheStore:
    global _store
    _store = CacheStore()
    await _store.init()
    await _store.purge_expired()
    return _store


async def close_cache():
    global _store
    if _store:
        await _store.close()
        _store = None