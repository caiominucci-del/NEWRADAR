from __future__ import annotations

import csv
import io
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from app.core.auth import require_admin
from app.core.briefings import BriefingStore, get_briefings
from app.core.config import Settings, get_settings

router = APIRouter(prefix="/briefings", tags=["briefings"])


class BriefingPayload(BaseModel):
    tema: str = ""
    categoria: str = ""
    titulo: str = ""
    gancho: str = ""
    angulo: str = ""
    urgencia: str = ""
    formatos: list[str] = Field(default_factory=list)
    por_que_agora: str = ""
    keywords: list[str] = Field(default_factory=list)
    score: int | None = None
    is_real: bool = False


@router.get("")
async def list_briefings(
    limit: int = Query(30, ge=1, le=200),
    store: BriefingStore = Depends(get_briefings),
    settings: Settings = Depends(get_settings),
    _user=Depends(require_admin),
):
    rows = await store.list(min(limit, settings.max_briefings_list))
    return {"briefings": rows}


@router.get("/{topic_id}")
async def get_briefing(
    topic_id: str,
    store: BriefingStore = Depends(get_briefings),
    _user=Depends(require_admin),
):
    row = await store.get(topic_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Briefing não encontrado")
    return row


@router.put("/{topic_id}")
async def save_briefing(
    topic_id: str,
    payload: BriefingPayload,
    store: BriefingStore = Depends(get_briefings),
    _user=Depends(require_admin),
):
    saved = await store.upsert(topic_id, payload.model_dump())
    return saved


@router.get("/{topic_id}/export")
async def export_briefing(
    topic_id: str,
    format: Literal["json", "csv"] = Query("json"),
    store: BriefingStore = Depends(get_briefings),
    _user=Depends(require_admin),
):
    row = await store.get(topic_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Briefing não encontrado")

    payload = row["payload"]
    if format == "json":
        return row

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "topic_id",
            "tema",
            "categoria",
            "titulo",
            "gancho",
            "angulo",
            "urgencia",
            "formatos",
            "por_que_agora",
            "keywords",
            "score",
            "is_real",
            "updated_at",
        ]
    )
    writer.writerow(
        [
            row["topic_id"],
            payload.get("tema", ""),
            payload.get("categoria", ""),
            payload.get("titulo", ""),
            payload.get("gancho", ""),
            payload.get("angulo", ""),
            payload.get("urgencia", ""),
            "|".join(payload.get("formatos", []) or []),
            payload.get("por_que_agora", ""),
            "|".join(payload.get("keywords", []) or []),
            payload.get("score", ""),
            payload.get("is_real", False),
            row["updated_at"],
        ]
    )
    csv_text = output.getvalue()
    headers = {"Content-Disposition": f'attachment; filename="briefing_{topic_id}.csv"'}
    return PlainTextResponse(csv_text, headers=headers, media_type="text/csv; charset=utf-8")

