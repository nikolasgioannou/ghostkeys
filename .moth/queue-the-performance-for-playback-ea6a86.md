---
id: "ea6a86"
title: Queue the performance for playback
status: todo
priority: none
labels:
  - audio
  - engine
  - m3
created_at: 2026-10-01T03:11:21.623Z
updated_at: 2026-10-01T03:30:14.783Z
blocked_by:
  - "f3ff0a"
---

The pure core of the player, testable without a browser: what plays when.

**Scope**
- A queue of chunks of humanized bars, in the timed-event shape (per bar, `durationSec` plus bar-relative offsets). Keep that bar-relative time model: later tickets add a tempo factor, dropping chunks and position reporting on top of it.
- Append chunks.
- Read the events due in a time window (the lookahead), converting bar offsets to absolute times.
- Pause and resume keep the exact musical position.
- Report when the queued music has run out.
- Only what the first player needs. Tempo stretch, dropping chunks, buffered-amount and position reporting arrive with the tickets that use them.
- Tests: windows spanning bar and chunk boundaries, pause and resume mid-note, and running out of music.

**Docs:** design.md → Playback (the queue and its time model).

**Done when:** the tests pass and the queue has no browser dependencies.
