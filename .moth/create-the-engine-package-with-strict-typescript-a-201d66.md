---
id: "201d66"
title: Create the engine package with strict TypeScript and pitch primitives
status: todo
priority: none
labels:
  - engine
  - m0
  - tooling
created_at: 2026-10-01T03:07:59.922Z
updated_at: 2026-10-01T03:14:21.470Z
blocked_by:
  - "a9e075"
---

Create `packages/engine`, the framework-free heart of Ghostkeys (invariant 6), with strict TypeScript and its first real module.

**Research first:** TypeScript's current state. Pin `typescript@~6.0`: npm's `latest` is TypeScript 7 (the Go port), which typescript-eslint doesn't support yet (docs/research/05). Check what strictness flags 6.0 offers.

**Scope**
- Root `tsconfig.base.json`: `strict`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`; `moduleResolution: "bundler"`; `noEmit`.
- `packages/engine`: `@ghostkeys/engine`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`, no build step. Its tsconfig extends the base and stays **runtime-neutral**: no `@types/bun` or `@types/node`; lib ES2024 plus DOM (for `fetch` and `AbortSignal`). The engine runs in the browser too, so Bun or Node globals must not compile there.
- `typecheck` script in the engine and at the root (runs every workspace with `bun --filter`).
- First module, pitch primitives: scientific pitch notation ↔ MIDI number, and the piano range A0–C8. The syntax is uppercase letter A–G, an optional single `#` or `b`, octave 0–8, ASCII only; C4 = MIDI 60. The grid format will use this notation.
- `.vscode/settings.json` (JSONC, a comment above each entry) pointing VS Code at the workspace TypeScript, since the pinned version differs from the one bundled with the editor.
- Commit `bun.lock` (the first dependency arrives here) and confirm `scripts/setup.sh` still passes.

**Docs:** design.md → Repo, tooling & gate (the TS pin and why, the flags, tsconfig layout); design.md → Stack.

**Done when:** `bun run typecheck` passes, and the engine has no Bun or Node types available (using `Bun.file` in engine code fails to typecheck).
