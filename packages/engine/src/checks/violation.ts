import { z } from "zod";

/**
 * A problem the checkers found. The same shape for every checker (playing
 * rules, harmony, copy check), so the revise turn can list them together.
 * `message` is written to go straight into the revise prompt.
 */
export const ViolationSchema = z.object({
  rule: z.string(),
  /** `hard` always triggers a revise; `soft` only above a threshold. */
  severity: z.enum(["hard", "soft"]),
  /** Where it is: a bar of the chunk, a bar of the holding pattern, or the chunk as a whole. */
  where: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("bar"), bar: z.int().min(1) }),
    z.object({ kind: z.literal("hold"), bar: z.int().min(1) }),
    z.object({ kind: z.literal("chunk") }),
  ]),
  hand: z.enum(["right", "left"]).nullable(),
  message: z.string(),
});
export type Violation = z.infer<typeof ViolationSchema>;
