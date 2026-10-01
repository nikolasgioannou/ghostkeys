---
id: "a0ef75"
title: Transcribe texture examples from public-domain scores
status: done
priority: none
labels:
  - engine
  - m1
  - prompts
created_at: 2026-10-01T03:09:17.228Z
updated_at: 2026-10-01T04:22:54.810Z
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

## Outcome

- Sources: Mutopia Project editions marked Public Domain, read from their MIDI files with mido 1.3.3 as a one-off (`uv run --with mido`, nothing committed). Chopin's nocturnes on Mutopia are CC-BY-SA, so they weren't used.
- `composer/texture-examples.ts`: three 4-bar examples, each with a texture label (shown to Claude), the grid fragment, and a citation (composer, work, bars, source URL, licence, transcription notes) that never reaches a prompt:
  - nocturne accompaniment: Chopin, Étude Op. 10 No. 9, bars 1–4 (6/8, F minor, wide LH arpeggios, pedal);
  - waltz: Chopin, Waltz Op. 69 No. 2, bars 1–4 after the pickup (3/4, B minor, a tie);
  - inner triplets: Schumann, Kinderszenen Op. 15 No. 1, bars 1–4 (2/4, G major).
- Three rather than five: the public-domain Mutopia sources for a chorale or syncopated inner voice (e.g. Träumerei) have rolled-chord offsets in their MIDI that don't transcribe cleanly. Recorded in design.md.
- Tests: each example parses, breaks no playing rule, has no hard harmony violation (none has a soft one either), keeps the composer's name and opus out of everything Claude sees, and cites a public-domain Mutopia source.
- Size: 110–170 characters per bar with plan lines (about 35–55 tokens by a 3.2 chars/token estimate; real counts come from the smoke test). Recorded in design.md → Grid format.
