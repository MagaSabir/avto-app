#!/usr/bin/env bash
# Daily database dump: gzip into $BACKUP_DIR/daily, keep the newest 14. Run as user "deploy" (systemd timer).
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/deploy/avto_app}"
BACKUP_DIR="${BACKUP_DIR:-/home/deploy/backups}"
KEEP_DAILY=14

dc() { docker compose -p avto_prod -f "$APP_DIR/docker-compose.prod.yml" --env-file "$APP_DIR/.env" "$@"; }

main() {
  trap 'echo "Резервная копия не создана" >&2' ERR
  local dir file tmp
  dir="$BACKUP_DIR/daily"
  mkdir -p "$dir"
  file="$dir/avto-$(date -u +%F).sql.gz"
  tmp="$file.part"
  rm -f "$tmp"
  # Credentials come from the container's own environment
  # shellcheck disable=SC2016
  if ! dc exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' </dev/null | gzip >"$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  mv "$tmp" "$file"
  echo "Резервная копия создана: $file"
  # shellcheck disable=SC2012
  ls -1t "$dir"/*.sql.gz 2>/dev/null | tail -n +$((KEEP_DAILY + 1)) | xargs -r rm -f --
}

main "$@"
