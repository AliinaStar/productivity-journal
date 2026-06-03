"""Unit tests for settings — fail-closed in production, URL composition."""

import pytest
from pydantic import ValidationError

from src.core.settings import AppSettings


def test_production_requires_jwt_secret():
    with pytest.raises(ValidationError):
        AppSettings(app_env="production", jwt_secret="", _env_file=None)


def test_non_dev_env_requires_jwt_secret():
    # Any non-development env (e.g. staging) must not fall back to the dev secret.
    with pytest.raises(ValidationError):
        AppSettings(app_env="staging", jwt_secret="", _env_file=None)


def test_production_with_secret_ok():
    s = AppSettings(app_env="production", jwt_secret="x" * 40, _env_file=None)
    assert s.app_env == "production"


def test_development_allows_empty_secret():
    s = AppSettings(app_env="development", jwt_secret="", _env_file=None)
    assert s.jwt_secret == ""


def test_database_url_composition():
    s = AppSettings(
        postgres_user="u",
        postgres_password="p",
        postgres_host="h",
        postgres_port=1234,
        postgres_db="d",
        app_env="development",
        _env_file=None,
    )
    assert s.database_url == "postgresql+psycopg://u:p@h:1234/d"


def test_default_app_env_is_production():
    # The secure default: anything not explicitly set to development is locked down.
    assert AppSettings.model_fields["app_env"].default == "production"
