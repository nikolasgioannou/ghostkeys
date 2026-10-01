---
id: "adbde3"
title: Compare pianos and variants blind
status: todo
priority: none
labels:
  - bakeoff
  - m2
  - ui
created_at: 2026-10-01T03:10:49.389Z
updated_at: 2026-10-01T03:14:21.887Z
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
