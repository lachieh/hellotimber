# AGENTS.md — Operating Manual for Implementation Agents

This repo is **hellotimber**: Lachlan Heywood's portfolio website, built as a faithful,
working Nokia 3310 rendered in three.js — where the phone's menus contain the portfolio
content, and the website's routes mirror the phone's screens.

**Read these before writing any code:**

- `VISION.md` — what we're building and why, the menu→route map, architecture, and contracts.
- `docs/plans/README.md` — the plan index. Every implementation task lives in a numbered
  plan file. Work on exactly the task you were assigned; do not start tasks from other plans.
- `docs/specs/integration-notes.md` — verified Vite+/TanStack/R3F patterns (versions,
  configs, gotchas). `docs/specs/nokia-3310.md` — phone behavior ground truth.

## Environment & toolchain

Tooling is managed by [mise](https://mise.jdx.dev) via `.config/mise.toml` (Node 22 +
the Vite+ CLI). The mise `[env]` block puts `node_modules/.bin` on PATH, so the
workspace-local `vp` binary resolves once dependencies are installed.

```sh
mise install                 # one-time: install node + vite-plus
mise exec -- vp install      # install workspace dependencies
```

If your shell has mise activated, plain `vp <cmd>` works from the repo root.
If not, prefix every command with `mise exec --`. **Never** install tools globally
(no `npm i -g`, no homebrew) — add them to `.config/mise.toml` or as workspace deps.

This is a **Vite+** monorepo (`vp` wraps Vite 8, Vitest 4, tsdown, Oxlint, Oxfmt).
Vite+ docs are local at `node_modules/vite-plus/docs/`. Command reference:

| Command                                                                        | What it does                                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `vp install`                                                                   | pnpm install across the workspace                                |
| `vp run website#dev`                                                           | dev server for the website (port 3000)                           |
| `vp run website#build`                                                         | production build of the website                                  |
| `vp run -r test`                                                               | run tests in every workspace package                             |
| `vp run <pkg>#test`                                                            | run one package's tests (vitest)                                 |
| `vp check --fix`                                                               | format + lint + typecheck (runs on pre-commit via `.vite-hooks`) |
| `vp create vite:library --directory packages/<name> --no-interactive --no-git` | scaffold a new package                                           |

Packages are consumed **from TypeScript source** (`"exports": { ".": "./src/index.ts" }`)
— no build step, and React Fast Refresh works across package boundaries. `vp pack`
exists for future npm publishing only; do not add `build` scripts to packages.

## Workspace layout

```
website/            TanStack Start app — the ONLY place everything is wired together
packages/
  phone-core/       @hellotimber/phone-core   — pure-TS Nokia 3310 state machine ("firmware")
  phone-screen/     @hellotimber/phone-screen — ScreenModel → 84×48 pixels on a 2D canvas
  phone-3d/         @hellotimber/phone-3d     — R3F <Nokia3310/> 3D model (body, keys, screen mesh)
  snake/            @hellotimber/snake        — Snake II game logic (pure TS)
  nokia-os/         @hellotimber/nokia-os     — stock v6.39 firmware + its pixels (menu, painter, goldens, demo)
docs/plans/         numbered implementation plans (the source of truth for tasks)
```

Workspace members are declared in `pnpm-workspace.yaml` (`website`, `packages/*`).
Shared dependency versions live in the `catalog:` section of `pnpm-workspace.yaml` —
use `"catalog:"` specifiers where a catalog entry exists.

## Package boundary rules (non-negotiable)

1. **The phone must not know about the router.** No package under `packages/` may
   depend on `@tanstack/*`, anything from `website/`, or any routing concept. The phone
   is _controlled_ through its own public API (`navigate(path)` / `subscribe(...)`);
   `website/` owns the URL↔phone bridging code.
2. **Allowed internal dependency direction** (type-level or runtime):

   ```
   website ──▶ phone-core, phone-screen, phone-3d, snake   (not nokia-os yet)
   nokia-os ──▶ phone-core, phone-screen   (runtime: kernel/menu model/Timeline; LCD toolkit)
   phone-screen ──▶ phone-core (type-only imports of ScreenModel — no runtime dep)
   snake, phone-3d ──▶ (no internal deps)
   ```

   Anything else is a boundary violation. `phone-3d` receives a ready-made
   `HTMLCanvasElement` for the screen texture and reports key presses via callback —
   it never imports phone-core.

