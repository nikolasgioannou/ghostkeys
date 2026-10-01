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

The piece is composed in **chunks** of bars. Each chunk ends with a machine-readable footer (key, last chord, pedal state, summary and theme-bank updates, roadmap) that the next chunk continues from. Claude writes all of it; code only carries it forward.

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

The grid format itself is specified in Part 3. It's drafted from the research, validated by the bake-off, and the user tweaks it at the end.

Every chunk ends with a short **holding pattern**: 2–4 bars, written by Claude, that loop cleanly on the closing harmony. It's the musical safety net (see Playback).

## Steering

The listener types to the ghost. A fast **conductor** call writes a short in-character reply and updates the piece's **direction**: target key, mood, tempo, texture, and whether to get there immediately or gradually. The composer follows the direction from the next chunk on. The conductor turns references to composers or pieces into idiom and texture terms (invariant 3), and the composer only ever sees the conductor's output, never the listener's raw words.

The change is heard at the **next chunk boundary** (roughly 15–30 s). Music already buffered beyond the chunk that's playing is discarded and composed again under the new direction; nothing is cut mid-chunk.

## Playback

- **The browser pulls.** While playing, when less than about two chunks of music are buffered, the browser asks the server for the next chunk. Close the tab and nothing is generated.
- **A chunk plays only once it's complete** (checked and, if needed, revised). Bars that arrive before that are progress, not music.
- **Realism:** velocity from dynamics, metric accents and melody weighting; small onset jitter; rolled chords; phrase-end rubato; sustain pedal.
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

## Open questions

Answered by the bake-off:

- Composer details: chunk lengths, effort level, grid resolution, revise policy, the texture examples.
- The sampled piano library (smplr's Steinway or Tone.js's Salamander Grand).

---

# Part 2 — Technical decisions

## Stack

