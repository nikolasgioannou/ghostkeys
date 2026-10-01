# Ghostkeys — Implementation plan

This is the order in which Ghostkeys gets built. The tickets themselves live in `.moth/` (Moth tracks status and `blocked_by`, but not sequence). This document is the sequence.

- **Plan of record:** [`PLAN.md`](../PLAN.md) until ticket 1 splits it into `docs/product.md` and `docs/design.md` (Part 3 lists the invariants)
- **Research:** [research/](research/)

## How to work through it

1. **Take the next ticket in the order below** whose blockers are all done. `moth list --unblocked` shows what's available. The order below is the intended path, and `blocked_by` is the hard constraint.
2. **Re-check before starting.** Read the ticket, the tickets it's blocked by, and the design doc sections it points to. Tickets were all written up front, so earlier work (especially the bake-off) may have changed things. If reality has moved, adjust the ticket first (`moth edit`), in the same commit as the work.
3. **Claim it:** `moth move <id> in-progress`.
4. **One ticket = one commit.** The commit contains the work, any doc updates, and the ticket moved to `done` with an `## Outcome` section. The subject is a conventional type plus the ticket title in lowercase, on a single line (`feat: parse the grid as it streams`).
5. **Keep the docs true.** When implementation finds a better approach than the design doc's sketch, do the better thing and update `docs/design.md` in the same commit. **Invariants** (design.md Part 3) change only after discussing with the user.
6. **Collaborative tickets (🤝)** are done _with_ the user: things that happen in their accounts (GitHub), things that spend their money (the smoke test, the bake-off), decisions they asked to make (picking the format and piano, the look, grid-format tweaks), and listening sessions where the music is judged by ear. Don't complete these alone.
7. **New tools get researched properly.** Every ticket that introduces a tool, library or SDK starts with research into its current version, configuration and how it fits the rest of the stack, from current docs rather than memory. Several of these tools ship almost daily, so pin exact versions.
8. **Tests** are called for where they matter, ticket by ticket, focused on deterministic code: the grid parser, checkers, continuity, timing and humanization, the playback queue, failure handling and the database. Code that calls Claude is tested against the AI SDK's mock models. Musical quality is judged by ear, through the bake-off and the listening sessions, not by tests. Live API calls never run in the gate.
9. **The gate:** once ticket 9 lands, Prettier, ESLint, `moth check`, typecheck, tests (and, from ticket 35, the build) run on every commit, and ticket 10 adds commitlint. Tickets don't repeat that. Before ticket 9, run whatever checks exist by hand.
10. **Moth runs through mise** (`mise.toml` pins it). Until `scripts/setup.sh` exists, trust the repo with `mise trust` first.

## Milestones at a glance

| Milestone           | Tickets | What works at the end                                                                                                                    |
| ------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Foundations      | 1–12    | Docs, AGENTS.md, the Bun monorepo, setup script, strict TypeScript, Vitest, Prettier, ESLint, the pre-commit gate, commitlint, README, public repo |
| M1 Engine core      | 13–25   | The grid format, streaming parser, checkers, copy guard, Claude client, composer prompt, streamed chunks with check and revise, continuity |
| M2 Bake-off         | 26–34   | Timing and humanization, the bake-off run and judged blind by ear, the winning format and piano applied, bake-off code retired           |
| M3 Hear it          | 35–40   | The web app with play/pause; a stored chunk plays on the sampled piano                                                                   |
| M4 Endless          | 41–44   | Live composing streamed from the server, two chunks buffered, the holding-pattern safety net, recovery from failures: it plays forever  |
| M5 Memory           | 45–49   | Chunks and state saved in SQLite, resume, the model-call log, the reset script, an hour of listening and tuning                         |
| M6 The ghost talks  | 50–55   | The conductor, typed messages with fading replies, steering heard at the next chunk, tuned together                                     |
| M7 Player-piano     | 56–60   | The look designed together, the paper roll, themed controls, grid-format tweaks, the final polish                                       |

**60 tickets, 9 collaborative.**

## The sequence

### M0 — Foundations

The docs, the working rules, the monorepo and its toolchain, the pre-commit gate and the public repo. The engine package arrives here with its first real module (pitch primitives) so every tool has something to check. Nothing user-facing yet.

