---
id: "a017f1"
title: Guard against copying the examples
status: todo
priority: none
labels:
  - engine
  - m1
created_at: 2026-10-01T03:10:00.457Z
updated_at: 2026-10-01T03:14:21.696Z
blocked_by:
  - "a0ef75"
---

Models copy what they're shown (docs/research/02). Invariant 3 says themes are original, so check every chunk against the texture examples.

**Scope**
- Compare interval sequences (RH top voice and LH bass) of generated bars against each example using interval n-grams.
- n and the similarity threshold are named constants recorded in design.md (the bake-off tunes them).
- Never compare against the theme bank: themes returning is intended.
- Emits a violation in the shared checker shape (`hard`), naming the bars and the example's texture label, so the revise turn can fix it.
- Tests: an example pasted verbatim (and transposed) is caught; an original passage in the same texture passes.

**Docs:** design.md → Composition (copy check); design.md → Invariants notes how invariant 3 is enforced.

**Done when:** verbatim and transposed copies of every example are flagged and the worked example passes.
