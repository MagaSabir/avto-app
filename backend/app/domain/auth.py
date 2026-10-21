import hashlib
from datetime import datetime, timedelta

SESSION_TTL = timedelta(days=30)
RENEW_THRESHOLD = timedelta(days=29)
MIN_PASSWORD_LENGTH = 10


def normalize_login(raw: str) -> str:
    return raw.strip().lower()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def needs_renewal(expires_at: datetime, now: datetime) -> bool:
    return expires_at - now < RENEW_THRESHOLD


def new_password_error(password: str, confirm: str) -> str | None:
    if password != confirm:
        return "Пароли не совпадают"
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Пароль короче {MIN_PASSWORD_LENGTH} символов"
    return None
