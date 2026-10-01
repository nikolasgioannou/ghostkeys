import { z } from "zod";

import { ViolationSchema } from "../checks/violation.ts";
import { GridItemSchema } from "../grid/schema.ts";

/**
 * What the composer emits while it writes a chunk (docs/design.md → Stream
 * events). **Playability rule:** a chunk is playable only after
 * `chunk-complete`. `item` events before it are progress, not music.
 */

export const ChunkUsageSchema = z.object({
  inputTokens: z.number().nullable(),
  cacheReadTokens: z.number().nullable(),
  cacheWriteTokens: z.number().nullable(),
  outputTokens: z.number().nullable(),
  reasoningTokens: z.number().nullable(),
});
export type ChunkUsage = z.infer<typeof ChunkUsageSchema>;

export const ChunkTimingsSchema = z.object({
  /** From the request to the first text delta. */
  firstTokenMs: z.number().nullable(),
  /** From the request to the first complete bar. */
  firstBarMs: z.number().nullable(),
  totalMs: z.number(),
});
export type ChunkTimings = z.infer<typeof ChunkTimingsSchema>;

export const ComposerEventSchema = z.discriminatedUnion("type", [
  /** One parsed line, as soon as it's complete. Bars carry what the per-bar checks found. */
  z.object({
    type: z.literal("item"),
    item: GridItemSchema,
    violations: z.array(ViolationSchema),
  }),
  /** The whole chunk, checked. Only now is it playable. */
  z.object({
    type: z.literal("chunk-complete"),
    items: z.array(GridItemSchema),
    violations: z.array(ViolationSchema),
    text: z.string(),
    usage: ChunkUsageSchema,
    timings: ChunkTimingsSchema,
  }),
  /** The model stopped for a reason other than finishing (too long, a refusal, an error). */
  z.object({
    type: z.literal("chunk-failed"),
    reason: z.enum(["length", "refusal", "error", "other"]),
    text: z.string(),
    usage: ChunkUsageSchema,
    timings: ChunkTimingsSchema,
  }),
]);
export type ComposerEvent = z.infer<typeof ComposerEventSchema>;
