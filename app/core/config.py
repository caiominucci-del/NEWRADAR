from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # API Keys
    gemini_api_key: str = ""
    serpapi_key: str = ""

    # Auth simplificada (troque em produção)
    admin_user: str = "admin"
    admin_password: str = "1234"
    auth_secret_key: str = "change-this-secret-in-production"
    auth_token_ttl_seconds: int = 60 * 60 * 12  # 12h

    # Cache
    cache_db_path: str = "radar_cache.db"

    # TTLs em segundos
    ttl_trends: int = 1800       # 30min — dados mudam rápido
    ttl_news: int = 1800         # 30min
    ttl_youtube: int = 3600      # 1h
    ttl_editorial: int = 7200    # 2h — Gemini é caro, cache longo
    ttl_macro: int = 1800        # 30min

    # CORS — adicione o domínio do seu frontend Vercel aqui
    allowed_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    # Limites de resultados
    max_news_items: int = 10
    max_youtube_items: int = 5
    max_seo_items: int = 8
    max_briefings_list: int = 100


@lru_cache
def get_settings() -> Settings:
    return Settings()
