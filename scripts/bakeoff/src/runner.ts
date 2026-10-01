import {
  checkComposedChunk,
  type ChunkUsage,
  type ComposerContext,
  type ComposerEvent,
  EMPTY_CONTEXT,
  type GridItem,
  nextContext,
  timeChunk,
} from "@ghostkeys/engine";
import { composeChunk, type Effort } from "@ghostkeys/engine/llm";
import type { LanguageModel } from "ai";

import type { ChunkRecord, RunFile, Variant } from "./run-file.ts";

/** The steering note set at chunk 3 of every session (there's no conductor yet). */
export const SCRIPTED_STEERING =
  "Slowly grow darker and slower over this chunk and the next.";
/** The chunk (0-based) the steering note starts at. */
export const STEERING_CHUNK = 2;

export interface SessionOptions {
  variant: Variant;
  session: number;
  model: LanguageModel;
  chunks: number;
  barsPerChunk: number;
  effort: Effort;
  mock: boolean;
  /** Called after each chunk, for progress output. */
  onChunk?: (record: ChunkRecord) => void;
  now?: () => number;
}

const NO_USAGE: ChunkUsage = {
  inputTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  outputTokens: null,
  reasoningTokens: null,
};

function musicSeconds(items: GridItem[]): number {
  return timeChunk(items).bars.reduce((sum, bar) => sum + bar.durationSec, 0);
}

/** Runs one session: `chunks` chunks with continuity between them, steered at chunk 3. */
export async function runSession(options: SessionOptions): Promise<RunFile> {
  const run: RunFile = {
    variant: options.variant,
    session: options.session,
    effort: options.effort,
    barsPerChunk: options.barsPerChunk,
    mock: options.mock,
    startedAt: new Date().toISOString(),
    chunks: [],
  };
  let context: ComposerContext = EMPTY_CONTEXT;

  for (let index = 0; index < options.chunks; index++) {
    if (index === STEERING_CHUNK)
      context = { ...context, steeringNote: SCRIPTED_STEERING };
    let record: ChunkRecord | null = null;

    for (
      let attempt = 1;
      attempt <= 2 && record?.outcome !== "complete";
      attempt++
    ) {
      const events: ComposerEvent[] = [];
      const stream = composeChunk({
        model: options.model,
        context,
        bars: options.barsPerChunk,
        effort: options.effort,
        revise: options.variant === "C",
        ...(options.now ? { now: options.now } : {}),
      });
      for await (const event of stream) events.push(event);
      const last = events.at(-1);
      const firstItems = events.flatMap((event) =>
        event.type === "item" ? [event.item] : [],
      );

      if (last?.type === "chunk-complete") {
        const musicSec = musicSeconds(last.items);
        record = {
          index,
          bars: options.barsPerChunk,
          steeringNote: context.steeringNote,
          attempts: attempt,
          outcome: "complete",
          events,
          items: last.items,
          texts: [
            last.text,
            ...(last.reviseText === null ? [] : [last.reviseText]),
          ],
          violationsBefore: checkComposedChunk(firstItems),
          violationsAfter: last.violations,
          revised: last.revised,
          usage: last.usage,
          timings: last.timings,
          musicSec,
          realTimeFactor:
            musicSec > 0 ? last.timings.totalMs / 1000 / musicSec : null,
          validBars: null,
        };
      } else {
        record = {
          index,
          bars: options.barsPerChunk,
          steeringNote: context.steeringNote,
          attempts: attempt,
          outcome: "failed",
          events,
          items: firstItems,
          texts: last?.type === "chunk-failed" ? [last.text] : [],
          violationsBefore: checkComposedChunk(firstItems),
          violationsAfter: [],
          revised: false,
          usage: last?.type === "chunk-failed" ? last.usage : NO_USAGE,
          timings:
            last?.type === "chunk-failed"
              ? last.timings
              : {
                  firstTokenMs: null,
                  firstBarMs: null,
                  reviseMs: null,
                  totalMs: 0,
                },
          musicSec: 0,
          realTimeFactor: null,
          validBars: null,
        };
      }
    }

    if (!record) break;
    run.chunks.push(record);
    options.onChunk?.(record);
    if (record.outcome !== "complete") break;
    context = nextContext(context, { items: record.items });
  }
  return run;
}
