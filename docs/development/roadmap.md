# Roadmap de implementação

## Concluído nesta fundação (P0 + P1 parcial + P2 scaffold)

- Monorepo Flutter + FastAPI + PostgreSQL
- Multitenancy com `organization_id` e isolamento no servidor
- Auth JWT + RBAC por permissões (não só nome de perfil)
- Schema inicial (clínico, financeiro, docs, IA, auditoria) + migration Alembic
- Pacientes, agenda, Meu Dia, sessões (start/autosave/close), preparação
- Serena AI Gateway (privacy, context, frameworks CBT/Schema, critic, safety, offline)
- App Flutter: design system, shell responsivo, login, Meu Dia, pacientes, hub
- Seed fictício, testes unitários/integração/segurança, CI, ADRs

## Próximas fases

### P1 restante
- Agenda completa (semana/mês, drag-drop, recorrência)
- Fluxo guiado de encerramento + autosave UI
- Prontuário longitudinal versionado na UI

### P2
- Case Memory persistida + proveniência
- Modos do Supervisor conectados a providers reais
- Living formulation (aceitar/editar/ignorar)

### P3
- Financeiro operacional, documentos, consentimentos versionados

### P4
- Knowledge RAG, motor longitudinal

### P5
- Planos, usage, admin interno sem acesso clínico indiscriminado
