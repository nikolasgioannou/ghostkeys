---
id: "10d338"
title: Enforce single-line conventional commits with commitlint
status: done
priority: none
labels:
  - m0
  - tooling
created_at: 2026-10-01T03:08:32.916Z
updated_at: 2026-10-01T04:06:57.045Z
blocked_by:
  - "322400"
  - "bb5341"
---

Commit messages follow one shape: a conventional type and a subject on a single line, with no body and no footer.

**Research first:** commitlint's current config format, `@commitlint/config-conventional`, and wiring it to lefthook's `commit-msg` hook.

**Scope**
- Root commitlint config: `config-conventional` plus `body-empty` and `footer-empty` set to always.
- A `commit-msg` hook in `lefthook.yml` that runs it.
- Claude Code adds an attribution body and a `Co-Authored-By` trailer to its commits by default, which this hook rejects. Ask the user whether to turn attribution off for this repo (in `.claude/settings.json`) or allow the trailer, and record the answer in AGENTS.md.

**Docs:** design.md → Repo, tooling & gate (the commit convention: type + ticket title in lowercase, single line); AGENTS.md (the attribution answer).

**Done when:** `feat: add x` is accepted; a message without a type, or with a body, is rejected by the hook; a commit made by Claude Code in this repo passes.

## Outcome

- `@commitlint/cli`, `@commitlint/config-conventional` and `@commitlint/types` 21.2.3, pinned exactly. `commitlint.config.ts` extends config-conventional with `body-empty` and `footer-empty` as errors.
- `lefthook.yml` gains a `commit-msg` hook running `bunx commitlint --edit {1}`.
- Verified: `feat: add x` passes; a message without a type, with a body, or with a `Co-Authored-By` trailer is rejected.
- Attribution: the user's global Claude Code settings already turn commit attribution off (`attribution.commit` is empty), so footers are blocked outright; recorded in AGENTS.md. Every earlier commit is a single line with no trailer.
- design.md → Repo, tooling & gate describes the convention.
