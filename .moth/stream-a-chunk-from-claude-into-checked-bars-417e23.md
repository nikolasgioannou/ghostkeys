---
id: "417e23"
title: Stream a chunk from Claude into checked bars
status: todo
priority: none
labels:
  - engine
  - llm
  - m1
created_at: 2026-10-01T03:10:00.930Z
updated_at: 2026-10-01T03:44:53.871Z
blocked_by:
  - "a017f1"
  - "bd31a0"
  - "d1e3f6"
  - "f59a19"
---

The composer's first half: one call turns a `ComposerContext` into a stream of parsed, checked bars. It's bake-off variant B (plan + grid, no revise).

**Scope**
- `streamText` with the composer prompt; text deltas → the streaming parser → items. Each bar is run through both checkers and the copy check as it parses, and its violations are attached to the bar event.
- When the stream ends: chunk-level checks (holding pattern loops, footer present, and the footer's summary, roadmap and motif names pass the composer-name denylist), then a `chunk-complete` event carrying the final bars, holding pattern, footer, usage (including cache reads and writes) and timings (time to first token, time to first bar, total). A denylist hit is a `hard` violation for the revise turn, since code never rewrites Claude's text; its message names the field, not the matched name (e.g. "the footer summary names a composer; restate it in idiom and texture terms"), so the revise message itself passes the denylist.
- **Playability rule, recorded in design.md → Stream events:** a chunk is playable only after `chunk-complete`. Bar events before that are progress, not music. Later tickets rely on this.
- Chunk length and effort are options of each call, not `ComposerContext` fields. The caller decides them (the server will choose opening, post-steer or steady lengths).
- `maxOutputTokens` well above the visible output (thinking counts against it). `finishReason: 'length'` is a failed chunk, not a normal end. `streamRetries: 0` (a retried stream would re-emit bars). No assistant prefill. An `AbortSignal` stops the call.
- The system prompt carries a 1-hour cache breakpoint.
- Every emitted bar is exactly what the model wrote: code never edits notes (invariant 1).
- Tests with the AI SDK mock model: a valid chunk; a chunk with a bad bar (violation attached, still no edits); a footer naming a composer (hard violation, message without the name); a length-truncated chunk; abort mid-stream.

**Docs:** design.md → Composition; design.md → Stream events (bar and chunk-complete events, the playability rule).

**Done when:** the mock tests pass and a test proves every bar event equals the parse of the model's text.
