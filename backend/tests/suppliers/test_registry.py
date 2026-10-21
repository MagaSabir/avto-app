import pytest

from app.core.config import Settings
from app.suppliers import build_suppliers
from app.suppliers.rossko import RosskoSupplier


def test_builds_rossko() -> None:
    settings = Settings(_env_file=None, database_url="x", suppliers=["rossko"])  # type: ignore[call-arg]
    assert isinstance(build_suppliers(settings)["rossko"], RosskoSupplier)


def test_unknown_code_raises() -> None:
    # Settings rejects unknown codes itself; bypass it to check the registry guard.
    settings = Settings.model_construct(suppliers=["nope"])
    with pytest.raises(ValueError):
        build_suppliers(settings)
