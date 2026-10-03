---
id: "632bdc"
title: Splice the piece at a phrase
status: todo
priority: none
labels:
  - engine
  - m6
created_at: 2026-10-03T18:06:16.909Z
updated_at: 2026-10-03T18:06:29.896Z
blocked_by:
  - "20a6d2"
---


Steering is heard at the next phrase rather than the next chunk boundary (design.md → Steering), so the piece has to be able to continue from a phrase end in the middle of a chunk. This ticket is the engine side, framework-free (invariant 6). The app wires it up in the steering-latency ticket.

**Scope**
- Find a chunk's splice points: the bars whose plan line ends a phrase (a cadence or `end`), plus its last bar.
- Build the context for a turn that continues from bar k of a completed chunk, as `nextContext` does for a whole chunk. The bars after k are discarded.
  - The previous header and last bars come from bars up to k.
  - The footer state (key, last chord, pedal) comes from bar k's plan line and the pedal as it stands at k's end.
  - The summary, roadmap and theme bank don't take the cut chunk's footer, which describes music that will never play. Themes it introduced in bars up to k may be kept; decide and document it.
- Nothing here picks musical values: Claude writes the turn from that context (invariant 1).

**Tests:** splice points for the worked example and a chunk with no cadences; the context after splicing at a phrase end and at the last bar (the latter matches `nextContext`); the pedal and a tie into the cut bars are handled; schema-valid output.

**Docs:** design.md → Composition (continuity from a splice); design.md → Steering.

**Done when:** the engine can continue a piece from any phrase end of a completed chunk, with tests.
