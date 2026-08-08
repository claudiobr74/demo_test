# Serena AI Gateway

## Objetivo

Copiloto de raciocínio clínico — não chatbot genérico. Estimula reflexão, distingue epistemologias e nunca altera prontuário/formulação autonomamente.

## Modos

| Modo | Uso |
|------|-----|
| prepare_session | Preparar próxima sessão |
| post_session_debrief | Debriefing |
| case_formulation | Formulação |
| longitudinal_review | Revisão longitudinal |
| stuck_case | Impasse |
| treatment_planning | Planejamento |
| clinical_chat | Pergunta livre |
| review_my_conduct | Revisar conduta |

Cada modo tem context builder, schema, policy e classe de modelo próprios.

## Classes de modelo

- **fast** — extração, títulos, metadados
- **reasoning** — supervisão normal
- **deep_reasoning** — casos complexos / longitudinal

Configuração por ambiente: `AI_FAST_MODEL`, `AI_REASONING_MODEL`, `AI_DEEP_REASONING_MODEL`.

## Frameworks

Módulos versionados em `app/ai_gateway/frameworks/` (inicialmente `cbt` e `schema`). Novos frameworks entram como módulos, sem reescrever o gateway.

## Epistemologia

`documented_fact` | `clinical_observation` | `inference` | `working_hypothesis` | `insufficient_information`

## Offline assist

Com `AI_ENABLED=false`, o gateway devolve assistência estruturada local e deixa claro que não há LLM — o atendimento não para.
