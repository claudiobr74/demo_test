# Instruções de IA - SerenaPsi

Este arquivo define as regras persistentes de comportamento e comunicação para o assistente de desenvolvimento do SerenaPsi.

## Preferência de Idioma
- **Sempre** responda ao usuário em **Português Brasileiro (pt-BR)**. Todas as explicações, resumos, mensagens de erro e interações devem ser estritamente em português brasileiro.

## Diretrizes de Interface e Experiência do Usuário (UI/UX)
- Todo o texto visível da interface do usuário (botões, menus, diálogos de confirmação, modais, placeholders, etc.) deve ser em **Português Brasileiro (pt-BR)**.
- Mantenha a consistência com o tema visual atual (**Emerald Theme**), utilizando tons elegantes de verde/esmeralda, tipografia refinada e espaçamentos equilibrados.

## Sem Google Workspace
- Não reintroduzir Firebase Auth, Google OAuth, Drive, Sheets, Docs, Calendar, Gmail, Meet ou NotebookLM.
- Dados e autenticação passam pela SerenaPsi API (JWT + PostgreSQL).
- IA apenas via Serena AI Gateway.
