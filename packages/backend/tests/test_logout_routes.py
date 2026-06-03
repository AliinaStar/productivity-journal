"""Tests for refresh-token allowlist and server-side logout/revocation."""


def test_refresh_works_before_logout(client, make_user):
    user = make_user()
    res = client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]})
    assert res.status_code == 200


def test_logout_revokes_refresh_token(client, make_user):
    user = make_user()
    logout = client.post("/auth/logout", json={"refresh_token": user["refresh_token"]})
    assert logout.status_code == 204

    # After logout the refresh token must no longer be accepted.
    res = client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]})
    assert res.status_code == 401


def test_logout_is_idempotent_for_unknown_token(client):
    res = client.post("/auth/logout", json={"refresh_token": "garbage"})
    assert res.status_code == 204


def test_refresh_rejects_token_without_allowlist_row(client, db, make_user):
    """A validly-signed refresh token whose jti was purged is rejected."""
    user = make_user()
    db.execute("DELETE FROM refresh_token")
    res = client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]})
    assert res.status_code == 401
