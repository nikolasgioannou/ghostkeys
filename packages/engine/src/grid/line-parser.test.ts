import { describe, expect, it } from "vitest";

import { createGridLineParser, parseRoman } from "./line-parser.ts";
import { type GridItem, GridItemSchema } from "./schema.ts";
import { WORKED_EXAMPLE } from "./worked-example.fixture.ts";

function parseAll(text: string): GridItem[] {
  const parser = createGridLineParser();
  return text.split("\n").flatMap((line) => {
    const item = parser.line(line);
    return item ? [item] : [];
  });
}

function only<T extends GridItem["type"]>(items: GridItem[], type: T) {
  return items.filter(
    (item): item is Extract<GridItem, { type: T }> => item.type === type,
  );
}

describe("the worked example", () => {
  const items = parseAll(WORKED_EXAMPLE);

  it("parses without errors, in block order", () => {
    expect(only(items, "parse-error")).toEqual([]);
    expect(items.map((item) => item.type)).toEqual([
      "header",
      ...Array<string>(4).fill("plan"),
      ...Array<string>(4).fill("bar"),
      "hold-start",
      "hold-bar",
      "hold-bar",
      "footer-state",
      "footer-summary",
      "footer-theme",
      "footer-road",
      "end",
    ]);
  });

  it("produces items that satisfy the schema", () => {
    for (const item of items) expect(GridItemSchema.parse(item)).toEqual(item);
  });

  it("keeps every line exactly as written", () => {
    const lines = WORKED_EXAMPLE.split("\n").filter((line) => line !== "");
    expect(items.map((item) => item.source)).toEqual(lines);
    expect(items.map((item) => item.line)).toEqual(
      lines.map((_, index) => index + 1),
    );
  });

  it("reads the header", () => {
    expect(items[0]).toMatchObject({
      type: "header",
      meter: { numerator: 3, denominator: 4 },
      tempo: 66,
      key: { tonic: "Db", mode: "major" },
    });
  });

  it("reads plan lines", () => {
    const [first, second, third, fourth] = only(items, "plan");
    expect(first).toMatchObject({
      bar: 1,
      key: { tonic: "Db", mode: "major" },
      chord: { kind: "degree", degree: 1, minor: false, figure: null },
      dynamic: { level: "p", hairpin: null },
      texture: "nocturne-arp",
      motif: { theme: "A", transform: "orig" },
      cadence: null,
      phraseEnd: false,
    });
    expect(second).toMatchObject({
      chord: { degree: 6, minor: true },
      motif: { transform: "seq" },
    });
    expect(second?.dynamic).toBeNull();
    expect(third?.dynamic).toEqual({ level: "mp", hairpin: "crescendo" });
    expect(fourth).toMatchObject({
      chord: { degree: 5, figure: "7" },
      cadence: "HC",
      phraseEnd: true,
      dynamic: { level: "mp", hairpin: "diminuendo" },
    });
  });

  it("reads notes, chords, triplets, ties, pedal and tempo marks", () => {
    const [b1, b2, b3, b4] = only(items, "bar");
    expect(b1?.body?.right).toEqual([
      { midi: 77, onset: 0, duration: 24, tie: false, melody: false },
      { midi: 75, onset: 24, duration: 6, tie: false, melody: false },
      { midi: 73, onset: 30, duration: 6, tie: false, melody: false },
    ]);
    expect(b1?.body?.left).toHaveLength(6);
    expect(b1?.body?.pedal).toEqual([{ kind: "change", slot: 0 }]);
    expect(b2?.body?.right.map((note) => [note.onset, note.duration])).toEqual([
      [0, 12],
      [12, 4],
      [16, 4],
      [20, 4],
      [24, 12],
    ]);
    expect(b3?.body?.right.slice(0, 3).map((note) => note.midi)).toEqual([
      73, 78, 82,
    ]);
    expect(b3?.body?.right[3]).toMatchObject({
      midi: 80,
      onset: 24,
      tie: true,
    });
    expect(b4?.body?.tempo).toEqual([{ kind: "rit" }]);
  });

  it("reads the footer", () => {
    expect(only(items, "footer-state")[0]).toMatchObject({
      key: { tonic: "Db" },
      chord: { degree: 5, figure: "7" },
      pedal: "down",
    });
    expect(only(items, "footer-summary")[0]?.text).toMatch(
      /^The nocturne opens in Db/,
    );
    expect(only(items, "footer-theme")[0]).toMatchObject({
      name: "A",
      bars: [[{ midi: 77 }, {}, {}]],
    });
    expect(only(items, "footer-road")[0]?.stops).toEqual([
      { key: { tonic: "Bb", mode: "minor" }, mood: "darker" },
      { key: { tonic: "Gb", mode: "major" }, mood: "warmer" },
      { key: { tonic: "Db", mode: "major" }, mood: "home" },
    ]);
  });
});

