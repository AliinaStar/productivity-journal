"""Shared pytest fixtures.

Spins up an isolated ``reporting_system_test`` database on the same Postgres
instance used for development (localhost:5433 by default), creates the schema,
and provides a FastAPI ``TestClient``. External side effects — embeddings,
email, the RAG pipeline and rate limiting — are stubbed so tests run offline
and deterministically.

Environment is configured at import time, before any ``src`` module reads
settings, so the app points at the test database.
"""

import asyncio
import os
import sys

# psycopg's async driver cannot run on Windows' default ProactorEventLoop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# --- Configure environment BEFORE importing application code ----------------
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("JWT_SECRET", "test-secret-key-not-for-production")
os.environ["POSTGRES_HOST"] = os.environ.get("TEST_POSTGRES_HOST", "localhost")
os.environ["POSTGRES_PORT"] = os.environ.get("TEST_POSTGRES_PORT", "5433")
os.environ["POSTGRES_USER"] = os.environ.get("TEST_POSTGRES_USER", "postgres")
os.environ["POSTGRES_PASSWORD"] = os.environ.get("TEST_POSTGRES_PASSWORD", "postgres")
os.environ["POSTGRES_DB"] = "reporting_system_test"

from datetime import datetime, timedelta, timezone  # noqa: E402

import psycopg  # noqa: E402
import pytest  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

import src.db.models  # noqa: E402,F401  (populate Base.metadata)
from src.core.settings import get_settings  # noqa: E402
from src.db.base import Base  # noqa: E402

_TEST_DB = "reporting_system_test"
_TABLES = ['entry', 'goal', 'report', 'auth_code', 'refresh_token', '"user"']


def _admin_dsn() -> str:
    s = get_settings()
    return (
        f"host={s.postgres_host} port={s.postgres_port} "
        f"user={s.postgres_user} password={s.postgres_password} dbname=postgres"
    )


@pytest.fixture(scope="session", autouse=True)
def _setup_database():
    """Create the test database + schema once per test session."""
    with psycopg.connect(_admin_dsn(), autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (_TEST_DB,)
        ).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{_TEST_DB}"')

    sync_url = get_settings().database_url
    engine = create_engine(sync_url)
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    # Rebuild from current models so schema changes are always reflected.
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    engine.dispose()
    yield


@pytest.fixture(autouse=True)
def _clean_db():
    """Truncate all tables before each test for isolation."""
    sync_url = get_settings().database_url
    engine = create_engine(sync_url)
    with engine.begin() as conn:
        conn.execute(
            text(f"TRUNCATE TABLE {', '.join(_TABLES)} RESTART IDENTITY CASCADE")
        )
    engine.dispose()
    yield


@pytest.fixture(autouse=True)
def _stub_external(monkeypatch):
    """Stub embeddings, email and the rate limiter so tests stay offline."""
    from src.core.ratelimit import limiter
    from src.routes import auth as auth_module
    from src.routes import entries as entries_module

    limiter.enabled = False

    async def _fake_embed(_text: str) -> list[float]:
        return [0.0] * 768

    async def _fake_send(email: str, code: str) -> None:  # noqa: ARG001
        return None

    monkeypatch.setattr(entries_module, "_embed", _fake_embed)
    monkeypatch.setattr(auth_module, "send_login_code", _fake_send)
    yield


@pytest.fixture()
def client():
    """A TestClient that does NOT trigger lifespan (no APScheduler in tests)."""
    from fastapi.testclient import TestClient

    from src.api.main import create_app

    return TestClient(create_app())


@pytest.fixture()
def db():
    """A synchronous psycopg connection to the test database for direct setup."""
    s = get_settings()
    dsn = (
        f"host={s.postgres_host} port={s.postgres_port} "
        f"user={s.postgres_user} password={s.postgres_password} dbname={s.postgres_db}"
    )
    with psycopg.connect(dsn, autocommit=True) as conn:
        yield conn


@pytest.fixture()
def make_user(client):
    """Factory: create/login a user via dev-login and return auth artifacts.

    Returns a callable ``make_user(email) -> dict`` with keys
    ``user_id``, ``access_token`` and ``headers`` (ready-to-use Bearer header).
    """
    def _make(email: str = "alice@example.com") -> dict:
        res = client.post("/auth/dev-login", json={"email": email})
        assert res.status_code == 200, res.text
        data = res.json()
        return {
            "user_id": data["user_id"],
            "access_token": data["access_token"],
            "refresh_token": data["refresh_token"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"},
        }

    return _make


@pytest.fixture()
def insert_auth_code(db):
    """Factory to insert an AuthCode row directly, for verify-code tests.

    Stores the SHA-256 hash of *code* (matching production behaviour).
    """
    from src.routes.auth import _hash_code

    def _insert(email: str, code: str, *, minutes: int = 10, used: bool = False,
                attempts: int = 0) -> None:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=minutes)
        db.execute(
            "INSERT INTO auth_code (email, code_hash, expires_at, used, attempts) "
            "VALUES (%s, %s, %s, %s, %s)",
            (email, _hash_code(code), expires_at, used, attempts),
        )

    return _insert
