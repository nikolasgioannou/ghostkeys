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

export interface TimelineNote {
  time: number;
  note: number;
  velocity: number;
  /** How long the note sounds, the sustain pedal included. */
  duration: number;
}

export interface PedalEvent {
  time: number;
  down: boolean;
}

/** A session laid out in time: every note, in seconds from its start. */
export interface Timeline {
  durationSec: number;
  notes: TimelineNote[];
}

/**
 * Applies the sustain pedal to note lengths: a note whose key is released
 * while the pedal is down keeps sounding until the pedal next comes up. The
 * piano libraries then only ever get plain notes (neither handles a pedal
 * scheduled ahead of time reliably).
 */
export function sustain(
  notes: TimelineNote[],
  pedal: PedalEvent[],
): TimelineNote[] {
  const events = pedal.toSorted((a, b) => a.time - b.time);
  return notes.map((note) => {
    const release = note.time + note.duration;
    const before = events.findLast((event) => event.time < release);
    if (!before?.down) return note;
    const up = events.find((event) => event.time >= release && !event.down);
    if (!up) return note;
    return { ...note, duration: up.time - note.time };
  });
}

/**
 * Lays out a whole session (its chunks back to back, holding patterns
 * skipped). Every bar that parses plays, with or without violations; a bar
 * that doesn't parse is a rest of its length. Notes are humanized the way the
 * app will humanize them, and the pedal is lifted at the end.
 */
export function buildTimeline(run: RunFile): Timeline {
  let at = 0;
  const notes: TimelineNote[] = [];
  const pedal: PedalEvent[] = [];

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
        notes.push({
          time: at + note.offsetSec,
          note: note.midi,
          velocity: note.velocity,
          duration: note.durSec,
        });
      }
      for (const event of bar.pedal)
        pedal.push({ time: at + event.offsetSec, down: event.kind === "down" });
      at += bar.durationSec;
    }
  }
  pedal.push({ time: at, down: false });
  return {
    durationSec: at,
    notes: sustain(notes, pedal).toSorted((a, b) => a.time - b.time),
  };
}

/**
 * Plays a timeline on a piano from `fromSec` on; notes that start earlier are
 * skipped. Notes are handed to the piano only a moment ahead (a lookahead
 * loop), so stopping really stops: nothing is left queued inside the piano
 * library.
 */
export function scheduleSession(
  timeline: Timeline,
  piano: PianoLike,
  context: AudioContext,
  fromSec = 0,
): ScheduledSession {
  const startedAt = context.currentTime + 0.3;
  const { notes } = timeline;
  let next = notes.findIndex((note) => note.time >= fromSec);
  if (next === -1) next = notes.length;
  const toContext = (time: number) => startedAt + time - fromSec;

  const tick = () => {
    const horizon = context.currentTime + LOOKAHEAD_SEC;
    while (
      next < notes.length &&
      toContext(notes[next]?.time ?? Infinity) < horizon
    ) {
      const note = notes[next];
      next += 1;
      if (!note) continue;
      piano.start({ ...note, time: toContext(note.time) });
    }
    if (next >= notes.length) clearInterval(loop);
  };
  const loop = setInterval(tick, TICK_MS);
  tick();

  return {
    fromSec,
    startedAt,
    stop() {
      clearInterval(loop);
      piano.stop();
    },
  };
}
