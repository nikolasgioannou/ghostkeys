---
id: "09c97c"
title: Bootstrap the Bun workspace monorepo
status: todo
priority: none
labels:
  - m0
  - tooling
created_at: 2026-10-01T03:07:59.717Z
updated_at: 2026-10-01T03:28:39.746Z
blocked_by:
  - "53f225"
---

Turn the repo into a Bun workspaces monorepo that later tickets add packages to.

**Research first** (current docs, not memory): Bun 1.4 workspaces — workspace globs, the `workspace:*` protocol, `--filter`, catalogs, the text `bun.lock` and `--frozen-lockfile` — and pinning Bun through mise. Record what you learn in design.md → Repo, tooling & gate.

**Scope**
- Root `package.json`: `private`, `"type": "module"`, `"workspaces": ["apps/*", "packages/*"]`, no dependencies yet.
- `mise.toml`: pin Bun (1.4.2) and Node (24, the LTS already installed through mise, so nothing new is downloaded) next to the existing Moth pin. Node is pinned because tools such as ESLint, Prettier and the editor extensions run with Node shebangs; record that reason in design.md → Stack.
- `.gitignore`: `node_modules`, `.env` and `.env.*` except `.env.example`, OS files. Nothing else yet: build outputs and the database file are ignored by the tickets that create them.
- No `bun.lock` yet. Bun deletes an empty lockfile, so it appears with the first dependency and is committed from then on.

**Docs:** design.md → Repo, tooling & gate (layout, workspaces), design.md → Stack (the mise pins).

**Done when:** on a clean clone, `mise trust && mise install && bun install` succeeds and leaves `git status` clean.
