"""
Router de concorrência — vídeos dos canais monitorados.
"""

import asyncio
from fastapi import APIRouter, Depends, Query

from app.core.cache import CacheStore, get_cache
from app.core.config import Settings, get_settings
from app.services.topics import CHANNELS_NATIONAL, CHANNELS_INTERNATIONAL
from app.services.youtube import get_channel_videos

router = APIRouter(prefix="/competition", tags=["competition"])


@router.get("/channels")
async def list_channels(
    include_national: bool = Query(True),
    include_international: bool = Query(True),
    cache: CacheStore = Depends(get_cache),
    settings: Settings = Depends(get_settings),
):
    """
    Retorna vídeos recentes de todos os canais monitorados.
    Chamadas em paralelo — resposta em ~2-3s mesmo com 10 canais.
    """
    channels = []
    if include_national:
        channels += CHANNELS_NATIONAL
    if include_international:
        channels += CHANNELS_INTERNATIONAL

    async def _fetch(ch: dict) -> dict:
        videos = await get_channel_videos(
            ch["nome"], ch["query"], ch.get("yt_id"),
            settings.max_youtube_items, cache, settings,
        )
        return {
            "nome": ch["nome"],
            "flag": ch["flag"],
            "foco": ch["foco"],
            "national": ch in CHANNELS_NATIONAL,
            "videos": videos.to_dict(),
        }

    results = await asyncio.gather(*[_fetch(ch) for ch in channels])
    return {"channels": list(results)}


@router.get("/gaps")
async def content_gaps():
    """
    Lacunas de conteúdo identificadas editorialmente.
    Dados estáticos (análise editorial periódica).
    """
    return {
        "gaps": [
            {
                "tema": "Revisão Histórica Profunda",
                "desc": "Concorrentes cobrem eventos recentes. BP vence em documentários históricos de longa duração.",
                "gap": 82,
            },
            {
                "tema": "Geopolítica Sul-americana",
                "desc": "Quase inexplorado por concorrentes internacionais. Alta demanda latente detectada nas buscas.",
                "gap": 78,
            },
            {
                "tema": "Filosofia Política Aplicada",
                "desc": "Jordan Peterson cobre internacionalmente sem adaptação ao contexto brasileiro.",
                "gap": 71,
            },
            {
                "tema": "Defesa Nacional e Estratégia",
                "desc": "Jovem Pan cobre superficialmente. BP pode explorar doutrina e estratégia com profundidade.",
                "gap": 68,
            },
        ]
    }
