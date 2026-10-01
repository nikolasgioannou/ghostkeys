import { describe, expect, it } from "vitest";

import { type ComposerContext, EMPTY_CONTEXT } from "./context.ts";
import { DeniedNameError, findDeniedNames } from "./denylist.ts";
import { buildComposerMessage, COMPOSER_SYSTEM_PROMPT } from "./prompt.ts";
import { TEXTURE_EXAMPLES } from "./texture-examples.ts";

const CONTEXT: ComposerContext = {
  steeringNote:
    "Grow darker and slower over the next chunk; let the left hand thicken into octaves.",
  previousHeader: "CHUNK meter=3/4 tempo=66 key=Db",
  previousBars: [
    "P4 key=Db V7 cad=HC dyn=mp> tex=nocturne-arp",
    "B4 R: Ab5@0:12 Gb5@12:12 Eb5@24:12 | L: Ab1@0:6 Eb2@6:6 C3@12:6 Gb3@18:6 Ab3@24:12 | ped: c0 | t: rit",
  ],
  previousFooter: "F key=Db chord=V7 ped=down",
  themes: [{ name: "A", notes: "F5@0:24 Eb5@24:6 Db5@30:6" }],
  roadmap: "F road Bbm:darker Gb:warmer Db:home",
  summary:
    "Two chunks in: theme A has been sung twice in Db and is drifting toward Bb minor.",
};

describe("COMPOSER_SYSTEM_PROMPT", () => {
  it("includes every texture example, by label and grid only", () => {
    for (const example of TEXTURE_EXAMPLES) {
      expect(COMPOSER_SYSTEM_PROMPT).toContain(example.label);
      expect(COMPOSER_SYSTEM_PROMPT).toContain(example.grid.trim());
      expect(COMPOSER_SYSTEM_PROMPT).not.toContain(example.citation.work);
      expect(COMPOSER_SYSTEM_PROMPT).not.toContain(example.citation.source);
    }
  });

  it("names no composer or work", () => {
    expect(findDeniedNames(COMPOSER_SYSTEM_PROMPT)).toEqual([]);
  });

  it("asks for raw grid output only", () => {
    expect(COMPOSER_SYSTEM_PROMPT).toMatch(/no Markdown fences/);
    expect(COMPOSER_SYSTEM_PROMPT).toMatch(
      /starts with the CHUNK line and ends with END/,
    );
  });

  it("has no per-chunk content, so it stays identical across calls", () => {
    expect(COMPOSER_SYSTEM_PROMPT).not.toContain(CONTEXT.summary);
    expect(COMPOSER_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("buildComposerMessage", () => {
  it("asks Claude to choose everything for a fresh piece", () => {
    const message = buildComposerMessage(EMPTY_CONTEXT, { bars: 8 });
    expect(message).toMatch(
      /^This is the opening of a new piece\. Choose its key, meter, tempo and mood/,
    );
    expect(message).toContain("Write the next 8 bars (B1–B8).");
    expect(message).not.toContain("## How the last chunk ended");
  });

  it("carries a full context forward, verbatim", () => {
    const message = buildComposerMessage(CONTEXT, { bars: 16 });
    expect(message).toMatch(
      /^Continue the piece from where it left off\. Write the next 16 bars \(B1–B16\)\./,
    );
    expect(message).toContain(`## So far\n\n${CONTEXT.summary}`);
    expect(message).toContain("## Themes\n\n- A: F5@0:24 Eb5@24:6 Db5@30:6");
    expect(message).toContain(`## Roadmap\n\n${CONTEXT.roadmap ?? ""}`);
    expect(message).toContain(`## Direction\n\n${CONTEXT.steeringNote ?? ""}`);
    expect(message).toContain(
      [
        "## How the last chunk ended",
        "",
        CONTEXT.previousHeader,
        ...CONTEXT.previousBars,
        CONTEXT.previousFooter,
      ].join("\n"),
    );
  });

  it("leaves out sections with nothing in them", () => {
    const message = buildComposerMessage(
      { ...CONTEXT, steeringNote: null, roadmap: null, themes: [] },
      { bars: 16 },
    );
    expect(message).not.toContain("## Direction");
    expect(message).not.toContain("## Roadmap");
    expect(message).not.toContain("## Themes");
  });

  it.each([
    ["a cited composer", "Turn it toward Schumann's inner triplets."],
    ["a composer not among the citations", "Make it sound like Rachmaninoff."],
    ["an adjectival form", "Something Lisztian and stormy."],
    ["an opus number", "Like Op. 69."],
  ])("refuses to send %s in the steering note", (_, steeringNote) => {
    expect(() =>
      buildComposerMessage({ ...CONTEXT, steeringNote }, { bars: 16 }),
    ).toThrow(DeniedNameError);
  });

  it("refuses a summary that names a composer", () => {
    expect(() =>
      buildComposerMessage(
        { ...CONTEXT, summary: "A Chopinesque nocturne in Db." },
        { bars: 16 },
      ),
    ).toThrow(DeniedNameError);
  });
});
