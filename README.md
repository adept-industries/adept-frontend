# Adept Frontend

The Adept frontend is the browser application for the Adept developer-delivery analytics platform.

## Responsibilities

This repository owns:

- React pages and components;
- authentication and workspace user interfaces;
- repository, risk, metric, alert, and settings screens;
- route guards;
- the generated API client;
- frontend tests;
- the production Nginx configuration.

This repository does not own:

- database migrations;
- backend authentication rules;
- GitHub or Jira secrets;
- event-worker logic;
- risk-model artifacts.

## Technology baseline

- Node.js 22 LTS
- React 19
- TypeScript 5
- Vite
- npm with `package-lock.json`

## Current status

Phase 0 repository foundation.

The React Vite application and package lockfile will be created during Phase 1.

## Contribution

All changes must be made through a feature branch and pull request after branch protection is enabled.