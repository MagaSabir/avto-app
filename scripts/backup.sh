#!/usr/bin/env bash
# Daily database dump: gzip into $BACKUP_DIR/daily, keep the newest 14. Run as user "deploy" (systemd timer).
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/deploy/avto_app}"
BACKUP_DIR="${BACKUP_DIR:-/home/deploy/backups}"
KEEP_DAILY=14

dc() { docker compose -p avto_prod -f "$APP_DIR/docker-compose.prod.yml" --env-file "$APP_DIR/.env" "$@"; }

# Read only the two needed keys; the rest of .env is not sourced
env_value() { grep -m1 "^$1=" "$APP_DIR/.env" | cut -d= -f2-; }

main() {
  trap 'echo "Резервная копия не создана" >&2' ERR
  local user db dir file tmp
  user="$(env_value POSTGRES_USER)"
  db="$(env_value POSTGRES_DB)"
  if [ -z "$user" ] || [ -z "$db" ]; then
    echo "В $APP_DIR/.env не заданы POSTGRES_USER / POSTGRES_DB" >&2
    exit 1
  fi
  dir="$BACKUP_DIR/daily"
  mkdir -p "$dir"
  file="$dir/avto-$(date -u +%F).sql.gz"
  tmp="$file.part"
  rm -f "$tmp"
  dc exec -T db pg_dump -U "$user" "$db" </dev/null | gzip >"$tmp"
  mv "$tmp" "$file"
  echo "Резервная копия создана: $file"
  # shellcheck disable=SC2012
  ls -1t "$dir"/*.sql.gz 2>/dev/null | tail -n +$((KEEP_DAILY + 1)) | xargs -r rm -f --
}

main "$@"
