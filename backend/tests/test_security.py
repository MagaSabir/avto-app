from app.core.security import (
    hash_password,
    new_session_token,
    password_needs_rehash,
    verify_dummy_password,
    verify_password,
)


def test_hash_and_verify_password() -> None:
    password_hash = hash_password("correct horse")
    assert verify_password(password_hash, "correct horse") is True
    assert verify_password(password_hash, "wrong") is False
    assert verify_password("not-a-hash", "correct horse") is False
    assert password_needs_rehash(password_hash) is False


def test_verify_dummy_password_returns_none() -> None:
    assert verify_dummy_password("anything") is None


def test_new_session_token_unique_and_long() -> None:
    first, second = new_session_token(), new_session_token()
    assert len(first) >= 43
    assert first != second
