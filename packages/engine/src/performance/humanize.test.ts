import { describe, expect, it } from "vitest";

import { createGridLineParser } from "../grid/line-parser.ts";
import type { GridItem } from "../grid/schema.ts";
import { WORKED_EXAMPLE } from "../grid/worked-example.fixture.ts";
import {
  humanize,
  JITTER_SEC,
  MELODY_BOOST,
  PEDAL_LAG_SEC,
  PHRASE_END_RUBATO,
  ROLL_STEP_SEC,
} from "./humanize.ts";
import { timeChunk, TimedBarSchema } from "./timing.ts";

function parse(text: string): GridItem[] {
  const parser = createGridLineParser();
  return text.split("\n").flatMap((line) => {
    const item = parser.line(line);
    return item ? [item] : [];
  });
}

const { bars } = timeChunk(parse(WORKED_EXAMPLE));

describe("humanize", () => {
  it("is deterministic: the same seed gives the same performance", () => {
    expect(humanize(bars, 7)).toEqual(humanize(bars, 7));
    expect(humanize(bars, 7)).not.toEqual(humanize(bars, 8));
  });

  it("keeps the timed-bar shape", () => {
    for (const bar of humanize(bars, 1))
      expect(TimedBarSchema.parse(bar)).toEqual(bar);
  });

  it("moves onsets only a little, never before the bar", () => {
    const performed = humanize(bars, 3);
    performed.forEach((bar, b) => {
      if (bar.phraseEnd) return;
      const original = bars[b]?.notes ?? [];
      for (const note of bar.notes) {
        const before = original.find(
          (n) =>
            n.midi === note.midi &&
            n.slot === note.slot &&
            n.hand === note.hand,
        );
        expect(note.offsetSec).toBeGreaterThanOrEqual(0);
        expect(
          Math.abs(note.offsetSec - (before?.offsetSec ?? 0)),
        ).toBeLessThanOrEqual(JITTER_SEC + 2 * ROLL_STEP_SEC + 1e-9);
      }
    });
  });

  it("makes the melody louder than the accompaniment at the same onset", () => {
    const [bar1] = humanize(bars, 1);
    const atDownbeat = bar1?.notes.filter((note) => note.slot === 0) ?? [];
    const melody = atDownbeat.find((note) => note.melody);
    const bass = atDownbeat.find((note) => !note.melody);
    expect(
      (melody?.velocity ?? 0) - (bass?.velocity ?? 0),
    ).toBeGreaterThanOrEqual(MELODY_BOOST);
  });

  it("rolls a chord from the bottom", () => {
    const [, , bar3] = humanize(bars, 1);
    const chord = (bar3?.notes ?? [])
      .filter((note) => note.hand === "right" && note.slot === 0)
      .toSorted((a, b) => a.midi - b.midi);
    expect(chord).toHaveLength(3);
    const [low, mid, high] = chord.map((note) => note.offsetSec);
    expect((mid ?? 0) - (low ?? 0)).toBeGreaterThan(0);
    expect((high ?? 0) - (mid ?? 0)).toBeGreaterThan(0);
  });

  it("broadens a phrase-end bar", () => {
    const [, , , bar4] = humanize(bars, 1);
    const original = bars[3]?.durationSec ?? 0;
    expect(bar4?.durationSec).toBeGreaterThan(original);
    expect(bar4?.durationSec).toBeLessThanOrEqual(
      original * (1 + PHRASE_END_RUBATO),
    );
    expect(humanize(bars, 1)[0]?.durationSec).toBe(bars[0]?.durationSec);
  });

  it("puts the pedal back down a moment after it comes up", () => {
    const [bar1] = humanize(bars, 1);
    expect(bar1?.pedal).toEqual([
      { kind: "up", offsetSec: 0 },
      { kind: "down", offsetSec: PEDAL_LAG_SEC },
    ]);
  });
});
