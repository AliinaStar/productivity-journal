"""Integration tests for report routes.

The RAG pipeline (LLM) is replaced with a stub so generation is deterministic
and offline; persistence and per-user scoping are exercised for real.
"""

import pytest

from src.routes import reports as reports_module


@pytest.fixture()
def stub_pipeline(monkeypatch):
    """Replace pipeline.ainvoke with a stub returning a fixed report state."""
    async def _fake_ainvoke(state: dict) -> dict:
        return {
            "final_report": '{"summary": "great week"}',
            "avg_productivity": 4.5,
            "active_days": 3,
        }

    monkeypatch.setattr(reports_module.pipeline, "ainvoke", _fake_ainvoke)


_GEN_BODY = {"period": "week", "period_start": "2026-01-05", "period_end": "2026-01-11"}


def test_reports_require_auth(client):
    assert client.get("/reports/list?period=week").status_code in (401, 403)


def test_list_reports_empty(client, make_user):
    user = make_user()
    res = client.get("/reports/list?period=week", headers=user["headers"])
    assert res.status_code == 200
    assert res.json() == []


def test_get_report_returns_null_when_missing(client, make_user):
    user = make_user()
    res = client.get("/reports?period=week&period_start=2026-01-05", headers=user["headers"])
    assert res.status_code == 200
    assert res.json() is None


def test_generate_report_persists_and_returns(client, make_user, stub_pipeline):
    user = make_user()
    res = client.post("/reports/generate", json=_GEN_BODY, headers=user["headers"])
    assert res.status_code == 200
    data = res.json()
    assert data["final_report"] == {"summary": "great week"}
    assert data["avg_productivity"] == 4.5
    assert data["active_days"] == 3

    listed = client.get("/reports/list?period=week", headers=user["headers"]).json()
    assert len(listed) == 1


def test_generate_report_is_scoped_to_user(client, make_user, stub_pipeline):
    alice = make_user("alice@example.com")
    bob = make_user("bob@example.com")

    client.post("/reports/generate", json=_GEN_BODY, headers=alice["headers"])

    assert client.get("/reports/list?period=week", headers=bob["headers"]).json() == []


def test_generate_report_422_when_no_report(client, make_user, monkeypatch):
    user = make_user()

    async def _empty(state: dict) -> dict:
        return {}

    monkeypatch.setattr(reports_module.pipeline, "ainvoke", _empty)
    res = client.post("/reports/generate", json=_GEN_BODY, headers=user["headers"])
    assert res.status_code == 422


def test_generate_report_500_is_generic(client, make_user, monkeypatch):
    """Internal pipeline errors must not leak details to the client."""
    user = make_user()

    async def _boom(state: dict) -> dict:
        raise RuntimeError("secret internal detail: db password leaked")

    monkeypatch.setattr(reports_module.pipeline, "ainvoke", _boom)
    res = client.post("/reports/generate", json=_GEN_BODY, headers=user["headers"])
    assert res.status_code == 500
    assert "secret internal detail" not in res.text
    assert res.json()["detail"] == "Report generation failed."
