# How a frontier LLM writes music best

_Research brief, 2026-09-30. Hard evidence on musical **quality** is thin; most papers measure validity or use small human ratings._

## 1. Format

- **Explicit timing beats ABC's running durations.** Libretto (https://arxiv.org/html/2606.22708), the closest analogue: header, per-bar chord labels, one line per voice; note = `pitch@onset-slot:duration`, chords with `+`, 16th-note slots in 4/4. In ABC, one duration edit shifts every later onset (1,005 recalculations vs 0 for the grid). Cost ≈ 3.5× characters.
- **Digits in ABC confuse models** — GPT-4 read the duration "4" as "a fourth apart", corrupting interval reasoning (https://arxiv.org/html/2407.21531v1).
- **Explicit formats are understood better:** MEI scored best among ABC/Humdrum/MEI/MusicXML on theory questions; Claude + MEI + contextual prompts reached 75% (https://arxiv.org/abs/2503.22853).
- **Bar-aligned hands:** NotaGen's interleaved ABC puts all voices of a bar on one line (https://arxiv.org/html/2502.18008v5); infinite-jazz uses a 16th-step `NOTE:VEL` tracker grid and plays endlessly in real time (https://github.com/simpolism/infinite-jazz).
- **Scale-degree encoding** is only shown to help trained models; awkward with Romantic chromaticism. Use absolute pitch with a Roman-numeral annotation per bar.
- **Code that generates music** (e.g. Strudel) compresses repetition but shows no quality gain (https://arxiv.org/pdf/2607.01849); a waveform-code "Claude Composer" experiment was widely panned (https://news.ycombinator.com/item?id=46891689).

## 2. Decomposition

- **Plan first, then notes.** Text2Score: LLM writes a per-bar plan (key, chord pitch-class set, range, density, dynamics) before notes; plan quality drives output (key match 89% → 69% with weaker planners). Direct ABC via ComposerX was valid only ~50% of the time (https://arxiv.org/html/2605.13431).
- **Role split helps:** ComposerX's melody/harmony/reviewer agents preferred over single-agent 57–77% (https://arxiv.org/html/2404.18081v1).
- **Tension with "Claude writes every note":** code may _propose_ a transformed draft (e.g. motif M1 sequenced up a 3rd) but Claude rewrites each bar in full.

## 3. Reasoning and revision

- Prompted chain-of-thought is mixed: GPT-4 theory 58% → 68%, little or negative elsewhere (https://arxiv.org/html/2407.21531v1).
- **Measure-and-revise is the strongest signal:** Libretto with Claude Opus — gap-fill pass 12% → 39% with a revise loop; full pieces 62% → 94%. ByteComposer's draft → theory-error vote → aesthetic selection reached "novice composer" level (https://arxiv.org/abs/2402.17785).
- **Code checkers, not self-judgement:** frontier models caught only 0–65% of parallel 5ths/octaves (https://aug5th.substack.com/p/llm-error-detection-parallel-5ths). Claude was best on a Bach-chorale writing test, still flawed (https://aug5th.substack.com/p/the-bach-benchmark).

## 4. Prompting

- Retrieved examples raised Libretto's full-piece pass rate 25% → 75%; similarity to references can be measured to control copying.
- Models "simply copied provided motifs" (https://arxiv.org/html/2407.21531v1).
- Use 2–3 short public-domain Chopin/Schumann excerpts in the format, labelled by texture (nocturne wide LH arpeggio, chorale, waltz, syncopated inner voice) + an interval n-gram copy check.

## 5. Long-form coherence

No LLM study of endless pieces found. Practitioner pattern: rolling context (infinite-jazz's `--context-steps`: more = continuity, less = fresher); motif bank (3–5 named motifs as interval + rhythm patterns); key-area roadmap a few chunks ahead; running summary. Steering: retarget the roadmap over 1–2 chunks with pivot chord, tempo ramp, register shift — no abrupt cut.

## 6. Failure modes

| Failure                                                     | Source                | Fix                                                                               |
| ----------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| Bar-duration errors                                         | LilyBench, Text2Score | Grid + parser that bounces bad bars (https://github.com/alexnodeland/llmcomposer) |
| Simple repetitive rhythm, off-key notes                     | 2407.21531            | Check notes against the planned chord per bar                                     |
| "Chord conveyor belt", over-stepwise melody, uneven density | Libretto              | Percentile checks on harmonic rhythm, steps, density                              |
| Parallels, voices out of range                              | Bach benchmark        | Outer-voice parallel check; span ≤ a 10th per hand                                |
| Flat dynamics, unchanging texture                           | —                     | Required per-bar dynamics + texture field; variance checks across chunks          |

## Ranked recommendation

1. **Plan → grid → check → revise:** per-bar plan (Roman numeral, cadence, motif ID + transformation, texture idiom, dynamics) with thinking; every note in a Libretto-style grid (absolute pitch, RH/LH lines, onset slots of 12 per quarter so 16ths and triplets fit); deterministic checker; one revise turn.
2. Same without revise (if latency forces it).
3. Interleaved ABC + thinking (cheapest, more rhythm errors).
4. Code realizes LH/transformations (conflicts with "Claude writes every note").

## Proposed bake-off (full version)

Variants A (ABC + thinking), B (plan + grid), C (B + checker + revise), D (C + code-drafted motif transformation Claude rewrites). Measures: bar validity, checker violations/16 bars, harmonic rhythm & cadences, motif recurrence, loop rate, copy rate, steering response, generation vs playback time, blind pairwise preference. Rough cost ≈ $0.12–0.30 per 16-bar chunk; full version ≈ $40–60. Variant C in production ≈ $15–20/listening hour before caching.
