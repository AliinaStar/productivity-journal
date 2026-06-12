from functools import lru_cache
from pathlib import Path

from pydantic import computed_field, model_validator
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

    @model_validator(mode="after")
    def _require_secrets_outside_dev(self) -> "AppSettings":
        """Fail-closed: only 'development' may run with default/empty secrets.

        Any other value (production, staging, …) must set JWT_SECRET — otherwise
        tokens would be signed with the public insecure dev fallback and could be
        forged for any user. Likewise the well-known default Postgres password
        is rejected so a misconfigured deploy fails at startup, not at breach.
        """
        if self.app_env != "development":
            if not self.jwt_secret:
                raise ValueError(
                    f"JWT_SECRET must be set when APP_ENV={self.app_env!r}. "
                    "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(64))'"
                )
            if self.postgres_password == "postgres":
                raise ValueError(
                    f"POSTGRES_PASSWORD must be changed from the default when "
                    f"APP_ENV={self.app_env!r}."
                )
        return self

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

    # Auth (JWT)
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30
    otp_max_attempts: int = 5

    # Langfuse
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_base_url: str = ""

    # App
    app_env: str = "production"
    log_level: str = "INFO"
    log_file: str = ""  # if set, structured logs are written to this file
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> AppSettings:
    """Cached settings singleton."""
    return AppSettings()
