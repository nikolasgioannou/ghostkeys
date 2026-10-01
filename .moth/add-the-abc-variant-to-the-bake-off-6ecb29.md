---
id: "6ecb29"
title: Add the ABC variant to the bake-off
status: done
priority: none
labels:
  - bakeoff
  - m2
created_at: 2026-10-01T03:10:49.165Z
updated_at: 2026-10-01T05:03:20.001Z
blocked_by:
  - "a7ea88"
---

Variant A: does plain ABC notation, which frontier models have seen a lot of, beat our grid? It lives in the bake-off workspace only and is deleted if it loses.

**Research first:** abcjs — parsing ABC, getting note timing, velocity and dynamics out of it, and its licence.

**Scope**
- Its own prompt: same role and the same originality rules, interleaved two-voice ABC (`V:RH`/`V:LH`, voices aligned per bar), adaptive thinking. The prompt asks for the ABC bars followed by the grid spec's footer block and a holding pattern written in ABC, so `nextContext` folds A the same way as B and C. A's previous bars are carried in its context as the ABC it wrote.
- Convert abcjs output into the engine's bar schema, so the playing-rules checker, copy check and listening page treat A like B and C. There are no plan lines, so the harmony check is reported as n/a, and there's no plan-based rubato. Dynamics become velocity.
- ABC that can't convert exactly into the grid's onset slots makes that bar invalid (counted against parse validity). The converter never rounds or approximates notes (invariant 1).
- Record parse validity (bars that parse and convert cleanly) as an extra metric.
- Runs in the same session shape as B and C, and supports `--mock`.

**Docs:** design.md → Bake-off (variant A details).

**Done when:** a mocked ABC session produces run files the page can play, and validity is reported.

## Outcome

- Research: abcjs 6.7.1 (MIT). `parseOnly` + `setUpAudio({})` run headlessly under Bun and give per-voice notes (MIDI pitch, start and duration in whole notes); ties are merged; dynamics are note decorations, counted per bar per voice; key/meter/tempo from the header.
- `scripts/bakeoff/src/abc.ts`: `ABC_SYSTEM_PROMPT` (shared `COMPOSER_ROLE`, now exported from the engine with the example-copying warning moved into the grid prompt's examples section), `buildAbcMessage`, `convertAbc` (exact slot conversion, barline-crossing notes split into ties, inexact rhythms make the bar invalid, never rounded), `abcReplyToItems` (header, placeholder plan lines carrying only dynamics, bars, holding pattern, footer, END), `composeAbcChunk` (playing rules + copy check; no harmony), `runAbcSession` (A's continuity carries its own ABC). The runner gained `compose`, `validBars` and `nextContext` hooks.
- Mock ABC replies for `--mock`; `bun run bakeoff --variant A --mock` writes a valid run with all bars converted.
- Tests: exact conversion (rhythms, chord, triplet, tie, dynamics), a quintuplet bar marked invalid, missing header → null, a whole reply passing the playing rules, a mock A session.
- design.md → Bake-off (variant A).
