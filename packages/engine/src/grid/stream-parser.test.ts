import { describe, expect, it } from "vitest";

import { createGridLineParser } from "./line-parser.ts";
import type { GridItem } from "./schema.ts";
import { parseGridStream } from "./stream-parser.ts";
import { WORKED_EXAMPLE } from "./worked-example.fixture.ts";

async function* deltas(parts: string[]): AsyncGenerator<string> {
  for (const part of parts) {
    await Promise.resolve();
    yield part;
  }
}

async function collect(stream: AsyncIterable<GridItem>): Promise<GridItem[]> {
  const items: GridItem[] = [];
  for await (const item of stream) items.push(item);
  return items;
}

function parseWhole(text: string): GridItem[] {
  const parser = createGridLineParser();
  return text.split("\n").flatMap((line) => {
    const item = parser.line(line);
    return item ? [item] : [];
  });
}

describe("parseGridStream", () => {
  const expected = parseWhole(WORKED_EXAMPLE);

  it("gives the same items for every split of the worked example into two deltas", async () => {
    for (let cut = 0; cut <= WORKED_EXAMPLE.length; cut++) {
      const parts = [WORKED_EXAMPLE.slice(0, cut), WORKED_EXAMPLE.slice(cut)];
      expect(await collect(parseGridStream(deltas(parts)))).toEqual(expected);
    }
  });

  it("handles one-character deltas", async () => {
    expect(
      await collect(
        parseGridStream(
          deltas(
            Array.from(WORKED_EXAMPLE, (_, i) =>
              WORKED_EXAMPLE.slice(i, i + 1),
            ),
          ),
        ),
      ),
    ).toEqual(expected);
  });

  it("parses a final line that has no newline", async () => {
    const text = WORKED_EXAMPLE.trimEnd();
    expect(await collect(parseGridStream(deltas([text])))).toEqual(expected);
  });

  it("yields each item as soon as its line completes", async () => {
    const seen: string[] = [];
    async function* tracked(): AsyncGenerator<string> {
      await Promise.resolve();
      seen.push("delta 1");
      yield "CHUNK meter=4/4 tempo=72 key=C\nP1 key=C I";
      seen.push("delta 2");
      yield " dyn=p\n";
    }
    for await (const item of parseGridStream(tracked())) seen.push(item.type);
    expect(seen).toEqual(["delta 1", "header", "delta 2", "plan"]);
  });

  it("stops at the next delta once aborted, and closes the input", async () => {
    const controller = new AbortController();
    let closed = false;
    async function* endless(): AsyncGenerator<string> {
      try {
        await Promise.resolve();
        yield "CHUNK meter=4/4 tempo=72 key=C\n";
        for (;;) yield "P1 key=C I dyn=p\n";
      } finally {
        closed = true;
      }
    }
    const items: GridItem[] = [];
    for await (const item of parseGridStream(endless(), controller.signal)) {
      items.push(item);
      if (items.length === 3) controller.abort();
    }
    expect(items).toHaveLength(3);
    expect(closed).toBe(true);
  });
});
