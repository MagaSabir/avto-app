import logging

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import health as health_repository

logger = logging.getLogger(__name__)


async def is_database_up(session: AsyncSession) -> bool:
    try:
        await health_repository.ping(session)
    except (SQLAlchemyError, OSError):
        logger.warning("Database health check failed", exc_info=True)
        return False
    return True
