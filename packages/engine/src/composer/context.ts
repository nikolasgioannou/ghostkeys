import { z } from "zod";

/**
 * What the composer is told about where the piece is (docs/design.md → Piece
 * state & data model). Everything musical in it was written by Claude, kept
 * as Claude wrote it; code only carries it forward. An empty context is a
 * fresh piece. Chunk length isn't part of it: like effort, it's an option of
 * each call.
 */
export const ThemeSchema = z.object({
  name: z.string(),
  /** The theme's `F theme` notes, as Claude wrote them. */
  notes: z.string(),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const ComposerContextSchema = z.object({
  /**
   * Where the music should head, in idiom, texture and mood terms. Written by
   * code or the conductor, never the listener's own words.
   */
  steeringNote: z.string().nullable(),
  /** The previous chunk's `CHUNK` header line, or `null` for a fresh piece. */
  previousHeader: z.string().nullable(),
  /** The last bars before this chunk: their `P` and `B` lines as written. */
  previousBars: z.array(z.string()),
  /** The previous chunk's `F key=… chord=… ped=…` line. */
  previousFooter: z.string().nullable(),
  /** The theme bank (at most 5). */
  themes: z.array(ThemeSchema).max(5),
  /** The roadmap: the previous chunk's `F road` line. */
  roadmap: z.string().nullable(),
  /** What has happened so far, a few sentences. */
  summary: z.string(),
});
export type ComposerContext = z.infer<typeof ComposerContextSchema>;

export const EMPTY_CONTEXT: ComposerContext = {
  steeringNote: null,
  previousHeader: null,
  previousBars: [],
  previousFooter: null,
  themes: [],
  roadmap: null,
  summary: "",
};
