import { barLength, humanize, timeChunk } from "@ghostkeys/engine";

import type { RunFile } from "../run-file.ts";

/** What the page needs from a piano library, so either library can be plugged in. */
export interface PianoLike {
  /** Strikes a note at an AudioContext time, for a duration in seconds. */
  start(note: {
    note: number;
    velocity: number;
    time: number;
    duration: number;
  }): void;
  /** Sustain pedal, now. */
  pedal(down: boolean): void;
  /** Silences everything. */
  stop(): void;
}

export interface ScheduledSession {
  durationSec: number;
  notes: number;
  stop(): void;
}

/**
 * Schedules a whole session (its chunks back to back, holding patterns
 * skipped) on a piano, up front. Every bar that parses plays, with or without
 * violations; a bar that doesn't parse is a rest of its length. Notes are
 * humanized the way the app will humanize them.
 */
export function scheduleSession(
  run: RunFile,
  piano: PianoLike,
  context: AudioContext,
): ScheduledSession {
  const begin = context.currentTime + 0.5;
  let at = begin;
  let notes = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const pedalAt = (time: number, down: boolean) => {
    timers.push(
      setTimeout(
        () => {
          piano.pedal(down);
        },
        Math.max(0, (time - context.currentTime) * 1000),
      ),
    );
  };

  for (const chunk of run.chunks) {
    if (chunk.outcome !== "complete") continue;
    const header = chunk.items.find((item) => item.type === "header");
    if (!header) continue;
    const restSec = (barLength(header.meter) / 12) * (60 / header.tempo);
    const timed = new Map(
      humanize(timeChunk(chunk.items).bars, chunk.index).map((bar) => [
        bar.bar,
        bar,
      ]),
    );

    for (const item of chunk.items) {
      if (item.type !== "bar") continue;
      const bar = timed.get(item.bar);
      if (!bar) {
        at += restSec;
        continue;
      }
      for (const note of bar.notes) {
        piano.start({
          note: note.midi,
          velocity: note.velocity,
          time: at + note.offsetSec,
          duration: note.durSec,
        });
        notes += 1;
      }
      for (const event of bar.pedal)
        pedalAt(at + event.offsetSec, event.kind === "down");
      at += bar.durationSec;
    }
  }
  pedalAt(at, false);

  return {
    durationSec: at - begin,
    notes,
    stop() {
      for (const timer of timers) clearTimeout(timer);
      piano.pedal(false);
      piano.stop();
    },
  };
}
