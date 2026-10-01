---
id: "2a5b59"
title: Set up Vitest and test the pitch primitives
status: todo
priority: none
labels:
  - m0
  - tooling
created_at: 2026-10-01T03:08:32.508Z
updated_at: 2026-10-01T03:28:39.864Z
blocked_by:
  - "201d66"
---

Add the test runner and the first tests.

**Research first:**
- Vitest's current major and how it runs in a Bun workspace: one root config with per-package projects vs per-package configs, and running it on the Bun runtime (`bun --bun vitest`). The database package will later need Bun built-ins such as `bun:sqlite` inside tests, so confirm that a Bun built-in can be imported in a test under the chosen setup; if it can't, record that as a risk in design.md.
- The VS Code Vitest extension: its current id, and the settings that make it run Vitest exactly as the `test` script does (Bun runtime, root config).

**Scope**
- Vitest at the root, covering every workspace. A root `test` script runs everything once (no watch mode); a `test:watch` for local use.
- Tests for the pitch primitives: round trips for every MIDI number in the piano range, sharps and flats, octave boundaries (B3/C4), and rejected input (lowercase, double accidentals, out of range).
- `.vscode/extensions.json` (JSONC, commented) recommending the Vitest extension, with its settings in `.vscode/settings.json`.
- Keep the engine runtime-neutral: if Vitest's types bring Node globals into the engine's typecheck, typecheck the engine's tests under a separate tsconfig.

**Docs:** design.md → Testing: the runner, how it's invoked, and the policy from planning: deterministic code gets thorough tests; code that calls Claude is tested against the AI SDK's mock models; musical quality is judged by ear; live calls never run in the gate.

**Done when:** `bun run test` passes from the root and fails if a pitch test is broken; VS Code's Testing view discovers and runs the pitch tests; engine source still can't use Node or Bun globals.
