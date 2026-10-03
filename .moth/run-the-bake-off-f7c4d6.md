---
id: "f7c4d6"
title: Run the bake-off
status: done
priority: none
labels:
  - bakeoff
  - collab
  - m2
created_at: 2026-10-01T03:10:49.498Z
updated_at: 2026-10-03T16:57:30.695Z
blocked_by:
  - "6f828d"
  - "adbde3"
---

Done together with the user: it spends money with their key (about $5–8, design.md → Bake-off).

**Scope**
- Run variants A, B and C live: 2 sessions each, plus the variant-C session at 8-bar chunks.
- Check the **real-time factor** (generation including revise ÷ music duration) for steady-state chunks. The pass bar is about 0.6 or lower at the chosen effort, so generation stays comfortably ahead of playback.
- **If no variant passes**, stop and work out options with the user before going further (lower effort, coarser grid resolution, revise only on hard violations, shorter plan lines). Everything after M2 assumes generation keeps up.
- Write `docs/research/07-bakeoff.md`: what ran, cost, every metric per variant, time to first bar at 8 and 16 bars, and what the copy and harmony thresholds caught.

**Docs:** docs/research/07-bakeoff.md.

**Done when:** all runs completed, the results doc is written, and the real-time-factor question has an answer.

## Outcome

All runs completed for about $2: A, B and C at 16 bars and low effort (2 sessions each), C at 8 bars, and C at medium effort. Results are in `docs/research/07-bakeoff.md`. On the real-time factor, every variant passes at 16 bars and low effort (steady-state A 0.26–0.47, B 0.26–0.47, C 0.55–0.60). Medium effort (0.96) and 8-bar chunks (0.88) fail. The copy check caught nothing. Most of the remaining violations are format mismatches rather than musical ones: `t:` written inside `ped:`, `cad=end`, a missing `END`, a double flat, and `bVI` in minor. Run files now carry the effort in their names, and the listening page groups by it.
