from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import User


async def get_by_login(session: AsyncSession, login: str) -> User | None:
    return await session.scalar(select(User).where(User.login == login))


async def add(session: AsyncSession, login: str, password_hash: str) -> User:
    user = User(login=login, password_hash=password_hash)
    session.add(user)
    await session.flush()
    return user
