from functools import lru_cache
from pathlib import Path

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent.parent.parent / ".env"


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    postgres_host: str = "localhost"
    postgres_port: int = 5433
    postgres_db: str = "reporting_system"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # LLM
    openai_api_key: str = ""
    llm_model: str = "gpt-4o"           # для генерації звітів
    eval_model: str = "gpt-4o-mini"     # для LLM-as-judge в evaluation
    embedding_model: str = ""
    embedding_dimensions: int = 768

    # Email (Resend)
    resend_api_key: str = ""
    email_from: str = "noreply@yourdomain.com"

    # Langfuse
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_base_url: str = ""

    # App
    app_env: str = "development"
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> AppSettings:
    """Cached settings singleton."""
    return AppSettings()