describe("malformed input", () => {
  const header = "CHUNK meter=4/4 tempo=72 key=C";
  const plan = "P1 key=C I dyn=p";

  function lastItem(...lines: string[]): GridItem | undefined {
    return parseAll(lines.join("\n")).at(-1);
  }

  it("ignores blank lines and code fences", () => {
    expect(
      parseAll(["```", "", header, "```text"].join("\n")).map(
        (item) => item.type,
      ),
    ).toEqual(["header"]);
  });

  it.each([
    ["an unknown line", [header, "Here is the chunk:"], /unrecognised line/],
    ["a line before the header", [plan], /CHUNK header first/],
    ["a second header", [header, header], /after the chunk started/],
    [
      "a plan line after the bars",
      [header, plan, "B1 R: - | L: -", "P2 key=C V"],
      /plan line after/,
    ],
    [
      "text after END",
      [header, plan, "B1 R: - | L: -", "END", "B2 R: - | L: -"],
      /after END/,
    ],
    [
      "a holding-pattern bar outside HOLD",
      [header, plan, "H1 R: - | L: -"],
      /outside the HOLD/,
    ],
    ["a bad meter", ["CHUNK meter=4/5 tempo=72 key=C"], /denominator/],
    ["a bad key", ["CHUNK meter=4/4 tempo=72 key=H"], /not a key/],
    [
      "a missing Roman numeral",
      [header, "P1 key=C dyn=p"],
      /missing the Roman numeral/,
    ],
    ["a bad Roman numeral", [header, "P1 key=C IIV"], /not a Roman numeral/],
    ["a half-diminished triad", [header, "P1 key=C viih"], /needs a seventh/],
    [
      "an unknown footer line",
      [header, plan, "B1 R: - | L: -", "F mood calm"],
      /unknown footer/,
    ],
  ])("reports %s with its line number", (_, lines, reason) => {
    const item = lastItem(...lines);
    expect(item).toMatchObject({ type: "parse-error", line: lines.length });
    expect(item?.type === "parse-error" ? item.reason : "").toMatch(reason);
  });

  it.each([
    ["a bad pitch", "B1 R: H4@0:48 | L: -", /not a note/],
    ["a missing left hand", "B1 R: C5@0:48", /second section is "L: "/],
    [
      "notes out of order",
      "B1 R: C5@24:24 D5@0:24 | L: -",
      /out of onset order/,
    ],
    ["a zero-length note", "B1 R: C5@0:0 | L: -", /zero-length/],
    ["a bad pedal event", "B1 R: - | L: - | ped: x4", /pedal event/],
    ["an unknown section", "B1 R: - | L: - | dyn: p", /unknown bar section/],
  ])("emits %s as an invalid bar, so it can be revised", (_, line, reason) => {
    const item = lastItem(header, plan, line);
    expect(item).toMatchObject({ type: "bar", bar: 1, body: null });
    expect(item?.type === "bar" ? item.error : "").toMatch(reason);
  });

  it("carries on after a bad line", () => {
    const items = parseAll(
      [header, plan, "B1 R: oops | L: -", "B2 R: C5@0:48 | L: C3@0:48"].join(
        "\n",
      ),
    );
    expect(items.at(-1)).toMatchObject({ type: "bar", bar: 2, error: null });
  });

  it("reads ties and melody marks in either order", () => {
    const item = lastItem(header, plan, "B1 R: C5@0:48~! | L: C3@0:48!~");
    expect(item?.type === "bar" ? item.body : null).toMatchObject({
      right: [{ tie: true, melody: true }],
      left: [{ tie: true, melody: true }],
    });
  });

  it("parses a chunk that stops without a footer (a chunk-level check catches it)", () => {
    const items = parseAll(
      [header, plan, "B1 R: C5@0:48 | L: C3@0:48"].join("\n"),
    );
    expect(only(items, "parse-error")).toEqual([]);
  });
});

describe("parseRoman", () => {
  it.each([
    [
      "V7/V",
      { degree: 5, figure: "7", secondary: { degree: 5, minor: false } },
    ],
    ["viio7", { degree: 7, minor: true, quality: "diminished", figure: "7" }],
    ["iih7", { degree: 2, quality: "half-diminished", figure: "7" }],
    ["bVI", { accidental: "b", degree: 6, minor: false }],
    ["iv6", { degree: 4, minor: true, figure: "6" }],
    ["V65/ii", { figure: "65", secondary: { degree: 2, minor: true } }],
    ["III+", { degree: 3, quality: "augmented" }],
  ])("reads %s", (text, expected) => {
    expect(parseRoman(text)).toMatchObject({
      kind: "degree",
      text,
      ...expected,
    });
  });

  it.each(["N6", "It6", "Fr6", "Ger6"])("reads the named chord %s", (text) => {
    expect(parseRoman(text)).toEqual({ kind: "named", text, chord: text });
  });
});
