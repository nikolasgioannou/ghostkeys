import {
  TEXTURE_EXAMPLES,
  type TextureExample,
} from "../composer/texture-examples.ts";
import { createGridLineParser } from "../grid/line-parser.ts";
import type { GridItem, Meter } from "../grid/schema.ts";
import { beatLength } from "./harmony.ts";
import { barLength } from "./playing-rules.ts";
import type { Violation } from "./violation.ts";

/**
 * Invariant 3: themes are original. Models copy what they're shown, so every
 * chunk's melody and bass are compared with the texture examples. Voices are
 * reduced to interval-and-timing steps (transposition doesn't hide a copy),
 * and the longest run of steps shared with an example is measured. The
 * theme bank is never compared: a theme returning is intended.
 */

/**
 * A shared melody run of at least this many steps (that many intervals, one
 * more note) is a copy. Bass lines on the beat are more alike between pieces
 * (the same progression in the same texture), so they need a longer run.
 */
export const COPY_MIN_STEPS = { melody: 6, bass: 10 } as const;
/** …if the run uses at least this many different intervals (a repeated pedal note or a plain arpeggio isn't a tune). */
export const COPY_MIN_DISTINCT_INTERVALS = 3;

interface VoiceNote {
  midi: number;
  /** Slots from the start of the passage. */
  at: number;
  bar: number;
}

type Voice = "melody" | "bass";

/**
 * The melody (the highest right-hand note at each onset) or the bass line
 * (the lowest left-hand note on each beat; figuration between beats isn't
 * part of the line).
 */
function voice(items: GridItem[], which: Voice): VoiceNote[] {
  const header = items.find((item) => item.type === "header");
  if (!header) return [];
  const meter: Meter = header.meter;
  const length = barLength(meter);
  const beat = beatLength(meter);
  const notes: VoiceNote[] = [];
  for (const item of items) {
    if (item.type !== "bar" || !item.body) continue;
    const hand = which === "melody" ? item.body.right : item.body.left;
    const byOnset = new Map<number, number>();
    for (const note of hand) {
      if (which === "bass" && note.onset % beat !== 0) continue;
      const current = byOnset.get(note.onset);
      const better = which === "melody" ? Math.max : Math.min;
      byOnset.set(
        note.onset,
        current === undefined ? note.midi : better(current, note.midi),
      );
    }
    for (const [onset, midi] of [...byOnset].sort((a, b) => a[0] - b[0])) {
      notes.push({ midi, at: (item.bar - 1) * length + onset, bar: item.bar });
    }
  }
  return notes;
}

interface Step {
  interval: number;
  key: string;
}

function steps(notes: VoiceNote[]): Step[] {
  return notes.slice(1).map((note, index) => {
    const previous = notes[index] ?? note;
    const interval = note.midi - previous.midi;
    return {
      interval,
      key: `${String(interval)}/${String(note.at - previous.at)}`,
    };
  });
}

/** The longest run of steps in `a` that also appears in `b`: where it starts in `a`, and how long it is. */
function longestSharedRun(
  a: Step[],
  b: Step[],
): { start: number; length: number } {
  let best = { start: 0, length: 0 };
  let row = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const next = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1]?.key === b[j - 1]?.key) {
        const run = (row[j - 1] ?? 0) + 1;
        next[j] = run;
        if (run > best.length) best = { start: i - run, length: run };
      }
    }
    row = next;
  }
  return best;
}

const parsedExamples = new Map<TextureExample, GridItem[]>();

function parse(example: TextureExample): GridItem[] {
  const cached = parsedExamples.get(example);
  if (cached) return cached;
  const parser = createGridLineParser();
  const items = example.grid.split("\n").flatMap((line) => {
    const item = parser.line(line);
    return item ? [item] : [];
  });
  parsedExamples.set(example, items);
  return items;
}

/** Flags any melody or bass passage that copies a texture example, transposed or not. */
export function checkCopies(
  items: GridItem[],
  examples: readonly TextureExample[] = TEXTURE_EXAMPLES,
): Violation[] {
  const violations: Violation[] = [];
  for (const which of ["melody", "bass"] as const) {
    const notes = voice(items, which);
    const mine = steps(notes);
    for (const example of examples) {
      const run = longestSharedRun(mine, steps(voice(parse(example), which)));
      if (run.length < COPY_MIN_STEPS[which]) continue;
      const shared = mine.slice(run.start, run.start + run.length);
      if (
        new Set(shared.map((step) => step.interval)).size <
        COPY_MIN_DISTINCT_INTERVALS
      )
        continue;
      const first = notes[run.start]?.bar ?? 1;
      const last = notes[run.start + run.length]?.bar ?? first;
      const bars =
        first === last
          ? `Bar ${String(first)}`
          : `Bars ${String(first)}–${String(last)}`;
      violations.push({
        rule: "copy",
        severity: "hard",
        where: { kind: "bar", bar: first },
        hand: which === "melody" ? "right" : "left",
        message: `${bars}: the ${which === "melody" ? "melody" : "bass line"} copies the texture example "${example.label}" (${String(run.length + 1)} notes with the same intervals and rhythm). The examples show texture only; write your own line.`,
      });
    }
  }
  return violations;
}
