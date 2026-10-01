import {
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  streamText,
} from "ai";

import type { Violation } from "../checks/violation.ts";
import type { GridItem } from "../grid/schema.ts";
import { parseGridStream } from "../grid/stream-parser.ts";
import { checkArrivingBar, checkComposedChunk } from "./check-all.ts";
import type { ComposerContext } from "./context.ts";
import { assertNoDeniedNames } from "./denylist.ts";
import type { ChunkTimings, ChunkUsage, ComposerEvent } from "./events.ts";
import { buildComposerMessage, COMPOSER_SYSTEM_PROMPT } from "./prompt.ts";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** Thinking counts against the output limit, so leave plenty of room beyond the visible chunk. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 32_000;

/** Soft violations (harmony) trigger a revise only when there are at least this many. */
export const REVISE_SOFT_MIN = 2;

export interface ComposeChunkOptions {
  model: LanguageModel;
  context: ComposerContext;
  /** How many bars to write. The caller decides (opening, post-steer or steady length). */
  bars: number;
  effort: Effort;
  /** Make one revise turn when the checks fail (default true; the bake-off's variant B turns it off). */
  revise?: boolean;
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

function addUsage(a: ChunkUsage, b: ChunkUsage): ChunkUsage {
  const add = (x: number | null, y: number | null) =>
    x === null && y === null ? null : (x ?? 0) + (y ?? 0);
  return {
    inputTokens: add(a.inputTokens, b.inputTokens),
    cacheReadTokens: add(a.cacheReadTokens, b.cacheReadTokens),
    cacheWriteTokens: add(a.cacheWriteTokens, b.cacheWriteTokens),
    outputTokens: add(a.outputTokens, b.outputTokens),
    reasoningTokens: add(a.reasoningTokens, b.reasoningTokens),
  };
}

function failure(
  finishReason: string,
): "length" | "refusal" | "error" | "other" {
  if (finishReason === "length") return "length";
  if (finishReason === "content-filter") return "refusal";
  if (finishReason === "error") return "error";
  return "other";
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Whether a chunk's violations call for a revise turn. */
export function needsRevise(violations: Violation[]): boolean {
  return (
    violations.some((violation) => violation.severity === "hard") ||
    violations.filter((violation) => violation.severity === "soft").length >=
      REVISE_SOFT_MIN
  );
}

/** The revise turn's user message: what's wrong, and how to answer. */
export function buildReviseMessage(violations: Violation[]): string {
  const list = violations
    .map((violation) => `- ${violation.message}`)
    .join("\n");
  const message = `Some of that chunk needs fixing:\n\n${list}\n\nReply with only the corrected lines, in the grid format: the corrected P and B lines (same bar numbers), the HOLD block if the holding pattern was flagged, the F lines if the footer was flagged, then END. Everything you don't repeat stands.`;
  assertNoDeniedNames(message, "The revise message");
  return message;
}

type BarItem = Extract<GridItem, { type: "bar" }>;

/**
 * Applies a revise reply to a chunk: plan and bar lines replace those with
 * the same bar numbers; a HOLD block replaces the holding pattern; F lines
 * replace the footer. Everything else stands. Returns the new items and the
 * bars that were replaced.
 */
export function applyRevision(
  items: GridItem[],
  reply: GridItem[],
): { items: GridItem[]; replaced: BarItem[] } {
  const plans = new Map(
    reply.flatMap((item) =>
      item.type === "plan" ? [[item.bar, item] as const] : [],
    ),
  );
  const bars = new Map(
    reply.flatMap((item) =>
      item.type === "bar" ? [[item.bar, item] as const] : [],
    ),
  );
  const newHold = reply.some((item) => item.type === "hold-start")
    ? reply.filter(
        (item) => item.type === "hold-start" || item.type === "hold-bar",
      )
    : null;
  const footerTypes = new Set([
    "footer-state",
    "footer-summary",
    "footer-theme",
    "footer-drop",
    "footer-road",
  ]);
  const newFooter = reply.filter((item) => footerTypes.has(item.type));

  const result: GridItem[] = [];
  const replaced: BarItem[] = [];
  let holdDone = false;
  let footerDone = false;
  for (const item of items) {
    if (item.type === "plan") {
      result.push(plans.get(item.bar) ?? item);
    } else if (item.type === "bar") {
      const replacement = bars.get(item.bar);
      if (replacement) replaced.push(replacement);
      result.push(replacement ?? item);
    } else if (item.type === "hold-start" || item.type === "hold-bar") {
      if (!newHold) result.push(item);
      else if (!holdDone) {
        result.push(...newHold);
        holdDone = true;
      }
    } else if (footerTypes.has(item.type)) {
      if (newFooter.length === 0) result.push(item);
      else if (!footerDone) {
        result.push(...newFooter);
        footerDone = true;
      }
    } else if (item.type === "end") {
      if (newHold && !holdDone) result.push(...newHold);
      if (newFooter.length > 0 && !footerDone) result.push(...newFooter);
      holdDone = footerDone = true;
      result.push(item);
    } else {
      result.push(item);
    }
  }
  return { items: result, replaced };
}

/**
 * Composes one chunk: streams Claude's reply through the grid parser, checks
 * each bar as it arrives, checks the whole chunk, and if it needs it makes
 * one revise turn (the first reply resent unmodified, so its thinking
 * signatures stay valid, plus the violations). Then `chunk-complete`, or
 * `chunk-failed` if the model didn't finish. Every bar is exactly what Claude
 * wrote; code never edits notes (invariant 1). Stops without a final event
 * when `abortSignal` fires.
 */
export async function* composeChunk(
  options: ComposeChunkOptions,
): AsyncGenerator<ComposerEvent> {
  const now = options.now ?? (() => performance.now());
  const started = now();
  const shouldRevise = options.revise ?? true;

  const messages: ModelMessage[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: buildComposerMessage(options.context, { bars: options.bars }),
        },
      ],
      // A second, 5-minute breakpoint so a revise turn reads the whole prefix from cache.
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
  ];

