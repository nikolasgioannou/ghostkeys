---
id: "43017f"
title: Fall back to the holding pattern when the next chunk is late
status: todo
priority: none
labels:
  - audio
  - m4
  - web
created_at: 2026-10-01T03:11:54.181Z
updated_at: 2026-10-01T03:30:44.231Z
blocked_by:
  - "39926e"
---

Invariant 4: the music never stops. When the next chunk isn't ready in time, the ghost lingers instead of falling silent, using notes Claude wrote (invariant 1).

**Scope**
- Add a tempo factor to the queue's time conversion (with tests). When buffered music drops below a threshold, stretch the tempo gradually, up to about 10% slower.
- If the current chunk ends and the next isn't complete, loop that chunk's holding pattern (Claude wrote it on the closing harmony), easing the volume down a little while it loops.
- When the next chunk completes, leave the loop at a bar boundary, restore tempo and volume, and continue.
- Send pedal-up at every discontinuity (entering or leaving the loop) so notes don't ring through.
- The decision logic (when to stretch, when to loop, when to leave) is pure engine code with tests. Every threshold is a named constant in design.md → Playback.
- Check: throttle generation (mock delays) and listen to the hand-off.

**Docs:** design.md → Playback → safety net.

**Done when:** with generation artificially delayed, playback never goes silent, the loop sounds intentional, and it leaves cleanly when the chunk arrives.
