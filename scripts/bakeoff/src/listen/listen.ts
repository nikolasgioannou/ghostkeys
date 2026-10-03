import { type RunFile, RunFileSchema, VARIANT_NAMES } from "../run-file.ts";
import { runMetrics } from "./metrics.ts";
import { loadPiano, PIANO_NAMES, type PianoChoice } from "./pianos.ts";
import {
  type PianoLike,
  type ScheduledSession,
  scheduleSession,
} from "./session-player.ts";

function element(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`listening page markup is missing ${selector}`);
  return found;
}

const pianoSelect = element("#piano") as HTMLSelectElement;
const status = element("#status") as HTMLParagraphElement;
const sessionsBox = element("#sessions") as HTMLDivElement;
const revealButton = element("#reveal") as HTMLButtonElement;
const results = element("#results") as HTMLDivElement;

for (const [choice, name] of Object.entries(PIANO_NAMES))
  pianoSelect.add(new Option(name, choice));

let context: AudioContext | null = null;
const pianos = new Map<PianoChoice, PianoLike>();
let playing: ScheduledSession | null = null;

interface Take {
  label: string;
  run: RunFile;
  rank: HTMLSelectElement;
}
interface Group {
  title: string;
  takes: Take[];
}

const names = (await (await fetch("/api/runs")).json()) as string[];
const runs = await Promise.all(
  names.map(async (name) =>
    RunFileSchema.parse(await (await fetch(`/api/runs/${name}`)).json()),
  ),
);

/** One group per session setup (session number and chunk length), its variants shuffled under neutral labels. */
const byKey = new Map<string, RunFile[]>();
for (const run of runs) {
  const key = `${String(run.barsPerChunk)}-${run.effort}-${String(run.session)}${run.mock ? "-mock" : ""}`;
  byKey.set(key, [...(byKey.get(key) ?? []), run]);
}
const groups: Group[] = [];
for (const [, group] of [...byKey].sort(([a], [b]) => a.localeCompare(b))) {
  const first = group[0];
  if (!first) continue;
  const shuffled = group
    .map((run) => ({ run, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ run }) => run);
  const section = document.createElement("section");
  const title = `Session ${String(first.session)}, ${String(first.barsPerChunk)}-bar chunks, effort ${first.effort}${first.mock ? " (mock)" : ""}`;
  section.append(
    Object.assign(document.createElement("h2"), { textContent: title }),
  );
  const takes: Take[] = shuffled.map((run, index) => {
    const label = `Take ${String(index + 1)}`;
    const row = Object.assign(document.createElement("div"), {
      className: "take",
    });
    const play = Object.assign(document.createElement("button"), {
      textContent: `Play ${label}`,
    });
    const stop = Object.assign(document.createElement("button"), {
      textContent: "Stop",
    });
    const rank = document.createElement("select");
    rank.add(new Option("rank…", ""));
    for (let place = 1; place <= shuffled.length; place++)
      rank.add(new Option(String(place), String(place)));
    play.addEventListener("click", () => {
      void start(run, label);
    });
    stop.addEventListener("click", () => {
      playing?.stop();
      playing = null;
      status.textContent = "Stopped.";
    });
    row.append(play, stop, rank);
    section.append(row);
    return { label, run, rank };
  });
  sessionsBox.append(section);
  groups.push({ title, takes });
}
status.textContent =
  runs.length === 0
    ? "No run files yet. Run `bun run bakeoff --mock` first."
    : "Pick a piano, play the takes, rank them.";

async function start(run: RunFile, label: string): Promise<void> {
  playing?.stop();
  context ??= new AudioContext();
  await context.resume();
  const choice = pianoSelect.value as PianoChoice;
  let piano = pianos.get(choice);
  if (!piano) {
    status.textContent = "Loading the piano…";
    piano = await loadPiano(choice, context);
    pianos.set(choice, piano);
  }
  playing = scheduleSession(run, piano, context);
  status.textContent = `Playing ${label} on the ${choice === "steinway" ? "Steinway" : "Salamander"}: ${playing.durationSec.toFixed(0)} s.`;
}

const format = (value: number | null, digits = 2) =>
  value === null ? "–" : value.toFixed(digits);

revealButton.addEventListener("click", () => {
  results.replaceChildren();
  const summary: string[] = [
    `Piano preferred: ${PIANO_NAMES[pianoSelect.value as PianoChoice]}`,
    "",
  ];
  for (const group of groups) {
    results.append(
      Object.assign(document.createElement("h2"), { textContent: group.title }),
    );
    const table = document.createElement("table");
    table.innerHTML =
      "<tr><th>Take</th><th>Rank</th><th>Variant</th><th>Valid bars</th><th>Violations before → after</th><th>Revised</th><th>Real-time factor (mean / worst)</th><th>First bar</th><th>Output tokens (thinking)</th><th>Cache reads</th></tr>";
    summary.push(
      `### ${group.title}`,
      "",
      "| Rank | Variant | Valid bars | Violations | Revised | RTF mean / worst | First bar | Output tokens (thinking) |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const take of group.takes.toSorted(
      (a, b) => Number(a.rank.value || 99) - Number(b.rank.value || 99),
    )) {
      const m = runMetrics(take.run);
      const variant = `${take.run.variant}: ${VARIANT_NAMES[take.run.variant]}`;
      const cells = [
        take.label,
        take.rank.value || "–",
        variant,
        `${String(m.validBars)} / ${String(m.bars)}`,
        `${String(m.violationsBefore)} → ${String(m.violationsAfter)}`,
        `${String(m.revised)} / ${String(m.completed)}`,
        `${format(m.meanRealTimeFactor)} / ${format(m.worstRealTimeFactor)}`,
        `${format(m.meanFirstBarSec, 1)} s`,
        `${String(m.outputTokens)} (${String(m.reasoningTokens)})`,
        String(m.cacheReadTokens),
      ];
      const row = table.insertRow();
      for (const cell of cells) row.insertCell().textContent = cell;
      summary.push(
        `| ${cells[1] ?? ""} | ${variant} | ${cells[3] ?? ""} | ${cells[4] ?? ""} | ${cells[5] ?? ""} | ${cells[6] ?? ""} | ${cells[7] ?? ""} | ${cells[8] ?? ""} |`,
      );
    }
    results.append(table);
    summary.push("");
  }
  const text = Object.assign(document.createElement("textarea"), {
    value: summary.join("\n"),
    readOnly: true,
  });
  results.append(
    Object.assign(document.createElement("h2"), {
      textContent: "Summary to paste",
    }),
    text,
  );
});
