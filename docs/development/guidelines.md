# Guia de desenvolvimento

## Branches

`cursor/<descricao>-c376` a partir de `main`.

## Qualidade

```bash
# API
cd services/api
ruff check app tests
pytest -q

# Flutter
cd apps/mobile
flutter analyze
flutter test
```

## Convenções

- Sem regras de negócio em widgets Flutter
- Sem acesso direto ao banco a partir da UI
- Mensagens de erro padronizadas: `{ code, message, request_id }`
- Dados fictícios apenas em seeds/fixtures
- Linguagem de produto humana na UI (Meu Dia, Pacientes, Sessões)

## Definition of Done (mínimo)

UI + estados (loading/empty/error) + validação + domínio + API + authz + migration + testes + auditoria quando aplicável.
