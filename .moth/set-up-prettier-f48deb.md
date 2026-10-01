---
id: "f48deb"
title: Set up Prettier
status: done
priority: none
labels:
  - m0
  - tooling
created_at: 2026-10-01T03:08:32.609Z
updated_at: 2026-10-01T04:01:20.342Z
blocked_by:
  - "201d66"
---

Format everything with Prettier, including keeping every `package.json` sorted.

**Research first:**
- Prettier 3's current config options and monorepo setup (one root config, how it treats Markdown and YAML).
- `prettier-plugin-packagejson`, which runs `sort-package-json` inside Prettier: its current version, what order it sorts keys into, how it treats the `workspaces` field and scripts, and how it orders with other Prettier plugins. The Tailwind plugin, added later, must be listed last.

The Tailwind plugin itself isn't added here; it comes with Tailwind.

**Scope**
- Root `prettier.config.js` with `prettier-plugin-packagejson`, and `.prettierignore`. Ignore `.moth/` (Moth writes those files itself) and `bun.lock`; nothing else yet. Later tickets add generated files as they appear.
- `format` and `format:check` scripts at the root.
- Format the repo in this commit: the docs written so far and every `package.json`.
- `.vscode`: recommend the Prettier extension; make Prettier the default formatter with format on save.

**Docs:** design.md → Repo, tooling & gate (Prettier and the package.json sorting).

**Done when:** `bun run format:check` passes; a deliberately misformatted file makes it fail; shuffling the keys of a `package.json` makes it fail, and `bun run format` puts them back in order.

## Outcome

- Prettier 3.9.9 and `prettier-plugin-packagejson` 3.0.2 (wraps `sort-package-json`), pinned exactly; `prettier.config.ts` uses Prettier's default style plus the plugin. `.prettierignore` skips `.moth/` and `bun.lock`.
- `format` and `format:check` scripts; the whole repo formatted in this commit (docs tables aligned, `package.json` scripts sorted).
- Verified: `format:check` passes; a misformatted file and a `package.json` with shuffled keys both fail it, and `format` restores the order.
- `.vscode`: Prettier extension recommended; default formatter with format on save.
- design.md → Repo, tooling & gate describes the format setup.
