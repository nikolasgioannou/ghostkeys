# Working on Ghostkeys

These are the rules for how work happens in this repo. What Ghostkeys is and how it's built lives in `docs/`. Read the code and docs for that, not this file.

## Tickets

- Work comes from Moth tickets in `.moth/`, in the order given by `docs/plan.md`.
- Before starting a ticket, re-read it, the tickets it's blocked by, and the `docs/design.md` sections it points at. If things have moved on, update the ticket first, in the same commit as the work.
- If a ticket conflicts with the principles below, raise it with the user instead of following it as written.
- Claim a ticket with `moth move <id> in-progress`. Move it to `done` in the same commit as the work, and add an `## Outcome` section saying what was built.
- One ticket per commit. The subject is a conventional type plus the ticket title in lowercase (e.g. `feat: parse the grid as it streams`), on a single line with no body and no footer, so no attribution trailers either (commitlint rejects them; Claude Code's commit attribution is turned off). Filing tickets is its own `chore:` commit.
- Live calls to Claude are fine when a ticket needs them to test something real, but keep them modest: mocks first, then only the real calls that answer a question. Bigger spends (the bake-off, listening sessions) are agreed with the user first.
- Push after every commit. The repo is public at github.com/nikolasgioannou/ghostkeys.
- Tickets state outcomes and constraints and point at `docs/design.md` sections rather than copying details.

## Principles

- **Build for today, design for where we're going.**
  - Don't add helpers, stubs, config or infrastructure that the current ticket doesn't need.
  - Do think ahead about decisions that are hard to change later (architecture, data shapes, interfaces between parts), so later commits build on today's code instead of overwriting it.
  - Deleting is fine when something no longer belongs.
- **Docs describe what's actually built.** When a decision or implementation changes, update `docs/` and the ticket in the same commit.
- **Keep `scripts/setup.sh` complete.** If a change adds something contributors must set up, extend the script (check first, then act, so it stays safe to re-run).
- **Keep the editor setup current.** When a change adds or changes a tool, update `.vscode/extensions.json` and `.vscode/settings.json` in the same commit if it affects them.
- **Research a new tool before configuring it:** how it works and is configured today, and how it fits the tools already here. Check current docs rather than relying on memory; tools change fast.
- **Ask rather than guess on direction.** When a choice is ambiguous or hard to reverse, ask the user before deciding.
- **Some things need a human.** The invariants in `docs/design.md` Part 3 change only with the user's agreement. Tickets labelled `collab` are done together with the user, not autonomously.

Commands live in `package.json` and the README, not here.
