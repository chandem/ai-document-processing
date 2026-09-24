from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    port: int = 8000
    max_upload_size_mb: int = 20
    max_extracted_text_chars: int = 200000
    max_question_length: int = 2000
    openai_api_key: str | None = None
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    supabase_service_role_key: str | None = None
    # Primary frontend origin (used for CORS)
    frontend_url: str = "http://localhost:5173"
    # Optional comma-separated extra origins, e.g. https://my-app.vercel.app,https://preview.vercel.app
    frontend_urls: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
