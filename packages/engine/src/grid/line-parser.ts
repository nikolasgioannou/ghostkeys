import { pitchToMidi } from "../pitch.ts";
import type {
  BarBody,
  Dynamic,
  GridItem,
  Key,
  Meter,
  MotifUse,
  Note,
  PedalEvent,
  Roman,
  TempoMark,
} from "./schema.ts";

/**
 * The grid format's line parser (docs/design.md → Grid format): an
 * incremental state machine fed one complete line at a time. Each line
 * yields at most one item, emitted as soon as the line is complete, so the
 * streaming parser can wrap it without changes. Bad lines become
 * `parse-error` items; it never throws.
 */
export interface GridLineParser {
  /** Parses the next line. Returns `null` for blank lines and code fences. */
  line(text: string): GridItem | null;
}

type Section = "start" | "plan" | "bars" | "hold" | "footer" | "done";

class ParseError extends Error {}

export interface GridLineParserOptions {
  /**
   * Parse a revise reply (docs/design.md → Grid format → Revise reply): no
   * CHUNK header, and corrected plan and bar lines may come in any order.
   */
  revision?: boolean;
}

export function createGridLineParser(
  options: GridLineParserOptions = {},
): GridLineParser {
  const revision = options.revision ?? false;
  let section: Section = revision ? "plan" : "start";
  let lineNumber = 0;

  return {
    line(text) {
      lineNumber += 1;
      const source = text.replace(/\r$/, "");
      const trimmed = source.trim();
      if (trimmed === "" || trimmed.startsWith("```")) return null;

      const at = { line: lineNumber, source };
      const error = (reason: string): GridItem => ({
        type: "parse-error",
        reason,
        ...at,
      });

      if (section === "done") return error("text after END");

      const [head = ""] = trimmed.split(" ", 1);
      const rest = trimmed.slice(head.length).trim();

      try {
        if (head === "CHUNK") {
          if (section !== "start")
            return error("CHUNK header after the chunk started");
          section = "plan";
          return { type: "header", ...parseHeader(rest), ...at };
        }
        if (section === "start")
          return error("expected the CHUNK header first");

        const plan = /^P(\d+)$/.exec(head);
        if (plan) {
          if (section !== "plan" && !(revision && section === "bars"))
            return error("plan line after the bars started");
          return {
            type: "plan",
            bar: Number(plan[1]),
            ...parsePlan(rest),
            ...at,
          };
        }

        const bar = /^B(\d+)$/.exec(head);
        if (bar) {
          if (section !== "plan" && section !== "bars")
            return error("bar line out of place");
          section = "bars";
          return {
            type: "bar",
            bar: Number(bar[1]),
            ...barOrError(rest),
            ...at,
          };
        }

        // A revise reply may skip the bars and go straight to the holding
        // pattern, the footer or END.
        const afterBars =
          section === "bars" || (revision && section === "plan");

        if (head === "HOLD") {
          if (!afterBars || rest !== "") return error("HOLD out of place");
          section = "hold";
          return { type: "hold-start", ...at };
        }

        const hold = /^H(\d+)$/.exec(head);
        if (hold) {
          if (section !== "hold")
            return error("holding-pattern bar outside the HOLD block");
          return {
            type: "hold-bar",
            bar: Number(hold[1]),
            ...barOrError(rest),
            ...at,
          };
        }

        if (head === "F") {
          if (!afterBars && section !== "hold" && section !== "footer") {
            return error("footer line out of place");
          }
          section = "footer";
          return { ...parseFooter(rest), ...at };
        }

        if (head === "END") {
          if (rest !== "") return error("END takes nothing after it");
          if (!afterBars && section !== "hold" && section !== "footer") {
            return error("END before any bars");
          }
          section = "done";
          return { type: "end", ...at };
        }

        return error(`unrecognised line starting with "${head}"`);
      } catch (thrown) {
        if (thrown instanceof ParseError) return error(thrown.message);
        throw thrown;
      }
    },
  };
}

function fail(reason: string): never {
  throw new ParseError(reason);
}

