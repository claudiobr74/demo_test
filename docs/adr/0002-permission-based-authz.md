# ADR 0002 — Autorização por permissões, não por nome de papel

## Status

Aceito

## Contexto

Perfis (proprietária, psicóloga, secretaria, admin) são conceitos de produto, mas autorização real não pode depender só do nome do perfil.

## Decisão

Membership armazena `role_key` (template) e `permissions[]` (fonte da verdade). O backend valida permissões em toda operação. JWT carrega permissões apenas como hint de UX; a API revalida no banco.

## Consequências

- Secretaria sem acesso clínico sensível por padrão
- Políticas reutilizáveis e auditáveis
- Customização futura de permissões sem mudança de código de domínio
