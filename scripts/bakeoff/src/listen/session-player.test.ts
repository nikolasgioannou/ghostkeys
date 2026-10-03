import { describe, expect, it } from "vitest";

import { sustain, type TimelineNote } from "./session-player.ts";

const note = (time: number, duration: number): TimelineNote => ({
  time,
  note: 60,
  velocity: 64,
  duration,
});

describe("sustain", () => {
  it("holds a note released under the pedal until the pedal comes up", () => {
    const pedal = [
      { time: 0, down: true },
      { time: 3, down: false },
    ];
    expect(sustain([note(0.5, 1)], pedal)[0]?.duration).toBe(2.5);
  });

  it("leaves a note alone when the pedal is up at its release", () => {
    const pedal = [
      { time: 0, down: true },
      { time: 1, down: false },
    ];
    expect(sustain([note(1.5, 1)], pedal)[0]?.duration).toBe(1);
  });

  it("ends a note at a pedal change on its release, not the next one", () => {
    const pedal = [
      { time: 0, down: true },
      { time: 2, down: false },
      { time: 2, down: true },
      { time: 4, down: false },
    ];
    expect(
      sustain([note(0, 2), note(0, 1)], pedal).map((n) => n.duration),
    ).toEqual([2, 2]);
  });
});