| #   | Ticket   | Title                                                                  | Blocked by                     |
| --- | -------- | ---------------------------------------------------------------------- | ------------------------------ |
| 1   | `53f225` | Split the plan into product and design docs                            | —                              |
| 2   | `322400` | Write AGENTS.md with the repo's working principles                     | `53f225`                       |
| 3   | `09c97c` | Bootstrap the Bun workspace monorepo                                   | `53f225`                       |
| 4   | `a9e075` | Write the setup script                                                 | `09c97c`                       |
| 5   | `201d66` | Create the engine package with strict TypeScript and pitch primitives  | `a9e075`                       |
| 6   | `2a5b59` | Set up Vitest and test the pitch primitives                            | `201d66`                       |
| 7   | `f48deb` | Set up Prettier                                                        | `201d66`                       |
| 8   | `0a47f7` | Set up ESLint with type-aware TypeScript rules                         | `201d66`, `f48deb`             |
| 9   | `bb5341` | Run the check gate before each commit with lefthook                    | `a9e075`, `2a5b59`, `0a47f7`   |
| 10  | `10d338` | Enforce single-line conventional commits with commitlint               | `bb5341`, `322400` |
| 11  | `dfe595` | Add the README and MIT license                                         | `bb5341`, `322400` |
| 12  | `2c06c7` | Publish the repo on GitHub 🤝                                           | `322400`, `10d338`, `dfe595`   |

### M1 — Engine core

The notation Claude composes in, and everything that reads and checks it, plus the path to Claude itself. By the end, the engine can compose a chunk from a context, check every bar, revise what fails, and hand off to the next chunk, all tested offline against mock models. The smoke test is the first real call.

| #   | Ticket   | Title                                                  | Blocked by                                 |
| --- | -------- | ------------------------------------------------------ | ------------------------------------------ |
| 13  | `ee395f` | Specify the grid format                                | `2c06c7`                                   |
| 14  | `6b98de` | Define the grid schemas and parse a chunk              | `ee395f`                                   |
| 15  | `bd31a0` | Parse the grid as it streams                           | `6b98de`                                   |
| 16  | `61341d` | Check bars against the playing rules                   | `6b98de`                                   |
| 17  | `bd11d8` | Check notes against the planned harmony                | `61341d`                                   |
| 18  | `a0ef75` | Transcribe texture examples from public-domain scores  | `bd11d8`                                   |
| 19  | `a017f1` | Guard against copying the examples                     | `a0ef75`                                   |
| 20  | `d1e3f6` | Add the Claude client for OpenRouter                   | `2c06c7`                                   |
| 21  | `6f828d` | Smoke-test Claude through OpenRouter 🤝                 | `d1e3f6`, `6b98de`                         |
| 22  | `f59a19` | Write the composer prompt and context                  | `a0ef75`                                   |
| 23  | `417e23` | Stream a chunk from Claude into checked bars           | `bd31a0`, `a017f1`, `d1e3f6`, `f59a19`     |
| 24  | `ea22a7` | Revise bars that fail the checks                       | `417e23`                                   |
| 25  | `20a6d2` | Carry continuity from one chunk to the next            | `417e23`                                   |

### M2 — Bake-off

Decide the format and the piano by ear before building the app on them. Timing and humanization come first so the clips sound the way the app will. Variants A (ABC), B (plan + grid) and C (plan + grid + check + revise) run live, are ranked blind, and the winner becomes the engine's default. If no variant keeps ahead of playback, or the winner isn't C, stop and re-plan with the user before M3.

| #   | Ticket   | Title                                                  | Blocked by             |
| --- | -------- | ------------------------------------------------------ | ---------------------- |
| 26  | `3faa43` | Turn bars into timed note events                       | `6b98de`               |
| 27  | `f3ff0a` | Humanize the performance                               | `3faa43`               |
| 28  | `a7ea88` | Build the bake-off runner                              | `ea22a7`, `20a6d2`, `3faa43` |
| 29  | `6ecb29` | Add the ABC variant to the bake-off                    | `a7ea88`               |
| 30  | `e4756a` | Play bake-off sessions on a local listening page       | `a7ea88`, `f3ff0a`     |
| 31  | `adbde3` | Compare pianos and variants blind                      | `e4756a`, `6ecb29`     |
| 32  | `f7c4d6` | Run the bake-off 🤝                                     | `6f828d`, `adbde3`     |
| 33  | `0d74ce` | Pick the format and piano by ear 🤝                     | `f7c4d6`               |
| 34  | `062540` | Apply the bake-off outcome and retire the bake-off code | `0d74ce`              |

### M3 — Hear it

The web app appears: TanStack Start on Bun, linted for React, styled with Tailwind, one Base UI play/pause control. By the end, pressing Play performs a stored chunk on the chosen sampled piano.

