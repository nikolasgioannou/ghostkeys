# Bake-off results

_Results brief, 2026-10-03._

## What ran

All runs used Opus 5.5 through OpenRouter (Anthropic only), 4 chunks per session, with the scripted steering note at chunk 3.

| Run                | Variant                 | Chunk length | Effort |
| ------------------ | ----------------------- | ------------ | ------ |
| A-16bars-low-s1/s2 | A: two-voice ABC        | 16 bars      | low    |
| B-16bars-low-s1/s2 | B: plan + grid          | 16 bars      | low    |
| C-16bars-low-s1/s2 | C: plan + grid + revise | 16 bars      | low    |
| C-8bars-low-s1     | C                       | 8 bars       | low    |
| C-16bars-medium-s1 | C                       | 16 bars      | medium |

The medium-effort run was added to see whether more thinking buys cleaner chunks. Every chunk of every run completed; nothing needed a retry.

**Cost:** about $1.97 in total, estimated from the run files' token usage at Opus 5.5 prices. That's well under the $5–8 budget.

## Metrics

"Steady" means chunks 2–4. The first chunk carries the cache write and the opening choices. "First bar" is the time from the request to the first parsed bar. Variant A shows none because its ABC is parsed only once the reply is complete. "Before → after" counts violations before and after the revise turn (B and A never revise).

| Run         | Valid bars | Violations before → after (hard) | Chunks revised | RTF mean / steady / worst | First bar | Music | Output tokens (thinking) | Cost  |
| ----------- | ---------- | -------------------------------- | -------------- | ------------------------- | --------- | ----- | ------------------------ | ----- |
| A low s1    | 64/64      | 0 → 0                            | –              | 0.25 / 0.26 / 0.41        | –         | 197 s | 4,617 (1,333)            | $0.11 |
| A low s2    | 64/64      | 0 → 0                            | –              | 0.42 / 0.47 / 0.63        | –         | 173 s | 6,752 (2,807)            | $0.15 |
| B low s1    | 49/64      | 17 (16) → 17 (16)                | –              | 0.58 / 0.47 / 0.89        | 10.4 s    | 156 s | 9,523 (1,775)            | $0.24 |
| B low s2    | 64/64      | 6 (2) → 6 (2)                    | –              | 0.38 / 0.26 / 0.74        | 12.3 s    | 281 s | 11,570 (2,377)           | $0.25 |
| C low s1    | 64/64      | 15 (7) → 7 (7)                   | 4/4            | 0.68 / 0.60 / 0.91        | 9.3 s     | 181 s | 12,268 (3,289)           | $0.31 |
| C low s2    | 64/64      | 13 (8) → 4 (3)                   | 2/4            | 0.52 / 0.55 / 0.62        | 5.5 s     | 173 s | 9,713 (1,102)            | $0.24 |
| C medium s1 | 64/64      | 2 (1) → 2 (1)                    | 1/4            | 1.00 / 0.96 / 1.13        | 37.8 s    | 204 s | 20,551 (12,214)          | $0.46 |
| C 8-bar low | 32/32      | 10 (6) → 3 (3)                   | 4/4            | 0.95 / 0.88 / 1.15        | 6.4 s     | 89 s  | 7,901 (2,456)            | $0.21 |

## The real-time factor

The pass bar was a steady-state RTF of about 0.6 or lower.

- **At low effort, every variant passes at 16 bars.**
  - A passes with a wide margin (0.26–0.47). Its ABC needs about half the output tokens of the grid: no plan lines, no pedal, and running durations instead of onset slots.
  - B passes comfortably on steady chunks (0.26–0.47).
  - C passes, but only just (0.55–0.60). Its worst chunk reached 0.91, which happens when a long revise lands on a short chunk.
- **Medium effort fails** (steady 0.96). It thinks about 4× as much, and its first bar takes 38 s. It did write the cleanest grid (2 violations), but not cleanly enough to justify being twice as slow.
- **8-bar chunks fail** (steady 0.88). The fixed cost of each call, about 5 s to the first token plus the revise round trip, is spread over half as much music. They don't make the first bar much faster either (6.4 s against 5.5–9.3 s at 16 bars), because thinking happens before any bar either way.

