---
id: "3cdb60"
title: Hear steering at the next chunk
status: todo
priority: none
labels:
  - audio
  - db
  - m6
  - web
created_at: 2026-10-01T03:13:14.739Z
updated_at: 2026-10-01T03:44:53.671Z
blocked_by:
  - "43017f"
  - "537f73"
  - "be396c"
  - "e98607"
---

Up to two chunks are buffered, so without this a request would take a minute or more to be heard. The plan says steering takes effect at the next chunk (design.md → Steering). Nothing is cut mid-chunk.

**Server**
- When `sendMessage` changes the direction's version, in one step: delete saved chunks after the playing one (the piece continues from that chunk's snapshot, which is what the per-chunk snapshots are for) and abort any composition in progress. The aborted request's stream ends with `resync` (continue after the playing chunk), not an error.
- With nothing playing yet (the opening is still being composed), a version change deletes any saved chunks, aborts the opening and lets it be composed again at the opening length under the new direction.
- **The server never starts a composition itself.** The client's next `composeNextChunk({ afterChunk: playing })` composes the steered chunk at the post-steer length, inside that request, so closing the tab still aborts it (invariant 2).

**Client** (uses the queue's drop-after from the buffering ticket)
- While a `sendMessage` is pending, don't start the next queued chunk; if the playing chunk ends first, its holding pattern loops. A `resync` arriving meanwhile only ends the outstanding request and issues no new one.
- When the reply arrives with a new direction version: drop queued chunks after the playing one, ignore any `chunk-complete` from an older version, cancel any request issued before the `sendMessage`, and request `afterChunk` = the playing chunk. No retry for the old version continues.
- When the version didn't change, or the `sendMessage` failed, timed out or brought no reply, release the hold and carry on into the queued chunk at a bar boundary.
- If the steered chunk isn't ready when the playing one ends, the playing chunk's own holding pattern covers the gap.

**Tests**, on a test database (never the real file): later chunks are removed and state restored from the right snapshot; a composition aborted by the steer can't save afterwards; a chunk completed under the old version just before the steer never enters the queue; the request after a steer is for the chunk after the playing one; a `resync` arriving before the reply leads to exactly one composition of the steered chunk; the playing chunk ending while the conductor is still thinking; a failed `sendMessage` releases the hold.

**Docs:** design.md → Steering (latency and the rewind); design.md → Memory; design.md → Stream events.

**Done when:** sending "make it stormy" mid-chunk changes the music at the next chunk boundary with no silence and no stale chunk playing; closing the tab right after a steer starts no model call; the measured latency from Enter to the first steered note (median and worst case) is recorded and compared with product.md's "~15–30 s". If it's longer, raise it with the user (shorter steady chunks, or reword product.md) rather than cutting mid-chunk.
