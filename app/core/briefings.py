from __future__ import annotations

import json
import time
from typing import Any

import aiosqlite

from app.core.config import get_settings


class BriefingStore:
    def __init__(self):
        self.db_path = get_settings().cache_db_path
        self._conn: aiosqlite.Connection | None = None

    async def init(self):
        self._conn = await aiosqlite.connect(self.db_path)
        await self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS briefings (
                topic_id    TEXT PRIMARY KEY,
                payload     TEXT NOT NULL,
                created_at  REAL NOT NULL,
                updated_at  REAL NOT NULL
            )
            """
        )
        await self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_briefings_updated_at ON briefings(updated_at DESC)"
        )
        await self._conn.commit()

    async def close(self):
        if self._conn:
            await self._conn.close()
            self._conn = None

    async def upsert(self, topic_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        now = time.time()
        await self._conn.execute(
            """
            INSERT INTO briefings (topic_id, payload, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(topic_id) DO UPDATE SET
                payload=excluded.payload,
                updated_at=excluded.updated_at
            """,
            (topic_id, json.dumps(payload, ensure_ascii=False), now, now),
        )
        await self._conn.commit()
        return await self.get(topic_id)

    async def get(self, topic_id: str) -> dict[str, Any] | None:
        async with self._conn.execute(
            "SELECT topic_id, payload, created_at, updated_at FROM briefings WHERE topic_id = ?",
            (topic_id,),
        ) as cur:
            row = await cur.fetchone()
        if row is None:
            return None
        return {
            "topic_id": row[0],
            "payload": json.loads(row[1]),
            "created_at": row[2],
            "updated_at": row[3],
        }

    async def list(self, limit: int = 50) -> list[dict[str, Any]]:
        async with self._conn.execute(
            "SELECT topic_id, payload, created_at, updated_at FROM briefings ORDER BY updated_at DESC LIMIT ?",
            (limit,),
        ) as cur:
            rows = await cur.fetchall()
        return [
            {
                "topic_id": r[0],
                "payload": json.loads(r[1]),
                "created_at": r[2],
                "updated_at": r[3],
            }
            for r in rows
        ]


_store: BriefingStore | None = None


def get_briefings() -> BriefingStore:
    if _store is None:
        raise RuntimeError("BriefingStore não inicializado. Verifique o lifespan.")
    return _store


async def init_briefings() -> BriefingStore:
    global _store
    _store = BriefingStore()
    await _store.init()
    return _store


async def close_briefings():
    global _store
    if _store:
        await _store.close()
        _store = None

