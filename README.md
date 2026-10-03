# Ghostkeys

A ghost at the piano: an endless, ever-evolving Romantic piano piece, composed note by note by Claude, that you can talk to and steer.

Press Play once and the piece never ends. Type to it ("make it stormy", "slow down") and the ghost answers in a line, then the music travels there.

## Getting started

You need [mise](https://mise.jdx.dev/getting-started.html). It provides Bun, Node and [Moth](https://github.com/nikolasgioannou/moth) at the versions in `mise.toml`.

```sh
scripts/setup.sh
```

The script trusts `mise.toml`, installs the tools and dependencies, installs the git hooks, and creates `.env` from `.env.example`. Paste your [OpenRouter API key](https://openrouter.ai/keys) into `.env` as `OPENROUTER_API_KEY`; `.env` is gitignored and never committed. It's safe to re-run; on a set-up checkout it prints only ✓ lines.

## Scripts

| Command             | What it does                                                                   |
| ------------------- | ------------------------------------------------------------------------------ |
| `bun run check`     | Everything the pre-commit hook runs: Moth, formatting, lint, typecheck, tests. |
| `bun run test`      | Runs the tests once (`test:watch` to watch).                                   |
| `bun run lint`      | Lints with ESLint (`lint:fix` to fix what it can).                             |
| `bun run format`    | Formats with Prettier (`format:check` to check only).                          |
| `bun run typecheck` | Typechecks every workspace.                                                    |
| `bun run smoke`     | Makes a few real calls to Claude through OpenRouter (costs a few cents).       |

## Docs

- [docs/product.md](docs/product.md): what Ghostkeys is and why.
- [docs/design.md](docs/design.md): how it works and how it's built.
- [docs/plan.md](docs/plan.md): the order it's built in (tickets live in `.moth/`).
- [AGENTS.md](AGENTS.md): how work happens in this repo.

## License

[MIT](LICENSE)
