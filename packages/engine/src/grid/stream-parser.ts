import { createGridLineParser } from "./line-parser.ts";
import type { GridItem } from "./schema.ts";

/**
 * Parses grid text as it streams in. Claude's output arrives as text deltas
 * that split lines anywhere, so this buffers partial lines and feeds the
 * line parser one complete line at a time, yielding each item as soon as its
 * line is complete. A trailing line without a newline is parsed when the
 * stream ends. Takes plain text, so it doesn't depend on the AI SDK.
 *
 * When `signal` aborts, iteration stops at the next delta and the input
 * iterator is closed.
 */
export async function* parseGridStream(
  deltas: AsyncIterable<string>,
  signal?: AbortSignal,
): AsyncGenerator<GridItem> {
  const parser = createGridLineParser();
  let pending = "";

  for await (const delta of deltas) {
    if (signal?.aborted) return;
    pending += delta;
    let newline = pending.indexOf("\n");
    while (newline >= 0) {
      const item = parser.line(pending.slice(0, newline));
      pending = pending.slice(newline + 1);
      if (item) yield item;
      newline = pending.indexOf("\n");
    }
  }

  if (signal?.aborted) return;
  if (pending !== "") {
    const item = parser.line(pending);
    if (item) yield item;
  }
}
