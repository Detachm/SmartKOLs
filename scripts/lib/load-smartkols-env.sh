#!/usr/bin/env bash
set -euo pipefail

SMARTKOLS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

load_required_env_file() {
  local file_path="$1"

  if [ ! -f "$file_path" ]; then
    echo "missing required env file: $file_path" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  . "$file_path"
  set +a
}

load_optional_env_file() {
  local file_path="$1"

  if [ -f "$file_path" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$file_path"
    set +a
  fi
}

clear_llm_env() {
  unset OPENAI_API_KEY || true
  unset OPENAI_BASE_URL || true
  unset OPENAI_MODEL || true
  unset OPENAI_REVIEW_MODEL || true
  unset OPENAI_REQUEST_TIMEOUT_MS || true
  unset OPENAI_REASONING_EFFORT || true
  unset OPENAI_STORE || true
  unset ZHIPU_API_KEY || true
  unset ZHIPU_BASE_URL || true
  unset ZHIPU_MODEL || true
  unset ZHIPU_REVIEW_MODEL || true
  unset ZHIPU_REQUEST_TIMEOUT_MS || true
  unset ZHIPU_AUTH_MODE || true
  unset LLM_PROVIDER || true
}

load_llm_overlay() {
  local selected_provider="${LLM_PROVIDER:-}"

  load_optional_env_file "$SMARTKOLS_ROOT/.env.openai.local"
  load_optional_env_file "$SMARTKOLS_ROOT/.env.zhipu.local"
  selected_provider="${LLM_PROVIDER:-$selected_provider}"

  if [ -z "$selected_provider" ]; then
    if [ -n "${ZHIPU_API_KEY:-}" ]; then
      selected_provider="zhipu"
    elif [ -n "${OPENAI_API_KEY:-}" ]; then
      selected_provider="openai"
    fi
  fi

  case "$selected_provider" in
    openai)
      if [ -z "${OPENAI_API_KEY:-}" ]; then
        clear_llm_env
        export LLM_ENABLED=false
        return
      fi
      unset ZHIPU_API_KEY || true
      unset ZHIPU_BASE_URL || true
      unset ZHIPU_MODEL || true
      unset ZHIPU_REVIEW_MODEL || true
      unset ZHIPU_REQUEST_TIMEOUT_MS || true
      unset ZHIPU_AUTH_MODE || true
      export LLM_ENABLED=true
      export LLM_PROVIDER="openai"
      export OPENAI_BASE_URL="${OPENAI_BASE_URL:-https://claudecode.love/v1}"
      export OPENAI_MODEL="${OPENAI_MODEL:-gpt-5.4}"
      export OPENAI_REQUEST_TIMEOUT_MS="${OPENAI_REQUEST_TIMEOUT_MS:-120000}"
      export OPENAI_REASONING_EFFORT="${OPENAI_REASONING_EFFORT:-xhigh}"
      export OPENAI_STORE="${OPENAI_STORE:-false}"
      return
      ;;
    zhipu)
      if [ -z "${ZHIPU_API_KEY:-}" ]; then
        clear_llm_env
        export LLM_ENABLED=false
        return
      fi
      unset OPENAI_API_KEY || true
      unset OPENAI_BASE_URL || true
      unset OPENAI_MODEL || true
      unset OPENAI_REVIEW_MODEL || true
      unset OPENAI_REQUEST_TIMEOUT_MS || true
      unset OPENAI_REASONING_EFFORT || true
      unset OPENAI_STORE || true
      export LLM_ENABLED=true
      export LLM_PROVIDER="zhipu"
      export ZHIPU_BASE_URL="${ZHIPU_BASE_URL:-https://open.bigmodel.cn/api/paas/v4}"
      export ZHIPU_MODEL="${ZHIPU_MODEL:-glm-5.1}"
      export ZHIPU_REVIEW_MODEL="${ZHIPU_REVIEW_MODEL:-$ZHIPU_MODEL}"
      export ZHIPU_REQUEST_TIMEOUT_MS="${ZHIPU_REQUEST_TIMEOUT_MS:-120000}"
      export ZHIPU_AUTH_MODE="${ZHIPU_AUTH_MODE:-jwt}"
      return
      ;;
    "")
      clear_llm_env
      export LLM_ENABLED=false
      return
      ;;
    *)
      echo "unsupported LLM_PROVIDER: $selected_provider" >&2
      exit 1
      ;;
  esac
}
