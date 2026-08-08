# demo_test

A small **Task Board** web app used to demonstrate a working Cloud Agent
development environment.

Built with [Vite](https://vite.dev), [React](https://react.dev) and TypeScript.
Tasks are persisted to the browser's `localStorage`.

## Getting started

Requires Node.js 20+.

```bash
npm ci        # install dependencies (use `npm install` to update the lockfile)
npm run dev   # start the dev server on http://localhost:5173
```

## Scripts

| Command            | Description                                    |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | Start the Vite dev server (host `0.0.0.0:5173`) |
| `npm run build`    | Type-check and produce a production build       |
| `npm run preview`  | Preview the production build on port `4173`     |
| `npm run lint`     | Run ESLint                                       |
| `npm run typecheck`| Type-check without emitting output              |

## Cloud Agent environment

`.cursor/environment.json` configures the Cloud Agent environment:

- `install` runs `npm ci` after checkout to restore dependencies.
- A `dev` terminal runs `npm run dev` so the app is available while working.
