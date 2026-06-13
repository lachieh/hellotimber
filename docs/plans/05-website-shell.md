# Plan 05 — Website shell: routes, router⇄phone bridge, persistent 3D stage

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task. If this plan contradicts VISION.md contracts or the code, STOP and report.

**Prerequisites:** plans 01–03 are **done** — `@hellotimber/phone-core`, `@hellotimber/phone-screen` and `@hellotimber/phone-3d` exist in `packages/` with the VISION.md public contracts (as refined by those plans' "Contract deviations" notes). Verify before starting: `packages/phone-core/src/index.ts`, `packages/phone-screen/src/index.ts`, `packages/phone-3d/src/index.ts` (or `.tsx`) all exist. If any is missing, STOP and report. Plan 04 (`@hellotimber/snake`) is required **only for Task 9**, which is marked accordingly.

**Goal:** Wire everything together in `website/`: a route for every entry in the VISION sitemap table, the URL⇄phone bridge with echo suppression, a client-only **persistent** 3D phone stage (the WebGL canvas never remounts on navigation), document-level keyboard input mapped to phone keys, and an accessible HTML content panel per route fed by the same content module the phone menu uses.

## Architecture

```
routes/__root.tsx                 document shell (Header/Footer kept; title updated)
└── routes/_phone.tsx             pathless layout — mounts ONCE, survives navigation
    ├── <ClientOnly><Suspense>    SSR renders a skeleton; canvas hydrates in
    │     <PhoneStageHost/>       lazy() — keeps three.js out of the initial chunk
    └── <Outlet/>                 ONLY this subtree swaps per route → ContentPanel

src/phone/phone.ts                getPhoneRuntime() — module singleton, client-only:
                                  createPhone({ menu: nokia3310Menu(content), apps, … })
                                  + createScreenRenderer() (84×48 canvas)
                                  + rAF loop driving phone.tick(performance.now())
src/phone/paths.ts                phonePathFromUrl / urlFromPhonePath  (pure, tested)
src/phone/router-sync.ts          connectPhoneToRouter(router, phone) — §4 pattern,
                                  echo flag + idempotence guards + initial alignment
src/phone/keyboard.ts             document keydown/keyup → phone.send(KeyEvent)
src/phone/apps/snake-app.ts       @hellotimber/snake → PhoneApp adapter   (Task 9)
src/content/index.ts              ONE content module: feeds nokia3310Menu AND panels
```

Control flow: **URL → phone** via `router.subscribe("onResolved", …)` → `phone.navigate(phonePathFromUrl(pathname))`; **phone → URL** via `phone.on("pathchange", …)` → `router.navigate({ to: urlFromPhonePath(path) })`. Both directions carry an idempotence guard and a synchronous echo flag, so the loop always terminates (integration-notes §4; phone-core guarantees `navigate()` to the current path emits no `pathchange`).

## Tech stack

- TanStack Start / React Router (installed: react-router 1.170.15, react-start 1.168.25), React 19.2, Tailwind 4 (already in the website).
- `three` / `@react-three/fiber` / `@react-three/drei` via `catalog:` (pnpm-workspace.yaml already pins ^0.184.0 / ^9.6.1 / ^10.7.7).
- Workspace packages consumed from TypeScript source (`workspace:*`, no build step).
- Tests: Vitest via `vp test`, imports from **`vite-plus/test`** only. Default env `node`; jsdom per-file via a `// @vitest-environment jsdom` docblock. Never mount an R3F `<Canvas>` in jsdom.

## Files at completion

```
vite.config.ts                          (root: + lint override for packages/phone-3d/**)
website/
├── package.json                        (+ workspace & three deps; + snake in Task 9)
├── vite.config.ts                      (+ resolve.dedupe, ssr.noExternal, test block)
├── src/
│   ├── router.tsx                      (+ bridge wiring, client-only)
│   ├── routeTree.gen.ts                (regenerated — never hand-edited)
│   ├── styles.css                      (+ .phone-stage / .phone-skeleton)
│   ├── components/
│   │   ├── ContentPanel.tsx            NEW — accessible panel beside the canvas
│   │   ├── Header.tsx                  (About link removed)
│   │   ├── Footer.tsx                  (unchanged)
│   │   └── ThemeToggle.tsx             (unchanged)
│   ├── content/
│   │   └── index.ts                    NEW — Nokia3310Content (SAMPLE DATA)
│   ├── phone/
│   │   ├── phone.ts                    NEW — getPhoneRuntime() singleton
│   │   ├── paths.ts                    NEW — URL ⇄ phone path mapping
│   │   ├── router-sync.ts              NEW — connectPhoneToRouter()
│   │   ├── keyboard.ts                 NEW — keyboard → PhoneKey
│   │   ├── PhoneStageHost.tsx          NEW — runtime → <PhoneStage> props
│   │   └── apps/
│   │       └── snake-app.ts            NEW — snake → PhoneApp adapter (Task 9)
│   └── routes/
│       ├── __root.tsx                  (title → "Lachlan Heywood")
│       ├── _phone.tsx                  NEW — pathless layout (canvas lives here)
│       └── _phone/
│           ├── index.tsx               "/" standby           (moved + rewritten)
│           ├── $.tsx                   catch-all → SIM-services-flavoured 404
│           └── menu/
│               ├── index.tsx           /menu
│               ├── phone-book.tsx      /menu/phone-book
│               ├── messages/
│               │   ├── index.tsx       /menu/messages
│               │   ├── inbox.tsx       /menu/messages/inbox
│               │   └── write.tsx       /menu/messages/write
│               ├── chat.tsx            /menu/chat
│               ├── call-register.tsx   /menu/call-register
│               ├── tones.tsx           /menu/tones
│               ├── settings.tsx        /menu/settings
│               ├── call-divert.tsx     /menu/call-divert
│               ├── games/
│               │   ├── index.tsx       /menu/games
│               │   └── snake.tsx       /menu/games/snake
│               ├── calculator.tsx      /menu/calculator
│               ├── reminders.tsx       /menu/reminders
│               ├── clock.tsx           /menu/clock
│               ├── profiles.tsx        /menu/profiles
│               └── sim-services.tsx    /menu/sim-services
└── tests/
    ├── paths.test.ts
    ├── router-sync.test.ts
    ├── keyboard.test.ts
    └── snake-app.test.ts               (Task 9)
```

`routes/about.tsx` is **deleted** (superseded by the menu routes).

## Contract deviations

Deviations from VISION.md / integration-notes, and interpretations of points they leave open (flag if any is wrong):

1. **Bridge router type is `AnyRouter`**, not `ReturnType<typeof getRouter>` as integration-notes §4 sketches. The typed router rejects runtime-computed strings in `navigate({ to })`; `AnyRouter` (a public `@tanstack/react-router` export) accepts them and lets tests pass a structural fake. Behavior is identical to §4.
2. **A catch-all route `routes/_phone/$.tsx` is added beyond the VISION sitemap table.** The phone has many valid paths with no dedicated route (`menu/phone-book/search` via standby ▲, `menu/call-register/dialled-numbers` via standby ▼, every stub submenu). Phone→URL sync pushes those URLs; without a catch-all they would 404. The catch-all renders the SIM-services-flavoured "not found" panel — which VISION assigns as the 404 experience anyway.
3. **Call-register sublist URLs** (`/menu/call-register/received-calls` etc.) resolve to the catch-all; the parent `/menu/call-register` panel carries all three sections as HTML (VISION's table itself routes the whole menu as `/menu/call-register/…`). Plan 06 may promote them to dedicated routes.
4. **`replace: true` rule:** phone→URL navigations to `/` (standby) use `replace: true` — standby is the "soft" state reached by hold-`C`/power-off and should not pollute history. All other phone-driven navigations push.
5. **The runtime powers the phone on at first load** (`pressKey("power", 1000)`): plan 01 specifies `navigate("standby")` while off leaves the phone **off**, so landing on `/` would otherwise show a dead screen. Deep links still work — `navigate()` during boot retargets the pending path (plan 01 Task 10). Side effect: the machine clock leads wall clock by ~1 s, so boot holds its first frame ~1 s before animating. Accepted.
6. **`@hellotimber/snake` dependency is added in Task 9, not Task 1**, so Tasks 1–8 do not require plan 04 (plans README: snake "plugs in whenever ready"). `ssr.noExternal` lists it from Task 1 — a string matcher, harmless while the package is absent.
7. **Keyboard:** `p` → `power` is a pragmatic desktop affordance (no spec basis). `ArrowUp/Down` → `up`/`down`, `Enter` → `navi`, `Backspace`/`Escape` → `c`, digits/`*`/`#` map to themselves (spec §6 semantics live in phone-core; the website only maps physical keys).
8. **Snake steering:** ▲/▼ map to absolute `up`/`down` inputs (spec §7 marks scroll-key _relative_ turning UNVERIFIED; absolute matches 2/8). On game over, any mapped key starts a **new game with a fresh seed** (plan 04's `reset()` reuses the seed → identical replay; a fresh game is the authentic feel). Non-steering digit keys resume a paused game ("press any key except the navigation or menu keys", spec §7).
9. **`Header.tsx` loses its About link** (the `/about` route is deleted; the typed `<Link to="/about">` would fail typecheck). Header/Footer otherwise stay — plan 06 owns chrome polish.
10. **Renderer version observation** uses rAF-driven local state in `PhoneStageHost` (the `ScreenRenderer` contract has no subscribe API; `setState` with an unchanged value is a React no-op, so idle frames cost nothing).
11. **Sound events are not wired** (`phone.on("sound")` unused) and the write-message editor has no `onAccept` delivery — both are plan 06 scope. `action` events **are** wired (Call divert must work): `window.open(value, "_blank", "noopener,noreferrer")`.

## Conventions for every task

- All paths repo-relative. Integration code lives **only** in `website/src/` (AGENTS.md boundary rule 5).
- Commands (repo root): test `mise exec -- vp run website#test` · build `mise exec -- vp run website#build` · dev `mise exec -- vp run website#dev` (port 3000) · route regen `mise exec -- vp run website#generate-routes` · lint/typecheck `mise exec -- vp check --fix`.
- **Never edit `website/src/routeTree.gen.ts` by hand** — run generate-routes and commit the regenerated file.
- Tests import from `vite-plus/test`, never `vitest`. Website tests live in `website/tests/`.
- Use **relative imports** inside `website/src` (matches the existing code; the `#/*` alias exists but is unused).
- The pre-commit hook runs `vp check --fix`; if it rewrites files, `git add` and commit again.

---

### Task 1: Workspace deps & Vite config

Add the package and three.js dependencies, the dedupe/noExternal config from integration-notes §1, a `test` block for the website, and the one root-config change this plan owns: the lint override for `packages/phone-3d/**`.

**Files**

- Modify: `website/package.json`
- Modify: `website/vite.config.ts`
- Modify: `vite.config.ts` (repo root)

**Steps**

- [ ] **Step 1: Update `website/package.json`** — replace the whole file with (only `dependencies` and `devDependencies` change: 6 new deps, 1 new devDep; `@hellotimber/snake` arrives in Task 9):

  ```json
  {
    "name": "website",
    "private": true,
    "type": "module",
    "imports": {
      "#/*": "./src/*"
    },
    "scripts": {
      "dev": "vp dev --port 3000",
      "generate-routes": "tsr generate",
      "build": "vp build",
      "preview": "vp preview",
      "test": "vp test run"
    },
    "dependencies": {
      "@hellotimber/phone-3d": "workspace:*",
      "@hellotimber/phone-core": "workspace:*",
      "@hellotimber/phone-screen": "workspace:*",
      "@react-three/drei": "catalog:",
      "@react-three/fiber": "catalog:",
      "@tailwindcss/vite": "^4.1.18",
      "@tanstack/react-devtools": "latest",
      "@tanstack/react-router": "latest",
      "@tanstack/react-router-devtools": "latest",
      "@tanstack/react-router-ssr-query": "latest",
      "@tanstack/react-start": "latest",
      "@tanstack/router-plugin": "^1.132.0",
      "lucide-react": "^0.545.0",
      "react": "^19.2.0",
      "react-dom": "^19.2.0",
      "tailwindcss": "^4.1.18",
      "three": "catalog:"
    },
    "devDependencies": {
      "@tailwindcss/typography": "^0.5.16",
      "@tanstack/devtools-vite": "latest",
      "@tanstack/router-cli": "^1.132.0",
      "@testing-library/dom": "^10.4.1",
      "@testing-library/react": "^16.3.0",
      "@types/node": "^22.10.2",
      "@types/react": "^19.2.0",
      "@types/react-dom": "^19.2.0",
      "@types/three": "catalog:",
      "@vitejs/plugin-react": "^6.0.1",
      "jsdom": "^28.1.0",
      "typescript": "^6.0.2",
      "vite": "catalog:",
      "vite-plus": "catalog:",
      "vitest": "catalog:"
    }
  }
  ```

- [ ] **Step 2: Replace `website/vite.config.ts`** with (adds `resolve.dedupe` + `ssr.noExternal` per integration-notes §1, and the `test` block per §6; plugins unchanged):

  ```ts
  import { defineConfig } from "vite-plus";
  import { devtools } from "@tanstack/devtools-vite";

  import { tanstackStart } from "@tanstack/react-start/plugin/vite";

  import viteReact from "@vitejs/plugin-react";
  import tailwindcss from "@tailwindcss/vite";

  const config = defineConfig({
    resolve: {
      tsconfigPaths: true,
      dedupe: ["three", "react", "react-dom", "@react-three/fiber"],
    },
    ssr: {
      // raw .ts exports can't be require()'d by Node at SSR runtime;
      // force-bundle workspace source into the server build
      noExternal: [
        "@hellotimber/phone-core",
        "@hellotimber/phone-screen",
        "@hellotimber/phone-3d",
        "@hellotimber/snake",
      ],
    },
    plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    },
  });

  export default config;
  ```

- [ ] **Step 3: Edit the root `vite.config.ts`** — add the `overrides` entry to the existing `lint` block (integration-notes §1: an override's `plugins` _replaces_ the base list, giving phone-3d the react lint plugin). The `lint` block becomes exactly:

  ```ts
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["packages/phone-3d/**"],
        plugins: ["typescript", "react"],
      },
    ],
  },
  ```

  Nothing else in the root config changes (`staged`, `fmt`, `run` stay as they are).

- [ ] **Step 4: Install:** run `mise exec -- vp install` from the repo root. Expect success; `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three` resolve from the catalog and the three `@hellotimber/*` workspace links appear in `website/node_modules/@hellotimber/`. If install fails because a `packages/*` directory is missing, STOP — plans 01–03 are not done.
- [ ] **Step 5: Gates:** `mise exec -- vp check --fix` then `mise exec -- vp run website#build` — both must pass (no source uses the new deps yet; this proves config + dep resolution).
- [ ] **Step 6: Commit:**

  ```sh
  git add website/package.json website/vite.config.ts vite.config.ts pnpm-lock.yaml
  git commit -m "feat(website): add phone workspace deps, dedupe/ssr config, phone-3d lint override"
  ```

---

### Task 2: URL ⇄ phone path mapping

Pure functions: URL = `/` + phone path (VISION "The menu is the sitemap"). `/` → `standby`; trailing slashes stripped; any URL that is not `/` or shaped like `/menu[/…]` (e.g. a stale `/about` bookmark) maps to `standby`. Deeper validity (does `menu/foo` exist in the tree?) is the phone's job — `phone.navigate()` already falls back to standby for unknown paths.

**Files**

- Create: `website/src/phone/paths.ts`
- Test: `website/tests/paths.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `website/tests/paths.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { phonePathFromUrl, urlFromPhonePath } from "../src/phone/paths";

  describe("phonePathFromUrl", () => {
    it("maps the root URL to standby", () => {
      expect(phonePathFromUrl("/")).toBe("standby");
      expect(phonePathFromUrl("")).toBe("standby");
    });

    it("strips trailing slashes", () => {
      expect(phonePathFromUrl("/menu/")).toBe("menu");
      expect(phonePathFromUrl("/menu/games/snake///")).toBe("menu/games/snake");
    });

    it("maps menu URLs to phone paths", () => {
      expect(phonePathFromUrl("/menu")).toBe("menu");
      expect(phonePathFromUrl("/menu/phone-book")).toBe("menu/phone-book");
      expect(phonePathFromUrl("/menu/messages/inbox")).toBe("menu/messages/inbox");
    });

    it("maps anything outside the scheme to standby", () => {
      expect(phonePathFromUrl("/about")).toBe("standby");
      expect(phonePathFromUrl("/menus")).toBe("standby");
      expect(phonePathFromUrl("/MENU/games")).toBe("standby");
      expect(phonePathFromUrl("/menu//games")).toBe("standby");
      expect(phonePathFromUrl("/menu/Games!")).toBe("standby");
    });
  });

  describe("urlFromPhonePath", () => {
    it("maps standby to the root URL", () => {
      expect(urlFromPhonePath("standby")).toBe("/");
    });

    it("prefixes phone paths with a slash", () => {
      expect(urlFromPhonePath("menu")).toBe("/menu");
      expect(urlFromPhonePath("menu/games/snake")).toBe("/menu/games/snake");
    });

    it("round-trips every sitemap path", () => {
      for (const p of ["standby", "menu", "menu/phone-book", "menu/messages/write"]) {
        expect(phonePathFromUrl(urlFromPhonePath(p))).toBe(p);
      }
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `src/phone/paths.ts`): `mise exec -- vp run website#test`

  This is the first test run in the website package (its vite config carries the TanStack Start plugins). The expected failure is "cannot resolve ../src/phone/paths". If instead the runner itself crashes on a plugin, STOP and report — do not work around it by moving tests to a package.

- [ ] **Step 3: Write `website/src/phone/paths.ts`:**

  ```ts
  /**
   * URL ⇄ phone path mapping (VISION: URL = '/' + phone path).
   * Shape-level only — tree-level validity is phone-core's job
   * (phone.navigate() falls back to 'standby' for unknown paths).
   */

  /** 'menu' optionally followed by kebab-case id segments. */
  const PHONE_PATH_RE = /^menu(?:\/[a-z0-9-]+)*$/;

  /** Browser pathname → phone path. '/' → 'standby'; unknown shapes → 'standby'. */
  export function phonePathFromUrl(pathname: string): string {
    const trimmed = pathname.replace(/\/+$/, "");
    if (trimmed === "" || trimmed === "/") return "standby";
    const path = trimmed.replace(/^\/+/, "");
    return PHONE_PATH_RE.test(path) ? path : "standby";
  }

  /** Phone path → browser pathname. 'standby' → '/'. */
  export function urlFromPhonePath(path: string): string {
    return path === "standby" ? "/" : `/${path}`;
  }
  ```

- [ ] **Step 4: Run & expect PASS:** `mise exec -- vp run website#test`
- [ ] **Step 5: Commit:**

  ```sh
  git add website/src/phone/paths.ts website/tests/paths.test.ts
  git commit -m "feat(website): URL-to-phone path mapping"
  ```

---

### Task 3: Content module & phone runtime singleton

One content module typed by phone-core's `Nokia3310Content` feeds **both** the phone menu and (later tasks) the HTML panels — phone and page can never drift apart. `getPhoneRuntime()` lazily builds the phone + screen renderer **once per browser session**, never during SSR.

**Files**

- Create: `website/src/content/index.ts`
- Create: `website/src/phone/phone.ts`

**Steps**

- [ ] **Step 1: Write `website/src/content/index.ts`:**

  ```ts
  import type { Nokia3310Content } from "@hellotimber/phone-core";

  // ───────────────────────────────────────────────────────────────────────────
  // SAMPLE DATA — replace with real copy (plan 06). The STRUCTURE is real and
  // shared: nokia3310Menu(content) builds the phone menus from this object, and
  // the route ContentPanels render the same entries as HTML.
  // ───────────────────────────────────────────────────────────────────────────
  export const content: Nokia3310Content = {
    phonebook: [
      { id: "email", label: "Email", body: "lachlan@example.com — say hello." }, // SAMPLE DATA
      { id: "github", label: "GitHub", body: "github.com/lachlan-example" }, // SAMPLE DATA
      { id: "linkedin", label: "LinkedIn", body: "linkedin.com/in/lachlan-example" }, // SAMPLE DATA
    ],
    inbox: [
      {
        id: "hello",
        label: "Hello!",
        body: "Hi, I'm Lachlan. I build software and, apparently, phones.",
      }, // SAMPLE DATA
      {
        id: "stack",
        label: "What I use",
        body: "TypeScript, React, three.js, and a 84x48 pixel grid.",
      }, // SAMPLE DATA
    ],
    chat: [
      { who: "them", text: "Lachlan shipped the impossible, twice." }, // SAMPLE DATA
      { who: "me", text: "Thanks! The second one was easier." }, // SAMPLE DATA
      { who: "them", text: "Would hire again. 10/10." }, // SAMPLE DATA
    ],
    missedCalls: [
      { id: "startup", label: "That startup", body: "The one that got away (2019)." }, // SAMPLE DATA
    ],
    receivedCalls: [
      { id: "acme", label: "Acme Corp 2022", body: "Senior engineer. Did senior engineering." }, // SAMPLE DATA
      {
        id: "initech",
        label: "Initech 2020",
        body: "Full-stack engineer. Shipped the TPS reports.",
      }, // SAMPLE DATA
    ],
    dialledNumbers: [
      { id: "this-site", label: "This site", body: "A Nokia 3310 that is also a website." }, // SAMPLE DATA
      { id: "project-x", label: "Project X", body: "Shipped 2024. It did the thing." }, // SAMPLE DATA
    ],
    diverts: [
      { id: "github", label: "GitHub", href: "https://github.com/lachlan-example" }, // SAMPLE DATA
      { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/lachlan-example" }, // SAMPLE DATA
    ],
    reminders: [
      { id: "learning", label: "Learning", body: "three.js internals and pixel fonts." }, // SAMPLE DATA
      { id: "building", label: "Building", body: "This phone. You're holding it." }, // SAMPLE DATA
    ],
    clockNote: "Based in Australia (AEST). Generally awake when you are not.", // SAMPLE DATA
  };
  ```

- [ ] **Step 2: Write `website/src/phone/phone.ts`:**

  ```ts
  import { createPhone, editorApp, nokia3310Menu } from "@hellotimber/phone-core";
  import type { AppFactory, Phone } from "@hellotimber/phone-core";
  import { createScreenRenderer } from "@hellotimber/phone-screen";
  import type { ScreenRenderer } from "@hellotimber/phone-screen";
  import { content } from "../content";

  export interface PhoneRuntime {
    phone: Phone;
    renderer: ScreenRenderer;
  }

  let runtime: PhoneRuntime | null = null;

  function buildApps(): Record<string, AppFactory> {
    return {
      // Plan 01 deviation note 2: the multi-tap editor is hosted as an app.
      // onAccept delivery (real contact form) is plan 06 scope.
      "write-message": editorApp({ title: "Message:" }),
      // "snake" is registered in Task 9 (requires plan 04).
    };
  }

  /**
   * The one phone instance for the whole browser session. Client-only:
   * SSR must never construct it (guard every call site with typeof window).
   */
  export function getPhoneRuntime(): PhoneRuntime {
    if (typeof window === "undefined") {
      throw new Error("getPhoneRuntime() is client-only; guard the call site with typeof window");
    }
    if (runtime !== null) return runtime;

    const phone = createPhone({
      menu: nokia3310Menu(content),
      apps: buildApps(),
      carrier: "LACHLAN",
      clock: () => new Date().toTimeString().slice(0, 5), // 24h HH:MM
    });

    // 84×48 native canvas; NearestFilter upscaling happens on the 3D mesh.
    const renderer = createScreenRenderer();
    renderer.render(phone.screen);
    phone.subscribe((snap) => renderer.render(snap.screen));

    // Call divert action nodes are literal redirects (VISION Menu 7).
    phone.on("action", (action) => {
      window.open(action.value, "_blank", "noopener,noreferrer");
    });

    // The machine's only clock: rAF-driven tick (boot animation, long presses,
    // multi-tap timeouts, app ticks all derive from this).
    const loop = (now: number) => {
      phone.tick(now);
      requestAnimationFrame(loop);
    };

    // Power on at first visit. navigate("standby") while off leaves the phone
    // off (plan 01), so standby landings need an explicit power-on; deep links
    // retarget the boot (navigate-while-booting). pressKey advances the machine
    // clock ~1s past performance.now(), so boot holds frame 0 for ~1s — accepted.
    phone.tick(performance.now());
    phone.pressKey("power", 1000);
    requestAnimationFrame(loop);

    runtime = { phone, renderer };
    return runtime;
  }
  ```

- [ ] **Step 3: Gates:** `mise exec -- vp check --fix` and `mise exec -- vp run website#build` — both must pass (the module is not imported anywhere yet; this proves it compiles against the real package contracts). If `editorApp`, `nokia3310Menu`, or `createScreenRenderer` do not exist with these signatures, STOP and report (plans 01/02 contract drift).
- [ ] **Step 4: Commit:**

  ```sh
  git add website/src/content/index.ts website/src/phone/phone.ts
  git commit -m "feat(website): content module and client-only phone runtime singleton"
  ```

---

### Task 4: Router ⇄ phone bridge

The integration-notes §4 pattern adapted to the real contracts: `onResolved` for URL→phone, `pathchange` for phone→URL, two loop-breakers (idempotence guards + synchronous echo flag), explicit initial alignment (URL wins), `replace: true` for the soft standby state. Tested against the **real** phone-core machine and a minimal fake router. Note: until Tasks 6–7 add the routes, phone-driven navigation to `/menu/...` hits the router's default not-found — expected mid-plan state.

**Files**

- Create: `website/src/phone/router-sync.ts`
- Modify: `website/src/router.tsx`
- Test: `website/tests/router-sync.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `website/tests/router-sync.test.ts`:

  ```ts
  import { createPhone } from "@hellotimber/phone-core";
  import type { MenuNode, Phone } from "@hellotimber/phone-core";
  import type { AnyRouter } from "@tanstack/react-router";
  import { describe, expect, it } from "vite-plus/test";
  import { connectPhoneToRouter } from "../src/phone/router-sync";

  // ── minimal fake router: subscribe/navigate/state, navigations recorded ──
  interface ResolvedEvent {
    toLocation: { pathname: string };
    pathChanged: boolean;
  }

  function fakeRouter(initialPathname: string) {
    const listeners = new Set<(e: ResolvedEvent) => void>();
    const fake = {
      state: { location: { pathname: initialPathname } },
      navigations: [] as { to: string; replace?: boolean }[],
      subscribe(_ev: "onResolved", cb: (e: ResolvedEvent) => void): () => void {
        listeners.add(cb);
        return () => {
          listeners.delete(cb);
        };
      },
      navigate(opts: { to: string; replace?: boolean }): Promise<void> {
        fake.navigations.push(opts);
        fake.settle(opts.to); // a real router resolves then fires onResolved
        return Promise.resolve();
      },
      /** Simulate a settled navigation (also used for back/forward). */
      settle(pathname: string): void {
        const changed = fake.state.location.pathname !== pathname;
        fake.state.location = { pathname };
        for (const cb of [...listeners]) cb({ toLocation: { pathname }, pathChanged: changed });
      },
    };
    return fake;
  }

  const menu: MenuNode[] = [
    { type: "reader", id: "chat", label: "Chat", body: "> hi" },
    {
      type: "submenu",
      id: "games",
      label: "Games",
      children: [{ type: "reader", id: "snake", label: "Snake II", body: "stub" }],
    },
  ];

  function bootedPhone(): Phone {
    const phone = createPhone({ menu, bootMs: 0 });
    phone.tick(0);
    phone.pressKey("power", 1000);
    return phone;
  }

  function connect(router: ReturnType<typeof fakeRouter>, phone: Phone): () => void {
    return connectPhoneToRouter(router as unknown as AnyRouter, phone);
  }

  describe("connectPhoneToRouter", () => {
    it("aligns the phone to the URL on connect (deep link, even from off)", () => {
      const router = fakeRouter("/menu/games/snake");
      const phone = createPhone({ menu, bootMs: 0 }); // off — navigate boots it
      connect(router, phone);
      expect(phone.path).toBe("menu/games/snake");
      expect(router.navigations).toEqual([]); // alignment never touches the URL
    });

    it("URL → phone: a settled navigation drives the phone", () => {
      const router = fakeRouter("/");
      const phone = bootedPhone();
      connect(router, phone);
      router.settle("/menu/chat");
      expect(phone.path).toBe("menu/chat");
    });

    it("URL → phone echo is suppressed: no router.navigate bounce", () => {
      const router = fakeRouter("/");
      const phone = bootedPhone();
      connect(router, phone);
      router.settle("/menu/games");
      expect(phone.path).toBe("menu/games");
      expect(router.navigations).toEqual([]); // pathchange happened under the echo flag
    });

    it("phone → URL: keypad navigation pushes exactly one URL (no loop)", () => {
      const router = fakeRouter("/");
      const phone = bootedPhone();
      connect(router, phone);
      phone.pressKey("navi"); // standby → menu carousel
      expect(phone.path).toBe("menu");
      expect(router.navigations).toEqual([{ to: "/menu", replace: false }]);
      // the fake settled the URL, the bridge saw it, the idempotence guard stopped it
    });

    it("phone → URL: returning to standby replaces history", () => {
      const router = fakeRouter("/menu/chat");
      const phone = bootedPhone();
      connect(router, phone);
      phone.navigate("standby"); // e.g. hold-C
      expect(router.navigations).toEqual([{ to: "/", replace: true }]);
    });

    it("unknown URLs settle the phone on standby without navigating the router", () => {
      const router = fakeRouter("/");
      const phone = bootedPhone();
      connect(router, phone);
      phone.pressKey("navi");
      router.navigations.length = 0;
      router.settle("/some/unknown/page");
      expect(phone.path).toBe("standby"); // phonePathFromUrl shape fallback
      expect(router.navigations).toEqual([]); // echo flag swallows the pathchange
    });

    it("disconnect stops both directions", () => {
      const router = fakeRouter("/");
      const phone = bootedPhone();
      const disconnect = connect(router, phone);
      disconnect();
      router.settle("/menu/chat");
      expect(phone.path).toBe("standby");
      phone.pressKey("navi");
      expect(router.navigations).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `src/phone/router-sync.ts`): `mise exec -- vp run website#test`
- [ ] **Step 3: Write `website/src/phone/router-sync.ts`:**

  ```ts
  import type { Phone } from "@hellotimber/phone-core";
  import type { AnyRouter } from "@tanstack/react-router";
  import { phonePathFromUrl, urlFromPhonePath } from "./paths";

  /**
   * Two-way URL ⇄ phone sync (integration-notes §4). Loop-safety rests on three
   * legs: phone-core's navigate() is a strict no-op (no pathchange) when already
   * at the target; both directions carry an idempotence guard; and a synchronous
   * echo flag swallows the pathchange that a URL-driven navigate() emits.
   * Returns a disconnect function.
   */
  export function connectPhoneToRouter(router: AnyRouter, phone: Phone): () => void {
    let echo = false;

    // URL → phone (the URL is the source of truth)
    const unsubRouter = router.subscribe("onResolved", ({ toLocation, pathChanged }) => {
      if (!pathChanged) return;
      const phonePath = phonePathFromUrl(toLocation.pathname);
      if (phone.path === phonePath) return; // idempotence guard
      echo = true;
      try {
        phone.navigate(phonePath);
      } finally {
        echo = false;
      }
    });

    // phone → URL
    const unsubPhone = phone.on("pathchange", (path) => {
      if (echo) return; // we caused this emit
      const url = urlFromPhonePath(path);
      if (router.state.location.pathname === url) return; // idempotence guard
      // standby is a soft state (hold-C / power-off) — don't pollute history
      void router.navigate({ to: url, replace: url === "/" });
    });

    // Initial alignment: URL wins. Boots the phone on deep links; navigate to
    // 'standby' while off is a no-op (the runtime powers on separately).
    phone.navigate(phonePathFromUrl(router.state.location.pathname));

    return () => {
      unsubRouter();
      unsubPhone();
    };
  }
  ```

- [ ] **Step 4: Wire the bridge in `website/src/router.tsx`** — replace the whole file with (client-only guard: on the server a router is created per request and the phone must not exist there; the module-level `disconnect` keeps HMR re-runs from double-subscribing):

  ```ts
  import { createRouter as createTanStackRouter } from "@tanstack/react-router";
  import { getPhoneRuntime } from "./phone/phone";
  import { connectPhoneToRouter } from "./phone/router-sync";
  import { routeTree } from "./routeTree.gen";

  let disconnect: (() => void) | null = null;

  export function getRouter() {
    const router = createTanStackRouter({
      routeTree,
      scrollRestoration: true,
      defaultPreload: "intent",
      defaultPreloadStaleTime: 0,
    });

    if (typeof window !== "undefined") {
      const { phone } = getPhoneRuntime();
      disconnect?.();
      disconnect = connectPhoneToRouter(router, phone);
    }

    return router;
  }

  declare module "@tanstack/react-router" {
    interface Register {
      router: ReturnType<typeof getRouter>;
    }
  }
  ```

- [ ] **Step 5: Run & expect PASS:** `mise exec -- vp run website#test`
- [ ] **Step 6: Gates:** `mise exec -- vp check --fix` and `mise exec -- vp run website#build` — both must pass (the SSR build must not execute `getPhoneRuntime()`; if the build or a server render throws the client-only error, the guard in `getRouter()` is wrong — fix before proceeding).
- [ ] **Step 7: Commit:**

  ```sh
  git add website/src/phone/router-sync.ts website/src/router.tsx website/tests/router-sync.test.ts
  git commit -m "feat(website): router-phone bridge with echo suppression"
  ```

---

### Task 5: Pathless layout & persistent 3D stage

The canvas mounts once in `routes/_phone.tsx` (pathless layout, integration-notes §3): `<ClientOnly>` + `lazy()` keep three.js out of SSR and the initial chunk; only the `<Outlet/>` subtree swaps on navigation. **The WebGL canvas must NEVER remount on navigation.** `PhoneStageHost` adapts the runtime to `<PhoneStage>` props; renderer-version observation is **rAF-driven local state** (chosen over `useSyncExternalStore` because the `ScreenRenderer` contract has no subscribe API; an unchanged `setState` is a React no-op).

**Files**

- Create: `website/src/phone/PhoneStageHost.tsx`
- Create: `website/src/routes/_phone.tsx`
- Move + edit: `website/src/routes/index.tsx` → `website/src/routes/_phone/index.tsx`
- Delete: `website/src/routes/about.tsx`
- Modify: `website/src/components/Header.tsx`
- Modify: `website/src/routes/__root.tsx`
- Modify: `website/src/styles.css`
- Regenerated: `website/src/routeTree.gen.ts`

**Steps**

- [ ] **Step 1: Write `website/src/phone/PhoneStageHost.tsx`:**

  ```tsx
  import { PhoneStage } from "@hellotimber/phone-3d";
  import { useEffect, useState } from "react";
  import { getPhoneRuntime } from "./phone";

  /**
   * Bridges the phone runtime to the 3D stage. Client-only (lives under
   * <ClientOnly> in routes/_phone.tsx) and mounted ONCE for the whole session.
   */
  export default function PhoneStageHost() {
    const { phone, renderer } = getPhoneRuntime();
    const [version, setVersion] = useState(renderer.version);

    // rAF-driven version observation: re-render only when the LCD actually
    // changed (setState with the same value is a React bail-out).
    useEffect(() => {
      let raf = requestAnimationFrame(function loop() {
        setVersion(renderer.version);
        raf = requestAnimationFrame(loop);
      });
      return () => {
        cancelAnimationFrame(raf);
      };
    }, [renderer]);

    return (
      <PhoneStage
        className="phone-stage"
        screenCanvas={renderer.canvas}
        screenVersion={version}
        backlightOn
        onKey={(key, action) => {
          phone.send({ type: action, key });
        }}
      />
    );
  }
  ```

  (`Nokia3310Key` and `PhoneKey` are identical literal unions by contract, so the `onKey` callback assigns cleanly. If TypeScript rejects it, the packages drifted — STOP and report.)

- [ ] **Step 2: Write `website/src/routes/_phone.tsx`** (integration-notes §3 verbatim pattern, stage wrapper filled in):

  ```tsx
  import { ClientOnly, createFileRoute, Outlet } from "@tanstack/react-router";
  import { lazy, Suspense } from "react";

  const PhoneStageHost = lazy(() => import("../phone/PhoneStageHost"));

  export const Route = createFileRoute("/_phone")({ component: PhoneLayout });

  function PhoneLayout() {
    return (
      <main className="page-wrap grid gap-8 px-4 py-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        {/* Persists across /, /menu, … — never remounts. Do NOT key this by
            pathname and never move the stage into a leaf route. */}
        <ClientOnly fallback={<div className="phone-skeleton" aria-hidden="true" />}>
          <Suspense fallback={<div className="phone-skeleton" aria-hidden="true" />}>
            <PhoneStageHost />
          </Suspense>
        </ClientOnly>
        <Outlet /> {/* only this subtree swaps on navigation */}
      </main>
    );
  }
  ```

  Desktop: stage left, content panel right (3fr/2fr grid). Mobile: one column, canvas first, panel below. Minimal styling — plan 06 polishes.

- [ ] **Step 3: Move the index route under the layout:** `git mv website/src/routes/index.tsx website/src/routes/_phone/index.tsx`, then change its route id line — the file keeps its template content for now (Task 6 rewrites it):

  ```tsx
  export const Route = createFileRoute("/_phone/")({ component: App });
  ```

  (Only the string changes: `"/"` → `"/_phone/"`. Leave the rest of the file as-is.)

- [ ] **Step 4: Delete the about route:** `git rm website/src/routes/about.tsx` (superseded by the menu routes).
- [ ] **Step 5: Edit `website/src/components/Header.tsx`** — the typed `<Link to="/about">` no longer compiles. Delete exactly this block from the nav:

  ```tsx
  <Link to="/about" className="nav-link" activeProps={{ className: "nav-link is-active" }}>
    About
  </Link>
  ```

  Leave everything else (Home link, Docs link, icons, ThemeToggle) untouched.

- [ ] **Step 6: Edit `website/src/routes/__root.tsx`** — update the document title. Replace:

  ```tsx
  {
    title: "TanStack Start Starter",
  },
  ```

  with:

  ```tsx
  {
    title: "Lachlan Heywood",
  },
  ```

- [ ] **Step 7: Append the stage styles** to the end of `website/src/styles.css`:

  ```css
  /* --- Nokia 3310 stage (plan 05) ------------------------------------- */

  .phone-stage,
  .phone-skeleton {
    width: 100%;
    height: min(70vh, 640px);
  }

  .phone-skeleton {
    border-radius: 1.5rem;
    border: 1px solid var(--line);
    background: var(--surface);
  }
  ```

- [ ] **Step 8: Regenerate the route tree:** `mise exec -- vp run website#generate-routes`. Expect `website/src/routeTree.gen.ts` to now contain the `/_phone` layout route and the `/_phone/` index route, and no `/about`. Never edit the generated file by hand.
- [ ] **Step 9: Gates:** `mise exec -- vp run website#test`, `mise exec -- vp check --fix`, `mise exec -- vp run website#build` — all must pass.
- [ ] **Step 10: Visual verification:** run `mise exec -- vp run website#dev` and open http://localhost:3000/ in a browser:
  - The 3D phone renders (skeleton first, then the canvas hydrates in).
  - The boot sequence plays on the phone's LCD (~1 s hold on the first frame, then hands animation → standby with `LACHLAN` and the clock).
  - Clicking the phone's 3D keys works: NaviKey opens the menu carousel on the LCD and the browser URL changes to `/menu`. The router shows its default not-found for now (routes arrive in Tasks 6–7) — and because an unmatched URL falls outside the `_phone` layout, the canvas may unmount on that interim screen. That is expected ONLY until Task 6 adds the catch-all route; the canvas-persistence guarantee is verified in Task 7.
  - Pressing the browser Back button returns the LCD to standby.
- [ ] **Step 11: Commit:**

  ```sh
  git add -A website/src
  git commit -m "feat(website): persistent client-only 3D phone stage in pathless layout"
  ```

---

### Task 6: ContentPanel & sitemap routes, part 1

The accessible HTML panel component, then the first batch of routes: standby (`/`), the catch-all 404, Phone book, the Messages tree, and Chat. Every panel renders **from the same content module the phone menu uses** — phone and page cannot drift. (The `/menu` index route lands in Task 7: its typed `<Link>`s reference routes that must exist first.)

**Files**

- Create: `website/src/components/ContentPanel.tsx`
- Rewrite: `website/src/routes/_phone/index.tsx`
- Create: `website/src/routes/_phone/$.tsx`
- Create: `website/src/routes/_phone/menu/phone-book.tsx`
- Create: `website/src/routes/_phone/menu/messages/index.tsx`
- Create: `website/src/routes/_phone/menu/messages/inbox.tsx`
- Create: `website/src/routes/_phone/menu/messages/write.tsx`
- Create: `website/src/routes/_phone/menu/chat.tsx`
- Regenerated: `website/src/routeTree.gen.ts`

**Steps**

- [ ] **Step 1: Write `website/src/components/ContentPanel.tsx`:**

  ```tsx
  import type { ReactNode } from "react";

  interface ContentPanelProps {
    title: string;
    children: ReactNode;
  }

  /**
   * The HTML twin of the current phone screen: server-rendered, crawlable,
   * readable without WebGL. Sits beside the canvas on desktop, below it on
   * mobile (the _phone layout grid handles placement).
   */
  export default function ContentPanel({ title, children }: ContentPanelProps) {
    return (
      <article
        aria-labelledby="content-panel-title"
        className="island-shell rounded-2xl p-6 sm:p-8"
      >
        <h1
          id="content-panel-title"
          className="display-title mb-4 text-3xl font-bold text-[var(--sea-ink)]"
        >
          {title}
        </h1>
        <div className="prose prose-sm max-w-none text-[var(--sea-ink-soft)]">{children}</div>
      </article>
    );
  }
  ```

- [ ] **Step 2: Rewrite `website/src/routes/_phone/index.tsx`** (standby — replaces the moved template content entirely):

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../components/ContentPanel";

  export const Route = createFileRoute("/_phone/")({ component: StandbyPanel });

  function StandbyPanel() {
    return (
      <ContentPanel title="Lachlan Heywood">
        {/* SAMPLE DATA — replace with real copy (plan 06) */}
        <p>
          Software engineer. This portfolio is a working Nokia 3310: every menu on the phone is a
          page on this site, and every page is a menu on the phone.
        </p>
        <p>
          Drive it with your mouse on the 3D keypad, or with your keyboard: arrow keys scroll, Enter
          is the NaviKey, Backspace goes back. Press Enter to open the menu.
        </p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 3: Write `website/src/routes/_phone/$.tsx`** — the catch-all. It keeps every phone-pushed URL (e.g. `menu/phone-book/search` from standby ▲) inside the layout so the canvas survives, and doubles as the site's 404 in SIM-services costume (VISION Menu 13):

  ```tsx
  import { createFileRoute, Link } from "@tanstack/react-router";
  import ContentPanel from "../../components/ContentPanel";

  export const Route = createFileRoute("/_phone/$")({ component: NotFoundPanel });

  function NotFoundPanel() {
    return (
      <ContentPanel title="SIM services">
        <p>Page not found. This phone accepts no SIM cards from strangers.</p>
        <p>
          If the phone screen shows something here, it is a phone-only screen with no page of its
          own — keep browsing on the handset, or go back <Link to="/">to standby</Link>.
        </p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 4: Write `website/src/routes/_phone/menu/phone-book.tsx`** (representative list-panel route — the pattern for every content-backed route):

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { content } from "../../../content";

  export const Route = createFileRoute("/_phone/menu/phone-book")({ component: PhoneBookPanel });

  function PhoneBookPanel() {
    return (
      <ContentPanel title="Phone book">
        <p>Contact details — the same entries the phone shows under Search.</p>
        <ul>
          {content.phonebook.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.label}</strong> — {entry.body}
            </li>
          ))}
        </ul>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 5: Write `website/src/routes/_phone/menu/messages/index.tsx`** (representative submenu route — typed links to its children, which are created in this same task):

  ```tsx
  import { createFileRoute, Link } from "@tanstack/react-router";
  import ContentPanel from "../../../../components/ContentPanel";

  export const Route = createFileRoute("/_phone/menu/messages/")({ component: MessagesPanel });

  function MessagesPanel() {
    return (
      <ContentPanel title="Messages">
        <p>About me, delivered as SMS.</p>
        <ul>
          <li>
            <Link to="/menu/messages/inbox">Inbox</Link> — short intros about me.
          </li>
          <li>
            <Link to="/menu/messages/write">Write messages</Link> — send me one.
          </li>
        </ul>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 6: Write `website/src/routes/_phone/menu/messages/inbox.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../../components/ContentPanel";
  import { content } from "../../../../content";

  export const Route = createFileRoute("/_phone/menu/messages/inbox")({ component: InboxPanel });

  function InboxPanel() {
    return (
      <ContentPanel title="Inbox">
        <ul>
          {content.inbox.map((msg) => (
            <li key={msg.id}>
              <strong>{msg.label}</strong> — {msg.body}
            </li>
          ))}
        </ul>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 7: Write `website/src/routes/_phone/menu/messages/write.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../../components/ContentPanel";

  export const Route = createFileRoute("/_phone/menu/messages/write")({ component: WritePanel });

  function WritePanel() {
    return (
      <ContentPanel title="Write messages">
        {/* SAMPLE DATA — plan 06 wires the multi-tap editor to real delivery */}
        <p>
          On the phone this opens a multi-tap SMS editor — type a message the way it was meant to be
          typed: one key, many presses.
        </p>
        <p>
          Prefer the easy way? <a href="mailto:lachlan@example.com">Email me</a>.
        </p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 8: Write `website/src/routes/_phone/menu/chat.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { content } from "../../../content";

  export const Route = createFileRoute("/_phone/menu/chat")({ component: ChatPanel });

  function ChatPanel() {
    return (
      <ContentPanel title="Chat">
        <p>Testimonials, rendered as a 3310 chat session.</p>
        <ul>
          {content.chat.map((line, i) => (
            <li key={i}>
              <strong>{line.who === "them" ? ">" : "<"}</strong> {line.text}
            </li>
          ))}
        </ul>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 9: Regenerate & gate:** `mise exec -- vp run website#generate-routes`, then `mise exec -- vp check --fix` and `mise exec -- vp run website#build` — all must pass.
- [ ] **Step 10: Commit:**

  ```sh
  git add website/src/components/ContentPanel.tsx website/src/routes website/src/routeTree.gen.ts
  git commit -m "feat(website): content panel, standby/404/phone-book/messages/chat routes"
  ```

---

### Task 7: Sitemap routes, part 2 — every remaining menu

The rest of the VISION sitemap table, finishing with `/menu` (its typed links need every target to exist). After this task the route set is complete and the canvas-persistence guarantee is verified.

**Files**

- Create: `website/src/routes/_phone/menu/call-register.tsx`
- Create: `website/src/routes/_phone/menu/tones.tsx`
- Create: `website/src/routes/_phone/menu/settings.tsx`
- Create: `website/src/routes/_phone/menu/call-divert.tsx`
- Create: `website/src/routes/_phone/menu/games/index.tsx`
- Create: `website/src/routes/_phone/menu/games/snake.tsx`
- Create: `website/src/routes/_phone/menu/calculator.tsx`
- Create: `website/src/routes/_phone/menu/reminders.tsx`
- Create: `website/src/routes/_phone/menu/clock.tsx`
- Create: `website/src/routes/_phone/menu/profiles.tsx`
- Create: `website/src/routes/_phone/menu/sim-services.tsx`
- Create: `website/src/routes/_phone/menu/index.tsx`
- Regenerated: `website/src/routeTree.gen.ts`

**Steps**

- [ ] **Step 1: Write `website/src/routes/_phone/menu/call-register.tsx`** (work history — all three registers on one panel; the phone's sublist URLs fall to the catch-all, see Contract deviations 3):

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { content } from "../../../content";

  export const Route = createFileRoute("/_phone/menu/call-register")({
    component: CallRegisterPanel,
  });

  function CallRegisterPanel() {
    const sections = [
      ["Received calls — roles held", content.receivedCalls],
      ["Dialled numbers — projects shipped", content.dialledNumbers],
      ["Missed calls — ones that got away", content.missedCalls],
    ] as const;
    return (
      <ContentPanel title="Call register">
        {sections.map(([heading, items]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <strong>{item.label}</strong> — {item.body}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 2: Write `website/src/routes/_phone/menu/tones.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";

  export const Route = createFileRoute("/_phone/menu/tones")({ component: TonesPanel });

  function TonesPanel() {
    return (
      <ContentPanel title="Tones">
        <p>
          Ringtone picker and sound settings — monophonic, as nature intended. WebAudio playback
          arrives with plan 06.
        </p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 3: Write `website/src/routes/_phone/menu/settings.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";

  export const Route = createFileRoute("/_phone/menu/settings")({ component: SettingsPanel });

  function SettingsPanel() {
    return (
      <ContentPanel title="Settings">
        <p>
          Site settings dressed as phone settings: keypad tones, backlight, welcome note. The
          working toggles arrive with plan 06.
        </p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 4: Write `website/src/routes/_phone/menu/call-divert.tsx`** (external links from the same divert entries the phone's action nodes use):

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { content } from "../../../content";

  export const Route = createFileRoute("/_phone/menu/call-divert")({ component: CallDivertPanel });

  function CallDivertPanel() {
    return (
      <ContentPanel title="Call divert">
        <p>Divert this visit to one of my profiles elsewhere:</p>
        <ul>
          {content.diverts.map((d) => (
            <li key={d.id}>
              <a href={d.href} target="_blank" rel="noopener noreferrer">
                {d.label}
              </a>
            </li>
          ))}
        </ul>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 5: Write `website/src/routes/_phone/menu/games/index.tsx`:**

  ```tsx
  import { createFileRoute, Link } from "@tanstack/react-router";
  import ContentPanel from "../../../../components/ContentPanel";

  export const Route = createFileRoute("/_phone/menu/games/")({ component: GamesPanel });

  function GamesPanel() {
    return (
      <ContentPanel title="Games">
        <ul>
          <li>
            <Link to="/menu/games/snake">Snake II</Link> — playable, top score persisted.
          </li>
          <li>Space Impact — listed, not playable (stretch).</li>
          <li>Bantumi — listed, not playable (stretch).</li>
          <li>Pairs II — listed, not playable (stretch).</li>
        </ul>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 6: Write `website/src/routes/_phone/menu/games/snake.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../../components/ContentPanel";

  export const Route = createFileRoute("/_phone/menu/games/snake")({ component: SnakePanel });

  function SnakePanel() {
    return (
      <ContentPanel title="Snake II">
        <p>The real thing: wraparound edges, the bonus bug, one life.</p>
        <ul>
          <li>Steer: 2 / 4 / 6 / 8 on the keypad, or the arrow keys.</li>
          <li>Pause and leave: Backspace (the C key). Come back to continue.</li>
          <li>Your top score is saved in this browser.</li>
        </ul>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 7: Write `website/src/routes/_phone/menu/calculator.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";

  export const Route = createFileRoute("/_phone/menu/calculator")({ component: CalculatorPanel });

  function CalculatorPanel() {
    return (
      <ContentPanel title="Calculator">
        <p>
          The 3310 calculator: press * once for +, twice for −, three times for ×, four for ÷; # is
          the decimal point. Limited accuracy, as the manual proudly disclaims.
        </p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 8: Write `website/src/routes/_phone/menu/reminders.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { content } from "../../../content";

  export const Route = createFileRoute("/_phone/menu/reminders")({ component: RemindersPanel });

  function RemindersPanel() {
    return (
      <ContentPanel title="Reminders">
        <p>What I'm doing now:</p>
        <ul>
          {content.reminders.map((r) => (
            <li key={r.id}>
              <strong>{r.label}</strong> — {r.body}
            </li>
          ))}
        </ul>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 9: Write `website/src/routes/_phone/menu/clock.tsx`** (static copy only — no `new Date()` in render, it would mismatch on hydration):

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";
  import { content } from "../../../content";

  export const Route = createFileRoute("/_phone/menu/clock")({ component: ClockPanel });

  function ClockPanel() {
    return (
      <ContentPanel title="Clock">
        <p>{content.clockNote}</p>
        <p>The phone's standby clock shows your local time, just like a real SIM would not.</p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 10: Write `website/src/routes/_phone/menu/profiles.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";

  export const Route = createFileRoute("/_phone/menu/profiles")({ component: ProfilesPanel });

  function ProfilesPanel() {
    return (
      <ContentPanel title="Profiles">
        <p>
          General, Silent, Discreet, Loud — and one (empty) slot. Visitor modes that re-weight the
          content are a stretch goal; for now every visitor gets General.
        </p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 11: Write `website/src/routes/_phone/menu/sim-services.tsx`:**

  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";

  export const Route = createFileRoute("/_phone/menu/sim-services")({
    component: SimServicesPanel,
  });

  function SimServicesPanel() {
    return (
      <ContentPanel title="SIM services">
        <p>Operator-dependent. Your operator is LACHLAN, and LACHLAN provides no SIM services.</p>
        <p>(Lost visitors end up here too — this menu doubles as the 404 page.)</p>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 12: Write `website/src/routes/_phone/menu/index.tsx`** — last, because its typed links require every route above:

  ```tsx
  import { createFileRoute, Link } from "@tanstack/react-router";
  import ContentPanel from "../../../components/ContentPanel";

  export const Route = createFileRoute("/_phone/menu/")({ component: MenuPanel });

  const MENUS = [
    ["/menu/phone-book", "Phone book — contact details"],
    ["/menu/messages", "Messages — about me"],
    ["/menu/chat", "Chat — testimonials"],
    ["/menu/call-register", "Call register — work history"],
    ["/menu/tones", "Tones — sound settings"],
    ["/menu/settings", "Settings"],
    ["/menu/call-divert", "Call divert — my profiles elsewhere"],
    ["/menu/games", "Games — Snake II"],
    ["/menu/calculator", "Calculator"],
    ["/menu/reminders", "Reminders — what I'm doing now"],
    ["/menu/clock", "Clock — time zone & availability"],
    ["/menu/profiles", "Profiles"],
    ["/menu/sim-services", "SIM services"],
  ] as const;

  function MenuPanel() {
    return (
      <ContentPanel title="Menu">
        <p>All 13 menus, in genuine year-2000 order:</p>
        <ol>
          {MENUS.map(([to, label]) => (
            <li key={to}>
              <Link to={to}>{label}</Link>
            </li>
          ))}
        </ol>
      </ContentPanel>
    );
  }
  ```

- [ ] **Step 13: Regenerate & gate:** `mise exec -- vp run website#generate-routes`, then `mise exec -- vp run website#test`, `mise exec -- vp check --fix`, `mise exec -- vp run website#build` — all must pass.
- [ ] **Step 14: Visual verification — the canvas NEVER remounts.** Run `mise exec -- vp run website#dev`, open http://localhost:3000/:
  - In the browser dev-tools console run: `window.__c = document.querySelector("canvas")`.
  - Click the panel link to `/menu` (or use the phone's NaviKey), then to `/menu/games`, then browser-Back twice.
  - Run: `window.__c === document.querySelector("canvas")` — must print `true` after every navigation. If `false`, the stage remounted — STOP and fix (the stage must live only in `_phone.tsx`, unkeyed).
  - Walk the phone with the 3D keys: standby → NaviKey → carousel → select Phone book — URL follows to `/menu/phone-book` and the panel swaps. Deep-load http://localhost:3000/menu/games/snake — the phone boots into the Games area (until Task 9 registers the app, phone-core treats the unregistered `snake` appId as a no-op and may settle on `menu/games`; after Task 9 it boots straight into the game).
  - Load http://localhost:3000/definitely/not/a/page — SIM-services 404 panel, canvas intact.
  - Narrow the window below `lg`: panel stacks below the canvas.
- [ ] **Step 15: Commit:**

  ```sh
  git add website/src/routes website/src/routeTree.gen.ts
  git commit -m "feat(website): complete sitemap routes with content panels"
  ```

---

### Task 8: Keyboard input

Document-level keydown/keyup → phone key events. `preventDefault` **only** for handled keys; events from text inputs are ignored; modifier chords pass through (don't eat Cmd+R). Spec §6 key _semantics_ live in phone-core — the website only maps physical keys.

**Files**

- Create: `website/src/phone/keyboard.ts`
- Modify: `website/src/phone/PhoneStageHost.tsx`
- Test: `website/tests/keyboard.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `website/tests/keyboard.test.ts`:

  ```ts
  // @vitest-environment jsdom
  import type { KeyEvent } from "@hellotimber/phone-core";
  import { describe, expect, it } from "vite-plus/test";
  import { attachKeyboard, phoneKeyForKeyboardKey } from "../src/phone/keyboard";

  describe("phoneKeyForKeyboardKey", () => {
    it("maps the documented keys", () => {
      expect(phoneKeyForKeyboardKey("ArrowUp")).toBe("up");
      expect(phoneKeyForKeyboardKey("ArrowDown")).toBe("down");
      expect(phoneKeyForKeyboardKey("Enter")).toBe("navi");
      expect(phoneKeyForKeyboardKey("Backspace")).toBe("c");
      expect(phoneKeyForKeyboardKey("Escape")).toBe("c");
      expect(phoneKeyForKeyboardKey("p")).toBe("power");
      expect(phoneKeyForKeyboardKey("P")).toBe("power");
      expect(phoneKeyForKeyboardKey("*")).toBe("*");
      expect(phoneKeyForKeyboardKey("#")).toBe("#");
      for (const d of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
        expect(phoneKeyForKeyboardKey(d)).toBe(d);
      }
    });

    it("returns null for everything else", () => {
      for (const k of ["a", "F5", "Tab", " ", "ArrowLeft", "Shift", "Dead"]) {
        expect(phoneKeyForKeyboardKey(k)).toBeNull();
      }
    });
  });

  describe("attachKeyboard", () => {
    function recordingPhone() {
      const sent: KeyEvent[] = [];
      return { sent, phone: { send: (e: KeyEvent) => sent.push(e) } };
    }

    function press(target: EventTarget, type: "keydown" | "keyup", key: string): KeyboardEvent {
      const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    }

    it("sends down/up for handled keys and prevents default", () => {
      const { sent, phone } = recordingPhone();
      const detach = attachKeyboard(phone);
      const down = press(document, "keydown", "Enter");
      const up = press(document, "keyup", "Enter");
      expect(sent).toEqual([
        { type: "down", key: "navi" },
        { type: "up", key: "navi" },
      ]);
      expect(down.defaultPrevented).toBe(true);
      expect(up.defaultPrevented).toBe(true);
      detach();
    });

    it("ignores unhandled keys and leaves their default alone", () => {
      const { sent, phone } = recordingPhone();
      const detach = attachKeyboard(phone);
      const ev = press(document, "keydown", "a");
      expect(sent).toEqual([]);
      expect(ev.defaultPrevented).toBe(false);
      detach();
    });

    it("ignores modifier chords (Cmd/Ctrl/Alt)", () => {
      const { sent, phone } = recordingPhone();
      const detach = attachKeyboard(phone);
      const ev = new KeyboardEvent("keydown", {
        key: "5",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(ev);
      expect(sent).toEqual([]);
      expect(ev.defaultPrevented).toBe(false);
      detach();
    });

    it("ignores keys typed into inputs and textareas", () => {
      const { sent, phone } = recordingPhone();
      const detach = attachKeyboard(phone);
      const input = document.createElement("input");
      const textarea = document.createElement("textarea");
      document.body.append(input, textarea);
      press(input, "keydown", "Enter");
      press(textarea, "keydown", "5");
      expect(sent).toEqual([]);
      input.remove();
      textarea.remove();
      detach();
    });

    it("stops sending after detach", () => {
      const { sent, phone } = recordingPhone();
      const detach = attachKeyboard(phone);
      detach();
      press(document, "keydown", "Enter");
      expect(sent).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `src/phone/keyboard.ts`): `mise exec -- vp run website#test`
- [ ] **Step 3: Write `website/src/phone/keyboard.ts`:**

  ```ts
  import type { KeyEvent, Phone, PhoneKey } from "@hellotimber/phone-core";

  /**
   * Physical keyboard → phone key. Arrow keys scroll, Enter is the NaviKey,
   * Backspace/Escape are the C key, digits/*/# map to themselves, p toggles
   * power. Key SEMANTICS (long-press, multi-tap, shortcuts) live in phone-core.
   */
  export function phoneKeyForKeyboardKey(key: string): PhoneKey | null {
    switch (key) {
      case "ArrowUp":
        return "up";
      case "ArrowDown":
        return "down";
      case "Enter":
        return "navi";
      case "Backspace":
      case "Escape":
        return "c";
      case "p":
      case "P":
        return "power";
      case "*":
      case "#":
        return key;
      default:
        return /^[0-9]$/.test(key) ? (key as PhoneKey) : null;
    }
  }

  function isTextEntryTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
  }

  /**
   * Attach document-level key handling. preventDefault ONLY for handled keys;
   * text inputs and modifier chords pass through untouched. Returns a detach
   * function. The param is structural (just `send`) so tests can pass a stub.
   */
  export function attachKeyboard(
    phone: Pick<Phone, "send">,
    doc: Document = document,
  ): () => void {
    const handle = (type: KeyEvent["type"]) => (e: KeyboardEvent) => {
      if (isTextEntryTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = phoneKeyForKeyboardKey(e.key);
      if (key === null) return;
      e.preventDefault();
      if (type === "down" && e.repeat) return; // OS auto-repeat: hold = one down
      phone.send({ type, key });
    };
    const onKeyDown = handle("down");
    const onKeyUp = handle("up");
    doc.addEventListener("keydown", onKeyDown);
    doc.addEventListener("keyup", onKeyUp);
    return () => {
      doc.removeEventListener("keydown", onKeyDown);
      doc.removeEventListener("keyup", onKeyUp);
    };
  }
  ```

- [ ] **Step 4: Hook it into `website/src/phone/PhoneStageHost.tsx`** — add the import and a second `useEffect` after the version-observation effect:

  ```tsx
  import { attachKeyboard } from "./keyboard";
  ```

  ```tsx
  // Desktop keyboard → phone keys, alive exactly as long as the stage.
  useEffect(() => attachKeyboard(phone), [phone]);
  ```

- [ ] **Step 5: Run & expect PASS:** `mise exec -- vp run website#test`, then `mise exec -- vp check --fix` and `mise exec -- vp run website#build`.
- [ ] **Step 6: Visual verification:** `mise exec -- vp run website#dev`, open http://localhost:3000/:
  - Enter opens the menu (URL → `/menu`), arrows cycle the carousel, Enter selects, Backspace steps back, holding Backspace ≈1 s jumps to standby.
  - `p` held ≈1 s powers the phone off (LCD goes dark); held again powers it back on through boot.
  - Press `/` or `Cmd+L` etc. — browser behavior unaffected. Click into the browser URL bar and type digits — the phone must not react.
- [ ] **Step 7: Commit:**

  ```sh
  git add website/src/phone/keyboard.ts website/src/phone/PhoneStageHost.tsx website/tests/keyboard.test.ts
  git commit -m "feat(website): document-level keyboard input mapped to phone keys"
  ```

---

### Task 9: Snake wiring — **requires plan 04**

**Prerequisite check:** `packages/snake/src/index.ts` must exist and export `createSnake`, `renderSnakeFrame`, `tickIntervalMs`, `MAZE_NAMES` (plan 04 done). If not, SKIP this task (do the rest of the plan) and report.

The adapter implements phone-core's `AppFactory` over `@hellotimber/snake` — the only place the two packages meet (AGENTS.md rule 5). Cadence: accumulate `PhoneApp.tick(dtMs)` deltas against `tickIntervalMs(state.level)`. Keys per spec §7 and plan 04's deviations: 2/4/6/8 (+ ▲/▼ as absolute up/down) steer and `dispatch` starts an idle game / resumes a paused one; other digit keys resume a paused game ("press any key except the navigation or menu keys"); `c` pauses and exits to the menu — the game instance survives, so re-entering is the authentic _Continue_. Top score persists in localStorage.

**Files**

- Modify: `website/package.json`
- Create: `website/src/phone/apps/snake-app.ts`
- Modify: `website/src/phone/phone.ts`
- Test: `website/tests/snake-app.test.ts`

**Steps**

- [ ] **Step 1: Add the dependency** in `website/package.json` — insert into `dependencies` (kept alphabetical):

  ```json
  "@hellotimber/snake": "workspace:*",
  ```

  Then run `mise exec -- vp install`.

- [ ] **Step 2: Write the failing test** `website/tests/snake-app.test.ts`:

  ```ts
  import type { PhoneApp } from "@hellotimber/phone-core";
  import { tickIntervalMs } from "@hellotimber/snake";
  import type { SnakeGame, SnakeInput, SnakeState } from "@hellotimber/snake";
  import { describe, expect, it } from "vite-plus/test";
  import { snakeApp, snakeInputForKey } from "../src/phone/apps/snake-app";
  import type { SnakeTopScoreStore } from "../src/phone/apps/snake-app";

  // ── fake SnakeGame: records calls, lets tests script tick() results ──
  function fakeGame(overrides: Partial<SnakeState> = {}) {
    const state: SnakeState = {
      cols: 21,
      rows: 10,
      snake: [
        { x: 6, y: 5 },
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ],
      dir: "right",
      pendingDir: null,
      food: { x: 10, y: 5 },
      bonus: null,
      foodsEaten: 0,
      score: 0,
      level: 1,
      maze: 0,
      walls: [],
      status: "idle",
      flashOn: true,
      ...overrides,
    };
    const calls = { dispatch: [] as SnakeInput[], tick: 0, pause: 0, resume: 0, reset: 0 };
    let tickResult = true;
    const game: SnakeGame = {
      get state() {
        return state;
      },
      dispatch(input) {
        calls.dispatch.push(input);
        if (state.status === "idle" || state.status === "paused") state.status = "running";
      },
      tick() {
        calls.tick += 1;
        if (!tickResult) state.status = "game-over";
        return tickResult;
      },
      pause() {
        calls.pause += 1;
        state.status = "paused";
      },
      resume() {
        calls.resume += 1;
        state.status = "running";
      },
      reset() {
        calls.reset += 1;
      },
    };
    return { game, calls, state, endGame: () => (tickResult = false) };
  }

  function memoryStore(initial = 0): SnakeTopScoreStore & { value: number } {
    const store = {
      value: initial,
      read: () => store.value,
      write: (s: number) => {
        store.value = s;
      },
    };
    return store;
  }

  function makeApp(fake: ReturnType<typeof fakeGame>, store = memoryStore()) {
    let exited = 0;
    const factory = snakeApp({ createGame: () => fake.game, topScore: store });
    const app: PhoneApp = factory({ exit: () => (exited += 1) });
    return { app, exitCount: () => exited };
  }

  describe("snakeInputForKey", () => {
    it("maps 2/4/6/8 and the scroll keys; others are null", () => {
      expect(snakeInputForKey("2")).toBe("up");
      expect(snakeInputForKey("4")).toBe("left");
      expect(snakeInputForKey("6")).toBe("right");
      expect(snakeInputForKey("8")).toBe("down");
      expect(snakeInputForKey("up")).toBe("up");
      expect(snakeInputForKey("down")).toBe("down");
      expect(snakeInputForKey("5")).toBeNull();
      expect(snakeInputForKey("navi")).toBeNull();
    });
  });

  describe("snakeApp", () => {
    it("dispatches on key down only (down starts the idle game, per plan 04)", () => {
      const fake = fakeGame();
      const { app } = makeApp(fake);
      app.onKey({ type: "down", key: "6" });
      app.onKey({ type: "up", key: "6" });
      expect(fake.calls.dispatch).toEqual(["right"]);
      expect(fake.state.status).toBe("running");
    });

    it("accumulates tick deltas against tickIntervalMs(level)", () => {
      const fake = fakeGame({ status: "running", level: 5 });
      const { app } = makeApp(fake);
      const interval = tickIntervalMs(5); // 325 ms
      app.tick(interval - 1);
      expect(fake.calls.tick).toBe(0);
      app.tick(1);
      expect(fake.calls.tick).toBe(1);
      app.tick(interval * 2);
      expect(fake.calls.tick).toBe(3);
    });

    it("does not advance while idle or paused", () => {
      const fake = fakeGame({ status: "paused", level: 1 });
      const { app } = makeApp(fake);
      app.tick(10_000);
      expect(fake.calls.tick).toBe(0);
    });

    it("c pauses the running game and exits to the menu", () => {
      const fake = fakeGame({ status: "running" });
      const { app, exitCount } = makeApp(fake);
      app.onKey({ type: "down", key: "c" });
      expect(fake.calls.pause).toBe(1);
      expect(exitCount()).toBe(1);
    });

    it("non-steering digits resume a paused game (spec §7: any key starts)", () => {
      const fake = fakeGame({ status: "paused" });
      const { app } = makeApp(fake);
      app.onKey({ type: "down", key: "5" });
      expect(fake.calls.resume).toBe(1);
    });

    it("records a beaten top score exactly once when the game ends", () => {
      const fake = fakeGame({ status: "running", level: 1, score: 12 });
      const store = memoryStore(7);
      const { app } = makeApp(fake, store);
      fake.endGame();
      app.tick(tickIntervalMs(1) * 3);
      expect(store.value).toBe(12);
    });

    it("keeps the higher stored score", () => {
      const fake = fakeGame({ status: "running", level: 1, score: 3 });
      const store = memoryStore(99);
      const { app } = makeApp(fake, store);
      fake.endGame();
      app.tick(tickIntervalMs(1));
      expect(store.value).toBe(99);
    });

    it("renders a custom 84×48 frame with appId snake", () => {
      const fake = fakeGame();
      const { app } = makeApp(fake);
      const screen = app.render();
      if (screen.kind !== "custom") throw new Error(`expected custom, got ${screen.kind}`);
      expect(screen.appId).toBe("snake");
      expect(screen.frame.width).toBe(84);
      expect(screen.frame.height).toBe(48);
      expect(screen.frame.pixels).toHaveLength(84 * 48);
    });

    it("pauses on onExit (navigating away)", () => {
      const fake = fakeGame({ status: "running" });
      const { app } = makeApp(fake);
      app.onExit?.();
      expect(fake.calls.pause).toBe(1);
    });

    it("a steering key after game over starts a fresh game", () => {
      const fake = fakeGame({ status: "running", level: 1 });
      const fresh = fakeGame();
      let creations = 0;
      const factory = snakeApp({
        createGame: () => {
          creations += 1;
          return creations === 1 ? fake.game : fresh.game;
        },
        topScore: memoryStore(),
      });
      const app = factory({ exit: () => undefined });
      fake.endGame();
      app.tick(tickIntervalMs(1)); // → game over
      app.onKey({ type: "down", key: "6" });
      expect(creations).toBe(2); // fresh seed, not reset() (Contract deviations 8)
      expect(fresh.calls.dispatch).toEqual(["right"]);
    });
  });
  ```

- [ ] **Step 3: Run & expect FAIL** (no `src/phone/apps/snake-app.ts`): `mise exec -- vp run website#test`
- [ ] **Step 4: Write `website/src/phone/apps/snake-app.ts`:**

  ```ts
  import type { AppFactory, PhoneApp, PhoneKey, ScreenModel } from "@hellotimber/phone-core";
  import { createSnake, renderSnakeFrame, tickIntervalMs } from "@hellotimber/snake";
  import type { SnakeGame, SnakeInput } from "@hellotimber/snake";

  export const SNAKE_TOPSCORE_KEY = "hellotimber.snake.topscore";

  export interface SnakeTopScoreStore {
    read(): number;
    write(score: number): void;
  }

  function localStorageTopScore(key = SNAKE_TOPSCORE_KEY): SnakeTopScoreStore {
    return {
      read() {
        if (typeof localStorage === "undefined") return 0;
        const n = Number.parseInt(localStorage.getItem(key) ?? "", 10);
        return Number.isFinite(n) && n > 0 ? n : 0;
      },
      write(score) {
        if (typeof localStorage === "undefined") return;
        localStorage.setItem(key, String(score));
      },
    };
  }

  /** Spec §7: 2/4/6/8 steer; ▲/▼ also steer (absolute — see plan deviations). */
  export function snakeInputForKey(key: PhoneKey): SnakeInput | null {
    switch (key) {
      case "2":
      case "up":
        return "up";
      case "8":
      case "down":
        return "down";
      case "4":
        return "left";
      case "6":
        return "right";
      default:
        return null;
    }
  }

  /** "Press any key except the navigation or menu keys" — paused-game starters. */
  const STARTER_KEYS = new Set<PhoneKey>(["0", "1", "3", "5", "7", "9", "*", "#"]);

  export interface SnakeAppOptions {
    /** Level 1–9 (speed AND points per food). Default 5. */
    speed?: number;
    /** Test seam; default creates a real game with a wall-clock seed. */
    createGame?: () => SnakeGame;
    /** Test seam; default persists to localStorage. */
    topScore?: SnakeTopScoreStore;
  }

  /**
   * @hellotimber/snake hosted as a phone-core PhoneApp. The game instance
   * outlives app launches (closure state), so C-to-exit + re-enter is the
   * authentic Games → Continue. Snake's Bitmap is structurally identical to
   * phone-core's (one byte per pixel) — no shared import needed.
   */
  export function snakeApp(options: SnakeAppOptions = {}): AppFactory {
    const speed = options.speed ?? 5;
    const createGame = options.createGame ?? (() => createSnake({ speed, seed: Date.now() >>> 0 }));
    const store = options.topScore ?? localStorageTopScore();
    let game: SnakeGame | null = null;

    return (ctx): PhoneApp => {
      game ??= createGame();
      let acc = 0;
      let scored = game.state.status === "game-over";

      return {
        onKey(e) {
          if (e.type !== "down") return;
          const g = game!;
          if (e.key === "c") {
            if (g.state.status === "running") g.pause();
            ctx.exit();
            return;
          }
          if (g.state.status === "game-over") {
            game = createGame(); // fresh seed — reset() would replay identically
            acc = 0;
            scored = false;
          }
          const input = snakeInputForKey(e.key);
          if (input !== null) {
            game!.dispatch(input); // plan 04: also starts idle / resumes paused
          } else if (STARTER_KEYS.has(e.key) && game!.state.status === "paused") {
            game!.resume();
          }
        },
        tick(dtMs) {
          const g = game!;
          if (g.state.status !== "running" && g.state.status !== "dying") return;
          acc += dtMs;
          const interval = tickIntervalMs(g.state.level);
          while (acc >= interval) {
            acc -= interval;
            if (!g.tick()) {
              if (!scored) {
                scored = true;
                if (g.state.score > store.read()) store.write(g.state.score);
              }
              break;
            }
          }
        },
        render(): ScreenModel {
          return { kind: "custom", appId: "snake", frame: renderSnakeFrame(game!.state) };
        },
        onExit() {
          const g = game!;
          if (g.state.status === "running") g.pause();
        },
      };
    };
  }
  ```

- [ ] **Step 5: Register the app** in `website/src/phone/phone.ts` — add the import and replace `buildApps`:

  ```ts
  import { snakeApp } from "./apps/snake-app";
  ```

  ```ts
  function buildApps(): Record<string, AppFactory> {
    return {
      // Plan 01 deviation note 2: the multi-tap editor is hosted as an app.
      // onAccept delivery (real contact form) is plan 06 scope.
      "write-message": editorApp({ title: "Message:" }),
      snake: snakeApp(),
    };
  }
  ```

- [ ] **Step 6: Run & expect PASS:** `mise exec -- vp run website#test`, then `mise exec -- vp check --fix` and `mise exec -- vp run website#build`.
- [ ] **Step 7: Visual verification:** `mise exec -- vp run website#dev`, open http://localhost:3000/menu/games/snake:
  - The phone boots straight into Snake (idle board). Press an arrow key or 6 — the snake runs; eating food grows it and bumps the score.
  - Backspace pauses and exits to the Games list; re-entering Snake II continues the same game.
  - Die on purpose: the death flash plays, then GAME OVER. In dev tools, `localStorage.getItem("hellotimber.snake.topscore")` holds your score. Press 6 — a fresh game starts.
- [ ] **Step 8: Commit:**

  ```sh
  git add website/package.json pnpm-lock.yaml website/src/phone website/tests/snake-app.test.ts
  git commit -m "feat(website): snake PhoneApp adapter with top-score persistence"
  ```

---

### Task 10: Final verification & plan close-out

**Files**

- Modify: `docs/plans/README.md`

**Steps**

- [ ] **Step 1: SSR sanity — panel content must be server-rendered** (accessibility/SEO is the point of the panels). Start `mise exec -- vp run website#dev`, then from another shell:

  ```sh
  curl -s http://localhost:3000/menu/chat | grep -c "Lachlan shipped the impossible"
  curl -s http://localhost:3000/menu/call-register | grep -c "Acme Corp 2022"
  curl -s http://localhost:3000/ | grep -c "working Nokia 3310"
  ```

  Each must print ≥ 1 — the sample copy is in the raw HTML, not injected client-side. (Equivalently: browser View Source, not the elements inspector.) No output may contain the text of the client-only error from `getPhoneRuntime()`.

- [ ] **Step 2: Canvas-persistence spot check** (repeat of Task 7 Step 14, now with Snake): set `window.__c = document.querySelector("canvas")` on `/`, navigate `/` → `/menu` → `/menu/games/snake` → back → back, confirm `window.__c === document.querySelector("canvas")` is `true` at each stop.
- [ ] **Step 3: Full repo gate:** from the repo root run `mise exec -- vp run ready` (root script: `vp check && vp run -r test && vp run -r build`). Everything must pass. If a _package_ test fails (not website code), STOP and report — do not patch packages from this plan.
- [ ] **Step 4: Update the plan index:** in `docs/plans/README.md`, set the Status cell of row `05` (website shell) to `done`. If Task 9 was skipped because plan 04 wasn't ready, set `done (snake wiring pending plan 04)` instead and report it.
- [ ] **Step 5: Commit:**

  ```sh
  git add docs/plans/README.md
  git commit -m "docs: mark plan 05 website shell done"
  ```

- [ ] **Step 6: Report completion** — summarize: tasks finished, test files added (paths, router-sync, keyboard, snake-app), the verification results from Steps 1–3, and any deviations beyond the "Contract deviations" list at the top of this plan.

**Reminder for plan 06:** every block tagged `// SAMPLE DATA` in `website/src/content/index.ts` and the sample copy inside the route panels is placeholder text — plan 06 (content & polish) replaces it with real portfolio copy, wires sound + the contact-form delivery, and owns SEO/meta and chrome (Header/Footer) polish.
