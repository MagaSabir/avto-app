import re

import httpx

from app.main import create_app

PUBLIC = {("GET", "/api/health"), ("POST", "/api/auth/login"), ("POST", "/api/auth/logout")}
BODY_METHODS = {"POST", "PATCH", "DELETE"}


async def test_all_routes_require_login(anon_client: httpx.AsyncClient) -> None:
    checked: set[tuple[str, str]] = set()
    # Included routers are wrapped lazily, so the route list comes from the OpenAPI schema.
    for route_path, operations in create_app().openapi()["paths"].items():
        path = re.sub(r"\{[^}]+\}", "1", route_path)
        for method in (m.upper() for m in operations):
            checked.add((method, route_path))
            kwargs = {"json": {}} if method in BODY_METHODS else {}
            response = await anon_client.request(method, path, **kwargs)
            if (method, route_path) in PUBLIC:
                assert response.status_code != 401, (method, route_path)
            else:
                assert response.status_code == 401, (method, route_path, response.status_code)
    paths = {path for _, path in checked}
    assert "/api/stock/items" in paths
    assert "/api/search" in paths
    assert "/api/suppliers/{code}/settlements" in paths
