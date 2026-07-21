#!/usr/bin/env sh
set -eu
test "${ALLOW_DATABASE_RESTORE:-}" = "YES" || { echo "Set ALLOW_DATABASE_RESTORE=YES after confirming the target database" >&2; exit 1; }
test -n "${DATABASE_URL:-}" || { echo "DATABASE_URL is required" >&2; exit 1; }
source_dump=${1:-}
test -f "$source_dump" || { echo "A valid backup file is required" >&2; exit 1; }
pg_restore --list "$source_dump" >/dev/null
pg_restore --exit-on-error --single-transaction --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$source_dump"
