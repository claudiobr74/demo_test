#!/usr/bin/env bash
# Sobe API + app Flutter (build/web) em uma única porta: 8000
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/flutter/bin:/home/ubuntu/.local/bin:${PATH:-}"
export JWT_SECRET="${JWT_SECRET:-dev-only-change-me-serenapsi-jwt-secret-min-32-chars}"
export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://serenapsi:serenapsi@localhost:5432/serenapsi}"
export AI_ENABLED="${AI_ENABLED:-false}"

sudo service postgresql start >/dev/null 2>&1 || true

cd "$ROOT/apps/mobile"
if [[ ! -f build/web/index.html ]]; then
  flutter pub get
  flutter build web --release
fi

cd "$ROOT/services/api"
test -f .env || cp .env.example .env
python3 -m alembic upgrade head
python3 -m app.scripts.seed || true

echo ""
echo "SerenaPsi em http://0.0.0.0:8000"
echo "Login: dra.marina@serenapsi.dev / SerenaPsi!dev1"
echo "No Cursor: Ports → forward 8000 → Open in Browser"
echo ""
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
