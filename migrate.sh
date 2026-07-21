#!/usr/bin/env sh
set -eu
test -f .env || { echo ".env is required" >&2; exit 1; }
docker compose --env-file .env run --rm migrate
