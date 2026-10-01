import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { createGridLineParser } from "../grid/line-parser.ts";
import type { GridItem } from "../grid/schema.ts";
import { WORKED_EXAMPLE } from "../grid/worked-example.fixture.ts";
import { applyRevision, composeChunk, needsRevise } from "./compose.ts";
import { EMPTY_CONTEXT } from "./context.ts";
import type { ComposerEvent } from "./events.ts";

type Finish = "stop" | "length" | "content-filter";
interface Reply {
  text: string;
  finish?: Finish;
}

function stream({ text, finish = "stop" }: Reply) {
  const deltas = text.match(/[\s\S]{1,7}/g) ?? [];
  return {
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
          finishReason: {
            unified: finish,
            raw: finish === "stop" ? "end_turn" : finish,
          },
          usage: {
            inputTokens: {
              total: 3000,
              noCache: 200,
              cacheRead: 2800,
              cacheWrite: 0,
            },
            outputTokens: { total: 900, text: 600, reasoning: 300 },
          },
        },
      ],
    }),
  };
}

/** A mock Claude that answers each call with the next reply, in small deltas. */
function mockModel(...replies: (Reply | string)[]) {
  return new MockLanguageModelV4({
    doStream: replies.map((reply) =>
      stream(typeof reply === "string" ? { text: reply } : reply),
    ),
  });
}

