/**
 * Bake-off variant A (docs/design.md → Bake-off): does plain ABC notation,
 * which models have seen a lot of, beat the grid format? Claude writes ABC
 * with the same role and originality rules; abcjs converts it to the
 * engine's bar schema so the playing rules, copy check and listening page
 * treat it like B and C. There are no plan lines, so there's no harmony
 * check and no plan-based rubato. ABC that can't convert exactly into the
 * grid's slots makes that bar invalid: the converter never rounds or moves a
 * note (invariant 1). This file is deleted if A loses.
 */
import {
  type BarBody,
  barLength,
  checkChunk,
  checkCopies,
  type ChunkUsage,
  COMPOSER_ROLE,
  type ComposerContext,
  type ComposerEvent,
  createGridLineParser,
  type GridItem,
  type Key,
  type Meter,
  type Note,
  parseKey,
  parseRoman,
} from "@ghostkeys/engine";
import type { Effort } from "@ghostkeys/engine/llm";
import abcjs from "abcjs";
import { type LanguageModel, type LanguageModelUsage, streamText } from "ai";

import type { RunFile } from "./run-file.ts";
import { runSession } from "./runner.ts";

export const ABC_SYSTEM_PROMPT = `${COMPOSER_ROLE}

## How to write a chunk

First plan the chunk: where it goes harmonically, how its phrases are shaped, which themes return and how. Then write it in the format below, and nothing else: no greeting, no explanation, no Markdown fences.

## The format

Your reply has four parts, in this order:

1. A line that says ABC, then the chunk as one ABC tune for two voices:
   - header lines X:1, M: (meter), L: (unit length), Q:1/4=NN (quarter notes per minute), K: (the key: a tonic plus m for minor, e.g. K:Db or K:Bbm), then V:RH clef=treble and V:LH clef=bass;
   - then the music, alternating a [V:RH] line and a [V:LH] line that cover the same bars, a few bars per line, every bar ending with |;
   - dynamics as decorations (!p!, !mf!, !crescendo(! … !crescendo)!); ties with -; chords in [ ]; tuplets as (3.
2. A line that says HOLD, then a second short ABC tune (same header lines) of 2–4 bars that continue from the chunk's last bar and can loop on their own while the next chunk is being written: the last bar leads back into the first, and nothing is tied out of the last bar.
3. Footer lines:
   - F key=<key> chord=<Roman numeral> ped=down|up: the key, last chord and pedal where the chunk ends (key like Db or Bbm, chord like V7 or iv6);
   - F sum <one sentence on what happened in this chunk, in musical terms>;
   - F road <key>:<mood> …: where the music goes next, 2–4 key areas with a mood word each.
4. A line that says END.`;

/** The user message for an ABC chunk: the same sections as the grid composer's, with the previous chunk's ABC. */
export function buildAbcMessage(
  context: ComposerContext,
  bars: number,
): string {
  const write = `Write the next ${String(bars)} bars.`;
  const sections = [
    context.previousHeader === null
      ? `This is the opening of a new piece. Choose its key, meter, tempo and mood, and introduce its first theme. ${write}`
      : `Continue the piece from where it left off. ${write}`,
  ];
  if (context.summary !== "") sections.push(`## So far\n\n${context.summary}`);
  if (context.roadmap !== null)
    sections.push(`## Roadmap\n\n${context.roadmap}`);
  if (context.steeringNote !== null)
    sections.push(`## Direction\n\n${context.steeringNote}`);
  if (context.previousHeader !== null) {
    sections.push(
      `## How the last chunk ended\n\n${[...context.previousBars, context.previousFooter ?? ""].join("\n").trim()}`,
    );
  }
  return sections.join("\n\n");
}

interface Sections {
  abc: string | null;
  hold: string | null;
  footer: string[];
  ended: boolean;
}

