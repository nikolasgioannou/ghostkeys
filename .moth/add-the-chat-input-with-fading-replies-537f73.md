---
id: "537f73"
title: Add the chat input with fading replies
status: todo
priority: none
labels:
  - m6
  - ui
  - web
created_at: 2026-10-01T03:13:14.518Z
updated_at: 2026-10-01T03:44:53.562Z
blocked_by:
  - "0bd789"
  - "e4d8ad"
---

The third and last thing on screen: a place to type to the ghost.

**Scope**
- A single text input (Base UI). Enter sends the text with the player's piece id and the queue's playing-chunk index (empty before anything plays); the input clears and keeps focus.
- The reply fades in near the input, stays a few seconds, then fades out. A newer reply replaces an older one. No history, no transcript, nothing else on screen (product.md: one thing is playing, and you can steer it).
- While waiting for a reply, at most a subtle pending hint. A failed send shows nothing; it's logged.
- Fade timings are named constants. Styling stays minimal; the look comes later.

**Docs:** design.md → Steering (the interaction); product.md if anything about the interaction is decided here.

**Done when:** typing a message and pressing Enter clears the input, a reply fades in and out, and nothing else appears on screen.
