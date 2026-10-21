from datetime import UTC, datetime, timedelta

from app.domain.auth import hash_token, needs_renewal, new_password_error, normalize_login


def test_normalize_login() -> None:
    assert normalize_login("  Admin ") == "admin"


def test_hash_token_is_sha256_hex() -> None:
    digest = hash_token("abc")
    assert len(digest) == 64
    assert digest == hash_token("abc")
    assert digest != hash_token("abd")


def test_needs_renewal() -> None:
    now = datetime(2026, 10, 21, tzinfo=UTC)
    assert needs_renewal(now + timedelta(days=30), now) is False
    assert needs_renewal(now + timedelta(days=29) - timedelta(seconds=1), now) is True
    assert needs_renewal(now + timedelta(days=29), now) is False


def test_new_password_error() -> None:
    assert new_password_error("a" * 10, "a" * 10) is None
    assert new_password_error("a" * 9, "a" * 9) == "Пароль короче 10 символов"
    assert new_password_error("a" * 10, "b" * 10) == "Пароли не совпадают"
    assert new_password_error("a" * 9, "b" * 9) == "Пароли не совпадают"
