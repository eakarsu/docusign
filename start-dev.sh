#!/usr/bin/env sh
set -eu
test -f backend/.env || { echo "backend/.env is required; copy backend/.env.example and provide real values" >&2; exit 1; }
test -d backend/node_modules || { echo "Run npm ci --prefix backend first" >&2; exit 1; }
test -d frontend/node_modules || { echo "Run npm ci --prefix frontend first" >&2; exit 1; }
trap 'kill 0 2>/dev/null || true' INT TERM EXIT
npm run dev --prefix backend &
npm start --prefix frontend &
wait
