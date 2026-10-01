---
id: "ea22a7"
title: Revise bars that fail the checks
status: todo
priority: none
labels:
  - engine
  - llm
  - m1
created_at: 2026-10-01T03:10:01.049Z
updated_at: 2026-10-01T03:44:53.971Z
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
