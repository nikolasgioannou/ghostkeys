import { type LanguageModel, type LanguageModelUsage, streamText } from "ai";

import type { GridItem } from "../grid/schema.ts";
import { parseGridStream } from "../grid/stream-parser.ts";
import { checkArrivingBar, checkComposedChunk } from "./check-all.ts";
import type { ComposerContext } from "./context.ts";
import type { ChunkTimings, ChunkUsage, ComposerEvent } from "./events.ts";
import { buildComposerMessage, COMPOSER_SYSTEM_PROMPT } from "./prompt.ts";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** Thinking counts against the output limit, so leave plenty of room beyond the visible chunk. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 32_000;

export interface ComposeChunkOptions {
  model: LanguageModel;
  context: ComposerContext;
  /** How many bars to write. The caller decides (opening, post-steer or steady length). */
  bars: number;
  effort: Effort;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
  /** Milliseconds; tests pass a fake clock. */
  now?: () => number;
}

function toUsage(usage: LanguageModelUsage): ChunkUsage {
  return {
    inputTokens: usage.inputTokens ?? null,
    cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? null,
    cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    reasoningTokens: usage.outputTokenDetails.reasoningTokens ?? null,
  };
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Composes one chunk: streams Claude's reply through the grid parser, checks
 * each bar as it arrives, then checks the whole chunk and emits
 * `chunk-complete` (or `chunk-failed` if the model didn't finish). Every bar
 * is exactly what Claude wrote; code never edits notes (invariant 1). Stops
 * without a final event when `abortSignal` fires.
 */
export async function* composeChunk(
  options: ComposeChunkOptions,
): AsyncGenerator<ComposerEvent> {
  const now = options.now ?? (() => performance.now());
  const started = now();
  const message = buildComposerMessage(options.context, { bars: options.bars });

  const result = streamText({
    model: options.model,
    instructions: {
      role: "system",
      content: COMPOSER_SYSTEM_PROMPT,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } },
      },
    },
    messages: [{ role: "user", content: [{ type: "text", text: message }] }],
    maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    // A retried stream would re-emit bars that were already reported.
    streamRetries: 0,
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
    providerOptions: {
      anthropic: {
        effort: options.effort,
        thinking: { type: "adaptive", display: "omitted" },
      },
    },
  });

  let text = "";
  let firstTokenMs: number | null = null;
  let firstBarMs: number | null = null;
  async function* deltas(): AsyncGenerator<string> {
    for await (const delta of result.textStream) {
      firstTokenMs ??= now() - started;
      text += delta;
      yield delta;
    }
  }

  const items: GridItem[] = [];
  try {
    for await (const item of parseGridStream(deltas(), options.abortSignal)) {
      const violations =
        item.type === "bar" ? checkArrivingBar(items, item) : [];
      if (item.type === "bar") firstBarMs ??= now() - started;
      items.push(item);
      yield { type: "item", item, violations };
    }
    if (options.abortSignal?.aborted) return;

    const finishReason = await result.finishReason;
    const usage = toUsage(await result.usage);
    const timings: ChunkTimings = {
      firstTokenMs,
      firstBarMs,
      totalMs: now() - started,
    };

    if (finishReason !== "stop") {
      const reason =
        finishReason === "length"
          ? "length"
          : finishReason === "content-filter"
            ? "refusal"
            : finishReason === "error"
              ? "error"
              : "other";
      yield { type: "chunk-failed", reason, text, usage, timings };
      return;
    }

    yield {
      type: "chunk-complete",
      items,
      violations: checkComposedChunk(items),
      text,
      usage,
      timings,
    };
  } catch (error) {
    if (options.abortSignal?.aborted || isAbort(error)) return;
    throw error;
  }
}
