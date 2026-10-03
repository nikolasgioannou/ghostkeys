---
id: "63eb7f"
title: Play a stored chunk on the sampled piano
status: todo
priority: none
labels:
  - audio
  - m3
  - web
created_at: 2026-10-01T03:11:21.733Z
updated_at: 2026-10-01T03:30:14.883Z
blocked_by:
  - "062540"
  - "e4d8ad"
  - "ea6a86"
---

The first sound in the app: Play performs the committed fixture chunk on the chosen piano.

**Research first:** the piano library chosen in the bake-off, inside this app: its current version (pin exact), loading it only on the client in a TanStack Start route under Vite (dynamic import, never evaluated during SSR), and how its samples are fetched and cached. The bake-off notes in design.md → Playback are the starting point.

**Scope**
- Decide where the samples come from (CDN or vendored), check the licence, and add attribution if required (README and design.md). If samples are downloaded or vendored, `scripts/setup.sh` fetches them (check, then act) and `.gitignore` covers them. Start loading samples on page load, before Play.
- A Web Audio lookahead loop ("A Tale of Two Clocks", docs/research/01) drains the queue into the piano. The bake-off found that neither library handles a sustain pedal scheduled ahead of time (design.md → Bake-off → Listening). Resolve the pedal into note lengths before scheduling, and hold each Salamander key until shortly before its release, so that `stopAll` can silence it.
- Play parses the fixture chunk with the engine, humanizes it and queues it. Pause and resume continue in place. At the end, playback stops (live composing comes next).
- On pause, a discontinuity or the end, silence what's sounding so nothing rings on.
- Check it with the tab in the background for a few minutes: browsers throttle timers in hidden tabs, and this is music people play while working.

**Docs:** design.md → Playback (piano library, sample source and licence, the scheduling loop).

**Done when:** Play performs the fixture with audible dynamics and pedal, pause and resume continue in place, and playback stays steady with the tab hidden.
