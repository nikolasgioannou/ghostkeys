---
id: "d1e3f6"
title: Add the Claude client for OpenRouter
status: todo
priority: none
labels:
  - engine
  - llm
  - m1
created_at: 2026-10-01T03:10:00.579Z
updated_at: 2026-10-01T03:14:21.712Z
blocked_by:
  - "2c06c7"
---

Reach Claude Opus 5.5 through OpenRouter with the Vercel AI SDK, as decided in docs/research/04.

**Research first** (current docs; both packages ship several times a week): AI SDK 7 (`ai`) and `@ai-sdk/anthropic`. Cover `createAnthropic` with `baseURL`, `authToken` and a custom `fetch`; `streamText` and `generateText` with `Output.object`; `providerOptions.anthropic` (effort, adaptive thinking, `cacheControl`); usage fields; and the `ai/test` mock models. Confirm in current OpenRouter docs whether its `/messages` endpoint takes the session id as a body `session_id` or an `x-session-id` header. Pin exact versions.

**Scope**
- `@ai-sdk/anthropic` pointed at `https://openrouter.ai/api/v1` with Bearer `authToken`. A small `fetch` shim rewrites the model to `anthropic/claude-opus-5.5` and adds `provider: { only: ['anthropic'], allow_fallbacks: false }`. Use model id `claude-opus-5-5` (the provider matches capabilities by id substring, and the OpenRouter slug would match the Opus 5 profile).
- A session id supplied by the caller (later the piece id, so it stays stable across chunks and restarts and caching sticks).
- Config is injected (key, session id); the engine never reads the environment. The LLM code lives behind a separate export, `@ghostkeys/engine/llm`, so the browser-safe main entry never pulls in the AI SDK.
- `.env.example` at the repo root with `OPENROUTER_API_KEY=`. `scripts/setup.sh` creates `.env` from it if missing and reminds you to paste the key (check, then act). Decide how each entry point loads the root `.env`. Bun only auto-loads `.env` from the working directory, so scripts in workspaces need e.g. `--env-file`. Record the mechanism.
- Contract test with a mocked `fetch`: the URL, Bearer auth, model, provider pin, session id, `cache_control` on the system block, adaptive thinking and effort. This guards the shim against SDK updates.

**Docs:** design.md → Claude access (client shape, shim, env loading, pins); README (create `.env` and paste the key).

**Done when:** the contract test passes offline, and the main engine entry can be bundled for the browser without `ai` in the bundle.
