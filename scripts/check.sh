#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "== API tests =="
cd "$ROOT/services/api"
export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://serenapsi:serenapsi@localhost:5432/serenapsi}"
export JWT_SECRET="${JWT_SECRET:-dev-only-change-me-serenapsi-jwt-secret-min-32-chars}"
export AI_ENABLED=false
python3 -m pytest -q

echo "== Flutter analyze + test =="
cd "$ROOT/apps/mobile"
flutter analyze
flutter test

echo "OK"
