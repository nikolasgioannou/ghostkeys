---
id: "a017f1"
title: Guard against copying the examples
status: done
priority: none
labels:
  - engine
  - m1
created_at: 2026-10-01T03:10:00.457Z
updated_at: 2026-10-01T04:24:21.893Z
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

## Outcome

- `checks/copy-check.ts`: `checkCopies(items, examples = TEXTURE_EXAMPLES)`. Melody = top RH note per onset; bass = lowest LH note on each beat. Each voice becomes interval + time-to-next steps (transposition-invariant); the longest run shared with an example's same voice (longest common substring) is a `hard` violation in the shared shape, naming the bars, hand and example label.
- Thresholds (named, recorded in design.md, tuned by the bake-off): 6 steps for the melody, 10 for the bass (bass lines in a common progression are naturally alike), and at least 3 distinct intervals in the run so a pedal note or plain arpeggio isn't a "tune". Never compares against the theme bank.
- Tests: every example pasted verbatim and transposed is caught; the worked example, an original waltz in the same texture and key, and a repeated pedal bass pass; violation location and wording.
- design.md → Composition (copy check) and Invariants (how invariant 3 is enforced).
