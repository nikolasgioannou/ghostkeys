---
id: "61341d"
title: Check bars against the playing rules
status: done
priority: none
labels:
  - engine
  - m1
created_at: 2026-10-01T03:09:17.003Z
updated_at: 2026-10-01T04:16:42.922Z
blocked_by:
  - "6b98de"
---

The first half of the checker: the rules about what a pianist can physically play and what the format requires. Code checks; Claude fixes (research shows models catch only a fraction of their own errors).

**Scope** (rules as listed in design.md → Grid format):
- Onsets inside the bar; onset + duration ends within the bar unless tied.
- Range A0–C8.
- Hand span at most a 10th, measured among one hand's notes sounding at the same onset (wide arpeggios across onsets are fine).
- At most 5 notes per hand per onset.
- Dynamics present where the spec requires them.
- Holding pattern is loopable as the spec defines.

**Violation shape** (shared with the harmony check and copy check): rule id, severity (`hard` always triggers a revise; `soft` only above a threshold), bar number, hand, and a message written so it can go straight into a revise prompt.

**Repair policy, recorded in design.md → Composition:** v1 makes no deterministic repairs to notes (invariant 1). Violations go to the revise turn. A bar still invalid after revising is never played.

Tests for every rule, each with a passing and a failing case.

**Docs:** design.md → Composition (checker and repair policy); design.md → Grid format (the rule list stays in sync).

**Done when:** the worked example passes cleanly and a test per rule proves the violation is located and worded for the revise prompt.

## Outcome

- `checks/violation.ts`: the shared `Violation` schema (rule, severity, where: bar / hold bar / chunk, hand, message).
- `checks/playing-rules.ts`: `checkBar` (onset inside the bar, ending at or before the barline, a tied note ending exactly on it, the A0–C8 range, ≤5 notes per hand per onset, ≤ a major 10th per hand at one onset) and `checkChunk` (parse errors and unparsed bars, header, bar numbering, a plan line per bar, the first dynamic, HOLD/footer state/summary/END present, ties across bars and out of the last bar, holding-pattern length/numbering/ties/pedal at the loop point). Messages name the bar, hand, pitch and slot and say how to fix it.
- Spec clarified: a tied note ends exactly at the barline; the hold-pattern and `F sum` rules listed explicitly.
- 24 tests: the worked example and a minimal chunk pass cleanly; each rule has a failing and a fixed case; violation location and wording; wide arpeggios across onsets pass.
- design.md → Composition records the checker and the repair policy (no deterministic repairs in v1).
