---
id: "322400"
title: Write AGENTS.md with the repo's working principles
status: todo
priority: none
labels:
  - docs
  - m0
created_at: 2026-10-01T03:07:59.614Z
updated_at: 2026-10-01T03:15:38.221Z
blocked_by:
  - "53f225"
---

Write `AGENTS.md` at the repo root: the rules for how work happens here, for people and coding agents alike. What Ghostkeys is and how it's built stays in `docs/`; AGENTS.md says so and points there.

**Tickets**
- Work comes from Moth tickets in `.moth/`, in the order given by `docs/plan.md`.
- Before starting a ticket, re-read it, the tickets it's blocked by, and the design.md sections it points at. If things have moved on, update the ticket first, in the same commit as the work.
- If a ticket conflicts with these principles, raise it with the user instead of following it.
- Claim a ticket with `moth move <id> in-progress`. Move it to `done` in the same commit as the work, and add an `## Outcome` section saying what was built.
- One ticket per commit. The commit subject is a conventional type plus the ticket title in lowercase (e.g. `feat: parse the grid as it streams`), single line, no body. Filing tickets is its own `chore:` commit.
- Tickets state outcomes and constraints and point at design.md sections rather than copying details.

**Principles**
- Build for today, design for where we're going: no helpers, stubs, config or infrastructure the current ticket doesn't need; but think ahead about decisions that are hard to change (architecture, data shapes, interfaces between parts) so later commits build on them. Deleting is fine.
- Docs describe what's actually built, updated in the same commit as the change.
- Keep `scripts/setup.sh` complete and safe to re-run (check, then act).
- Keep `.vscode/extensions.json` and `.vscode/settings.json` current when a tool is added or changed.
- Research a new tool before configuring it, from current docs rather than memory: how it works today, how it's configured, and how it fits the tools already here.
- Ask rather than guess on direction.
- Some things need a human: the invariants in design.md Part 3 change only with the user's agreement, and tickets labelled `collab` are done together with the user.

No command reference here; commands live in `package.json` and the README.

There is deliberately no `CLAUDE.md`: Claude Code reads AGENTS.md natively, but only when no CLAUDE.md exists (docs/research/06).

**Docs:** AGENTS.md itself; design.md → Repo, tooling & gate records why there's no CLAUDE.md.

**Done when:** a new Claude Code session in the repo shows AGENTS.md loaded (`/memory`), and every rule above is in it.
