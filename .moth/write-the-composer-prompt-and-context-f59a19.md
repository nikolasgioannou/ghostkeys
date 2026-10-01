---
id: "f59a19"
title: Write the composer prompt and context
status: done
priority: none
labels:
  - engine
  - m1
  - prompts
created_at: 2026-10-01T03:10:00.812Z
updated_at: 2026-10-01T04:28:54.882Z
blocked_by:
  - "a0ef75"
---

Define what the composer is told, and the one shape every chunk's input takes.

**Scope**
- `ComposerContext`, a Zod schema in the engine: steering note (idiom, texture and mood terms written by code or the conductor, never raw listener text), previous bars as grid text (last N), previous footer, theme bank, roadmap, running summary. The bake-off and the app both build on this shape. Chunk length is not part of it: like effort, it's an option of each call.
- The **system prompt**: role (a pianist-composer improvising one endless Romantic piano fantasia), the grid format spec, the texture examples as full grid fragments each introduced only by its texture label (never its citation), and the rules: original themes and no composer or work names; plan first, then notes; write the holding pattern; follow the roadmap and let the music drift slowly when there's no steering; output raw grid only, with no fences or preamble, since Opus 5.5 has no prefill. It's deterministic and contains nothing per-chunk, so it caches. Record its token count against the minimum cacheable length.
- The **user message**, assembled from a `ComposerContext` plus the call's chunk length. With an empty context (a fresh piece) it asks Claude to choose the opening key, tempo, mood and first themes; code never picks musical starting values.
- **The composer-name denylist** (invariant 3): the citations' composer and work names plus a named list of well-known composers and their adjectival forms (e.g. "Chopinesque", "Lisztian"), matched case- and accent-insensitively, kept as engine data. It runs **at runtime** on the system prompt and on the user message assembled from `ComposerContext`; a hit refuses to send. The conductor, the footer check and the revise turn reuse it.
- Tests: assembly from a full and an empty context; the system prompt is byte-identical across contexts; a steering note naming a composer (cited or not, or in adjectival form) is refused.

**Docs:** design.md → Composition (prompt structure, context fields, what's cached); design.md → Invariants (how the denylist enforces invariant 3).

**Done when:** the tests pass and the system prompt is stable across calls.

## Outcome

- `composer/context.ts`: `ComposerContextSchema` (steering note, previous header, previous bars as written, previous footer state, themes ≤5, roadmap, summary) and `EMPTY_CONTEXT`. Chunk length stays a per-call option.
- `composer/prompt.ts`: `COMPOSER_SYSTEM_PROMPT` (role, musical rules, plan-first, the grid format as a reference, texture examples by label and grid only, raw-grid-only output) and `buildComposerMessage(context, { bars })`. A fresh piece asks Claude to choose key, meter, tempo, mood and first theme.
- `composer/denylist.ts`: well-known composers plus adjectival forms, cited composers, titles, opus/catalogue numbers; accent- and case-insensitive. Runs at runtime on the system prompt (at module load) and on every assembled message (throws `DeniedNameError`).
- System prompt: 8,200 characters, about 2,300 tokens by a character estimate, likely below Opus's minimum cacheable length on its own. Recorded as a risk; the smoke test measures it and the revise ticket's second breakpoint (on the user message) lengthens the cached prefix.
- 31 tests: denylist hits (names, adjectives, accents, titles, opus/BWV) and non-hits (ordinary steering, "unravel", grid text), every cited composer caught; system prompt contents, no names, raw-output rule, no per-chunk content; message assembly for empty and full contexts, omitted sections, and refusals for cited, uncited and adjectival composer names, opus numbers and a summary naming a composer.
- design.md → Composition (prompt, context, denylist), Invariants, Risks.
