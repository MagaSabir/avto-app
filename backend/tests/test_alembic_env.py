import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def test_alembic_accepts_percent_encoded_database_url() -> None:
    # Offline mode renders SQL without connecting, so only URL handling is exercised.
    env = {
        "DATABASE_URL": "postgresql+asyncpg://avto:p%40ss@127.0.0.1:5433/avto",
        "PATH": "",
    }
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
