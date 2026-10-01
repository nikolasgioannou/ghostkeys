# Ghostkeys — Design

How Ghostkeys works and how it's built. What it is and why lives in [product.md](product.md); the build order lives in [plan.md](plan.md); the research behind these decisions lives in [research/](research/).

```
Browser (TanStack Start client)                     Server (TanStack Start on Bun)
┌──────────────────────────────┐                    ┌───────────────────────────────────┐
│ Scheduler (Web Audio,        │  "next chunk"      │ Composer: plan → grid → check →    │
│ lookahead) + sampled piano   │ ─────────────────▶ │ revise  (Claude Opus 5.5, stream)  │
│ Buffer ≈ 2 chunks            │ ◀── events ─────── │ Parser / checkers                  │
│                              │                    │                                    │
│ Paper roll (canvas)          │  chat message      │ Conductor: fast reply + updates    │
│ Play/pause · chat input      │ ─────────────────▶ │ the piece's direction              │
│                              │ ◀── reply ──────── │                                    │
└──────────────────────────────┘                    │ SQLite (Drizzle): the piece,       │
                                                    │ chunks + state snapshots,          │
                                                    │ direction, chat, model-call log    │
                                                    └───────────────────────────────────┘
```

---

# Part 1 — How it works

## The piece

There is one piece, and it never ends. It's an _endless fantasia_: a bank of named themes (3–5 motifs) that return transformed, a slowly drifting state (key, tempo, mood, texture), a key-area roadmap a few chunks ahead, and a running summary of what has happened so far. Phrases flow into each other with no hard section breaks.

The piece is composed in **chunks** of bars. Each chunk ends with a machine-readable footer (key, last chord, pedal state, summary and theme-bank updates, roadmap) that the next chunk continues from. Claude writes all of it; code only carries it forward. `nextContext(context, complete)` is that hand-off: it folds a finished chunk (the `chunk-complete` payload) into the next chunk's `ComposerContext`, and the bake-off and the app both use it.

## Composition

Two Claude roles:

- **Composer:** one call per chunk. It reads the current direction, the theme bank, the running summary, the roadmap and the last bars verbatim, and produces a per-bar plan, then the notes.
- **Conductor:** one fast call per chat message (see Steering).

The composition pipeline, from the research (pending confirmation by the bake-off):

1. **Plan:** for every bar, the Roman numeral, cadence, motif and its transformation, texture idiom and dynamics.
2. **Notes:** in an explicit **grid format** (absolute pitches, separate right- and left-hand lines, explicit onset slots).
3. **Check:** deterministic code checks every bar.
4. **Revise:** one revise turn fixes whatever the checks flag.

**Claude writes every note** (invariant 1). Code validates and may suggest a draft, but never composes or silently edits notes.

**Checks.** Code checks; Claude fixes (models catch only a fraction of their own errors). Every checker reports violations in one shape (`Violation`: rule, `hard` or `soft`, where — a bar, a holding-pattern bar or the chunk — the hand, and a message written to go straight into the revise prompt). The playing rules (`checkBar` for one bar as it arrives, `checkChunk` for the whole chunk) implement the hard rules in Part 3 → Grid format → Checker rules; `checkHarmony` checks the notes against each bar's planned chord. The Roman-numeral logic is written in-house rather than taken from a theory library such as Tonal, because the grammar is ours (secondary targets, named augmented sixths, the minor-key leading tone).

**Repair policy:** v1 makes no deterministic repairs to notes. Violations go to the revise turn, and a bar still invalid after revising is never played.

**Texture examples.** Short labelled examples raised valid output from 25% to 75% in the closest published system, so the composer is shown three (`TEXTURE_EXAMPLES`), each a 4-bar grid fragment transcribed from a public-domain Mutopia Project edition's MIDI file (notes, onsets, durations and pedal from the file; plan lines are our analysis):

- **Nocturne accompaniment:** a melody over wide left-hand arpeggios, pedalled (6/8, F minor).
- **Waltz:** bass on the downbeat, chords on two and three, a singing melody (3/4, B minor).
- **Inner triplets:** a melody over triplets shared between the hands (2/4, G major).

Claude sees only each example's texture label and grid. The citation (composer, work, bars, source URL, licence) stays in the engine's data and never reaches a prompt (invariant 3). Every example parses, breaks no playing rule and has no hard harmony violation; the tests hold them to that. The planning research suggested a chorale and a syncopated inner voice too, but the Mutopia editions of those textures that are marked public domain didn't transcribe cleanly from MIDI, so the set is three for now.

