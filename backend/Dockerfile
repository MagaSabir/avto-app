FROM python:3.12-slim AS build
RUN pip install --no-cache-dir uv==0.13.3
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy uv sync --frozen --no-dev --no-install-project
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

FROM python:3.12-slim
RUN useradd --system --uid 10001 --no-create-home app
COPY --from=build /app /app
WORKDIR /app
ENV PATH=/app/.venv/bin:$PATH PYTHONUNBUFFERED=1
USER app
EXPOSE 8000
CMD ["fastapi","run","app/main.py","--host","0.0.0.0","--port","8000","--proxy-headers","--forwarded-allow-ips=*"]
