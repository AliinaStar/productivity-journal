"""Integration tests for the authentication routes."""

from src.core.security import decode_token
from src.core.settings import get_settings


# ---- dev-login -------------------------------------------------------------

def test_dev_login_creates_user_and_returns_tokens(client, db):
    res = client.post("/auth/dev-login", json={"email": "new@example.com"})
    assert res.status_code == 200
    data = res.json()
    assert data["is_new"] is True
    assert decode_token(data["access_token"], "access") == data["user_id"]
    assert decode_token(data["refresh_token"], "refresh") == data["user_id"]

    row = db.execute("SELECT email FROM \"user\" WHERE id = %s", (data["user_id"],)).fetchone()
    assert row[0] == "new@example.com"


def test_dev_login_second_time_is_not_new(client):
    client.post("/auth/dev-login", json={"email": "repeat@example.com"})
    res = client.post("/auth/dev-login", json={"email": "repeat@example.com"})
    assert res.json()["is_new"] is False


def test_dev_login_forbidden_in_production(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "app_env", "production")
    res = client.post("/auth/dev-login", json={"email": "x@example.com"})
    assert res.status_code == 403


# ---- send-code -------------------------------------------------------------

def test_send_code_stores_unused_code(client, db):
    res = client.post("/auth/send-code", json={"email": "send@example.com"})
    assert res.status_code == 200
    row = db.execute(
        "SELECT used FROM auth_code WHERE email = %s", ("send@example.com",)
    ).fetchone()
    assert row is not None and row[0] is False


def test_send_code_invalidates_previous_codes(client, db):
    client.post("/auth/send-code", json={"email": "multi@example.com"})
    client.post("/auth/send-code", json={"email": "multi@example.com"})
    unused = db.execute(
        "SELECT count(*) FROM auth_code WHERE email = %s AND used = false",
        ("multi@example.com",),
    ).fetchone()[0]
    assert unused == 1


def test_send_code_rejects_invalid_email(client):
    res = client.post("/auth/send-code", json={"email": "not-an-email"})
    assert res.status_code == 422


# ---- verify-code -----------------------------------------------------------

def test_verify_code_success(client, db, insert_auth_code):
    insert_auth_code("verify@example.com", "123456")
    res = client.post("/auth/verify-code", json={"email": "verify@example.com", "code": "123456"})
    assert res.status_code == 200
    data = res.json()
    assert data["is_new"] is True
    assert decode_token(data["access_token"], "access") == data["user_id"]

    used = db.execute(
        "SELECT used FROM auth_code WHERE email = %s", ("verify@example.com",)
    ).fetchone()[0]
    assert used is True


def test_verify_code_wrong_increments_attempts(client, db, insert_auth_code):
    insert_auth_code("wrong@example.com", "111111")
    res = client.post("/auth/verify-code", json={"email": "wrong@example.com", "code": "999999"})
    assert res.status_code == 400
    attempts = db.execute(
        "SELECT attempts FROM auth_code WHERE email = %s", ("wrong@example.com",)
    ).fetchone()[0]
    assert attempts == 1


def test_verify_code_expired_rejected(client, insert_auth_code):
    insert_auth_code("expired@example.com", "123456", minutes=-1)
    res = client.post("/auth/verify-code", json={"email": "expired@example.com", "code": "123456"})
    assert res.status_code == 400


def test_verify_code_too_many_attempts_burns_code(client, db, insert_auth_code):
    insert_auth_code("brute@example.com", "123456", attempts=5)
    res = client.post("/auth/verify-code", json={"email": "brute@example.com", "code": "123456"})
    assert res.status_code == 400
    assert "Too many attempts" in res.json()["detail"]
    used = db.execute(
        "SELECT used FROM auth_code WHERE email = %s", ("brute@example.com",)
    ).fetchone()[0]
    assert used is True


def test_verify_code_used_code_rejected(client, insert_auth_code):
    insert_auth_code("usedup@example.com", "123456", used=True)
    res = client.post("/auth/verify-code", json={"email": "usedup@example.com", "code": "123456"})
    assert res.status_code == 400


# ---- refresh ---------------------------------------------------------------

def test_refresh_returns_working_access_token(client, make_user):
    user = make_user("refresh@example.com")
    res = client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]})
    assert res.status_code == 200
    new_access = res.json()["access_token"]
    # The new access token must actually authenticate a request.
    me = client.get("/users/me", headers={"Authorization": f"Bearer {new_access}"})
    assert me.status_code == 200


def test_refresh_rejects_access_token(client, make_user):
    user = make_user("misuse@example.com")
    res = client.post("/auth/refresh", json={"refresh_token": user["access_token"]})
    assert res.status_code == 401


def test_refresh_rejects_garbage(client):
    res = client.post("/auth/refresh", json={"refresh_token": "not.a.token"})
    assert res.status_code == 401
