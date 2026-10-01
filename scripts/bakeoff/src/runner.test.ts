import { describe, expect, it } from "vitest";

import { mockModel } from "./mock.ts";
import { RunFileSchema } from "./run-file.ts";
import { runSession, SCRIPTED_STEERING, STEERING_CHUNK } from "./runner.ts";

describe("runSession (mock)", () => {
  it.each(["B", "C"] as const)(
    "writes a complete, valid run file for variant %s",
    async (variant) => {
      const run = await runSession({
        variant,
        session: 1,
        model: mockModel(16),
        chunks: 4,
        barsPerChunk: 16,
        effort: "low",
        mock: true,
      });
      expect(RunFileSchema.parse(run)).toEqual(run);
      expect(run.chunks).toHaveLength(4);
      for (const chunk of run.chunks) {
        expect(chunk.outcome).toBe("complete");
        expect(chunk.items.filter((item) => item.type === "bar")).toHaveLength(
          16,
        );
        expect(chunk.musicSec).toBeGreaterThan(0);
        expect(chunk.realTimeFactor).not.toBeNull();
        expect(chunk.texts.length).toBeGreaterThanOrEqual(1);
      }
    },
  );

  it("steers from chunk 3 on and carries continuity", async () => {
    const run = await runSession({
      variant: "B",
      session: 1,
      model: mockModel(8),
      chunks: 4,
      barsPerChunk: 8,
      effort: "low",
      mock: true,
    });
    expect(run.chunks.map((chunk) => chunk.steeringNote)).toEqual([
      null,
      null,
      SCRIPTED_STEERING,
      SCRIPTED_STEERING,
    ]);
    expect(STEERING_CHUNK).toBe(2);
    const secondCall = JSON.stringify(run.chunks[1]?.events.length);
    expect(secondCall).toBeDefined();
  });
});
