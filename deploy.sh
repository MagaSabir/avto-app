#!/usr/bin/env bash
# Production deploy: pull, build, back up, migrate, restart, health-check, roll back on failure.
# Runs as user "deploy"; also used as the SSH forced command for CD (takes no arguments, ignores stdin).
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/deploy/avto_app}"
BACKUP_DIR="${BACKUP_DIR:-/home/deploy/backups}"
HEALTH_URL="${HEALTH_URL:-https://api.rossmik.ru/api/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
LOCK_FILE="${LOCK_FILE:-${HOME}/deploy.lock}"
KEEP_PRE_DEPLOY=10

STEP="запуск"

dc() { docker compose -p avto_prod -f "$APP_DIR/docker-compose.prod.yml" --env-file "$APP_DIR/.env" "$@"; }

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

on_error() {
  local code=$?
  printf 'Выкат прерван на шаге: %s (код %s)\n' "$STEP" "$code" >&2
  exit "$code"
}

take_lock() {
  STEP="блокировка"
  mkdir -p "$(dirname "$LOCK_FILE")"
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    echo "Другой выкат уже идёт (блокировка $LOCK_FILE). Повторите позже." >&2
    exit 1
  fi
}

pull_code() {
  STEP="обновление кода (git pull)"
  log "Обновляю код из origin/main"
  git -C "$APP_DIR" pull --ff-only origin main
}

tag_previous() {
  STEP="сохранение предыдущего образа"
  if docker image inspect avto_api:latest >/dev/null 2>&1; then
    docker tag avto_api:latest avto_api:previous
    log "Предыдущая версия сохранена как avto_api:previous"
  else
    log "Первый выкат — предыдущей версии нет"
  fi
}

build_api() {
  STEP="сборка образа api"
  log "Собираю образ api"
  dc build api
}

backup_db() {
  STEP="резервная копия БД"
  local dir="$BACKUP_DIR/pre-deploy" file tmp
  if [ -z "$(dc ps --status running -q db)" ]; then
    log "База не запущена — резервная копия пропущена"
    return 0
  fi
  mkdir -p "$dir"
  file="$dir/avto-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
  tmp="$file.part"
  log "Делаю резервную копию: $file"
  # Credentials come from the container's own environment
  # shellcheck disable=SC2016
  dc exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' </dev/null | gzip >"$tmp"
  mv "$tmp" "$file"
  # Keep only the newest copies
  # shellcheck disable=SC2012
  ls -1t "$dir"/*.sql.gz 2>/dev/null | tail -n +$((KEEP_PRE_DEPLOY + 1)) | xargs -r rm -f --
}

run_migrations() {
  STEP="миграции БД"
  log "Применяю миграции"
  dc run --rm -T api alembic upgrade head </dev/null
}

start_stack() {
  STEP="запуск контейнеров"
  log "Запускаю контейнеры"
  dc up -d </dev/null
}

wait_health() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if curl -fsS -o /dev/null --max-time 5 "$HEALTH_URL" 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

check_health() {
  STEP="проверка работоспособности"
  log "Жду ответа $HEALTH_URL (до ${HEALTH_TIMEOUT} с)"
  if wait_health; then
    return 0
  fi
  STEP="откат"
  echo "Выкат не удался: $HEALTH_URL не ответил за ${HEALTH_TIMEOUT} с." >&2
  if docker image inspect avto_api:previous >/dev/null 2>&1; then
    docker tag avto_api:previous avto_api:latest
    dc up -d api </dev/null
    echo "Возвращена предыдущая версия; смотрите: docker compose -p avto_prod logs api" >&2
  else
    echo "Предыдущей версии нет, откат невозможен; смотрите: docker compose -p avto_prod logs api" >&2
  fi
  exit 1
}

main() {
  trap on_error ERR
  take_lock
  pull_code
  tag_previous
  build_api
  backup_db
  run_migrations
  start_stack
  check_health
  STEP="завершение"
  log "Выкат завершён: $(git -C "$APP_DIR" rev-parse --short HEAD)"
}

main "$@"
