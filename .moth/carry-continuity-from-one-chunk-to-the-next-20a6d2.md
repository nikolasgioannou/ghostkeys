---
id: "20a6d2"
title: Carry continuity from one chunk to the next
status: todo
priority: none
labels:
  - engine
  - m1
created_at: 2026-10-01T03:10:01.166Z
updated_at: 2026-10-01T03:29:20.497Z
blocked_by:
  - "417e23"
---

An endless fantasia needs each chunk to pick up where the last one ended. Define that hand-off once, so the bake-off and the app use the same code.

**Scope**
- A pure `nextContext(context, complete)`, where `complete` is the `chunk-complete` event's payload, that folds a finished chunk into the next `ComposerContext`: the last N bars as grid text (taken from the bars' source lines, so it's exactly what Claude wrote, revisions included), the footer (key, last chord, pedal state), the running summary updated from the footer's summary line, theme-bank updates (capped at the spec's 3–5 motifs), and the roadmap. Everything musical comes from what Claude wrote; code only carries it forward.
- The steering note carries over unchanged (the conductor will own it later).
- Tests: a fresh context followed by three chunks of fixture results; the theme-bank cap; a footer missing optional fields; the summary staying bounded in length.

**Docs:** design.md → The piece (how the piece carries itself forward); design.md → Piece state & data model (new Part 3 section, starting with `ComposerContext` and the fold).

**Done when:** the tests pass and a context after many chunks stays bounded in size.
