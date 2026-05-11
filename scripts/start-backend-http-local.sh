#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT_OVERRIDE="${BACKEND_PORT:-}"
BACKEND_DB_PATH_OVERRIDE="${BACKEND_DB_PATH:-}"
BACKEND_ARTIFACTS_DIR_OVERRIDE="${BACKEND_ARTIFACTS_DIR:-}"

# shellcheck source=./lib/load-smartkols-env.sh
. "$ROOT_DIR/scripts/lib/load-smartkols-env.sh"

load_required_env_file "$ROOT_DIR/.env.backend-http.local"

if [ -n "$BACKEND_PORT_OVERRIDE" ]; then
  export BACKEND_PORT="$BACKEND_PORT_OVERRIDE"
fi
if [ -n "$BACKEND_DB_PATH_OVERRIDE" ]; then
  export BACKEND_DB_PATH="$BACKEND_DB_PATH_OVERRIDE"
fi
if [ -n "$BACKEND_ARTIFACTS_DIR_OVERRIDE" ]; then
  export BACKEND_ARTIFACTS_DIR="$BACKEND_ARTIFACTS_DIR_OVERRIDE"
fi

load_llm_overlay

mkdir -p "$BACKEND_ARTIFACTS_DIR"

cd "$ROOT_DIR"
exec npm run backend:dev