function fields(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const token of text.split(" ")) {
    const eq = token.indexOf("=");
    if (eq <= 0) fail(`expected key=value, got "${token}"`);
    const name = token.slice(0, eq);
    if (map.has(name)) fail(`${name}= given twice`);
    map.set(name, token.slice(eq + 1));
  }
  return map;
}

function required(map: Map<string, string>, name: string): string {
  const value = map.get(name);
  if (value === undefined) fail(`missing ${name}=`);
  return value;
}

export function parseKey(text: string): Key {
  const match = /^([A-G][#b]?)(m?)$/.exec(text);
  if (!match) fail(`not a key: "${text}"`);
  return { tonic: match[1] ?? "", mode: match[2] === "m" ? "minor" : "major" };
}

function parseMeter(text: string): Meter {
  const match = /^(\d+)\/(\d+)$/.exec(text);
  if (!match) fail(`not a meter: "${text}"`);
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (numerator < 1 || numerator > 16)
    fail(`meter numerator out of range: ${String(numerator)}`);
  if (
    denominator !== 2 &&
    denominator !== 4 &&
    denominator !== 8 &&
    denominator !== 16
  ) {
    fail(`meter denominator must be 2, 4, 8 or 16: ${String(denominator)}`);
  }
  return { numerator, denominator };
}

function parseHeader(text: string): { meter: Meter; tempo: number; key: Key } {
  const map = fields(text);
  for (const name of map.keys()) {
    if (name !== "meter" && name !== "tempo" && name !== "key")
      fail(`unknown header field ${name}=`);
  }
  const tempo = Number(required(map, "tempo"));
  if (!Number.isFinite(tempo) || tempo <= 0)
    fail("tempo must be a positive number");
  return {
    meter: parseMeter(required(map, "meter")),
    tempo,
    key: parseKey(required(map, "key")),
  };
}

const DEGREES = ["VII", "VI", "V", "IV", "III", "II", "I"] as const;
const DEGREE_NUMBER: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
};
const DEGREE_PATTERN = `([b#]?)(${DEGREES.join("|")}|${DEGREES.map((d) => d.toLowerCase()).join("|")})`;
const ROMAN_PATTERN = new RegExp(
  `^${DEGREE_PATTERN}(o|h|\\+)?(maj7|64|65|43|42|6|7)?(?:/${DEGREE_PATTERN})?$`,
);

function degree(accidental: string | undefined, numeral: string | undefined) {
  const text = numeral ?? "";
  const acc = accidental === "b" || accidental === "#" ? accidental : "";
  return {
    accidental: acc,
    degree:
      DEGREE_NUMBER[text.toUpperCase()] ?? fail(`not a degree: "${text}"`),
    minor: text === text.toLowerCase(),
  } as const;
}

export function parseRoman(text: string): Roman {
  if (text === "N6" || text === "It6" || text === "Fr6" || text === "Ger6") {
    return { kind: "named", text, chord: text };
  }
  const match = ROMAN_PATTERN.exec(text);
  if (!match) fail(`not a Roman numeral: "${text}"`);
  const [, acc, numeral, qualityMark, figure, secAcc, secNumeral] = match;
  const quality =
    qualityMark === "o"
      ? "diminished"
      : qualityMark === "h"
        ? "half-diminished"
        : qualityMark === "+"
          ? "augmented"
          : null;
  const isSeventh =
    figure === "7" || figure === "65" || figure === "43" || figure === "42";
  if (quality === "half-diminished" && !isSeventh)
    fail(`half-diminished needs a seventh: "${text}"`);
  const fig =
    figure === "6" ||
    figure === "64" ||
    figure === "7" ||
    figure === "65" ||
    figure === "43" ||
    figure === "42" ||
    figure === "maj7"
      ? figure
      : null;
  return {
    kind: "degree",
    text,
    ...degree(acc, numeral),
    quality,
    figure: fig,
    secondary: secNumeral === undefined ? null : degree(secAcc, secNumeral),
  };
}

const CADENCES = ["PAC", "IAC", "HC", "DC", "PC"] as const;
const LEVELS = ["pp", "p", "mp", "mf", "f", "ff"] as const;
const TRANSFORMS = [
  "orig",
  "frag",
  "seq",
  "inv",
  "aug",
  "dim",
  "reharm",
  "minor",
  "major",
] as const;

function parseDynamic(text: string): Dynamic {
  const match = /^(pp|p|mp|mf|f|ff)([<>]?)$/.exec(text);
  const level = LEVELS.find((l) => l === match?.[1]);
  if (!match || !level) fail(`not a dynamic: "${text}"`);
  return {
    level,
    hairpin:
      match[2] === "<" ? "crescendo" : match[2] === ">" ? "diminuendo" : null,
  };
}

function parseMotif(text: string): MotifUse {
  const [theme = "", transform = "orig", ...extra] = text.split(":");
  if (!/^[A-Z][A-Za-z0-9]*$/.test(theme) || extra.length > 0)
    fail(`not a motif: "${text}"`);
  const known = TRANSFORMS.find((t) => t === transform);
  if (!known) fail(`unknown motif transformation: "${transform}"`);
  return { theme, transform: known };
}

function parsePlan(text: string) {
  let key: Key | null = null;
  let chord: Roman | null = null;
  let cadence: (typeof CADENCES)[number] | null = null;
  let phraseEnd = false;
  let dynamic: Dynamic | null = null;
  let texture: string | null = null;
  let motif: MotifUse | null = null;
  const seen = new Set<string>();
  const once = (name: string) => {
    if (seen.has(name)) fail(`${name} given twice`);
    seen.add(name);
  };

  for (const token of text.split(" ").filter(Boolean)) {
    const eq = token.indexOf("=");
    if (token === "end") {
      once("end");
      phraseEnd = true;
    } else if (eq < 0) {
      once("Roman numeral");
      chord = parseRoman(token);
    } else {
      const name = token.slice(0, eq);
      const value = token.slice(eq + 1);
      once(name);
      if (name === "key") key = parseKey(value);
      else if (name === "cad") {
        // Claude often writes `cad=end` for a phrase end without a cadence.
        if (value === "end") phraseEnd = true;
        else
          cadence =
            CADENCES.find((c) => c === value) ??
            fail(`unknown cadence: "${value}"`);
      } else if (name === "dyn") dynamic = parseDynamic(value);
      else if (name === "tex") {
        if (!/^[a-z][a-z0-9-]*$/.test(value))
          fail(`not a texture tag: "${value}"`);
        texture = value;
      } else if (name === "motif") motif = parseMotif(value);
      else fail(`unknown plan field ${name}=`);
    }
  }
  if (!key) fail("missing key=");
  if (!chord) fail("missing the Roman numeral");
  return {
    key,
    chord,
    cadence,
    phraseEnd: phraseEnd || cadence !== null,
    dynamic,
    texture,
    motif,
  };
}

const NOTE_PATTERN =
  /^([A-G](?:##|bb|[#b])?[0-8](?:\+[A-G](?:##|bb|[#b])?[0-8])*)@(\d+):(\d+)([~!]{0,2})$/;

function parseNotes(text: string): Note[] {
  if (text === "-") return [];
  const notes: Note[] = [];
  let lastOnset = 0;
  for (const token of text.split(" ")) {
    const match = NOTE_PATTERN.exec(token);
    if (!match) fail(`not a note: "${token}"`);
    const [, pitches = "", onsetText, durationText, marks = ""] = match;
    if (marks === "~~" || marks === "!!") fail(`repeated mark in "${token}"`);
    const onset = Number(onsetText);
    const duration = Number(durationText);
    if (duration < 1) fail(`zero-length note: "${token}"`);
    if (onset < lastOnset) fail(`notes out of onset order at "${token}"`);
    lastOnset = onset;
    for (const pitch of pitches.split("+")) {
      const midi = pitchToMidi(pitch) ?? fail(`not a pitch: "${pitch}"`);
      notes.push({
        midi,
        onset,
        duration,
        tie: marks.includes("~"),
        melody: marks.includes("!"),
      });
    }
  }
  return notes;
}

function parsePedal(text: string): PedalEvent[] {
  return text.split(" ").map((token) => {
    const match = /^([v^c])(\d+)$/.exec(token);
    if (!match) fail(`not a pedal event: "${token}"`);
    const kind = match[1] === "v" ? "down" : match[1] === "^" ? "up" : "change";
    return { kind, slot: Number(match[2]) };
  });
}

function parseTempo(text: string): TempoMark[] {
  return text.split(" ").map((token): TempoMark => {
    if (token === "rit") return { kind: "rit" };
    if (token === "atempo") return { kind: "atempo" };
    const tempo = /^q=(\d+(?:\.\d+)?)$/.exec(token);
    if (tempo) return { kind: "tempo", bpm: Number(tempo[1]) };
    const fermata = /^fermata@(\d+)$/.exec(token);
    if (fermata) return { kind: "fermata", slot: Number(fermata[1]) };
    return fail(`not a tempo mark: "${token}"`);
  });
}

function parseBarBody(text: string): BarBody {
  const [right, left, ...rest] = text.split(" | ");
  // Claude sometimes runs `t:` on from `ped:` without the separator.
  const extra = rest.flatMap((section) => section.split(/ (?=(?:ped|t): )/));
  if (!right?.startsWith("R: ")) fail('a bar starts with "R: "');
  if (!left?.startsWith("L: ")) fail('the second section is "L: "');
  let pedal: PedalEvent[] = [];
  let tempo: TempoMark[] = [];
  const seen = new Set<string>();
  for (const section of extra) {
    const name = section.slice(0, section.indexOf(": "));
    if (seen.has(name)) fail(`${name}: given twice`);
    seen.add(name);
    if (name === "ped") pedal = parsePedal(section.slice(5));
    else if (name === "t") tempo = parseTempo(section.slice(3));
    else fail(`unknown bar section "${section}"`);
  }
  return {
    right: parseNotes(right.slice(3)),
    left: parseNotes(left.slice(3)),
    pedal,
    tempo,
  };
}

function barOrError(text: string): {
  body: BarBody | null;
  error: string | null;
} {
  try {
    return { body: parseBarBody(text), error: null };
  } catch (thrown) {
    if (thrown instanceof ParseError)
      return { body: null, error: thrown.message };
    throw thrown;
  }
}

type FooterItem = Extract<
  GridItem,
  {
    type:
      | "footer-state"
      | "footer-summary"
      | "footer-theme"
      | "footer-drop"
      | "footer-road";
  }
>;
type Unsourced<T> = T extends unknown ? Omit<T, "line" | "source"> : never;

function parseFooter(text: string): Unsourced<FooterItem> {
  const [kind = "", ...words] = text.split(" ");
  const rest = words.join(" ");
  if (kind.startsWith("key=")) {
    const map = fields(text);
    for (const name of map.keys()) {
      if (name !== "key" && name !== "chord" && name !== "ped")
        fail(`unknown footer field ${name}=`);
    }
    const pedal = required(map, "ped");
    if (pedal !== "down" && pedal !== "up")
      fail(`ped= must be down or up: "${pedal}"`);
    return {
      type: "footer-state",
      key: parseKey(required(map, "key")),
      chord: parseRoman(required(map, "chord")),
      pedal,
    };
  }
  if (kind === "sum") {
    if (rest === "") fail("empty summary");
    return { type: "footer-summary", text: rest };
  }
  if (kind === "theme") {
    const [name = "", ...notes] = words;
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) fail(`not a theme name: "${name}"`);
    const bars = notes
      .join(" ")
      .split(" / ")
      .map((bar) => parseNotes(bar.trim()));
    if (bars.length === 0 || bars.every((bar) => bar.length === 0))
      fail("theme has no notes");
    return { type: "footer-theme", name, bars };
  }
  if (kind === "drop") {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(rest)) fail(`not a theme name: "${rest}"`);
    return { type: "footer-drop", name: rest };
  }
  if (kind === "road") {
    if (words.length === 0) fail("empty roadmap");
    const stops = words.map((word) => {
      const colon = word.indexOf(":");
      if (colon <= 0 || colon === word.length - 1)
        fail(`expected key:mood, got "${word}"`);
      return {
        key: parseKey(word.slice(0, colon)),
        mood: word.slice(colon + 1),
      };
    });
    return { type: "footer-road", stops };
  }
  return fail(`unknown footer line "F ${kind}"`);
}
