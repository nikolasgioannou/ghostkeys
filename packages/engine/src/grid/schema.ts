import { z } from "zod";

/**
 * Schemas for the grid format (docs/design.md → Grid format). They're
 * structural: types, integers, known marks. Musical rules (the piano's
 * range, onsets inside the bar, hand spans) belong to the checkers.
 */

export const KeySchema = z.object({
  /** Pitch letter with an optional accidental, e.g. `Db`, `F#`. */
  tonic: z.string().regex(/^[A-G][#b]?$/),
  mode: z.enum(["major", "minor"]),
});
export type Key = z.infer<typeof KeySchema>;

export const MeterSchema = z.object({
  numerator: z.int().min(1).max(16),
  denominator: z.union([
    z.literal(2),
    z.literal(4),
    z.literal(8),
    z.literal(16),
  ]),
});
export type Meter = z.infer<typeof MeterSchema>;

const DegreeSchema = z.object({
  accidental: z.enum(["", "b", "#"]),
  degree: z.int().min(1).max(7),
  /** Written lowercase (a minor-quality chord). */
  minor: z.boolean(),
});

export const RomanSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("degree"),
    text: z.string(),
    ...DegreeSchema.shape,
    quality: z.enum(["diminished", "half-diminished", "augmented"]).nullable(),
    figure: z.enum(["6", "64", "7", "65", "43", "42", "maj7"]).nullable(),
    /** The chord this one tonicizes, e.g. the `V` in `V7/V`. */
    secondary: DegreeSchema.nullable(),
  }),
  z.object({
    kind: z.literal("named"),
    text: z.string(),
    chord: z.enum(["N6", "It6", "Fr6", "Ger6"]),
  }),
]);
export type Roman = z.infer<typeof RomanSchema>;

export const DynamicSchema = z.object({
  level: z.enum(["pp", "p", "mp", "mf", "f", "ff"]),
  hairpin: z.enum(["crescendo", "diminuendo"]).nullable(),
});
export type Dynamic = z.infer<typeof DynamicSchema>;

export const MotifUseSchema = z.object({
  theme: z.string(),
  transform: z.enum([
    "orig",
    "frag",
    "seq",
    "inv",
    "aug",
    "dim",
    "reharm",
    "minor",
    "major",
  ]),
});
export type MotifUse = z.infer<typeof MotifUseSchema>;

export const NoteSchema = z.object({
  midi: z.int(),
  /** Slots from the start of the bar (12 per quarter note). */
  onset: z.int().min(0),
  duration: z.int().min(1),
  /** Continues into the next bar. */
  tie: z.boolean(),
  /** Marked `!` as the melody (otherwise the top right-hand note is). */
  melody: z.boolean(),
});
export type Note = z.infer<typeof NoteSchema>;

export const PedalEventSchema = z.object({
  kind: z.enum(["down", "up", "change"]),
  slot: z.int().min(0),
});
export type PedalEvent = z.infer<typeof PedalEventSchema>;

export const TempoMarkSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rit") }),
  z.object({ kind: z.literal("atempo") }),
  z.object({ kind: z.literal("tempo"), bpm: z.number().positive() }),
  z.object({ kind: z.literal("fermata"), slot: z.int().min(0) }),
]);
export type TempoMark = z.infer<typeof TempoMarkSchema>;

export const BarBodySchema = z.object({
  /** One entry per pitch; a chord is several notes with the same onset. */
  right: z.array(NoteSchema),
  left: z.array(NoteSchema),
  pedal: z.array(PedalEventSchema),
  tempo: z.array(TempoMarkSchema),
});
export type BarBody = z.infer<typeof BarBodySchema>;

/** Every item carries the line it came from, exactly as Claude wrote it. */
const sourced = {
  line: z.int().min(1),
  source: z.string(),
};

const barShape = {
  bar: z.int().min(1),
  /** `null` when the line didn't parse; `error` says why. */
  body: BarBodySchema.nullable(),
  error: z.string().nullable(),
  ...sourced,
};

export const GridItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("header"),
    meter: MeterSchema,
    tempo: z.number().positive(),
    key: KeySchema,
    ...sourced,
  }),
  z.object({
    type: z.literal("plan"),
    bar: z.int().min(1),
    key: KeySchema,
    chord: RomanSchema,
    cadence: z.enum(["PAC", "IAC", "HC", "DC", "PC"]).nullable(),
    phraseEnd: z.boolean(),
    dynamic: DynamicSchema.nullable(),
    texture: z.string().nullable(),
    motif: MotifUseSchema.nullable(),
    ...sourced,
  }),
  z.object({ type: z.literal("bar"), ...barShape }),
  z.object({ type: z.literal("hold-start"), ...sourced }),
  z.object({ type: z.literal("hold-bar"), ...barShape }),
  z.object({
    type: z.literal("footer-state"),
    key: KeySchema,
    chord: RomanSchema,
    pedal: z.enum(["down", "up"]),
    ...sourced,
  }),
  z.object({
    type: z.literal("footer-summary"),
    text: z.string().min(1),
    ...sourced,
  }),
  z.object({
    type: z.literal("footer-theme"),
    name: z.string(),
    /** Right-hand notes, one array per bar. */
    bars: z.array(z.array(NoteSchema)).min(1),
    ...sourced,
  }),
  z.object({ type: z.literal("footer-drop"), name: z.string(), ...sourced }),
  z.object({
    type: z.literal("footer-road"),
    stops: z.array(z.object({ key: KeySchema, mood: z.string() })).min(1),
    ...sourced,
  }),
  z.object({ type: z.literal("end"), ...sourced }),
  z.object({ type: z.literal("parse-error"), reason: z.string(), ...sourced }),
]);
export type GridItem = z.infer<typeof GridItemSchema>;
