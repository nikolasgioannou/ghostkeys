import { Piano } from "@tonejs/piano";
import { SplendidGrandPiano } from "smplr";
import * as Tone from "tone";

import type { PianoLike } from "./session-player.ts";

export type PianoChoice = "steinway" | "salamander";

export const PIANO_NAMES: Record<PianoChoice, string> = {
  steinway:
    "Steinway (smplr SplendidGrandPiano; public-domain samples by Akai)",
  salamander:
    "Yamaha C5 (Tone.js Salamander Grand; samples by Alexander Holm, CC-BY 3.0)",
};

/** smplr's Steinway: 4 velocity layers, sustain via CC64 (immediate). */
async function steinway(context: AudioContext): Promise<PianoLike> {
  const instrument = SplendidGrandPiano(context);
  await instrument.ready;
  return {
    start: (note) => instrument.start(note),
    pedal: (down) => {
      instrument.setCC(64, down ? 127 : 0);
    },
    stop: () => {
      instrument.stop();
    },
  };
}

/** Tone.js's Salamander Grand: up to 16 velocity layers; velocity 0–1. */
async function salamander(context: AudioContext): Promise<PianoLike> {
  Tone.setContext(context);
  const instrument = new Piano({ velocities: 8 }).toDestination();
  await instrument.load();
  return {
    start: ({ note, velocity, time, duration }) => {
      instrument.keyDown({ midi: note, velocity: velocity / 127, time });
      instrument.keyUp({ midi: note, time: time + duration });
    },
    pedal: (down) => {
      if (down) instrument.pedalDown();
      else instrument.pedalUp();
    },
    stop: () => {
      instrument.stopAll();
    },
  };
}

export function loadPiano(
  choice: PianoChoice,
  context: AudioContext,
): Promise<PianoLike> {
  return choice === "steinway" ? steinway(context) : salamander(context);
}
