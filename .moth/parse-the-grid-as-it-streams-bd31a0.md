---
id: "bd31a0"
title: Parse the grid as it streams
status: done
priority: none
labels:
  - engine
  - m1
created_at: 2026-10-01T03:09:16.900Z
updated_at: 2026-10-01T04:14:34.560Z
blocked_by:
  - "6b98de"
---

Claude's output arrives as text deltas that split lines at arbitrary points. Wrap the line parser so it consumes the stream directly.

**Scope**
- A function from `AsyncIterable<string>` (text deltas) to an async iterable of the parser's items, built on the existing state machine (no second parser).
- Buffers partial lines across deltas; emits each item as soon as its last line completes; flushes a trailing partial line when the stream ends; stops cleanly when the input is aborted.
- The engine stays independent of the AI SDK here: it takes plain text deltas.
- Tests: the worked example split into every possible pair of deltas gives the same items as parsing it whole; one-character deltas; a stream ending mid-line; an aborted stream.

**Docs:** design.md → Composition (how output flows from Claude into parsed bars).

**Done when:** every split of the worked example yields identical items, and abort stops iteration without leaking an unfinished promise.

## Outcome

- `grid/stream-parser.ts`: `parseGridStream(deltas, signal?)`, an async generator over the existing line parser (no second parser). Buffers partial lines, yields each item as its line completes, flushes a trailing line at the end, and stops (closing the input iterator) when the signal aborts.
- Tests: every two-delta split of the worked example and one-character deltas give the same items as parsing it whole; a final line without a newline; items arrive before the next delta is read; abort stops iteration and closes the input.
- design.md → Composition describes how output flows from Claude into parsed items.
