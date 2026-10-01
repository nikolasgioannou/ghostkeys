---
id: "0a47f7"
title: Set up ESLint with type-aware TypeScript rules
status: done
priority: none
labels:
  - m0
  - tooling
created_at: 2026-10-01T03:08:32.710Z
updated_at: 2026-10-01T04:02:31.369Z
blocked_by:
  - "201d66"
  - "f48deb"
---

Lint every workspace with one root ESLint config.

**Research first** (docs/research/05 is a starting point, not a substitute): ESLint 10's flat config and how `eslint.config.ts` is loaded under the pinned Node; typescript-eslint's `strictTypeChecked` with `projectService` in a workspace; `eslint-plugin-simple-import-sort`; `eslint-config-prettier/flat` (last, so ESLint never fights Prettier); and how the VS Code ESLint extension loads `eslint.config.ts` (runtime setting if needed). React, TanStack and Tailwind plugins come later with the web app.

**Scope**
- Root `eslint.config.ts`; `lint` and `lint:fix` scripts.
- Enforce invariant 6 from day one, for `packages/engine/**`:
  - `no-restricted-imports` bans `react`, `react-dom`, `@tanstack/*`, `@base-ui/*`, `drizzle-orm`, `bun:sqlite` and `@ghostkeys/db`;
  - `no-restricted-properties` bans `process.env` (the engine receives its config; it never reads the environment);
  - `no-restricted-globals` bans `window`, `document`, `navigator`, `localStorage` and `AudioContext` (the engine runs on the server too; the DOM lib is there only for `fetch` and `AbortSignal`).
- Fix whatever the rules flag in existing code.
- `.vscode`: recommend the ESLint extension; run `source.fixAll.eslint` on explicit save.

**Docs:** design.md → Repo, tooling & gate; design.md → Invariants notes that invariant 6 is enforced by lint.

**Done when:** `bun run lint` passes; importing `react`, reading `process.env` or using `window` inside `packages/engine/src` fails lint, and the same errors show in the editor.

## Outcome

- ESLint 10.11.0 with `@eslint/js` 10.0.1, typescript-eslint 8.71.0 (`strictTypeChecked` + `stylisticTypeChecked`, `projectService`), `eslint-plugin-simple-import-sort` 14.0.0 and `eslint-config-prettier` 10.1.8 (last), all pinned exactly. `jiti` 2.7.0 loads `eslint.config.ts` (ESLint's native TS config loading is still behind experimental flags), for both the CLI and the editor.
- Invariant 6 is lint-enforced for `packages/engine/**`: restricted imports (React, TanStack, Base UI, Drizzle, `bun:sqlite`, `@ghostkeys/db`), no `process.env`, no `window`/`document`/`navigator`/`localStorage`/`AudioContext`. Verified with a probe file.
- Root `tsconfig.json` gets `@types/node` (root config files run on Node); the engine still has no Node types.
- `lint` / `lint:fix` scripts; existing code passes.
- `.vscode`: ESLint extension recommended; `source.fixAll.eslint` on explicit save. Seeing the errors in the editor needs checking in VS Code.
- design.md → Repo, tooling & gate and Invariants updated.
