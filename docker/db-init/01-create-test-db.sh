#!/bin/bash
# Creates the database used by backend tests (runs only on first start of an empty volume).
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "CREATE DATABASE avto_test OWNER \"$POSTGRES_USER\""
