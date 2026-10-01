---
id: "a7ea88"
title: Build the bake-off runner
status: todo
priority: none
labels:
  - bakeoff
  - m2
created_at: 2026-10-01T03:10:49.054Z
updated_at: 2026-10-01T03:29:53.446Z
blocked_by:
  - "20a6d2"
  - "3faa43"
  - "ea22a7"
---

Generate the material the user will judge by ear and the numbers that back it up (design.md → Bake-off).

**Scope**
- `scripts/bakeoff` as its own workspace, `@ghostkeys/bakeoff`: add `scripts/*` to the root workspaces so its dependencies stay out of the root. Its tsconfig extends the base, and it has a `typecheck` script, so typecheck, lint and test cover it.
- Variants B (plan + grid, checks recorded but no revise) and C (plan + grid + check + revise), both built on the engine composer and `nextContext`.
- A session is 4 chunks of 16 bars with continuity between chunks. At chunk 3 a fixed steering note is set in the context (e.g. "slowly grow darker and slower"); there's no conductor yet. 2 sessions per variant.
- Also run one variant-C session at 8-bar chunks, so the shorter opening and post-steer chunks can be sized from data.
- Per run, write a JSON file to a gitignored `scripts/bakeoff/runs/`: every event, the raw text of every model call, violations, revise count, and timings: time to first token, time to first bar, generation time, music duration (the sum of the bars' `durationSec` from the engine's timing), and the **real-time factor** (generation time including revise ÷ music duration), plus token usage (thinking vs visible, cache reads). The run file is a Zod schema in the workspace, built from the engine's event and violation schemas (invariant 5).
- `--mock` runs the same pipeline on the AI SDK mock model, so the listening page can be built and tested without spending money.
- Loads the root `.env` the way design.md → Claude access says.

**Docs:** design.md → Repo, tooling & gate (the workspace); design.md → Bake-off (how to run it, what's measured).

**Done when:** `--mock` produces complete run files offline that validate against the schema, and the gate covers the workspace.
