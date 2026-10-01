import type {
  BarBody,
  GridItem,
  Meter,
  Note,
  PedalEvent,
} from "../grid/schema.ts";
import {
  isOnPiano,
  midiToPitch,
  PIANO_HIGHEST_MIDI,
  PIANO_LOWEST_MIDI,
  spellingFor,
} from "../pitch.ts";
import type { Violation } from "./violation.ts";

/**
 * The playing rules (docs/design.md → Grid format → Checker rules): what a
 * pianist can physically play and what the format requires. Code checks;
 * Claude fixes. Nothing here ever changes a note (invariant 1).
 */

/** At most this many notes in one hand at one onset. */
export const MAX_NOTES_PER_ONSET = 5;
/** The widest one hand can play at once: a major 10th. */
export const MAX_HAND_SPAN_SEMITONES = 16;

/** Slots in a bar: 12 per quarter note. */
export function barLength(meter: Meter): number {
  return (meter.numerator * 48) / meter.denominator;
}

type Where = Violation["where"];
type Hand = "right" | "left";

const HANDS: readonly Hand[] = ["right", "left"];

type Spelling = "sharp" | "flat";

function name(midi: number, spelling: Spelling): string {
  return midiToPitch(midi, spelling) ?? `MIDI ${String(midi)}`;
}

function label(where: Where, hand: Hand | null): string {
  const place =
    where.kind === "bar"
      ? `Bar ${String(where.bar)}`
      : where.kind === "hold"
        ? `Holding-pattern bar ${String(where.bar)}`
        : "The chunk";
  return hand ? `${place}, ${hand} hand` : place;
}

function hard(
  rule: string,
  where: Where,
  hand: Hand | null,
  detail: string,
): Violation {
  return {
    rule,
    severity: "hard",
    where,
    hand,
    message: `${label(where, hand)}: ${detail}`,
  };
}

/**
 * The rules one bar can be checked against on its own, as soon as it
 * arrives: onsets inside the bar, notes ending at or before the barline (a
 * tied note ends exactly on it), the piano's range, notes per onset and the
 * hand span at each onset.
 */
export function checkBar(
  body: BarBody,
  meter: Meter,
  where: Where,
  spelling: Spelling = "sharp",
): Violation[] {
  const length = barLength(meter);
  const violations: Violation[] = [];

  for (const hand of HANDS) {
    const notes = body[hand];
    for (const note of notes) {
      const at = `${name(note.midi, spelling)} at slot ${String(note.onset)}`;
      if (note.onset >= length) {
        violations.push(
          hard(
            "onset-outside-bar",
            where,
            hand,
            `${at} starts outside the bar (a bar here is ${String(length)} slots, 0–${String(length - 1)}).`,
          ),
        );
        continue;
      }
      const end = note.onset + note.duration;
      if (note.tie && end !== length) {
        violations.push(
          hard(
            "tie-not-at-barline",
            where,
            hand,
            `${at} is tied but ends at slot ${String(end)}; a tied note must end exactly at the barline (slot ${String(length)}).`,
          ),
        );
      } else if (!note.tie && end > length) {
        violations.push(
          hard(
            "note-past-barline",
            where,
            hand,
            `${at} lasts ${String(note.duration)} slots and runs past the barline (slot ${String(length)}). Shorten it, or end it at the barline and tie it with ~.`,
          ),
        );
      }
      if (!isOnPiano(note.midi)) {
        violations.push(
          hard(
            "pitch-out-of-range",
            where,
            hand,
            `${at} is outside the piano's range (${name(PIANO_LOWEST_MIDI, spelling)}–${name(PIANO_HIGHEST_MIDI, spelling)}).`,
          ),
        );
      }
    }

    for (const [onset, group] of byOnset(notes)) {
      if (group.length > MAX_NOTES_PER_ONSET) {
        violations.push(
          hard(
            "too-many-notes",
            where,
            hand,
            `${String(group.length)} notes at slot ${String(onset)}; one hand plays at most ${String(MAX_NOTES_PER_ONSET)} at once.`,
          ),
        );
      }
      const midis = group.map((note) => note.midi);
      const low = Math.min(...midis);
      const high = Math.max(...midis);
      if (high - low > MAX_HAND_SPAN_SEMITONES) {
        violations.push(
          hard(
            "hand-span",
            where,
            hand,
            `the notes at slot ${String(onset)} span ${name(low, spelling)} to ${name(high, spelling)} (${String(high - low)} semitones); one hand reaches at most a major 10th (${String(MAX_HAND_SPAN_SEMITONES)}). Spread it across beats or hands.`,
          ),
        );
      }
    }
  }
  return violations;
}

