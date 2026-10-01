---
id: "ee395f"
title: Specify the grid format
status: todo
priority: none
labels:
  - docs
  - engine
  - m1
created_at: 2026-10-01T03:09:16.686Z
updated_at: 2026-10-01T03:14:21.602Z
blocked_by:
  - "2c06c7"
---

Write design.md → Grid format: the text notation Claude composes in. Everything in the composer pipeline depends on it: schemas, parser, checker, prompt, examples, stored chunks and the paper roll. It's drafted from docs/research/01–02 (Libretto-style explicit timing beats ABC's running durations), validated by the bake-off, and the user tweaks it at the end. Not a collab ticket.

**Requirements**
- **Line-oriented and streamable.** Every item is complete at a line boundary, and the end of each bar is unambiguous (a fixed RH+LH line pair, or a terminator), so the parser can emit a bar the moment it's done.
- **Block order:** chunk header (meter, tempo, key) → per-bar plan lines → bars → holding pattern → footer.
- **Plan line per bar:** bar number, local key (so any bar boundary describes itself), Roman numeral in a defined grammar (inversions, sevenths, secondary dominants, borrowed chords, N6, augmented sixths), cadence/phrase end, motif reference and transformation, texture idiom, dynamics (marks and hairpins).
- **Notes:** separate RH and LH lines; explicit onset slots, provisionally 12 per quarter so 16ths and triplets fit (the bake-off confirms the resolution); pitch in the engine's scientific notation; chords; durations; ties across barlines (onset + duration must end within the bar unless tied); melody rule (e.g. the top RH note at each onset is the melody unless marked); sustain pedal down/up; tempo marks (rit., a tempo).
- **Holding pattern:** 2–4 whole bars that loop cleanly: they end on a harmony leading back to their first bar, with no notes ringing past the end. It's the musical safety net (invariant 4).
- **Footer:** key, last chord, pedal state, a one-line running-summary update, theme-bank updates (3–5 named motifs at most; say which representation wins, literal notes or interval + rhythm, since the briefs differ), and a roadmap line (the next 2–3 key areas and moods, written by Claude; code never plans the music).
- **Revise reply format:** only the corrected bars, each with its bar number, in the same syntax (plus a corrected holding pattern or footer if those changed).
- **Token economy:** short syntax, no rest tokens. Generation must keep ahead of playback. State the expected tokens per bar.
- **Checker rules:** list them, split into hard (always revise) and soft (revise only above a threshold), so the checker tickets implement exactly this.
- Non-grid lines: code fences and blank lines are ignored; anything else is a parse error, not a crash.

Include one complete worked chunk of about 4 bars, with a chord, a triplet, a tie, pedal, a holding pattern and a footer. It becomes the parser's first test fixture.

**Docs:** design.md → Grid format (new section in Part 3); design.md → Open questions keeps "grid resolution" open until the bake-off.

**Done when:** the spec answers every question the parser and checker tickets need, and the worked example follows it exactly.
