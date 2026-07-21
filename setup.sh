#!/usr/bin/env sh
set -eu
command -v node >/dev/null 2>&1 || { echo "Node.js is required" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required" >&2; exit 1; }
node_major=$(node -p "process.versions.node.split('.')[0]")
test "$node_major" -ge 24 || { echo "Node.js 24 or newer is required" >&2; exit 1; }
npm ci --prefix backend
DATABASE_URL=postgresql://setup:setup@127.0.0.1:5432/setup npm run prisma:generate --prefix backend
npm ci --prefix frontend
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  chmod 600 backend/.env
  echo "Created backend/.env with fail-closed placeholders; replace every placeholder before starting."
fi
echo "Dependencies installed. Run migrations explicitly, then use ./start-dev.sh."
