# Workflow conventions (from Winston) and AGENTS.md

_Research brief, 2026-09-30._

## Moth

- File-based ticket tracker, pinned in `mise.toml` as `"github:nikolasgioannou/moth" = "0.5.0"`.
- `moth.config.yml`: `tickets: .moth`; statuses backlog (backlog), todo (unstarted), in-progress (started), done (completed), canceled, duplicate.
- Tickets flat in `.moth/`, named `<slugified-title>-<6-hex id>.md`, frontmatter: `id`, `title`, `status`, `priority`, `labels` (one milestone label + area labels + `collab`), `created_at`, `updated_at`, `blocked_by` (list of ids). Done tickets gain an `## Outcome` section.
- CLI: `moth check` (schema + filename/title match), `moth list --unblocked`, `moth move <id> in-progress`, `moth edit` (`--title` renames the file).
- Prettier ignores `.moth/`.

## Docs

- `docs/plan.md`: intro (Moth tracks status/blockers, this file tracks order), "How to work through it" rules, milestones-at-a-glance table, then per milestone a table `| # | Ticket | Title | Blocked by |` with global numbering; collab rows marked 🤝.
- `docs/design.md` Part 3 opens with "a starting sketch, not a contract" and an **Invariants** list (change only with the user); tickets point to sections rather than copying details.

## Gate and commits

- lefthook pre-commit: Prettier on staged files, then `bun run check` (`moth check && format:check && lint && typecheck && test && build`). commit-msg: commitlint (`config-conventional`, `body-empty` and `footer-empty` always).
- Commits: single subject line, no body, no ticket ids; subject = ticket title lowercased (e.g. `feat: add a not-found page`). Filing tickets is its own commit (`chore: file tickets for …`).

## scripts/setup.sh

- Header comment lists numbered steps; `set -euo pipefail`; tty-aware colours; helpers `done_` (✓), `doing` (→), `fail` (✗, exits). Each step checks first and only acts if needed; global prerequisites (mise) fail with instructions and are never installed. Re-running doubles as a health check.

## .vscode

- `extensions.json`: ESLint, Prettier, Tailwind CSS.
- `settings.json`: workspace TypeScript, Prettier default formatter + format on save, `source.fixAll.eslint` on explicit save, Tailwind v4 entry stylesheet + `classFunctions`, `routeTree.gen.ts` read-only and excluded from search/watch. Personal preferences belong in user settings.

## AGENTS.md and Claude Code

- Claude Code reads `AGENTS.md` natively (v2.1.277+), **but only if no `CLAUDE.md`/`CLAUDE.local.md` exists**; nested AGENTS.md files load when Claude reads files in those directories. A "Project instructions" setting can read both. Portable fallback: a CLAUDE.md containing `@AGENTS.md`, or a symlink. https://code.claude.com/docs/en/memory.md#agents-md
- Decision: ship AGENTS.md only, no CLAUDE.md.