| Layer             | Decision                                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language          | **TypeScript everywhere**, with end-to-end type safety.                                                                                                                                               |
| Runtime           | **Bun** (1.4), versions from mise.                                                                                                                                                                    |
| Web framework     | **TanStack Start** (a release candidate on a Vite plugin; pin exact versions, it ships almost daily). Scripts run as `bun --bun vite …`.                                                              |
| UI                | **React 19 + Tailwind CSS v4 + Base UI** (`@base-ui/react`). Tailwind is CSS-first (`@theme` tokens, a dark-only palette). Base UI is unstyled; its parts are styled with Tailwind `data-*` variants. |
| Paper roll        | Canvas 2D.                                                                                                                                                                                            |
| Audio             | Web Audio API and a sampled grand piano (chosen in the bake-off).                                                                                                                                     |
| Client-only audio | The player renders only in the browser. The AudioContext is resumed on a user click (autoplay policy).                                                                                                |
| Schemas           | **Zod 4**, the single source of truth for every shape that crosses a boundary (invariant 5).                                                                                                          |
| Database          | **SQLite + Drizzle ORM** via `drizzle-orm/bun-sqlite`. It only works when Vite runs under `bun --bun` (and drizzle-kit likewise).                                                                     |
| Claude            | **Vercel AI SDK 7** with **`@ai-sdk/anthropic`**, reaching Claude Opus 5.5 through **OpenRouter** (see Claude access).                                                                                |
| TypeScript        | **Pinned to 6.0** (6.0.3): npm's `latest` is TypeScript 7 (the Go port), which typescript-eslint doesn't support yet.                                                                                 |

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
- **Tests:** Vitest, run under Bun (see Testing). A root `tsconfig.json` typechecks root-level config files; the root `typecheck` runs it and every workspace's.
- **The gate:** lefthook (an npm dev dependency, pinned) runs on every commit. Pre-commit formats the staged files with Prettier (re-staging what it fixed), then runs `bun run check`: `moth check` → `format:check` → `lint` (no warnings allowed) → `typecheck` → `test`; a build step joins when there's something to build. Hooks source `scripts/lefthook.rc` first, which finds mise and puts its tools on `PATH`, so Git GUIs that don't load a shell profile (VS Code's Source Control) run the same checks. `scripts/setup.sh` installs the hooks. Tickets don't repeat what the gate checks.
- **AGENTS.md:** the working rules for people and coding agents. There is deliberately no `CLAUDE.md`: Claude Code reads AGENTS.md natively, but only when no CLAUDE.md exists ([research/06](research/06-workflow-conventions.md)).
- **Commits:** Conventional Commits on a single line; the subject is the ticket title in lowercase. commitlint (`@commitlint/config-conventional` plus `body-empty` and `footer-empty`, in `commitlint.config.ts`) runs in lefthook's `commit-msg` hook, so bodies and footers, attribution trailers included, are rejected.
- **Tickets:** [Moth](https://github.com/nikolasgioannou/moth), pinned in `mise.toml` and configured by `moth.config.yml` (statuses backlog, todo, in-progress, done, canceled, duplicate). Tickets live flat in `.moth/`. Labels: one milestone (`m0`…), area labels, and `collab` for work done with the user. Done tickets gain an `## Outcome` section. Tickets state outcomes and constraints and point at sections of this document rather than copying details. Every ticket that introduces a tool researches it first.
- **`scripts/setup.sh`:** the one command after cloning. Check, then act, with ✓/→/✗ output; never installs global prerequisites (it fails with instructions); re-running it is a health check. Steps so far: mise present → `mise.toml` trusted → `mise install` → `bun install --frozen-lockfile` → git hooks installed. Any ticket that adds something contributors must set up extends it.
- **`.vscode/`:** recommended extensions, the workspace TypeScript, format on save, ESLint fixes on explicit save, and the Tailwind entry stylesheet; generated files read-only.
- **Git:** a public GitHub repo, [nikolasgioannou/ghostkeys](https://github.com/nikolasgioannou/ghostkeys), branch `main`, with an MIT licence. Every commit is pushed. No GitHub Actions and no deployment.
- **Secrets:** `.env` is gitignored from the first commit; `.env.example` documents the variables. The user pastes the OpenRouter key in themselves.

## Claude access

- **Client:** the Vercel AI SDK 7 (`ai`) with `@ai-sdk/anthropic`, pointed at OpenRouter's Anthropic-compatible endpoint (`baseURL https://openrouter.ai/api/v1`, Bearer `authToken`).
- **Fetch shim:** a small custom `fetch` rewrites the model to `anthropic/claude-opus-5.5` and pins `provider: { only: ['anthropic'], allow_fallbacks: false }`. The SDK is given the model id `claude-opus-5-5`, because it matches capabilities by id substring and OpenRouter's slug would match the Opus 5 profile.
- **Caching:** a stable session id (the piece id) keeps requests on the same provider so prompt caching sticks.
- **What this gives us:** Anthropic-native prompt caching, adaptive thinking, effort control and native structured outputs (`Output.object` with Zod).
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
3. **Original themes only.** No composer-imitation prompts; example excerpts are always behind a copy check.
4. **The music never stops.** Playback never stalls; if generation falls behind, the fallback is musical, not silence.
5. **One schema source.** Every cross-boundary shape is a Zod schema in the engine; no hand-written duplicate types.
6. **The engine is framework-free.** `packages/engine` never imports React, TanStack or the database. Enforced by lint: the engine can't import UI, framework or database packages, read `process.env`, or use browser globals.

## Grid format

The notation Claude composes in. The full specification comes with the grid-format ticket; this section starts with what's built.

- **Pitches** are scientific pitch notation: an uppercase letter A–G, an optional single `#` or `b`, and an octave 0–8, ASCII only. C4 is middle C (MIDI 60). Accidentals may cross octave lines (`Cb4` is B3). The piano's range is A0–C8 (MIDI 21–108). Engine: `pitchToMidi`, `midiToPitch`, `isOnPiano`.

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
- **Prompt caching** through OpenRouter depends on sticky routing to one provider.
- **The name** collides with EleutherAI Aria's "The Ghost in the Keys" demo.
