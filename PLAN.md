# Ghostkeys — Plan

> A ghost at the piano: an endless, ever-evolving Romantic piano piece, composed note by note by Claude, that you can talk to and steer.

This document is the plan agreed during design grilling (2026-09-30). The first tickets split it into `docs/` (product, design, plan, research); after that, `docs/` is the source of truth. The only open items (§8) are decided by the bake-off.

---

## 1. Product

### Vision
Open the site and a piano is already playing — one endless piece that never stops and keeps evolving. Type to it ("make it stormy", "something hopeful", "slow down") and the ghost answers in a line of text, then the music travels there.

### Decisions
| Area | Decision |
|---|---|
| Form factor | Website, running **locally** for v1 (`localhost`). Structured so deploying later is just a deploy step. |
| Audience | **Personal**, single user. No auth. |
| Musical shape | **One endless piece** — an *endless fantasia*: a persistent bank of themes, slowly drifting state (key, tempo, mood, texture), themes return transformed, phrases flow into each other with no hard section breaks. |
| Style scope | **Romantic** era solo piano (v1). Broaden later. |
| Originality | **Original themes only.** Prompts use genre/form/texture terms, not "in the style of <composer>". Short public-domain excerpts may be used as texture examples, guarded by a similarity/copy check. |
| Steering | **Typed chat.** Steering takes effect at the **next chunk (~15–30 s)** via a composed transition; gradual when the wording implies it ("slowly get darker"). |
| Ghost replies | A short in-character one-line reply to each message. **It never speaks unless spoken to.** |
| Voice input | Not in v1 (typing only). |
| One piece, forever | **There is only ever one piece.** No library, no "new piece" button — if you want something different, you steer it there. Its state is saved, so reopening the site (or restarting the server) resumes it. |
| Controls | **Play/pause only.** No volume (system volume), no skip. Pausing stops playback; with the buffer full, generation stops too. |
| Simplicity | The whole user model: *one thing is playing, and you can steer it.* Anything beyond that needs a strong reason. |
| Tracking | **No cost or usage tracking in the app** — OpenRouter's dashboard covers that. |
| Visual theme | **Retro player-piano roll** — dark, candlelit; a perforated paper roll scrolls as notes are "punched". The roll is the visualizer. Sleek, minimal chrome. |
| Screen | **Only three things:** the paper roll, a play/pause button, and a chat input. The ghost's reply fades in near the input and fades out. No visible chat history, no key/tempo readout. (Full history stays in the database so the conductor remembers earlier requests.) Visual details shaped together in M7. |
| Reset | No UI. A dev script (`bun run piece:reset`) wipes the piece; the next play starts fresh. |
| Model-call log | Every LLM call (and tool call, if any) is stored for **debugging**: role (composer/revise/conductor), prompt, response, timing, checker results, raw token counts. Nothing is computed or displayed from it. |
| Generation lifecycle | Generates **only while the site is open and connected**. No background generation. |
| Cost | Not a concern for v1. Expect a few $/listening hour (see §4); tracked in OpenRouter, not the app. |
| Who writes notes | **Claude writes every note.** Code may *suggest* (e.g. a transformed motif draft) but Claude rewrites every bar. Code validates; it never silently composes. |

---

## 2. Architecture

```
Browser (TanStack Start client)                     Server (TanStack Start on Bun)
┌──────────────────────────────┐                    ┌───────────────────────────────────┐
│ Scheduler (Web Audio,        │  "next chunk"      │ Composer: plan → grid → check →    │
│ lookahead) + sampled piano   │ ─────────────────▶ │ revise  (Claude Opus 5.5, stream)  │
│ Buffer ≥ 2 chunks            │ ◀── bars stream ── │ Parser / validator / repair        │
│                              │                    │                                    │
│ Piano-roll canvas            │  chat message      │ Conductor: fast reply + updates    │
│ Play/pause · chat input      │ ─────────────────▶ │ piece direction (structured JSON)  │
│                              │ ◀── reply ──────── │                                    │
└──────────────────────────────┘                    │ SQLite (Drizzle): the piece,       │
                                                    │ chunks, theme bank, direction,     │
                                                    │ chat, model-call log               │
                                                    └───────────────────────────────────┘
```

