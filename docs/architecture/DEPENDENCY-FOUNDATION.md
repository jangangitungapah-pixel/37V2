# 37 Music Studio — Dependency Foundation

**Phase:** 1 — Dependency Foundation  
**Reviewed against stable package releases:** 17 November 2026  
**Repository:** `jangangitungapah-pixel/37V2`  
**Runtime language:** JavaScript / JSX

This foundation deliberately prepares the toolchain without defining product screens, business workflows, permissions, or operational rules. Direct dependency versions are pinned exactly in `package.json`; generate and commit `package-lock.json` from the local environment after installation.

## Runtime and build foundation

| Area                 | Package                                 | Pinned version | Responsibility                                   |
| -------------------- | --------------------------------------- | -------------: | ------------------------------------------------ |
| UI runtime           | `react`, `react-dom`                    |         19.3.1 | React application runtime                        |
| Dev server / bundler | `vite`                                  |          8.3.8 | Development server and production build          |
| React integration    | `@vitejs/plugin-react`                  |          6.3.0 | JSX transform and Fast Refresh                   |
| React optimization   | `babel-plugin-react-compiler`           |          1.0.0 | Stable compiler-powered React optimization       |
| Compiler bridge      | `@rolldown/plugin-babel`, `@babel/core` |   0.3.1, 8.1.2 | Official Vite/Rolldown Babel preset integration  |
| Styling              | `tailwindcss`, `@tailwindcss/vite`      |          4.3.5 | Tailwind CSS v4 and first-party Vite integration |

## UI and interaction foundation

| Area                         | Package                    | Pinned version | Responsibility                               |
| ---------------------------- | -------------------------- | -------------: | -------------------------------------------- |
| Headless primitives          | `@base-ui/react`           |          1.9.0 | Accessible, unstyled interaction primitives  |
| Component source CLI         | `shadcn`                   |         4.23.0 | Add locally owned, editable UI components    |
| Animation                    | `motion`                   |        14.14.0 | Declarative interaction and layout animation |
| Icons                        | `lucide-react`             |         1.74.0 | Consistent icon system                       |
| Toasts                       | `sonner`                   |          2.0.8 | Application notifications                    |
| Class variants               | `class-variance-authority` |          0.7.1 | Reusable component variants                  |
| Class composition            | `clsx`                     |          2.1.1 | Conditional class composition                |
| Tailwind conflict resolution | `tailwind-merge`           |          3.7.0 | Merge conflicting Tailwind utilities         |

**UI direction:** Tailwind v4 + Base UI primitives + shadcn/ui local components. shadcn/ui is treated as a source/CLI workflow, not a large opaque runtime component bundle. The neutral CSS variables and light/dark token slots in `src/styles/index.css` are groundwork only; final brand colors, typography, spatial surfaces, density, navigation, and page layouts remain undecided.

**Animation/performance policy:** use Motion for interactions that benefit from choreography or layout animation; prefer CSS for simple transitions; avoid animating large expensive surfaces by default; respect `prefers-reduced-motion`. Keep charts and other heavy feature modules out of the initial application shell and lazy-load them when a future page actually needs them.

## State, forms, data, and domain utilities

| Area                | Package                          | Pinned version | Responsibility                                               |
| ------------------- | -------------------------------- | -------------: | ------------------------------------------------------------ |
| Routing             | `react-router`                   |          8.5.1 | Client-side route and navigation foundation                  |
| Shared client state | `zustand`                        |          5.1.0 | Small cross-view UI state stores when needed                 |
| Async server state  | `@tanstack/react-query`          |        5.107.1 | Fetch/cache/retry lifecycle for non-Firestore async requests |
| Query devtools      | `@tanstack/react-query-devtools` |        5.107.1 | Development-only cache inspection                            |
| Data tables         | `@tanstack/react-table`          |          9.3.1 | Headless sorting, filtering, grouping, and row models        |
| List virtualization | `@tanstack/react-virtual`        |        3.14.24 | Efficient rendering of long lists and tables                 |
| Forms               | `react-hook-form`                |         7.92.0 | Form state and field registration                            |
| Schema validation   | `zod`                            |          4.6.7 | Runtime schemas and validation                               |
| Form/Zod adapter    | `@hookform/resolvers`            |          7.0.7 | Connect React Hook Form with Zod                             |
| Date/time           | `date-fns`                       |          4.4.0 | Date arithmetic and formatting                               |
| Time zones          | `@date-fns/tz`                   |          1.5.0 | Explicit time-zone handling                                  |
| Charts              | `echarts`, `echarts-for-react`   |   6.1.0, 3.0.6 | Rich, interactive chart rendering                            |
| Backend client SDK  | `firebase`                       |         13.3.0 | Firebase Web SDK foundation                                  |

