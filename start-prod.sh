#!/usr/bin/env sh
set -eu
test -f .env || { echo ".env with production secrets and provider endpoints is required" >&2; exit 1; }
docker compose --env-file .env config --quiet
docker compose --env-file .env up --detach --no-build backend frontend
