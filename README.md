# 37 Music Studio

A fresh application foundation for the 37 Music Studio management system.

## Current phase

Phase 1 establishes the frontend, UI, state, form, data, testing, and developer-tooling foundations only. It intentionally does not implement product pages or operational workflows.

## Requirements

- Node.js **24.15.0** (see `.nvmrc`)
- npm compatible with the installed Node.js release

## Getting started

```powershell
npm install
npm run dev
```

## Quality checks

```powershell
npm run format:check
npm run lint
npm run test:run
npm run build
npm audit
```

For a timestamped PowerShell verification log, run:

```powershell
.\scripts\verify-phase-1.ps1
```

## Project conventions

- JavaScript and JSX; no TypeScript migration is assumed.
- Tailwind CSS v4 with CSS-variable design tokens.
- Base UI primitives with shadcn/ui-generated local components when a page or flow is approved.
- Motion is used selectively; reduced-motion preferences must be respected.
- Prefer local React state for local interactions. Use Zustand only for genuinely shared client state.
- Use TanStack Query for asynchronous request state. Use Firestore listeners for Firestore real-time subscriptions rather than duplicating them in a query cache.
- Heavy charting and other large modules should be loaded only by the routes or features that need them.
- No product page, workflow, business rule, or role model is defined by this foundation.

See [Dependency Foundation](docs/architecture/DEPENDENCY-FOUNDATION.md) for the dependency choices and usage boundaries.
