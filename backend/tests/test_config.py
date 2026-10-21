import pytest
from pydantic import ValidationError

from app.core.config import Settings


def make_settings(cors_origins: str) -> Settings:
    return Settings(_env_file=None, database_url="x", cors_origins=cors_origins)  # type: ignore[call-arg]


def test_cors_origins_parsed_from_comma_string() -> None:
    settings = make_settings("https://a.vercel.app, https://b.vercel.app,")
    assert settings.cors_origins == ["https://a.vercel.app", "https://b.vercel.app"]


def test_cors_origins_empty_string_is_empty_list() -> None:
    assert make_settings("").cors_origins == []


@pytest.mark.parametrize("value", ["*", "https://a.app,*"])
def test_cors_origins_rejects_wildcard(value: str) -> None:
    with pytest.raises(ValidationError):
        make_settings(value)


def test_cors_origins_strip_trailing_slash() -> None:
    settings = make_settings("https://avto.vercel.app/")
    assert settings.cors_origins == ["https://avto.vercel.app"]


def test_suppliers_parsed_from_comma_string() -> None:
    settings = Settings(_env_file=None, database_url="x", suppliers="rossko, ")  # type: ignore[call-arg]
    assert settings.suppliers == ["rossko"]


def test_rossko_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "SUPPLIERS",
        "ROSSKO_KEY1",
        "ROSSKO_KEY2",
        "ROSSKO_DELIVERY_ID",
        "ROSSKO_ADDRESS_ID",
    ):
        monkeypatch.delenv(name, raising=False)
    settings = Settings(_env_file=None, database_url="x")  # type: ignore[call-arg]
    assert settings.rossko_key1 == ""
    assert settings.rossko_key2 == ""
    assert settings.rossko_delivery_id == "000000002"
    assert settings.rossko_address_id == "171801"
    assert settings.suppliers == ["rossko"]


def test_rossko_keys_not_in_repr() -> None:
    settings = Settings(  # type: ignore[call-arg]
        _env_file=None, database_url="x", rossko_key1="SECRET1", rossko_key2="SECRET2"
    )
    assert "SECRET" not in repr(settings)


def test_suppliers_rejects_unknown_code() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url="x", suppliers="nope")  # type: ignore[call-arg]
