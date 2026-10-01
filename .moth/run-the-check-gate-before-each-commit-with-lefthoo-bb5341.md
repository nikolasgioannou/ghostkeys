---
id: "bb5341"
title: Run the check gate before each commit with lefthook
status: todo
priority: none
labels:
  - m0
  - tooling
created_at: 2026-10-01T03:08:32.812Z
updated_at: 2026-10-01T03:14:21.539Z
blocked_by:
  - "0a47f7"
  - "2a5b59"
  - "a9e075"
---

Every commit passes the same checks, automatically.

**Research first:** lefthook — how it's installed (npm dev dependency vs mise), `stage_fixed`, running in GUI git clients such as VS Code's Source Control, and how hooks find mise-managed tools like `moth`. If research favours installing lefthook through mise, ask the user before adding it to `mise.toml`, since that installs a new tool on their machine.

**Scope**
- Root `check` script, in this order: `moth check` → `format:check` → `lint` → `typecheck` → `test`. (A `build` step joins when there's something to build.)
- `lefthook.yml` pre-commit: Prettier on staged files (fixed files re-staged), then `bun run check`.
- `moth` must resolve inside the hook even when the shell hasn't activated mise.
- `scripts/setup.sh`: a step that installs the git hooks (check, then act).

**Docs:** design.md → Repo, tooling & gate (the gate and what it runs); docs/plan.md's working rules already say tickets don't repeat what the gate does.

**Done when:** a commit with a lint error, a type error or a failing test is rejected; a misformatted staged file is reformatted and re-staged; committing from VS Code's Source Control runs the same checks and finds `moth`.