function byOnset(notes: Note[]): Map<number, Note[]> {
  const groups = new Map<number, Note[]>();
  for (const note of notes) {
    const group = groups.get(note.onset);
    if (group) group.push(note);
    else groups.set(note.onset, [note]);
  }
  return groups;
}

type BarItem = Extract<GridItem, { type: "bar" | "hold-bar" }>;

/** Ties from `bar` must be met by the same pitch at slot 0 of `next` in the same hand. */
function checkTies(
  bar: BarItem,
  next: BarItem | undefined,
  where: Where,
  spelling: Spelling,
): Violation[] {
  if (!bar.body) return [];
  const violations: Violation[] = [];
  for (const hand of HANDS) {
    for (const note of bar.body[hand]) {
      if (!note.tie) continue;
      const continued = next?.body?.[hand].some(
        (n) => n.midi === note.midi && n.onset === 0,
      );
      if (!continued) {
        violations.push(
          hard(
            "tie-unmatched",
            where,
            hand,
            next
              ? `${name(note.midi, spelling)} is tied, but the next bar doesn't start the same pitch at slot 0 in the same hand.`
              : `${name(note.midi, spelling)} is tied out of the last bar, where nothing continues it. Remove the tie.`,
          ),
        );
      }
    }
  }
  return violations;
}

function pedalAfter(events: PedalEvent[], startDown: boolean): boolean {
  let down = startDown;
  for (const event of [...events].sort((a, b) => a.slot - b.slot)) {
    down = event.kind !== "up";
  }
  return down;
}

/** At least 2 and at most 4 holding-pattern bars. */
export const HOLD_MIN_BARS = 2;
export const HOLD_MAX_BARS = 4;

/**
 * Every playing rule for a whole chunk (a header, plan lines, bars, the
 * holding pattern and the footer, as the parser emitted them): the per-bar
 * rules, ties across bars, the chunk's structure, the first dynamic, and
 * whether the holding pattern loops.
 */
