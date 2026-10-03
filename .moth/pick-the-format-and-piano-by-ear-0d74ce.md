---
id: "0d74ce"
title: Pick the format and piano by ear
status: done
priority: none
labels:
  - collab
  - docs
  - m2
created_at: 2026-10-01T03:10:49.606Z
updated_at: 2026-10-03T18:07:45.427Z
blocked_by:
  - "f7c4d6"
---

Done together with the user: they listen blind on the comparison page and choose.

**Scope**
- The user ranks the sessions and picks a piano. Reveal and discuss with the metrics in hand.
- Record the decision: the winning variant and why, the piano library, the grid resolution, chunk lengths (opening, post-steer, steady), effort level, revise policy, the example set, and the copy and harmony thresholds.
- Choose the steady chunk length knowing that steering is heard at the next chunk boundary: the worst-case steering delay is about one steady chunk plus the time to compose the post-steer chunk. product.md promises roughly 15–30 s, so weigh that against generation cost and continuity.
- Ask the user whether anything in the bake-off workspace should be kept when it's retired.
- **If the winner isn't variant C**, or the results change the pipeline or chunk shape, stop and update the affected tickets and docs/plan.md with the user before the next ticket. Much of what follows assumes plan + grid + check + revise.

**Docs:** design.md → Decision log; design.md → Open questions closed; docs/research/07-bakeoff.md gets the user's picks.

**Done when:** every open question in design.md is answered and recorded.

## Outcome

The user ranked C first, B second and A last in both blind sessions, and picked the Salamander Grand. Before that, the listening page's pedal handling was fixed: dropouts on the Salamander, no sustain on the Steinway, and the two pianos level-matched.

**Decisions** (design.md → Open questions and Decision log; docs/research/07-bakeoff.md → The picks):
- **Pipeline:** variant C.
- **Chunks:** opening 8 bars, steady 16 bars, post-steer turn 8 bars.
- **Effort:** `low`.
- **Unchanged:** the 12-slot resolution, the revise policy, the three texture examples, and the copy and harmony thresholds.
- **The format:** it accepts Claude's habits (`t:` without a separator, `cad=end`, double accidentals, major-scale accidentals on Roman numerals, a missing `END` is soft).
- **Kept from the bake-off workspace:** nothing.

**Steering latency:** waiting for the next chunk boundary could take about 90 s with 16-bar chunks, so the user chose to splice a short turn in at the next phrase about 25 s ahead.
- product.md now promises roughly half a minute.
- A new engine ticket (`632bdc`, Splice the piece at a phrase) comes before the steering-latency ticket, which is now "Hear steering at the next phrase".
- The piano-playback and paper-roll tickets carry the pedal lesson and the splice.
- Ticket 34 gained the format changes.
