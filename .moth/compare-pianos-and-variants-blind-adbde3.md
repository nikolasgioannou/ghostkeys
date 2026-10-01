---
id: "adbde3"
title: Compare pianos and variants blind
status: done
priority: none
labels:
  - bakeoff
  - m2
  - ui
created_at: 2026-10-01T03:10:49.389Z
updated_at: 2026-10-01T05:09:27.687Z
blocked_by:
  - "6ecb29"
  - "e4756a"
---

Turn the listening page into a blind test, so the user picks by ear and not by label.

**Research first:** `@tonejs/piano` (Salamander Grand, 16 velocity layers, pedal; it needs Tone.js) — how it loads samples, its timing API, and its licence (Salamander samples are CC-BY, which needs attribution).

**Scope**
- A piano toggle: smplr Steinway vs Tone.js Salamander, playing the same session.
- Sessions shown under shuffled, hidden labels. The listener ranks the variants within each session.
- After ranking, reveal the labels and each run's metrics (validity, violations, revise count, real-time factor, tokens), and show a summary to paste into the results doc.

**Docs:** design.md → Bake-off (the blind procedure).

**Done when:** with mocked runs for A, B and C, a full blind ranking can be done and the reveal shows the right labels and metrics.

## Outcome

- Research: `@tonejs/piano` 0.2.1 (MIT; peer `tone` ^14, so Tone 14.9.17 is pinned; last released 2022): `new Piano({ velocities })`, `load()`, `keyDown/keyUp({ midi, velocity 0–1, time })`, schedulable `pedalDown/pedalUp`, `stopAll()`; Tone shares our AudioContext via `Tone.setContext`. Samples: Salamander Grand Piano V3 (a Yamaha C5) by Alexander Holm, CC-BY 3.0 (attribution needed; credited on the page and in design.md); hosted at tambien.github.io (checked live).
- `listen/pianos.ts`: both pianos behind the `PianoLike` interface.
- `listen/metrics.ts`: per-run metrics (valid bars, violations before → after, revised chunks, real-time factor mean/worst, first bar, output/thinking tokens, cache reads).
- The page is now a blind test: runs grouped by setup, variants shuffled under "Take n" labels, a piano toggle, rank selects, and Reveal (labels, metrics table sorted by rank, a Markdown summary to paste).
- Verified in the in-app browser with mock runs for A, B and C: the Salamander loaded and played a take, ranking and reveal worked, no console errors.
- The mock now reports whole-number token counts.
- design.md → Bake-off (blind comparison) and Stack (both piano candidates, licences).
