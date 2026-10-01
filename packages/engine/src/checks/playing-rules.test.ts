import { describe, expect, it } from "vitest";

import { createGridLineParser } from "../grid/line-parser.ts";
import type { GridItem } from "../grid/schema.ts";
import { WORKED_EXAMPLE } from "../grid/worked-example.fixture.ts";
import { barLength, checkChunk } from "./playing-rules.ts";

function parse(text: string): GridItem[] {
  const parser = createGridLineParser();
  return text.split("\n").flatMap((line) => {
    const item = parser.line(line);
    return item ? [item] : [];
  });
}

const HEADER = "CHUNK meter=4/4 tempo=72 key=C";
const HOLD = [
  "HOLD",
  "H1 R: E5@0:48 | L: C3@0:48 | ped: c0",
  "H2 R: D5@0:48 | L: G2@0:48 | ped: c0",
];
const FOOTER = ["F key=C chord=V ped=down", "F sum A test chunk.", "END"];

/** A valid one-bar chunk in 4/4, with the given bar line swapped in. */
function chunk(
  bar: string,
  options: { plan?: string; hold?: string[] } = {},
): string {
  return [
    HEADER,
    options.plan ?? "P1 key=C I dyn=p",
    bar,
    ...(options.hold ?? HOLD),
    ...FOOTER,
  ].join("\n");
}

function rules(text: string): string[] {
  return checkChunk(parse(text)).map((violation) => violation.rule);
}

describe("barLength", () => {
  it("counts 12 slots per quarter", () => {
    expect(barLength({ numerator: 4, denominator: 4 })).toBe(48);
    expect(barLength({ numerator: 3, denominator: 4 })).toBe(36);
    expect(barLength({ numerator: 6, denominator: 8 })).toBe(36);
    expect(barLength({ numerator: 2, denominator: 2 })).toBe(48);
  });
});

