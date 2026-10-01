import { checkCopies } from "../checks/copy-check.ts";
import { checkHarmony } from "../checks/harmony.ts";
import { checkBar, checkChunk } from "../checks/playing-rules.ts";
import type { Violation } from "../checks/violation.ts";
import type { GridItem } from "../grid/schema.ts";
import { findDeniedNames } from "./denylist.ts";

type BarItem = Extract<GridItem, { type: "bar" }>;

function sameViolation(a: Violation, b: Violation): boolean {
  return a.rule === b.rule && a.message === b.message;
}

/**
 * What can be checked as soon as one bar arrives: the playing rules for that
 * bar, its harmony, and any copy of an example that this bar completes.
 * `before` is everything parsed before it.
 */
export function checkArrivingBar(
  before: GridItem[],
  bar: BarItem,
): Violation[] {
  const header = before.find((item) => item.type === "header");
  if (!header || !bar.body) return [];
  const where = { kind: "bar" as const, bar: bar.bar };
  const so = [...before, bar];
  const harmony = checkHarmony(so).filter(
    (violation) =>
      violation.where.kind === "bar" && violation.where.bar === bar.bar,
  );
  const earlierCopies = checkCopies(before);
  const copies = checkCopies(so).filter(
    (violation) =>
      !earlierCopies.some((earlier) => sameViolation(earlier, violation)),
  );
  return [...checkBar(bar.body, header.meter, where), ...harmony, ...copies];
}

/**
 * Every check for a finished chunk: the playing rules, harmony, the copy
 * check, and no composer or work names in the footer's text (invariant 3).
 * A name is a hard violation for the revise turn, since code never rewrites
 * Claude's text; the message names the field, not the name, so the revise
 * message itself passes the denylist.
 */
export function checkComposedChunk(items: GridItem[]): Violation[] {
  const violations = [
    ...checkChunk(items),
    ...checkHarmony(items),
    ...checkCopies(items),
  ];
  const chunk = { kind: "chunk" as const };
  for (const item of items) {
    const fields: [string, string][] =
      item.type === "footer-summary"
        ? [["the footer summary (F sum)", item.text]]
        : item.type === "footer-road"
          ? [
              [
                "the roadmap (F road)",
                item.stops.map((stop) => stop.mood).join(" "),
              ],
            ]
          : item.type === "footer-theme" || item.type === "footer-drop"
            ? [["a theme name", item.name]]
            : [];
    for (const [field, text] of fields) {
      if (findDeniedNames(text).length > 0) {
        violations.push({
          rule: "denied-name",
          severity: "hard",
          where: chunk,
          hand: null,
          message: `The chunk: ${field} names a composer or work; restate it in idiom and texture terms.`,
        });
      }
    }
  }
  return violations;
}
