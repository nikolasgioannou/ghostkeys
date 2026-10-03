/**
 * Scientific pitch notation: an uppercase letter A–G, an optional accidental
 * (`#`, `b`, or the double `##` or `bb`), and an octave 0–8. C4 is middle C, MIDI 60.
 * ASCII only. The grid format writes every pitch this way.
 */

/** The lowest key on a piano, A0. */
export const PIANO_LOWEST_MIDI = 21;
/** The highest key on a piano, C8. */
export const PIANO_HIGHEST_MIDI = 108;

const PITCH_PATTERN = /^([A-G])(##|bb|[#b]?)([0-8])$/;

const LETTER_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const SHARP_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;
const FLAT_NAMES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

/**
 * The MIDI number of a pitch such as `C4`, `F#3` or `Bb5`, or `null` if the
 * text isn't valid pitch notation. Accidentals may cross octave lines:
 * `Cb4` is B3 (59), `B#3` is C4 (60) and `Bbb2` is A2 (45).
 */
export function pitchToMidi(pitch: string): number | null {
  const match = PITCH_PATTERN.exec(pitch);
  if (!match) return null;
  const [, letter = "", accidental, octave = ""] = match;
  const semitone = LETTER_SEMITONES[letter] ?? 0;
  const shift =
    { "": 0, "#": 1, b: -1, "##": 2, bb: -2 }[accidental ?? ""] ?? 0;
  return (Number(octave) + 1) * 12 + semitone + shift;
}

/**
 * The pitch name for a MIDI number, spelled with sharps unless flats are
 * asked for. Returns `null` outside the octaves the notation covers (C0–B8).
 */
export function midiToPitch(
  midi: number,
  spelling: "sharp" | "flat" = "sharp",
): string | null {
  if (!Number.isInteger(midi) || midi < 12 || midi > 119) return null;
  const names = spelling === "flat" ? FLAT_NAMES : SHARP_NAMES;
  const octave = Math.floor(midi / 12) - 1;
  return `${names[midi % 12] ?? ""}${String(octave)}`;
}

/** Whether a MIDI number is a key on an 88-key piano (A0–C8). */
export function isOnPiano(midi: number): boolean {
  return (
    Number.isInteger(midi) &&
    midi >= PIANO_LOWEST_MIDI &&
    midi <= PIANO_HIGHEST_MIDI
  );
}

/** Keys whose signatures use flats, by tonic. */
const FLAT_MAJOR_TONICS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"]);
const FLAT_MINOR_TONICS = new Set(["D", "G", "C", "F", "Bb", "Eb", "Ab"]);

/** How to spell black keys in a key: flats in flat keys, sharps otherwise. */
export function spellingFor(key: {
  tonic: string;
  mode: "major" | "minor";
}): "sharp" | "flat" {
  const flats = key.mode === "major" ? FLAT_MAJOR_TONICS : FLAT_MINOR_TONICS;
  return flats.has(key.tonic) ? "flat" : "sharp";
}
