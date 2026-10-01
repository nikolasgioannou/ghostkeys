import { describe, expect, it } from "vitest";

import { createGridLineParser } from "../grid/line-parser.ts";
import type { GridItem } from "../grid/schema.ts";
import { WORKED_EXAMPLE } from "../grid/worked-example.fixture.ts";
import { ComposerContextSchema, EMPTY_CONTEXT } from "./context.ts";
import {
  CONTEXT_BARS,
  MAX_THEMES,
  nextContext,
  SUMMARY_SENTENCES,
} from "./next-context.ts";

function complete(text: string): { items: GridItem[] } {
  const parser = createGridLineParser();
  return {
    items: text.split("\n").flatMap((line) => {
      const item = parser.line(line);
      return item ? [item] : [];
    }),
  };
}

const LINES = WORKED_EXAMPLE.split("\n");

/** A chunk of `bars` 3/4 bars in Db with the given footer lines. */
function chunk(footer: string[], bars = 2): string {
  const plans = Array.from(
    { length: bars },
    (_, i) => `P${String(i + 1)} key=Db I${i === 0 ? " dyn=p" : ""}`,
  );
  const body = Array.from(
    { length: bars },
    (_, i) => `B${String(i + 1)} R: F5@0:36 | L: Db3@0:36 | ped: c0`,
  );
  return [
    "CHUNK meter=3/4 tempo=66 key=Db",
    ...plans,
    ...body,
    "HOLD",
    "H1 R: F5@0:36 | L: Db3@0:36 | ped: c0",
    "H2 R: Ab5@0:36 | L: Ab2@0:36 | ped: c0",
    ...footer,
    "END",
  ].join("\n");
}

describe("nextContext", () => {
  it("carries the worked example forward from a fresh piece", () => {
    const context = nextContext(EMPTY_CONTEXT, complete(WORKED_EXAMPLE));
    expect(ComposerContextSchema.parse(context)).toEqual(context);
    expect(context).toEqual({
      steeringNote: null,
      previousHeader: "CHUNK meter=3/4 tempo=66 key=Db",
      previousBars: [
        ...LINES.filter((line) => /^P[1-4] /.test(line)),
        ...LINES.filter((line) => /^B[1-4] /.test(line)),
      ],
      previousFooter: "F key=Db chord=V7 ped=down",
      themes: [{ name: "A", notes: "F5@0:24 Eb5@24:6 Db5@30:6" }],
      roadmap: "F road Bbm:darker Gb:warmer Db:home",
      summary:
        "The nocturne opens in Db: theme A sung over wide arpeggios, rising to a half cadence.",
    });
  });

  it("keeps only the last bars, with their plan lines", () => {
    const context = nextContext(
      EMPTY_CONTEXT,
      complete(chunk(["F key=Db chord=I ped=down", "F sum Six bars."], 6)),
    );
    expect(context.previousBars).toHaveLength(CONTEXT_BARS * 2);
    expect(context.previousBars[0]).toMatch(/^P3 /);
    expect(context.previousBars.at(-1)).toMatch(/^B6 /);
  });

  it("follows three chunks: themes added, replaced and dropped, the summary growing", () => {
    let context = nextContext(EMPTY_CONTEXT, complete(WORKED_EXAMPLE));
    context = nextContext(
      context,
      complete(
        chunk([
          "F key=Bbm chord=i ped=down",
          "F sum Theme A turns to Bb minor.",
          "F theme B Bb4@0:36",
          "F road Gb:warmer",
        ]),
      ),
    );
    expect(context.themes.map((theme) => theme.name)).toEqual(["A", "B"]);
    expect(context.roadmap).toBe("F road Gb:warmer");
    context = nextContext(
      context,
      complete(
        chunk([
          "F key=Gb chord=I ped=up",
          "F sum Theme B blooms in Gb.",
          "F theme A Gb5@0:36",
          "F drop B",
        ]),
      ),
    );
    expect(context.themes).toEqual([{ name: "A", notes: "Gb5@0:36" }]);
    expect(context.previousFooter).toBe("F key=Gb chord=I ped=up");
    expect(context.roadmap).toBe("F road Gb:warmer");
    expect(context.summary).toBe(
      "The nocturne opens in Db: theme A sung over wide arpeggios, rising to a half cadence. Theme A turns to Bb minor. Theme B blooms in Gb.",
    );
  });

  it("caps the theme bank, dropping the oldest", () => {
    let context = EMPTY_CONTEXT;
    for (const name of ["A", "B", "C", "D", "E", "F", "G"]) {
      context = nextContext(
        context,
        complete(
          chunk([
            "F key=Db chord=I ped=up",
            "F sum More.",
            `F theme ${name} F5@0:36`,
          ]),
        ),
      );
    }
    expect(context.themes.map((theme) => theme.name)).toEqual([
      "C",
      "D",
      "E",
      "F",
      "G",
    ]);
    expect(context.themes).toHaveLength(MAX_THEMES);
  });

  it("keeps the summary bounded however long the piece runs", () => {
    let context = EMPTY_CONTEXT;
    for (let i = 1; i <= 40; i++) {
      context = nextContext(
        context,
        complete(
          chunk([
            "F key=Db chord=I ped=up",
            `F sum Chunk ${String(i)} happened.`,
          ]),
        ),
      );
    }
    expect(context.summary.split(". ")).toHaveLength(SUMMARY_SENTENCES);
    expect(context.summary).toMatch(/Chunk 40 happened\.$/);
    expect(JSON.stringify(context).length).toBeLessThan(2000);
  });

  it("keeps what a footer leaves out, and the steering note", () => {
    const before = {
      ...nextContext(EMPTY_CONTEXT, complete(WORKED_EXAMPLE)),
      steeringNote: "Grow darker.",
    };
    const after = nextContext(
      before,
      complete(chunk(["F key=Db chord=I ped=up", "F sum A quiet bar."])),
    );
    expect(after.themes).toEqual(before.themes);
    expect(after.roadmap).toBe(before.roadmap);
    expect(after.steeringNote).toBe("Grow darker.");
  });
});
