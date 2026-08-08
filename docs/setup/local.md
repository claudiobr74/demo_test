# Setup local

## Pré-requisitos

- Python 3.12+
- PostgreSQL 16+
- Flutter 3.32+
- (Opcional) Docker Compose

## Banco

```bash
# Docker
docker compose up -d postgres

# Ou local
createuser serenapsi -P   # senha: serenapsi
createdb serenapsi -O serenapsi
createdb serenapsi_test -O serenapsi
```

## API

```bash
cd services/api
cp .env.example .env
python3 -m pip install -e ".[dev]"
alembic upgrade head
python -m app.scripts.seed
uvicorn app.main:app --reload --port 8000
```

Seed de desenvolvimento (fictício):

- `dra.marina@serenapsi.dev` / `SerenaPsi!dev1`
- `secretaria@serenapsi.dev` / `SerenaPsi!dev1`

## Flutter

```bash
cd apps/mobile
flutter pub get
flutter run -d chrome
```

Configure `API_BASE_URL` via `--dart-define=API_BASE_URL=http://localhost:8000`.

## Healthcheck

`GET http://localhost:8000/health`
