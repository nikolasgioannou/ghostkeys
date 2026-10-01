---
id: "e4756a"
title: Play bake-off sessions on a local listening page
status: todo
priority: none
labels:
  - bakeoff
  - m2
  - ui
created_at: 2026-10-01T03:10:49.280Z
updated_at: 2026-10-01T03:29:53.665Z
blocked_by:
  - "a7ea88"
  - "f3ff0a"
---

A small local page that plays a bake-off session through a sampled grand piano.

**Research first:** serving a small page from Bun (HTML imports / `Bun.serve`, bundling the engine for the browser), and smplr's SplendidGrandPiano: velocity layers, sustain pedal, timing API, where the samples come from, licence.

**Scope**
- Lives in the bake-off workspace, with a script to start it.
- Loads a run file from `runs/`, parsed with the run-file schema; turns its bars into humanized note events with the engine; and plays a whole session (4 chunks back to back, holding patterns skipped) on the Steinway with pedal.
- Every bar that parses plays, with or without violations (the app's never-played rule doesn't apply to the comparison). A bar that doesn't parse plays as a rest of its length and is counted in the metrics.
- Schedules the session's notes up front. A real lookahead scheduler is the app's job, not this page's.
- The AudioContext starts on a click (autoplay policy).
- Develop against `--mock` runs.

**Docs:** design.md → Bake-off (how to listen); design.md → Playback notes smplr's licence and sample source.

**Done when:** a mocked session plays end to end with audible dynamics and pedal.
