/**
 * Short, labelled texture examples for the composer prompt. Each is a
 * complete grid fragment (header, plan lines, bars) transcribed from a
 * public-domain edition on the Mutopia Project: notes, onsets and durations
 * come from the edition's MIDI file (read with mido 1.3.3, one-off), the plan
 * lines (key, harmony, texture, dynamics) are our analysis. Only the texture
 * label and the grid reach Claude; the citation never does (invariant 3).
 */
export interface TextureExample {
  /** Shown to Claude. Describes the texture, never the source. */
  label: string;
  /** The grid fragment, in the format from docs/design.md → Grid format. */
  grid: string;
  /** Where it came from. Never sent to Claude. */
  citation: {
    composer: string;
    work: string;
    bars: string;
    source: string;
    licence: string;
    notes: string;
  };
}

export const TEXTURE_EXAMPLES: readonly TextureExample[] = [
  {
    label:
      "Melody over wide left-hand arpeggios, pedalled (the nocturne accompaniment)",
    grid: `CHUNK meter=6/8 tempo=144 key=Fm
P1 key=Fm i dyn=p tex=nocturne-arp
P2 key=Fm i
P3 key=Fm i
P4 key=Fm i
B1 R: F4@6:6 G4@12:6 Ab4@24:6 Bb4@30:6 | L: F2@0:3 C3@3:3 Ab3@6:3 C3@9:3 Bb3@12:3 C3@15:3 F2@18:3 C3@21:3 C4@24:3 C3@27:3 Db4@30:3 C3@33:3 | ped: v0 c18
B2 R: C5@6:6 Db5@12:6 C5@18:6 Ab5@24:6 G5@30:6 | L: F2@0:3 C3@3:3 C4@6:3 C3@9:3 Bb3@12:3 C3@15:3 F2@18:3 C3@21:3 Ab3@24:3 C3@27:3 Bb3@30:3 C3@33:3 | ped: c0 c18
B3 R: F5@0:6 C5@6:6 Db5@12:6 C5@18:6 Ab4@24:6 F4@30:6 | L: F2@0:3 C3@3:3 Ab3@6:3 C3@9:3 Bb3@12:3 C3@15:3 F2@18:3 C3@21:3 Ab3@24:3 C3@27:3 C4@30:3 C3@33:3 | ped: c0 c18
B4 R: C4@0:36 | L: F2@0:3 C3@3:3 G3@6:3 C3@9:3 Ab3@12:3 C3@15:3 F2@18:3 C3@21:3 Bb3@24:3 C3@27:3 G3@30:3 C3@33:3 | ped: c0 c18
`,
    citation: {
      composer: "Frédéric Chopin",
      work: "Étude in F minor, Op. 10 No. 9",
      bars: "1–4",
      source:
        "https://www.mutopiaproject.org/ftp/ChopinFF/O10/chopin-op-10-09-wfi/chopin-op-10-09-wfi.mid",
      licence:
        "Public Domain (Mutopia Project; Peters edition, Herrmann Scholtz, 1900)",
      notes: "C♯ in the MIDI spelled D♭ for F minor.",
    },
  },
  {
    label:
      "Waltz: a bass note on the downbeat, chords on beats two and three, a singing melody above",
    grid: `CHUNK meter=3/4 tempo=152 key=Bm
P1 key=Bm i dyn=p tex=waltz
P2 key=Bm V43
P3 key=Bm V65
P4 key=Bm i
B1 R: F#5@0:6 G5@6:6 F#5@12:6 C#5@18:6 D5@24:6 B4@30:6 | L: B2@0:12 F#3+B3+D4@12:12 F#3+B3+D4@24:12 | ped: v0 ^24
B2 R: A#4@0:24 F#5@24:12~ | L: C#3@0:12 F#3+C#4+E4@12:12 F#3+C#4+E4@24:12 | ped: v0 ^24
B3 R: F#5@0:6 G5@6:6 F#5@12:6 C#5@18:6 E5@24:6 D5@30:6 | L: A#2@0:12 F#3+C#4+E4@12:12 F#3+A#3+E4@24:12 | ped: v0 ^24
B4 R: B4@0:24 F#5@24:12 | L: B2@0:12 F#3+B3+D4@12:12 F#3+B3+D4@24:12 | ped: v0 ^24
`,
    citation: {
      composer: "Frédéric Chopin",
      work: "Waltz in B minor, Op. 69 No. 2",
      bars: "1–4 (after the pickup)",
      source:
        "https://www.mutopiaproject.org/ftp/ChopinFF/O69/w10-h-moll-cfi/w10-h-moll-cfi.mid",
      licence:
        "Public Domain (Mutopia Project; Peters edition, Herrmann Scholtz, 1900)",
      notes:
        "The pickup is left out; bar 1 starts with its held F♯. B♭ in the MIDI spelled A♯ for B minor. The last F♯ ends at the barline instead of tying out of the excerpt.",
    },
  },
  {
    label:
      "Melody over inner triplets shared between the hands, a bass note on each beat",
    grid: `CHUNK meter=2/4 tempo=72 key=G
P1 key=G I dyn=p tex=inner-triplets
P2 key=G V7
P3 key=G I
P4 key=G V7
B1 R: B4@0:12 G4@8:4 G5@12:12 G4@20:4 | L: G3@0:6 B3@0:4 D4@4:4 C#3@12:6 Bb3@12:4 E4@16:4
B2 R: F#5@0:9 F#4@8:4 E5@9:3 D5@12:12 A4@20:4 | L: D3@0:6 A3@0:4 D4@4:4 F#3@12:6 C4@12:4 D4@16:4
B3 R: B4@0:12 G4@8:4 G5@12:12 G4@20:4 | L: G3@0:6 B3@0:4 D4@4:4 C#3@12:6 Bb3@12:4 E4@16:4
B4 R: F#5@0:9 F#4@8:4 E5@9:3 D5@12:12 A4@20:4 | L: D3@0:6 A3@0:4 D4@4:4 F#3@12:6 C4@12:4 D4@16:4
`,
    citation: {
      composer: "Robert Schumann",
      work: "Kinderszenen, Op. 15 No. 1 (Von fremden Ländern und Menschen)",
      bars: "1–4",
      source:
        "https://www.mutopiaproject.org/ftp/SchumannR/O15/SchumannOp15No01/SchumannOp15No01.mid",
      licence: "Public Domain (Mutopia Project; Leichte Stücke, 1900)",
      notes: "The MIDI has no pedal events, so none are written.",
    },
  },
];