### Decisions
- **Browser pulls.** When buffered music drops below ~2 chunks, the browser asks the server for the next chunk; the server streams bars back as they're parsed. Tab closed ⇒ nothing generates. Survives dev-server hot reload.
- **Two Claude roles:**
  - **Conductor** — fast call per chat message: writes the ghost's reply and updates the piece's *direction* (target key, mood, tempo, texture, how gradual). Structured output.
  - **Composer** — per chunk (~16 bars): reads the current direction, theme bank, running summary, last bars verbatim; produces plan → notes.
- **Composition pipeline (research-backed, pending bake-off):** per-bar plan (Roman numeral, cadence, motif ID + transformation, texture idiom, dynamics) → notes in an explicit **grid format** (absolute pitches, separate RH/LH lines, explicit onset slots) → deterministic **checker** → one **revise** turn on violations.
- **Safety net (invariant 4):** every chunk ends with a short Claude-written loopable *holding pattern* (2–4 bars, e.g. a pedal-point vamp on the closing harmony). If the next chunk is late, playback first stretches tempo slightly (≤ ~10%), then loops the holding pattern with a fade; it's dropped the moment the next chunk arrives.
- **Testing:** deterministic code (grid parser, checker, scheduler math, prompt assembly) gets thorough unit tests; code that calls Claude is tested against AI SDK mock models (`ai/test`) with scripted streams, plus a contract test for the OpenRouter request shape — offline and free. Musical quality is judged by ear. A `bun run smoke` script makes one real call and is never part of the gate.
- **Grid format spec:** drafted in the design doc from the research and built autonomously; the bake-off is its review. The user tweaks at the end.
- **Coherence aids:** theme bank (3–5 named motifs), key-area roadmap a few chunks ahead, running summary, chunk footer (key, last chord, pedal state) carried into the next chunk.
- **Playback realism:** velocity from dynamics + metric accents + melody weighting, small onset jitter, rolled chords, phrase-end rubato, sustain pedal (CC64).

---

## 3. Tech stack

