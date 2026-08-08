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

## App + API juntos (recomendado)

Com a API em `:8000` e o Flutter web-server em `:8080`:

```bash
python3 scripts/dev_gateway.py
```

Abra **http://127.0.0.1:3000** (same-origin: o app chama `/api/v1` sem CORS/port-forward separado).

Login seed: `dra.marina@serenapsi.dev` / `SerenaPsi!dev1`

