---
id: "39926e"
title: Keep two chunks buffered while playing
status: todo
priority: none
labels:
  - audio
  - m4
  - web
created_at: 2026-10-01T03:11:54.072Z
updated_at: 2026-10-01T03:44:12.583Z
blocked_by:
  - "63eb7f"
  - "67e485"
---

Make it endless: the player keeps asking for music before it runs out.

**Scope**
- A player object, started from the Play click (not a React effect, so StrictMode and hot reload can't start a second loop), with at most one request outstanding.
- The queue reports how much music is buffered, and can drop every chunk after a given chunk index (add both, with tests).
- While playing and less than about two chunks are buffered, request the next chunk. A chunk joins the queue only on `chunk-complete` (the playability rule in design.md → Stream events).
- On a `resync` event, drop queued chunks after the point the server names and request from there. If `resync` names a different piece, drop every queued chunk after the playing one and continue with the new piece from its start; chunk indices of the two pieces never mix.
- Live composing replaces the fixture playback from the previous milestone: Play no longer queues the fixture, which stays only as an engine test fixture.
- A fresh piece's first chunk is short (the server's opening length), so the first sound comes as soon as possible. Until it's ready, the play control shows a waiting state.
- Pausing stops playback. The player finishes filling the buffer to about two chunks, then makes no more requests until Play.
- The buffer target is a named constant recorded in design.md → Playback.
- Check: editing a server file during playback neither stops the music nor starts a second composition; playback carries on with the tab hidden.

**Docs:** design.md → Playback (pull loop, buffer, opening, pause, resync handling).

**Done when:** the piece plays for at least 10 minutes without a gap, and while paused with a full buffer the server log shows no new requests.
