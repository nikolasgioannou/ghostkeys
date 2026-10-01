import { describe, expect, it } from "vitest";

import { checkHarmony } from "../checks/harmony.ts";
import { checkChunk } from "../checks/playing-rules.ts";
import { createGridLineParser } from "../grid/line-parser.ts";
import type { GridItem } from "../grid/schema.ts";
import { TEXTURE_EXAMPLES } from "./texture-examples.ts";

function parse(text: string): GridItem[] {
  const parser = createGridLineParser();
  return text.split("\n").flatMap((line) => {
    const item = parser.line(line);
    return item ? [item] : [];
  });
}

/** A fragment has no HOLD block, footer or END by design. */
const FRAGMENT_RULES = new Set([
  "missing-hold",
  "missing-footer-state",
  "missing-summary",
  "missing-end",
]);

describe.each(
  TEXTURE_EXAMPLES.map((example) => [example.label, example] as const),
)("%s", (_, example) => {
  const items = parse(example.grid);

  it("parses cleanly", () => {
    expect(items.filter((item) => item.type === "parse-error")).toEqual([]);
    expect(
      items
        .filter((item) => item.type === "bar")
        .every((bar) => bar.error === null),
    ).toBe(true);
    expect(
      items.filter((item) => item.type === "bar").length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("breaks no playing rule", () => {
    expect(
      checkChunk(items).filter(
        (violation) => !FRAGMENT_RULES.has(violation.rule),
      ),
    ).toEqual([]);
  });

  it("has no hard harmony violation", () => {
    expect(
      checkHarmony(items).filter((violation) => violation.severity === "hard"),
    ).toEqual([]);
  });

  it("keeps its citation out of everything Claude sees", () => {
    const seen = `${example.label}\n${example.grid}`.toLowerCase();
    const surname =
      example.citation.composer.split(" ").at(-1)?.toLowerCase() ?? "";
    expect(surname).not.toBe("");
    expect(seen).not.toContain(surname);
    expect(seen).not.toContain("op.");
  });

  it("cites a public-domain source", () => {
    expect(example.citation.source).toMatch(
      /^https:\/\/www\.mutopiaproject\.org\//,
    );
    expect(example.citation.licence).toMatch(/^Public Domain/);
  });
});
