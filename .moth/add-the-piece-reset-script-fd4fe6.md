---
id: "fd4fe6"
title: Add the piece reset script
status: todo
priority: none
labels:
  - db
  - m5
  - tooling
created_at: 2026-10-01T03:12:28.210Z
updated_at: 2026-10-01T03:44:54.085Z
blocked_by:
  - "39926e"
  - "d73fae"
  - "e98607"
---

There's no "new piece" button by design. For a blank slate, or after a grid format change, there's a script.

**Scope**
- `bun run piece:reset` deletes the piece and its chunks. The model-call log is kept.
- Works with the dev server running. The server reads state from the database on every composition, so the next Play starts fresh.
- A composition still running for the old piece, or a request naming it, finds the piece gone: nothing is saved, and its stream ends with `resync` to the fresh piece, never `chunk-complete`.
- An open tab learns of the reset from that `resync` (or on its next request), drops queued chunks after the playing one, and starts the new piece's opening.
- Asks for confirmation unless given `--yes`.

**Docs:** design.md → Memory (reset); README.

**Done when:** resetting while a tab is playing, the tab receives no newly composed old-piece chunk, plays out at most the chunk that's playing when it learns, then continues with a fresh opening with no silence and nothing cut mid-chunk; no chunk of the old piece reappears after a reload.
