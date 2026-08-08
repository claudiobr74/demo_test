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

- Frontend React (`apps/web`) a partir do modelo de consultório — **sem Google/Firebase**
- Auth JWT + adapter API; NotebookLM → módulo Conhecimento; legacy em `src/legacy/`

## Próximo (pelo prompt inicial + modelo React)

### Web React
- Sessão ativa com autosave, Supervisor e encerramento guiado (feito)
- Financeiro com cobrança/pagamento; Documentos com modelos/export (feito)
- Hub do paciente (memória, consentimentos, prontuário) (feito)
- Recibos imprimíveis + pacotes de sessões + débito no fechamento (feito)
- Agenda com recorrência; taxa de sessão no cadastro; tarefas rápidas (feito)
- Hub: formulação viva + plano terapêutico/metas (feito)
- Financeiro: abas Hoje/Recebimentos/Despesas/Relatórios + cópia contábil (feito)
- Agenda React: visão semana + DnD + ±15 min; documentos com edição de rascunho (feito)
- Supervisor/Sessão: aceite de sugestões IA → memória/notas (feito)
- Cadastro editável + gates de secretaria no hub/Meu Dia (feito)
- Hipóteses no hub; fila de confirmações; deep-links; agenda mês; PWA SW (feito)
- Sessão: gravação + transcrição → proposta modelo CFP revisável (feito; fail-closed em consentimento `transcription`)

### P2/P3 restante
- Providers STT reais via Serena AI Gateway (hoje: stub offline + estrutura CFP; LLM opcional)
- Providers reais WhatsApp/SMS/email (fila já existe; sem Gmail Google)
- PDF binário (WeasyPrint) + armazenamento de documentos

### P4
- Cadernos / biblioteca clínica (Knowledge)
- RAG + motor longitudinal avançado

### P5
- Planos comerciais, feature flags de assinatura, admin org/plataforma
