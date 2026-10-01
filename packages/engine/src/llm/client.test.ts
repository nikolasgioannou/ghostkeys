import { generateText } from "ai";
import { describe, expect, it } from "vitest";

import { createClaude } from "./client.ts";

/** Records the request and answers like Anthropic's Messages API would. */
function fakeFetch() {
  const requests: {
    url: string;
    headers: Headers;
    body: Record<string, unknown>;
  }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push({
      url,
      headers: new Headers(init?.headers),
      body: JSON.parse(
        typeof init?.body === "string" ? init.body : "{}",
      ) as Record<string, unknown>,
    });
    await Promise.resolve();
    return new Response(
      JSON.stringify({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "claude-opus-5-5",
        content: [{ type: "text", text: "CHUNK meter=4/4 tempo=72 key=C" }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 12, output_tokens: 8 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  return { fetcher, requests };
}

describe("createClaude (contract with OpenRouter)", () => {
  it("sends the request OpenRouter's Anthropic endpoint expects", async () => {
    const { fetcher, requests } = fakeFetch();
    const model = createClaude({
      apiKey: "sk-or-test",
      sessionId: "piece-123",
      fetch: fetcher,
    });

    const result = await generateText({
      model,
      instructions: {
        role: "system",
        content: "You are a pianist-composer.",
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } },
        },
      },
      prompt: "Compose the opening.",
      maxOutputTokens: 32000,
      providerOptions: {
        anthropic: {
          effort: "medium",
          thinking: { type: "adaptive", display: "omitted" },
        },
      },
    });

    expect(result.text).toBe("CHUNK meter=4/4 tempo=72 key=C");
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.url).toBe("https://openrouter.ai/api/v1/messages");
    expect(request?.headers.get("authorization")).toBe("Bearer sk-or-test");
    expect(request?.headers.get("x-api-key")).toBeNull();

    expect(request?.body).toMatchObject({
      model: "anthropic/claude-opus-5.5",
      provider: { only: ["anthropic"], allow_fallbacks: false },
      session_id: "piece-123",
      max_tokens: 32000,
      thinking: { type: "adaptive", display: "omitted" },
      output_config: { effort: "medium" },
      system: [
        {
          type: "text",
          text: "You are a pianist-composer.",
          cache_control: { type: "ephemeral", ttl: "1h" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "Compose the opening." }],
        },
      ],
    });
  });
});
