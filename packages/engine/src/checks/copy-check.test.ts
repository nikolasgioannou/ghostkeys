import { describe, expect, it } from "vitest";

import { TEXTURE_EXAMPLES } from "../composer/texture-examples.ts";
import { createGridLineParser } from "../grid/line-parser.ts";
import type { GridItem } from "../grid/schema.ts";
import { WORKED_EXAMPLE } from "../grid/worked-example.fixture.ts";
import { midiToPitch, pitchToMidi } from "../pitch.ts";
import { checkCopies } from "./copy-check.ts";

function parse(text: string): GridItem[] {
  const parser = createGridLineParser();
  return text.split("\n").flatMap((line) => {
    const item = parser.line(line);
    return item ? [item] : [];
  });
}

/** Moves every pitch in the bar lines by `semitones`. */
function transpose(grid: string, semitones: number): string {
  return grid
    .split("\n")
    .map((line) =>
      line.startsWith("B")
        ? line.replace(
            /\b([A-G][#b]?[0-8])(?=[@+])/g,
            (pitch) =>
              midiToPitch((pitchToMidi(pitch) ?? 60) + semitones) ?? pitch,
          )
        : line,
    )
    .join("\n");
}

describe("checkCopies", () => {
  it.each(TEXTURE_EXAMPLES.map((example) => [example.label, example] as const))(
    "catches %s pasted verbatim",
    (_, example) => {
      const violations = checkCopies(parse(example.grid));
      expect(
        violations.some((v) => v.rule === "copy" && v.severity === "hard"),
      ).toBe(true);
      expect(violations.map((v) => v.message).join("\n")).toContain(
        example.label,
      );
    },
  );

  it.each(TEXTURE_EXAMPLES.map((example) => [example.label, example] as const))(
    "catches %s transposed",
    (_, example) => {
      expect(checkCopies(parse(transpose(example.grid, 3)))).not.toEqual([]);
    },
  );

  it("passes the worked example", () => {
    expect(checkCopies(parse(WORKED_EXAMPLE))).toEqual([]);
  });

  it("passes an original waltz in the same texture", () => {
    const original = `CHUNK meter=3/4 tempo=152 key=Bm
P1 key=Bm i dyn=p tex=waltz
P2 key=Bm iv6
P3 key=Bm V7
P4 key=Bm i
B1 R: D5@0:12 E5@12:6 F#5@18:6 B5@24:12 | L: B2@0:12 F#3+B3+D4@12:12 F#3+B3+D4@24:12
B2 R: A5@0:12 G5@12:12 E5@24:12 | L: B2@0:12 G3+B3+E4@12:12 G3+B3+E4@24:12
B3 R: F#5@0:18 E5@18:6 C#5@24:12 | L: F#2@0:12 E3+A#3+C#4@12:12 E3+A#3+C#4@24:12
B4 R: D5@0:24 B4@24:12 | L: B2@0:12 F#3+B3+D4@12:12 F#3+B3+D4@24:12`;
    expect(checkCopies(parse(original))).toEqual([]);
  });

  it("doesn't flag a repeated pedal note in the bass", () => {
    const pedal = `CHUNK meter=6/8 tempo=144 key=Fm
P1 key=Fm i dyn=p
${[1, 2, 3, 4, 5, 6]
  .map((bar) => `B${String(bar)} R: Ab4@0:36 | L: F2@0:18 F2@18:18`)
  .join("\n")}`;
    expect(checkCopies(parse(pedal))).toEqual([]);
  });

  it("names the bars and the hand", () => {
    const [violation] = checkCopies(parse(TEXTURE_EXAMPLES[2]?.grid ?? ""));
    expect(violation).toMatchObject({
      where: { kind: "bar", bar: 1 },
      hand: "right",
    });
    expect(violation?.message).toMatch(/^Bars 1–4: the melody copies/);
  });
});