**Answer:** use low effort and 16-bar chunks. If the grid variants are kept, variant C's revise turn is the only place without much margin. It could be limited to hard violations (soft harmony on its own then doesn't trigger a revise) to win some time back.

## What the checks caught

- **Copy check:** nothing in any run. No melody or bass line came close to the texture examples at `COPY_MIN_STEPS`, so the thresholds stay as they are.
- **Harmony:** 27 across the grid runs; 23 soft and 4 hard. Three of the four hard ones are `bVI` in a minor key. Claude means the major chord on the sixth degree (Db major in F minor), but the checker lowers the natural-minor sixth again (to Dbb). The checker and Claude disagree on the convention; the music is fine. The soft ones are spread across ordinary chords (`iv6`, `N6`, `V7/iv`, `Ger6`) and look like on-beat colour more than wrong harmony. The 0.34 and 0.67 thresholds seem about right once `bVI` is settled.
- **Revise** (variant C) cut violations from 15 → 7 and 13 → 4 at 16 bars, and 10 → 3 at 8 bars. What survives a revise is mostly hard harmony that Claude restates rather than rewrites.

Most of the remaining violations aren't musical. They're places where Claude and the format spec disagree.

| Issue                                 | Where                                 | What Claude wrote                                   | Effect                                                                                                |
| ------------------------------------- | ------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A tempo mark inside the pedal section | B s1 (15 bars), C s2 (3), C 8-bar (1) | `ped: c0 t: rit`, with no `\|` between the sections | The whole bar fails to parse and plays as a rest. This alone cost B s1 its 15 invalid bars.           |
| `cad=end`                             | C s1 (2), C s2 (1), C 8-bar (1)       | `P4 key=Fm i cad=end`                               | The spec says a bare `end` token, so the plan line fails, then the bar has no plan.                   |
| No `END` line                         | 8 of 26 grid chunks                   | the reply stops right after `F road …`              | Flagged as `missing-end` (hard) even though the chunk is otherwise complete, so it triggers a revise. |
| A double flat                         | C s2 (1)                              | `Bbb2`                                              | The pitch grammar allows only one `#` or `b`.                                                         |

All four, plus the `bVI` convention, are easy to fix at the format end, either by spelling the rule out in the prompt or by accepting what Claude naturally writes. Variant A's zero violations partly reflect how little it checks: there's no plan, so no harmony check; no pedal; and no themes.

## Steering

Every session followed the chunk-3 note ("Slowly grow darker and slower"). In all 8 runs, chunks 3–4 moved to a minor key (or towards one) and the tempo dropped by 10–20 bpm, for example from 72 to 66 to 58 in C s1. The roadmaps turned to darker mood words (`Fm:sombre`, `Bbm:brooding`). Whether it _sounds_ darker is for the listening session.

## The picks

The user listened blind and ranked the takes within each session:

| Session          | 1st | 2nd | 3rd |
| ---------------- | --- | --- | --- |
| 1 (16 bars, low) | C   | B   | A   |
| 2 (16 bars, low) | C   | B   | A   |

- **Variant:** C, first in both sessions. A came last both times despite having the cleanest metrics, so its zero violations didn't translate into better music.
- **Piano:** the Salamander Grand. It was compared level-matched, after the listening page's pedal fix.

**Decisions** (design.md → Open questions):

- **Chunks:** opening 8 bars, steady 16 bars, post-steer turn 8 bars.
- **Settings:** `low` effort; resolution, revise policy, examples and thresholds unchanged.
- **The format:** it accepts Claude's habits listed above, and `bVI`-style accidentals count from the major scale.
- **Steering:** it splices a turn in at the next phrase about 25 s ahead, because the chunk timings above make "the next chunk" up to about 90 s away. A 16-bar chunk took 17–37 s to compose and an 8-bar one 18–24 s, mostly because of the revise turn.

Nothing from the bake-off workspace is kept beyond this doc and the engine test fixture.
