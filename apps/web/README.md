# SerenaPsi Web (React)

Frontend web refeito a partir do modelo React de consultório, **sem Google Workspace / Firebase**.

## O que mudou em relação ao zip original

| Antes (modelo AI Studio) | Agora |
|--------------------------|--------|
| Login Google + Firebase Auth | JWT e-mail/senha via FastAPI |
| Drive / Sheets / Docs / Calendar / Gmail | PostgreSQL + API `/api/v1` |
| NotebookLM | Módulo **Conhecimento** (interno) |
| Gemini direto no `server.ts` Express | Serena AI Gateway na API |
| Firebase Admin / Firestore | Removidos do frontend |

Os componentes originais grandes ficam em `src/legacy/` só como referência visual/funcional — a app ativa usa `src/pages/*` ligados à API.

## Desenvolvimento

```bash
# API em :8000
cd services/api && poetry run uvicorn app.main:app --reload --port 8000

# Web em :5173 (proxy /api → :8000)
cd apps/web
npm install
npm run dev
```

Login seed: `dra.marina@serenapsi.dev` / `SerenaPsi!dev1`

## Build

```bash
npm run build
# artefatos em dist/ — podem ser servidos pela API (ver scripts/start_web.sh)
```
