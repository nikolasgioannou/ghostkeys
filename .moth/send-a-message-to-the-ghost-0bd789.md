---
id: "0bd789"
title: Send a message to the ghost
status: todo
priority: none
labels:
  - db
  - m6
  - web
created_at: 2026-10-01T03:13:14.407Z
updated_at: 2026-10-01T03:44:54.102Z
blocked_by:
  - "ea0677"
  - "fc0f00"
  - "fd4fe6"
---

The server side of talking to the ghost: a message goes in, a reply comes back, and the piece's direction changes.

**Scope**
- The piece row gains the current `Direction` (JSON, engine schema; migration). A `chat_messages` table stores both sides of the conversation, so the conductor remembers earlier requests even though the screen shows no history.
- `sendMessage({ pieceId, playingChunk, text })` server function, with input and output schemas in the engine via `.validator()`. `pieceId` and `playingChunk` may be empty before anything has played.
  - Save the message → run the conductor with the playing chunk's snapshot (an empty snapshot when nothing is playing yet), logged through `onModelCall` with role `conductor` → merge the patch into the direction, bumping its version only if it changed → save the reply → return the reply and the direction version.
  - With no piece yet, the call creates the piece row, so a direction typed before the first note shapes the opening.
  - A `pieceId` that doesn't match the current piece (an old tab after a reset) returns no reply and changes nothing.
- Messages for the piece are handled one at a time, in order.
- A failed conductor call returns no reply and is logged; the direction is unchanged.
- `piece:reset` also clears the chat.

**Docs:** design.md → Steering; design.md → Memory; design.md → Piece state & data model.

**Done when:** calling `sendMessage` from the browser console (no test page or route is committed) returns an in-character reply, and the message, reply, direction and conductor call are all in the database.
