#!/usr/bin/env sh
set -eu
test -n "${DATABASE_URL:-}" || { echo "DATABASE_URL is required" >&2; exit 1; }
destination=${1:-}
test -n "$destination" || { echo "Usage: DATABASE_URL=... ./backup.sh /absolute/path/backup.dump" >&2; exit 1; }
case "$destination" in /*) ;; *) echo "Backup path must be absolute" >&2; exit 1;; esac
umask 077
pg_dump --format=custom --no-owner --no-privileges --file="$destination" "$DATABASE_URL"
pg_restore --list "$destination" >/dev/null
echo "Verified backup: $destination"
