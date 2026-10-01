---
id: "6b98de"
title: Define the grid schemas and parse a chunk
status: done
priority: none
labels:
  - engine
  - m1
created_at: 2026-10-01T03:09:16.794Z
updated_at: 2026-10-01T04:13:40.228Z
blocked_by:
  - "ee395f"
---

Turn grid text into typed, validated objects.

**Research first:** Zod 4 — schema definition, `z.infer`, discriminated unions, error formatting, and Standard Schema support (TanStack Start and the AI SDK both accept it). Zod is the single schema source (invariant 5).

**Scope**
- Zod schemas, with inferred types, for everything in design.md → Grid format: header, bar plan, note, bar, holding pattern, footer, chunk. Parsed notes hold MIDI numbers. Schemas are structural (integer slots inside the bar, known marks); musical rules such as the piano range belong to the checker.
- A line parser built as an **incremental state machine**: feed it one complete line at a time; it yields typed items (header, plan, bar, holding pattern, footer) as each completes, and a `parse-error` item (line number, raw text, reason) for a bad line, then carries on. Fence and blank lines are ignored. A bar with a bad line is still emitted, marked invalid, so it can be revised. The streaming ticket wraps this machine; it must not need rewriting.
- Every item keeps its source lines exactly as Claude wrote them. Later code carries previous bars forward as that text, so nothing ever re-serialises Claude's notes.
- The parser's items are a Zod discriminated union. They're the start of the stream events that later reach the browser.
- Tests: design.md's worked example parses exactly; plus malformed lines, a missing hand, a bad pitch, ties, and a chunk missing its footer.

**Docs:** design.md → Stack (Zod 4 as the schema source); design.md → Stream events (new Part 3 section, started with the parser's items).

**Done when:** the worked example round-trips into the expected objects (source lines included), and every malformed case produces a located `parse-error` instead of throwing.

## Outcome

- Zod 4.6.5 added to the engine. `grid/schema.ts`: schemas for keys, meters, Roman numerals (degree or named), dynamics, motif use, notes, pedal events, tempo marks, bar bodies, and `GridItemSchema`, the discriminated union of everything the parser emits; types via `z.infer`.
- `grid/line-parser.ts`: `createGridLineParser()`, a state machine over complete lines enforcing block order; one item per line with its line number and exact source; bad lines become `parse-error` items, and a bar that doesn't parse is still emitted with `body: null` and the error. Chords expand to one note per pitch.
- `worked-example.fixture.ts` holds design.md's worked example character for character.
- 40 new tests: the worked example (block order, schema round-trip, source lines, header, plan, notes/chords/triplets/ties/pedal/tempo, footer) and malformed input (unknown lines, order violations, bad meter/key/Roman numeral/pitch, missing hand, notes out of order, zero-length notes, unknown sections, recovery after a bad line), plus Roman numeral parsing.
- design.md: Stack row (Zod); new Part 3 → Stream events section documenting the parser items.
