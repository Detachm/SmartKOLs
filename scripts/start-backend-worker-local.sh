#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <all|agent-worker|publisher-worker|ingestion-worker|engagement-worker|editorial-worker>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER_NAME_INPUT="$1"
BACKEND_DB_PATH_OVERRIDE="${BACKEND_DB_PATH:-}"
BACKEND_ARTIFACTS_DIR_OVERRIDE="${BACKEND_ARTIFACTS_DIR:-}"

# shellcheck source=./lib/load-smartkols-env.sh
. "$ROOT_DIR/scripts/lib/load-smartkols-env.sh"

case "$WORKER_NAME_INPUT" in
  all|agent-worker|publisher-worker|ingestion-worker|engagement-worker|editorial-worker)
    ;;
  *)
    echo "invalid worker name: $WORKER_NAME_INPUT" >&2
    exit 1
    ;;
esac

load_required_env_file "$ROOT_DIR/.env.backend-worker.local"

if [ -n "$BACKEND_DB_PATH_OVERRIDE" ]; then
  export BACKEND_DB_PATH="$BACKEND_DB_PATH_OVERRIDE"
fi
if [ -n "$BACKEND_ARTIFACTS_DIR_OVERRIDE" ]; then
  export BACKEND_ARTIFACTS_DIR="$BACKEND_ARTIFACTS_DIR_OVERRIDE"
fi

load_llm_overlay

if [ "${LLM_ENABLED:-false}" != "true" ] && { [ "$WORKER_NAME_INPUT" = "all" ] || [ "$WORKER_NAME_INPUT" = "agent-worker" ]; }; then
  echo "worker '$WORKER_NAME_INPUT' requires a valid LLM key in .env.zhipu.local or .env.openai.local" >&2
  exit 1
fi

export WORKER_NAME="$WORKER_NAME_INPUT"

cd "$ROOT_DIR"
exec npm run backend:worker
