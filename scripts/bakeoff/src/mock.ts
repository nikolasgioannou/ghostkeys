import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * A stand-in for Claude so the runner and the listening page can be built
 * and tested without spending money. It writes simple but valid chunks: a
 * melody over a left-hand arpeggio in 3/4, different for every call.
 */

interface MockChord {
  roman: string;
  /** Chord tones for the melody. */
  melody: string[];
  /** Bass then arpeggio, six eighth notes filling a 3/4 bar. */
  left: string[];
}

const CHORDS: MockChord[] = [
  {
    roman: "I",
    melody: ["F5", "Ab5", "Db5"],
    left: ["Db2", "Ab2", "F3", "Ab3", "Db4", "Ab3"],
  },
  {
    roman: "IV",
    melody: ["Gb5", "Bb5", "Db5"],
    left: ["Gb1", "Db2", "Bb2", "Db3", "Gb3", "Db3"],
  },
  {
    roman: "vi",
    melody: ["F5", "Bb5", "Db5"],
    left: ["Bb1", "F2", "Db3", "F3", "Bb3", "F3"],
  },
];
const DOMINANT: MockChord = {
  roman: "V7",
  melody: ["Ab5", "Eb5", "Gb5"],
  left: ["Ab1", "Eb2", "C3", "Gb3", "Ab3", "Eb3"],
};

/** A simple, valid chunk of `bars` bars; `call` varies the melody and harmony. */
export function mockChunkText(bars: number, call: number): string {
  const plan: string[] = [];
  const body: string[] = [];
  for (let bar = 1; bar <= bars; bar++) {
    const last = bar === bars;
    const chord = last
      ? DOMINANT
      : (CHORDS[(bar + call) % CHORDS.length] ?? DOMINANT);
    const dynamic = bar === 1 ? " dyn=p" : "";
    const cadence = last ? " cad=HC" : "";
    plan.push(
      `P${String(bar)} key=Db ${chord.roman}${dynamic} tex=nocturne-arp${cadence}`,
    );
    const top = chord.melody[(bar + call) % chord.melody.length] ?? "F5";
    const next = chord.melody[(bar + call + 1) % chord.melody.length] ?? "Ab5";
    const left = chord.left
      .map((pitch, i) => `${pitch}@${String(i * 6)}:6`)
      .join(" ");
    body.push(
      `B${String(bar)} R: ${top}@0:24 ${next}@24:12 | L: ${left} | ped: c0`,
    );
  }
  return [
    "CHUNK meter=3/4 tempo=66 key=Db",
    ...plan,
    ...body,
    "HOLD",
    "H1 R: Gb5@0:12 F5@12:12 Eb5@24:12 | L: Ab1@0:6 Eb2@6:6 C3@12:24 | ped: c0",
    "H2 R: Eb5@0:24 C5@24:12 | L: Ab1@0:6 Eb2@6:6 Gb2@12:24 | ped: c0",
    "F key=Db chord=V7 ped=down",
    `F sum Mock chunk ${String(call + 1)} drifts over a Db nocturne bass.`,
    "F road Bbm:darker Db:home",
    "END",
  ].join("\n");
}

/** A simple, valid variant-A (ABC) reply of `bars` 3/4 bars. */
export function mockAbcText(bars: number, call: number): string {
  const melody = ["f4 ed", "a4 gf", "d'4 c'b", "f6"];
  const bass = [
    "D,,A,, F,A, DA,",
    "G,,,D,, B,,D, G,D,",
    "A,,,E,, C,G, A,E,",
    "B,,,F,, D,F, B,F,",
  ];
  const right = Array.from(
    { length: bars },
    (_, i) => melody[(i + call) % melody.length] ?? "f6",
  );
  const left = Array.from(
    { length: bars },
    (_, i) => bass[(i + call) % bass.length] ?? "D,,6",
  );
  const header = [
    "X:1",
    "M:3/4",
    "L:1/8",
    "Q:1/4=66",
    "K:Db",
    "V:RH clef=treble",
    "V:LH clef=bass",
  ];
  const lines: string[] = [];
  for (let start = 0; start < bars; start += 4) {
    const rh = right
      .slice(start, start + 4)
      .map((bar, i) => (start + i === 0 ? `!p! ${bar}` : bar));
    lines.push(
      `[V:RH] ${rh.join(" | ")} |`,
      `[V:LH] ${left.slice(start, start + 4).join(" | ")} |`,
    );
  }
  return [
    "ABC",
    ...header,
    ...lines,
    "HOLD",
    ...header,
    "[V:RH] !p! a4 gf | e6 |",
    "[V:LH] A,,,E,, C,G, A,E, | A,,,E,, C,G, A,E, |",
    "F key=Db chord=V7 ped=up",
    `F sum Mock ABC chunk ${String(call + 1)} sways over a Db bass.`,
    "F road Bbm:darker Db:home",
    "END",
  ].join("\n");
}

/**
 * A mock model whose every call returns a different valid chunk of `bars`
 * bars, in the grid format or (for variant A) in ABC. A revise turn (a prompt with more than one user message) gets an
 * empty correction, since the mock's chunks are already clean.
 */
export function mockModel(
  bars: number,
  format: "grid" | "abc" = "grid",
): MockLanguageModelV4 {
  let call = 0;
  return new MockLanguageModelV4({
    doStream: (options) => {
      const revising =
        options.prompt.filter((message) => message.role === "user").length > 1;
      const text = revising
        ? "END"
        : format === "abc"
          ? mockAbcText(bars, call++)
          : mockChunkText(bars, call++);
      const deltas = text.match(/[\s\S]{1,24}/g) ?? [];
      return Promise.resolve({
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start" as const, warnings: [] },
            { type: "text-start" as const, id: "t" },
            ...deltas.map((delta) => ({
              type: "text-delta" as const,
              id: "t",
              delta,
            })),
            { type: "text-end" as const, id: "t" },
            {
              type: "finish" as const,
              finishReason: { unified: "stop" as const, raw: "end_turn" },
              usage: {
                inputTokens: {
                  total: 4200,
                  noCache: 0,
                  cacheRead: 4200,
                  cacheWrite: 0,
                },
                outputTokens: {
                  total: Math.round(text.length / 1.3),
                  text: Math.round(text.length / 1.3),
                  reasoning: 0,
                },
              },
            },
          ],
        }),
      });
    },
  });
}
