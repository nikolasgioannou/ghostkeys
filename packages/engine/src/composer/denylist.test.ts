import { describe, expect, it } from "vitest";

import { WORKED_EXAMPLE } from "../grid/worked-example.fixture.ts";
import {
  assertNoDeniedNames,
  DeniedNameError,
  findDeniedNames,
} from "./denylist.ts";
import { TEXTURE_EXAMPLES } from "./texture-examples.ts";

describe("findDeniedNames", () => {
  it.each([
    ["play it like Chopin", ["chopin"]],
    ["something Chopinesque", ["chopinesque"]],
    ["a Lisztian cadenza", ["lisztian"]],
    ["like Rachmaninoff's preludes", ["rachmaninoff's"]],
    ["Schumann and Brahms", ["schumann", "brahms"]],
    ["in the manner of Dvořák", ["dvorak"]],
    ["a Fauré-like turn", ["faure"]],
    ["the Kinderszenen mood", ["kinderszenen"]],
    ["quote Träumerei", ["traumerei"]],
    ["like Op. 10 No. 9", ["op. 10"]],
    ["BWV 846", ["bwv 846"]],
  ])("finds the name in %j", (text, expected) => {
    expect(findDeniedNames(text)).toEqual(expected);
  });

  it.each([
    "darker and slower, a stormy C minor",
    "unravel the theme over a waltz bass",
    "a nocturne-like left hand, then a chorale",
    "drift toward Gb major, warmer, with octaves in the bass",
  ])("finds nothing in %j", (text) => {
    expect(findDeniedNames(text)).toEqual([]);
  });

  it("finds nothing in grid text", () => {
    expect(findDeniedNames(WORKED_EXAMPLE)).toEqual([]);
    for (const example of TEXTURE_EXAMPLES)
      expect(findDeniedNames(example.grid)).toEqual([]);
  });

  it("catches every cited composer", () => {
    for (const example of TEXTURE_EXAMPLES) {
      expect(findDeniedNames(example.citation.composer)).not.toEqual([]);
    }
  });
});

describe("assertNoDeniedNames", () => {
  it("throws a DeniedNameError naming what it found", () => {
    expect(() => {
      assertNoDeniedNames("make it Wagnerian", "The steering note");
    }).toThrow(DeniedNameError);
    expect(() => {
      assertNoDeniedNames("make it Wagnerian", "The steering note");
    }).toThrow(/The steering note names a composer or work \(wagnerian\)/);
  });
});