3. **Every package must work standalone**: its tests pass with only the package's
   _declared_ dependencies present (no undeclared siblings), and its README shows usage
   outside this repo.
4. **React/three are peer dependencies** in packages that need them (plus
   devDependencies for local dev/tests). Never put `three` in `dependencies` —
   duplicate three instances break `instanceof` checks at runtime.
5. Integration code (adapters between packages, router bridge, content) lives in
   `website/src/` only.

## Creating a new package

1. `mise exec -- vp create vite:library --directory packages/<name> --no-interactive --no-git`
2. Delete the nested scaffold cruft — the monorepo root already provides it:
   `packages/<name>/pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.vite-hooks/`, `AGENTS.md`, `.gitignore`
3. Rewrite `package.json` to the source-exports shape (plan files show the exact
   content per package):

   ```json
   {
     "name": "@hellotimber/<name>",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "exports": { ".": "./src/index.ts", "./package.json": "./package.json" },
     "scripts": { "test": "vp test run" },
     "devDependencies": { "typescript": "catalog:", "vite-plus": "catalog:" }
   }
   ```

   No `build` script, no `main`/`types`, no `files`/`publishConfig`/`author` boilerplate.

4. Give the package its own `tsconfig.json` (the root one has no JSX/DOM libs) — copy
   the template from `docs/specs/integration-notes.md` §1.
5. `mise exec -- vp install` from the repo root to link it into the workspace.

The consuming side declares `"@hellotimber/<name>": "workspace:*"`.

## Stock firmware goldens (nokia-os)

`packages/nokia-os` is checked pixel-for-pixel against emulator captures of the real
v6.39 firmware. The capture corpus (`nokia-3310/` in the main checkout, called `$REF` in
plan 13) is gitignored and **never committed**; nothing from `$REF/extracted` is ever copied.

- `vp run @hellotimber/nokia-os#import-captures <REF>` turns captures into committed text-grid
  fixtures under `packages/nokia-os/goldens/` plus one index per plan, `goldens/index/<NN>.json`.
- `vp run @hellotimber/nokia-os#regenerate` regenerates `src/resources/generated/` (fonts, icons,
  boot frames, status art, widgets, Snake II, sounds) from those goldens.
- Never hand-edit `goldens/**` or `src/resources/generated/**`: change the importer, its
  capture-set table or the extractor inputs and regenerate. Tests never read `$REF`.

## Fidelity standard

"Strict repro" means human-perceivable fidelity, not millisecond-exact timing (Lachlan,
2026-10-15): a difference that does not change the phone at a human-perceivable level does not
matter. Every golden comparison applies one rule, implemented in
`packages/nokia-os/tests/support/golden.ts` (`timingToleranceMs`, `withoutPartialDraws`):

- **Pixels:** every settled frame is pixel-exact. No pixel tolerance.
- **Timing:** an instant `t` ms after its reference (the trigger; a sound program's onset; the
  previous tick for game intervals; the last key-down for lights) matches within
  `clamp(t / 20, 17, 50)` ms: one display frame (17 ms) for animation steps, growing as 5 % of
  `t` to 50 ms for holds of about a second or longer (notes, delays, boot holds, light timeouts)
  and drift across long timelines.
- **Partial redraws:** a frame shown for less than 17 ms, in the golden or the recording, is
  neither required nor forbidden, as long as the frames around it match.
- **Sound:** frequencies and volume registers are exact; edge times follow the timing rule.
- **Gameplay timing** (a game's speed, a grace window that decides survival) follows the same
  rule interval by interval, so it still counts.

Key-to-redraw, key-to-sound and key-to-light latency stay outside the rule (plan 14 D8, plan 16
D8, plan 25 D2). A difference the rule counts is a known gap with its reason, never a widened
per-test tolerance. Plans must not add complexity, known gaps or per-test tolerances to chase
differences the rule calls imperceptible, nor impose arbitrary API limits for them. This
supersedes the tolerance text of earlier plans (±2 ms, `PROBE_TOLERANCE_MS`, game tick and sound
edge tolerances).

## Parallel plan conventions (nokia-os)

Plans 17+ run in parallel git worktrees. Each plan owns its own files below and touches shared
files only through one registration line, so branches merge without conflicts. Paths are under
`packages/nokia-os/` unless they start with `docs/`.

1. **Capture set:** `scripts/capture-sets/<NN>-<slug>.ts` exports a `PlanCaptureSet`
   (`plan: "<NN>"`, `lcd`/`ticks`/`sounds` entries, `notImported`), registered by one
   `export { … } from` line in `scripts/capture-sets/index.ts`. Its goldens are indexed in
   `goldens/index/<NN>.json`, which no other plan's import changes. A golden another plan's set
   lists as `pending:<NN>` stays in that plan's index: flip its status there (tree and sound
   note goldens: delete your group from `PLACEHOLDER_OWNERS` in `scripts/tree-capture-set.ts`,
   grouped by owner plan; the matching feature drops the same `placeholders`).
