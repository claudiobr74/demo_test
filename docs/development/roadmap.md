# Roadmap de implementação

## Concluído

- Monorepo Flutter + FastAPI + PostgreSQL
- Multitenancy, JWT, RBAC por permissões, auditoria, redaction
- Pacientes, Meu Dia, agenda API, sessões (start/autosave/close)
- Serena AI Gateway (offline assist + frameworks CBT/Schema)
- Consentimentos versionados (API + hub)
- Prontuário longitudinal (lista)
- Flutter: Agenda dia/semana/mês, sessão com autosave, hub com Supervisor
- App servido na mesma origem `:8000` da API
- Financeiro: cobrança ao fechar sessão, pagamentos, painel
- Case Memory (fatos/observações/hipóteses + aceite de sugestão IA)
- Preparar sessão (contexto + memória do caso)
- Reagendar na agenda + mensagem de confirmação (copiar)
- Recorrência semanal/quinzenal de atendimentos
- Documentos: modelos, rascunho, finalizar, copiar texto
- Formulação viva (rascunho → oficial) + uso no Preparar sessão
- Proveniência tipada na memória do caso (+ UI de vínculo de fonte)
- Providers OpenAI e Gemini plugáveis (fallback offline)
- Ajuste rápido de horário na agenda (−15 / +15 min)
- Plano terapêutico + metas (API + hub + Preparar sessão)

## Próximo

### P1 restante
- Drag-and-drop visual completo na agenda

### P2
- Observabilidade AI (AiRequest/AiOutput persistidos)
- Hipóteses clínicas versionadas ligadas à formulação

### P3
- Confirmações multi-canal (envio real)
- PDF/export e armazenamento de documentos

### P4–P5
- RAG, motor longitudinal, planos comerciais
