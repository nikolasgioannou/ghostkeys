---
id: "e4756a"
title: Play bake-off sessions on a local listening page
status: done
priority: none
labels:
  - bakeoff
  - m2
  - ui
created_at: 2026-10-01T03:10:49.280Z
updated_at: 2026-10-01T05:06:02.896Z
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

## Outcome

- Research: Bun's HTML imports in `Bun.serve` routes bundle the page's TypeScript (and the engine) for the browser; smplr 1.1.0 (MIT): `SplendidGrandPiano(context)`, `ready` promise, `start({ note, velocity, time, duration })`, `setCC(64, …)` for sustain (immediate, not scheduled), samples fetched from smplr's public host; the samples are Akai's Steinway set, released into the public domain.
- `scripts/bakeoff/src/listen-server.ts` (`bun run bakeoff:listen`, http://localhost:3001): serves the page, lists `runs/`, serves run files (names validated).
- `listen/session-player.ts`: `scheduleSession(run, piano, context)` over a `PianoLike` interface (so the next ticket can plug in a second library): per chunk `timeChunk` → `humanize(…, chunk.index)`, notes scheduled up front, pedal via timers on the audio clock, unparsed bars as rests, pedal up at the end, `stop()`.
- `listen/listen.ts` + `index.html`: run picker, Play (AudioContext and piano created on the click), Stop; run files parsed with `RunFileSchema`.
- Verified in the in-app browser: a mocked variant-A session loaded the Steinway, scheduled 136 notes over 44 s, no console errors. (Audible checking is the user's, in the bake-off.)
- Also fixed (from the ABC ticket): the runner counted variant A's "before revise" violations with the grid composer's checks (harmony on placeholder plans); without a revise it now uses the composer's own violations.
- design.md → Bake-off (listening) and Stack (the Audio row's first candidate).
