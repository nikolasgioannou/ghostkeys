---
id: "cbcc2b"
title: Recover from composer failures
status: todo
priority: none
labels:
  - engine
  - m4
  - web
created_at: 2026-10-01T03:11:54.298Z
updated_at: 2026-10-01T03:30:44.334Z
blocked_by:
  - "43017f"
---

Calls fail; the music shouldn't. Because a chunk only plays once it's complete, any failed chunk can simply be composed again while the holding pattern plays.

**Scope**
- Errors before the first delta: retry up to twice with backoff.
- `refusal` stop reason, `finishReason: 'length'`, a stream that's cut, or a bar, holding pattern or footer still invalid after the revise: discard the chunk (its bars are never played) and compose it again from the same context.
- Two inactivity limits, derived from the smoke-test and bake-off timings: time to the first model delta (allowing for the hidden thinking phase) and the gap between deltas after the first. Exceeding either counts as a cut stream. Heartbeat events reset neither.
- Recompose the same chunk at most `MAX_RECOMPOSE` times in a row (a named constant in design.md → Composition); after that, treat it like a non-retryable error.
- Client transport errors (a dropped connection, or a server-file edit that reloads the server function while the in-memory state survives): retry with backoff for the same `afterChunk`, unless the server answered `resync`. Idempotency means nothing is composed twice.
- Every retry, backoff wait and recomposition runs inside the client's `composeNextChunk` request and stops when its abort signal fires (invariant 2).
- Non-retryable errors (bad key, out of credits) and an exhausted recompose limit: stop requesting and log it. What the music does then (keep looping and fade out? stop?) touches invariant 4, so ask the user while working on this ticket and record the answer.
- Tests with the mock model for each failure path, including: no chunk index ever completes twice; two compositions for one index never run at once (a failed attempt is discarded before the retry starts); a chunk that fails every attempt stops after `MAX_RECOMPOSE`; a disconnect during a backoff wait or a recomposition starts no further model call.

**Docs:** design.md → Composition (failure handling); design.md → Playback (what plays meanwhile).

**Done when:** every failure path has a passing test, and dropping the connection mid-chunk (a server-file edit, or turning the network off and on) recovers by itself. Recovery across a full server restart is verified once state lives in SQLite.
