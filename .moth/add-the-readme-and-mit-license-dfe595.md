---
id: "dfe595"
title: Add the README and MIT license
status: todo
priority: none
labels:
  - docs
  - m0
created_at: 2026-10-01T03:08:33.021Z
updated_at: 2026-10-01T03:44:54.137Z
blocked_by:
  - "322400"
  - "bb5341"
---

The repo is going public, so it needs a front page and a licence.

**Scope**
- `README.md`: what Ghostkeys is (one or two lines from product.md), the requirement (mise), getting started (`scripts/setup.sh`), the main scripts that exist so far (`check`, `test`, `lint`, `format`), and links to `docs/` and `AGENTS.md`. Later tickets add to it as they add commands (dev server, smoke test, database, reset).
- `LICENSE`: MIT, copyright 2026 Nikolas Ioannou.

**Docs:** README is the doc.

**Done when:** following the README word for word on a clean clone gets to a passing `bun run check`.
