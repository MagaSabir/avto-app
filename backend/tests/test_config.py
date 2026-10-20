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
