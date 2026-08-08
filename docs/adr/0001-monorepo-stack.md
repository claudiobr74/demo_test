# ADR 0001 — Monorepo Flutter + FastAPI + PostgreSQL

## Status

Aceito

## Contexto

SerenaPsi precisa de app multiplataforma (iOS, Android, Web, Desktop) e API comercial multi-tenant com IA desacoplada de provedores.

## Decisão

- App: Flutter modular por feature
- API: FastAPI (async) versionada em `/api/v1`
- Persistência: PostgreSQL + Alembic
- IA: Serena AI Gateway próprio

## Consequências

- Uma base de código cliente com layouts por breakpoint
- Contratos OpenAPI claros entre app e API
- Troca de provedor de IA sem rebuild do app