describe("checkChunk", () => {
  it("passes the worked example cleanly", () => {
    expect(checkChunk(parse(WORKED_EXAMPLE))).toEqual([]);
  });

  it("passes a valid minimal chunk", () => {
    expect(rules(chunk("B1 R: E5@0:48 | L: C3@0:48 | ped: c0"))).toEqual([]);
  });

  it.each([
    [
      "onset-outside-bar",
      "B1 R: E5@0:24 F5@48:6 | L: C3@0:48",
      "B1 R: E5@0:24 F5@42:6 | L: C3@0:48",
    ],
    [
      "note-past-barline",
      "B1 R: E5@24:30 | L: C3@0:48",
      "B1 R: E5@24:24 | L: C3@0:48",
    ],
    [
      "pitch-out-of-range",
      "B1 R: D8@0:48 | L: C3@0:48",
      "B1 R: C8@0:48 | L: C3@0:48",
    ],
    [
      "pitch-out-of-range",
      "B1 R: E5@0:48 | L: G0@0:48",
      "B1 R: E5@0:48 | L: A0@0:48",
    ],
    [
      "too-many-notes",
      "B1 R: C5+D5+E5+F5+G5+A5@0:48 | L: C3@0:48",
      "B1 R: C5+D5+E5+F5+G5@0:48 | L: C3@0:48",
    ],
    [
      "hand-span",
      "B1 R: C4+F5@0:48 | L: C3@0:48",
      "B1 R: C4+E5@0:48 | L: C3@0:48",
    ],
  ])("%s: flags the bad bar and passes the fixed one", (rule, bad, good) => {
    expect(rules(chunk(bad))).toContain(rule);
    expect(rules(chunk(good))).not.toContain(rule);
  });

  it("allows a wide arpeggio across onsets", () => {
    expect(
      rules(chunk("B1 R: E5@0:48 | L: C2@0:12 G2@12:12 E3@24:12 C4@36:12")),
    ).toEqual([]);
  });

  it("locates a violation and words it for the revise prompt", () => {
    const [violation] = checkChunk(parse(chunk("B1 R: E5@24:30 | L: C3@0:48")));
    expect(violation).toEqual({
      rule: "note-past-barline",
      severity: "hard",
      where: { kind: "bar", bar: 1 },
      hand: "right",
      message:
        "Bar 1, right hand: E5 at slot 24 lasts 30 slots and runs past the barline (slot 48). Shorten it, or end it at the barline and tie it with ~.",
    });
  });

  describe("ties", () => {
    const two = (b1: string, b2: string) =>
      [
        HEADER,
        "P1 key=C I dyn=p",
        "P2 key=C V",
        b1,
        b2,
        ...HOLD,
        ...FOOTER,
      ].join("\n");

    it("accepts a tie met by the same pitch at slot 0", () => {
      expect(
        rules(
          two(
            "B1 R: E5@24:24~ | L: C3@0:48",
            "B2 R: E5@0:12 D5@12:36 | L: G2@0:48",
          ),
        ),
      ).toEqual([]);
    });

    it("flags a tie the next bar doesn't continue", () => {
      expect(
        rules(
          two("B1 R: E5@24:24~ | L: C3@0:48", "B2 R: D5@0:48 | L: G2@0:48"),
        ),
      ).toContain("tie-unmatched");
    });

    it("flags a tie that doesn't end at the barline", () => {
      expect(
        rules(
          two("B1 R: E5@24:12~ | L: C3@0:48", "B2 R: E5@0:48 | L: G2@0:48"),
        ),
      ).toContain("tie-not-at-barline");
    });

    it("flags a tie out of the chunk's last bar", () => {
      expect(rules(chunk("B1 R: E5@24:24~ | L: C3@0:48"))).toContain(
        "tie-unmatched",
      );
    });
  });

  describe("structure", () => {
    it("flags a bar without a plan line", () => {
      expect(
        rules(
          chunk("B1 R: E5@0:48 | L: C3@0:48", { plan: "P2 key=C I dyn=p" }),
        ),
      ).toContain("bar-without-plan");
    });

    it("flags bars out of sequence", () => {
      expect(
        rules(
          chunk("B2 R: E5@0:48 | L: C3@0:48", { plan: "P2 key=C I dyn=p" }),
        ),
      ).toContain("bar-sequence");
    });

    it("flags a missing first dynamic", () => {
      expect(
        rules(chunk("B1 R: E5@0:48 | L: C3@0:48", { plan: "P1 key=C I" })),
      ).toContain("missing-first-dynamic");
    });

    it("flags a missing HOLD block, footer and END", () => {
      const text = [
        HEADER,
        "P1 key=C I dyn=p",
        "B1 R: E5@0:48 | L: C3@0:48",
      ].join("\n");
      expect(rules(text)).toEqual(
        expect.arrayContaining([
          "missing-hold",
          "missing-footer-state",
          "missing-summary",
          "missing-end",
        ]),
      );
    });

    it("turns parse errors and unparsed bars into violations", () => {
      expect(rules(chunk("B1 R: nonsense | L: C3@0:48"))).toContain(
        "parse-error",
      );
      expect(
        rules([HEADER, "Here you go:", "P1 key=C I dyn=p"].join("\n")),
      ).toContain("parse-error");
    });
  });

  describe("the holding pattern", () => {
    it("must have 2–4 bars", () => {
      const one = ["HOLD", "H1 R: E5@0:48 | L: C3@0:48 | ped: c0"];
      expect(
        rules(chunk("B1 R: E5@0:48 | L: C3@0:48", { hold: one })),
      ).toContain("hold-length");
    });

    it("can't tie out of its last bar", () => {
      const hold = [
        "HOLD",
        "H1 R: E5@0:48 | L: C3@0:48 | ped: c0",
        "H2 R: D5@24:24~ | L: G2@0:48 | ped: c0",
      ];
      expect(rules(chunk("B1 R: E5@0:48 | L: C3@0:48", { hold }))).toContain(
        "tie-unmatched",
      );
    });

    it("must not leave the pedal down across the loop point", () => {
      const hold = [
        "HOLD",
        "H1 R: E5@0:48 | L: C3@0:48 | ped: v12",
        "H2 R: D5@0:48 | L: G2@0:48",
      ];
      expect(rules(chunk("B1 R: E5@0:48 | L: C3@0:48", { hold }))).toContain(
        "hold-pedal",
      );
      const lifted = [
        "HOLD",
        "H1 R: E5@0:48 | L: C3@0:48 | ped: v12",
        "H2 R: D5@0:48 | L: G2@0:48 | ped: ^40",
      ];
      expect(
        rules(chunk("B1 R: E5@0:48 | L: C3@0:48", { hold: lifted })),
      ).not.toContain("hold-pedal");
    });

    it("checks its bars like any other bar", () => {
      const hold = [
        "HOLD",
        "H1 R: E5@0:60 | L: C3@0:48 | ped: c0",
        "H2 R: D5@0:48 | L: G2@0:48 | ped: c0",
      ];
      const [violation] = checkChunk(
        parse(chunk("B1 R: E5@0:48 | L: C3@0:48", { hold })),
      );
      expect(violation).toMatchObject({
        rule: "note-past-barline",
        where: { kind: "hold", bar: 1 },
      });
    });
  });
});
