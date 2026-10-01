/**
 * The bake-off runner (docs/design.md → Bake-off). Composes sessions with a
 * variant and writes one run file per session to scripts/bakeoff/runs/.
 *
 *   bun run bakeoff [--variant B|C] [--sessions 2] [--chunks 4] [--bars 16] [--effort low] [--mock]
 *
 * --mock uses a stand-in model, so nothing is spent.
 */
import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";

import { createClaude, type Effort } from "@ghostkeys/engine/llm";

import { mockModel } from "./mock.ts";
import {
  type RunFile,
  RunFileSchema,
  VARIANT_NAMES,
  VariantSchema,
} from "./run-file.ts";
import { runSession } from "./runner.ts";

const { values } = parseArgs({
  options: {
    variant: { type: "string", default: "C" },
    sessions: { type: "string", default: "2" },
    chunks: { type: "string", default: "4" },
    bars: { type: "string", default: "16" },
    effort: { type: "string", default: "low" },
    mock: { type: "boolean", default: false },
  },
});

const variant = VariantSchema.parse(values.variant);
const effort = values.effort as Effort;
const sessions = Number(values.sessions);
const chunks = Number(values.chunks);
const bars = Number(values.bars);

if (variant === "A") {
  console.error("Variant A (ABC) isn't built yet.");
  process.exit(1);
}
await runAll((session, model) =>
  runSession({
    variant,
    session,
    model,
    chunks,
    barsPerChunk: bars,
    effort,
    mock: values.mock,
    onChunk: report,
  }),
);

function report(record: RunFile["chunks"][number]): void {
  const rtf =
    record.realTimeFactor === null ? "–" : record.realTimeFactor.toFixed(2);
  console.log(
    `  chunk ${String(record.index + 1)}: ${record.outcome}, ${String(record.violationsBefore.length)} → ${String(record.violationsAfter.length)} violations${record.revised ? " (revised)" : ""}, ${(record.timings.totalMs / 1000).toFixed(1)} s for ${record.musicSec.toFixed(1)} s of music (real-time factor ${rtf})`,
  );
}

async function runAll(
  run: (
    session: number,
    model: ReturnType<typeof createClaude> | ReturnType<typeof mockModel>,
  ) => Promise<RunFile>,
): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!values.mock && !apiKey) {
    console.error("Add OPENROUTER_API_KEY to .env, or pass --mock.");
    process.exit(1);
  }
  await mkdir("runs", { recursive: true });
  for (let session = 1; session <= sessions; session++) {
    console.log(
      `Variant ${variant} (${VARIANT_NAMES[variant]}), session ${String(session)}: ${String(chunks)} × ${String(bars)} bars, effort ${effort}${values.mock ? ", mock" : ""}`,
    );
    const model = values.mock
      ? mockModel(bars)
      : createClaude({
          apiKey: apiKey ?? "",
          sessionId: `bakeoff-${variant}-${String(session)}-${String(Date.now())}`,
        });
    const result = RunFileSchema.parse(await run(session, model));
    const name = `runs/${values.mock ? "mock-" : ""}${variant}-${String(bars)}bars-s${String(session)}.json`;
    await Bun.write(name, JSON.stringify(result, null, 2));
    console.log(`  → ${name}`);
  }
}
