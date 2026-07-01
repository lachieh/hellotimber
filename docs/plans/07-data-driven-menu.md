# Plan 07 — Data-driven menu tree & routing unification

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md contracts or the code, STOP and report.

**Prerequisites:** plans 01–06 complete (they are — see `README.md`).
**Depends on:** nothing in flight. **Blocks:** plan 08 (messaging builds on the tree).

## Why this plan exists (the bug + the architecture smell)

Today the menu lives in **three coupled places** that have already drifted:

1. `packages/phone-core/src/nokia-menu.ts` — a builder producing the 3310 tree from a
   `Nokia3310Content` bag.
2. `website/src/phone/phone.ts` → `withWorkingSettings()`/`patchNode()` — path-keyed
   post-hoc swaps that replace stub nodes with app nodes (Tones pickers, Phone settings).
3. `website/src/routes/_phone/menu/*.tsx` — 16 hand-written route files that must mirror
   the tree, and don't.

**Confirmed bug (reproduced 2026-07-01, headed browser):** any phone path without a
dedicated route file — `menu/phone-book/search`, `menu/tones/composer`,
`menu/settings/phone-settings`, every stub submenu — falls into the catch-all
`website/src/routes/_phone/$.tsx`, which renders the 404 panel **and calls
`phone.navigate("menu/sim-services")`, hijacking the handset** away from the screen the
user is actually on. Selecting Phone book → Search on the phone instantly teleports the
LCD to "SIM services: page not found". Deep links to valid-but-unrouted paths do the same.
Browser back never breaks because history only ever contains previously-resolved URLs.

**Fix:** one tree, defined as data in the website, from which everything derives — the
phone's `MenuNode[]`, the URL space (one dynamic route that resolves against the tree),
per-path `<head>` metadata, content panels, and the sitemap. A URL 404s **only** when the
path does not exist in the tree; then (and only then) the sim-services easter egg fires.

## Architecture

```
website/src/content/menu.ts        THE tree: SiteNode[] (pure data, node-testable)
website/src/phone/site-tree.ts     helpers: toMenuNodes / resolveSitePath / allSitePaths
website/src/panels/                one .tsx per bespoke panel + registry.tsx (id → component)
website/src/routes/_phone/$.tsx    ONE dynamic route: resolve splat → panel + head, else 404
```

- **`SiteNode`** wraps phone-core's `MenuNode` with website-only metadata; `toMenuNodes()`
  strips it so the phone still receives a plain `MenuNode[]` (boundary rules intact — the
  phone never learns about routes or SEO):

  ```ts
  // website/src/content/types.ts (additions)
  import type { MenuNode } from "@hellotimber/phone-core";

  /** Website-side wrapper: MenuNode shape + web metadata. Children are SiteNodes. */
  export type SiteNode = (
    | { type: "submenu"; id: string; label: string; iconId?: string; children: SiteNode[] }
    | {
        type: "list";
        id: string;
        label: string;
        items: { id: string; label: string; body: string }[];
      }
    | { type: "reader"; id: string; label: string; body: string }
    | { type: "app"; id: string; label: string; appId: string }
    | { type: "action"; id: string; label: string; action: { kind: "href"; value: string } }
  ) & {
    web?: {
      /** meta description for this path's page (presence ⇒ indexable). */
      description?: string;
      /** key into the panel registry; omitted ⇒ generic panel from label/body. */
      panel?: string;
      /** exclude from sitemap even if described (stubs, easter eggs). */
      noindex?: boolean;
    };
  };
  ```

- **phone-core sheds the 3310 tree**: `nokia3310Menu`, `Nokia3310Content`, `ContentItem`,
  `ChatLine`, `DivertTarget` and `nokia-menu.ts` are **removed** (the tree is content, and
  content belongs to the website per AGENTS.md). phone-core keeps the generic `MenuNode`
  machine. This is a contract change → VISION.md is updated first (Task 1). The menu
  authenticity tests (13 menus, manual order, spec §5 labels) move to `website/tests`.
