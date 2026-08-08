# Schema PostgreSQL (fundação)

## Identidade e tenant

- `organizations`
- `users`
- `memberships` (role_key + permissions[])
- `audit_events` (append-only)
- `feature_flags`

## Clínico

- `patients` (display: Nome Sobrenome • PAC-XXX)
- `consent_templates`, `consents`
- `appointments`, `appointment_recurrences`
- `sessions`, `clinical_records`
- `case_formulations`, `clinical_hypotheses`
- `treatment_plans`, `treatment_goals`
- `tasks`

## Operações

- `charges`, `payments`, `packages`, `package_usages`, `expenses`
- `documents`, `document_templates`
- `ai_requests`, `ai_outputs`, `ai_feedback`
- `notifications`
- `plans`, `subscriptions`

## Regras

- Toda entidade de consultório tem `organization_id`
- Optimistic locking via `version` em pacientes, agenda, sessões e registros
- Idempotency keys em cobranças/pagamentos/agendamentos críticos
- Migrations via Alembic — nunca alterar schema de produção manualmente