async function collect(
  stream: AsyncIterable<ComposerEvent>,
): Promise<ComposerEvent[]> {
  const events: ComposerEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

function parse(text: string, revision = false): GridItem[] {
  const parser = createGridLineParser({ revision });
  return text.split("\n").flatMap((line) => {
    const item = parser.line(line);
    return item ? [item] : [];
  });
}

let clock = 0;
const now = () => (clock += 10);
const base = {
  context: EMPTY_CONTEXT,
  bars: 4,
  effort: "medium" as const,
  now,
};

function complete(events: ComposerEvent[]) {
  const last = events.at(-1);
  if (last?.type !== "chunk-complete")
    throw new Error(`expected chunk-complete, got ${String(last?.type)}`);
  return last;
}

const BAD_BAR_2 = WORKED_EXAMPLE.replace("B2 R: Db5@0:12", "B2 R: Db5@0:48");
const GOOD_BAR_2 =
  WORKED_EXAMPLE.split("\n").find((line) => line.startsWith("B2 ")) ?? "";

describe("composeChunk", () => {
  it("streams a valid chunk into items, then chunk-complete with no violations and no revise", async () => {
    const model = mockModel(WORKED_EXAMPLE);
    const events = await collect(composeChunk({ model, ...base }));
    const items = events.flatMap((event) =>
      event.type === "item" ? [event.item] : [],
    );
    const last = complete(events);

    expect(items).toEqual(parse(WORKED_EXAMPLE));
    expect(model.doStreamCalls).toHaveLength(1);
    expect(last).toMatchObject({
      items,
      violations: [],
      revised: false,
      text: WORKED_EXAMPLE,
      reviseText: null,
    });
    expect(last.usage).toEqual({
      inputTokens: 3000,
      cacheReadTokens: 2800,
      cacheWriteTokens: 0,
      outputTokens: 900,
      reasoningTokens: 300,
    });
    expect(last.timings.reviseMs).toBeNull();
    expect(last.timings.firstBarMs).toBeGreaterThan(
      last.timings.firstTokenMs ?? 0,
    );
  });

  it("emits every bar exactly as the model wrote it", async () => {
    const events = await collect(
      composeChunk({ model: mockModel(WORKED_EXAMPLE), ...base }),
    );
    const bars = events.flatMap((event) =>
      event.type === "item" && event.item.type === "bar" ? [event.item] : [],
    );
    expect(bars.map((bar) => bar.source)).toEqual(
      WORKED_EXAMPLE.split("\n").filter((line) => line.startsWith("B")),
    );
  });

  it("attaches a bad bar's violations as it arrives, without editing it", async () => {
    const events = await collect(
      composeChunk({
        model: mockModel(BAD_BAR_2, `${GOOD_BAR_2}\nEND`),
        ...base,
      }),
    );
    const bar2 = events.find(
      (event) =>
        event.type === "item" &&
        event.item.type === "bar" &&
        event.item.bar === 2,
    );
    expect(
      bar2?.type === "item" ? bar2.violations.map((v) => v.rule) : [],
    ).toContain("note-past-barline");
    expect(bar2?.type === "item" ? bar2.item.source : "").toContain("Db5@0:48");
  });

  it.each([
    ["length", "length"],
    ["content-filter", "refusal"],
  ] as const)(
    "treats a %s finish as a failed chunk",
    async (finish, reason) => {
      const events = await collect(
        composeChunk({
          model: mockModel({ text: WORKED_EXAMPLE.slice(0, 300), finish }),
          ...base,
        }),
      );
      expect(events.at(-1)).toMatchObject({ type: "chunk-failed", reason });
    },
  );

  it("stops without a final event when aborted mid-stream", async () => {
    const controller = new AbortController();
    const events: ComposerEvent[] = [];
    for await (const event of composeChunk({
      model: mockModel(WORKED_EXAMPLE),
      ...base,
      abortSignal: controller.signal,
    })) {
      events.push(event);
      if (events.length === 3) controller.abort();
    }
    expect(events.some((event) => event.type === "chunk-complete")).toBe(false);
  });

  it("asks with a cached system prompt, a breakpoint on the chunk's message, adaptive thinking and room to think", async () => {
    const model = mockModel(WORKED_EXAMPLE);
    await collect(composeChunk({ model, ...base, bars: 8, effort: "high" }));
    const [call] = model.doStreamCalls;
    expect(call?.maxOutputTokens).toBe(32_000);
    expect(call?.providerOptions).toMatchObject({
      anthropic: {
        effort: "high",
        thinking: { type: "adaptive", display: "omitted" },
      },
    });
    const [system, user] = call?.prompt ?? [];
    expect(system).toMatchObject({
      role: "system",
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } },
      },
    });
    expect(user).toMatchObject({
      role: "user",
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    });
    expect(JSON.stringify(user)).toContain("Write the next 8 bars (B1–B8).");
  });

  describe("revising", () => {
    it("makes exactly one revise turn that resends the first reply unmodified", async () => {
      const model = mockModel(BAD_BAR_2, `${GOOD_BAR_2}\nEND`);
      const last = complete(await collect(composeChunk({ model, ...base })));

      expect(model.doStreamCalls).toHaveLength(2);
      const [first, second] = model.doStreamCalls;
      const [system, user, assistant, correction] = second?.prompt ?? [];
      expect(system).toEqual(first?.prompt[0]);
      expect(user).toEqual(first?.prompt[1]);
      expect(assistant).toMatchObject({
        role: "assistant",
        content: [{ type: "text", text: BAD_BAR_2 }],
      });
      expect(correction?.role).toBe("user");
      expect(JSON.stringify(correction)).toContain(
        "Bar 2, right hand: Db5 at slot 0 lasts 48 slots",
      );
      expect(JSON.stringify(correction)).toContain(
        "Reply with only the corrected lines",
      );

      expect(last.revised).toBe(true);
      expect(last.reviseText).toBe(`${GOOD_BAR_2}\nEND`);
      expect(last.violations).toEqual([]);
      expect(last.timings.reviseMs).not.toBeNull();
      expect(last.usage.outputTokens).toBe(1800);
    });

    it("replaces only the corrected bars and reports each with bar-revised", async () => {
      const events = await collect(
        composeChunk({
          model: mockModel(BAD_BAR_2, `${GOOD_BAR_2}\nEND`),
          ...base,
        }),
      );
      const revisedBars = events.filter(
        (event) => event.type === "bar-revised",
      );
      expect(revisedBars).toHaveLength(1);
      expect(revisedBars[0]).toMatchObject({
        item: { type: "bar", bar: 2, source: GOOD_BAR_2 },
        violations: [],
      });
      const bars = complete(events).items.filter((item) => item.type === "bar");
      expect(bars.map((bar) => bar.source)).toEqual(
        WORKED_EXAMPLE.split("\n").filter((line) => line.startsWith("B")),
      );
    });

    it("revises a holding pattern that doesn't loop", async () => {
      const badHold = WORKED_EXAMPLE.replace(
        "H2 R: Eb5@0:24 C5@24:12 |",
        "H2 R: Eb5@0:24 C5@24:12~ |",
      );
      const goodHold = WORKED_EXAMPLE.slice(
        WORKED_EXAMPLE.indexOf("HOLD"),
        WORKED_EXAMPLE.indexOf("F key"),
      );
      const last = complete(
        await collect(
          composeChunk({
            model: mockModel(badHold, `${goodHold}END`),
            ...base,
          }),
        ),
      );
      expect(last.revised).toBe(true);
      expect(last.violations).toEqual([]);
      expect(
        last.items
          .filter((item) => item.type === "hold-bar")
          .map((item) => item.source),
      ).toEqual(goodHold.trim().split("\n").slice(1));
    });

    it("revises a footer that names a composer, without repeating the name", async () => {
      const named = WORKED_EXAMPLE.replace(
        "F sum The nocturne opens in Db",
        "F sum A Chopinesque nocturne opens in Db",
      );
      const footer = WORKED_EXAMPLE.slice(WORKED_EXAMPLE.indexOf("F key"));
      const model = mockModel(named, footer);
      const last = complete(await collect(composeChunk({ model, ...base })));
      expect(
        JSON.stringify(model.doStreamCalls[1]?.prompt.at(-1)).toLowerCase(),
      ).not.toContain("chopin");
      expect(last.revised).toBe(true);
      expect(last.violations).toEqual([]);
    });

    it("leaves the chunk flagged if the revise doesn't finish", async () => {
      const last = complete(
        await collect(
          composeChunk({
            model: mockModel(BAD_BAR_2, {
              text: "B2 R: Db5",
              finish: "length",
            }),
            ...base,
          }),
        ),
      );
      expect(last.revised).toBe(false);
      expect(last.violations.map((v) => v.rule)).toContain("note-past-barline");
    });

    it("doesn't revise when revising is off", async () => {
      const model = mockModel(BAD_BAR_2, `${GOOD_BAR_2}\nEND`);
      const last = complete(
        await collect(composeChunk({ model, ...base, revise: false })),
      );
      expect(model.doStreamCalls).toHaveLength(1);
      expect(last.revised).toBe(false);
      expect(last.violations.map((v) => v.rule)).toContain("note-past-barline");
    });

    it("stops when aborted during the revise", async () => {
      const controller = new AbortController();
      const events: ComposerEvent[] = [];
      const model = mockModel(BAD_BAR_2, `${GOOD_BAR_2}\nEND`);
      const doStream = model.doStream.bind(model);
      model.doStream = (callOptions) => {
        if (model.doStreamCalls.length === 1) controller.abort();
        return doStream(callOptions);
      };
      for await (const event of composeChunk({
        model,
        ...base,
        abortSignal: controller.signal,
      })) {
        events.push(event);
      }
      expect(events.some((event) => event.type === "chunk-complete")).toBe(
        false,
      );
    });
  });
});

describe("needsRevise", () => {
  const violation = (severity: "hard" | "soft") => ({
    rule: "x",
    severity,
    where: { kind: "chunk" as const },
    hand: null,
    message: "",
  });

  it("revises for any hard violation, or for two or more soft ones", () => {
    expect(needsRevise([])).toBe(false);
    expect(needsRevise([violation("soft")])).toBe(false);
    expect(needsRevise([violation("soft"), violation("soft")])).toBe(true);
    expect(needsRevise([violation("hard")])).toBe(true);
  });
});

describe("applyRevision", () => {
  it("keeps everything the reply doesn't repeat", () => {
    const items = parse(WORKED_EXAMPLE);
    expect(applyRevision(items, parse("END", true)).items).toEqual(items);
  });

  it("replaces plan lines by bar number", () => {
    const items = parse(WORKED_EXAMPLE);
    const { items: revised } = applyRevision(
      items,
      parse("P2 key=Db IV6 dyn=p\nEND", true),
    );
    expect(
      revised.find((item) => item.type === "plan" && item.bar === 2)?.source,
    ).toBe("P2 key=Db IV6 dyn=p");
  });
});
