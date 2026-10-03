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
  /** Where playback started, in seconds into the session. */
  fromSec: number;
  /** The AudioContext time at which `fromSec` sounds. */
  startedAt: number;
  stop(): void;
}

/** How far ahead notes are handed to the piano, and how often the queue is topped up. */
const LOOKAHEAD_SEC = 0.5;
const TICK_MS = 50;

export type TimelineEvent =
  | {
      kind: "note";
      time: number;
      note: number;
      velocity: number;
      duration: number;
    }
  | { kind: "pedal"; time: number; down: boolean };

/** A session laid out in time: every note and pedal event, in seconds from its start. */
export interface Timeline {
  durationSec: number;
  notes: number;
  events: TimelineEvent[];
}

/**
 * Lays out a whole session (its chunks back to back, holding patterns
 * skipped). Every bar that parses plays, with or without violations; a bar
 * that doesn't parse is a rest of its length. Notes are humanized the way the
 * app will humanize them.
 */
export function buildTimeline(run: RunFile): Timeline {
  let at = 0;
  const events: TimelineEvent[] = [];

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
  return {
    durationSec: at,
    notes: events.filter((event) => event.kind === "note").length,
    events,
  };
}

/**
 * Plays a timeline on a piano from `fromSec` on. Notes that start earlier are
 * skipped and the pedal starts where it was at that moment. Events are handed
 * to the piano only a moment ahead (a lookahead loop), so stopping really
 * stops: nothing is left queued inside the piano library.
 */
export function scheduleSession(
  timeline: Timeline,
  piano: PianoLike,
  context: AudioContext,
  fromSec = 0,
): ScheduledSession {
  const startedAt = context.currentTime + 0.3;
  const { events } = timeline;
  let next = events.findIndex((event) => event.time >= fromSec);
  if (next === -1) next = events.length;
  const pedalBefore = events
    .slice(0, next)
    .findLast((event) => event.kind === "pedal");
  piano.pedal(pedalBefore?.kind === "pedal" && pedalBefore.down);
  const toContext = (time: number) => startedAt + time - fromSec;

  const tick = () => {
    const horizon = context.currentTime + LOOKAHEAD_SEC;
    while (
      next < events.length &&
      toContext(events[next]?.time ?? Infinity) < horizon
    ) {
      const event = events[next];
      next += 1;
      if (!event) continue;
      if (event.kind === "note") {
        piano.start({
          note: event.note,
          velocity: event.velocity,
          time: toContext(event.time),
          duration: event.duration,
        });
      } else {
        // The pedal applies immediately, so wait until its moment.
        const delay = Math.max(
          0,
          (toContext(event.time) - context.currentTime) * 1000,
        );
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
    fromSec,
    startedAt,
    stop() {
      clearInterval(loop);
      for (const timer of pedalTimers) clearTimeout(timer);
      piano.pedal(false);
      piano.stop();
    },
  };
}
