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


# ---- store-review account ---------------------------------------------------
# A single email configured via REVIEW_EMAIL/REVIEW_CODE logs in with a fixed
# code, bypassing OTP, so an app-store reviewer can sign in without access to
# any inbox. This is a real authentication bypass, so the tests care most
# about the *disabled* state: unless both env vars are set, this email must
# behave exactly like any other.

def test_review_account_disabled_by_default(client, db):
    """The bypass must be off unless both settings are explicitly configured —
    this is what makes it safe to ship in the default/empty-env case."""
    res = client.post("/auth/send-code", json={"email": "review@example.com"})
    assert res.status_code == 200
    row = db.execute(
        "SELECT used FROM auth_code WHERE email = %s", ("review@example.com",)
    ).fetchone()
    # A real code was generated and stored, same as any other email — the
    # request was not shortcut.
    assert row is not None

    verify = client.post(
        "/auth/verify-code", json={"email": "review@example.com", "code": "000000"}
    )
    assert verify.status_code == 400


def test_review_account_logs_in_with_fixed_code(client, db, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "review_email", "review@example.com")
    monkeypatch.setattr(settings, "review_code", "837412")

    send = client.post("/auth/send-code", json={"email": "review@example.com"})
    assert send.status_code == 200
    # No AuthCode row: no code was ever generated or emailed for this address.
    row = db.execute(
        "SELECT 1 FROM auth_code WHERE email = %s", ("review@example.com",)
    ).fetchone()
    assert row is None

    verify = client.post(
        "/auth/verify-code", json={"email": "review@example.com", "code": "837412"}
    )
    assert verify.status_code == 200
    assert verify.json()["user_id"] is not None


def test_review_account_rejects_wrong_code(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "review_email", "review@example.com")
    monkeypatch.setattr(settings, "review_code", "837412")

    res = client.post(
        "/auth/verify-code", json={"email": "review@example.com", "code": "000000"}
    )
    assert res.status_code == 400


def test_review_account_is_case_insensitive_on_email(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "review_email", "review@example.com")
    monkeypatch.setattr(settings, "review_code", "837412")

    res = client.post(
        "/auth/verify-code", json={"email": "Review@Example.com", "code": "837412"}
    )
    assert res.status_code == 200


def test_review_account_ignored_when_only_email_is_set(client, db, monkeypatch):
    """Both settings must be present — a half-configured bypass (e.g. one env
    var set by mistake) must not silently open the door."""
    monkeypatch.setattr(get_settings(), "review_email", "review@example.com")

    res = client.post(
        "/auth/verify-code", json={"email": "review@example.com", "code": "anything"}
    )
    assert res.status_code == 400


def test_review_account_does_not_affect_other_emails(client, db, insert_auth_code, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "review_email", "review@example.com")
    monkeypatch.setattr(settings, "review_code", "837412")

    insert_auth_code("someone-else@example.com", "123456")
    res = client.post(
        "/auth/verify-code", json={"email": "someone-else@example.com", "code": "123456"}
    )
    assert res.status_code == 200


# ---- refresh ---------------------------------------------------------------

def test_refresh_returns_working_access_token(client, make_user):
    user = make_user("refresh@example.com")
    res = client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]})
    assert res.status_code == 200
    new_access = res.json()["access_token"]
    # The new access token must actually authenticate a request.
    me = client.get("/users/me", headers={"Authorization": f"Bearer {new_access}"})
    assert me.status_code == 200


def test_refresh_rotates_the_refresh_token(client, make_user):
    user = make_user("rotate@example.com")
    res = client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]})
    assert res.status_code == 200

    new_refresh = res.json()["refresh_token"]
    # A fresh, working refresh token is returned...
    assert new_refresh and new_refresh != user["refresh_token"]
    again = client.post("/auth/refresh", json={"refresh_token": new_refresh})
    assert again.status_code == 200


def test_refresh_rejects_a_rotated_token_and_revokes_the_family(client, make_user):
    user = make_user("reuse@example.com")
    first = client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]})
    assert first.status_code == 200
    new_refresh = first.json()["refresh_token"]

    # Replaying the original (now-rotated) token is rejected...
    replay = client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]})
    assert replay.status_code == 401

    # ...and reuse detection has burned the whole family, including the new one.
    after = client.post("/auth/refresh", json={"refresh_token": new_refresh})
    assert after.status_code == 401


def test_refresh_rejects_access_token(client, make_user):
    user = make_user("misuse@example.com")
    res = client.post("/auth/refresh", json={"refresh_token": user["access_token"]})
    assert res.status_code == 401


def test_refresh_rejects_garbage(client):
    res = client.post("/auth/refresh", json={"refresh_token": "not.a.token"})
    assert res.status_code == 401
