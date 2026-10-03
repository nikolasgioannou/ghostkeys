---
id: "062540"
title: Apply the bake-off outcome and retire the bake-off code
status: done
priority: none
labels:
  - bakeoff
  - engine
  - m2
created_at: 2026-10-01T03:10:49.719Z
updated_at: 2026-10-03T18:12:02.580Z
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

## Outcome

**The engine now runs with the bake-off's choices.**
- `OPENING_BARS` (8), `STEADY_BARS` (16), `TURN_BARS` (8) and `DEFAULT_EFFORT` (`low`) are exported from `@ghostkeys/engine/llm`.
- `composeChunk`'s `effort` is optional and defaults to `DEFAULT_EFFORT`.
- Unchanged: revising stays on by default (the smoke test turns it off), and so do the resolution, the thresholds and the examples.

**The grid format accepts Claude's habits.**
- A `t:` or `ped:` section run on from the other without ` | `.
- `cad=end` as a phrase end.
- Double sharps and flats, in pitches and notes.
- Roman-numeral accidentals counted from the major scale in either mode.
- A soft `missing-end`.

The prompt mentions the double accidentals and the accidental rule, and new tests cover each change.

**A real chunk is kept.** `OPENING_CHUNK` (`grid/opening.fixture.ts`) is a 16-bar Ab-major opening Claude wrote in the bake-off, unrevised and clean. Its test checks the parse, that it passes every check, and its timing (about 45 s).

**The bake-off is retired.**
- The `scripts/bakeoff` workspace is deleted, with its dependencies (abcjs, smplr, @tonejs/piano, Tone), the root `bakeoff` scripts, the README row and the `.gitignore` entry. `scripts/*` stays as a workspace glob for the smoke test.
- Before the run files went, the timings the failure-recovery ticket needs were recorded in docs/research/07-bakeoff.md.
- design.md describes the built pipeline and format, and its Bake-off section is now a short historical note that keeps the pedal lesson for the app's player.
