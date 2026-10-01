---
id: "be396c"
title: Steer the composer toward the direction
status: todo
priority: none
labels:
  - engine
  - m6
  - prompts
created_at: 2026-10-01T03:13:14.629Z
updated_at: 2026-10-01T03:44:12.475Z
blocked_by:
  - "0bd789"
---

Make the composer actually go where the listener asked, with Claude choosing every step of the way.

**Scope**
- `ComposerContext` gains an optional `steering` field: the direction version being followed, the transition kind, and chunks remaining. It's optional so snapshots saved before this ticket still validate and the piece doesn't need a reset; a missing `steering` (or a piece with no Direction yet) counts as version 0. Progress lives only here, in each chunk's snapshot, never on the piece row: a rewind to a snapshot restores it exactly.
- At the start of each composition the server compares the piece's `Direction` version with the snapshot's `steering` version. A newer Direction starts a new transition (the server composes that chunk at the post-steer length, a named constant from the bake-off); otherwise the transition continues. `nextContext` decrements chunks remaining. At zero the transition is finished but `steering` keeps its version (with chunks remaining 0), so later compositions see that version as already followed and use the steady length; the steering note keeps rendering the direction's targets as the settled baseline.
- Code renders the direction into the steering note: the targets, the conductor's idiom note, and for a gradual transition how many chunks remain (e.g. "arrive at a stormy C minor over the next 3 chunks"). For an immediate one, the note asks for a composed transition within this chunk (pivot chord, tempo ramp, change of register and texture). **Claude chooses every intermediate key, tempo, register and texture**; code never computes in-between musical values.
- `chunk-complete` gains an optional direction version (the composing context's `steering` version, defaulting to 0), so chunks saved earlier still replay and validate.
- The composer only ever sees conductor output, never the listener's raw words (invariant 3).
- Tests: immediate and gradual progressions across several chunks; after a gradual transition finishes, the next chunks use the steady length and don't restart it; a snapshot and a saved chunk from before this ticket load, compose and replay; the assembled message contains the remaining count but no code-computed tempo or key; no raw chat text or denylisted name ever reaches the composer messages.

**Docs:** design.md → Steering (how direction reaches the composer); design.md → Composition; design.md → Piece state & data model (the `steering` field); design.md → Stream events (the version on `chunk-complete`).

**Done when:** the tests pass and, with mocks, a gradual direction progresses over the stated number of chunks and then settles.
