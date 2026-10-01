---
id: "ea0677"
title: Log every model call
status: todo
priority: none
labels:
  - db
  - engine
  - m5
created_at: 2026-10-01T03:12:28.101Z
updated_at: 2026-10-01T03:31:03.921Z
blocked_by:
  - "d73fae"
---

A debugging record that answers "why did that passage sound wrong?". It's for reading in the database: nothing is displayed or computed from it, and costs are tracked in OpenRouter, not here.

**Scope**
- An `onModelCall(record)` option on the composer (the conductor will use it too). The record schema lives in the engine.
- A `model_calls` table: role (`composer`, `revise`; the conductor ticket adds `conductor`), piece id and chunk index, the request (instructions and messages), the response text, timings, finish reason, checker results, raw token counts (including cache reads and writes), and any error. No Claude role uses tools today; if one ever does, its tool calls are logged too (add the column then).
- The server persists every call, including failed and retried ones.
- Kept when the piece is reset.

**Docs:** design.md → Memory (the log and what it's for); design.md → Piece state & data model.

**Done when:** after a few chunks, every composer and revise call is in the table with its prompt, response, checker results and timings, and a failed call is logged with its error.
