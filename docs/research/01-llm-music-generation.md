# LLM music generation: formats, endless generation, playback

_Research brief, 2026-09-30. Question: how could an LLM (Claude Opus 5.5) generate endless, coherent classical piano music?_

## 1. Output format

| Format                                            | Tokens/note (est.) | Two-hand piano fit                                                                                        |
| ------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| ABC (`V:RH`/`V:LH`, `!p!`, `!ped!`)               | ~2–4               | Compact; heavy LLM pretraining exposure; repeats/structure explicit; pedal and intra-hand voicing awkward |
| Custom bar-line text DSL                          | ~2–4               | Same compactness; you own the grammar → pedal/velocity/voices first-class, trivially validated            |
| Event list (`pitch,vel,start,dur`) / MIDI-as-text | ~8–12              | Absolute time → LLMs drift on onsets, lose metre                                                          |
| JSON note list (structured outputs)               | ~12–20             | Always parses but 4–5× verbose; rhythm errors still possible                                              |
| MusicXML                                          | 50+                | Too verbose                                                                                               |
| LilyPond                                          | ~3–5               | Compact, zero-shot compilable (LilyBench), hard to parse to MIDI outside lilypond                         |

Evidence:

- ChatMusician: ABC parse success 99.6% (fine-tuned), GPT-4 94.6%, GPT-3.5 65.4%; ABC chosen for compression and explicit repetition. https://arxiv.org/abs/2402.16153
- "Can LLMs Reason in Music?": GPT-4 only model >50% valid-ABC rendering; models explain theory but fail multi-step application. https://arxiv.org/html/2407.21531
- ABC-Eval benchmark: https://arxiv.org/abs/2509.23350 · LilyBench: https://arxiv.org/abs/2606.08722
- MIDI-LLM uses AMT-style arrival-time triples (3 tokens/note) but only with vocabulary extension + fine-tuning: https://arxiv.org/abs/2511.03942

## 2. Infinite, coherent generation

Hierarchical planning:

1. A "form director" call (rarely) writes a JSON plan: key, tempo, metre, form, theme motifs, harmonic roadmap, character, dynamics arc.
2. "Chunk" calls (~16–32 bars ≈ 30–60 s) get: cached system prompt + grammar, the plan, a motif bank (literal notes, so recurrences are real), a running summary, the last 4–8 bars verbatim, and an explicit target for this chunk (section, cadence, ending key).
3. Each chunk ends with a machine-readable footer (key, last chord, open voices, pedal state) seeding the next.

Transitions: schedule modulations as bridge chunks (pivot chord / chromatic route / sequence / dominant pedal, ritardando). "Crossfade" is musical, not audio: the bridge sees the old theme's tail and the new theme's head.

Drift/repetition control: track interval n-gram fingerprints and pass "avoid" hints; enforce key/tempo schedule in code; rotate texture seeds.

Prior art:

- Audio-domain: Lyria RealTime / Magenta RT (SpectroStream codec LM, continuous streaming with text/audio steering) — https://arxiv.org/abs/2508.04651, https://magenta.withgoogle.com/magenta-realtime; MusicFX DJ, Suno, Riffusion.
- Symbolic: EleutherAI Aria (LLaMA-1B on ~60k h solo-piano MIDI; its Aria-Duet demo is titled _The Ghost in the Keys_ — naming collision) https://github.com/EleutherAI/aria, https://arxiv.org/html/2511.01663; Anticipatory Music Transformer https://arxiv.org/abs/2306.08620.

## 3. Playback

- Browser: Tone.js + `@tonejs/piano` (Salamander, 16 velocity layers, pedal) https://tambien.github.io/Piano/ or smplr SplendidGrandPiano (Steinway, CC64, sample-accurate time) https://github.com/danigb/smplr. Lookahead scheduling per "A Tale of Two Clocks" https://web.dev/articles/audio-scheduling.
- Native alternatives: FluidSynth + Salamander SF2; Pianoteq (paid, physically modelled).
- Never stall: queue parsed chunks; producer loop requests a new chunk when buffer < 2 chunks; stream and parse bar by bar; emergency fallback.
- Realism: velocity from dynamics curve + metric accent + melody weighting; ±5–15 ms onset jitter; rolled chords; phrase-end rubato; overlapping legato; pedal changes slightly after the beat.

## 4. Validation

Own TS parser with checks: per-hand bar duration = time signature; range A0–C8; ≤ ~5 notes per hand, span ≤ a 10th; known tempo/dynamic tokens. Repair ladder: deterministic fixes → targeted "fix bars 7, 12" re-prompt → regenerate. Light theory checks (key consistency, planned cadence, parallel fifths as warning). Structured outputs suit plan/footer, not notes.

## 5. Hybrids

Claude plans, a symbolic model (Aria or AMT) writes notes: more idiomatic pianism, but GPU hosting and weaker long-range form control; Aria may regurgitate. MuseCoco shows text → attributes → music: https://arxiv.org/abs/2306.00110. Suggested: start pure LLM, keep a note-event interface so a hybrid stage could slot in later.

## 6. Throughput (estimates)

Moderate classical texture ≈ 4–8 notes/s (250–500/min); dense étude 12+ notes/s. Compact DSL ≈ 1–2k output tokens per minute of music; JSON ≈ 5–8k. A ~60 s chunk ≈ 3–4.5k output tokens incl. thinking; one call per minute of music keeps ahead with a 2-chunk buffer in a compact format, not in JSON.