- **Routing**: delete all 16 `website/src/routes/_phone/menu/*.tsx` files and the old
  hijacking catch-all. One new `_phone/$.tsx` resolves `params._splat` against the tree:
  resolved → render the node's panel with `head()` from `web.description`; unresolved →
  `throw notFound()` (real 404 status) and the not-found component keeps the existing
  sim-services steer + noindex. `_phone/index.tsx` (standby, `/`) stays as-is.
- **Panels**: the existing panel JSX inside each deleted route file moves 1:1 into
  `website/src/panels/<id>.tsx`; `registry.tsx` maps `web.panel` keys to components.
  Nodes without a bespoke panel get `GenericPanel` (title + reader body / list items —
  covers stubs and deep submenus so every valid phone screen has a real page).
- **SEO**: `SITEMAP_PATHS` in `website/src/seo.ts` becomes `allSitePaths(tree)` filtered
  to indexable nodes (has `web.description`, not `noindex`). Sitemap route is unchanged.

## Authenticity upgrades while we're in the tree (spec §5)

Port the tree from `nokia-menu.ts` **verbatim first**, then apply these corrections:

- Declare the working apps directly in data (kills `patchNode`): `tones/ringing-tone`,
  `tones/keypad-tones`, `tones/screen-saver` as `app` nodes; `settings/phone-settings` as a
  `submenu` with `welcome-note` + `lights` app children (same ids/appIds as today).
