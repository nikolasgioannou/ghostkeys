---
id: "e98607"
title: Resume where you left off
status: todo
priority: none
labels:
  - db
  - m5
  - web
created_at: 2026-10-01T03:12:27.992Z
updated_at: 2026-10-01T03:44:12.889Z
blocked_by:
  - "39926e"
  - "d73fae"
---

Close the tab, come back tomorrow, press Play: the same piece carries on.

**Scope**
- The queue reports the index of the chunk that's playing (add it, with tests). When a chunk starts playing, the client reports it with its piece id (a small fire-and-forget server function, schema in the engine). The server saves it in a new column on `pieces` (Drizzle migration) and ignores reports for any other piece.
- A request without a piece id (a newly opened tab) gets `resync` naming the current piece and `afterChunk` = the saved playing index − 1 (or the start, when nothing is recorded), so the chunk the listener had reached and the saved chunks after it replay from the database. Sound is immediate, and composing continues after the last saved chunk.
- With no saved piece, Play starts a fresh one as before.
- Resume must sound identical to the original take, since humanization is seeded by chunk and bar.

**Docs:** design.md → Memory (resume semantics); design.md → Piece state & data model (the new column); design.md → Stream events (the resume `resync`).

**Done when:** play a few chunks, reload mid-chunk, press Play: that chunk restarts from its beginning straight away, and the piece continues with no repeated or skipped chunk.
