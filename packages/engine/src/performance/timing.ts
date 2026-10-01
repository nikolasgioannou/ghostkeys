import { z } from "zod";

import { barLength } from "../checks/playing-rules.ts";
import type { BarBody, Dynamic, GridItem, Note } from "../grid/schema.ts";

/**
 * Turns parsed bars into timed note events a player can schedule
 * (docs/design.md → Playback). Offsets are relative to the bar's start, so a
 * player can apply tempo stretch and rubato without recomputing events.
 * Queued bars are never replaced: a chunk plays only after `chunk-complete`.
 */

export const TimedNoteSchema = z.object({
  midi: z.int(),
  /** Seconds from the start of the bar, at the bar's written tempo. */
  offsetSec: z.number().min(0),
  durSec: z.number().positive(),
  /** MIDI velocity, 1–127. */
  velocity: z.number().min(1).max(127),
  hand: z.enum(["right", "left"]),
  /** The melody note at its onset (top of the right hand, or marked `!`). */
  melody: z.boolean(),
  /** The onset in slots, for metric accents. */
  slot: z.int().min(0),
});
export type TimedNote = z.infer<typeof TimedNoteSchema>;

export const TimedPedalSchema = z.object({
  kind: z.enum(["down", "up"]),
  offsetSec: z.number().min(0),
});
export type TimedPedal = z.infer<typeof TimedPedalSchema>;

export const TimedBarSchema = z.object({
  bar: z.int().min(1),
  durationSec: z.number().positive(),
  /** Slots in the bar (12 per quarter). */
  slots: z.int().positive(),
  /** Ends a phrase (a cadence or `end` on its plan line). */
  phraseEnd: z.boolean(),
  notes: z.array(TimedNoteSchema),
  pedal: z.array(TimedPedalSchema),
});
export type TimedBar = z.infer<typeof TimedBarSchema>;

/** Base velocity for each dynamic mark. */
export const DYNAMIC_VELOCITY = {
  pp: 36,
  p: 48,
  mp: 60,
  mf: 72,
  f: 88,
  ff: 104,
} as const;
/** How far a hairpin moves the velocity across its bar. */
export const HAIRPIN_VELOCITY = 12;
/** A `rit` bar ends this much slower than it starts. */
export const RIT_END_FACTOR = 0.8;
/** A fermata holds for this many extra beats (quarters). */
export const FERMATA_BEATS = 1;

const SECONDS_PER_MINUTE = 60;
const SLOTS_PER_QUARTER = 12;

interface BarTempo {
  /** Quarter notes per minute at the bar's start. */
  start: number;
  /** …and at its end (lower when the bar has a `rit`). */
  end: number;
  fermatas: number[];
}

/** Seconds from the bar's start to `slot`, with the tempo moving linearly from start to end. */
function slotToSeconds(slot: number, slots: number, tempo: BarTempo): number {
  const fraction = slot / slots;
  const slope = tempo.end - tempo.start;
  const beats = slot / SLOTS_PER_QUARTER;
  const plain =
    slope === 0
      ? (beats * SECONDS_PER_MINUTE) / tempo.start
      : ((SECONDS_PER_MINUTE * (slots / SLOTS_PER_QUARTER)) / slope) *
        Math.log(1 + (slope * fraction) / tempo.start);
  const held = tempo.fermatas.filter((at) => at < slot).length;
  return plain + (held * FERMATA_BEATS * SECONDS_PER_MINUTE) / tempo.start;
}

function clampVelocity(velocity: number): number {
  return Math.max(1, Math.min(127, Math.round(velocity)));
}

function melodyFlags(notes: Note[]): boolean[] {
  const marked = new Set(
    notes.filter((note) => note.melody).map((note) => note.onset),
  );
  const top = new Map<number, number>();
  for (const note of notes)
    top.set(note.onset, Math.max(top.get(note.onset) ?? -1, note.midi));
  return notes.map((note) =>
    marked.has(note.onset) ? note.melody : top.get(note.onset) === note.midi,
  );
}

type BarItem = Extract<GridItem, { type: "bar" | "hold-bar" }>;

