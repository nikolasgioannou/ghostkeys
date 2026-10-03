import { describe, expect, it } from "vitest";

import { checkComposedChunk } from "../composer/check-all.ts";
import { timeChunk } from "../performance/timing.ts";
import { createGridLineParser } from "./line-parser.ts";
import { OPENING_CHUNK } from "./opening.fixture.ts";
import type { GridItem } from "./schema.ts";

function parse(text: string): GridItem[] {
  const parser = createGridLineParser();
  return text.split("\n").flatMap((line) => {
    const item = parser.line(line);
    return item ? [item] : [];
  });
}

describe("the opening fixture", () => {
  const items = parse(OPENING_CHUNK);

  it("parses as a whole chunk", () => {
    expect(items.filter((item) => item.type === "parse-error")).toEqual([]);
    expect(items[0]).toMatchObject({
      type: "header",
      meter: { numerator: 3, denominator: 4 },
      tempo: 63,
      key: { tonic: "Ab", mode: "major" },
    });
    const count = (type: GridItem["type"]) =>
      items.filter((item) => item.type === type).length;
    expect(count("plan")).toBe(16);
    expect(count("bar")).toBe(16);
    expect(count("hold-bar")).toBe(2);
    expect(count("footer-theme")).toBe(1);
    expect(items.at(-1)?.type).toBe("end");
  });

  it("passes every check", () => {
    expect(checkComposedChunk(items)).toEqual([]);
  });

  it("times into about 45 seconds of music", () => {
    const { bars, hold } = timeChunk(items);
    expect(bars).toHaveLength(16);
    expect(hold).toHaveLength(2);
    const seconds = bars.reduce((sum, bar) => sum + bar.durationSec, 0);
    expect(seconds).toBeGreaterThan(40);
    expect(seconds).toBeLessThan(50);
  });
});
