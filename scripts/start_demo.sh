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
flutter pub get
flutter build web --release --pwa-strategy=none
# Desliga registro de SW mesmo com bootstrap gerado pelo Flutter.
python3 - <<'PY'
from pathlib import Path
p = Path("build/web/flutter_bootstrap.js")
t = p.read_text()
t2 = t.replace(
    """_flutter.loader.load({
  serviceWorkerSettings: {
    serviceWorkerVersion: """,
    """_flutter.loader.load({
  serviceWorkerSettings: null,
  _disabledServiceWorkerVersion: """,
)
# fallback if formatting differs
import re
t2 = re.sub(
    r"serviceWorkerSettings:\s*\{\s*serviceWorkerVersion:\s*\"[^\"]+\"\s*\}",
    "serviceWorkerSettings: null",
    t2,
)
p.write_text(t2)
print("flutter_bootstrap patched: serviceWorker disabled")
PY

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
