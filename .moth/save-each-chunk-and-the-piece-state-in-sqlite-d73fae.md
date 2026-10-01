---
id: "d73fae"
title: Save each chunk and the piece state in SQLite
status: todo
priority: none
labels:
  - db
  - m5
  - tooling
created_at: 2026-10-01T03:12:27.880Z
updated_at: 2026-10-01T03:44:54.068Z
blocked_by:
  - "67e485"
  - "cbcc2b"
---

Give the piece a memory: every finished chunk is saved with the piece state as it stood after that chunk. The database becomes the single source of truth.

**Research first:** Drizzle ORM (0.45 stable vs 1.0 beta) with `drizzle-orm/bun-sqlite`, drizzle-kit migrations run with `bun --bun`, `bun:sqlite` options (WAL, busy timeout), and importing `bun:sqlite` in Vitest under the Bun runtime (docs/research/03).

**Scope**
- `packages/db` (`@ghostkeys/db`): the client, schema and migrations. Its tsconfig extends the base; it has a `typecheck` script; its tests are picked up by the root Vitest config. `@types/bun` goes wherever code runs on Bun, never in the engine; extend the engine's lint ban list if needed.
- Tables:
  - `pieces`: id (never reused, e.g. a random UUID, so an old tab or the model-call log can't confuse two pieces), created, grid format version.
  - `chunks`: piece id; chunk index, unique per piece; the complete validated `chunk-complete` payload as JSON; the raw grid text for debugging; and **the `ComposerContext` after this chunk**, from `nextContext`.
  Keeping a snapshot per chunk is what lets steering rewind to a chunk boundary later, so don't collapse it into a single state row.
- One database file at a path resolved from the repo root (gitignored), shared by the server, drizzle-kit and scripts. **Tests never open it**: the client takes the path as a parameter, and tests use an in-memory or temp-file database with the migrations applied. WAL on and a busy timeout set, so a script and the server can both write while the other has it open.
- The server reads the piece and its latest snapshot from the database at the start of every composition, saves the chunk on `chunk-complete`, and answers a request for an already-saved chunk by replaying exactly the stored payload. Remove the in-memory piece state; keep the one-composition-at-a-time guard.
- A piece whose grid format version differs from the code's needs a reset; say so clearly rather than mis-parsing it.
- `scripts/setup.sh` applies migrations (check, then act). Root `db:*` scripts.
- Tests: save and load round trip through the engine schemas, including `bun:sqlite` under Vitest; a replayed `chunk-complete` validates against the engine event schema.

**Docs:** design.md → Memory; design.md → Piece state & data model (tables, snapshots, ids, format version); design.md → Stack; README (db scripts).

**Done when:** killing the dev server mid-piece while music plays, once it's back the tab's retry continues the same piece with no repeated or skipped chunk (nothing worse than the holding pattern meanwhile), and running the tests leaves the real database file untouched.