function splitReply(text: string): Sections {
  const lines = text.split("\n").map((line) => line.replace(/\r$/, ""));
  const result: Sections = { abc: null, hold: null, footer: [], ended: false };
  let current: "none" | "abc" | "hold" = "none";
  const abc: string[] = [];
  const hold: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "ABC") current = "abc";
    else if (trimmed === "HOLD") current = "hold";
    else if (trimmed.startsWith("F ")) result.footer.push(trimmed);
    else if (trimmed === "END") result.ended = true;
    else if (trimmed.startsWith("```")) continue;
    else if (current === "abc") abc.push(line);
    else if (current === "hold") hold.push(line);
  }
  result.abc = abc.length > 0 ? abc.join("\n") : null;
  result.hold = hold.length > 0 ? hold.join("\n") : null;
  return result;
}

const LEVELS = new Set(["pp", "p", "mp", "mf", "f", "ff"]);

interface Converted {
  meter: Meter;
  tempo: number;
  key: Key;
  bars: { body: BarBody | null; error: string | null }[];
  /** The dynamic each bar starts with (from the ABC's decorations), if any. */
  dynamics: (string | null)[];
}

const isWhole = (value: number) => Math.abs(value - Math.round(value)) < 1e-4;

/** Converts one ABC tune into bars of the grid's bar schema. Bars with notes that don't land on whole slots are invalid. */
export function convertAbc(abc: string): Converted | null {
  const tune = abcjs.parseOnly(abc).at(0);
  if (tune === undefined) return null;
  const meterMatch = /^M:\s*(\d+)\/(\d+)/m.exec(abc);
  const keyMatch = /^K:\s*([A-G][#b]?m?)\b/m.exec(abc);
  const tempoMatch = /^Q:\s*1\/4\s*=\s*(\d+(?:\.\d+)?)/m.exec(abc);
  if (!meterMatch || !keyMatch) return null;
  const numerator = Number(meterMatch[1]);
  const denominator = Number(meterMatch[2]);
  if (
    denominator !== 2 &&
    denominator !== 4 &&
    denominator !== 8 &&
    denominator !== 16
  )
    return null;
  const meter: Meter = { numerator, denominator };
  let key: Key;
  try {
    key = parseKey(keyMatch[1] ?? "");
  } catch {
    return null;
  }
  const length = barLength(meter);

  const audio = tune.setUpAudio({});
  const totalSlots = audio.totalDuration * 48;
  const barCount = Math.round(totalSlots / length);
  const bars = Array.from({ length: barCount }, () => ({
    right: [] as Note[],
    left: [] as Note[],
    error: null as string | null,
  }));

  audio.tracks.slice(0, 2).forEach((track, trackIndex) => {
    const hand = trackIndex === 0 ? "right" : "left";
    for (const item of track) {
      if (item.cmd !== "note") continue;
      const start = item.start * 48;
      const end = (item.start + item.duration) * 48;
      const barIndex = Math.floor((start + 1e-6) / length);
      const bar = bars[barIndex];
      if (!bar) continue;
      if (!isWhole(start) || !isWhole(end)) {
        bar.error = `a note at ${item.start.toFixed(4)} whole notes doesn't land on a grid slot`;
        continue;
      }
      let onset = Math.round(start);
      const stop = Math.round(end);
      // A note crossing barlines becomes tied pieces, exactly.
      while (onset < stop) {
        const index = Math.floor(onset / length);
        const target = bars[index];
        if (!target) break;
        const barEnd = (index + 1) * length;
        const pieceEnd = Math.min(stop, barEnd);
        target[hand].push({
          midi: item.pitch,
          onset: onset - index * length,
          duration: pieceEnd - onset,
          tie: pieceEnd < stop,
          melody: false,
        });
        onset = pieceEnd;
      }
    }
  });

  // Dynamics: the decorations on each bar of the first voice, counted across lines.
  const dynamics: (string | null)[] = Array.from(
    { length: barCount },
    () => null,
  );
  const counters = new Map<string, number>();
  for (const line of tune.lines) {
    (line.staff ?? []).forEach((staff, staffIndex) => {
      (staff.voices ?? []).forEach((voice, voiceIndex) => {
        const id = `${String(staffIndex)}:${String(voiceIndex)}`;
        let bar = counters.get(id) ?? 0;
        for (const element of voice) {
          if (element.el_type === "bar") bar += 1;
          else if (
            staffIndex === 0 &&
            voiceIndex === 0 &&
            element.el_type === "note"
          ) {
            const decorations =
              (element as { decoration?: string[] }).decoration ?? [];
            const level = decorations.find((decoration) =>
              LEVELS.has(decoration),
            );
            if (level && bar < barCount && dynamics[bar] === null)
              dynamics[bar] = level;
          }
        }
        counters.set(id, bar);
      });
    });
  }

  return {
    meter,
    tempo: tempoMatch ? Number(tempoMatch[1]) : 72,
    key,
    bars: bars.map((bar) => {
      const sort = (notes: Note[]) =>
        notes.toSorted((a, b) => a.onset - b.onset || a.midi - b.midi);
      return bar.error
        ? { body: null, error: bar.error }
        : {
            body: {
              right: sort(bar.right),
              left: sort(bar.left),
              pedal: [],
              tempo: [],
            },
            error: null,
          };
    }),
    dynamics,
  };
}

/**
 * Turns an ABC reply into grid items: the header, a plan line per bar that
 * carries only the ABC's dynamics (its chord is a placeholder and never
 * checked; variant A has no harmony plan), the bars, the holding pattern and
 * the footer.
 */
export function abcReplyToItems(text: string): {
  items: GridItem[];
  validBars: number;
  totalBars: number;
} {
  const sections = splitReply(text);
  const converted = sections.abc === null ? null : convertAbc(sections.abc);
  if (!converted) return { items: [], validBars: 0, totalBars: 0 };
  const keyText = `${converted.key.tonic}${converted.key.mode === "minor" ? "m" : ""}`;
  const meterText = `${String(converted.meter.numerator)}/${String(converted.meter.denominator)}`;
  let line = 0;
  const at = (source: string) => ({ line: ++line, source });

  const items: GridItem[] = [
    {
      type: "header",
      meter: converted.meter,
      tempo: converted.tempo,
      key: converted.key,
      ...at(
        `CHUNK meter=${meterText} tempo=${String(converted.tempo)} key=${keyText} (from ABC)`,
      ),
    },
  ];
  converted.bars.forEach((_, index) => {
    const level = converted.dynamics[index] ?? null;
    const dynamic =
      level === null ? null : { level: level as "p", hairpin: null };
    items.push({
      type: "plan",
      bar: index + 1,
      key: converted.key,
      chord: parseRoman("I"),
      cadence: null,
      phraseEnd: false,
      dynamic,
      texture: null,
      motif: null,
      ...at(`P${String(index + 1)} (from ABC: dynamics only)`),
    });
  });
  converted.bars.forEach((bar, index) => {
    items.push({
      type: "bar",
      bar: index + 1,
      ...bar,
      ...at(`B${String(index + 1)} (from ABC)`),
    });
  });

  const hold = sections.hold === null ? null : convertAbc(sections.hold);
  if (hold) {
    items.push({ type: "hold-start", ...at("HOLD") });
    hold.bars.forEach((bar, index) => {
      items.push({
        type: "hold-bar",
        bar: index + 1,
        ...bar,
        ...at(`H${String(index + 1)} (from ABC)`),
      });
    });
  }

  const parser = createGridLineParser({ revision: true });
  for (const footer of sections.footer) {
    const item = parser.line(footer);
    if (item) items.push({ ...item, line: ++line });
  }
  if (sections.ended) items.push({ type: "end", ...at("END") });

  const validBars = converted.bars.filter((bar) => bar.error === null).length;
  return { items, validBars, totalBars: converted.bars.length };
}

function toUsage(usage: LanguageModelUsage): ChunkUsage {
  return {
    inputTokens: usage.inputTokens ?? null,
    cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? null,
    cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    reasoningTokens: usage.outputTokenDetails.reasoningTokens ?? null,
  };
}

/** Composes one ABC chunk. Same shape of events as the grid composer, so the runner and page treat it alike. */
export async function* composeAbcChunk(options: {
  model: LanguageModel;
  context: ComposerContext;
  bars: number;
  effort: Effort;
}): AsyncGenerator<ComposerEvent> {
  const started = performance.now();
  let firstTokenMs: number | null = null;
  const result = streamText({
    model: options.model,
    instructions: {
      role: "system",
      content: ABC_SYSTEM_PROMPT,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } },
      },
    },
    messages: [
      { role: "user", content: buildAbcMessage(options.context, options.bars) },
    ],
    maxOutputTokens: 32_000,
    streamRetries: 0,
    providerOptions: {
      anthropic: {
        effort: options.effort,
        thinking: { type: "adaptive", display: "omitted" },
      },
    },
  });
  let text = "";
  for await (const delta of result.textStream) {
    firstTokenMs ??= performance.now() - started;
    text += delta;
  }
  const usage = toUsage(await result.usage);
  const timings = {
    firstTokenMs,
    firstBarMs: null,
    reviseMs: null,
    totalMs: performance.now() - started,
  };
  const finish = await result.finishReason;
  if (finish !== "stop") {
    yield {
      type: "chunk-failed",
      reason:
        finish === "length"
          ? "length"
          : finish === "content-filter"
            ? "refusal"
            : "other",
      text,
      usage,
      timings,
    };
    return;
  }
  const { items } = abcReplyToItems(text);
  for (const item of items) yield { type: "item", item, violations: [] };
  // The plan lines are placeholders, so the bar-without-plan check doesn't apply; harmony isn't checked at all.
  const violations = [...checkChunk(items), ...checkCopies(items)];
  yield {
    type: "chunk-complete",
    items,
    violations,
    revised: false,
    text,
    reviseText: null,
    usage,
    timings,
  };
}

