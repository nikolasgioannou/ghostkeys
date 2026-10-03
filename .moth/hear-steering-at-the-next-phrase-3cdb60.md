---
id: "3cdb60"
title: Hear steering at the next phrase
status: todo
priority: none
labels:
  - audio
  - db
  - m6
  - web
created_at: 2026-10-01T03:13:14.739Z
updated_at: 2026-10-03T18:07:19.061Z
blocked_by:
  - "43017f"
  - "537f73"
  - "632bdc"
  - "be396c"
  - "e98607"
---

Up to two chunks are buffered, and a steady chunk plays for 40–55 s, so waiting for a chunk boundary could take about 90 s. Instead a short turn is spliced in at the next phrase that's about `SPLICE_LEAD_SEC` (25 s) ahead (design.md → Steering), using the engine's splice from the previous ticket. Nothing is cut mid-phrase.

**Server**
- When `sendMessage` changes the direction's version, in one step: delete saved chunks after the playing one and abort any composition in progress. The aborted request's stream ends with `resync` (continue after the playing chunk), not an error.
- The turn request names the splice point: `composeNextChunk({ afterChunk: playing, afterBar: k })`. The server truncates the saved playing chunk after bar k, saves a snapshot built with the engine's splice context, and composes the turn from it. A later reload replays the truncated chunk, so the cut bars never come back.
- With nothing playing yet (the opening is still being composed), a version change deletes any saved chunks, aborts the opening and lets it be composed again at the opening length under the new direction.
- **The server never starts a composition itself.** The client's next request composes the turn at the post-steer length, inside that request, so closing the tab still aborts it (invariant 2).

**Client** (uses the queue's drop-after from the buffering ticket; the queue gains the playing position to the bar and a drop-after-bar within the playing chunk, with tests)
- While a `sendMessage` is pending, don't start the next queued chunk; if the playing chunk ends first, its holding pattern loops. A `resync` arriving meanwhile only ends the outstanding request and issues no new one.
- When the reply arrives with a new direction version: pick the splice point (the first phrase end at least `SPLICE_LEAD_SEC` ahead of what's playing, else the playing chunk's last bar), drop the queued music after it, ignore any `chunk-complete` from an older version, cancel any request issued before the `sendMessage`, and request the turn from that point. No retry for the old version continues.
- When the version didn't change, or the `sendMessage` failed, timed out or brought no reply, release the hold and carry on into the queued chunk at a bar boundary.
- If the turn isn't ready when the splice point is reached, the playing chunk's own holding pattern covers the gap. It continues from the chunk's last bar, so start it at the splice point only if its harmony fits; otherwise play on to the chunk's end, decide which, and document it.

**Tests**, on a test database (never the real file): later chunks are removed and state restored from the right snapshot; a composition aborted by the steer can't save afterwards; a chunk completed under the old version just before the steer never enters the queue; the request after a steer names the right splice point (a phrase end far enough ahead, or the last bar); a reload after a splice replays the truncated chunk; a `resync` arriving before the reply leads to exactly one composition of the steered chunk; the playing chunk ending while the conductor is still thinking; a failed `sendMessage` releases the hold.

**Docs:** design.md → Steering (latency, the splice and the rewind); design.md → Memory; design.md → Stream events.

**Done when:** sending "make it stormy" mid-chunk changes the music at the next phrase about 25–35 s later, with no silence and no stale music playing; closing the tab right after a steer starts no model call; the measured latency from Enter to the first steered note (median and worst case) is recorded and compared with product.md's "roughly half a minute". If it's longer, raise it with the user rather than cutting mid-phrase.
