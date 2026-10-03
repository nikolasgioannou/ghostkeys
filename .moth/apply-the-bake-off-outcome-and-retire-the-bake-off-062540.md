---
id: "062540"
title: Apply the bake-off outcome and retire the bake-off code
status: todo
priority: none
labels:
  - bakeoff
  - engine
  - m2
created_at: 2026-10-01T03:10:49.719Z
updated_at: 2026-10-01T03:29:53.965Z
blocked_by:
  - "0d74ce"
---

Make the engine match the decision, then delete what the decision made unnecessary.

**Scope**
- Apply the winning settings as the composer's defaults: chunk lengths (opening, post-steer, steady), effort, revise policy, grid resolution, thresholds and example set. If the resolution changed, update the spec, schemas, parser, checkers, bar timing, examples, the composer prompt and fixtures together.
- Make the grid format accept Claude's habits (design.md → Open questions): a `t:` section without the ` | ` before it, `cad=end`, double sharps and flats, and Roman-numeral accidentals counted from the major scale in either mode. A missing `END` after a complete footer is soft. The spec, parser, checkers, prompt and tests change together.
- Keep one real chunk from the winning runs as a committed engine test fixture: its grid text (final bars after revise, holding pattern and footer) with its expected parse. The app plays it before live composing exists, and tests can use it.
- Delete the `scripts/bakeoff` workspace (runner, ABC variant, listening page and their dependencies), remove its `runs/` entry from `.gitignore`, and remove `scripts/*` from the workspaces if nothing else uses it. Keep anything the user asked to keep in the previous ticket. The results live on in docs/research/07-bakeoff.md.

**Docs:** design.md → Composition, Grid format and Playback describe what's built now; design.md → Bake-off becomes a short historical note linking the results; design.md → Repo, tooling & gate no longer lists the workspace.

**Done when:** no losing-variant code or dependency remains, the gate passes, and design.md describes the winning pipeline as the built one.