| Layer | Decision |
|---|---|
| Language | **TypeScript everywhere**, end-to-end type safety |
| Runtime / package manager | **Bun** (1.4.x via mise) |
| Repo layout | **Bun workspaces monorepo** — see §3.1 |
| Web framework | **TanStack Start** (RC, Vite plugin; pin exact versions — near-daily releases). Scripts run as `bun --bun vite …` |
| Transport | **Streaming `createServerFn`** (async generator) per chunk request — fully typed end to end, abortable via `AbortSignal`; chat via ordinary typed server functions. No WebSockets (unsupported). |
| UI | **React 19 + Tailwind CSS v4 (4.3) + Base UI (`@base-ui/react` 1.8, stable)**. Tailwind is CSS-first (`@theme` tokens, dark-only palette, no JS config). Base UI is unstyled; style parts with Tailwind and `data-*` state variants. Root needs `isolation: isolate`. |
| TypeScript | **Pin `typescript@~6.0`** — npm `latest` is TS 7 (Go port), which typescript-eslint doesn't support yet. |
| Piano-roll | Canvas 2D |
| Audio | Web Audio API + sampled grand piano — smplr Steinway vs Tone.js Salamander, chosen by ear in the bake-off |
| Schemas | **Zod v4** — single source of truth for plan, note events, chat, server-fn inputs, Claude structured outputs |
| Database | **SQLite + Drizzle ORM** via `drizzle-orm/bun-sqlite` (works only when Vite runs under `bun --bun`; drizzle-kit likewise) |
| Client-only audio | Player route `ssr: false` / `<ClientOnly>`; AudioContext created on a user click (autoplay policy) |
| LLM access | **Vercel AI SDK 7** (`ai`) + **`@ai-sdk/anthropic`** pointed at OpenRouter's Anthropic-compatible endpoint (`baseURL https://openrouter.ai/api/v1`, Bearer `authToken`). A small custom `fetch` rewrites the model id to `anthropic/claude-opus-5.5` and pins `provider: {only: ['anthropic'], allow_fallbacks: false}`; `x-session-id` header for sticky caching. Gives Anthropic-native caching, adaptive thinking, effort, native structured outputs (`Output.object` with Zod). Pin exact versions; keep a contract test for the request shape. |
| Lint / format | **ESLint 10 (flat `eslint.config.ts`) + Prettier 3.** typescript-eslint `strictTypeChecked` with `projectService`; `@eslint-react/eslint-plugin` (the classic `eslint-plugin-react` doesn't support ESLint 10); `eslint-plugin-react-hooks`; `@tanstack/eslint-plugin-router`; `eslint-plugin-better-tailwindcss` (correctness); `simple-import-sort`; `eslint-config-prettier` last. Prettier with `prettier-plugin-tailwindcss` (class order). One root config for the monorepo. |
| Workspaces | Root `workspaces: ["apps/*", "packages/*"]`; engine consumed as TS source (`exports: ./src/index.ts`, no build step); shared `tsconfig.base.json`, no project references; run with `bun --filter`. |
| Tests | **Vitest** (shares Vite config/resolution), run under Bun |
| Tool versions | **mise** (`mise.toml`): Bun, Node, Moth |
| Tickets | **Moth** (pinned via `mise.toml`) |
| Git | **Public GitHub repo** `nikolasgioannou/ghostkeys` (name available). No GitHub Actions, no deployment — local only. |
| Gate | **lefthook** pre-commit: Prettier on staged files → `bun run check` (moth check → format check → ESLint → typecheck → tests → build). **commitlint** on commit-msg. No secret scanning / unused-code tools. |
| License | **MIT** |

### 3.1 Monorepo layout
```
ghostkeys/
├── apps/
│   └── web/            TanStack Start app (UI, server functions)
├── packages/
│   ├── engine/         Pure TS, framework-free: grid format, parser, checker,
│   │                   prompts, composer & conductor, Zod schemas
│   └── db/             Drizzle schema, migrations, bun:sqlite client
├── scripts/bakeoff/    Bake-off runner + listening page
├── scripts/setup.sh    Idempotent contributor setup
├── docs/               product.md, design.md, plan.md, research/
├── .moth/              Tickets
├── AGENTS.md           Working rules
└── package.json        Bun workspaces root
```

### 3.2 Secrets
- `.env` (gitignored) with the OpenRouter key — the user pastes the key in themselves. The repo is **public**, so `.env` is gitignored from the first commit and an `.env.example` documents the variables.

---

## 4. Research findings (summary)

- **Format:** Explicit-timing grid formats beat ABC on rhythm correctness (ABC's running durations cascade errors; models misread ABC digits). ~3× tokens vs ABC.
- **Pipeline:** plan-first → notes → code checker → revise. Revise loop raised Claude Opus's full-piece pass rate 62% → 94% in the closest published system (Libretto).
- **Checkers, not self-critique:** models catch only 0–65% of their own voice-leading errors; code catches all.
- **Few-shot examples:** short labeled texture examples raised pass rate 25% → 75%, but models copy what they see → similarity check.
- **Throughput:** one Opus call per ~50–60 s of music keeps ahead of playback with a 2-chunk buffer and streaming parse.
- **Cost:** ≈ $15–20/listening hour for the full plan+grid+revise pipeline before caching; less with prompt caching.
- **TanStack Start (Sept 2026):** v1 RC, Vinxi gone, scaffold with `bunx @tanstack/cli create` (supports `--toolchain eslint`, Drizzle add-on, telemetry off via `TANSTACK_CLI_TELEMETRY_DISABLED=1`). `createServerFn` handlers can be `async function*` → client `for await` with full types. Validation via `.validator()` (Standard Schema → Zod 4). No WebSockets. Server-only code in `*.server.ts` (import-protected); API key lives only there. Risks: RC API churn, forgetting `--bun`, slow cold dev start.
- **OpenRouter (Sept 2026):** Opus 5.5 available at the same token price as Anthropic direct ($4/$20 per M; cache reads $0.20); OpenRouter charges 5.5% on credit purchases. Exposes an Anthropic Messages-compatible endpoint supporting streaming, adaptive thinking, `output_config.effort`, `output_config.format` (JSON schema), `cache_control`. Pin `provider: {order: ["anthropic"], allow_fallbacks: false}` + `session_id` so caching sticks. Needs a one-time smoke test (auth, cache hits, structured output).
- **Vercel AI SDK (Sept 2026):** v7 GA (`ai@7`, `@ai-sdk/anthropic@4`); ESM, Zod 4 accepted directly. v7 renames: `system`→`instructions`, `fullStream`→`stream`, `onFinish`→`onEnd`; structured output via `generateText({ output: Output.object({ schema }) })` (`generateObject` deprecated). `ai/test` mock models work in Vitest without a key. The OpenRouter-native provider (`@openrouter/ai-sdk-provider`) has open bugs affecting us (dropped reasoning option, broken multi-turn reasoning signatures, cache_control ignored in some cases). `@ai-sdk/anthropic` via OpenRouter works but must use id `claude-opus-5-5` (substring-matched capabilities) with a fetch rewrite. Gotchas: revise turns must resend the prior assistant message unmodified (thinking signatures); no prefill; thinking counts against `maxOutputTokens`; keep `streamRetries` at 0 (would re-emit bars); don't trust TanStack abort propagation blindly — own `AbortController` + test it.
- **Full briefs:** `docs/research/01–06`.
- **Prior art:** Lyria RealTime / Magenta RT (audio-domain), EleutherAI Aria (symbolic piano model; demo titled "The Ghost in the Keys" — name collision to note), infinite-jazz (endless LLM tracker-grid jazz).

---

## 5. Bake-off (approved)

Decide the composition format/pipeline by ear before building the app.

- **Variants:** (A) interleaved ABC + thinking, (B) plan + grid, (C) plan + grid + checker + revise.
- **Run:** 2 sessions × 4 chunks × 16 bars per variant, with one scripted steering message.
- **Measure:** bar-validity rate, checker violations, steering response, generation time vs playback time, token usage — plus blind listening.
- **Also decided here:** the piano samples (A/B toggle on the listening page).
- **Listening:** local page playing clips through the same sampled piano the app will use; variant labels hidden until you pick.
- **Budget:** ≈ $5–8.

---

## 6. How we work (adapted from the user's Winston AGENTS.md)

Once this plan is agreed, it becomes a set of tickets; each ticket = one commit. Principles that carry over:

- **Tickets drive work**, in the order given by the plan. Re-check a ticket against current docs and its dependencies before starting; update the ticket first if things have moved on. Claim → in-progress; move to done **in the same commit** as the work. One ticket per commit.
- **Ticket vs principles conflict** → raise it with the user, don't follow the ticket blindly.
- **Build for today, design for where we're going.** No speculative helpers/stubs/config. Think ahead on hard-to-change decisions (architecture, data shapes, interfaces between parts). Deleting is fine.
- **Docs describe what's actually built**, updated in the same commit as the change.
- **Keep `scripts/setup.sh` complete** and idempotent (check, then act).
- **Keep editor setup current** (`.vscode/extensions.json`, `.vscode/settings.json`).
- **Research a new tool before configuring it**, using current docs, not memory.
- **Ask rather than guess on direction.**
- **Some things need a human:** invariants change only with the user's agreement; tickets labeled `collab` are done together with the user.

### Conventions (decided)
- **Tickets:** [Moth](https://github.com/nikolasgioannou/moth), pinned in `mise.toml`, configured by `moth.config.yml` (statuses backlog/todo/in-progress/done/canceled/duplicate). Tickets live flat in `.moth/` with frontmatter (`id`, `title`, `status`, `labels`, `blocked_by`). Labels: one milestone (`m0`…), area labels, and `collab`. Done tickets gain an `## Outcome` section. Tickets state outcomes and constraints and point at design-doc sections rather than copying details. Every ticket that introduces a tool includes **thorough research** of it (how it works today, configuration, integration with the existing stack) before configuring it.
- **Docs layout:** `docs/product.md` (what & why), `docs/design.md` (architecture, technical decisions, specifications, **invariants**), `docs/plan.md` (milestones + ticket order; Moth tracks status/blockers, plan.md tracks order), `docs/research/` (research briefs from planning). This PLAN.md is split into those in the first tickets.
- **AGENTS.md** at root with rules adapted from Winston (tickets + principles). **No CLAUDE.md**: Claude Code (v2.1.277+) reads AGENTS.md natively, but only when no CLAUDE.md exists — adding one would shadow it. (Fallback for other tools: a CLAUDE.md containing `@AGENTS.md`.)
- **Commits:** Conventional Commits, single subject line, subject = ticket title in lowercase. Enforced by **commitlint**.
- **Gate:** **lefthook** pre-commit: Prettier on staged files, then `bun run check` (moth check → format check → ESLint → typecheck → tests → build).
- **`scripts/setup.sh`:** check-then-act with ✓/→/✗ output; never installs global prerequisites (fails with instructions); re-running doubles as a health check.
- **`.vscode/`:** recommended extensions (ESLint, Prettier, Tailwind), workspace TypeScript, format on save, ESLint fix on explicit save, Tailwind v4 entry stylesheet, generated route tree read-only.
- **Ticket order:** foundations first, then the **bake-off as early `collab` tickets** (engine pieces it needs → run → you listen and pick), then the app built on the winning format.

### Invariants (decided)
1. **Claude chooses every note.** Code validates and may suggest drafts but never composes or silently edits notes; deterministic repairs are flagged and logged.
2. **No generation without a connected listener.**
3. **Original themes only.** No composer-imitation prompts; example excerpts always behind a copy check.
4. **The music never stops.** Playback never stalls; if generation falls behind, the fallback is musical, not silence.
5. **One schema source.** Every cross-boundary shape is a Zod schema in the engine; no hand-written duplicate types.
6. **The engine is framework-free.** `packages/engine` never imports React, TanStack or the database.

---

## 7. Milestones (decided; tickets to follow)

| Milestone | What works at the end |
|---|---|
| **M0 Foundations** | Monorepo, mise, Moth, docs split from this PLAN.md, AGENTS.md, strict TypeScript, ESLint + Prettier, Vitest, lefthook + commitlint, setup.sh, .vscode, public GitHub repo 🤝 |
| **M1 Engine core** | Zod schemas for notes & grid format; parser + checker with tests; AI SDK client + smoke test with the user's key 🤝 |
| **M2 Bake-off** 🤝 | Runner, listening page, run 3 variants; the user picks; design doc records the winning format/pipeline |
| **M3 Hear it** | Web app scaffold, sampled piano, Web Audio scheduler, humanization — a stored chunk plays |
| **M4 Endless** | Streaming composer server function, buffer/pull loop, continuity, theme bank, running summary, safety-net holding patterns — it plays forever |
| **M5 Memory** | `packages/db`, Drizzle, the piece's state saved and resumed, model-call log, `piece:reset` script |
| **M6 The ghost talks** | Conductor, chat input, steering, fading in-character replies |
| **M7 Player-piano** 🤝 | Visual design together, canvas paper roll, candlelit theme, polish |

---

## 8. Open questions

- 🔲 Composer details after bake-off: chunk length, effort levels, grid resolution, revise policy, example excerpts.
- 🔲 Exact sampled piano library — chosen by ear in the bake-off (A/B toggle on the listening page).
