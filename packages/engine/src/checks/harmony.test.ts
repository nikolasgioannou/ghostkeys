import { describe, expect, it } from "vitest";

import {
  createGridLineParser,
  parseKey,
  parseRoman,
} from "../grid/line-parser.ts";
import type { GridItem } from "../grid/schema.ts";
import { WORKED_EXAMPLE } from "../grid/worked-example.fixture.ts";
import { pitchToMidi } from "../pitch.ts";
import { beatLength, checkHarmony, chordPitchClasses } from "./harmony.ts";

function parse(text: string): GridItem[] {
  const parser = createGridLineParser();
  return text.split("\n").flatMap((line) => {
    const item = parser.line(line);
    return item ? [item] : [];
  });
}

const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

/** The pitch classes of a chord as note names, lowest pitch class first. */
function chord(roman: string, key: string): string[] {
  return [...chordPitchClasses(parseRoman(roman), parseKey(key))]
    .sort((a, b) => a - b)
    .map((pc) => NAMES[pc] ?? "");
}

const byPitchClass = (names: string[]) =>
  [...names].sort((a, b) => NAMES.indexOf(a) - NAMES.indexOf(b));

describe("chordPitchClasses", () => {
  it.each([
    ["I", "C", ["C", "E", "G"]],
    ["ii", "C", ["D", "F", "A"]],
    ["V7", "C", ["D", "F", "G", "B"]],
    ["viio7", "C", ["D", "F", "Ab", "B"]],
    ["iih7", "C", ["C", "D", "F", "Ab"]],
    ["IVmaj7", "C", ["C", "E", "F", "A"]],
    ["bVI", "C", ["C", "Eb", "Ab"]],
    ["iv6", "C", ["C", "F", "Ab"]],
    ["V7/V", "C", ["C", "D", "F#", "A"]],
    ["viio7/V", "C", ["C", "Eb", "F#", "A"]],
    ["V/ii", "C", ["C#", "E", "A"]],
    ["III+", "C", ["C", "E", "Ab"]],
    ["N6", "C", ["C#", "F", "Ab"]],
    ["It6", "C", ["C", "F#", "Ab"]],
    ["Fr6", "C", ["C", "D", "F#", "Ab"]],
    ["Ger6", "C", ["C", "Eb", "F#", "Ab"]],
    ["i", "Am", ["C", "E", "A"]],
    ["V7", "Am", ["D", "E", "Ab", "B"]],
    ["viio7", "Am", ["D", "F", "Ab", "B"]],
    ["VII", "Am", ["D", "G", "B"]],
    ["VI", "Am", ["C", "F", "A"]],
    ["IV", "Db", ["C#", "F#", "Bb"]],
    ["bVI", "Fm", ["C#", "F", "Ab"]],
    ["bIII", "Am", ["C", "E", "G"]],
    ["bVII", "Am", ["D", "G", "B"]],
    ["bII", "Am", ["D", "F", "Bb"]],
    ["#iv", "Am", ["Eb", "F#", "Bb"]],
  ])("%s in %s", (roman, key, expected) => {
    expect(chord(roman, key)).toEqual(byPitchClass(expected));
  });
});

describe("beatLength", () => {
  it("is the beat unit, or a dotted quarter in compound meters", () => {
    expect(beatLength({ numerator: 4, denominator: 4 })).toBe(12);
    expect(beatLength({ numerator: 3, denominator: 4 })).toBe(12);
    expect(beatLength({ numerator: 2, denominator: 2 })).toBe(24);
    expect(beatLength({ numerator: 6, denominator: 8 })).toBe(18);
    expect(beatLength({ numerator: 3, denominator: 8 })).toBe(6);
  });
});

describe("checkHarmony", () => {
  const chunk = (
    plan: string,
    bar: string,
    previous?: { plan: string; bar: string },
  ) =>
    parse(
      [
        "CHUNK meter=4/4 tempo=72 key=C",
        ...(previous ? [previous.plan] : []),
        plan,
        ...(previous ? [previous.bar] : []),
        bar,
      ].join("\n"),
    );

  it("passes the worked example", () => {
    expect(checkHarmony(parse(WORKED_EXAMPLE))).toEqual([]);
  });

  it("passes diatonic chords", () => {
    expect(
      checkHarmony(
        chunk(
          "P1 key=C I dyn=p",
          "B1 R: E5@0:24 G5@24:24 | L: C3@0:12 G3@12:12 E3@24:12 G3@36:12",
        ),
      ),
    ).toEqual([]);
  });

  it("passes a secondary dominant with its chromatic note", () => {
    expect(
      checkHarmony(
        chunk(
          "P1 key=C V7/V dyn=p",
          "B1 R: F#5@0:24 A5@24:24 | L: D3@0:24 C4@24:24",
        ),
      ),
    ).toEqual([]);
  });

  it("passes an augmented sixth", () => {
    expect(
      checkHarmony(
        chunk(
          "P1 key=Am Ger6 dyn=p",
          "B1 R: D#5@0:48 | L: F2@0:24 A3+C4@24:24",
        ),
      ),
    ).toEqual([]);
  });

  it("passes a bar full of weak-slot passing and neighbour tones", () => {
    const bar =
      "B1 R: C5@0:3 D5@3:3 E5@6:3 F5@9:3 G5@12:3 A5@15:3 B5@18:3 C6@21:3 E5@24:6 F#5@30:6 G5@36:12 | L: C3@0:48";
    expect(checkHarmony(chunk("P1 key=C I dyn=p", bar))).toEqual([]);
  });

  it("doesn't count a suspension tied over the barline", () => {
    const previous = {
      plan: "P1 key=C I dyn=p",
      bar: "B1 R: C5@0:24 F5@24:24~ | L: C3@0:48",
    };
    expect(
      checkHarmony(
        chunk(
          "P2 key=C V",
          "B2 R: F5@0:12 D5@12:12 B4@24:24 | L: G2@0:48",
          previous,
        ),
      ),
    ).toEqual([]);
  });

  it("flags a bar written in the wrong key as hard", () => {
    const [violation] = checkHarmony(
      chunk(
        "P1 key=C I dyn=p",
        "B1 R: F#5@0:24 C#6@24:24 | L: D#3@0:24 A#3@24:24",
      ),
    );
    expect(violation).toMatchObject({
      rule: "harmony",
      severity: "hard",
      where: { kind: "bar", bar: 1 },
    });
    expect(violation?.message).toMatch(/aren't in the planned I in C/);
  });

  it("flags a bar with some wrong notes on the beat as soft", () => {
    const [violation] = checkHarmony(
      chunk(
        "P1 key=C I dyn=p",
        "B1 R: E5@0:12 D5@12:12 F5@24:12 A5@36:12 | L: C3@0:24 E3@24:24",
      ),
    );
    expect(violation).toMatchObject({ severity: "soft" });
  });

  it("checks against the bar's local key", () => {
    expect(
      checkHarmony(
        chunk("P1 key=G I dyn=p", "B1 R: B5@0:24 D6@24:24 | L: G2@0:48"),
      ),
    ).toEqual([]);
    expect(pitchToMidi("G2")).toBe(43);
  });
});
