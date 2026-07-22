# Adept Frontend

The frontend is Adept's React browser application.

## Current status

Phase 1 provides the Node 24, React 19, TypeScript 5, Vite, test, and production Nginx foundation. Authentication, routing, dashboards, and business screens are added later.

## Install and verify

```bash
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## Run with Vite

```bash
npm run dev -- --host 127.0.0.1
```

Open <http://localhost:5173>. Vite proxies relative `/api` requests to the host API at `http://localhost:8080`.

## Production-like image

```bash
docker build -t adept-frontend:phase1 .
```

In full Compose, Nginx is available at <http://localhost:3000> and proxies `/api` to the Compose service named `api`.
`