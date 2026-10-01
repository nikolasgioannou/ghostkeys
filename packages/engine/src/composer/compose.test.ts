import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { createGridLineParser } from "../grid/line-parser.ts";
import type { GridItem } from "../grid/schema.ts";
import { WORKED_EXAMPLE } from "../grid/worked-example.fixture.ts";
import { composeChunk } from "./compose.ts";
import { EMPTY_CONTEXT } from "./context.ts";
import type { ComposerEvent } from "./events.ts";

type Finish = "stop" | "length" | "content-filter";

/** A mock Claude that streams `text` in small deltas. */
function mockModel(text: string, finish: Finish = "stop") {
  const deltas = text.match(/[\s\S]{1,7}/g) ?? [];
  return new MockLanguageModelV4({
    doStream: () =>
      Promise.resolve({
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
      }),
  });
}

async function collect(
  stream: AsyncIterable<ComposerEvent>,
): Promise<ComposerEvent[]> {
  const events: ComposerEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

function parse(text: string): GridItem[] {
  const parser = createGridLineParser();
  return text.split("\n").flatMap((line) => {
    const item = parser.line(line);
    return item ? [item] : [];
  });
}

let clock = 0;
const now = () => (clock += 10);

describe("composeChunk", () => {
  it("streams a valid chunk into items, then chunk-complete with no violations", async () => {
    const events = await collect(
      composeChunk({
        model: mockModel(WORKED_EXAMPLE),
        context: EMPTY_CONTEXT,
        bars: 4,
        effort: "medium",
        now,
      }),
    );
    const items = events.flatMap((event) =>
      event.type === "item" ? [event.item] : [],
    );
    const last = events.at(-1);

    expect(items).toEqual(parse(WORKED_EXAMPLE));
    expect(
      events
        .filter((event) => event.type === "item")
        .every((event) => event.violations.length === 0),
    ).toBe(true);
    expect(last?.type).toBe("chunk-complete");
    if (last?.type !== "chunk-complete") return;
    expect(last.items).toEqual(items);
    expect(last.violations).toEqual([]);
    expect(last.text).toBe(WORKED_EXAMPLE);
    expect(last.usage).toEqual({
      inputTokens: 3000,
      cacheReadTokens: 2800,
      cacheWriteTokens: 0,
      outputTokens: 900,
      reasoningTokens: 300,
    });
    expect(last.timings.firstTokenMs).not.toBeNull();
    expect(last.timings.firstBarMs).toBeGreaterThan(
      last.timings.firstTokenMs ?? 0,
    );
  });

  it("emits every bar exactly as the model wrote it", async () => {
    const events = await collect(
      composeChunk({
        model: mockModel(WORKED_EXAMPLE),
        context: EMPTY_CONTEXT,
        bars: 4,
        effort: "medium",
        now,
      }),
    );
    const bars = events.flatMap((event) =>
      event.type === "item" && event.item.type === "bar" ? [event.item] : [],
    );
    expect(bars.map((bar) => bar.source)).toEqual(
      WORKED_EXAMPLE.split("\n").filter((line) => line.startsWith("B")),
    );
  });

  it("attaches a bad bar's violations to its event, without editing it", async () => {
    const text = WORKED_EXAMPLE.replace("B2 R: Db5@0:12", "B2 R: Db5@0:48");
    const events = await collect(
      composeChunk({
        model: mockModel(text),
        context: EMPTY_CONTEXT,
        bars: 4,
        effort: "medium",
        now,
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
    const last = events.at(-1);
    expect(
      last?.type === "chunk-complete" ? last.violations.map((v) => v.rule) : [],
    ).toContain("note-past-barline");
  });

  it("flags a footer that names a composer, without repeating the name", async () => {
    const text = WORKED_EXAMPLE.replace(
      "F sum The nocturne opens in Db",
      "F sum A Chopinesque nocturne opens in Db",
    );
    const last = (
      await collect(
        composeChunk({
          model: mockModel(text),
          context: EMPTY_CONTEXT,
          bars: 4,
          effort: "medium",
          now,
        }),
      )
    ).at(-1);
    const violation =
      last?.type === "chunk-complete"
        ? last.violations.find((v) => v.rule === "denied-name")
        : undefined;
    expect(violation).toMatchObject({
      severity: "hard",
      where: { kind: "chunk" },
    });
    expect(violation?.message.toLowerCase()).not.toContain("chopin");
  });

  it.each([
    ["length", "length"],
    ["content-filter", "refusal"],
  ] as const)(
    "treats a %s finish as a failed chunk",
    async (finish, reason) => {
      const last = (
        await collect(
          composeChunk({
            model: mockModel(WORKED_EXAMPLE.slice(0, 300), finish),
            context: EMPTY_CONTEXT,
            bars: 4,
            effort: "medium",
            now,
          }),
        )
      ).at(-1);
      expect(last).toMatchObject({ type: "chunk-failed", reason });
    },
  );

  it("stops without a final event when aborted mid-stream", async () => {
    const controller = new AbortController();
    const events: ComposerEvent[] = [];
    for await (const event of composeChunk({
      model: mockModel(WORKED_EXAMPLE),
      context: EMPTY_CONTEXT,
      bars: 4,
      effort: "medium",
      abortSignal: controller.signal,
      now,
    })) {
      events.push(event);
      if (events.length === 3) controller.abort();
    }
    expect(events.length).toBeLessThan(parse(WORKED_EXAMPLE).length);
    expect(events.some((event) => event.type === "chunk-complete")).toBe(false);
  });

  it("asks for the chunk with a cached system prompt, adaptive thinking and room to think", async () => {
    const model = mockModel(WORKED_EXAMPLE);
    await collect(
      composeChunk({
        model,
        context: EMPTY_CONTEXT,
        bars: 8,
        effort: "high",
        now,
      }),
    );
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
    expect(JSON.stringify(user)).toContain("Write the next 8 bars (B1–B8).");
  });
});