/** How many bars converted cleanly, from a chunk's events. */
export function abcValidBars(events: ComposerEvent[]): number | null {
  const last = events.at(-1);
  if (last?.type !== "chunk-complete") return null;
  return abcReplyToItems(last.text).validBars;
}

/** Runs one variant-A session through the shared runner. */
export function runAbcSession(options: {
  session: number;
  model: LanguageModel;
  chunks: number;
  barsPerChunk: number;
  effort: Effort;
  mock: boolean;
  onChunk?: Parameters<typeof runSession>[0]["onChunk"];
}): Promise<RunFile> {
  return runSession({
    ...options,
    variant: "A",
    compose: composeAbcChunk,
    validBars: abcValidBars,
    nextContext: (context, items, text) => abcNextContext(context, items, text),
  });
}

/** A's continuity: the previous chunk's ABC itself, plus the footer's state, summary and roadmap. */
function abcNextContext(
  context: ComposerContext,
  items: GridItem[],
  text: string,
): ComposerContext {
  const sections = splitReply(text);
  const summary = items.find((item) => item.type === "footer-summary");
  const road = items.find((item) => item.type === "footer-road");
  const state = items.find((item) => item.type === "footer-state");
  const sentences =
    `${context.summary} ${summary?.type === "footer-summary" ? summary.text : ""}`
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => sentence.trim() !== "")
      .slice(-6);
  return {
    ...context,
    previousHeader: "ABC",
    previousBars: sections.abc === null ? [] : ["ABC", sections.abc],
    previousFooter: state?.source ?? context.previousFooter,
    roadmap: road?.source ?? context.roadmap,
    summary: sentences.join(" "),
  };
}
