from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import AuthSession, User


async def add(
    session: AsyncSession, user_id: int, token_hash: str, expires_at: datetime
) -> AuthSession:
    auth_session = AuthSession(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
    session.add(auth_session)
    await session.flush()
    return auth_session


async def get_active(
    session: AsyncSession, token_hash: str, now: datetime
) -> tuple[AuthSession, User] | None:
    row = (
        await session.execute(
            select(AuthSession, User)
            .join(User, User.id == AuthSession.user_id)
            .where(AuthSession.token_hash == token_hash, AuthSession.expires_at > now)
        )
    ).first()
    return None if row is None else (row[0], row[1])


async def delete_by_token_hash(session: AsyncSession, token_hash: str) -> None:
    await session.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash))


async def delete_expired(session: AsyncSession, now: datetime) -> None:
    await session.execute(delete(AuthSession).where(AuthSession.expires_at <= now))


async def delete_for_user(session: AsyncSession, user_id: int) -> None:
    await session.execute(delete(AuthSession).where(AuthSession.user_id == user_id))
