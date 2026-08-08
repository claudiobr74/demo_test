# SerenaPsi

Sistema operacional clínico para consultórios de Psicologia — gestão do ciclo de atendimento com Supervisor Clínico por IA.

## Visão

O SerenaPsi reduz carga administrativa e cognitiva para que a psicóloga concentre atenção no paciente. Não é um ERP adaptado nem um chatbot genérico: é um ambiente de trabalho clínico com inteligência assistiva, privacidade e autonomia profissional.

## Monorepo

```
apps/web/             React + Vite (web principal, sem Google Workspace)
apps/mobile/          Flutter (iOS, Android, Web)
services/api/         SerenaPsi API (FastAPI + PostgreSQL)
docs/                 Arquitetura, segurança, IA, ADRs
scripts/              Utilitários de desenvolvimento
```

## Stack

| Camada | Tecnologia |
|--------|------------|
| Web | React 19 + Vite + Tailwind (tema esmeralda) |
| App nativo | Flutter 3.32+ |
| API | FastAPI, SQLAlchemy 2 (async), Pydantic v2 |
| Banco | PostgreSQL 16 |
| Auth | JWT + RBAC contextual (sem Firebase/Google OAuth) |
| IA | Serena AI Gateway (multi-provider; funciona offline) |
| Infra alvo | Cloud Run / VPS + PostgreSQL + Secret Manager |

**Diferencial:** sem Google Drive, Sheets, Docs, Calendar, Gmail, Meet nem NotebookLM.

## Início rápido

Consulte [docs/setup/local.md](docs/setup/local.md).

```bash
# API
cd services/api
poetry install
cp .env.example .env
poetry run alembic upgrade head
poetry run python -m app.scripts.seed
poetry run uvicorn app.main:app --reload --port 8000

# Web React (proxy /api → :8000)
cd apps/web
npm install
npm run dev

# Ou API + build React na mesma porta
./scripts/start_web.sh

# Flutter (opcional / multiplataforma)
cd apps/mobile
flutter pub get
flutter run -d chrome
```

## Prioridades de produto

1. Segurança do paciente e dos dados  
2. Autonomia profissional  
3. Integridade das informações  
4. Clareza → simplicidade → velocidade → automação → estética  

## Princípio da IA

A IA **sugere**; a profissional **revisa e decide**. O SerenaPsi continua operacional se o LLM estiver indisponível.

## Documentação

- [Arquitetura](docs/architecture/overview.md)
- [Segurança](docs/security/overview.md)
- [Serena AI Gateway](docs/ai/gateway.md)
- [Banco de dados](docs/database/schema.md)
- [ADRs](docs/adr/)

## Licença

Proprietary — SerenaPsi. Todos os direitos reservados.
