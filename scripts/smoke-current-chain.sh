#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SMARTKOLS_SMOKE_BASE_URL:-https://smartkol.vercel.app}"
WORKSPACE_ID="${SMARTKOLS_SMOKE_WORKSPACE_ID:-f2d2cfed-d453-45a8-bd9d-341a5ee296b7}"
WORKSPACE_SLUG="${SMARTKOLS_SMOKE_WORKSPACE_SLUG:-test}"
EMAIL="${SMARTKOLS_SMOKE_EMAIL:-liuhan010407@gmail.com}"
NAME="${SMARTKOLS_SMOKE_NAME:-Operator}"

COOKIE_JAR="$(mktemp)"
BODY_FILE="$(mktemp)"
cleanup() {
  rm -f "$COOKIE_JAR" "$BODY_FILE"
}
trap cleanup EXIT

fail() {
  printf 'smoke failed: %s\n' "$1" >&2
  exit 1
}

login_status="$(
  curl -sS -c "$COOKIE_JAR" -o "$BODY_FILE" -w '%{http_code}' \
    -X POST \
    -H 'content-type: application/json' \
    --data "{\"email\":\"$EMAIL\",\"name\":\"$NAME\",\"workspace_slug\":\"$WORKSPACE_SLUG\"}" \
    "$BASE_URL/api/session"
)"

if [[ "$login_status" != "200" ]]; then
  printf 'login response:\n' >&2
  sed -n '1,80p' "$BODY_FILE" >&2
  fail "session login expected 200, got $login_status"
fi

if ! grep -q "$WORKSPACE_SLUG" "$BODY_FILE"; then
  sed -n '1,120p' "$BODY_FILE" >&2
  fail "session response did not include workspace slug $WORKSPACE_SLUG"
fi

accounts_status="$(
  curl -sS -b "$COOKIE_JAR" -o "$BODY_FILE" -w '%{http_code}' \
    "$BASE_URL/api/backend/accounts?workspace_id=$WORKSPACE_ID"
)"

if [[ "$accounts_status" != "200" ]]; then
  sed -n '1,120p' "$BODY_FILE" >&2
  fail "accounts expected 200, got $accounts_status"
fi

EXPECTED_HANDLE="${SMARTKOLS_SMOKE_ACCOUNT_HANDLE:-@SFgrxvU6Zf50395}"

if ! grep -q "$EXPECTED_HANDLE" "$BODY_FILE"; then
  sed -n '1,120p' "$BODY_FILE" >&2
  fail "accounts response did not include $EXPECTED_HANDLE"
fi

printf 'smoke passed: %s -> %s\n' "$BASE_URL" "$WORKSPACE_SLUG"
