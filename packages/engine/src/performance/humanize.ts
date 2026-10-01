import type { TimedBar, TimedNote, TimedPedal } from "./timing.ts";

/**
 * Makes timed bars sound like a pianist rather than a sequencer
 * (docs/design.md → Playback). Deterministic: the same seed (the chunk's
 * index) gives the same performance, so a replay or a resume sounds
 * identical. Every amount is a named constant so tuning sessions can adjust
 * them.
 */

/** Velocity added to notes on the downbeat… */
export const ACCENT_DOWNBEAT = 6;
/** …and on other quarter-note beats. */
export const ACCENT_BEAT = 3;
/** Velocity added to melody notes, so the melody sings over the accompaniment… */
export const MELODY_BOOST = 10;
/** …and taken from accompanying notes. */
export const ACCOMPANIMENT_CUT = 4;
/** Onsets move by up to this much either way. */
export const JITTER_SEC = 0.012;
/** In a chord of 3 or more notes in one hand, each note above the lowest sounds this much later. */
export const ROLL_STEP_SEC = 0.012;
export const ROLL_MIN_NOTES = 3;
/** A bar that ends a phrase broadens by up to this fraction toward its end. */
export const PHRASE_END_RUBATO = 0.08;
/** At a pedal change, the pedal goes back down this long after it comes up. */
export const PEDAL_LAG_SEC = 0.04;

/** A small, fast, seedable pseudo-random generator (mulberry32). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampVelocity(velocity: number): number {
  return Math.max(1, Math.min(127, Math.round(velocity)));
}

/** A broadening time warp for phrase-end bars: slows progressively, by `PHRASE_END_RUBATO` at the end. */
function warp(seconds: number, duration: number, phraseEnd: boolean): number {
  if (!phraseEnd || duration === 0) return seconds;
  const fraction = Math.min(seconds / duration, 1);
  return (
    seconds * (1 + (PHRASE_END_RUBATO * fraction) / 2) +
    Math.max(0, seconds - duration) * PHRASE_END_RUBATO
  );
}

function humanizeBar(bar: TimedBar, seed: number): TimedBar {
  const next = random(seed * 1009 + bar.bar);
  const at = (seconds: number) => warp(seconds, bar.durationSec, bar.phraseEnd);

  // Rolled chords: order each hand's simultaneous notes from the bottom.
  const rollIndex = new Map<TimedNote, number>();
  for (const hand of ["right", "left"] as const) {
    const bySlot = new Map<number, TimedNote[]>();
    for (const note of bar.notes.filter((n) => n.hand === hand)) {
      bySlot.set(note.slot, [...(bySlot.get(note.slot) ?? []), note]);
    }
    for (const chord of bySlot.values()) {
      if (chord.length < ROLL_MIN_NOTES) continue;
      chord
        .toSorted((a, b) => a.midi - b.midi)
        .forEach((note, i) => rollIndex.set(note, i));
    }
  }

  const notes = bar.notes.map((note): TimedNote => {
    const jitter = (next() * 2 - 1) * JITTER_SEC;
    const roll = (rollIndex.get(note) ?? 0) * ROLL_STEP_SEC;
    const start = Math.max(0, at(note.offsetSec) + jitter + roll);
    const end = at(note.offsetSec + note.durSec);
    const accent =
      note.slot === 0
        ? ACCENT_DOWNBEAT
        : note.slot % 12 === 0
          ? ACCENT_BEAT
          : 0;
    const voice = note.melody ? MELODY_BOOST : -ACCOMPANIMENT_CUT;
    return {
      ...note,
      offsetSec: start,
      durSec: Math.max(0.02, end - start),
      velocity: clampVelocity(note.velocity + accent + voice),
    };
  });

  const pedal = bar.pedal.map((event, i): TimedPedal => {
    const previous = bar.pedal[i - 1];
    const lag =
      event.kind === "down" &&
      previous?.kind === "up" &&
      previous.offsetSec === event.offsetSec
        ? PEDAL_LAG_SEC
        : 0;
    return { kind: event.kind, offsetSec: at(event.offsetSec) + lag };
  });

  return {
    ...bar,
    durationSec: at(bar.durationSec),
    notes: notes.toSorted((a, b) => a.offsetSec - b.offsetSec),
    pedal,
  };
}

/** Humanizes timed bars. `seed` is the chunk's index, so every chunk varies differently but replays identically. */
export function humanize(bars: TimedBar[], seed: number): TimedBar[] {
  return bars.map((bar) => humanizeBar(bar, seed));
}
