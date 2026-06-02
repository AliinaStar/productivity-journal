"""Integration tests for goal routes, focused on auth and per-user isolation."""

_GOAL = {"title": "Run a 5k", "description": "training", "status": "active", "created_at": "2026-01-01"}


def test_goals_require_authentication(client):
    assert client.get("/goals").status_code in (401, 403)
    assert client.post("/goals", json=_GOAL).status_code in (401, 403)


def test_invalid_token_rejected(client):
    res = client.get("/goals", headers={"Authorization": "Bearer garbage"})
    assert res.status_code == 401


def test_create_and_list_goal(client, make_user):
    user = make_user()
    created = client.post("/goals", json=_GOAL, headers=user["headers"])
    assert created.status_code == 200
    goal_id = created.json()["id"]

    listed = client.get("/goals", headers=user["headers"]).json()
    assert [g["id"] for g in listed] == [goal_id]
    assert listed[0]["title"] == "Run a 5k"


def test_update_goal(client, make_user):
    user = make_user()
    goal_id = client.post("/goals", json=_GOAL, headers=user["headers"]).json()["id"]

    res = client.patch(f"/goals/{goal_id}", json={"status": "finished"}, headers=user["headers"])
    assert res.status_code == 200
    assert res.json()["status"] == "finished"


def test_goal_not_visible_to_other_user(client, make_user):
    alice = make_user("alice@example.com")
    bob = make_user("bob@example.com")

    client.post("/goals", json=_GOAL, headers=alice["headers"])

    assert client.get("/goals", headers=bob["headers"]).json() == []


def test_user_cannot_update_another_users_goal(client, make_user):
    alice = make_user("alice@example.com")
    bob = make_user("bob@example.com")

    goal_id = client.post("/goals", json=_GOAL, headers=alice["headers"]).json()["id"]

    res = client.patch(f"/goals/{goal_id}", json={"title": "hijacked"}, headers=bob["headers"])
    assert res.status_code == 404

    # Alice's goal is untouched.
    alice_goal = client.get("/goals", headers=alice["headers"]).json()[0]
    assert alice_goal["title"] == "Run a 5k"
