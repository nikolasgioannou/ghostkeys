---
id: "f3ff0a"
title: Humanize the performance
status: done
priority: none
labels:
  - audio
  - engine
  - m2
created_at: 2026-10-01T03:10:48.941Z
updated_at: 2026-10-01T04:55:26.459Z
blocked_by:
  - "3faa43"
---

Make the ghost sound like a pianist, not a sequencer. The bake-off judges by ear, so clips should sound the way the app will (docs/research/01, Playback realism).

**Scope**, applied on top of the timed note events:
- Velocity shaping: metric accents, and melody weighting using the spec's melody rule (the melody sings over the accompaniment).
- Small onset jitter (±5–15 ms), seeded from the chunk and bar number, so a replay or resume sounds identical.
- Rolled chords: lower notes slightly before upper ones.
- Phrase-end rubato from the plan's cadence/phrase marks, expressed as a per-bar timing curve, not by moving bars.
- Pedal changes slightly after the beat on harmony changes.
- Every amount is a named constant recorded in design.md → Playback, so tuning sessions can adjust them.
- Tests: determinism (the same seed gives the same output), each effect stays within its bounds, and the melody is louder than the accompaniment at the same onset.

**Docs:** design.md → Playback (humanization and its constants).

**Done when:** the tests pass and humanizing the worked example twice gives identical output.

## Outcome

- `performance/humanize.ts`: `humanize(bars, seed)` returning timed bars of the same shape: metric accents (+6 downbeat, +3 beats), melody +10 / accompaniment −4, seeded jitter ±12 ms (mulberry32 seeded by chunk index and bar; never before the bar), rolled chords (≥3 notes in a hand, +12 ms per note from the bottom), phrase-end rubato (local tempo 8% slower by the end, the bar ~4% longer), pedal down 40 ms after an up at a change. All amounts are named constants.
- 7 tests: determinism (same seed equal, different seed differs), schema shape, jitter bounds and no negative onsets, melody louder than accompaniment, chord rolled from the bottom, phrase-end bar broadened within bounds (and other bars unchanged in length), pedal lag.
- design.md → Playback (humanization and its constants).