| #   | Ticket   | Title                                          | Blocked by                       |
| --- | -------- | ---------------------------------------------- | -------------------------------- |
| 35  | `80ed04` | Scaffold the TanStack Start app                | `2c06c7`                         |
| 36  | `823bc4` | Extend ESLint for React and TanStack Router    | `80ed04`                         |
| 37  | `ee0243` | Add Tailwind CSS v4                            | `80ed04`                         |
| 38  | `e4d8ad` | Add the play/pause control with Base UI        | `823bc4`, `ee0243`               |
| 39  | `ea6a86` | Queue the performance for playback             | `f3ff0a`                         |
| 40  | `63eb7f` | Play a stored chunk on the sampled piano       | `e4d8ad`, `ea6a86`, `062540`     |

### M4 — Endless

Live composing. The browser pulls the next chunk from a streaming server function and keeps two chunks buffered; a chunk plays only once it's complete. Requests name the piece and the chunk, so retries replay instead of composing twice, and a stale request is told where to resync. When generation runs late, the ghost lingers on Claude's holding pattern; when a call fails, the chunk is composed again. By the end it plays forever.

| #   | Ticket   | Title                                                       | Blocked by             |
| --- | -------- | ----------------------------------------------------------- | ---------------------- |
| 41  | `67e485` | Stream the next chunk from the server                       | `062540`, `80ed04`     |
| 42  | `39926e` | Keep two chunks buffered while playing                      | `67e485`, `63eb7f`     |
| 43  | `43017f` | Fall back to the holding pattern when the next chunk is late | `39926e`              |
| 44  | `cbcc2b` | Recover from composer failures                              | `43017f`               |

### M5 — Memory

The database becomes the source of truth: every chunk is saved with a snapshot of the piece state after it, so the piece survives restarts and can resume where you left off. Every model call is logged for debugging. Then the first long listening session, with the log at hand, to tune the music.

| #   | Ticket   | Title                                          | Blocked by                                 |
| --- | -------- | ---------------------------------------------- | ------------------------------------------ |
| 45  | `d73fae` | Save each chunk and the piece state in SQLite  | `67e485`, `cbcc2b` |
| 46  | `e98607` | Resume where you left off                      | `d73fae`, `39926e`                         |
| 47  | `ea0677` | Log every model call                           | `d73fae`                                   |
| 48  | `fd4fe6` | Add the piece reset script                     | `d73fae`, `39926e`, `e98607` |
| 49  | `2d2c70` | Listen to a long session and tune 🤝            | `cbcc2b`, `e98607`, `ea0677`, `fd4fe6`     |

### M6 — The ghost talks

Steering. A fast conductor call turns what the listener types into a one-line reply and a change of direction; the composer follows it, immediately or gradually, with Claude choosing every step; and buffered music after the playing chunk is dropped so the change is heard at the next chunk boundary. The server never starts a composition on its own: the next request from the open tab composes the steered chunk. Tuned together by feel.

| #   | Ticket   | Title                                            | Blocked by                                 |
| --- | -------- | ------------------------------------------------ | ------------------------------------------ |
| 50  | `fc0f00` | Write the conductor                              | `20a6d2`, `ea0677`                         |
| 51  | `0bd789` | Send a message to the ghost                      | `fc0f00`, `ea0677`, `fd4fe6` |
| 52  | `537f73` | Add the chat input with fading replies           | `0bd789`, `e4d8ad`                         |
| 53  | `be396c` | Steer the composer toward the direction          | `0bd789`                                   |
| 54  | `3cdb60` | Hear steering at the next chunk                  | `be396c`, `537f73`, `43017f`, `e98607`     |
| 55  | `fb10c7` | Steer the ghost together and tune the conductor 🤝 | `3cdb60`, `2d2c70`                       |

### M7 — Player-piano

The look, designed together: the candlelit player-piano roll as the visualizer, the controls and chat in the theme, then the grid-format tweaks the user chose to make at the end, and a final polish pass that files anything else as tickets.

| #   | Ticket   | Title                                      | Blocked by                         |
| --- | -------- | ------------------------------------------ | ---------------------------------- |
| 56  | `bbf93d` | Design the player-piano look 🤝             | `537f73`                           |
| 57  | `e8f93c` | Draw the paper roll                        | `bbf93d`, `3cdb60`, `43017f`       |
| 58  | `5e386a` | Style the controls and chat in the theme   | `bbf93d`                           |
| 59  | `85f077` | Tweak the grid format 🤝                    | `fb10c7`                           |
| 60  | `269f36` | Polish the experience 🤝                    | `e8f93c`, `5e386a`, `85f077`       |
