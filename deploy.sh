#!/usr/bin/env bash
# Production deploy: pull, build, back up, migrate, restart, health-check, roll back on failure.
# Runs as user "deploy"; also used as the SSH forced command for CD (takes no arguments, ignores stdin).
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/deploy/avto_app}"
BACKUP_DIR="${BACKUP_DIR:-/home/deploy/backups}"
HEALTH_URL="${HEALTH_URL:-https://api.rossmik.ru/api/health}"
# The very first deploy (Let's Encrypt issuance) should be run with HEALTH_TIMEOUT=180
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
LOCK_FILE="${LOCK_FILE:-${HOME}/deploy.lock}"
# The first deploy (before the PR is merged) runs with DEPLOY_BRANCH=feature/deploy
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
KEEP_PRE_DEPLOY=10

STEP="запуск"
MAIN_PID=$$
OLD_RUNNING=0 # a previous api container was running before this deploy
STARTED=0     # containers were (re)started by this deploy

dc() { docker compose -p avto_prod -f "$APP_DIR/docker-compose.prod.yml" --env-file "$APP_DIR/.env" "$@"; }

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

on_error() {
  local code=$?
  # Command substitutions inherit the trap; report only from the main shell
  [ "$BASHPID" = "$MAIN_PID" ] || exit "$code"
  printf 'Выкат прерван на шаге: %s (код %s)\n' "$STEP" "$code" >&2
  if [ "$OLD_RUNNING" = 1 ] && [ "$STARTED" = 0 ]; then
    echo "Предыдущая версия продолжает работать." >&2
  fi
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

check_branch() {
  STEP="проверка ветки"
  local branch
  branch="$(git -C "$APP_DIR" symbolic-ref --short HEAD </dev/null)"
  log "Ветка $branch, коммит $(git -C "$APP_DIR" rev-parse --short HEAD </dev/null)"
  if [ "$branch" != "$DEPLOY_BRANCH" ]; then
    echo "На сервере выбрана ветка $branch, а выкатывается $DEPLOY_BRANCH. Выкат отменён." >&2
    exit 1
  fi
}

pull_code() {
  STEP="обновление кода (git pull)"
  log "Обновляю код из origin/$DEPLOY_BRANCH"
  GIT_TERMINAL_PROMPT=0 git -C "$APP_DIR" pull --ff-only origin "$DEPLOY_BRANCH" </dev/null
}

tag_previous() {
  STEP="сохранение предыдущего образа"
  local cid
  cid="$(dc ps -q api </dev/null)"
  if [ -n "$cid" ]; then
    # Tag the image of the running container, not :latest (which may be a never-run build)
    docker tag "$(docker inspect -f '{{.Image}}' "$cid")" avto_api:previous
    OLD_RUNNING=1
    log "Работающая версия сохранена как avto_api:previous"
  else
    log "Первый выкат — предыдущей версии нет, откатываться некуда"
  fi
}

build_api() {
  STEP="сборка образа api"
  log "Собираю образ api"
  dc build api
}

backup_db() {
  STEP="резервная копия БД"
  local dir="$BACKUP_DIR/pre-deploy" file tmp running
  running="$(dc ps --status running -q db </dev/null)"
  if [ -z "$running" ]; then
    log "База не запущена — резервная копия пропущена"
    return 0
  fi
  mkdir -p "$dir"
  file="$dir/avto-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
  tmp="$file.part"
  log "Делаю резервную копию: $file"
  # Credentials come from the container's own environment
  # shellcheck disable=SC2016
  if ! dc exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' </dev/null | gzip >"$tmp"; then
    rm -f "$tmp"
    return 1
  fi
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
  STARTED=1
  if ! dc up -d </dev/null; then
    rollback "не удалось запустить контейнеры"
  fi
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

rollback() {
  STEP="откат"
  echo "Выкат не удался: $1." >&2
  if docker image inspect avto_api:previous >/dev/null 2>&1; then
    docker tag avto_api:previous avto_api:latest
    dc up -d api </dev/null
    echo "Возвращена предыдущая версия; смотрите: docker compose -p avto_prod logs api" >&2
    if wait_health; then
      echo "Предыдущая версия работает." >&2
    else
      echo "Предыдущая версия тоже не отвечает — нужна ручная проверка." >&2
    fi
  else
    echo "Предыдущей версии нет, откат невозможен; смотрите: docker compose -p avto_prod logs api" >&2
  fi
  exit 1
}

check_health() {
  STEP="проверка работоспособности"
  log "Жду ответа $HEALTH_URL (до ${HEALTH_TIMEOUT} с)"
  if wait_health; then
    return 0
  fi
  rollback "$HEALTH_URL не ответил за ${HEALTH_TIMEOUT} с"
}

main() {
  # Survive a dropped SSH session (CD): ignore HUP/PIPE and mirror all output to a log file
  trap '' HUP PIPE
  LOG="${LOG:-$HOME/deploy.log}"
  exec > >(tee -a "$LOG" --output-error=warn-nopipe) 2>&1
  trap on_error ERR
  printf '=== Выкат %s UTC ===\n' "$(date -u '+%F %T')"
  take_lock
  check_branch
  pull_code
  tag_previous
  build_api
  backup_db
  run_migrations
  start_stack
  check_health
  STEP="завершение"
  # Remove dangling images left by rebuilds
  docker image prune -f >/dev/null || true
  log "Выкат завершён: $(git -C "$APP_DIR" rev-parse --short HEAD)"
}

main "$@"
