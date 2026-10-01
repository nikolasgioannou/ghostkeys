import { describe, expect, it } from "vitest";

import { createGridLineParser } from "../grid/line-parser.ts";
import type { GridItem } from "../grid/schema.ts";
import { WORKED_EXAMPLE } from "../grid/worked-example.fixture.ts";
import {
  DYNAMIC_VELOCITY,
  HAIRPIN_VELOCITY,
  RIT_END_FACTOR,
  timeChunk,
  TimedBarSchema,
} from "./timing.ts";

function parse(text: string): GridItem[] {
  const parser = createGridLineParser();
  return text.split("\n").flatMap((line) => {
    const item = parser.line(line);
    return item ? [item] : [];
  });
}

/** Seconds per beat at 66 quarters per minute. */
const BEAT = 60 / 66;

describe("timeChunk on the worked example", () => {
  const { bars, hold } = timeChunk(parse(WORKED_EXAMPLE));
  const [b1, b2, b3, b4] = bars;

  it("times every bar and the holding pattern, matching the schema", () => {
    expect(bars).toHaveLength(4);
    expect(hold).toHaveLength(2);
    for (const bar of [...bars, ...hold])
      expect(TimedBarSchema.parse(bar)).toEqual(bar);
  });

  it("converts slots to seconds at the written tempo", () => {
    expect(b1?.durationSec).toBeCloseTo(3 * BEAT);
    expect(b1?.notes.find((note) => note.midi === 77)).toMatchObject({
      offsetSec: 0,
      slot: 0,
    });
    expect(b1?.notes.find((note) => note.midi === 77)?.durSec).toBeCloseTo(
      2 * BEAT,
    );
    expect(b1?.notes.find((note) => note.midi === 75)?.offsetSec).toBeCloseTo(
      2 * BEAT,
    );
  });

  it("times triplets exactly", () => {
    const triplet = b2?.notes.filter(
      (note) =>
        note.hand === "right" &&
        [72, 73, 75].includes(note.midi) &&
        note.slot >= 12,
    );
    expect(triplet?.map((note) => note.offsetSec)).toEqual(
      [BEAT, (4 / 3) * BEAT, (5 / 3) * BEAT].map(
        (s) => expect.closeTo(s, 9) as number,
      ),
    );
  });

  it("gives velocities from the dynamics, with hairpins moving across the bar", () => {
    expect(
      b1?.notes.every((note) => note.velocity === DYNAMIC_VELOCITY.p),
    ).toBe(true);
    expect(
      b2?.notes.every((note) => note.velocity === DYNAMIC_VELOCITY.p),
    ).toBe(true);
    const crescendo =
      b3?.notes
        .filter((note) => note.hand === "left")
        .map((note) => note.velocity) ?? [];
    expect(crescendo[0]).toBe(DYNAMIC_VELOCITY.mp);
    expect(crescendo.at(-1)).toBeGreaterThan(DYNAMIC_VELOCITY.mp);
    expect(crescendo.at(-1)).toBeLessThan(
      DYNAMIC_VELOCITY.mp + HAIRPIN_VELOCITY,
    );
    const diminuendo =
      b4?.notes
        .filter((note) => note.hand === "left")
        .map((note) => note.velocity) ?? [];
    expect(diminuendo.at(-1)).toBeLessThan(diminuendo[0] ?? 0);
  });

  it("joins a tie into one longer note and doesn't strike the continuation", () => {
    const tied = b3?.notes.find((note) => note.midi === 80);
    expect(tied?.offsetSec).toBeCloseTo(2 * BEAT);
    expect(tied?.durSec).toBeGreaterThan(2 * BEAT);
    expect(b4?.notes.some((note) => note.midi === 80 && note.slot === 0)).toBe(
      false,
    );
  });

  it("slows a rit bar toward its end", () => {
    expect(b4?.durationSec).toBeGreaterThan(3 * BEAT);
    expect(b4?.durationSec).toBeLessThan((3 * BEAT) / RIT_END_FACTOR);
    const offsets =
      b4?.notes
        .filter((note) => note.hand === "left")
        .map((note) => note.offsetSec) ?? [];
    const gaps = offsets
      .slice(1)
      .map((offset, i) => offset - (offsets[i] ?? 0));
    expect(gaps.at(-1)).toBeGreaterThan(gaps[0] ?? 0);
  });

  it("turns pedal changes into up then down", () => {
    expect(b1?.pedal).toEqual([
      { kind: "up", offsetSec: 0 },
      { kind: "down", offsetSec: 0 },
    ]);
  });

  it("marks the melody and the phrase end", () => {
    expect(
      b3?.notes.filter((note) => note.melody).map((note) => note.midi),
    ).toEqual([82, 80]);
    expect(b4?.phraseEnd).toBe(true);
    expect(b1?.phraseEnd).toBe(false);
  });
});

describe("timeChunk tempo marks", () => {
  const chunk = (bar: string) =>
    timeChunk(
      parse(
        ["CHUNK meter=4/4 tempo=60 key=C", "P1 key=C I dyn=f", bar].join("\n"),
      ),
    ).bars[0];

  it("applies a new tempo from the bar's start", () => {
    expect(chunk("B1 R: C5@0:48 | L: - | t: q=120")?.durationSec).toBeCloseTo(
      2,
    );
  });

  it("holds a fermata for an extra beat", () => {
    const bar = chunk("B1 R: C5@0:24 D5@24:24 | L: - | t: fermata@12");
    expect(bar?.durationSec).toBeCloseTo(5);
    expect(bar?.notes[1]?.offsetSec).toBeCloseTo(3);
  });

  it("uses the dynamic's velocity", () => {
    expect(chunk("B1 R: C5@0:48 | L: -")?.notes[0]?.velocity).toBe(
      DYNAMIC_VELOCITY.f,
    );
  });
});
