---
id: "0d74ce"
title: Pick the format and piano by ear
status: todo
priority: none
labels:
  - collab
  - docs
  - m2
created_at: 2026-10-01T03:10:49.606Z
updated_at: 2026-10-01T03:29:53.865Z
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
