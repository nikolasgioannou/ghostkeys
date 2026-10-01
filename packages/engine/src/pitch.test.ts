import { describe, expect, it } from "vitest";

import {
  isOnPiano,
  midiToPitch,
  PIANO_HIGHEST_MIDI,
  PIANO_LOWEST_MIDI,
  pitchToMidi,
} from "./pitch.ts";

describe("pitchToMidi", () => {
  it("puts middle C at 60 and A4 at 69", () => {
    expect(pitchToMidi("C4")).toBe(60);
    expect(pitchToMidi("A4")).toBe(69);
  });

  it("covers the piano's range", () => {
    expect(pitchToMidi("A0")).toBe(PIANO_LOWEST_MIDI);
    expect(pitchToMidi("C8")).toBe(PIANO_HIGHEST_MIDI);
  });

  it("applies sharps and flats", () => {
    expect(pitchToMidi("F#3")).toBe(54);
    expect(pitchToMidi("Gb3")).toBe(54);
    expect(pitchToMidi("Bb5")).toBe(82);
  });

  it("lets accidentals cross the octave line", () => {
    expect(pitchToMidi("B3")).toBe(59);
    expect(pitchToMidi("Cb4")).toBe(59);
    expect(pitchToMidi("B#3")).toBe(60);
  });

  it.each([
    "c4",
    "H4",
    "C##4",
    "Cbb4",
    "C♯4",
    "C9",
    "C-1",
    "C",
    "4",
    "",
    " C4",
    "C4 ",
  ])("rejects %j", (text) => {
    expect(pitchToMidi(text)).toBeNull();
  });
});

describe("midiToPitch", () => {
  it("round-trips every key on the piano, with sharps and with flats", () => {
    for (let midi = PIANO_LOWEST_MIDI; midi <= PIANO_HIGHEST_MIDI; midi++) {
      const sharp = midiToPitch(midi);
      const flat = midiToPitch(midi, "flat");
      expect(sharp).not.toBeNull();
      expect(flat).not.toBeNull();
      expect(pitchToMidi(sharp ?? "")).toBe(midi);
      expect(pitchToMidi(flat ?? "")).toBe(midi);
    }
  });

  it("spells black keys as asked", () => {
    expect(midiToPitch(61)).toBe("C#4");
    expect(midiToPitch(61, "flat")).toBe("Db4");
  });

  it("returns null outside the notation's octaves or for non-integers", () => {
    expect(midiToPitch(11)).toBeNull();
    expect(midiToPitch(120)).toBeNull();
    expect(midiToPitch(60.5)).toBeNull();
  });
});

describe("isOnPiano", () => {
  it("accepts A0 to C8 only", () => {
    expect(isOnPiano(20)).toBe(false);
    expect(isOnPiano(21)).toBe(true);
    expect(isOnPiano(108)).toBe(true);
    expect(isOnPiano(109)).toBe(false);
    expect(isOnPiano(60.5)).toBe(false);
  });
});
