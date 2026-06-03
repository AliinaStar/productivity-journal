"""Tests for GDPR endpoints: consent, data export, account deletion."""

_GOAL = {"title": "Run", "status": "active", "created_at": "2026-01-01"}


def _make_goal(client, headers) -> int:
    return client.post("/goals", json=_GOAL, headers=headers).json()["id"]


def test_consent_sets_timestamp(client, make_user):
    user = make_user()
    assert client.get("/users/me", headers=user["headers"]).json()["consent_at"] is None

    res = client.post("/users/me/consent", headers=user["headers"])
    assert res.status_code == 200
    assert res.json()["consent_at"] is not None


def test_export_returns_all_user_data(client, make_user):
    user = make_user("export@example.com")
    goal_id = _make_goal(client, user["headers"])
    client.post(
        "/entries",
        json={"goal_id": goal_id, "date_note": "2026-01-02", "note": "did it", "productivity_score": 5},
        headers=user["headers"],
    )

    data = client.get("/users/me/export", headers=user["headers"]).json()
    assert data["profile"]["email"] == "export@example.com"
    assert len(data["goals"]) == 1
    assert len(data["entries"]) == 1
    assert data["entries"][0]["note"] == "did it"


def test_export_requires_auth(client):
    assert client.get("/users/me/export").status_code in (401, 403)


def test_delete_account_removes_everything(client, db, make_user):
    user = make_user("delete@example.com")
    goal_id = _make_goal(client, user["headers"])
    client.post(
        "/entries",
        json={"goal_id": goal_id, "date_note": "2026-01-02", "note": "x", "productivity_score": 3},
        headers=user["headers"],
    )

    res = client.delete("/users/me", headers=user["headers"])
    assert res.status_code == 204

    # User and their data are gone.
    uid = user["user_id"]
    assert db.execute('SELECT count(*) FROM "user" WHERE id = %s', (uid,)).fetchone()[0] == 0
    assert db.execute("SELECT count(*) FROM goal WHERE user_id = %s", (uid,)).fetchone()[0] == 0
    # The access token now resolves to a missing user.
    assert client.get("/users/me", headers=user["headers"]).status_code == 404


def test_delete_account_requires_auth(client):
    assert client.delete("/users/me").status_code in (401, 403)
