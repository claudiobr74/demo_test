# Segurança

## Princípios

- Mínimo privilégio, mínimo dado, mínimo contexto, mínima retenção
- Secrets apenas no backend / Secret Manager — nunca no Flutter
- TLS em trânsito; criptografia em repouso no banco e object storage
- URLs públicas permanentes proibidas para conteúdo sensível

## Multitenancy

Isolamento validado no servidor a partir do membership JWT. Tentativas cross-tenant retornam `404` (não revelar existência).

## Auditoria

Tabela append-only `audit_events`. Registra ator, ação, recurso e resultado. **Não** copia conteúdo clínico.

## Logs

Redação automática de PHI/PII (e-mail, telefone, tokens, prontuário, prompts).

## Autorização clínica

Secretaria sem acesso automático a evolução, formulação, transcrição e Supervisor IA. Policies reutilizáveis em `Permission`.

## IA

- Human-in-the-loop obrigatório
- Privacy Layer antes do LLM
- Failover: se IA cair, Meu Dia / agenda / sessão seguem
- Observabilidade de custo sem armazenar prompts clínicos completos

## LGPD

Controles técnicos facilitam conformidade; revisão jurídica especializada permanece necessária.
