import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Claude Opus 5.5 through OpenRouter's Anthropic-compatible endpoint, via the
 * AI SDK's Anthropic provider (docs/design.md → Claude access). The engine
 * never reads the environment: the caller passes the key in.
 */

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
/** The model as OpenRouter names it. */
export const OPENROUTER_MODEL = "anthropic/claude-opus-5.5";
/**
 * The model id the AI SDK is given. The provider picks capabilities (adaptive
 * thinking, effort, no forced tool use) by id, and OpenRouter's slug would
 * match the Opus 5 profile, so the SDK sees Anthropic's id and the fetch shim
 * swaps in OpenRouter's.
 */
export const SDK_MODEL_ID = "claude-opus-5-5";
/** Only Anthropic serves the request, so prompt caching stays on one provider. */
export const PROVIDER_ROUTING = {
  only: ["anthropic"],
  allow_fallbacks: false,
} as const;

export interface ClaudeConfig {
  /** The OpenRouter API key. */
  apiKey: string;
  /**
   * A stable id for the conversation's requests (the piece id), so OpenRouter
   * keeps them on the same provider and the prompt cache sticks.
   */
  sessionId: string;
  /** The fetch to send requests with; tests pass a fake. */
  fetch?: typeof fetch;
}

/**
 * Rewrites each request body for OpenRouter: its model slug, the provider
 * pin and the session id. Everything else is the Anthropic request the SDK
 * built.
 */
function openRouterFetch(base: typeof fetch, sessionId: string): typeof fetch {
  const wrapped = async (...[input, init]: Parameters<typeof fetch>) => {
    if (typeof init?.body !== "string") return base(input, init);
    const body = JSON.parse(init.body) as Record<string, unknown>;
    body.model = OPENROUTER_MODEL;
    body.provider = PROVIDER_ROUTING;
    body.session_id = sessionId;
    return base(input, { ...init, body: JSON.stringify(body) });
  };
  // Some runtimes (Bun) give `fetch` extra members; carry them over unchanged.
  return Object.assign(wrapped, base);
}

export function createClaude(config: ClaudeConfig): LanguageModel {
  const anthropic = createAnthropic({
    baseURL: OPENROUTER_BASE_URL,
    authToken: config.apiKey,
    fetch: openRouterFetch(config.fetch ?? fetch, config.sessionId),
  });
  return anthropic(SDK_MODEL_ID);
}
