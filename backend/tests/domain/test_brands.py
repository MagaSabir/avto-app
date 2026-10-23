import pytest

from app.domain.brands import canonical_brand, part_key


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Mann", "MANN"),
        ("MANN-FILTER", "MANN"),
        ("mann - filter", "MANN"),
        ("Meat & Doria", "MEAT&DORIA"),
        ("Meat&Doria", "MEAT&DORIA"),
        ("CITROEN/PEUGEOT", "CITROEN/PEUGEOT"),
        ("Citroen / Peugeot", "CITROEN/PEUGEOT"),
        ("  bosch ", "BOSCH"),
    ],
)
def test_canonical_brand(raw: str, expected: str) -> None:
    assert canonical_brand(raw) == expected


def test_rossko_and_mikado_keys_match() -> None:
    assert part_key("Mann", "W683") == part_key("MANN-FILTER", "W683") == "MANN|W683"
