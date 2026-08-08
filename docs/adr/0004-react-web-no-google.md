# ADR 0004 — Frontend web React sem Google

## Status

Aceito

## Contexto

O modelo web React (AI Studio) cobria Meu Dia, Agenda, Pacientes, Financeiro, Documentos, Supervisor e NotebookLM, mas acoplava o produto a Firebase Auth, Google Drive/Sheets/Docs/Calendar/Gmail/Meet e Gemini embutido no BFF Express.

O diferencial comercial desejado é **independência de ferramentas Google**: dados e autenticação sob controle da SerenaPsi.

## Decisão

1. Adotar `apps/web` (React + Vite + Tailwind) como frontend web principal, inspirado no modelo anexado (tema esmeralda, navegação, fluxos).
2. Remover Firebase, OAuth Google, Drive/Sheets/Docs/Calendar/Gmail e `googleFetch` do caminho ativo.
3. Persistir e autorizar via FastAPI + PostgreSQL + JWT/RBAC já existentes.
4. IA apenas pelo Serena AI Gateway (providers plugáveis; produto funciona offline).
5. Manter Flutter (`apps/mobile`) para multiplataforma; o React concentra a UX web do modelo.
6. Guardar o código legado do zip em `apps/web/src/legacy/` como referência, não como runtime.

## Consequências

- UX web alinhada ao modelo React sem lock-in Google.
- Menos superfície de OAuth/escopos e de dados clínicos em planilhas.
- Portar telas legacy → pages API é incremental.
- LLM Gemini (se configurado) permanece só como provedor opcional do gateway, não como Workspace.
