# SerenaPsi

Sistema operacional clínico para consultórios de Psicologia — gestão do ciclo de atendimento com Supervisor Clínico por IA.

## Visão

O SerenaPsi reduz carga administrativa e cognitiva para que a psicóloga concentre atenção no paciente. Não é um ERP adaptado nem um chatbot genérico: é um ambiente de trabalho clínico com inteligência assistiva, privacidade e autonomia profissional.

## Monorepo

```
apps/mobile/          Flutter (iOS, Android, Web)
services/api/         SerenaPsi API (FastAPI + PostgreSQL)
docs/                 Arquitetura, segurança, IA, ADRs
scripts/              Utilitários de desenvolvimento
```

## Stack

| Camada | Tecnologia |
|--------|------------|
| App | Flutter 3.32+ |
| API | FastAPI, SQLAlchemy 2 (async), Pydantic v2 |
| Banco | PostgreSQL 16 |
| Auth | JWT + RBAC contextual |
| IA | Serena AI Gateway (multi-provider) |
| Infra alvo | Google Cloud Run, Cloud SQL, Secret Manager |

## Início rápido

Consulte [docs/setup/local.md](docs/setup/local.md).

```bash
# API
cd services/api
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
python -m app.scripts.seed
uvicorn app.main:app --reload --port 8000

# Flutter
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
