# Arquitetura SerenaPsi

## Visão

O SerenaPsi é o **Sistema Operacional Clínico da Psicóloga**: organiza o consultório, preserva histórico, destaca pendências e oferece supervisão clínica assistiva — sem substituir o julgamento profissional.

## Diagrama lógico

```
React Web (apps/web)     Flutter (iOS / Android / Web)
        │                         │
        └──────────┬──────────────┘
                   │
            Secure API /api/v1
                   │
┌──────────────────┴─────────────────┐
│ Auth JWT · Tenant Isolation · RBAC │
│ Clinical · Agenda · Finance · Docs │
└───────┬──────────────┬─────────────┘
        │              │
   PostgreSQL     Object Storage (futuro)
        │
 Clinical Case Memory
        │
 Serena AI Gateway (multi-provider)
        │
 Professional Review (human-in-the-loop)

Sem Google Workspace: autenticação, agenda, docs e backup
não dependem de Drive/Sheets/Calendar/Gmail/Firebase.
```

## Camadas

| Camada | Responsabilidade |
|--------|------------------|
| Presentation (Flutter) | UI, UX states, navegação responsiva |
| Application (API) | Casos de uso, orquestração, auditoria |
| Domain | Regras clínicas e políticas |
| Infrastructure | Postgres, storage, providers de IA |

## Multitenancy

Toda entidade de consultório possui `organization_id`. O isolamento **nunca** confia em filtro enviado pelo frontend; a organização ativa vem exclusivamente do JWT/membership validado no servidor.

## Autorização

RBAC + permissões contextuais. O nome do perfil (`owner`, `psychologist`, `secretary`, `org_admin`) é apenas um template. A autorização real usa o conjunto `permissions[]` na membership.

Secretaria **não** recebe por padrão: prontuário, evolução, transcrição, Supervisor IA.

## Serena AI Gateway

Features nunca integram provedores diretamente. O gateway aplica:

1. Privacy Layer (minimização / pseudonimização)
2. Context Builder (orçamento de tokens por modo)
3. Clinical Framework (TCC, Schema, …)
4. Model Router (fast / reasoning / deep)
5. Clinical Critic
6. Safety Engine
7. Structured Output

LLM indisponível ⇒ produto clínico continua operando.

## Prioridade de evolução

- **P0** Segurança, multitenancy, auth, autorização, integridade
- **P1** Pacientes, agenda, sessões, prontuário
- **P2** Supervisor, case memory, frameworks
- **P3** Financeiro, documentos, consentimentos
- **P4** RAG, motor longitudinal
- **P5** Planos comerciais, admin

## Princípio de decisão

Segurança → autonomia profissional → integridade → clareza → simplicidade → velocidade → automação → estética.