**Composing a chunk** (`composeChunk`, from `@ghostkeys/engine/llm`). One `streamText` call: the cached system prompt (a 1-hour cache breakpoint), the user message, adaptive thinking with the reasoning hidden, the effort and chunk length given by the caller, `maxOutputTokens` of 32,000 (thinking counts against it), `streamRetries: 0` (a retried stream would re-emit bars), no assistant prefill, and an abort signal. Text deltas go through `parseGridStream`; each item is emitted as it completes, and each bar arrives with what can be checked at once (`checkArrivingBar`: its playing rules, its harmony, and any copy it completes). When the stream ends, the whole chunk is checked (`checkComposedChunk`: playing rules, harmony, copies, and no composer or work names in the footer text, flagged by field so the revise message doesn't repeat the name) and `chunk-complete` carries the items, violations, raw text, token usage (including cache reads and writes) and timings. A finish other than `stop` (`length`, a refusal, an error) is `chunk-failed`, never a normal end. An abort stops it without a final event.

**Revising** (variant C; on by default). If the chunk has any hard violation, or at least `REVISE_SOFT_MIN` (2) soft ones, one revise turn follows before `chunk-complete`. It resends the first reply **unmodified** (its reasoning parts carry signatures; editing them makes the API reject the call) plus a user message listing every violation, bar-level and chunk-level, and asking for only the corrected lines. The reply is parsed in revision mode (no header; plan and bar lines in any order; straight to `HOLD`, `F` or `END` if that's all that changed) and applied: plan and bar lines replace those with the same bar numbers, a `HOLD` block replaces the holding pattern, `F` lines replace the footer, everything else stands. The result is checked again; each replaced bar is reported with `bar-revised`, and whatever still fails stays in `chunk-complete`'s violations for the caller to act on. A revise that doesn't finish leaves the chunk as it was, still flagged. The first call already sets a second, 5-minute cache breakpoint on the chunk's user message, so the revise turn reads the whole prefix from cache. Violation messages spell pitches the way the key does (`spellingFor`: flats in flat keys), so they read the way Claude wrote them.

**The prompt** (`composer/prompt.ts`). The **system prompt** (`COMPOSER_SYSTEM_PROMPT`) is fixed: the role (a pianist-composer improvising one endless Romantic fantasia, a chunk at a time), the musical rules (themes return transformed, slow drift along the roadmap, playable hands, original themes only, composed transitions when steered), "plan first, then write", the grid format as a reference, and the texture examples (label and grid only). It contains nothing per-chunk, so it's cached; with the chunk's message behind the second breakpoint the cached prefix was about 4,200 tokens in the smoke test, and it was read from cache on the next call. The **user message** (`buildComposerMessage(context, { bars })`) is assembled from a `ComposerContext` plus the call's chunk length: what to write next; for a fresh piece, a request that Claude choose the key, meter, tempo, mood and first theme (code never picks musical starting values); then the running summary, the theme bank, the roadmap, the steering note, and the previous chunk's header, last bars and footer state verbatim. Opus 5.5 has no assistant prefill, so the prompt asks for raw grid only, from `CHUNK` to `END`.

**`ComposerContext`** (Zod, in the engine) is the one shape every chunk's input takes: steering note (conductor- or code-written idiom terms, never raw listener text), previous header, previous bars (`P` and `B` lines as written), previous footer state, theme bank (at most 5), roadmap, summary. An empty context is a fresh piece. Chunk length isn't in it; like effort, it's a per-call option.

**Composer-name denylist** (`findDeniedNames`, `assertNoDeniedNames`; invariant 3). Well-known composers (with adjectival forms such as "Chopinesque" and "Lisztian", matched case- and accent-insensitively), the texture examples' cited composers, well-known titles, and opus or catalogue numbers. It runs at runtime: the system prompt is checked when the module loads, and assembling a user message that names one throws `DeniedNameError`, so it's never sent. The conductor and the footer check reuse it.

**Copy check** (`checkCopies`, invariant 3). Every chunk's melody (the highest right-hand note at each onset) and bass line (the lowest left-hand note on each beat; figuration between beats isn't part of the line) are reduced to steps of interval plus time-to-next-note, so transposing doesn't hide a copy. The longest run of steps shared with any example's same voice is a **hard** violation at `COPY_MIN_STEPS` (6 steps, 7 notes, for the melody; 10 for the bass, since bass lines in the same progression and texture are naturally alike) when the run uses at least `COPY_MIN_DISTINCT_INTERVALS` (3) different intervals, so a repeated pedal note or a plain arpeggio isn't a tune. The theme bank is never compared: themes returning is intended. The bake-off tunes the constants.

**From Claude to bars.** Claude's reply streams as text deltas that split lines anywhere. `parseGridStream` buffers partial lines and feeds the grid line parser one complete line at a time, yielding each item (a plan line, a bar, a footer line…) the moment its newline arrives; a final line without a newline is parsed when the stream ends, and an abort stops it at the next delta. It takes plain text, so the parser doesn't depend on the AI SDK.

The grid format itself is specified in Part 3. It's drafted from the research, validated by the bake-off, and the user tweaks it at the end.

Every chunk ends with a short **holding pattern**: 2–4 bars, written by Claude, that loop cleanly on the closing harmony. It's the musical safety net (see Playback).

## Steering

The listener types to the ghost. A fast **conductor** call writes a short in-character reply and updates the piece's **direction**: target key, mood, tempo, texture, and whether to get there immediately or gradually. The composer follows the direction from the next chunk on. The conductor turns references to composers or pieces into idiom and texture terms (invariant 3), and the composer only ever sees the conductor's output, never the listener's raw words.

The change is heard at the **next chunk boundary** (roughly 15–30 s). Music already buffered beyond the chunk that's playing is discarded and composed again under the new direction; nothing is cut mid-chunk.

## Playback

- **The browser pulls.** While playing, when less than about two chunks of music are buffered, the browser asks the server for the next chunk. Close the tab and nothing is generated.
- **A chunk plays only once it's complete** (checked and, if needed, revised). Bars that arrive before that are progress, not music.
- **Timing** (`timeChunk`): parsed bars become timed bars: per bar its duration in seconds, its slot count, whether it ends a phrase, and its notes (MIDI pitch, offset and duration in seconds from the bar's start at its written tempo, velocity, hand, whether it's the melody, its onset slot) and pedal events (up/down; a change is up then down). Offsets are bar-relative, so a player can stretch the tempo or add rubato without recomputing anything; queued bars are never replaced. Tempo marks: `q=NN` sets the tempo from the bar's start, `atempo` returns to the chunk's tempo, `rit` slows the bar linearly to `RIT_END_FACTOR` (0.8) of its tempo by its end (that bar only), `fermata@<slot>` holds for `FERMATA_BEATS` (1) extra beat. A tie becomes one longer note; the continuation isn't struck again. The holding pattern is timed the same way.
- **Dynamics → velocity** (`DYNAMIC_VELOCITY`): `pp` 36, `p` 48, `mp` 60, `mf` 72, `f` 88, `ff` 104. A hairpin moves the velocity by `HAIRPIN_VELOCITY` (12) across its bar, and the next bar starts where it ended; a bar without a dynamic continues the current one.
- **Humanization** (`humanize(bars, seed)`), on top of the timed bars. Deterministic: the seed is the chunk's index, and each bar's randomness comes from it and the bar number, so a replay or resume sounds identical. Every amount is a named constant:
  - metric accents: `ACCENT_DOWNBEAT` (+6) on the downbeat, `ACCENT_BEAT` (+3) on other quarter-note beats;
  - the melody sings: `MELODY_BOOST` (+10) on melody notes, `ACCOMPANIMENT_CUT` (−4) on the rest;
  - onset jitter of up to `JITTER_SEC` (12 ms) either way, never before the bar;
  - rolled chords: in a chord of `ROLL_MIN_NOTES` (3) or more in one hand, each note above the lowest sounds `ROLL_STEP_SEC` (12 ms) later;
  - phrase-end rubato: a bar ending a phrase slows progressively, its local tempo `PHRASE_END_RUBATO` (8%) slower by the end, so the bar lasts about 4% longer;
  - pedal: at a change, the pedal goes back down `PEDAL_LAG_SEC` (40 ms) after it comes up, clearing the old harmony.
- **Safety net** (invariant 4): if the next chunk is late, playback first stretches the tempo slightly (up to about 10%), then loops the current chunk's holding pattern with a gentle fade, and leaves it at a bar boundary the moment the next chunk is ready.
- **Pause** stops playback. Once the buffer is full, generation stops too.

## Memory

The piece survives closing the tab and restarting the server. Every finished chunk is saved with a snapshot of the piece's state after it, so the piece can resume where the listener left off and steering can rewind to a chunk boundary. The conversation with the ghost is kept so the conductor remembers earlier requests, even though the screen shows none of it.

Every call to Claude is logged for **debugging**: role, prompt, response, timing, checker results and raw token counts. Nothing is computed or displayed from it; costs are tracked in OpenRouter.

There's no "new piece" button. A developer script, `bun run piece:reset`, wipes the piece.

## Bake-off

Before the app is built, the composition format and pipeline are chosen by ear.

- **Variants:** (A) interleaved two-voice ABC with thinking, (B) plan + grid, (C) plan + grid + check + revise.
- **Run:** 2 sessions × 4 chunks × 16 bars per variant, with one scripted steering note.
- **Measure:** bar validity, checker violations, steering response, generation time vs playback time (the real-time factor), token usage, and blind listening.
- **Also decided here:** the piano samples (an A/B toggle on the listening page).
- **Listening:** a local page plays the sessions through the same sampled piano the app will use, with the variant labels hidden until the user picks.
- **Budget:** about $5–8.
- **Running it:** `bun run bakeoff [--variant B|C] [--sessions 2] [--chunks 4] [--bars 16] [--effort low] [--mock]` (the `scripts/bakeoff` workspace, `@ghostkeys/bakeoff`). Each session composes its chunks with the engine's `composeChunk` (variant B with revising off, C with it on) and carries continuity with `nextContext`. At chunk 3 the context gets a fixed steering note ("Slowly grow darker and slower over this chunk and the next."), since there's no conductor yet. A chunk that fails is tried once more; a second failure ends the session.
- **Run files** (one per session, in the gitignored `scripts/bakeoff/runs/`, validated by `RunFileSchema`, built from the engine's schemas): per chunk, every composer event, the final items, the raw text of every model call, the violations before and after any revise, usage (thinking vs visible tokens, cache reads), timings (first token, first bar, revise, total), the music's duration (the sum of its timed bars) and the **real-time factor**: generation time including any revise ÷ music duration.
- **Listening:** `bun run bakeoff:listen` serves a local page (Bun bundles it, with the engine, for the browser) at http://localhost:3001 that lists the run files and plays a whole session back to back on the sampled piano, holding patterns skipped. It times and humanizes each chunk exactly as the app will (`timeChunk`, then `humanize` seeded with the chunk's index) and hands notes to the piano through a lookahead loop (half a second ahead, topped up every 50 ms), so Stop really stops; the pedal follows through timers on the audio clock. Every bar that parses plays, with or without violations (the app's never-played rule doesn't apply to a comparison); a bar that doesn't parse is a rest of its length. The AudioContext starts on the first click.
- **Blind comparison:** the page groups the runs by setup (session number and chunk length), shuffles each group's variants under neutral labels ("Take 1", "Take 2", …), and lets the listener rank the takes within each group. A piano toggle plays the same take on either candidate. **Reveal** shows each take's variant and metrics (bars that parsed or converted, violations before → after revising, chunks revised, real-time factor mean and worst, time to first bar, output and thinking tokens, cache reads) and a Markdown summary to paste into the results.
- **Variant A** (`scripts/bakeoff/src/abc.ts`, deleted if it loses): its own prompt (the same `COMPOSER_ROLE` and originality rules, no grid spec, no texture examples) asks for an `ABC` section (one two-voice ABC tune, `[V:RH]` and `[V:LH]` lines covering the same bars, dynamics as decorations), a `HOLD` section (a short ABC tune that loops), the same `F` footer lines (no themes) and `END`. abcjs 6.7.1 (MIT) parses it headlessly and converts each voice's notes into the engine's bar schema: start and duration in whole notes × 48 slots, exactly; a note crossing a barline becomes tied pieces; a bar with a rhythm the grid can't hold exactly (a quintuplet, say) is invalid, never rounded. Each bar gets a placeholder plan line carrying only the ABC's dynamics (its chord is never checked), so the playing rules, copy check and listening page treat A like B and C; there's no harmony check and no plan-based rubato, and the ABC has no pedal. Continuity carries the previous chunk's ABC itself. Extra metric: bars that converted cleanly.
- **`--mock`** swaps in a stand-in model that writes simple, valid, varied chunks (and an empty correction to a revise turn), so the listening page can be built and tested without spending anything.

## Open questions

Answered by the bake-off:

- Composer details: chunk lengths, effort level, grid resolution, revise policy, the texture examples.
- The sampled piano library (smplr's Steinway or Tone.js's Salamander Grand).

---

# Part 2 — Technical decisions

## Stack

| Layer             | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Language          | **TypeScript everywhere**, with end-to-end type safety.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Runtime           | **Bun** (1.4), versions from mise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Web framework     | **TanStack Start** (a release candidate on a Vite plugin; pin exact versions, it ships almost daily). Scripts run as `bun --bun vite …`.                                                                                                                                                                                                                                                                                                                                                                           |
| UI                | **React 19 + Tailwind CSS v4 + Base UI** (`@base-ui/react`). Tailwind is CSS-first (`@theme` tokens, a dark-only palette). Base UI is unstyled; its parts are styled with Tailwind `data-*` variants.                                                                                                                                                                                                                                                                                                              |
| Paper roll        | Canvas 2D.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Audio             | Web Audio API and a sampled grand piano, chosen in the bake-off between smplr 1.1.0 (MIT) `SplendidGrandPiano` (Steinway samples in 4 velocity layers, released into the public domain by Akai; sustain via `setCC(64, …)`, applied immediately) and `@tonejs/piano` 0.2.1 (MIT, on Tone.js 14.9; Salamander Grand Piano V3 samples of a Yamaha C5 by Alexander Holm, CC-BY 3.0, so attribution is required; schedulable `pedalDown`/`pedalUp`; last released in 2022). Both load samples from their public hosts. |
| Client-only audio | The player renders only in the browser. The AudioContext is resumed on a user click (autoplay policy).                                                                                                                                                                                                                                                                                                                                                                                                             |
| Schemas           | **Zod 4** (4.6.5, a dependency of the engine), the single source of truth for every shape that crosses a boundary (invariant 5). Types come from `z.infer`; TanStack Start and the AI SDK accept the schemas directly (Standard Schema).                                                                                                                                                                                                                                                                           |
| Database          | **SQLite + Drizzle ORM** via `drizzle-orm/bun-sqlite`. It only works when Vite runs under `bun --bun` (and drizzle-kit likewise).                                                                                                                                                                                                                                                                                                                                                                                  |
| Claude            | **Vercel AI SDK 7** with **`@ai-sdk/anthropic`**, reaching Claude Opus 5.5 through **OpenRouter** (see Claude access).                                                                                                                                                                                                                                                                                                                                                                                             |
| TypeScript        | **Pinned to 6.0** (6.0.3): npm's `latest` is TypeScript 7 (the Go port), which typescript-eslint doesn't support yet.                                                                                                                                                                                                                                                                                                                                                                                              |

## Repo, tooling & gate

```
ghostkeys/
├── apps/
│   └── web/            TanStack Start app (UI, server functions)
├── packages/
│   ├── engine/         Pure TS, framework-free: grid format, parser, checkers,
│   │                   prompts, composer & conductor, Zod schemas
│   └── db/             Drizzle schema, migrations, bun:sqlite client
├── scripts/            setup.sh (and the bake-off while it exists)
├── docs/               product.md, design.md, plan.md, research/
├── .moth/              Tickets
├── AGENTS.md           Working rules
└── package.json        Bun workspaces root
```

- **Workspaces:** Bun workspaces (`apps/*`, `packages/*`). The engine is consumed as TypeScript source with no build step. No project references; scripts run across workspaces with `bun --filter`.
- **TypeScript:** pinned exactly (6.0.3). `tsconfig.base.json` holds the shared options: target and lib ES2025, no ambient `types` (each package opts into the globals it runs with), bundler resolution with `.ts` imports, `verbatimModuleSyntax`, `noEmit`, and strictness beyond `strict` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`). Each package's `tsconfig.json` extends it and has a `typecheck` script; the root `typecheck` runs them all. The engine adds only the DOM lib (for `fetch` and `AbortSignal`) and no Bun or Node types, because it runs in the browser too.
- **Tool versions:** mise (`mise.toml`) pins Bun (1.4.2), Node (24) and Moth (0.5.0). Node is pinned because tools such as ESLint, Prettier and the editor extensions run with Node shebangs. A fresh clone's `mise.toml` must be trusted (`mise trust`) before mise uses it.
- **Root package:** `private`, ESM, workspaces `apps/*` and `packages/*`. `bun.lock` (text) appears with the first dependency and is committed; installs use `--frozen-lockfile`.
- **Format:** Prettier 3.9 with its default style, configured in `prettier.config.ts`. `prettier-plugin-packagejson` (via `sort-package-json`) keeps every `package.json` in a standard key order, scripts alphabetical. `.prettierignore` skips `.moth/` (Moth writes those files) and `bun.lock`. `bun run format` / `format:check`. The Tailwind plugin joins with Tailwind and must stay last in `plugins`.
- **Lint:** ESLint 10, one root flat config (`eslint.config.ts`, loaded through `jiti` because ESLint's native TypeScript config loading is still experimental). `@eslint/js` recommended, typescript-eslint `strictTypeChecked` and `stylisticTypeChecked` with `projectService`, `simple-import-sort` for imports and exports, and `eslint-config-prettier` last so ESLint never fights Prettier. The web app adds `@eslint-react`, react-hooks, the TanStack Router plugin and `eslint-plugin-better-tailwindcss`. `bun run lint` / `lint:fix`. The root `tsconfig.json` gives root config files Node's types.
- **Tests:** Vitest, run under Bun (see Testing).
- **Live-call scripts** live in their own workspaces under `scripts/` (`scripts/*` is a workspace glob; Vitest treats each as a project and skips plain files there such as `setup.sh`): `scripts/bakeoff` (`@ghostkeys/bakeoff`, until the bake-off is over) and `scripts/smoke` (`@ghostkeys/smoke`) imports the engine through a `workspace:*` dependency, has Bun's types, and loads the root `.env` with `bun --env-file=../../.env`. The gate typechecks and lints it; it never runs in the gate. A root `tsconfig.json` typechecks root-level config files; the root `typecheck` runs it and every workspace's.
- **The gate:** lefthook (an npm dev dependency, pinned) runs on every commit. Pre-commit formats the staged files with Prettier (re-staging what it fixed), then runs `bun run check`: `moth check` → `format:check` → `lint` (no warnings allowed) → `typecheck` → `test`; a build step joins when there's something to build. Hooks source `scripts/lefthook.rc` first, which finds mise and puts its tools on `PATH`, so Git GUIs that don't load a shell profile (VS Code's Source Control) run the same checks. `scripts/setup.sh` installs the hooks. Tickets don't repeat what the gate checks.
- **AGENTS.md:** the working rules for people and coding agents. There is deliberately no `CLAUDE.md`: Claude Code reads AGENTS.md natively, but only when no CLAUDE.md exists ([research/06](research/06-workflow-conventions.md)).
- **Commits:** Conventional Commits on a single line; the subject is the ticket title in lowercase. commitlint (`@commitlint/config-conventional` plus `body-empty` and `footer-empty`, in `commitlint.config.ts`) runs in lefthook's `commit-msg` hook, so bodies and footers, attribution trailers included, are rejected.
- **Tickets:** [Moth](https://github.com/nikolasgioannou/moth), pinned in `mise.toml` and configured by `moth.config.yml` (statuses backlog, todo, in-progress, done, canceled, duplicate). Tickets live flat in `.moth/`. Labels: one milestone (`m0`…), area labels, and `collab` for work done with the user. Done tickets gain an `## Outcome` section. Tickets state outcomes and constraints and point at sections of this document rather than copying details. Every ticket that introduces a tool researches it first.
- **`scripts/setup.sh`:** the one command after cloning. Check, then act, with ✓/→/✗ output; never installs global prerequisites (it fails with instructions); re-running it is a health check. Steps so far: mise present → `mise.toml` trusted → `mise install` → `bun install --frozen-lockfile` → git hooks installed → `.env` created from `.env.example`. Any ticket that adds something contributors must set up extends it.
- **`.vscode/`:** recommended extensions, the workspace TypeScript, format on save, ESLint fixes on explicit save, and the Tailwind entry stylesheet; generated files read-only.
- **Git:** a public GitHub repo, [nikolasgioannou/ghostkeys](https://github.com/nikolasgioannou/ghostkeys), branch `main`, with an MIT licence. Every commit is pushed. No GitHub Actions and no deployment.
- **Secrets:** `.env` is gitignored from the first commit; `.env.example` documents the variables. The user pastes the OpenRouter key in themselves.

## Claude access

- **Client:** `createClaude({ apiKey, sessionId })` from `@ghostkeys/engine/llm` returns an AI SDK model. It's the Vercel AI SDK 7 (`ai` 7.0.126) with `@ai-sdk/anthropic` 4.0.71, both pinned exactly, pointed at OpenRouter's Anthropic-compatible endpoint (`https://openrouter.ai/api/v1/messages`) with the key as a Bearer `authToken`.
- **Fetch shim:** a small `fetch` wrapper rewrites each request body: the model becomes `anthropic/claude-opus-5.5`, `provider` is pinned to `{ only: ["anthropic"], allow_fallbacks: false }`, and `session_id` is set (OpenRouter takes it in the body or an `x-session-id` header; the body wins). The SDK is given the model id `claude-opus-5-5`, because it picks capabilities by id and OpenRouter's slug would match the Opus 5 profile.
- **Caching:** the session id is the piece id, stable across chunks and restarts, so requests stay on one provider and prompt caching sticks. Breakpoints: a 1-hour one on the composer's system prompt, then a 5-minute one on the chunk's user message (the 1-hour breakpoint must come first), so a revise turn reads everything before it from cache.
- **What this gives us:** Anthropic-native prompt caching (`cacheControl`, including the 1-hour TTL), adaptive thinking, `effort`, and native structured outputs (`Output.object` with Zod).
- **A contract test** sends a request through the shim to a fake `fetch` and asserts the URL, Bearer auth, model, provider pin, session id, `max_tokens`, adaptive thinking, `output_config.effort` and `cache_control` on the system block. It guards the shim against SDK updates.
- **Browser-safe:** the LLM code is only reachable through the `@ghostkeys/engine/llm` export, so the engine's main entry bundles for the browser without the AI SDK.
- **Keys and `.env`:** `OPENROUTER_API_KEY` lives in a gitignored `.env` at the repo root (documented in `.env.example`; `scripts/setup.sh` creates `.env` and reminds you to fill it in). The engine never reads the environment; entry points (scripts, the server) read the key and pass it in. Bun auto-loads `.env` only from the working directory, so anything run from inside a workspace loads the root file explicitly (`bun --env-file=../../.env …`).
- **Measured** (smoke test, 2026-10-01, one 4-bar chunk at effort `low`, no revise): first token after 3.4–5.1 s, first bar after 5.6–7.2 s, the whole chunk (4 bars, holding pattern, footer) in 10.7–12.3 s; about 110 visible output tokens per second once streaming; 786–789 output tokens, no reasoning tokens at `low` (adaptive thinking chose not to think). The 4,214-token prefix (system prompt plus the chunk's message) was written to the cache on the first call and read on the second, so caching through OpenRouter works and the prefix clears the minimum. A two-turn exchange at effort `high` produced reasoning, resent it unmodified with its signatures, and the second turn was accepted.
- **What that means for chunk length:** a bar with its plan line costs roughly 120 output tokens (about 2–3× the character-based estimate; digit-heavy grid text tokenizes densely), about 1.1 s at 110 tokens/s. A 3/4 bar at 72 bpm plays for 2.5 s, so streaming alone runs at about 0.45× real time, plus a fixed 3–5 s before the first token. A 16-bar chunk at `low` effort without a revise would take roughly 20–25 s for 40 s of music (a real-time factor of about 0.55), close to the bake-off's 0.6 bar before any thinking or revise turn. The bake-off measures this properly.
- **Gotchas** (from [research/04](research/04-openrouter-and-ai-sdk.md)):
  - A revise turn must resend the prior assistant message unmodified; its reasoning parts carry signatures.
  - Opus 5.5 has no assistant prefill, and forced tool choice returns a 400.
  - Thinking counts against `maxOutputTokens`.
  - `streamRetries` stays at 0: a retried stream would re-emit bars.
  - The fetch shim depends on `@ai-sdk/anthropic` internals, so pin exact versions and keep a contract test on the request shape.
  - Don't trust abort propagation blindly; own the `AbortController` and test it.

## Transport

One **streaming server function per chunk**: a `createServerFn` async generator that the browser reads with `for await`, typed end to end and abortable. Chat goes through ordinary typed server functions. TanStack Start has no WebSocket support, and none is needed.

## Testing

- **Runner:** Vitest 5 (with Vite 8, its peer), one root `vitest.config.ts` whose projects are the workspaces. `bun run test` runs everything once under the Bun runtime (`bun --bun vitest run`); `bun run test:watch` watches. Under Bun, tests can import Bun built-ins such as `bun:sqlite`; under Node they can't.
- **Editor:** the Vitest extension (`vitest.explorer`) runs tests under Node, so tests that need Bun built-ins will only pass from the command line unless the editor is pointed at Bun.
- Tests sit next to the code (`*.test.ts`). The engine's tests are typechecked with the engine and don't bring Node or Bun globals into it.
- Deterministic code (the grid parser, checkers, continuity, timing and humanization, the playback queue, failure handling, the database) gets thorough unit tests.
- Code that calls Claude is tested against the AI SDK's mock models (`ai/test`) with scripted streams, plus a contract test for the OpenRouter request shape. These run offline and cost nothing.
- Musical quality is judged by ear, through the bake-off and listening sessions.
- A `bun run smoke` script makes real calls; it never runs in the gate.

---

# Part 3 — Specifications

**This part is a starting sketch, not a contract.** When implementation finds something that works better, do that and update this doc in the same commit.

## Invariants

These are load-bearing. Changing one means revisiting the design with the user, not just editing code.

1. **Claude chooses every note.** Code validates and may suggest drafts, but never composes or silently edits notes. Any deterministic repair is flagged and logged.
2. **No generation without a connected listener.**
3. **Original themes only.** No composer-imitation prompts; example excerpts are always behind a copy check. Enforced at runtime by the composer-name denylist (prompts that name a composer or work are never sent) and by `checkCopies` on every chunk; example citations never reach a prompt.
4. **The music never stops.** Playback never stalls; if generation falls behind, the fallback is musical, not silence.
5. **One schema source.** Every cross-boundary shape is a Zod schema in the engine; no hand-written duplicate types.
6. **The engine is framework-free.** `packages/engine` never imports React, TanStack or the database. Enforced by lint: the engine can't import UI, framework or database packages, read `process.env`, or use browser globals.

## Grid format

The notation Claude composes in. Every part of the composer pipeline reads it: the schemas, parser, checkers, prompt, texture examples, saved chunks and the paper roll. It's drafted from the research ([01](research/01-llm-music-generation.md), [02](research/02-how-llms-compose-best.md)): explicit onset slots instead of ABC's running durations, a plan before the notes, and one line per bar so code can check each bar the moment it arrives. The bake-off validates it, and the user tweaks it at the end.

### Shape

A chunk is plain text, one item per line, in this order:

1. one `CHUNK` header line;
2. one `P` plan line per bar, for every bar, before any notes;
3. one `B` bar line per bar;
4. a `HOLD` line, then 2–4 `H` holding-pattern bar lines;
5. `F` footer lines;
6. an `END` line.

Every item is complete at the end of its line, so the parser emits each one as soon as its newline arrives, and a missing `END` means the chunk was cut off. Blank lines and Markdown code fences are ignored; any other line that doesn't fit the grammar is a parse error (reported with its line number, never a crash). Tokens are separated by single spaces.

### Header

```
CHUNK meter=3/4 tempo=66 key=Db
```

- `meter`: beats/beat-unit, e.g. `3/4`, `4/4`, `6/8`, `2/2`.
- `tempo`: quarter notes per minute (a quarter is always 12 slots, whatever the meter).
- `key`: a tonic (pitch letter and optional `#`/`b`) plus `m` for minor: `Db`, `Bbm`, `F#m`.

### Time: onset slots

Time inside a bar is counted in **slots, 12 per quarter note**, so 16ths (3 slots), eighth-note triplets (4) and 16th-note triplets (2) are all whole numbers. A bar has `numerator × 48 / denominator` slots: 48 in 4/4, 36 in 3/4 and in 6/8, 24 in 2/4. The resolution is provisional until the bake-off.

### Plan lines

```
P1 key=Db I dyn=p tex=nocturne-arp motif=A
P4 key=Db V7 cad=HC dyn=mp>
```

`P<bar>`, then in any order:

- `key=` the bar's local key (same syntax as the header). Required, so every bar describes where the music is and any bar boundary can be continued from.
- **A Roman numeral** (required), relative to the bar's local key:
  - degree `I`–`VII` (major quality) or `i`–`vii` (minor), optionally prefixed `b` or `#` for chromatic roots (`bVI`, `#iv`);
  - optional quality `o` (diminished), `h` (half-diminished, with 7) or `+` (augmented);
  - optional figures: `6`, `64` (triads), `7`, `65`, `43`, `42` (sevenths), `maj7`;
  - optional secondary target: `/V`, `/ii`, …;
  - or one of the named chords `N6` (Neapolitan), `It6`, `Fr6`, `Ger6` (augmented sixths).
  - Examples: `I`, `vi`, `V7`, `V65/V`, `viio7`, `iih7`, `bVI`, `iv6`, `N6`, `Ger6`.
- `cad=` `PAC`, `IAC`, `HC`, `DC` or `PC` when the bar ends a phrase with that cadence; `end` marks a phrase end without a cadence label.
- `dyn=` `pp`, `p`, `mp`, `mf`, `f` or `ff`, optionally followed by `<` (crescendo through the bar) or `>` (diminuendo). Required on the first plan line of a chunk; a bar without one continues the previous dynamic.
- `tex=` the texture idiom, a short tag such as `nocturne-arp`, `chorale`, `waltz`, `alberti`, `block`, `octaves`, `sync-inner`, `melody-alone`.
- `motif=` a theme from the theme bank and how it's used: `A`, or `A:` plus one of `orig`, `frag`, `seq`, `inv`, `aug`, `dim`, `reharm`, `minor`, `major`.

### Bar lines

```
B1 R: F5@0:24 Eb5@24:6 Db5@30:6 | L: Db2@0:6 Ab2@6:6 F3@12:6 Ab3@18:6 Db4@24:6 Ab3@30:6 | ped: c0
```

`B<bar>`, then sections separated by `|`:

- `R:` the right hand's notes and `L:` the left hand's, both required (an empty hand is written `R: -`).
- A **note** is `pitch@onset:duration`, in slots: `F5@0:24` starts at the downbeat and lasts a half note in 3/4. Pitches use the engine's notation (below). Notes in a hand are listed in onset order.
- A **chord** joins pitches with `+`: `Db5+Gb5+Bb5@0:24`.
- **Ties:** a note ending in `~` continues into the next bar, where the same hand must start the same pitch at slot 0 (`Ab5@24:12~`, then `Ab5@0:12`). A tied note ends exactly at the barline. Otherwise a note must end within its bar: onset + duration ≤ bar length.
- **Rests** are implied by gaps; there are no rest tokens.
- **Melody:** the highest right-hand note at each onset is the melody. Mark a note with a trailing `!` to put the melody somewhere else (an inner or left-hand voice).
- `ped:` (optional) sustain-pedal events: `v<slot>` down, `^<slot>` up, `c<slot>` change (up then straight back down). The pedal state carries from bar to bar until changed.
- `t:` (optional) tempo marks: `rit` (slow through the bar), `atempo` (back to the chunk's tempo at the bar's start), `q=NN` (a new tempo from the bar's start), `fermata@<slot>` (hold at that slot).

### Holding pattern

```
HOLD
H1 R: Gb5@0:12 F5@12:12 Eb5@24:12 | L: Ab1@0:6 Eb2@6:6 C3@12:24 | ped: c0
H2 R: Eb5@0:24 C5@24:12 | L: Ab1@0:6 Eb2@6:6 Gb2@12:24 | ped: c0
```

2–4 bars, written like bar lines with `H<n>`, in the chunk's final meter and key. It's the musical safety net (invariant 4): if the next chunk is late, playback loops it. It must loop cleanly: whole bars; it continues from the chunk's last bar and its last bar leads back into its first; no ties out of its last bar; pedal up by its end or changed at its start.

### Footer

```
F key=Db chord=V7 ped=down
F sum The nocturne opens in Db: theme A sung over wide arpeggios, rising to a half cadence.
F theme A F5@0:24 Eb5@24:6 Db5@30:6
F road Bbm:darker Gb:warmer Db:home
```

- `F key=… chord=… ped=down|up` (required): where the chunk ends (key, last chord as a Roman numeral, pedal state). The next chunk continues from it.
- `F sum <text>` (required): one sentence updating the running summary.
- `F theme <name> <notes>`: adds or replaces a theme in the theme bank. A theme is **literal notes**, one or two bars of right-hand note tokens (`/` between bars), in the chunk's meter and key; Claude transforms it when it returns. `F drop <name>` removes one. The bank holds at most 5 themes.
- `F road <key>:<mood> …`: the next 2–4 key areas and moods (the roadmap). Claude writes it; code never plans the music.

### Revise reply

When checks fail, the revise turn answers with only what it corrects, in the same syntax: the corrected `P` and `B` lines (same bar numbers), the `HOLD` block if the holding pattern was flagged, `F` lines if the footer was flagged, then `END`. Everything not repeated stands.

### Checker rules

**Hard** (always revised):

- parse errors; a bar without a plan line, or bar numbers out of sequence; a missing `HOLD` block, footer `key=` line or `END`;
- an onset outside the bar; a note running past the barline without a tie; a tied note that doesn't end at the barline; a tie with no matching note at slot 0 of the next bar, or out of the chunk's last bar;
- a pitch outside A0–C8;
- more than 5 notes in one hand at one onset; one hand's notes at the same onset spanning more than a major 10th (16 semitones; wide arpeggios across onsets are fine);
- no `dyn=` on the chunk's first plan line;
- a holding pattern that doesn't loop: not 2–4 bars numbered from `H1`, a tie out of its last bar, or the pedal still down at its end without a change at the start of its first bar;
- a missing `F sum` line;
- a copy of a texture example, or a composer or work name in the footer.

**Harmony** (`checkHarmony`): notes on strong slots (every beat: the beat unit, or a dotted quarter in 6/8, 9/8 and 12/8) should be tones of the bar's planned chord in its local key. Weak-slot passing and neighbour tones, chromatic colour and suspensions tied over the barline never count. A bar whose share of off-chord strong notes is above `HARMONY_SOFT_THRESHOLD` (0.34) is **soft**; above `HARMONY_HARD_THRESHOLD` (0.67), clearly the wrong harmony, it's **hard**. The bake-off tunes both.

**Chord vocabulary** (`chordPitchClasses`): roots come from the key's own scale (major, or natural minor), except that a lowercase seventh degree in minor is the raised leading tone (`viio7`) while an uppercase one is the subtonic (`VII`); `b`/`#` move the root a semitone. Uppercase is a major triad, lowercase minor, `o` diminished, `h` half-diminished, `+` augmented. Seventh figures (`7`, `65`, `43`, `42`) add a minor seventh (a diminished seventh after `o`); `maj7` adds a major seventh. A secondary chord (`V7/V`) is figured from its target's root, in major for an uppercase target and minor for a lowercase one. The named chords are relative to the tonic: `N6` (♭2, 4, ♭6), `It6` (♭6, 1, ♯4), `Fr6` (♭6, 1, 2, ♯4), `Ger6` (♭6, 1, ♭3, ♯4).

### Token budget

Generation has to keep ahead of playback, so the syntax is short: no rest tokens, durations in slots, one line per bar. Measured on a real chunk, a bar with its plan line costs about 120 output tokens (the texture examples run 110–170 characters per bar; grid text tokenizes densely, at roughly 1 token per 1–1.5 characters). At 2.5–3.5 s of music per bar that's about 2–3k visible tokens per minute of music, above the research's 1–2k estimate for a compact format, before thinking and revise. Generation still runs faster than playback (see Claude access → Measured), but with less margin than hoped; the bake-off weighs this.

### Pitches

Scientific pitch notation: an uppercase letter A–G, an optional single `#` or `b`, and an octave 0–8, ASCII only. C4 is middle C (MIDI 60). Accidentals may cross octave lines (`Cb4` is B3). The piano's range is A0–C8 (MIDI 21–108). Engine: `pitchToMidi`, `midiToPitch`, `isOnPiano`.

### Worked example

Four bars in 3/4, D-flat major, with a chord, a triplet, a tie, pedal, a ritardando, the holding pattern and the footer. It's the parser's first test fixture.

```
CHUNK meter=3/4 tempo=66 key=Db
P1 key=Db I dyn=p tex=nocturne-arp motif=A
P2 key=Db vi tex=nocturne-arp motif=A:seq
P3 key=Db IV dyn=mp< tex=nocturne-arp
P4 key=Db V7 cad=HC dyn=mp> tex=nocturne-arp
B1 R: F5@0:24 Eb5@24:6 Db5@30:6 | L: Db2@0:6 Ab2@6:6 F3@12:6 Ab3@18:6 Db4@24:6 Ab3@30:6 | ped: c0
B2 R: Db5@0:12 C5@12:4 Db5@16:4 Eb5@20:4 F5@24:12 | L: Bb1@0:6 F2@6:6 Db3@12:6 F3@18:6 Bb3@24:12 | ped: c0
B3 R: Db5+Gb5+Bb5@0:24 Ab5@24:12~ | L: Gb1@0:6 Db2@6:6 Bb2@12:6 Db3@18:6 Gb3@24:12 | ped: c0
B4 R: Ab5@0:12 Gb5@12:12 Eb5@24:12 | L: Ab1@0:6 Eb2@6:6 C3@12:6 Gb3@18:6 Ab3@24:12 | ped: c0 | t: rit
HOLD
H1 R: Gb5@0:12 F5@12:12 Eb5@24:12 | L: Ab1@0:6 Eb2@6:6 C3@12:24 | ped: c0
H2 R: Eb5@0:24 C5@24:12 | L: Ab1@0:6 Eb2@6:6 Gb2@12:24 | ped: c0
F key=Db chord=V7 ped=down
F sum The nocturne opens in Db: theme A sung over wide arpeggios, rising to a half cadence.
F theme A F5@0:24 Eb5@24:6 Db5@30:6
F road Bbm:darker Gb:warmer Db:home
END
```

## Piece state & data model

**`ComposerContext`** (`composer/context.ts`) is what the composer is told about where the piece is. Everything musical in it was written by Claude and is kept as written:

| Field            | What it holds                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `steeringNote`   | where to head, in idiom, texture and mood terms (code or the conductor writes it; never the listener's words)       |
| `previousHeader` | the last chunk's `CHUNK` line; `null` for a fresh piece                                                             |
| `previousBars`   | the last chunk's last `CONTEXT_BARS` (4) bars: their `P` lines, then their `B` lines, as written (after any revise) |
| `previousFooter` | the last chunk's `F key=… chord=… ped=…` line                                                                       |
| `themes`         | the theme bank: name plus the theme's notes as written, at most `MAX_THEMES` (5)                                    |
| `roadmap`        | the latest `F road` line                                                                                            |
| `summary`        | the running summary, the last `SUMMARY_SENTENCES` (6) sentences                                                     |

`EMPTY_CONTEXT` is a fresh piece.

**The fold** (`nextContext`): the header, last bars and footer state are replaced by the new chunk's; the summary gains the chunk's `F sum` sentence and keeps only its most recent sentences; `F theme` adds or replaces a theme (moving it to the newest), `F drop` removes one, and when the bank is over its cap the oldest themes go; `F road` replaces the roadmap, and a chunk without one keeps the old roadmap; the steering note carries over unchanged. However long the piece runs, the context stays bounded.

## Stream events

What flows out of the composer, starting with what the grid parser emits. Schemas live in the engine (`GridItemSchema` in `grid/schema.ts`); later tickets add the composer's own events and the transport's.

**Parser items.** The line parser (`createGridLineParser`) is an incremental state machine fed one complete line at a time; each line yields at most one item, as soon as the line is complete. Every item carries its `line` number and its `source` line exactly as Claude wrote it, so previous bars are carried forward as Claude's own text, never re-serialised.

| Item                                                                           | From                                  | Carries                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header`                                                                       | `CHUNK`                               | meter, tempo, key                                                                                                                                                           |
| `plan`                                                                         | `P<n>`                                | bar, local key, chord (parsed Roman numeral), cadence, phrase end, dynamic, texture, motif use                                                                              |
| `bar`                                                                          | `B<n>`                                | bar, body (right- and left-hand notes as MIDI numbers, pedal events, tempo marks) or, for a line that didn't parse, `body: null` plus the error, so it can still be revised |
| `hold-start` / `hold-bar`                                                      | `HOLD` / `H<n>`                       | as `bar`                                                                                                                                                                    |
| `footer-state`, `footer-summary`, `footer-theme`, `footer-drop`, `footer-road` | `F` lines                             | key, chord and pedal; summary text; a theme's notes per bar; a dropped theme; the roadmap stops                                                                             |
| `end`                                                                          | `END`                                 | the chunk is complete                                                                                                                                                       |
| `parse-error`                                                                  | anything else, or a line out of order | the reason                                                                                                                                                                  |

Blank lines and code fences yield nothing. A chord becomes one note per pitch at the same onset. Lines out of block order (a plan line after the bars, text after `END`) are parse errors; a missing `HOLD`, footer or `END` is left to the chunk-level checks.

**Composer events** (`ComposerEventSchema`):

| Event            | Carries                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| `item`           | one parser item as soon as its line completes; bars carry the per-bar violations |
| `chunk-complete` | every item, every violation, the raw text, usage, timings                        |
| `chunk-failed`   | why (`length`, `refusal`, `error`, `other`), the text so far, usage, timings     |

**Playability rule:** a chunk is playable only after `chunk-complete`. `item` events before it are progress, not music; later tickets rely on this.

---

## Decision log

| Decision                                                                                                      | Why                                                                                                                                                              | Source                                                                                |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Claude writes symbolic notes; a sampled piano plays them                                                      | Controllable, checkable and cheap compared with audio-domain generation                                                                                          | [01](research/01-llm-music-generation.md)                                             |
| An explicit-timing grid format rather than ABC (pending the bake-off)                                         | ABC's running durations cascade rhythm errors, and models misread its digits                                                                                     | [01](research/01-llm-music-generation.md), [02](research/02-how-llms-compose-best.md) |
| Plan → grid → check → revise                                                                                  | The revise loop took full-piece validity from 62% to 94% in the closest published system; code catches errors that models miss                                   | [02](research/02-how-llms-compose-best.md)                                            |
| Short labelled texture examples, behind a copy check                                                          | Examples took validity from 25% to 75%, but models copy what they're shown                                                                                       | [02](research/02-how-llms-compose-best.md)                                            |
| The browser pulls one streaming server function per chunk                                                     | Generation stops when the tab closes; it's typed end to end; it survives hot reload                                                                              | [03](research/03-tanstack-start-on-bun.md)                                            |
| TanStack Start on Bun                                                                                         | The user's choice; streaming server functions fit the pull model                                                                                                 | [03](research/03-tanstack-start-on-bun.md)                                            |
| AI SDK + `@ai-sdk/anthropic` through OpenRouter's Anthropic-compatible endpoint                               | The user's OpenRouter key; OpenRouter's own provider has open bugs in reasoning, multi-turn signatures and caching                                               | [04](research/04-openrouter-and-ai-sdk.md)                                            |
| ESLint + Prettier, Tailwind v4, Base UI, TypeScript pinned to 6.0                                             | The user's choices; TypeScript 7 isn't supported by typescript-eslint yet                                                                                        | [05](research/05-ui-lint-workspaces.md)                                               |
| Moth, AGENTS.md (no CLAUDE.md), lefthook, commitlint, setup.sh                                                | The user's workflow; Claude Code reads AGENTS.md only when there's no CLAUDE.md                                                                                  | [06](research/06-workflow-conventions.md)                                             |
| One piece forever, play/pause and chat only, no cost tracking                                                 | The user model: one thing is playing, and you can steer it                                                                                                       | [product.md](product.md)                                                              |
| A chunk plays only once it's complete; steering takes effect at the next chunk boundary; a snapshot per chunk | Decided while filing the tickets: revised bars never touch scheduled audio, a failed chunk is simply composed again, and steering can rewind to a chunk boundary | [plan.md](plan.md)                                                                    |

## Risks

- **Generation might not keep ahead of playback.** The grid format, thinking and the revise turn all cost output tokens. The bake-off measures the real-time factor and stops if no variant keeps up.
- **TanStack Start is a release candidate** that ships almost daily, and APIs get renamed. Pin exact versions.
- **Forgetting `--bun`** makes `bun:sqlite` fail under Vite.
- **Editor test runs use Node:** the Vitest extension can't run tests that import Bun built-ins (the database package's).
- **Abort propagation** from browser to server function has changed between TanStack releases.
- **Silent streams:** with thinking hidden, a stream can be silent for tens of seconds, and Bun's server closes idle connections after 10 s by default.
- **The OpenRouter fetch shim** depends on `@ai-sdk/anthropic` internals.
- **Prompt caching** through OpenRouter depends on sticky routing to one provider (confirmed working in the smoke test: the whole 4.2k-token prefix was read from cache on the second call).
- **Generation throughput** is closer to real time than hoped: about 120 output tokens per bar at 110 tokens/s. Thinking and revise turns add to it, so chunk length, effort and revise policy have to be chosen against the real-time factor in the bake-off.
- **The name** collides with EleutherAI Aria's "The Ghost in the Keys" demo.
