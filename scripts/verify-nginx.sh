#!/usr/bin/env bash
# verify-nginx.sh — standalone Nginx image verification for CI.
# Usage: ./scripts/verify-nginx.sh <image-tag>
# Requires: Docker, Node >=24

set -euo pipefail

IMAGE="${1:?Usage: verify-nginx.sh <image-tag>}"
CONTAINER="adept-nginx-verify-$$"
PORT=$(( RANDOM % 1000 + 9000 ))

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Verifying Nginx config syntax in image: $IMAGE"
docker run --rm \
  --add-host "api:127.0.0.1" \
  "$IMAGE" nginx -t

echo "==> Starting container on port $PORT"
docker run -d \
  --name "$CONTAINER" \
  --add-host "api:127.0.0.1" \
  -p "${PORT}:80" \
  "$IMAGE"

# Wait for Nginx to be ready.
for i in $(seq 1 10); do
  if curl -sf "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Testing 413 (body too large) on /api/v1/auth/login"
RESPONSE_413=$(curl -s -o /tmp/body413.json -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data "$(node -e "process.stdout.write('A'.repeat(17 * 1024))")" \
  "http://127.0.0.1:${PORT}/api/v1/auth/login")

if [ "$RESPONSE_413" != "413" ]; then
  echo "FAIL: Expected 413, got $RESPONSE_413"
  exit 1
fi

node -e "
const body = require('fs').readFileSync('/tmp/body413.json', 'utf8');
const j = JSON.parse(body);
if (j.status !== 413) throw new Error('status != 413: ' + j.status);
if (j.code !== 'PAYLOAD_TOO_LARGE') throw new Error('code: ' + j.code);
if (!j.traceId) throw new Error('missing traceId');
if (!j.type || !j.title || !j.detail || !j.instance) throw new Error('missing required fields');
console.log('413 body OK');
"

echo "==> Testing 429 (rate limited) on /api/v1/auth/login"
# Send enough requests to exceed burst=20.
for i in $(seq 1 25); do
  curl -s -o /dev/null "http://127.0.0.1:${PORT}/api/v1/auth/login" || true
done

RESPONSE_429=$(curl -s -o /tmp/body429.json -w "%{http_code}" \
  "http://127.0.0.1:${PORT}/api/v1/auth/login")

if [ "$RESPONSE_429" != "429" ]; then
  echo "FAIL: Expected 429, got $RESPONSE_429"
  exit 1
fi

node -e "
const body = require('fs').readFileSync('/tmp/body429.json', 'utf8');
const j = JSON.parse(body);
if (j.status !== 429) throw new Error('status != 429: ' + j.status);
if (j.code !== 'RATE_LIMITED') throw new Error('code: ' + j.code);
if (!j.traceId) throw new Error('missing traceId');
console.log('429 body OK');
"

echo "==> All Nginx checks passed."
