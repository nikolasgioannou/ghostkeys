---
id: "53f225"
title: Split the plan into product and design docs
status: done
priority: none
labels:
  - docs
  - m0
created_at: 2026-10-01T03:07:21.176Z
updated_at: 2026-10-01T03:57:04.871Z
---

`PLAN.md` holds everything agreed while planning. Move it into the documents the rest of the tickets point at, then delete it. No new decisions: this is a reorganisation, plus the corrections listed below.

**docs/product.md** — what Ghostkeys is and why:
- A one-line tagline (from PLAN.md's opening quote).
- Vision. Word it as "press Play once and a piano plays an endless piece" (browsers need a click before audio).
- The user model: one thing is playing, and you can steer it. Anything beyond that needs a strong reason.
- Product decisions (PLAN §1 table).
- Prior art, including the name collision with EleutherAI Aria's "The Ghost in the Keys" demo.
- Out of scope (voice input, library of pieces, cost tracking, volume, deployment).

**docs/design.md**:
- Part 1, How it works: The piece · Composition · Steering · Playback · Memory · Bake-off (PLAN §5) · Open questions (PLAN §8; closed by the bake-off). The look-design ticket adds a Look section here later.
- Part 2, Technical decisions: Stack · Repo, tooling & gate · Claude access (AI SDK + OpenRouter, including the gotchas from PLAN §4) · Transport · Testing.
- Part 3, Specifications. It opens with "a starting sketch, not a contract: when implementation finds something better, do that and update this doc in the same commit", then the Invariants (the six from PLAN §6). The tickets that define them add Grid format, Piece state & data model and Stream events; don't add empty headings for them now.
- Decision log (decisions made during planning, with the research brief that backs each) · Risks (from the research briefs).

**Corrections while moving:**
- Provider pinning is `provider: { only: ['anthropic'], allow_fallbacks: false }` (PLAN §4 says `order`; docs/research/04 is right).
- PLAN §6's working conventions go to design.md → Repo, tooling & gate, stated on their own (drop the attribution to another project). `AGENTS.md` is written separately.
- PLAN §7 (Milestones) and §6's "Ticket order" are superseded by docs/plan.md, which is their destination as it stands; don't copy them.

**docs/plan.md** already exists (the ticket sequence). Replace its "Plan of record: PLAN.md …" line with links to product.md, design.md and research/.

**Docs:** this ticket is the docs.

**Done when:** every PLAN.md section has a destination (check against `git show HEAD:PLAN.md`), PLAN.md is deleted, and nothing was decided that PLAN.md didn't already say.

## Outcome

- `docs/product.md`: tagline, vision ("press Play once…"), the user model, the product decisions table, out of scope, prior art (including the Aria name collision).
- `docs/design.md`: Part 1 (The piece, Composition, Steering, Playback, Memory, Bake-off, Open questions), Part 2 (Stack, Repo, tooling & gate, Claude access, Transport, Testing), Part 3 (the sketch note and the six invariants), Decision log and Risks.
- Corrections: provider pin is `only`; conventions stated without outside attribution; the playability, steering-boundary and per-chunk-snapshot decisions made while filing the tickets are reflected in Part 1 and the Decision log.
- `PLAN.md` deleted; `docs/plan.md` links product.md, design.md and research/.
