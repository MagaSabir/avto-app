import pytest

from app.domain.cart import cap_qty, valid_qty


@pytest.mark.parametrize(
    ("qty", "multiplicity", "available", "expected"),
    [
        (1, 1, 5, True),
        (5, 1, 5, True),
        (6, 1, 5, False),
        (0, 1, 5, False),
        (-2, 2, 10, False),
        (4, 2, 10, True),
        (3, 2, 10, False),
        (10, 4, 10, False),
        (8, 4, 10, True),
        (2, 2, 1, False),
    ],
)
def test_valid_qty(qty: int, multiplicity: int, available: int, expected: bool) -> None:
    assert valid_qty(qty, multiplicity, available) is expected


@pytest.mark.parametrize(
    ("qty", "multiplicity", "available", "expected"),
    [
        (7, 1, 5, 5),
        (12, 4, 10, 8),
        (4, 4, 10, 4),
        (6, 4, 10, 4),
        (4, 4, 3, 0),
        (3, 1, 0, 0),
    ],
)
def test_cap_qty(qty: int, multiplicity: int, available: int, expected: int) -> None:
    assert cap_qty(qty, multiplicity, available) == expected
