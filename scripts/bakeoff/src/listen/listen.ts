import { SplendidGrandPiano } from "smplr";

import { RunFileSchema } from "../run-file.ts";
import {
  type PianoLike,
  type ScheduledSession,
  scheduleSession,
} from "./session-player.ts";

const select = document.querySelector<HTMLSelectElement>("#run");
const play = document.querySelector<HTMLButtonElement>("#play");
const stop = document.querySelector<HTMLButtonElement>("#stop");
const status = document.querySelector<HTMLParagraphElement>("#status");
if (!select || !play || !stop || !status)
  throw new Error("listening page markup is missing");

let context: AudioContext | null = null;
let piano: PianoLike | null = null;
let playing: ScheduledSession | null = null;

const names = (await (await fetch("/api/runs")).json()) as string[];
for (const name of names) select.add(new Option(name, name));
if (names.length === 0)
  status.textContent = "No run files yet. Run `bun run bakeoff --mock` first.";

/** The Steinway (smplr's SplendidGrandPiano), created on the first click because browsers need one for audio. */
async function steinway(audio: AudioContext): Promise<PianoLike> {
  const instrument = SplendidGrandPiano(audio);
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

play.addEventListener("click", () => {
  void (async () => {
    playing?.stop();
    context ??= new AudioContext();
    await context.resume();
    if (!piano) {
      status.textContent = "Loading the piano…";
      piano = await steinway(context);
    }
    const run = RunFileSchema.parse(
      await (await fetch(`/api/runs/${select.value}`)).json(),
    );
    playing = scheduleSession(run, piano, context);
    status.textContent = `Playing ${select.value}: ${String(playing.notes)} notes, ${playing.durationSec.toFixed(0)} s.`;
  })();
});

stop.addEventListener("click", () => {
  playing?.stop();
  playing = null;
  status.textContent = "Stopped.";
});