**Usage boundaries:**

- Prefer React local state for a component-local interaction. Zustand is not a default store for every value.
- TanStack Query is for conventional asynchronous request state. Do not mirror Firestore real-time listeners in a second cache without a specific reason.
- Firestore real-time subscriptions should use the modular Firebase SDK APIs (for example, `onSnapshot`) when a later phase defines the data flow.
- ECharts should be loaded from the feature or route that needs it, not imported into the global app shell.
- Store timestamps in a consistent canonical form and apply the studio/business time zone explicitly; do not rely on the browser machine's local time.
- Select and add individual shadcn/Base UI components as each page is designed. Do not install every component pre-emptively.

## Developer experience and verification

| Area                       | Package                                                 |  Pinned version |
| -------------------------- | ------------------------------------------------------- | --------------: |
| Lint engine and core rules | `eslint`, `@eslint/js`                                  | 10.15.0, 10.0.1 |
| React rules                | `eslint-plugin-react-hooks`                             |           7.1.1 |
| Fast Refresh lint rules    | `eslint-plugin-react-refresh`                           |           0.5.8 |
| Runtime globals            | `globals`                                               |         17.14.0 |
| Formatting                 | `prettier`                                              |          3.10.1 |
| Tailwind class sorting     | `prettier-plugin-tailwindcss`                           |           0.8.1 |
| Test runner                | `vitest`                                                |           5.1.0 |
| DOM test environment       | `jsdom`                                                 |          31.0.1 |
| React test utilities       | `@testing-library/react`, `@testing-library/user-event` | 16.3.3, 14.6.12 |

Tests are intentionally limited at this stage. The initial suite checks only the shared class-name utility; feature-level tests should be added with the corresponding implementation, prioritizing critical business rules, authorization boundaries, idempotency, and data integrity.

## Runtime requirement

- Preferred local runtime: Node.js **24.15.0**, recorded in `.nvmrc`.
- The package engine range is `^22.22.2 || ^24.15.0 || >=26.0.0`. The newest jsdom release in this foundation needs a supported modern Node release.
- Use npm to resolve and create the lockfile locally. Exact direct dependency pins are already recorded, but the transitive dependency tree is not locked until `package-lock.json` is generated.

## Firebase boundary

Only the Firebase Web SDK is included. A lazy app initializer is present, and `.env.example` lists the public Firebase Web App configuration fields. No project ID, live credentials, authentication flow, Firestore schema, security rules, Firebase Hosting config, Functions, Storage, Extensions, or deployment is created in Phase 1. Do not commit a real `.env.local`.

## Deliberately excluded from Phase 1

- No dashboard, login screen, booking calendar, customer, studio, operator, or finance pages.
- No app navigation or role/permission model.
- No business rules, data schema, or booking logic.
- No Firebase project provisioning or deployment.
- No Cloud Functions, Cloudflare Workers, Firebase Storage, or billing configuration.
- No animation-heavy showcase or prebuilt page template.
- No automatic PR creation or merge.

## Official release/documentation references

- React 19.3: https://react.dev/blog/2026/09/09/react-19-3
- Vite releases: https://vite.dev/releases
- Tailwind CSS releases: https://tailwindcss.com/blog
- Base UI releases: https://base-ui.com/react/overview/releases
- shadcn/ui changelog: https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- React Compiler installation: https://react.dev/learn/react-compiler/installation
- Firebase JavaScript SDK release notes: https://firebase.google.com/support/release-notes/js