  const call = (history: ModelMessage[]) =>
    streamText({
      model: options.model,
      instructions: {
        role: "system",
        content: COMPOSER_SYSTEM_PROMPT,
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } },
        },
      },
      messages: history,
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

  try {
    const first = call(messages);
    let text = "";
    let firstTokenMs: number | null = null;
    let firstBarMs: number | null = null;
    async function* deltas(): AsyncGenerator<string> {
      for await (const delta of first.textStream) {
        firstTokenMs ??= now() - started;
        text += delta;
        yield delta;
      }
    }

    let items: GridItem[] = [];
    for await (const item of parseGridStream(deltas(), options.abortSignal)) {
      const violations =
        item.type === "bar" ? checkArrivingBar(items, item) : [];
      if (item.type === "bar") firstBarMs ??= now() - started;
      items.push(item);
      yield { type: "item", item, violations };
    }
    if (options.abortSignal?.aborted) return;

    const finishReason = await first.finishReason;
    let usage = toUsage(await first.usage);
    if (finishReason !== "stop") {
      const timings: ChunkTimings = {
        firstTokenMs,
        firstBarMs,
        reviseMs: null,
        totalMs: now() - started,
      };
      yield {
        type: "chunk-failed",
        reason: failure(finishReason),
        text,
        usage,
        timings,
      };
      return;
    }

    let violations = checkComposedChunk(items);
    let revised = false;
    let reviseText: string | null = null;
    let reviseMs: number | null = null;

    if (shouldRevise && needsRevise(violations)) {
      const reviseStarted = now();
      const reply = await first.responseMessages;
      const second = call([
        ...messages,
        // Resent exactly as returned: editing it would invalidate its thinking signatures.
        ...reply,
        {
          role: "user",
          content: [{ type: "text", text: buildReviseMessage(violations) }],
        },
      ]);
      let secondText = "";
      async function* reviseDeltas(): AsyncGenerator<string> {
        for await (const delta of second.textStream) {
          secondText += delta;
          yield delta;
        }
      }
      const replyItems: GridItem[] = [];
      for await (const item of parseGridStream(
        reviseDeltas(),
        options.abortSignal,
        { revision: true },
      )) {
        replyItems.push(item);
      }
      if (options.abortSignal?.aborted) return;
      reviseMs = now() - reviseStarted;
      usage = addUsage(usage, toUsage(await second.usage));
      reviseText = secondText;

      // A revise that doesn't finish leaves the chunk as it was, still flagged.
      if ((await second.finishReason) === "stop") {
        const applied = applyRevision(items, replyItems);
        items = applied.items;
        violations = checkComposedChunk(items);
        revised = true;
        for (const bar of applied.replaced) {
          yield {
            type: "bar-revised",
            item: bar,
            violations: violations.filter(
              (v) => v.where.kind === "bar" && v.where.bar === bar.bar,
            ),
          };
        }
      }
    }

    yield {
      type: "chunk-complete",
      items,
      violations,
      revised,
      text,
      reviseText,
      usage,
      timings: { firstTokenMs, firstBarMs, reviseMs, totalMs: now() - started },
    };
  } catch (error) {
    if (options.abortSignal?.aborted || isAbort(error)) return;
    throw error;
  }
}
