---
id: "85f077"
title: Tweak the grid format
status: todo
priority: none
labels:
  - collab
  - docs
  - engine
  - m7
created_at: 2026-10-01T03:13:37.928Z
updated_at: 2026-10-01T03:14:22.335Z
blocked_by:
  - "fb10c7"
---

Done together with the user, who chose to adjust the notation at the end rather than review it up front.

**Scope**
- Go through design.md → Grid format with the user and agree the changes. If the list is long, file one ticket per change first, and keep this one for the first.
- A format change lands in one commit across everything that depends on it: the spec, schemas, parser, checkers, texture examples, the composer prompt, test fixtures and the fixture chunk.
- Bump the grid format version. The saved piece is in the old format, so confirm with the user before running `piece:reset` (it's the one piece).

**Docs:** design.md → Grid format; design.md → Decision log.

**Done when:** the agreed changes are in, the gate passes, and a fresh piece composes and plays in the new format.
