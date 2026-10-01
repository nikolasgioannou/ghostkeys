import type { GridItem } from "../grid/schema.ts";
import type { ComposerContext, Theme } from "./context.ts";

/** How many of the last chunk's bars the next chunk sees verbatim. */
export const CONTEXT_BARS = 4;
/** The theme bank holds at most this many themes; the oldest go first. */
export const MAX_THEMES = 5;
/** The running summary keeps this many of its most recent sentences. */
export const SUMMARY_SENTENCES = 6;

function boundedSummary(summary: string, addition: string): string {
  const sentences = `${summary} ${addition}`
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== "");
  return sentences.slice(-SUMMARY_SENTENCES).join(" ");
}

/**
 * Folds a finished chunk into the context for the next one: the last bars as
 * Claude wrote them (revisions included), where the chunk ended, the running
 * summary, the theme bank and the roadmap. Everything musical comes from
 * what Claude wrote; code only carries it forward. The steering note carries
 * over unchanged.
 */
export function nextContext(
  context: ComposerContext,
  complete: { items: GridItem[] },
): ComposerContext {
  const { items } = complete;
  const header = items.find((item) => item.type === "header");
  const bars = items.filter((item) => item.type === "bar").slice(-CONTEXT_BARS);
  const shown = new Set(bars.map((bar) => bar.bar));
  const previousBars = items
    .filter(
      (item) =>
        (item.type === "plan" || item.type === "bar") && shown.has(item.bar),
    )
    .sort((a, b) => (a.type === b.type ? 0 : a.type === "plan" ? -1 : 1))
    .map((item) => item.source);
  const footerState = items.find((item) => item.type === "footer-state");

  let summary = context.summary;
  let themes: Theme[] = [...context.themes];
  let roadmap = context.roadmap;
  for (const item of items) {
    if (item.type === "footer-summary")
      summary = boundedSummary(summary, item.text);
    if (item.type === "footer-theme") {
      const notes = item.source.trim().replace(/^F theme \S+ /, "");
      themes = [
        ...themes.filter((theme) => theme.name !== item.name),
        { name: item.name, notes },
      ];
    }
    if (item.type === "footer-drop")
      themes = themes.filter((theme) => theme.name !== item.name);
    if (item.type === "footer-road") roadmap = item.source.trim();
  }

  return {
    steeringNote: context.steeringNote,
    previousHeader: header?.source.trim() ?? context.previousHeader,
    previousBars,
    previousFooter: footerState?.source.trim() ?? context.previousFooter,
    themes: themes.slice(-MAX_THEMES),
    roadmap,
    summary,
  };
}
