#!/usr/bin/env bash
set -euo pipefail

# Local demo credential bridge (managed by tools/fix_demo_autofill.mjs)
demo_credentials_project_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ -f "$demo_credentials_project_dir/.env" ]; then
  while IFS= read -r demo_credentials_line || [ -n "$demo_credentials_line" ]; do
    case "$demo_credentials_line" in ''|'#'*) continue ;; esac
    demo_credentials_line="${demo_credentials_line#export }"
    demo_credentials_key="${demo_credentials_line%%=*}"
    demo_credentials_value="${demo_credentials_line#*=}"
    case "$demo_credentials_key" in
      NODE_ENV|ENABLE_DEMO_CREDENTIAL_AUTOFILL|DEMO_EMAIL|DEMO_PASSWORD|SEED_ADMIN_EMAIL|SEED_ADMIN_PASSWORD|SEED_USER_EMAIL|SEED_USER_PASSWORD|PROVISION_ADMIN_EMAIL|PROVISION_ADMIN_PASSWORD|BOOTSTRAP_ADMIN_EMAIL|BOOTSTRAP_ADMIN_PASSWORD|ADMIN_EMAIL|ADMIN_PASSWORD|DEFAULT_EMAIL|DEFAULT_PASSWORD|DEMO_TENANT|BOOTSTRAP_TENANT_SLUG|GOVERNANCE_TENANT_ID|TENANT_ID) ;;
      *) continue ;;
    esac
    [ -n "${!demo_credentials_key+x}" ] && continue
    demo_credentials_first="${demo_credentials_value:0:1}"
    demo_credentials_last="${demo_credentials_value: -1}"
    if { [ "$demo_credentials_first" = '"' ] && [ "$demo_credentials_last" = '"' ]; } || { [ "$demo_credentials_first" = "'" ] && [ "$demo_credentials_last" = "'" ]; }; then
      demo_credentials_value="${demo_credentials_value:1:${#demo_credentials_value}-2}"
    fi
    export "$demo_credentials_key=$demo_credentials_value"
  done < "$demo_credentials_project_dir/.env"
fi
demo_credentials_email=""
demo_credentials_password=""
demo_credentials_tenant="${DEMO_TENANT:-${BOOTSTRAP_TENANT_SLUG:-${GOVERNANCE_TENANT_ID:-${TENANT_ID:-}}}}"
demo_credentials_tenant="${DEMO_TENANT:-${BOOTSTRAP_TENANT_SLUG:-${GOVERNANCE_TENANT_ID:-${TENANT_ID:-}}}}"
demo_credentials_tenant="${DEMO_TENANT:-${BOOTSTRAP_TENANT_SLUG:-${GOVERNANCE_TENANT_ID:-${TENANT_ID:-}}}}"
if [ -n "${PROVISION_ADMIN_EMAIL:-}" ] && [ -n "${PROVISION_ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$PROVISION_ADMIN_EMAIL"
  demo_credentials_password="$PROVISION_ADMIN_PASSWORD"
elif [ -n "${BOOTSTRAP_ADMIN_EMAIL:-}" ] && [ -n "${BOOTSTRAP_ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$BOOTSTRAP_ADMIN_EMAIL"
  demo_credentials_password="$BOOTSTRAP_ADMIN_PASSWORD"
elif [ -n "${SEED_ADMIN_EMAIL:-}" ] && [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$SEED_ADMIN_EMAIL"
  demo_credentials_password="$SEED_ADMIN_PASSWORD"
elif [ -n "${SEED_USER_EMAIL:-}" ] && [ -n "${SEED_USER_PASSWORD:-}" ]; then
  demo_credentials_email="$SEED_USER_EMAIL"
  demo_credentials_password="$SEED_USER_PASSWORD"
elif [ -n "${DEMO_EMAIL:-}" ] && [ -n "${DEMO_PASSWORD:-}" ]; then
  demo_credentials_email="$DEMO_EMAIL"
  demo_credentials_password="$DEMO_PASSWORD"
elif [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$ADMIN_EMAIL"
  demo_credentials_password="$ADMIN_PASSWORD"
elif [ -n "${DEFAULT_EMAIL:-}" ] && [ -n "${DEFAULT_PASSWORD:-}" ]; then
  demo_credentials_email="$DEFAULT_EMAIL"
  demo_credentials_password="$DEFAULT_PASSWORD"
fi
if [ "${NODE_ENV:-development}" != production ] && [ "${ENABLE_DEMO_CREDENTIAL_AUTOFILL:-true}" = true ] && [ -n "$demo_credentials_email" ] && [ -n "$demo_credentials_password" ]; then
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export NEXT_PUBLIC_DEMO_EMAIL="$demo_credentials_email"
  export NEXT_PUBLIC_DEMO_PASSWORD="$demo_credentials_password"
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export VITE_DEMO_EMAIL="$demo_credentials_email"
  export VITE_DEMO_PASSWORD="$demo_credentials_password"
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export REACT_APP_DEMO_EMAIL="$demo_credentials_email"
  export REACT_APP_DEMO_PASSWORD="$demo_credentials_password"
  if [ -n "$demo_credentials_tenant" ]; then
    export NEXT_PUBLIC_DEMO_TENANT="$demo_credentials_tenant"
    export VITE_DEMO_TENANT="$demo_credentials_tenant"
    export REACT_APP_DEMO_TENANT="$demo_credentials_tenant"
  else
    unset NEXT_PUBLIC_DEMO_TENANT VITE_DEMO_TENANT REACT_APP_DEMO_TENANT
  fi
else
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  unset NEXT_PUBLIC_DEMO_EMAIL NEXT_PUBLIC_DEMO_PASSWORD NEXT_PUBLIC_DEMO_TENANT
  unset VITE_DEMO_EMAIL VITE_DEMO_PASSWORD VITE_DEMO_TENANT
  unset REACT_APP_DEMO_EMAIL REACT_APP_DEMO_PASSWORD REACT_APP_DEMO_TENANT
fi
unset demo_credentials_email demo_credentials_password demo_credentials_tenant demo_credentials_project_dir demo_credentials_line demo_credentials_key demo_credentials_value demo_credentials_first demo_credentials_last

project_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$project_dir"

if [[ -f "$project_dir/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$project_dir/.env"
  set +a
fi

if [[ "${NODE_ENV:-development}" != "production" && "${ENABLE_DEMO_CREDENTIAL_AUTOFILL:-true}" == "true" ]]; then
  export DEMO_EMAIL="${DEMO_EMAIL:-demo.sender@docusign.local}"
  export DEMO_PASSWORD="${DEMO_PASSWORD:-$(node -e 'const c=require("node:crypto");process.stdout.write(c.createHmac("sha256",process.argv[1]).update("docusign-local-demo-v1").digest("base64url").slice(0,24)+"!aA1")' "$JWT_SECRET")}"
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export VITE_DEMO_EMAIL="$DEMO_EMAIL"
  export VITE_DEMO_PASSWORD="$DEMO_PASSWORD"
  (cd "$project_dir/backend" && ./node_modules/.bin/ts-node scripts/provision-demo-credentials.ts)
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
