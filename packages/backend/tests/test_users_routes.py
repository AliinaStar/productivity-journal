"""Integration tests for the /users/me profile routes."""


def test_get_me_requires_auth(client):
    assert client.get("/users/me").status_code in (401, 403)


def test_get_me_returns_own_profile(client, make_user):
    user = make_user("profile@example.com")
    res = client.get("/users/me", headers=user["headers"])
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "profile@example.com"
    assert data["id"] == user["user_id"]


def test_patch_me_updates_fields(client, make_user):
    user = make_user()
    res = client.patch(
        "/users/me",
        json={"name": "Alice", "language": "Ukrainian", "gender": "female"},
        headers=user["headers"],
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Alice"
    assert data["language"] == "Ukrainian"
    assert data["gender"] == "female"


def test_push_token_requires_auth(client):
    assert client.post("/users/me/push-token", json={"token": "x"}).status_code in (401, 403)


def test_push_token_set_and_clear(client, make_user):
    user = make_user("push@example.com")
    res = client.post(
        "/users/me/push-token",
        json={"token": "ExponentPushToken[abc123]"},
        headers=user["headers"],
    )
    assert res.status_code == 204

    res = client.post("/users/me/push-token", json={"token": None}, headers=user["headers"])
    assert res.status_code == 204


def test_push_token_rejects_too_long(client, make_user):
    user = make_user()
    res = client.post(
        "/users/me/push-token",
        json={"token": "x" * 101},
        headers=user["headers"],
    )
    assert res.status_code == 422


def test_profiles_are_per_user(client, make_user):
    alice = make_user("alice@example.com")
    bob = make_user("bob@example.com")
    client.patch("/users/me", json={"name": "Alice"}, headers=alice["headers"])
    client.patch("/users/me", json={"name": "Bob"}, headers=bob["headers"])

    assert client.get("/users/me", headers=alice["headers"]).json()["name"] == "Alice"
    assert client.get("/users/me", headers=bob["headers"]).json()["name"] == "Bob"
