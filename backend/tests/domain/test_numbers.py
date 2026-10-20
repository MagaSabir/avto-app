import pytest

from app.domain.numbers import normalize_brand, normalize_number


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("W 68/3", "W683"),
        ("w68/3", "W683"),
        ("0 986-452.041", "0986452041"),
        ("BKR5EKB-11@7804", "BKR5EKB11"),
        ("  gdb1550 ", "GDB1550"),
        ("@123", ""),
    ],
)
def test_normalize_number(raw: str, expected: str) -> None:
    assert normalize_number(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (" mann  filter ", "MANN FILTER"),
        ("Febi Bilstein", "FEBI BILSTEIN"),
        ("MANN-FILTER", "MANN-FILTER"),
    ],
)
def test_normalize_brand(raw: str, expected: str) -> None:
    assert normalize_brand(raw) == expected
