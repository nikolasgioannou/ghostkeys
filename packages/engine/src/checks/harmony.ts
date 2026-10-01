import type { GridItem, Key, Meter, Note, Roman } from "../grid/schema.ts";
import { midiToPitch } from "../pitch.ts";
import type { Violation } from "./violation.ts";

/**
 * Do the notes match the harmony Claude planned for each bar? Notes on
 * strong slots should be chord tones; weak-slot passing and neighbour tones,
 * chromatic colour and suspensions (notes tied over the barline) are normal
 * Romantic writing and never count against a bar. The Roman-numeral logic is
 * written here rather than taken from a theory library because the grammar
 * is ours (secondary targets, named augmented sixths, the minor-key leading
 * tone).
 */

/** A bar is flagged `soft` when more than this share of its strong-slot notes don't fit the chord. */
export const HARMONY_SOFT_THRESHOLD = 0.34;
/** …and `hard` (clearly the wrong harmony) above this share. */
export const HARMONY_HARD_THRESHOLD = 0.67;

const LETTER: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

function tonicPitchClass(key: Key): number {
  const letter = LETTER[key.tonic[0] ?? "C"] ?? 0;
  const accidental = key.tonic[1] === "#" ? 1 : key.tonic[1] === "b" ? -1 : 0;
  return mod12(letter + accidental);
}

interface Degree {
  accidental: "" | "b" | "#";
  degree: number;
  minor: boolean;
}

/**
 * The root of a degree in a key: the key's own scale (major, or natural
 * minor), except that the seventh degree in minor is the raised leading tone
 * when written lowercase (`viio7`) and the subtonic when uppercase (`VII`).
 * An accidental moves it a semitone.
 */
function rootOf(tonic: number, mode: Key["mode"], d: Degree): number {
  const scale = mode === "major" ? MAJOR_SCALE : MINOR_SCALE;
  let step = scale[d.degree - 1] ?? 0;
  if (mode === "minor" && d.degree === 7 && d.minor) step = 11;
  const shift = d.accidental === "#" ? 1 : d.accidental === "b" ? -1 : 0;
  return mod12(tonic + step + shift);
}

/** The pitch classes of a planned chord in a key. */
export function chordPitchClasses(chord: Roman, key: Key): Set<number> {
  const tonic = tonicPitchClass(key);

  if (chord.kind === "named") {
    const intervals = {
      N6: [1, 5, 8],
      It6: [8, 0, 6],
      Fr6: [8, 0, 2, 6],
      Ger6: [8, 0, 3, 6],
    }[chord.chord];
    return new Set(intervals.map((i) => mod12(tonic + i)));
  }

  let base = tonic;
  let mode: Key["mode"] = key.mode;
  if (chord.secondary) {
    base = rootOf(tonic, key.mode, chord.secondary);
    mode = chord.secondary.minor ? "minor" : "major";
  }
  const root = rootOf(base, mode, chord);

  const third =
    chord.quality === "diminished" ||
    chord.quality === "half-diminished" ||
    chord.minor
      ? 3
      : 4;
  const fifth =
    chord.quality === "diminished" || chord.quality === "half-diminished"
      ? 6
      : chord.quality === "augmented"
        ? 8
        : 7;
  const intervals = [0, third, fifth];
  if (chord.figure === "maj7") intervals.push(11);
  else if (
    chord.figure === "7" ||
    chord.figure === "65" ||
    chord.figure === "43" ||
    chord.figure === "42"
  ) {
    intervals.push(chord.quality === "diminished" ? 9 : 10);
  }
  return new Set(intervals.map((i) => mod12(root + i)));
}

/** Slots per beat: a dotted quarter in compound meters (6/8, 9/8, 12/8), otherwise the meter's beat unit. */
export function beatLength(meter: Meter): number {
  const unit = 48 / meter.denominator;
  return meter.denominator === 8 &&
    meter.numerator % 3 === 0 &&
    meter.numerator > 3
    ? unit * 3
    : unit;
}

type BarItem = Extract<GridItem, { type: "bar" }>;
type PlanItem = Extract<GridItem, { type: "plan" }>;

/**
 * Checks every bar against its plan line. Bars without a plan line or that
 * didn't parse are left to the playing rules.
 */
export function checkHarmony(items: GridItem[]): Violation[] {
  const header = items.find((item) => item.type === "header");
  if (!header) return [];
  const beat = beatLength(header.meter);
  const plans = new Map<number, PlanItem>();
  for (const item of items) if (item.type === "plan") plans.set(item.bar, item);
  const bars = items.filter((item): item is BarItem => item.type === "bar");

  const violations: Violation[] = [];
  bars.forEach((bar, index) => {
    const plan = plans.get(bar.bar);
    if (!plan || !bar.body) return;
    const previous = bars[index - 1]?.body;
    const tones = chordPitchClasses(plan.chord, plan.key);

    const isSuspension = (note: Note, hand: "right" | "left") =>
      note.onset === 0 &&
      (previous?.[hand].some((held) => held.tie && held.midi === note.midi) ??
        false);

    const strong: Note[] = [];
    for (const hand of ["right", "left"] as const) {
      for (const note of bar.body[hand]) {
        if (note.onset % beat === 0 && !isSuspension(note, hand))
          strong.push(note);
      }
    }
    if (strong.length === 0) return;

    const outside = strong.filter((note) => !tones.has(mod12(note.midi)));
    const share = outside.length / strong.length;
    if (share <= HARMONY_SOFT_THRESHOLD) return;

    const severity = share > HARMONY_HARD_THRESHOLD ? "hard" : "soft";
    const names = outside
      .map((note) => midiToPitch(note.midi) ?? String(note.midi))
      .join(", ");
    violations.push({
      rule: "harmony",
      severity,
      where: { kind: "bar", bar: bar.bar },
      hand: null,
      message: `Bar ${String(bar.bar)}: ${String(outside.length)} of ${String(strong.length)} notes on the beat (${names}) aren't in the planned ${plan.chord.text} in ${plan.key.tonic}${plan.key.mode === "minor" ? "m" : ""}. Make the notes fit the chord, or change the plan line to the harmony you meant.`,
    });
  });
  return violations;
}
