---
id: "bd11d8"
title: Check notes against the planned harmony
status: done
priority: none
labels:
  - engine
  - m1
created_at: 2026-10-01T03:09:17.124Z
updated_at: 2026-10-01T04:18:47.942Z
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

## Outcome

- Decided: in-house Roman numeral → pitch-class logic rather than a library (Tonal 6.5 exists, but our grammar — secondary targets, named augmented sixths, the minor leading-tone convention — is small and ours). Recorded in design.md → Composition.
- `checks/harmony.ts`: `chordPitchClasses` (the full vocabulary from the grid spec), `beatLength` (compound meters beat in dotted quarters), and `checkHarmony`: strong-slot notes vs the planned chord in the bar's local key; suspensions tied over the barline excluded; `soft` above 0.34 off-chord share, `hard` above 0.67 (named constants, tuned by the bake-off). Same violation shape as the playing rules.
- 32 tests: 22 chord spellings (diatonic, sevenths, dim7, half-dim, maj7, borrowed, inversions, secondary dominants and leading-tone chords, augmented, N6/It6/Fr6/Ger6, minor-key conventions), beat lengths, the worked example passing, passing tones and a suspension not flagged, wrong-key bar hard, some wrong notes soft, local key respected.
- design.md → Grid format documents the harmony rule and chord vocabulary.
