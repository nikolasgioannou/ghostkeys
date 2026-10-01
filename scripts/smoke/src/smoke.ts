/**
 * Real calls to Claude through OpenRouter, to confirm the client works and
 * measure it (docs/design.md → Claude access). Spends a few cents. Never part
 * of the gate: run it with `bun run smoke`.
 *
 *   1. A real chunk, streamed with adaptive thinking (no revise).
 *   2. The same request again: the cached prefix should be read, not written.
 *   3. A two-turn exchange shaped like the revise turn: the first reply resent
 *      unmodified, thinking signatures and all, must not be rejected.
 *   4. A structured-output call.
 */
import { EMPTY_CONTEXT } from "@ghostkeys/engine";
import { type ChunkUsage, type ComposerEvent } from "@ghostkeys/engine";
import { composeChunk, createClaude } from "@ghostkeys/engine/llm";
import { generateText, Output, streamText } from "ai";
import { z } from "zod";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("Add OPENROUTER_API_KEY to .env (see .env.example).");
  process.exit(1);
}

const model = createClaude({
  apiKey,
  sessionId: `smoke-${String(Date.now())}`,
});

function seconds(ms: number | null): string {
  return ms === null ? "–" : `${(ms / 1000).toFixed(1)} s`;
}

function describeUsage(usage: ChunkUsage): string {
  const n = (value: number | null) => (value === null ? "–" : String(value));
  return `input ${n(usage.inputTokens)} (cache read ${n(usage.cacheReadTokens)}, cache write ${n(usage.cacheWriteTokens)}), output ${n(usage.outputTokens)} (reasoning ${n(usage.reasoningTokens)})`;
}

async function compose(
  label: string,
): Promise<Extract<ComposerEvent, { type: "chunk-complete" }>> {
  console.log(`\n${label}`);
  let complete: Extract<ComposerEvent, { type: "chunk-complete" }> | undefined;
  for await (const event of composeChunk({
    model,
    context: EMPTY_CONTEXT,
    bars: 4,
    effort: "low",
    revise: false,
  })) {
    if (event.type === "chunk-failed")
      throw new Error(`chunk failed: ${event.reason}\n${event.text}`);
    if (event.type === "chunk-complete") complete = event;
  }
  if (!complete) throw new Error("no chunk-complete event");
  const { timings, usage } = complete;
  const generating = timings.totalMs - (timings.firstTokenMs ?? 0);
  const visibleRate =
    usage.outputTokens && generating > 0
      ? (usage.outputTokens - (usage.reasoningTokens ?? 0)) /
        (generating / 1000)
      : null;
  console.log(
    `  first token ${seconds(timings.firstTokenMs)}, first bar ${seconds(timings.firstBarMs)}, total ${seconds(timings.totalMs)}`,
  );
  console.log(`  ${describeUsage(usage)}`);
  console.log(
    `  visible output ≈ ${visibleRate === null ? "–" : visibleRate.toFixed(0)} tokens/s once streaming`,
  );
  console.log(
    `  ${String(complete.items.filter((item) => item.type === "bar").length)} bars, ${String(complete.violations.length)} violations${complete.violations.length > 0 ? `: ${complete.violations.map((v) => v.rule).join(", ")}` : ""}`,
  );
  return complete;
}

const first = await compose("1. A real 4-bar chunk (effort low, no revise)");
console.log(`\n--- the chunk ---\n${first.text}\n---`);

const second = await compose("2. The same request again (expect cache reads)");
console.log(
  (second.usage.cacheReadTokens ?? 0) > 0
    ? "  ✓ the cached prefix was read"
    : "  ✗ no cache read: the prefix may be below the minimum cacheable length",
);

console.log(
  "\n3. A revise-shaped two-turn exchange (effort high, so there's thinking to resend)",
);
const question =
  "Think it through, then in one short sentence: which key, a minor third below E-flat major's relative minor, suits a melancholy nocturne?";
const thinkingOptions = {
  maxOutputTokens: 4000,
  providerOptions: {
    anthropic: {
      effort: "high",
      thinking: { type: "adaptive", display: "omitted" },
    },
  },
} as const;
const opening = streamText({
  model,
  messages: [{ role: "user", content: question }],
  ...thinkingOptions,
});
await opening.consumeStream();
const replyMessages = await opening.responseMessages;
if (!JSON.stringify(replyMessages).includes('"type":"reasoning"')) {
  throw new Error(
    "turn 1 produced no reasoning to resend, so the signatures weren't tested",
  );
}
const followUp = streamText({
  model,
  messages: [
    { role: "user", content: question },
    ...replyMessages,
    {
      role: "user",
      content: "Now name its relative major, in one short sentence.",
    },
  ],
  ...thinkingOptions,
});
console.log(`  turn 1: ${(await opening.text).trim()}`);
console.log(
  `  turn 2: ${(await followUp.text).trim()} (finish: ${await followUp.finishReason})`,
);
console.log(
  "  ✓ turn 1 was resent with its reasoning (and signatures) and accepted",
);

console.log("\n4. Structured output");
const structured = await generateText({
  model,
  prompt:
    "Reply in character as a ghost at the piano to: 'make it stormy'. Give a one-line reply and a mood word.",
  output: Output.object({
    schema: z.object({ reply: z.string(), mood: z.string() }),
  }),
  maxOutputTokens: 4000,
  providerOptions: { anthropic: { effort: "low" } },
});
console.log(`  ${JSON.stringify(structured.output)}`);

console.log("\nAll four calls succeeded.");
