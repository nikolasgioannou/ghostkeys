# UI, linting and workspaces

_Research brief, 2026-09-30. Versions from the npm registry that day._

## Base UI

- Package **`@base-ui/react`** 1.8.0, stable v1 (the old `@base-ui-components/react` stopped at 1.0.0-rc.0). https://base-ui.com/react/overview/quick-start
- 48 parts incl. Dialog, Popover, Slider, Toggle, Tooltip, Scroll Area, Field/Input, Menu, Toast, Select, Switch, Tabs, Toolbar…
- Unstyled: Tailwind classes on each part; `className` may be a function of state; state via `data-*` attributes (`data-open`, `data-checked`…) → Tailwind `data-open:` variants. https://base-ui.com/react/handbook/styling
- Setup: `isolation: isolate` on the app root; `body { position: relative }` for iOS 26+ Safari. Popups use each component's `*.Portal`; no global provider.

## Tailwind CSS v4

- `tailwindcss` + `@tailwindcss/vite` 4.3.3. CSS-first: `@import "tailwindcss"` + `@theme { … }` tokens. Dark-only: define the dark palette as the tokens; skip `dark:`.
- TanStack Start: plugins `[tsConfigPaths(), tanstackStart(), viteReact(), tailwindcss()]`; `src/styles/app.css`; link via `?url` import in `__root.tsx` `head`. https://tanstack.com/start/latest/docs/framework/react/guide/tailwind-integration

## ESLint

- `eslint` 10.11, flat config only (`eslint.config.ts`).
- `typescript-eslint` 8.71 supports TypeScript `>=4.8.4 <6.1.0`; npm `latest` TypeScript is 7.0 (Go port) → **pin `typescript@~6.0`**. Typed linting: `projectService: true`, `strictTypeChecked`. https://typescript-eslint.io/getting-started/typed-linting/
- React: `eslint-plugin-react` 7.37.5 does **not** support ESLint 10 → `@eslint-react/eslint-plugin` 5.x; `eslint-plugin-react-hooks` 7.1 (flat recommended, React Compiler rules).
- `@tanstack/eslint-plugin-router` 1.162 (`flat/recommended`).
- Tailwind: `eslint-plugin-tailwindcss` 4.4 (v4 support, `cssConfigPath`) or `eslint-plugin-better-tailwindcss` 4.7 (`entryPoint`) — use the latter for correctness rules, leave class order to Prettier.
- Import sorting: `eslint-plugin-simple-import-sort` 14.
- `eslint-config-prettier` 10.1 from `eslint-config-prettier/flat`, last.

## Prettier

- `prettier` 3.9, `prettier-plugin-tailwindcss` 0.8 (`tailwindStylesheet: "./apps/web/src/styles/app.css"`, `tailwindFunctions: ["cn","clsx","cva"]`, plugin listed last). One root config + `.prettierignore` (ignore `.moth/`). https://github.com/tailwindlabs/prettier-plugin-tailwindcss

## Bun workspaces

- Root `"workspaces": ["apps/*", "packages/*"]`; `"@ghostkeys/engine": "workspace:*"`; optional `catalog:` for shared versions. https://bun.com/docs/pm/workspaces
- Source-only packages: `"exports": { ".": "./src/index.ts" }`, `"type": "module"`, no build — Vite and Bun transpile workspace TS natively.
- Shared `tsconfig.base.json` (`moduleResolution: "bundler"`, `noEmit`), per-package tsconfigs, no project references. `bun --filter '*' typecheck`, `bun --filter web dev`.
