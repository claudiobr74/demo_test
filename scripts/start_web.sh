#!/usr/bin/env bash
# Sobe API + frontend React (apps/web) — sem Google/Firebase.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/home/ubuntu/.local/bin:${PATH:-}"
export JWT_SECRET="${JWT_SECRET:-dev-only-change-me-serenapsi-jwt-secret-min-32-chars}"
export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://serenapsi:serenapsi@localhost:5432/serenapsi}"
export AI_ENABLED="${AI_ENABLED:-false}"

sudo service postgresql start >/dev/null 2>&1 || true

cd "$ROOT/apps/web"
npm install
npm run build

# API serve o build React se SERENA_WEB_DIR apontar para dist
export SERENA_WEB_DIR="$ROOT/apps/web/dist"

cd "$ROOT/services/api"
test -f .env || cp .env.example .env
poetry run alembic upgrade head || python3 -m alembic upgrade head
poetry run python -m app.scripts.seed || python3 -m app.scripts.seed || true

echo ""
echo "SerenaPsi Web (React) em http://0.0.0.0:8000"
echo "Login: dra.marina@serenapsi.dev / SerenaPsi!dev1"
echo ""
exec poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
