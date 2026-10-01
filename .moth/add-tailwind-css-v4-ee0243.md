---
id: "ee0243"
title: Add Tailwind CSS v4
status: todo
priority: none
labels:
  - m3
  - tooling
  - ui
  - web
created_at: 2026-10-01T03:11:21.405Z
updated_at: 2026-10-01T03:14:21.984Z
blocked_by:
  - "80ed04"
---

Style the app with Tailwind v4.

**Research first:** Tailwind 4 with `@tailwindcss/vite` in TanStack Start (plugin order, `app.css` linked from the root route's `head`); CSS-first config with `@theme`; `prettier-plugin-tailwindcss` with v4 (`tailwindStylesheet`, listed last among plugins); `eslint-plugin-better-tailwindcss` (`entryPoint`, using its correctness rules and leaving class order to Prettier). Current versions.

**Scope**
- `apps/web/src/styles/app.css` with `@import "tailwindcss"` and a minimal dark base (background and text). The real palette comes when the look is designed.
- Prettier sorts classes; ESLint catches invalid or conflicting classes.
- `.vscode`: recommend the Tailwind CSS extension; point it at the entry stylesheet; associate `*.css` with Tailwind; class functions if any are used.

**Docs:** design.md → Stack; design.md → Repo, tooling & gate.

**Done when:** the root route renders with the dark base, Prettier reorders an unsorted class list, and an invalid class fails lint.
