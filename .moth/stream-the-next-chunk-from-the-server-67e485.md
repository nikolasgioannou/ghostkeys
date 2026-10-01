---
id: "67e485"
title: Stream the next chunk from the server
status: todo
priority: none
labels:
  - engine
  - m4
  - web
created_at: 2026-10-01T03:11:53.962Z
updated_at: 2026-10-01T03:44:12.689Z
blocked_by:
  - "062540"
  - "80ed04"
---

Compose live: the browser asks for the next chunk and receives typed events as Claude writes it (design.md → Transport: one streaming server function per chunk).

**Scope**
- A `createServerFn` async generator, `composeNextChunk({ pieceId, afterChunk })` (the first request of a session has no piece id yet), validated with an engine Zod schema via `.validator()`. It yields the engine's stream events (bars as progress, `bar-revised`, `chunk-complete`) and an error event. Request and event schemas live in the engine (invariant 5); transport-only additions go there too.
- Piece state for now: a piece id, a chunk index and a `ComposerContext`, held in a `globalThis` singleton so dev hot reload doesn't reset it, and advanced on `chunk-complete` with the engine's `nextContext`. The database replaces this in the next milestone.
- **One composition at a time** for the piece. Requests are idempotent:
  - a request for a chunk that's already complete replays it (the singleton keeps the last completed chunk);
  - a request for a chunk in progress joins it;
  - a request whose `pieceId` or `afterChunk` doesn't match the piece gets a typed `resync` event (the current piece id and the chunk to continue after).
  So two tabs, a reload or React StrictMode can never fork the piece.
- The server picks each call's chunk length: the opening length when the context is fresh, the steady length otherwise (named constants from the bake-off, design.md → Composition).
- The Claude client is created in a `*.server.ts` module that reads `OPENROUTER_API_KEY` (failing clearly if it's missing). It loads the root `.env` as design.md → Claude access describes. The session id is the piece id.
- **Aborting (invariant 2):** each composition has its own `AbortController`, separate from any request. A request's generator `finally` detaches it, and the composition is aborted when its last attached request detaches. Anything that aborts a composition removes it from the in-progress registry in the same step, so the next request starts a new composition instead of joining the aborted one. Abort propagation in TanStack Start has changed between releases, so verify it for real.
- With thinking hidden, the stream can be silent for tens of seconds. Test a 60 s silent gap (mock model) through the real server function under `bun --bun vite dev`. If the connection drops, add a heartbeat event (schema + design.md).

**Docs:** design.md → Transport; design.md → Stream events (including `resync`); design.md → Claude access (where the key is read).

**Done when:** a chunk streams to the browser (log the events); closing the tab mid-chunk stops the model stream within about a second (server log); two overlapping requests compose once, closing the first still delivers `chunk-complete` to the second, and closing both stops the model stream; a repeated request replays; the key doesn't appear in the client build output.
