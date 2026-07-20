"""Integration tests for entry routes — auth, ownership and isolation.

Embeddings are stubbed (see conftest._stub_external) so no model is loaded.
"""

_GOAL = {"title": "Read more", "status": "active", "created_at": "2026-01-01"}


def _make_goal(client, headers) -> int:
    return client.post("/goals", json=_GOAL, headers=headers).json()["id"]


def _entry_body(goal_id: int) -> dict:
    return {"goal_id": goal_id, "date_note": "2026-01-02", "note": "read 20 pages", "productivity_score": 4}


def test_entries_require_authentication(client):
    assert client.get("/entries").status_code in (401, 403)


def test_create_and_list_entry(client, make_user):
    user = make_user()
    goal_id = _make_goal(client, user["headers"])

    created = client.post("/entries", json=_entry_body(goal_id), headers=user["headers"])
    assert created.status_code == 200
    assert created.json()["note"] == "read 20 pages"
    # A freshly created entry carries a server-set creation timestamp; only
    # rows predating the column are allowed to be null.
    assert created.json()["created_at"] is not None

    listed = client.get("/entries", headers=user["headers"]).json()
    assert len(listed) == 1
    assert listed[0]["goal_id"] == goal_id


def test_create_entry_honours_client_created_at(client, make_user):
    """An offline entry syncs with the device's real write time, not sync time."""
    user = make_user()
    goal_id = _make_goal(client, user["headers"])

    body = _entry_body(goal_id) | {"created_at": "2026-01-02T09:30:00+00:00"}
    created = client.post("/entries", json=body, headers=user["headers"])
    assert created.status_code == 200
    assert created.json()["created_at"].startswith("2026-01-02T09:30:00")


def test_create_entry_ignores_unparseable_created_at(client, make_user):
    """A bad client clock must never block a sync — the server default applies."""
    user = make_user()
    goal_id = _make_goal(client, user["headers"])

    body = _entry_body(goal_id) | {"created_at": "not-a-date"}
    created = client.post("/entries", json=body, headers=user["headers"])
    assert created.status_code == 200
    assert created.json()["created_at"] is not None


def test_update_entry(client, make_user):
    user = make_user()
    goal_id = _make_goal(client, user["headers"])
    entry_id = client.post("/entries", json=_entry_body(goal_id), headers=user["headers"]).json()["id"]

    res = client.patch(f"/entries/{entry_id}", json={"productivity_score": 1}, headers=user["headers"])
    assert res.status_code == 200
    assert res.json()["productivity_score"] == 1


def test_cannot_create_entry_on_another_users_goal(client, make_user):
    alice = make_user("alice@example.com")
    bob = make_user("bob@example.com")
    alice_goal = _make_goal(client, alice["headers"])

    res = client.post("/entries", json=_entry_body(alice_goal), headers=bob["headers"])
    assert res.status_code == 404


def test_entries_isolated_between_users(client, make_user):
    alice = make_user("alice@example.com")
    bob = make_user("bob@example.com")
    alice_goal = _make_goal(client, alice["headers"])
    client.post("/entries", json=_entry_body(alice_goal), headers=alice["headers"])

    assert client.get("/entries", headers=bob["headers"]).json() == []


def test_cannot_update_another_users_entry(client, make_user):
    alice = make_user("alice@example.com")
    bob = make_user("bob@example.com")
    alice_goal = _make_goal(client, alice["headers"])
    entry_id = client.post("/entries", json=_entry_body(alice_goal), headers=alice["headers"]).json()["id"]

    res = client.patch(f"/entries/{entry_id}", json={"note": "hijacked"}, headers=bob["headers"])
    assert res.status_code == 404
