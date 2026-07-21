#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$project_dir"

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
# starts only the already-built API process and never installs or seeds data.
exec npm start --prefix backend
