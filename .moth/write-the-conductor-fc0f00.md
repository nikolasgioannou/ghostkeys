---
id: "fc0f00"
title: Write the conductor
status: todo
priority: none
labels:
  - engine
  - llm
  - m6
  - prompts
created_at: 2026-10-01T03:13:14.296Z
updated_at: 2026-10-01T03:31:40.907Z
blocked_by:
  - "20a6d2"
  - "ea0677"
---

The conductor turns what the listener types into a one-line reply and a change of direction. It's a fast call separate from the composer, so replies come in seconds (design.md → Steering).

**Scope**
- `Direction`, an engine Zod schema holding only what the conductor set: optional targets (key, mood, tempo, texture), a steering note in idiom, texture and mood terms, a transition (`immediate`, or `gradual` over N chunks), and a version. Progress towards it is tracked elsewhere (in each chunk's snapshot, by the steering ticket).
- The conductor call: `generateText` with `Output.object`, low effort, sensible `maxOutputTokens`, through the existing Claude client. It takes the same `onModelCall` option as the composer and reports each call with role `conductor` (add it to the record schema's role enum). Inputs: the current direction, where the piece is (key, mood, summary, roadmap from the snapshot of the chunk currently playing, supplied by the caller), and the recent chat.
- Output: `reply` (one short line, in character as the ghost at the piano) and a direction **patch**, merged into the current direction by a pure function. "Slow down" changes tempo and keeps the mood. A message that isn't a request ("who are you?") gets a reply and an empty patch. Wording like "slowly…" means gradual.
- Invariant 3: references to composers or pieces ("play it like Chopin") become idiom and texture terms. The output goes through the composer-name denylist, and a name in the output is rejected.
- Tests with the mock model: an immediate request, a gradual one, a non-request, a composer reference producing no names (including a composer not among the example citations, e.g. "like Rachmaninoff"), and the merge function.

**Docs:** design.md → Steering (the conductor, direction and merge rules); design.md → Piece state & data model (`Direction`).

**Done when:** the mock tests pass for every message kind above.