- Settings 6-1/6-3/6-4 remain stub readers, but with the authentic child lists from spec
  §5 written into their bodies (so the reader shows real menu text, not just "not
  available").
- Games keeps `Snake II, Space Impact, Bantumi, Pairs II` in phone order (already correct).
- Leave Chat/Messages content-wiring exactly as-is — plan 08 owns messaging behavior.

## Contract changes (update VISION.md in Task 1, before any code)

1. **Remove from `@hellotimber/phone-core` public surface:** `nokia3310Menu`,
   `Nokia3310Content`, `ContentItem`, `ChatLine`, `DivertTarget`. Note in VISION that the
   3310 tree is website content (`website/src/content/menu.ts`) typed against `MenuNode`.
2. **No other package contracts change.** `MenuNode`, `Phone`, `navigate/subscribe` are
   untouched. The URL↔path mapping contract (`/` + phone path) is untouched.

## Conventions for every task

- Run from repo root; prefix `mise exec --` (or have mise active).
- After each task: `mise exec -- vp check --fix` and the named test command must pass.
- Never hand-edit `website/src/routeTree.gen.ts` — run `vp run website#dev` or `#build`
  to regenerate after adding/deleting route files.
- Commit per task: `feat(website): <what>` / `feat(phone-core): <what>` / `docs: <what>`.

## Tasks

### Task 1 — VISION.md contract update

- [ ] Edit `VISION.md`: remove the `nokia3310Menu`/`Nokia3310Content` lines from the
      phone-core contract block; add one sentence under the architecture section: "The
      3310 menu tree is website content (`website/src/content/menu.ts`, `SiteNode[]`);
      phone-core ships only the generic `MenuNode` machine."
- [ ] Commit: `docs: move 3310 menu tree ownership to website content (VISION)`

### Task 2 — failing tests for the tree (TDD)

- [ ] Write `website/tests/menu-tree.test.ts` (node env, `vite-plus/test`) asserting
      against `import { siteMenu } from "../src/content/menu"`, one `it` per bullet below.
- [ ] Assert exactly **13 top-level menus** in manual order: Phone book, Messages, Chat,
      Call register, Tones, Settings, Call divert, Games, Calculator, Reminders,
      Clock, Profiles, SIM services (spec §5).
- [ ] Assert submenu children match spec §5 labels/order for Phone book (10),
      Messages (10), Call register (8), Tones (9), Settings (4), Games (4).
- [ ] Assert every node id is kebab-case (`/^[a-z0-9]+(-[a-z0-9]+)*$/`) and ids are
      unique per level.
- [ ] Assert every `app` node's `appId` is one of the registered app ids exported by
      `website/src/phone/phone.ts` (export the id list for the test).
- [ ] Port the existing authenticity assertions from
      `packages/phone-core/tests/nokia-menu.test.ts` (whatever exists there) into this
      file so no coverage is lost when phone-core drops the builder.
- [ ] Run & expect FAIL (module doesn't exist yet): `mise exec -- vp run website#test`
- [ ] Commit: `feat(website): failing menu-tree authenticity tests`

### Task 3 — write the tree

- [ ] Add the `SiteNode` type to `website/src/content/types.ts` (definition above).
- [ ] Write `website/src/content/menu.ts` exporting `siteMenu: SiteNode[]` — port the
      tree from `packages/phone-core/src/nokia-menu.ts` (keep the `reader`/`stub`/`kebab`
      helpers, local to this file), inject content exactly as `content/index.ts` does
      today, declare the working app nodes directly (see Authenticity upgrades), and add
      `web.description` for the 13 top-level menus + the routed second-level pages
      (copy the descriptions from the current route files' `head()` blocks so SEO text
      is unchanged). Mark `sim-services` with `web: { noindex: true, panel: "sim-services" }`.
- [ ] Run & expect PASS: `mise exec -- vp run website#test`
- [ ] Commit: `feat(website): authentic 3310 menu tree as data (SiteNode[])`

### Task 4 — tree helpers

- [ ] Write `website/src/phone/site-tree.ts`:

      ```ts
      import type { MenuNode } from "@hellotimber/phone-core";
      import type { SiteNode } from "../content/types";

      /** Strip web metadata → the phone's MenuNode[] (deep). */
      export function toMenuNodes(nodes: SiteNode[]): MenuNode[];
      /** Resolve "menu/a/b" (or "/menu/a/b") → the SiteNode chain, or null. */
      export function resolveSitePath(nodes: SiteNode[], path: string): SiteNode[] | null;
      /** Every valid URL pathname ("/menu", "/menu/a", "/menu/a/b", …). */
      export function allSitePaths(nodes: SiteNode[]): string[];
      /** allSitePaths filtered to indexable nodes (web.description && !web.noindex). */
      export function indexablePaths(nodes: SiteNode[]): string[];
      ```

- [ ] Write `website/tests/site-tree.test.ts`: round-trip — `toMenuNodes` output has no
      `web` keys and structurally satisfies `MenuNode`; `resolveSitePath` resolves every
      entry of `allSitePaths` and returns null for `menu/nope`, `menu/phone-book/nope`;
      `"/menu"` resolves to the empty chain (carousel); `indexablePaths` ⊆ `allSitePaths`.
- [ ] Run & expect PASS: `mise exec -- vp run website#test`
- [ ] Commit: `feat(website): site-tree helpers (toMenuNodes/resolve/paths)`

### Task 5 — rewire the phone; remove the builder from phone-core

- [ ] `website/src/phone/phone.ts`: build the phone with
      `menu: toMenuNodes(siteMenu)`; **delete** `withWorkingSettings` and `patchNode`;
      export `export const APP_IDS = Object.keys(buildApps())` for the Task 2 test.
      `website/src/content/index.ts` keeps exporting the content modules but drops the
      `Nokia3310Content` adapter shape (types now live in `content/types.ts`).
- [ ] `packages/phone-core`: delete `src/nokia-menu.ts` + its test file; remove the two
      export lines from `src/index.ts`. Grep the repo for `nokia3310Menu|Nokia3310Content`
      — only `website/` history should remain; fix any straggler imports.
- [ ] Run & expect PASS: `mise exec -- vp run -r test` (phone-core tests still green
      standalone — AGENTS.md rule 3).
- [ ] Commit: `feat(website): phone consumes the data tree; drop nokia-menu from phone-core`

### Task 6 — panels move; the one dynamic route

- [ ] Create `website/src/panels/`: move each panel's JSX out of the 16 route files into
      `<id>.tsx` components (props: the resolved `SiteNode` chain). Add
      `GenericPanel.tsx` (title + body lines for readers/stubs; item list for lists) and
      `registry.tsx`:

      ```tsx
      export const PANELS: Record<string, React.ComponentType<{ chain: SiteNode[] }>> = {
        "phone-book": PhoneBookPanel, messages: MessagesPanel, /* … */,
        "sim-services": SimServicesPanel,
      };
      ```

- [ ] Rewrite `website/src/routes/_phone/$.tsx`:

      ```tsx
      export const Route = createFileRoute("/_phone/$")({
        loader: ({ params }) => {
          const chain = resolveSitePath(siteMenu, params._splat ?? "");
          if (chain === null) throw notFound();
          const node = chain.at(-1); // undefined ⇒ "/menu" carousel page
          return { title: pageTitle(node), description: node?.web?.description ?? null };
        },
        head: ({ loaderData }) => pageHead(loaderData), // per-path title/description; no meta ⇒ noindex
        notFoundComponent: NotFoundPanel, // the ONLY place that steers to menu/sim-services
        component: ResolvedPanel,          // looks up PANELS[node.web?.panel] ?? GenericPanel
      });
      ```

      `NotFoundPanel` keeps today's copy + `phone.navigate("menu/sim-services")` effect +
      `robots: noindex` — but now it can only mount for tree-invalid URLs.

- [ ] Delete the 16 files under `website/src/routes/_phone/menu/` (and the old `$.tsx`
      content). Run `mise exec -- vp run website#dev` once so `routeTree.gen.ts`
      regenerates; stop it.
- [ ] Run & expect PASS: `mise exec -- vp run website#test` and
      `mise exec -- vp run website#build`
- [ ] Commit: `feat(website): single tree-resolved route; panels registry; no more hijack`

### Task 7 — SEO derives from the tree

- [ ] `website/src/seo.ts`: replace the hand-maintained `SITEMAP_PATHS` with
      `["/", ...indexablePaths(siteMenu)]`. Update any tests that pinned the old list.
- [ ] Run & expect PASS: `mise exec -- vp run website#test`; then
      `mise exec -- vp run website#build` and check the built sitemap includes
      `/menu/phone-book` and **excludes** `/menu/sim-services`.
- [ ] Commit: `feat(website): sitemap derived from the menu tree`

### Task 8 — behavioral verification (the bug is dead)

- [ ] `mise exec -- vp run website#dev`, then run the checks below with a real browser
      (headed Playwright or manual — headless has no WebGL on this machine; the aria-live
      `[role=status]` mirror works regardless. **Wait ~5 s for boot; note the idle
      screensaver swallows the first key after 30 s idle — by design**).
- [ ] Enter → Enter → Enter (standby → menu → Phone book → **Search**): URL becomes
      `/menu/phone-book/search`, page shows the Phone book panel (or generic panel),
      the LCD stays on the Search list. **No SIM services hijack.**
- [ ] Deep link `http://localhost:3000/menu/tones/composer`: boots, LCD lands on the
      Composer stub reader, HTTP status 200, head has Tones/Composer title.
- [ ] `http://localhost:3000/menu/does-not-exist`: HTTP status **404**, page shows the
      SIM-services 404 panel, LCD shows SIM services (the steer — now correct).
- [ ] `Escape` (C) steps back level-by-level with the URL following; hold-Escape →
      standby at `/`.
- [ ] Standby `ArrowUp` → `/menu/phone-book/search` list on LCD, no hijack.
- [ ] SSR spot-check without a browser:
      `curl -s -o /dev/null -w "%{http_code}" localhost:3000/menu/phone-book/search` → 200;
      same for `/menu/nope` → 404.
- [ ] Update `docs/plans/README.md` status for plan 07 → done.
- [ ] Commit: `feat(website): verify tree-resolved routing end to end; mark plan 07 done`

## Done means

All 8 tasks committed; `vp run -r test` and `vp run website#build` green;
`vp check --fix` clean; no file under `packages/` imports from `website/`;
`grep -r "patchNode\|withWorkingSettings\|nokia3310Menu" --include='*.ts' --include='*.tsx' packages website/src`
returns nothing; the Task 8 checklist passes, most importantly: **navigating anywhere on
the handset never 404s and never teleports the LCD to SIM services.**
