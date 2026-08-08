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
- Observabilidade AI (AiRequest/AiOutput + feedback)
- Hipóteses clínicas ligadas à formulação (aceite de sugestões)
- Fila de confirmação multi-canal (stub de entrega)
- Painel de custo/latência AI da organização (API + Flutter `/ia`)
- Export de documentos (TXT/HTML + stub “para PDF” via impressão)
- Grade diária na agenda com arrastar-e-soltar entre horários
- Tarefas acionáveis (API + lista no Meu Dia com concluir/abrir)
- Deep-links de proveniência → sessão / prontuário / formulação
- Agenda: DnD na semana, conflitos visuais, snap de 15 min

## Próximo (pelo prompt inicial)

### P2/P3 restante
- Transcrição opcional → proposta → revisão humana (não vira prontuário sozinha)
- Providers reais WhatsApp/SMS/email (fila já existe)
- PDF binário (WeasyPrint) + armazenamento de documentos

### P4
- Knowledge / estudo (cadernos + biblioteca clínica)
- RAG + motor longitudinal avançado

### P5
- Planos comerciais, feature flags de assinatura, admin org/plataforma
