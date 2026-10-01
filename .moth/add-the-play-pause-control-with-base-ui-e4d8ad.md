---
id: "e4d8ad"
title: Add the play/pause control with Base UI
status: todo
priority: none
labels:
  - m3
  - ui
  - web
created_at: 2026-10-01T03:11:21.515Z
updated_at: 2026-10-01T03:30:14.676Z
blocked_by:
  - "823bc4"
  - "ee0243"
---

The first of the three things on screen: one play/pause control.

**Research first:** Base UI (`@base-ui/react`): current version, the component that fits a play/pause toggle, styling with Tailwind `data-*` variants, and its setup needs (`isolation: isolate` on the app root; `body { position: relative }` for iOS Safari).

**Scope**
- The root route renders a single play/pause control. The player is client-only (selective SSR or `ClientOnly`); nothing touches `window` or `AudioContext` at module level.
- On page load, create the AudioContext suspended (so samples can preload later); resume it on the first click, which browsers require for audio.
- If the context is later suspended or interrupted (device change, Safari), resume it on the next interaction.
- The control holds playing/paused state. There's no sound yet.

**Docs:** design.md → Stack (Base UI; the client-only audio entry now reads "created suspended on load, resumed on the first click"); design.md → Playback (AudioContext lifecycle).

**Done when:** before the first click the AudioContext isn't running; after it, it's `running`; reload shows no SSR errors.
