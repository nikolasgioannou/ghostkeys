---
id: "a0ef75"
title: Transcribe texture examples from public-domain scores
status: todo
priority: none
labels:
  - engine
  - m1
  - prompts
created_at: 2026-10-01T03:09:17.228Z
updated_at: 2026-10-01T03:29:19.968Z
blocked_by:
  - "bd11d8"
---

Short labelled examples raised valid output from 25% to 75% in the closest published system (docs/research/02). Give the composer three to five of them.

**Scope**
- 4–8 bar excerpts, one per Romantic piano texture: nocturne wide left-hand arpeggio, chorale, waltz, syncopated inner voice (choose the best set of 3–5).
- Transcribe from machine-readable editions marked public domain (e.g. Mutopia Project files), never from memory. Record the source URL and licence for each. If a tool or library is used to read the source files (a MIDI, MusicXML or LilyPond reader), research it first, run it as a one-off (`bunx` or `uvx`) unless committed code needs it, and note it next to the citations.
- Each excerpt is a complete grid fragment: header, plan lines and bars, following design.md → Grid format.
- Store them as engine data. Each example carries a **texture label** (shown to Claude) and a separate **citation** (composer, work, source; never sent to Claude, because invariant 3 means no composer names in prompts).
- Tests: every example parses and has no `hard` violations in either checker.
- Report tokens per bar for the examples in design.md → Grid format: the first real measurement of the format's token cost.

**Docs:** design.md → Composition (the example set and why); design.md → Grid format (tokens per bar).

**Done when:** all examples parse and check cleanly, every citation has a source URL and licence, and no citation text appears in the example text.