2. **Acceptance:** `tests/acceptance/<NN>-<slug>.test.ts` calls `acceptancePlan({ plan, scenarios,
knownGaps, timeoutsMs })` once and registers no other tests; it runs the goldens of
   `goldens/index/<NN>.json`. `tests/acceptance/coverage-guard.test.ts` collects every plan file
   and checks them together (one plan file per index file, scenarios and known gaps per plan, tree
   coverage). Adding a plan is adding this file; shared helpers go in `tests/support/`.
3. **Firmware:** behaviour lives in `src/firmware/features/<slug>.ts`, one `StockFeature` per menu
   area or behaviour (`screens` by tree node number, `leads`, `optionLists`, `placeholders`,
   `sameAs`, `widgets` tables, `settings` tables, `records`; see `features/feature.ts`). Extend
   the feature of the area you implement (replace its placeholders with `screens`); a new feature
   is a new file plus one `export { … } from` line in `features/index.ts`. `src/firmware/stock.ts`
   composes them and throws on a node bound twice. Keep `src/firmware/generated/stock-tree.ts` as
   generated.
4. **Generated resources** (`src/resources/generated/**`) are shared outputs of every plan's
   goldens. On a merge conflict there, take either side, merge the inputs, then run
   `mise exec -- vp run @hellotimber/nokia-os#regenerate` (deterministic; the resources test fails
   while a file differs from what it writes). Conflicts in `goldens/index/<NN>.json` only arise
   within one plan: rerun `import-captures`.
5. **Specs:** firmware facts go in `docs/specs/stock/<area>.md` (foundation, menu-depth,
   storage-and-settings, sound, snake-ii, …); `docs/specs/nokia-3310.md` §10 is an index with one
   row per file.
6. **Demo:** a feature's demo controls are a `DemoPanel` in `demo/panels/<slug>.ts` plus one
   `export { … } from` line in `demo/panels/index.ts`; `demo/main.ts` stays the shell.
7. **Commits:** run `mise exec -- vp check --fix` (repeat `vp fmt` until stable), then
   `git commit --no-verify` with only your files staged (other agents may share the worktree:
   prefer `git commit -- <paths>`). Never `git stash`. Never stage `TODOS.md`.

## Testing conventions

- Import test APIs from **`vite-plus/test`**, never `vitest` (the
  `prefer-vite-plus-imports` lint rule rewrites it anyway):
  `import { describe, it, expect } from "vite-plus/test"`.
- `vp test` is a single run; `vp test watch` to watch. Test config (environment,
  include globs) goes in the package's `vite.config.ts` `test` block — never a
  `vitest.config.ts`.
- Default env is `node` — correct for phone-core/snake/phone-screen logic. jsdom is for
  website component tests. Never mount an R3F `<Canvas>` in jsdom (no WebGL there).

## Working agreement

- **Follow your plan file exactly.** Each task in `docs/plans/` lists files, code, and
  verification commands. If the plan conflicts with reality (API drift, missing file),
  stop and report the discrepancy instead of improvising a workaround.
- **TDD.** Write the failing test first when the plan provides one. Pure-logic packages
  (phone-core, snake, phone-screen) must keep high coverage — they are the cheapest
  things in this repo to test and the most expensive to debug visually.
- **Verify before claiming done**: `mise exec -- vp check --fix` and the plan's test
  command must pass. For website tasks, `mise exec -- vp run website#build` must pass.
- **Commit per completed task**, message format: `feat(phone-core): <what>` /
  `fix(website): <what>` / `docs: <what>`. The pre-commit hook runs `vp check --fix`.
- **Authenticity is a requirement, not a vibe.** Behavior of the phone (menu order,
  key handling, timings, pixel layout) follows the authenticity spec referenced by
  `VISION.md`. When in doubt, do what a real Nokia 3310 does.
- Do not add dependencies beyond what the plan specifies without flagging it.
- Do not edit `website/src/routeTree.gen.ts` (generated) or `pnpm-lock.yaml` by hand.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
