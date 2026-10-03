---
id: "e8f93c"
title: Draw the paper roll
status: todo
priority: none
labels:
  - m7
  - ui
  - web
created_at: 2026-10-01T03:13:37.710Z
updated_at: 2026-10-01T03:31:52.819Z
blocked_by:
  - "3cdb60"
  - "43017f"
  - "bbf93d"
---

The visualizer: a player-piano roll whose perforations are the notes being played, as designed in design.md → Look.

**Scope**
- The queue reports the playing position down to the bar and offset (add it, with tests). The roll reads it each frame.
- Canvas 2D, crisp on HiDPI screens, resizing live.
- Notes appear as perforations (pitch across, time along the roll), scrolling in sync with the AudioContext clock through that position. Pause freezes it; resume continues.
- It follows what actually plays: tempo stretch, the looping holding pattern, and music dropped by a steer's splice.
- Respects reduced motion (a calmer mode, agreed in the look).
- Steady frame rate over a long session, with no growth in memory or drawing work as the piece goes on.

**Docs:** design.md → Look (the roll); design.md → Playback (how the roll reads the position).

**Done when:** the roll stays in sync with the music after 10 minutes, across pause/resume, a holding-pattern loop and a steer, and looks right on a HiDPI screen.
