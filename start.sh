#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$project_dir"

if [[ -f "$project_dir/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$project_dir/.env"
  set +a
fi

if [[ -d /opt/homebrew/opt/node@24/bin ]]; then
  export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
fi

if [[ "${NODE_ENV:-}" == "test" ]]; then
  export AUDIT_SIGNING_KEY="${AUDIT_SIGNING_KEY:-${JWT_REFRESH_SECRET:-runtime-audit-signing-key-32-characters}}"
  export AUDIT_SIGNING_KEY_ID="${AUDIT_SIGNING_KEY_ID:-runtime-test}"
  export MFA_ENCRYPTION_KEY="${MFA_ENCRYPTION_KEY:-${SESSION_SECRET:-runtime-mfa-encryption-key-32-characters}}"
  export REQUIRE_EMAIL_VERIFICATION=false
  export FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:${FRONTEND_PORT:-5827}}"
  export S3_BUCKET="${S3_BUCKET:-runtime-test-bucket}"
  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-runtime-test-access-key}"
  export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-runtime-test-secret-key}"
  export AWS_REGION="${AWS_REGION:-us-east-1}"
fi

# Schema changes remain an explicit release/bootstrap operation. This launcher
# starts only the already-built API and frontend processes; it never installs,
# seeds, or migrates data.
backend_port="${PORT:-}"
frontend_port="${FRONTEND_PORT:-${CLIENT_PORT:-}}"
[[ "$backend_port" =~ ^[0-9]+$ ]] || { echo "PORT must be an assigned numeric port." >&2; exit 2; }
[[ "$frontend_port" =~ ^[0-9]+$ ]] || { echo "FRONTEND_PORT or CLIENT_PORT must be an assigned numeric port." >&2; exit 2; }
[[ "$backend_port" != "$frontend_port" ]] || { echo "Backend and frontend ports must differ." >&2; exit 2; }

for port in "$backend_port" "$frontend_port"; do
  if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use; no process was stopped." >&2
    exit 1
  fi
done

npm start --prefix backend &
backend_pid=$!
npm start --prefix frontend -- --host 127.0.0.1 --port "$frontend_port" &
frontend_pid=$!

cleanup() {
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
  wait "$backend_pid" "$frontend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Signing Workflow is starting at http://127.0.0.1:$frontend_port"
wait "$backend_pid" "$frontend_pid"
