"""Unit tests for small pure route helpers."""

from src.routes.auth import _generate_code, _hash_code


def test_generate_code_is_six_digits():
    for _ in range(50):
        code = _generate_code()
        assert len(code) == 6
        assert code.isdigit()


def test_hash_code_is_deterministic_sha256():
    assert _hash_code("123456") == _hash_code("123456")
    assert _hash_code("123456") != _hash_code("654321")
    assert len(_hash_code("123456")) == 64  # SHA-256 hex digest
