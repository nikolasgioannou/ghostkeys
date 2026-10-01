import type { RunFile } from "../run-file.ts";

export interface RunMetrics {
  chunks: number;
  completed: number;
  bars: number;
  /** Bars that parsed (for variant A: that converted cleanly from ABC). */
  validBars: number;
  violationsBefore: number;
  violationsAfter: number;
  revised: number;
  meanRealTimeFactor: number | null;
  worstRealTimeFactor: number | null;
  meanFirstBarSec: number | null;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
}

const mean = (values: number[]) =>
  values.length === 0
    ? null
    : values.reduce((a, b) => a + b, 0) / values.length;

/** What a run measured, summed over its chunks. */
export function runMetrics(run: RunFile): RunMetrics {
  const complete = run.chunks.filter((chunk) => chunk.outcome === "complete");
  const factors = complete.flatMap((chunk) =>
    chunk.realTimeFactor === null ? [] : [chunk.realTimeFactor],
  );
  const firstBars = complete.flatMap((chunk) =>
    chunk.timings.firstBarMs === null ? [] : [chunk.timings.firstBarMs / 1000],
  );
  const bars = complete.reduce(
    (sum, chunk) =>
      sum + chunk.items.filter((item) => item.type === "bar").length,
    0,
  );
  const parsedBars = complete.reduce(
    (sum, chunk) =>
      sum +
      chunk.items.filter((item) => item.type === "bar" && item.body !== null)
        .length,
    0,
  );
  return {
    chunks: run.chunks.length,
    completed: complete.length,
    bars,
    validBars:
      run.variant === "A"
        ? complete.reduce((sum, chunk) => sum + (chunk.validBars ?? 0), 0)
        : parsedBars,
    violationsBefore: complete.reduce(
      (sum, chunk) => sum + chunk.violationsBefore.length,
      0,
    ),
    violationsAfter: complete.reduce(
      (sum, chunk) => sum + chunk.violationsAfter.length,
      0,
    ),
    revised: complete.filter((chunk) => chunk.revised).length,
    meanRealTimeFactor: mean(factors),
    worstRealTimeFactor: factors.length === 0 ? null : Math.max(...factors),
    meanFirstBarSec: mean(firstBars),
    outputTokens: run.chunks.reduce(
      (sum, chunk) => sum + (chunk.usage.outputTokens ?? 0),
      0,
    ),
    reasoningTokens: run.chunks.reduce(
      (sum, chunk) => sum + (chunk.usage.reasoningTokens ?? 0),
      0,
    ),
    cacheReadTokens: run.chunks.reduce(
      (sum, chunk) => sum + (chunk.usage.cacheReadTokens ?? 0),
      0,
    ),
  };
}
