# TanStack Start on Bun

_Research brief, 2026-09-30. Items marked **[verified]** were tested in a throwaway probe app._

## Status and scaffolding

- `@tanstack/react-start` 1.168.60 / `@tanstack/react-router` 1.170.41; near-daily releases. **Release Candidate**, "API is considered stable" (https://tanstack.com/start/latest/docs/framework/react/overview).
- Vinxi removed. Start is a Vite plugin (`tanstackStart()` from `@tanstack/react-start/plugin/vite`), Vite ≥ 7 (scaffold uses Vite 8.3). Nitro optional (v3 still beta).
- Scaffold: `bunx @tanstack/cli create <name>` (https://tanstack.com/start/latest/docs/framework/react/quick-start). Flags [verified]: `--package-manager bun`, `--toolchain biome|eslint`, `--no-examples`, `--blank`, `--deployment …`, `--add-ons drizzle,…`, `-y`. Defaults: Tailwind v4, React 19.2, TypeScript, Vitest + Testing Library. CLI telemetry on by default → `TANSTACK_CLI_TELEMETRY_DISABLED=1`.

## Bun

- Generated scripts run Vite under Node; change to `bun --bun vite dev|build|preview` (https://bun.com/guides/ecosystem/tanstack-start).
- Production: `nitro({ preset: 'bun' })`, or a custom `server.ts` wrapping the built handler's `.fetch` in `Bun.serve` [verified]. Needs React ≥ 19. `Bun.serve` idle timeout is 10 s → `idleTimeout: 0` or heartbeats for long streams.
- Open issues: #7991 (500 log noise on client disconnect), #7091 (slow cold dev start).

## Streaming (fits the browser-pull design)

- `createServerFn` handlers can be `async function*` or return `ReadableStream<T>`; client: `for await (const msg of await fn({ data }))`, fully typed (https://tanstack.com/start/latest/docs/framework/react/guide/streaming-data-from-server-functions). Accepts an `AbortSignal`.
- Server routes: `createFileRoute('/api/x')({ server: { handlers: { GET: … } } })` (`createServerFileRoute` is gone). SSE from a server route works in dev and prod on Bun [verified].

## WebSockets

- Not supported directly (https://github.com/TanStack/router/discussions/4576); only a Nitro/crossws workaround. Not needed here.

## Server state

- Dev runs SSR in-process under `bun --bun vite dev`; a `globalThis` singleton survives HMR [verified]. Use `import.meta.hot?.dispose` if a loop must be replaced.

## Validation

- `.validator()` (Standard Schema → Zod 4 directly). `.inputValidator()` is deprecated [verified in types].

## Database

- `bun:sqlite` works under `bun --bun vite dev` and in the production build [verified]; fails under plain `vite dev` (Node) with `ERR_UNSUPPORTED_ESM_URL_SCHEME 'bun:'` (https://github.com/oven-sh/bun/issues/18883).
- Drizzle 0.45.x (`drizzle-orm/bun-sqlite`); run drizzle-kit with `bun --bun` too (https://bun.com/guides/ecosystem/drizzle). Fallbacks: better-sqlite3, libsql.

## Client-only code

- Route `ssr: false` (or `'data-only'`), `<ClientOnly fallback>`, `createClientOnlyFn` (https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr). Create/resume `AudioContext` on a click; never touch `window`/`AudioContext` at module top level.
- File conventions: `*.functions.ts` for server-fn wrappers, `*.server.ts` for server-only code (import-protected) — secrets live only there.

## Risks

1. RC churn — pin exact versions. 2. Forgetting `--bun` breaks `bun:sqlite`. 3. SSE isn't end-to-end typed (streaming server functions are). 4. Idle timeouts and disconnects. 5. Slow dev restarts / duplicated loops without a guarded singleton.