/** Times a chunk's bars and its holding pattern. Bars that didn't parse are skipped. */
export function timeChunk(items: GridItem[]): {
  bars: TimedBar[];
  hold: TimedBar[];
} {
  const header = items.find((item) => item.type === "header");
  if (!header) return { bars: [], hold: [] };
  const slots = barLength(header.meter);
  const plans = new Map(
    items.flatMap((item) =>
      item.type === "plan" ? [[item.bar, item] as const] : [],
    ),
  );

  const writtenTempo = header.tempo;
  let tempo = writtenTempo;
  let velocity: number = DYNAMIC_VELOCITY.p;

  function timeBars(bars: BarItem[], usePlans: boolean): TimedBar[] {
    const timed: TimedBar[] = [];
    bars.forEach((bar, index) => {
      if (!bar.body) return;
      const body: BarBody = bar.body;
      const plan = usePlans ? plans.get(bar.bar) : undefined;

      for (const mark of body.tempo) {
        if (mark.kind === "tempo") tempo = mark.bpm;
        if (mark.kind === "atempo") tempo = writtenTempo;
      }
      const rit = body.tempo.some((mark) => mark.kind === "rit");
      const barTempo: BarTempo = {
        start: tempo,
        end: rit ? tempo * RIT_END_FACTOR : tempo,
        fermatas: body.tempo.flatMap((mark) =>
          mark.kind === "fermata" ? [mark.slot] : [],
        ),
      };
      const at = (slot: number) => slotToSeconds(slot, slots, barTempo);

      const dynamic: Dynamic | null = plan?.dynamic ?? null;
      if (dynamic) velocity = DYNAMIC_VELOCITY[dynamic.level];
      const startVelocity = velocity;
      const swing =
        dynamic?.hairpin === "crescendo"
          ? HAIRPIN_VELOCITY
          : dynamic?.hairpin === "diminuendo"
            ? -HAIRPIN_VELOCITY
            : 0;

      const previous = bars[index - 1]?.body;
      const next = bars[index + 1];
      const notes: TimedNote[] = [];
      for (const hand of ["right", "left"] as const) {
        const handNotes = body[hand];
        const melody =
          hand === "right"
            ? melodyFlags(handNotes)
            : handNotes.map((note) => note.melody);
        handNotes.forEach((note, i) => {
          // The second half of a tie is played by the note that started it.
          const continuesTie =
            note.onset === 0 &&
            previous?.[hand].some(
              (held) => held.tie && held.midi === note.midi,
            );
          if (continuesTie) return;
          const offsetSec = at(note.onset);
          let durSec =
            at(Math.min(note.onset + note.duration, slots)) - offsetSec;
          if (note.tie && next?.body) {
            const continuation = next.body[hand].find(
              (n) => n.onset === 0 && n.midi === note.midi,
            );
            if (continuation) {
              const nextTempo: BarTempo = {
                start: tempo,
                end: next.body.tempo.some((mark) => mark.kind === "rit")
                  ? tempo * RIT_END_FACTOR
                  : tempo,
                fermatas: [],
              };
              durSec += slotToSeconds(
                Math.min(continuation.duration, slots),
                slots,
                nextTempo,
              );
            }
          }
          notes.push({
            midi: note.midi,
            offsetSec,
            durSec,
            velocity: clampVelocity(
              startVelocity + (swing * note.onset) / slots,
            ),
            hand,
            melody: melody[i] ?? false,
            slot: note.onset,
          });
        });
      }
      velocity = clampVelocity(startVelocity + swing);

      const pedal: TimedPedal[] = body.pedal
        .toSorted((a, b) => a.slot - b.slot)
        .flatMap((event): TimedPedal[] => {
          const offsetSec = at(event.slot);
          if (event.kind === "change") {
            return [
              { kind: "up", offsetSec },
              { kind: "down", offsetSec },
            ];
          }
          return [{ kind: event.kind, offsetSec }];
        });

      timed.push({
        bar: bar.bar,
        durationSec: at(slots),
        slots,
        phraseEnd: plan?.phraseEnd ?? false,
        notes: notes.toSorted((a, b) => a.offsetSec - b.offsetSec),
        pedal,
      });
    });
    return timed;
  }

  const bars = timeBars(
    items.filter((item): item is BarItem => item.type === "bar"),
    true,
  );
  const hold = timeBars(
    items.filter((item): item is BarItem => item.type === "hold-bar"),
    false,
  );
  return { bars, hold };
}