export function checkChunk(items: GridItem[]): Violation[] {
  const chunk: Where = { kind: "chunk" };
  const violations: Violation[] = [];
  const header = items.find((item) => item.type === "header");
  const plans = items.filter((item) => item.type === "plan");
  const bars = items.filter((item) => item.type === "bar");
  const holdBars = items.filter((item) => item.type === "hold-bar");

  for (const item of items) {
    if (item.type === "parse-error") {
      violations.push(
        hard(
          "parse-error",
          chunk,
          null,
          `line ${String(item.line)} doesn't follow the grid format (${item.reason}): ${item.source}`,
        ),
      );
    }
    if (
      (item.type === "bar" || item.type === "hold-bar") &&
      item.error !== null
    ) {
      const where: Where = {
        kind: item.type === "bar" ? "bar" : "hold",
        bar: item.bar,
      };
      violations.push(
        hard("parse-error", where, null, `doesn't parse (${item.error}).`),
      );
    }
  }

  if (!header) {
    violations.push(
      hard("missing-header", chunk, null, "there's no CHUNK header line."),
    );
    return violations;
  }
  const spelling = spellingFor(header.key);

  // Structure: bars numbered 1..n, each with a plan line; HOLD, footer and END present.
  bars.forEach((bar, index) => {
    if (bar.bar !== index + 1) {
      violations.push(
        hard(
          "bar-sequence",
          { kind: "bar", bar: bar.bar },
          null,
          `bars must be numbered in order from 1; expected bar ${String(index + 1)} here.`,
        ),
      );
    }
    if (!plans.some((plan) => plan.bar === bar.bar)) {
      violations.push(
        hard(
          "bar-without-plan",
          { kind: "bar", bar: bar.bar },
          null,
          "has no plan line (P).",
        ),
      );
    }
  });
  if (bars.length === 0)
    violations.push(hard("no-bars", chunk, null, "has no bars."));
  const firstPlan = plans[0];
  if (firstPlan?.dynamic === null) {
    violations.push(
      hard(
        "missing-first-dynamic",
        { kind: "bar", bar: firstPlan.bar },
        null,
        "the chunk's first plan line needs a dynamic (dyn=).",
      ),
    );
  }
  if (!items.some((item) => item.type === "hold-start")) {
    violations.push(
      hard(
        "missing-hold",
        chunk,
        null,
        "there's no HOLD block (the holding pattern).",
      ),
    );
  }
  if (!items.some((item) => item.type === "footer-state")) {
    violations.push(
      hard(
        "missing-footer-state",
        chunk,
        null,
        "the footer has no `F key=… chord=… ped=…` line.",
      ),
    );
  }
  if (!items.some((item) => item.type === "footer-summary")) {
    violations.push(
      hard("missing-summary", chunk, null, "the footer has no `F sum` line."),
    );
  }
  if (items.at(-1)?.type !== "end") {
    violations.push(
      hard(
        "missing-end",
        chunk,
        null,
        "doesn't finish with END (it was cut off).",
      ),
    );
  }

  // Each bar on its own, then ties across bars.
  bars.forEach((bar, index) => {
    const where: Where = { kind: "bar", bar: bar.bar };
    if (bar.body)
      violations.push(...checkBar(bar.body, header.meter, where, spelling));
    violations.push(...checkTies(bar, bars[index + 1], where, spelling));
  });

  // The holding pattern loops cleanly.
  if (holdBars.length > 0 || items.some((item) => item.type === "hold-start")) {
    const hold: Where = { kind: "chunk" };
    if (holdBars.length < HOLD_MIN_BARS || holdBars.length > HOLD_MAX_BARS) {
      violations.push(
        hard(
          "hold-length",
          hold,
          null,
          `the holding pattern has ${String(holdBars.length)} bars; it needs ${String(HOLD_MIN_BARS)}–${String(HOLD_MAX_BARS)}.`,
        ),
      );
    }
    holdBars.forEach((bar, index) => {
      const where: Where = { kind: "hold", bar: bar.bar };
      if (bar.bar !== index + 1) {
        violations.push(
          hard(
            "hold-sequence",
            where,
            null,
            `holding-pattern bars must be numbered in order from 1; expected H${String(index + 1)}.`,
          ),
        );
      }
      if (bar.body)
        violations.push(...checkBar(bar.body, header.meter, where, spelling));
      // Ties inside the pattern are fine; nothing may be tied out of its last bar.
      violations.push(...checkTies(bar, holdBars[index + 1], where, spelling));
    });

    const first = holdBars[0]?.body;
    if (first) {
      const pedalDownBefore = bars.reduce(
        (down, bar) => (bar.body ? pedalAfter(bar.body.pedal, down) : down),
        false,
      );
      const pedalDownAtEnd = holdBars.reduce(
        (down, bar) => (bar.body ? pedalAfter(bar.body.pedal, down) : down),
        pedalDownBefore,
      );
      const clearedAtStart = first.pedal.some((event) => event.slot === 0);
      if (pedalDownAtEnd && !clearedAtStart) {
        violations.push(
          hard(
            "hold-pedal",
            { kind: "hold", bar: holdBars[0]?.bar ?? 1 },
            null,
            "the pedal is still down at the end of the holding pattern, so looping it would blur. Change the pedal at slot 0 of the first bar (c0) or lift it by the end.",
          ),
        );
      }
    }
  }

  return violations;
}
