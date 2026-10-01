---
id: "3faa43"
title: Turn bars into timed note events
status: todo
priority: none
labels:
  - audio
  - engine
  - m2
created_at: 2026-10-01T03:10:48.830Z
updated_at: 2026-10-01T03:29:53.340Z
blocked_by:
  - "6b98de"
---

Bridge from notation to sound: convert parsed bars into note events a player can schedule. Pure engine code, so the bake-off page and the app play music the same way.

**Scope**
- Per bar, output `{ barNumber, durationSec, events }` at the bar's written tempo, where events are notes (`offsetSec`, `midi`, `velocity`, `durSec`) and pedal changes (sustain down/up at an offset). Offsets are relative to the bar start, so a player can apply tempo stretch and rubato without recomputing events. Queued bars are never replaced: a chunk plays only after `chunk-complete` (design.md → Stream events).
- Onset slots → seconds from the meter and tempo; rit./a tempo marks shape the bar's internal timing; ties join into one longer note.
- Dynamics marks and hairpins → base velocity, using a scale recorded in design.md → Playback.
- Pedal marks → sustain events.
- The holding pattern converts the same way.
- Tests: the worked example, tempo marks, a tie across a barline, hairpins, pedal.

**Docs:** design.md → Playback (the event shape and the dynamics scale).

**Done when:** the worked example converts to the expected events and the tests pass.
