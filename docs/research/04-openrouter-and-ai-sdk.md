# Calling Claude Opus 5.5 through OpenRouter with the Vercel AI SDK

_Research briefs, 2026-09-30 (OpenRouter + AI SDK). AI SDK behavior was checked in a probe with mocked responses; no live calls._

## OpenRouter

- Slug **`anthropic/claude-opus-5.5`**; same token price as Anthropic direct ($4 in / $20 out per M; cache reads $0.20; cache writes 1.25× (5 min) / 2× (1 h)). 1M context, 128k output. OpenRouter fee: 5.5% on credit purchases.
- **Anthropic Messages-compatible endpoint:** `POST https://openrouter.ai/api/v1/messages`, Bearer auth. Supports `thinking` (adaptive; display summarized/omitted/updates), `output_config.effort` and `.format`, `cache_control` (block-level or top-level), streaming, tools, plus OpenRouter extras `provider`, `session_id`.
- Opus 5.5 specifics: thinking can't be disabled; forced `tool_choice` any/tool → 400; default effort `medium`.
- **Provider pinning:** `provider: { only: ['anthropic'], allow_fallbacks: false }`. Caching relies on sticky routing; send a session id. Caches are per provider.
- Docs: https://openrouter.ai/anthropic/claude-opus-5.5 · https://openrouter.ai/docs/api/api-reference/anthropic-messages/create-a-message · https://openrouter.ai/docs/guides/best-practices/prompt-caching · https://openrouter.ai/docs/guides/routing/provider-selection

## Vercel AI SDK 7

- GA 2026-06-25. `ai@7.0.x`, `@ai-sdk/anthropic@4.0.x`; ESM only, Node ≥ 22 engines, runs on Bun 1.4. Zod 4 / Standard Schema accepted directly. Releases several times a week → pin exact versions. Migration: https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0
- v7 names: `system`→`instructions`, `fullStream`→`stream`, `onFinish`→`onEnd`, `experimental_output`→`output`. A `role: 'system'` message inside `messages` throws unless allowed. Structured output: `generateText({ output: Output.object({ schema }) })` → `result.output` (`generateObject`/`streamObject` deprecated).
- Stream parts: `start`, `start-step`, `reasoning-*`, `text-start/delta/end`, `finish-step`, `finish`, `abort`, `error`. Options: `abortSignal`, `timeout`, `maxRetries`, `streamRetries` (keep 0 — retrying mid-stream would re-emit bars), `providerOptions`.
- Usage: `usage.inputTokenDetails.{noCacheTokens, cacheReadTokens, cacheWriteTokens}`.
- Testing: `ai/test` → `MockLanguageModelV4`, `simulateReadableStream` — works in Vitest offline.

## Provider choice

**A. `@openrouter/ai-sdk-provider` 3.1** — open bugs that hit us: top-level `reasoning` silently dropped (#518), `'max'` missing from types (#566), multi-turn reasoning signatures corrupted (#540, #542), `cache_control` ignored for string system prompts (#389) / assistant messages (#498). https://github.com/OpenRouterTeam/ai-sdk-provider/issues

**B. `@ai-sdk/anthropic` → OpenRouter `/messages` (chosen).** Full Opus 5.5 support (`effort`, adaptive `thinking`, `cacheControl` incl. 1 h TTL, native `outputFormat` structured outputs). Catch: capabilities are matched by model-id substring, and `anthropic/claude-opus-5.5` matches the Opus 5 profile → use id `claude-opus-5-5` and rewrite the model in a custom `fetch`, which also pins the provider:

```ts
const orFetch: typeof fetch = (url, init) => {
  const b = JSON.parse(String(init!.body));
  b.model = 'anthropic/claude-opus-5.5';
  b.provider = { only: ['anthropic'], allow_fallbacks: false };
  return fetch(url, { ...init, body: JSON.stringify(b) });
};
const or = createAnthropic({ baseURL: 'https://openrouter.ai/api/v1', authToken: env.OPENROUTER_API_KEY, fetch: orFetch });
const model = or('claude-opus-5-5');
```

Composer: `streamText({ model, maxOutputTokens: 32000, abortSignal, instructions: { role: 'system', content, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } } }, messages, headers: { 'x-session-id': id }, providerOptions: { anthropic: { effort, thinking: { type: 'adaptive', display: 'omitted' } } } })`, iterate `result.stream` text deltas into the line parser. Conductor: `generateText({ output: Output.object({ schema }) , providerOptions: { anthropic: { effort: 'low' } } })`.

## Fit with TanStack Start
Skip the AI SDK UI layer (`useChat`, UI message streams). Call `streamText` inside a `createServerFn` async generator; the engine's parser consumes an `AsyncIterable<string>`. Abort propagation from client to server function has varied between releases (TanStack/router #4651, #3490, PR #8134) → own `AbortController`, abort in the generator's `finally`, and test a real disconnect.

## Gotchas
- Revise turns: resend the prior assistant message **unmodified** (reasoning parts carry signatures) or the API rejects it (vercel/ai#21734).
- No assistant prefill on Opus 5.5.
- Thinking counts against `maxOutputTokens` — set well above the visible output size.
- Forced tool choice → 400; native structured output avoids it.
- The fetch rewrite depends on `@ai-sdk/anthropic` internals → pin and keep a contract test.
