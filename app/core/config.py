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

    # Auth
    admin_user: str = "admin"
    admin_password: str = "1234"
    auth_secret_key: str = "change-this-secret-in-production"
    auth_token_ttl_seconds: int = 60 * 60 * 12  # 12h

    # Cache
    cache_db_path: str = "radar_cache.db"

    # TTLs em segundos
    # Trends e editorial: 24h — dados são atualizados 1x/dia pelo job agendado
    ttl_trends: int = 86_400       # 24h
    ttl_news: int = 3_600          # 1h  — RSS é grátis, pode ser mais frequente
    ttl_youtube: int = 3_600       # 1h
    ttl_editorial: int = 86_400    # 24h
    ttl_macro: int = 1_800         # 30min — RSS do Google Trends, sem custo

    # CORS
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
