import { checkChunk } from "@ghostkeys/engine";
import { describe, expect, it } from "vitest";

import { abcReplyToItems, convertAbc, runAbcSession } from "./abc.ts";
import { mockAbcText, mockModel } from "./mock.ts";
import { RunFileSchema } from "./run-file.ts";

const HEADER =
  "X:1\nM:3/4\nL:1/8\nQ:1/4=66\nK:Bbm\nV:RH clef=treble\nV:LH clef=bass";

describe("convertAbc", () => {
  it("converts exact rhythms, chords, triplets, ties and dynamics into grid bars", () => {
    const converted = convertAbc(
      `${HEADER}\n[V:RH] !p! f4 ed | (3cde f4 | !mf! [Fdf]6- | f6 |\n[V:LH] D,,A,, F,A, DA, | B,,,F,, D,F, B,2 | F,,6 | F,,6 |`,
    );
    expect(converted).toMatchObject({
      meter: { numerator: 3, denominator: 4 },
      tempo: 66,
      key: { tonic: "Bb", mode: "minor" },
      dynamics: ["p", null, "mf", null],
    });
    const [b1, b2, b3, b4] = converted?.bars ?? [];
    expect(
      b1?.body?.right.map((note) => [note.midi, note.onset, note.duration]),
    ).toEqual([
      [77, 0, 24],
      [75, 24, 6],
      [73, 30, 6],
    ]);
    expect(
      b2?.body?.right.slice(0, 3).map((note) => [note.onset, note.duration]),
    ).toEqual([
      [0, 4],
      [4, 4],
      [8, 4],
    ]);
    expect(
      b3?.body?.right.filter((note) => note.tie).map((note) => note.midi),
    ).toEqual([77]);
    expect(b4?.body?.right).toEqual([
      { midi: 77, onset: 0, duration: 36, tie: false, melody: false },
    ]);
    expect(b1?.body?.left).toHaveLength(6);
  });

  it("marks a bar invalid rather than rounding a rhythm the grid can't hold", () => {
    const converted = convertAbc(
      `${HEADER}\n[V:RH] (5cdefg f2 f2 | f6 |\n[V:LH] D,6 | D,6 |`,
    );
    expect(converted?.bars[0]).toMatchObject({ body: null });
    expect(converted?.bars[0]?.error).toMatch(/doesn't land on a grid slot/);
    expect(converted?.bars[1]?.error).toBeNull();
  });

  it("returns null for ABC without a meter or key", () => {
    expect(convertAbc("X:1\nL:1/8\n[V:RH] f6 |")).toBeNull();
  });
});

describe("abcReplyToItems", () => {
  it("turns a whole reply into chunk items that pass the playing rules", () => {
    const { items, validBars, totalBars } = abcReplyToItems(mockAbcText(4, 0));
    expect(validBars).toBe(4);
    expect(totalBars).toBe(4);
    expect(items.filter((item) => item.type === "hold-bar")).toHaveLength(2);
    expect(items.some((item) => item.type === "footer-summary")).toBe(true);
    expect(items.at(-1)?.type).toBe("end");
    expect(checkChunk(items)).toEqual([]);
  });
});

describe("runAbcSession (mock)", () => {
  it("writes a valid run file with every bar converted", async () => {
    const run = await runAbcSession({
      session: 1,
      model: mockModel(8, "abc"),
      chunks: 3,
      barsPerChunk: 8,
      effort: "low",
      mock: true,
    });
    expect(RunFileSchema.parse(run)).toEqual(run);
    expect(run.variant).toBe("A");
    expect(run.chunks.map((chunk) => chunk.validBars)).toEqual([8, 8, 8]);
    expect(run.chunks.every((chunk) => chunk.musicSec > 0)).toBe(true);
  });
});
