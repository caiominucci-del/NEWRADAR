"""
Radar BP — Backend API
FastAPI · Python 3.12+

Rodar localmente:
    uvicorn app.main:app --reload --port 8000

Documentação interativa:
    http://localhost:8000/docs
"""

from contextlib import asynccontextmanager
import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.auth import require_admin
from app.core.briefings import close_briefings, init_briefings
from app.core.cache import init_cache, close_cache
from app.core.config import get_settings
from app.routers import trends, topics, competition, auth, briefings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("radar_bp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ────────────────────────────────────────────────────────────
    settings = get_settings()
    store = await init_cache()
    await init_briefings()
    logger.info("Cache SQLite inicializado: %s", settings.cache_db_path)

    keys_status = {
        "gemini": "✓" if settings.gemini_api_key else "✗ (configure GEMINI_API_KEY)",
        "serpapi": "✓" if settings.serpapi_key else "✗ (configure SERPAPI_KEY)",
    }
    for k, v in keys_status.items():
        logger.info("API Key [%s]: %s", k, v)

    yield

    # ── Shutdown ───────────────────────────────────────────────────────────
    await store.purge_expired()
    await close_cache()
    await close_briefings()
    logger.info("Cache fechado.")


app = FastAPI(
    title="Radar BP — Inteligência Editorial",
    description="API de tendências, notícias e ângulos editoriais para o Brasil Paralelo.",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(trends.router)
app.include_router(topics.router)
app.include_router(competition.router)
app.include_router(auth.router)
app.include_router(briefings.router)


# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health", tags=["meta"])
async def health():
    from app.core.cache import get_cache
    cache_stats = await get_cache().stats()
    s = get_settings()
    return {
        "status": "ok",
        "version": "2.0.0",
        "keys": {
            "gemini": bool(s.gemini_api_key),
            "serpapi": bool(s.serpapi_key),
        },
        "cache": cache_stats,
    }


@app.delete("/cache", tags=["meta"])
async def clear_cache(prefix: str = "", _user=Depends(require_admin)):
    """Invalida entradas de cache. Sem prefix = limpa tudo."""
    from app.core.cache import get_cache
    removed = await get_cache().invalidate(prefix or "")
    return {"removed": removed, "prefix": prefix or "(all)"}


@app.get("/health/apis", tags=["meta"])
async def health_apis(_user=Depends(require_admin)):
    """Testa as APIs externas e retorna diagnóstico detalhado."""
    import httpx
    s = get_settings()
    results: dict = {}

    # ── Gemini ──────────────────────────────────────────────────────────────
    gemini_models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest"]
    gemini_ok = False
    gemini_model_used = None
    gemini_error = None
    if s.gemini_api_key:
        for model in gemini_models:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={s.gemini_api_key}",
                        json={"contents": [{"parts": [{"text": "Diga apenas: OK"}]}],
                              "generationConfig": {"maxOutputTokens": 5}},
                    )
                    if resp.status_code == 200:
                        gemini_ok = True
                        gemini_model_used = model
                        break
                    elif resp.status_code == 404:
                        continue
                    else:
                        gemini_error = f"HTTP {resp.status_code}: {resp.text[:150]}"
                        break
            except Exception as e:
                gemini_error = str(e)
                break
        if not gemini_ok and not gemini_error:
            gemini_error = "Nenhum modelo disponível (todos retornaram 404)"
    else:
        gemini_error = "GEMINI_API_KEY não configurada"

    results["gemini"] = {"ok": gemini_ok, "model": gemini_model_used, "error": gemini_error}

    # ── SerpAPI ─────────────────────────────────────────────────────────────
    serpapi_ok = False
    serpapi_error = None
    if s.serpapi_key:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://serpapi.com/search.json",
                    params={"engine": "google_trends", "q": "Brasil", "data_type": "TIMESERIES",
                            "date": "now 7-d", "geo": "BR", "hl": "pt", "api_key": s.serpapi_key},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    serpapi_ok = bool(data.get("interest_over_time"))
                    if not serpapi_ok:
                        serpapi_error = "Resposta vazia (sem interest_over_time)"
                else:
                    serpapi_error = f"HTTP {resp.status_code}: {resp.text[:150]}"
        except Exception as e:
            serpapi_error = str(e)
    else:
        serpapi_error = "SERPAPI_KEY não configurada"

    results["serpapi"] = {"ok": serpapi_ok, "error": serpapi_error}

    return {"apis": results}
