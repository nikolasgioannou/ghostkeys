---
id: "a9e075"
title: Write the setup script
status: todo
priority: none
labels:
  - m0
  - tooling
created_at: 2026-10-01T03:07:59.821Z
updated_at: 2026-10-01T03:14:21.454Z
blocked_by:
  - "09c97c"
---

Add `scripts/setup.sh`, the one command a contributor runs after cloning. Later tickets extend it whenever they add something to set up.

**Behaviour**
- A header comment lists every numbered step.
- `set -euo pipefail`, runs from the repo root wherever it's called from, and colours output only when it's a terminal.
- Each step checks first and prints `✓` if it's already done, otherwise prints `→` and acts. Failures print `✗` with instructions and exit.
- Global prerequisites are never installed: if mise is missing, fail with install instructions.

**Steps for now**
1. mise is installed.
2. `mise.toml` is trusted (`mise trust`).
3. Tools are installed (`mise install`): Bun, Node, Moth.
4. Dependencies are installed (`bun install --frozen-lockfile`).

Re-running it is a health check: on a set-up machine every line is a `✓` and nothing changes.

**Docs:** design.md → Repo, tooling & gate (what setup.sh does and the rule that it stays complete).

**Done when:** a second run prints only `✓` lines and changes nothing; with mise not on `PATH` it prints `✗` and the install instructions.
