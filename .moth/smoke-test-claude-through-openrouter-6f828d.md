---
id: "6f828d"
title: Smoke-test Claude through OpenRouter
status: todo
priority: none
labels:
  - collab
  - llm
  - m1
created_at: 2026-10-01T03:10:00.693Z
updated_at: 2026-10-01T03:29:20.088Z
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
