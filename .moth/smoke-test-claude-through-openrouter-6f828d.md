---
id: "6f828d"
title: Smoke-test Claude through OpenRouter
status: done
priority: none
labels:
  - collab
  - llm
  - m1
created_at: 2026-10-01T03:10:00.693Z
updated_at: 2026-10-01T04:50:30.901Z
blocked_by:
  - "6b98de"
  - "d1e3f6"
---

Done together with the user: it needs their OpenRouter key and spends a few cents. The user pastes the key into `.env` themselves.

**Scope**
- A `smoke` script (runnable from the root as `bun run smoke`; never part of the gate) that makes real calls:
  1. One streamed call with adaptive thinking (display omitted), reporting time to first token, output tokens per second and `finishReason`.
  2. A second call with the same long system prompt, which must show cache reads above 0. Make the cached prefix longer than Opus 5.5's documented minimum cacheable length, or a 0 here means nothing.
  3. A two-turn call shaped like the revise turn: turn 1 streamed with thinking, turn 2 resending `response.messages` unmodified plus a correction. It must not return a 400 (thinking signatures survive the shim and OpenRouter).
  4. One structured-output call (`Output.object` with a small Zod schema).
- Where it lives: outside `packages/engine` (the engine never reads the environment), importing `@ghostkeys/engine/llm` through a declared workspace dependency, and covered by `typecheck` and type-aware `lint`. The root typecheck only runs workspaces, so either put it in one or give it a tsconfig the gate runs.
- Agree with the user on whether later tickets may make live calls while being built, and with what rough budget (mocks first either way). Record the rule in AGENTS.md.

**Docs:** design.md → Claude access (measured latency, tokens/s and cache behaviour, which informs chunk length); design.md → Repo, tooling & gate (where the smoke script lives); README (`bun run smoke`); AGENTS.md (live-call rule).

**Done when:** all four calls succeed with the user's key, the measurements are recorded, the script passes the gate, and the live-call rule is in AGENTS.md.

## Outcome

- `scripts/smoke` workspace (`@ghostkeys/smoke`; `scripts/*` added to the workspace globs): imports `@ghostkeys/engine/llm` via `workspace:*`, Bun types, loads the root `.env` with `--env-file`; typechecked and linted by the gate, never run by it. Root `bun run smoke`.
- Ran it with the user's key (cost: a few cents):
  1. a real 4-bar chunk at effort `low`, no revise: first token 3.4 s, first bar 5.6 s, total 10.7 s, ~110 visible tokens/s, 786 output tokens, no reasoning at `low`; a valid Ab-major opening (one soft harmony flag on a mislabelled `V7/V`);
  2. the same request: 4,214 prefix tokens read from cache (written on the first call), so caching through OpenRouter works and the prefix clears the minimum;
  3. two turns at effort `high`: turn 1's reasoning (78 tokens) resent unmodified with its signatures, turn 2 accepted (`stop`). The script fails if there's no reasoning to resend;
  4. structured output (`Output.object`) worked.
- Finding: a bar costs ~120 output tokens (2–3× the character estimate). Streaming runs at ~0.45× real time; a 16-bar chunk at `low` without revise is ~0.55×, near the bake-off's 0.6 bar. Recorded in design.md (Claude access → Measured, Grid format token budget, Risks).
- The client's fetch shim now types under both DOM and Bun (`Object.assign(wrapped, base)` carries Bun's extra `fetch` members).
- Live-call rule agreed with the user: test with real calls when a ticket needs it, keep it modest, mocks first; bigger spends agreed first. Recorded in AGENTS.md.
- README lists `bun run smoke`.
