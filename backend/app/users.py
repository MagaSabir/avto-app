import argparse
import asyncio
import getpass
import sys
from collections.abc import Callable

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.db import SessionLocal
from app.domain.auth import new_password_error, normalize_login
from app.services import auth


async def run_set_password(
    login: str,
    read_password: Callable[[str], str],
    session_factory: async_sessionmaker[AsyncSession],
) -> int:
    name = normalize_login(login)
    if not name:
        print("Введите логин", file=sys.stderr)
        return 1
    password = read_password("Пароль: ")
    confirm = read_password("Повторите пароль: ")
    error = new_password_error(password, confirm)
    if error:
        print(error, file=sys.stderr)
        return 1
    async with session_factory() as session:
        created = await auth.set_password(session, name, password)
    if created:
        print(f"Пользователь {name} создан")
    else:
        print(f"Пароль {name} изменён, все сессии завершены")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.users")
    sub = parser.add_subparsers(dest="command", required=True)
    set_password = sub.add_parser("set-password", help="create a user or change their password")
    set_password.add_argument("login")
    args = parser.parse_args()
    sys.exit(asyncio.run(run_set_password(args.login, getpass.getpass, SessionLocal)))


if __name__ == "__main__":
    main()
