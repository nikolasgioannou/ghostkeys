---
id: "ea22a7"
title: Revise bars that fail the checks
status: done
priority: none
labels:
  - engine
  - llm
  - m1
created_at: 2026-10-01T03:10:01.049Z
updated_at: 2026-10-01T04:36:04.895Z
blocked_by:
  - "417e23"
---

The composer's second half, and the research's strongest quality lever: revise loops took full-piece validity from 62% to 94% in the closest published system (docs/research/02). It's bake-off variant C.

**Scope**
- After the stream, if any `hard` violation exists (or `soft` ones above their threshold), make one revise turn before `chunk-complete`. The turn resends the prior assistant message **unmodified** (its reasoning parts carry signatures; editing them makes the API reject the call) plus a user message listing the violations, bar-level and chunk-level alike. The resent assistant message is exempt from the composer-name denylist (it must stay byte-identical); the revise user message is checked like any other.
- Parse the reply in the revise format from design.md → Grid format: corrected bars keyed by bar number, plus a corrected holding pattern or footer when those were flagged. Every replacement is re-checked and keeps the reply's source lines. `chunk-complete` carries the final bars, holding pattern and footer, with a `bar-revised` event for each replaced bar.
- A second cache breakpoint (5-minute) on the chunk's user message, so the revise turn reads the whole prefix from cache. The 1-hour system breakpoint stays first.
- Anything still failing after one revise (a bar, the holding pattern or the footer) is marked invalid in `chunk-complete`; the caller decides what to do with the chunk.
- Revising can be turned off (variant B in the bake-off).
- Tests with the mock model: a clean chunk makes no second call; a bad bar triggers exactly one revise whose messages include the first assistant message byte for byte; revised bars replace the right ones; a chunk whose only violation is its holding pattern gets a revised holding pattern; a footer naming a composer gets one revise and the corrected footer passes; abort during the revise stops it.

**Docs:** design.md → Composition (revise policy); design.md → Stream events (`bar-revised`); design.md → Claude access (cache breakpoint layout).

**Done when:** the mock tests pass, including the byte-for-byte check of the resent assistant message.

## Outcome

- `composeChunk` now revises (option `revise`, default true): if any hard violation or ≥ `REVISE_SOFT_MIN` (2) soft ones, one turn resending the first reply unmodified (via `responseMessages`) plus `buildReviseMessage(violations)`; the reply is parsed in the parser's new revision mode and merged by `applyRevision` (plans/bars by number, the HOLD block, the footer); re-checked; `bar-revised` per replaced bar; `chunk-complete` gains `revised`, `reviseText`, summed usage and `reviseMs`. A revise that doesn't finish leaves the chunk flagged.
- Second, 5-minute cache breakpoint on the chunk's user message (the 1-hour system breakpoint stays first).
- The line parser's `revision` option: no header needed, plan and bar lines in any order, straight to HOLD/F/END.
- Found while testing: violation messages spelled pitches with sharps ("C#5" for a written "Db5"). Added `spellingFor(key)` (flats in flat keys) and threaded it through the playing-rules and harmony messages.
- Tests (mock model): clean chunk → one call; bad bar → exactly one revise whose prompt has the same system and user messages and the first reply byte for byte, then the violations; only the corrected bar replaced, reported with `bar-revised`; a non-looping holding pattern revised; a composer name in the footer revised without the name in the revise message; an unfinished revise leaves violations; revise off → one call; abort during the revise; `needsRevise` thresholds; `applyRevision` keeps the rest and replaces plan lines; `spellingFor`.
- design.md → Composition (revising), Stream events (`bar-revised`, `chunk-complete`), Claude access (breakpoint layout).
