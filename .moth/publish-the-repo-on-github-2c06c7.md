---
id: "2c06c7"
title: Publish the repo on GitHub
status: todo
priority: none
labels:
  - collab
  - infra
  - m0
created_at: 2026-10-01T03:08:33.125Z
updated_at: 2026-10-01T03:14:21.586Z
blocked_by:
  - "10d338"
  - "322400"
  - "dfe595"
---

Done together with the user, because it publishes to their GitHub account.

**Scope**
- With the user's go-ahead, create the public repo `nikolasgioannou/ghostkeys` (`gh repo create`), with product.md's one-line tagline as its description, and push `main`.
- No GitHub Actions and no deployment. Ghostkeys runs locally.
- Agree with the user when to push from now on (after every commit, at each milestone, or manually), and record the answer in AGENTS.md. That edit is this ticket's commit.

**Docs:** AGENTS.md (the push rule); design.md → Repo, tooling & gate mentions the remote.

**Done when:** the repo is public on GitHub with the full history, `git status` shows `main` tracking `origin/main`, and the push rule is in AGENTS.md.
