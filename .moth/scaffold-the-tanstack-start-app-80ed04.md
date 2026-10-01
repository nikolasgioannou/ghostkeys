---
id: "80ed04"
title: Scaffold the TanStack Start app
status: todo
priority: none
labels:
  - m3
  - tooling
  - web
created_at: 2026-10-01T03:11:21.184Z
updated_at: 2026-10-01T03:30:14.570Z
blocked_by:
  - "2c06c7"
---

Create `apps/web`, the TanStack Start app the listener opens.

**Research first** (docs/research/03 is a starting point; the framework is a release candidate that ships almost daily): TanStack Start's Vite plugin setup, React 19.2, `@vitejs/plugin-react`, the TanStack CLI on Bun (`--blank`, `--no-examples`, `--toolchain`, add-ons, `TANSTACK_CLI_TELEMETRY_DISABLED=1`), running under `bun --bun` (needed later for `bun:sqlite`), selective SSR, `*.server.ts` import protection, and whether `routeTree.gen.ts` should be committed. Pin exact versions.

**Scope**
- Scaffold with the smallest options (blank, no examples, no toolchain, no add-ons), or write the minimal app by hand. Remove whatever a later ticket owns (Tailwind) and any per-app lint, format or test config: the root configs apply. `apps/web/tsconfig.json` extends the base.
- All scripts run Vite under Bun: `bun --bun vite dev|build|preview`. A `typecheck` script so the root typecheck covers the app; confirm the root Vitest config runs tests under `apps/web`.
- One root route rendering "Ghostkeys". No demo content.
- Root `dev` script. `build` joins `bun run check` after `test`.
- Commit `routeTree.gen.ts` if current docs recommend it; otherwise have `check` (and `setup.sh`) generate it before typecheck. Either way `bun run check` passes on a clean clone.
- Ignore build output in `.gitignore`. Ignore `routeTree.gen.ts` in Prettier and ESLint, and mark it read-only and excluded from search in `.vscode/settings.json`.

**Docs:** design.md → Stack and Transport (framework version, `bun --bun`, SSR choices); design.md → Repo, tooling & gate (the build step); README (`bun run dev`).

**Done when:** `bun run dev` serves the root route on localhost, `bun run check` (now including the build) passes on a clean clone, and the README's dev instructions work word for word.
