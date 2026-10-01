import {
  ChunkTimingsSchema,
  ChunkUsageSchema,
  ComposerEventSchema,
  GridItemSchema,
  ViolationSchema,
} from "@ghostkeys/engine";
import { z } from "zod";

/**
 * One bake-off run: a session of chunks composed with one variant
 * (docs/design.md → Bake-off). Written by the runner, read by the listening
 * page, built from the engine's own schemas (invariant 5).
 */

export const VariantSchema = z.enum(["A", "B", "C"]);
export type Variant = z.infer<typeof VariantSchema>;

export const VARIANT_NAMES: Record<Variant, string> = {
  A: "interleaved ABC + thinking",
  B: "plan + grid",
  C: "plan + grid + check + revise",
};

export const ChunkRecordSchema = z.object({
  index: z.int().min(0),
  bars: z.int().min(1),
  steeringNote: z.string().nullable(),
  /** How many calls it took (a failed chunk is tried again once). */
  attempts: z.int().min(1),
  outcome: z.enum(["complete", "failed"]),
  /** Every event the composer emitted, in order. */
  events: z.array(ComposerEventSchema),
  /** The final items (after any revise). */
  items: z.array(GridItemSchema),
  /** The raw text of every model call. */
  texts: z.array(z.string()),
  /** What the checks found before any revise, and what still fails after it. */
  violationsBefore: z.array(ViolationSchema),
  violationsAfter: z.array(ViolationSchema),
  revised: z.boolean(),
  usage: ChunkUsageSchema,
  timings: ChunkTimingsSchema,
  /** The chunk's music, in seconds (bars only, not the holding pattern). */
  musicSec: z.number().min(0),
  /** Generation time (including any revise) ÷ music duration. Below 1 keeps ahead of playback. */
  realTimeFactor: z.number().nullable(),
  /** Variant A only: bars that parsed and converted cleanly from ABC. */
  validBars: z.int().min(0).nullable(),
});
export type ChunkRecord = z.infer<typeof ChunkRecordSchema>;

export const RunFileSchema = z.object({
  variant: VariantSchema,
  session: z.int().min(1),
  effort: z.enum(["low", "medium", "high", "xhigh", "max"]),
  barsPerChunk: z.int().min(1),
  mock: z.boolean(),
  startedAt: z.string(),
  chunks: z.array(ChunkRecordSchema),
});
export type RunFile = z.infer<typeof RunFileSchema>;
