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

/** How far ahead notes are handed to the piano, and how often the queue is topped up. */
const LOOKAHEAD_SEC = 0.5;
const TICK_MS = 50;

type Event =
  | {
      kind: "note";
      time: number;
      note: number;
      velocity: number;
      duration: number;
    }
  | { kind: "pedal"; time: number; down: boolean };

/**
 * Plays a whole session (its chunks back to back, holding patterns skipped)
 * on a piano. Every bar that parses plays, with or without violations; a bar
 * that doesn't parse is a rest of its length. Notes are humanized the way the
 * app will humanize them. Events are handed to the piano only a moment ahead
 * (a lookahead loop), so stopping really stops: nothing is left queued inside
 * the piano library.
 */
export function scheduleSession(
  run: RunFile,
  piano: PianoLike,
  context: AudioContext,
): ScheduledSession {
  const begin = context.currentTime + 0.3;
  let at = begin;
  const events: Event[] = [];

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
        events.push({
          kind: "note",
          time: at + note.offsetSec,
          note: note.midi,
          velocity: note.velocity,
          duration: note.durSec,
        });
      }
      for (const event of bar.pedal)
        events.push({
          kind: "pedal",
          time: at + event.offsetSec,
          down: event.kind === "down",
        });
      at += bar.durationSec;
    }
  }
  events.push({ kind: "pedal", time: at, down: false });
  events.sort((a, b) => a.time - b.time);

  let next = 0;
  const tick = () => {
    const horizon = context.currentTime + LOOKAHEAD_SEC;
    while (next < events.length && (events[next]?.time ?? Infinity) < horizon) {
      const event = events[next];
      next += 1;
      if (!event) continue;
      if (event.kind === "note") {
        piano.start({
          note: event.note,
          velocity: event.velocity,
          time: event.time,
          duration: event.duration,
        });
      } else {
        // The pedal applies immediately, so wait until its moment.
        const delay = Math.max(0, (event.time - context.currentTime) * 1000);
        pedalTimers.push(
          setTimeout(() => {
            piano.pedal(event.down);
          }, delay),
        );
      }
    }
    if (next >= events.length) clearInterval(loop);
  };
  const pedalTimers: ReturnType<typeof setTimeout>[] = [];
  const loop = setInterval(tick, TICK_MS);
  tick();

  return {
    durationSec: at - begin,
    notes: events.filter((event) => event.kind === "note").length,
    stop() {
      clearInterval(loop);
      for (const timer of pedalTimers) clearTimeout(timer);
      piano.pedal(false);
      piano.stop();
    },
  };
}
