from functools import lru_cache

from app.core.config import Settings, get_settings
from app.suppliers.base import Supplier
from app.suppliers.rossko import RosskoSupplier


def build_suppliers(settings: Settings) -> dict[str, Supplier]:
    suppliers: dict[str, Supplier] = {}
    for code in settings.suppliers:
        if code == "rossko":
            suppliers[code] = RosskoSupplier(
                settings.rossko_key1,
                settings.rossko_key2,
                settings.rossko_delivery_id,
                settings.rossko_address_id,
            )
        else:
            raise ValueError(f"Unknown supplier: {code}")
    return suppliers


@lru_cache
def get_suppliers() -> dict[str, Supplier]:
    return build_suppliers(get_settings())
