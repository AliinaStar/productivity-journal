"""Tests for list pagination (limit/offset with a hard cap of 100)."""

_GOAL = {"title": "G", "status": "active", "created_at": "2026-01-01"}


def test_limit_and_offset(client, make_user):
    user = make_user()
    for i in range(5):
        client.post("/goals", json={**_GOAL, "title": f"G{i}"}, headers=user["headers"])

    first_two = client.get("/goals?limit=2&offset=0", headers=user["headers"]).json()
    assert len(first_two) == 2

    next_two = client.get("/goals?limit=2&offset=2", headers=user["headers"]).json()
    assert len(next_two) == 2

    # No overlap between pages.
    assert {g["id"] for g in first_two}.isdisjoint({g["id"] for g in next_two})


def test_limit_above_cap_is_rejected(client, make_user):
    user = make_user()
    assert client.get("/goals?limit=101", headers=user["headers"]).status_code == 422


def test_limit_must_be_positive(client, make_user):
    user = make_user()
    assert client.get("/goals?limit=0", headers=user["headers"]).status_code == 422


def test_default_limit_applies(client, make_user):
    user = make_user()
    for i in range(3):
        client.post("/goals", json={**_GOAL, "title": f"G{i}"}, headers=user["headers"])
    # No limit param → default (50), returns all 3.
    assert len(client.get("/goals", headers=user["headers"]).json()) == 3
