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

/** smplr's Steinway: 4 velocity layers. */
async function steinway(context: AudioContext): Promise<PianoLike> {
  const instrument = SplendidGrandPiano(context);
  await instrument.ready;
  return {
    start: (note) => instrument.start(note),
    stop: () => {
      instrument.stop();
    },
  };
}

/**
 * The Salamander plays about 5× louder than the Steinway (RMS, same take),
 * and the louder piano tends to win a blind comparison, so it's turned down
 * to match.
 */
const SALAMANDER_LEVEL = 0.2;

/**
 * Tone.js's Salamander Grand: up to 16 velocity layers; velocity 0–1. Its
 * piano tracks which keys are down when each call is made, so a key is let up
 * only shortly before its release (a key let up early can't be silenced by
 * `stopAll`), and a key struck again while still down is let up first.
 */
async function salamander(context: AudioContext): Promise<PianoLike> {
  Tone.setContext(context);
  const instrument = new Piano({ velocities: 8 }).connect(
    new Tone.Gain(SALAMANDER_LEVEL).toDestination(),
  );
  await instrument.load();
  const down = new Map<number, ReturnType<typeof setTimeout>>();
  return {
    start: ({ note, velocity, time, duration }) => {
      const held = down.get(note);
      if (held !== undefined) {
        clearTimeout(held);
        instrument.keyUp({ midi: note, time });
      }
      instrument.keyDown({ midi: note, velocity: velocity / 127, time });
      const release = time + duration;
      const delayMs = Math.max(0, (release - context.currentTime - 0.2) * 1000);
      down.set(
        note,
        setTimeout(() => {
          down.delete(note);
          instrument.keyUp({ midi: note, time: release });
        }, delayMs),
      );
    },
    stop: () => {
      for (const timer of down.values()) clearTimeout(timer);
      down.clear();
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
