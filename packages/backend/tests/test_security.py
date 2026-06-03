"""Unit tests for JWT creation/validation — the core of the auth rewrite."""

from datetime import timedelta

import jwt
import pytest

from src.core import security


def test_access_token_roundtrip():
    token = security.create_access_token(42)
    assert security.decode_token(token, "access") == 42


def test_refresh_token_roundtrip():
    token = security.create_refresh_token(7, jti="abc")
    assert security.decode_token(token, "refresh") == 7


def test_refresh_token_carries_jti():
    token = security.create_refresh_token(7, jti="my-jti")
    assert security.decode_token_payload(token, "refresh")["jti"] == "my-jti"


def test_access_token_rejected_as_refresh():
    token = security.create_access_token(1)
    with pytest.raises(jwt.InvalidTokenError):
        security.decode_token(token, "refresh")


def test_refresh_token_rejected_as_access():
    token = security.create_refresh_token(1, jti="abc")
    with pytest.raises(jwt.InvalidTokenError):
        security.decode_token(token, "access")


def test_expired_token_rejected():
    token = security._create_token(1, "access", timedelta(seconds=-1))
    with pytest.raises(jwt.ExpiredSignatureError):
        security.decode_token(token, "access")


def test_tampered_token_rejected():
    token = security.create_access_token(1)
    tampered = token[:-2] + ("aa" if not token.endswith("aa") else "bb")
    with pytest.raises(jwt.InvalidTokenError):
        security.decode_token(tampered, "access")


def test_token_signed_with_other_secret_rejected():
    forged = jwt.encode({"sub": "1", "type": "access"}, "some-other-secret", algorithm="HS256")
    with pytest.raises(jwt.InvalidTokenError):
        security.decode_token(forged, "access")


def test_subject_is_encoded_as_string_but_decoded_as_int():
    token = security.create_access_token(123)
    payload = jwt.decode(token, security._secret(), algorithms=["HS256"])
    assert payload["sub"] == "123"
    assert security.decode_token(token, "access") == 123
