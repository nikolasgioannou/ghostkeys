---
id: "bd11d8"
title: Check notes against the planned harmony
status: todo
priority: none
labels:
  - engine
  - m1
created_at: 2026-10-01T03:09:17.124Z
updated_at: 2026-10-01T03:14:21.665Z
blocked_by:
  - "61341d"
---

The second half of the checker: do the notes match the harmony Claude planned for each bar? This catches harmonic aimlessness and wrong notes (docs/research/02).

**Research first:** decide between writing the Roman numeral → pitch-class logic in-house and using a theory library such as Tonal. If you choose a library, research its current version, API and Romantic chord coverage, and record the choice.

**Scope**
- Roman numeral in the bar's local key → chord pitch classes, covering the grammar in design.md → Grid format (inversions, sevenths, secondary dominants, borrowed chords, N6, augmented sixths).
- Notes on strong slots should be chord tones. Weak-slot passing, neighbour and suspension tones, and chromatic colour, are normal Romantic writing and are not errors.
- Flag a bar as `soft` when its share of unexplained notes passes a named threshold. Only clearly wrong harmony is `hard`. Constants are named and recorded in design.md (the bake-off tunes them).
- Same violation shape as the playing-rules checker.
- Tests: diatonic chords, a secondary dominant, an augmented sixth, a bar full of passing tones that must pass, and a bar in the wrong key that must fail.

**Docs:** design.md → Grid format (the supported chord vocabulary); design.md → Composition.

**Done when:** the worked example passes, and the tests show ordinary chromatic writing isn't flagged while wrong harmony is.
