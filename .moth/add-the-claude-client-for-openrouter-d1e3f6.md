---
id: "d1e3f6"
title: Add the Claude client for OpenRouter
status: done
priority: none
labels:
  - engine
  - llm
  - m1
created_at: 2026-10-01T03:10:00.579Z
updated_at: 2026-10-01T04:26:02.242Z
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

## Outcome

- Research: `ai` 7.0.126 and `@ai-sdk/anthropic` 4.0.71 (pinned exactly, in the engine); confirmed `createAnthropic({ baseURL, authToken, fetch })`, AI SDK 7's `instructions` with per-message `providerOptions`, and the Anthropic options `effort`, adaptive `thinking` and `cacheControl` (with `ttl`). OpenRouter's `/messages` takes the session id as body `session_id` or `x-session-id`; the body wins, so the shim sets the body.
- `llm/client.ts`: `createClaude({ apiKey, sessionId, fetch? })` with the OpenRouter fetch shim (model slug, provider pin, session id). Exported only from the `@ghostkeys/engine/llm` subpath; a browser build of the main entry contains no AI SDK code (checked with `bun build --target browser`).
- Contract test (fake fetch, no network): URL, Bearer auth (no `x-api-key`), rewritten model, provider pin, session id, `max_tokens`, adaptive thinking, `output_config.effort`, `cache_control` on the system block, and the user message.
- `.env.example` at the root; `scripts/setup.sh` step 6 creates `.env` and reminds you to add the key. `.env` confirmed gitignored.
- design.md → Claude access (client shape, shim, env loading); README (the key step).
