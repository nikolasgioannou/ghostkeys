---
id: "823bc4"
title: Extend ESLint for React and TanStack Router
status: todo
priority: none
labels:
  - m3
  - tooling
  - web
created_at: 2026-10-01T03:11:21.297Z
updated_at: 2026-10-01T03:14:21.967Z
blocked_by:
  - "80ed04"
---

The web app is React; lint it like React.

**Research first:** `@eslint-react/eslint-plugin` (the classic `eslint-plugin-react` doesn't support ESLint 10), `eslint-plugin-react-hooks` (flat recommended, including its React Compiler rules), and `@tanstack/eslint-plugin-router` (`flat/recommended`). Current versions and their ESLint 10 compatibility.

**Scope**
- Add them to the root `eslint.config.ts`, scoped to `apps/web/**/*.{ts,tsx}`.
- Fix whatever they flag in the scaffold.

**Docs:** design.md → Repo, tooling & gate.

**Done when:** `bun run lint` passes, and a hook called conditionally in a component fails lint.
