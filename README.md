# Adept Frontend

React 19, TypeScript, and Vite browser application for Adept.

## Tech Stack
- **Framework**: React 19, Vite
- **Language**: TypeScript

## Getting Started

1. Ensure the API, PostgreSQL, and Mailpit are running.
2. **Run the dev server:**
   ```bash
   npm ci
   npm run dev -- --host 127.0.0.1
   ```
   Open <http://localhost:5173>.

## Commands

- **Generate OpenAPI schema**: `npm run api:generate`
- **Check types and lint**: `npm run lint` & `npm run typecheck`
- **Run Unit Tests**: `npm run test:run`
- **Run E2E Tests**: 
  ```bash
  PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run e2e
  ```
