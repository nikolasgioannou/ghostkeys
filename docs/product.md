# Ghostkeys — Product

> A ghost at the piano: an endless, ever-evolving Romantic piano piece, composed note by note by Claude, that you can talk to and steer.

- **Design & specifications:** [design.md](design.md)
- **Build order:** [plan.md](plan.md)
- **Research:** [research/](research/)

## Vision

Press Play once and a piano plays an endless piece that never stops and keeps evolving. Type to it ("make it stormy", "something hopeful", "slow down") and the ghost answers in a line of text, then the music travels there.

## The user model

**One thing is playing, and you can steer it.** That is the whole product. Anything beyond it needs a strong reason.

## Decisions

| Area                 | Decision                                                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form factor          | A website, running **locally** (`localhost`). Structured so deploying later would just be a deploy step.                                                                                                                                                        |
| Audience             | **Personal**, single user. No auth.                                                                                                                                                                                                                            |
| Musical shape        | **One endless piece**, an _endless fantasia_: a persistent bank of themes, a slowly drifting state (key, tempo, mood, texture), themes that return transformed, and phrases that flow into each other with no hard section breaks.                              |
| Style                | **Romantic** era solo piano. Broaden later.                                                                                                                                                                                                                    |
| Originality          | **Original themes only.** Prompts use genre, form and texture terms, never "in the style of <composer>". Short public-domain excerpts may be used as texture examples, guarded by a copy check.                                                               |
| Who writes the notes | **Claude writes every note.** Code may suggest (e.g. a transformed motif draft), but Claude writes every bar. Code validates; it never silently composes.                                                                                                     |
| Steering             | **Typed chat.** A request takes effect at the **next chunk** (roughly 15–30 s), through a composed transition; gradually when the wording implies it ("slowly get darker").                                                                                    |
| The ghost's replies  | A short, in-character, one-line reply to each message. **It never speaks unless spoken to.**                                                                                                                                                                   |
| One piece, forever   | **There is only ever one piece.** No library and no "new piece" button: if you want something different, you steer it there. Its state is saved, so reopening the site (or restarting the server) resumes it.                                                  |
| Controls             | **Play/pause only.** No volume (use the system's), no skip. Pausing stops playback; once the buffer is full, generation stops too.                                                                                                                              |
| Screen               | **Only three things:** the paper roll, a play/pause control and a chat input. The ghost's reply fades in near the input and fades out. No visible chat history and no key or tempo readout. (The full history is kept so the ghost remembers earlier requests.) |
| Look                 | A **retro player-piano roll**: dark and candlelit; a perforated paper roll scrolls as notes are "punched". The roll is the visualizer. Sleek, minimal chrome. Shaped together with the user.                                                                   |
| Generation           | Composes **only while the site is open and connected**. Nothing runs in the background.                                                                                                                                                                        |
| Reset                | No UI. A developer script (`bun run piece:reset`) wipes the piece; the next Play starts fresh.                                                                                                                                                                 |
| Model-call log       | Every call to Claude is stored for **debugging**. Nothing is computed or displayed from it.                                                                                                                                                                    |
| Cost                 | Not a concern for now; expect a few dollars per listening hour. Tracked in OpenRouter's dashboard, **not in the app**.                                                                                                                                         |

## Out of scope

- Voice input (typing only).
- A library of pieces, or starting a new piece from the UI.
- Cost or usage tracking in the app.
- Volume or skip controls.
- Deployment: Ghostkeys runs locally.

## Prior art

- **Audio-domain real-time music models:** Google's Lyria RealTime and Magenta RT, MusicFX DJ, Suno, Riffusion. They generate audio directly; Ghostkeys composes symbolic notes that a sampled piano plays.
- **Symbolic piano models:** EleutherAI's Aria (a piano model trained on solo-piano MIDI) and the Anticipatory Music Transformer. Aria's duet demo is titled _"The Ghost in the Keys"_, a name collision worth knowing about.
- **Endless LLM music:** infinite-jazz, which streams LLM-written jazz in a tracker grid in real time.

Details are in [research/01-llm-music-generation.md](research/01-llm-music-generation.md).
