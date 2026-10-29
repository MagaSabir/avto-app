import pytest

from app.domain.customers import normalize_phone, normalize_plate, normalize_vin


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("8 (916) 123-45-67", "79161234567"),
        ("+7 916 123 45 67", "79161234567"),
        ("9161234567", "79161234567"),
        ("1234", None),
        ("", None),
        ("+49 30 1234567", "49301234567"),
    ],
)
def test_normalize_phone(raw: str, expected: str | None) -> None:
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("a123bc 77", "А123ВС77"),
        ("А123ВС77", "А123ВС77"),
        ("a-123-bc-77", "А123ВС77"),
        ("", None),
        ("  - ", None),
    ],
)
def test_normalize_plate(raw: str, expected: str | None) -> None:
    assert normalize_plate(raw) == expected


def test_normalize_vin_valid() -> None:
    assert normalize_vin(" jtdbr32e730012345 ") == "JTDBR32E730012345"


@pytest.mark.parametrize("raw", ["JTDBR32E73001234", "JTDBR32E7300O2345", "JTDBR32E730012345X"])
def test_normalize_vin_invalid(raw: str) -> None:
    with pytest.raises(ValueError):
        normalize_vin(raw)


def test_normalize_vin_empty() -> None:
    assert normalize_vin("") is None
    assert normalize_vin("  ") is None
