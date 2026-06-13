# Plan 01 — `@hellotimber/phone-core`

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task. If this plan contradicts VISION.md contracts or the code, STOP and report.

**Goal:** Build `@hellotimber/phone-core` — the Nokia 3310 "firmware" as a pure-TypeScript, zero-dependency, DOM-free state machine implementing the VISION.md public contract verbatim, fully unit-tested.

**Architecture:** A single mutable `Machine` record holds the mode (`off | boot | standby | nav | app`), a navigation stack of frames, held-key timing, and the menu-shortcut window; every public entry point (`send`/`tick`/`navigate`/`pressKey`) runs through one wrapper that detects path changes (emitting `pathchange`) and notifies subscribers. Time enters ONLY through `tick(nowMs)` — the machine never reads `Date.now()` — so every behavior (boot animation, long-press, multi-tap timeout, the 3-second shortcut window) is deterministic in tests. Screens are derived (`renderScreen`) from state on demand; apps (`PhoneApp`) get raw key events and tick deltas and render through the same `ScreenModel` union.

**Tech stack:** TypeScript (workspace `catalog:`), Vite+ (`vp`) for test/lint/typecheck, Vitest via `vite-plus/test` in node environment. **Zero runtime dependencies. No DOM, no timers, no `Date`.**

**Files at completion:**

```
packages/phone-core/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── src/
│   ├── index.ts          public barrel
│   ├── types.ts          VISION.md contract types (verbatim)
│   ├── paths.ts          path parse/resolve/validate utilities
│   ├── machine.ts        createPhone() state machine
│   ├── multitap.ts       pure multi-tap text-entry engine
│   ├── editor.ts         editorApp() — multi-tap editor as a PhoneApp
│   └── nokia-menu.ts     nokia3310Menu(content) default tree builder
└── tests/
    ├── fixtures.ts       shared test menu/config/booted-phone/fake-app helpers
    ├── types.test.ts
    ├── paths.test.ts
    ├── power.test.ts
    ├── carousel.test.ts
    ├── lists.test.ts
    ├── shortcuts.test.ts
    ├── apps.test.ts
    ├── events.test.ts
    ├── navigate.test.ts
    ├── multitap.test.ts
    ├── editor.test.ts
    └── nokia-menu.test.ts
```

## Contract deviations

None — `src/types.ts` reproduces the VISION.md `@hellotimber/phone-core` contract verbatim. The following are **interpretations** of points the contract leaves open (flag if any is wrong):

1. **Bitmap packing:** the contract says "1bpp bitmap, row-major" with a `Uint8Array`. Interpretation: **one byte per pixel**, `pixels.length === width * height`, each byte `0` or `1`. phone-screen and snake must adopt the same convention.
2. **Editor hosting:** `MenuNode` has no `editor` variant, so the multi-tap editor ships as an exported app factory `editorApp(opts): AppFactory`; the menu wires it as `{ type: "app", appId: "write-message" }` and the host registers it via `config.apps`. The `ScreenModel` `editor` variant is produced by that app.
3. **Path while off/booting:** `phone.path` reads `"standby"` whenever the phone is not in the menus (off, booting, standby). The path scheme has no `off`/`boot` value.
4. **List items don't extend the path:** items inside a `type:"list"` node (e.g. one contact card) open as readers but the path stays at the list node — items are not `MenuNode`s, and "deep submenu state with no content value stays phone-internal" (VISION).
5. **Menu shortcuts use digits 1–9 per level** (e.g. `Menu`,`2`,`2` → Inbox). Two-keypress numbers for menus 10–13 (e.g. `Menu`,`1`,`0`) are not supported — accepted simplification of an UNVERIFIED spec detail.
6. **Unregistered `appId`:** selecting an `app` node whose `appId` has no factory in `config.apps` is a no-op (stays on the containing menu).
7. **`confirm` ScreenModel variant** is defined (contract) but not yet produced by any behavior in this plan.
8. **`ctx.exit()`** must be called synchronously from the app's `onKey`/`tick` (the only places apps get control).
9. **Long press threshold is 800 ms** for all keys including power (spec says power ≈1 s; one threshold keeps key feel consistent). Multi-tap commit timeout 1 s, shortcut window 3 s — per spec.
10. **`signal`/`battery` are hardcoded to 4** in the standby screen for now (spec best-guess: 4 segments).

## Conventions for every task

- Package dir: `packages/phone-core`. All paths below are repo-relative.
- Test command (from repo root): `mise exec -- vp run @hellotimber/phone-core#test`. (From inside `packages/phone-core`, `mise exec -- vp test run` is equivalent.)
- Tests import from `vite-plus/test`, **never** `vitest`.
- Before the first task: `mise install` then `mise exec -- vp install` from the repo root (one-time setup, see AGENTS.md).
- The pre-commit hook runs `vp check --fix`; if it rewrites files, `git add` them and commit again.

---

### Task 1: Package scaffold

The repo root already provides the workspace (`pnpm-workspace.yaml` with `packages/*` and a `catalog:` containing `typescript` and `vite-plus`). This is a doc-only repo so far, so write the scaffold files directly instead of running `vp create` (which would fetch a template we'd immediately rewrite — see AGENTS.md "Creating a new package" steps 2–4).

**Files**

- Create: `packages/phone-core/package.json`
- Create: `packages/phone-core/tsconfig.json`
- Create: `packages/phone-core/vite.config.ts`
- Create: `packages/phone-core/src/index.ts`

**Steps**

- [ ] **Step 1: Write `packages/phone-core/package.json`** (exact shape from `docs/specs/integration-notes.md` §1 — source exports, no build script):

  ```json
  {
    "name": "@hellotimber/phone-core",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "exports": {
      ".": "./src/index.ts",
      "./package.json": "./package.json"
    },
    "scripts": {
      "test": "vp test run"
    },
    "devDependencies": {
      "typescript": "catalog:",
      "vite-plus": "catalog:"
    }
  }
  ```

- [ ] **Step 2: Write `packages/phone-core/tsconfig.json`** (template from integration-notes §1, verbatim):

  ```json
  {
    "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx"],
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "jsx": "react-jsx",
      "lib": ["ES2022", "DOM"],
      "strict": true,
      "verbatimModuleSyntax": true,
      "noEmit": true,
      "skipLibCheck": true,
      "types": ["vite-plus/client"]
    }
  }
  ```

- [ ] **Step 3: Write `packages/phone-core/vite.config.ts`** with a `test` block (node env — phone-core is DOM-free):

  ```ts
  import { defineConfig } from "vite-plus";

  export default defineConfig({
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
    },
  });
  ```

- [ ] **Step 4: Write `packages/phone-core/src/index.ts`** as a placeholder module (replaced in Task 2):

  ```ts
  export {};
  ```

- [ ] **Step 5: Link the package into the workspace:** run `mise exec -- vp install` from the repo root. Expect it to succeed and list `@hellotimber/phone-core` as a workspace project.
- [ ] **Step 6: Verify lint/typecheck:** run `mise exec -- vp check --fix` from the repo root. Expect pass. (Do not run the test command yet — there are no test files until Task 2.)
- [ ] **Step 7: Commit:**

  ```sh
  git add packages/phone-core pnpm-lock.yaml
  git commit -m "feat(phone-core): scaffold package"
  ```

---

### Task 2: Contract types

All public types from the VISION.md "Public contracts" section, **verbatim**, re-exported from the barrel.

**Files**

- Create: `packages/phone-core/src/types.ts`
- Modify: `packages/phone-core/src/index.ts`
- Test: `packages/phone-core/tests/types.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-core/tests/types.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import type {
    Bitmap,
    KeyEvent,
    MenuNode,
    PhoneApp,
    PhoneConfig,
    PhoneEventMap,
    PhoneKey,
    PhoneSnapshot,
    ScreenModel,
  } from "../src/index";

  describe("contract types", () => {
    it("accepts values shaped like the VISION.md contracts", () => {
      const key: PhoneKey = "navi";
      const event: KeyEvent = { type: "down", key };
      const bitmap: Bitmap = { width: 84, height: 48, pixels: new Uint8Array(84 * 48) };
      const screens: ScreenModel[] = [
        { kind: "off" },
        { kind: "boot", phase: "hands", frame: 3 },
        { kind: "standby", carrier: "LACHLAN", clock: "12:34", signal: 4, battery: 4 },
        { kind: "menu-carousel", label: "Messages", menuNumber: 2, total: 13, iconId: "messages" },
        { kind: "list", title: "Inbox", items: ["Hello"], selected: 0, softkey: "Select" },
        { kind: "reader", title: "Chat", lines: ["> hi"], scrollTop: 0 },
        { kind: "editor", title: "Message:", text: "Hi", cursor: 2, mode: "Abc" },
        { kind: "confirm", text: "Sent", softkey: "OK" },
        { kind: "custom", appId: "snake", frame: bitmap },
      ];
      const node: MenuNode = {
        type: "submenu",
        id: "messages",
        label: "Messages",
        iconId: "messages",
        children: [
          {
            type: "list",
            id: "inbox",
            label: "Inbox",
            items: [{ id: "a", label: "A", body: "b" }],
          },
          { type: "reader", id: "chat", label: "Chat", body: "> hi" },
          { type: "app", id: "write", label: "Write messages", appId: "write-message" },
          {
            type: "action",
            id: "gh",
            label: "GitHub",
            action: { kind: "href", value: "https://x" },
          },
        ],
      };
      const app: PhoneApp = {
        onKey: () => undefined,
        tick: () => undefined,
        render: () => ({ kind: "off" }),
      };
      const config: PhoneConfig = {
        menu: [node],
        apps: { "write-message": () => app },
        carrier: "LACHLAN",
        clock: () => "12:34",
        bootMs: 0,
      };
      const snap: PhoneSnapshot = { path: "standby", screen: { kind: "off" }, poweredOn: false };
      const handlers: { [K in keyof PhoneEventMap]: PhoneEventMap[K] } = {
        pathchange: (path) => void path,
        action: (action) => void action.value,
        sound: (sound) => void sound.id,
      };
      expect(event.key).toBe("navi");
      expect(screens).toHaveLength(9);
      expect(config.menu[0]).toBe(node);
      expect(snap.poweredOn).toBe(false);
      expect(Object.keys(handlers)).toHaveLength(3);
    });
  });
  ```

- [ ] **Step 2: Run it & expect FAIL** (module `../src/index` has no such exports): `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 3: Write `packages/phone-core/src/types.ts`** — the contract, copied verbatim from VISION.md "Public contracts → `@hellotimber/phone-core`":

  ```ts
  export type PhoneKey =
    | "power"
    | "navi"
    | "c"
    | "up"
    | "down"
    | "0"
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7"
    | "8"
    | "9"
    | "*"
    | "#";

  export interface KeyEvent {
    type: "down" | "up";
    key: PhoneKey;
  }

  /** 1bpp bitmap, row-major, 0 = clear, 1 = set. */
  export interface Bitmap {
    width: number;
    height: number;
    pixels: Uint8Array;
  }

  export type ScreenModel =
    | { kind: "off" }
    | { kind: "boot"; phase: "hands" | "welcome"; frame: number } // hands animation carries the small NOKIA wordmark
    | {
        kind: "standby";
        carrier: string;
        clock?: string;
        signal: 0 | 1 | 2 | 3 | 4;
        battery: 0 | 1 | 2 | 3 | 4;
      }
    | { kind: "menu-carousel"; label: string; menuNumber: number; total: number; iconId: string }
    | { kind: "list"; title: string; items: string[]; selected: number; softkey: string }
    | { kind: "reader"; title: string; lines: string[]; scrollTop: number }
    | { kind: "editor"; title: string; text: string; cursor: number; mode: "abc" | "Abc" | "123" }
    | { kind: "confirm"; text: string; softkey: string }
    | { kind: "custom"; appId: string; frame: Bitmap }; // games draw raw pixels

  export type MenuNode =
    | { type: "submenu"; id: string; label: string; iconId?: string; children: MenuNode[] }
    | {
        type: "list";
        id: string;
        label: string;
        items: { id: string; label: string; body: string }[];
      }
    | { type: "reader"; id: string; label: string; body: string }
    | { type: "app"; id: string; label: string; appId: string }
    | { type: "action"; id: string; label: string; action: { kind: "href"; value: string } };

  export interface PhoneApp {
    onKey(e: KeyEvent): void;
    tick(dtMs: number): void;
    render(): ScreenModel;
    onExit?(): void;
  }
  export type AppFactory = (ctx: { exit(): void }) => PhoneApp;

  export interface PhoneConfig {
    menu: MenuNode[];
    apps?: Record<string, AppFactory>;
    carrier?: string; // standby line, default 'LACHLAN'
    clock?: () => string | undefined; // host supplies time; phone shows it
    bootMs?: number; // 0 to skip boot in tests
  }

  export interface PhoneSnapshot {
    path: string;
    screen: ScreenModel;
    poweredOn: boolean;
  }

  export type PhoneEventMap = {
    pathchange: (path: string) => void;
    action: (action: { kind: "href"; value: string }) => void; // website opens links
    sound: (sound: { kind: "key" | "tone"; id: string }) => void; // website plays audio
  };

  export interface Phone {
    send(e: KeyEvent): void;
    pressKey(key: PhoneKey, holdMs?: number): void; // convenience: down + up
    tick(nowMs: number): void; // drives timers/animations
    navigate(path: string): void; // external (router) control
    readonly path: string; // e.g. 'standby', 'menu/games/snake'
    readonly screen: ScreenModel;
    subscribe(cb: (snap: PhoneSnapshot) => void): () => void;
    on<K extends keyof PhoneEventMap>(ev: K, cb: PhoneEventMap[K]): () => void;
  }
  ```

- [ ] **Step 4: Replace `packages/phone-core/src/index.ts`** with the type re-exports:

  ```ts
  export type {
    AppFactory,
    Bitmap,
    KeyEvent,
    MenuNode,
    Phone,
    PhoneApp,
    PhoneConfig,
    PhoneEventMap,
    PhoneKey,
    PhoneSnapshot,
    ScreenModel,
  } from "./types";
  ```

- [ ] **Step 5: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 6: Commit:**

  ```sh
  git add packages/phone-core
  git commit -m "feat(phone-core): add VISION contract types"
  ```

---

### Task 3: Menu path utilities

Pure functions implementing the path scheme `standby | menu | menu/<id>/<id>/…` against a `MenuNode[]` tree. Only `submenu` nodes nest.

**Files**

- Create: `packages/phone-core/src/paths.ts`
- Modify: `packages/phone-core/src/index.ts`
- Test: `packages/phone-core/tests/paths.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-core/tests/paths.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import {
    childrenOf,
    isValidPath,
    joinMenuPath,
    normalizePath,
    parsePath,
    resolveIds,
  } from "../src/paths";
  import type { MenuNode } from "../src/types";

  const menu: MenuNode[] = [
    {
      type: "submenu",
      id: "phone-book",
      label: "Phone book",
      children: [
        {
          type: "list",
          id: "search",
          label: "Search",
          items: [{ id: "a", label: "A", body: "a" }],
        },
        { type: "reader", id: "memory-status", label: "Memory status", body: "SIM 2/2 used." },
      ],
    },
    { type: "app", id: "calculator", label: "Calculator", appId: "calculator" },
  ];

  describe("paths", () => {
    it("normalizes slashes and blanks", () => {
      expect(normalizePath("/menu/phone-book/")).toBe("menu/phone-book");
      expect(normalizePath("")).toBe("standby");
      expect(normalizePath("   ")).toBe("standby");
      expect(normalizePath("standby")).toBe("standby");
    });

    it("parses standby and menu paths; rejects everything else", () => {
      expect(parsePath("standby")).toEqual({ kind: "standby" });
      expect(parsePath("/")).toEqual({ kind: "standby" });
      expect(parsePath("menu")).toEqual({ kind: "menu", ids: [] });
      expect(parsePath("menu/phone-book/search")).toEqual({
        kind: "menu",
        ids: ["phone-book", "search"],
      });
      expect(parsePath("nope")).toBeNull();
      expect(parsePath("menu//x")).toBeNull();
    });

    it("resolves ids to nodes through submenus only", () => {
      const nodes = resolveIds(menu, ["phone-book", "search"]);
      expect(nodes?.map((n) => n.id)).toEqual(["phone-book", "search"]);
      expect(resolveIds(menu, [])).toEqual([]);
      expect(resolveIds(menu, ["phone-book", "missing"])).toBeNull();
      expect(resolveIds(menu, ["calculator", "child"])).toBeNull(); // apps have no children
    });

    it("validates full paths and joins ids back", () => {
      expect(isValidPath(menu, "standby")).toBe(true);
      expect(isValidPath(menu, "menu")).toBe(true);
      expect(isValidPath(menu, "menu/phone-book/memory-status")).toBe(true);
      expect(isValidPath(menu, "menu/games")).toBe(false);
      expect(isValidPath(menu, "garbage")).toBe(false);
      expect(joinMenuPath([])).toBe("menu");
      expect(joinMenuPath(["a", "b"])).toBe("menu/a/b");
    });

    it("childrenOf returns children for submenus, [] otherwise", () => {
      expect(childrenOf(menu[0]!)).toHaveLength(2);
      expect(childrenOf(menu[1]!)).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `src/paths.ts`): `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 3: Write `packages/phone-core/src/paths.ts`:**

  ```ts
  import type { MenuNode } from "./types";

  /** Trim whitespace and leading/trailing slashes; empty → 'standby'. */
  export function normalizePath(path: string): string {
    const trimmed = path.trim().replace(/^\/+|\/+$/g, "");
    return trimmed === "" ? "standby" : trimmed;
  }

  export type ParsedPath = { kind: "standby" } | { kind: "menu"; ids: string[] };

  /**
   * Parse 'standby' | 'menu' | 'menu/<id>/…'.
   * Returns null for anything outside the path scheme.
   */
  export function parsePath(path: string): ParsedPath | null {
    const p = normalizePath(path);
    if (p === "standby") return { kind: "standby" };
    const segments = p.split("/");
    if (segments[0] !== "menu") return null;
    const ids = segments.slice(1);
    if (ids.some((id) => id === "")) return null;
    return { kind: "menu", ids };
  }

  /** The nodes a path segment can descend into — only submenus nest. */
  export function childrenOf(node: MenuNode): MenuNode[] {
    return node.type === "submenu" ? node.children : [];
  }

  /**
   * Resolve menu ids to the nodes along the path (one node per id).
   * Returns null if any segment is unknown.
   */
  export function resolveIds(menu: MenuNode[], ids: string[]): MenuNode[] | null {
    const nodes: MenuNode[] = [];
    let level: MenuNode[] = menu;
    for (const id of ids) {
      const node = level.find((n) => n.id === id);
      if (node === undefined) return null;
      nodes.push(node);
      level = childrenOf(node);
    }
    return nodes;
  }

  /** True when the path is 'standby', 'menu', or resolves fully in the tree. */
  export function isValidPath(menu: MenuNode[], path: string): boolean {
    const parsed = parsePath(path);
    if (parsed === null) return false;
    if (parsed.kind === "standby") return true;
    return resolveIds(menu, parsed.ids) !== null;
  }

  /** Join node ids back into a path string ('menu' when empty). */
  export function joinMenuPath(ids: string[]): string {
    return ids.length === 0 ? "menu" : `menu/${ids.join("/")}`;
  }
  ```

- [ ] **Step 4: Append the path exports to `packages/phone-core/src/index.ts`** (add below the existing type re-exports):

  ```ts
  export {
    childrenOf,
    isValidPath,
    joinMenuPath,
    normalizePath,
    parsePath,
    resolveIds,
  } from "./paths";
  export type { ParsedPath } from "./paths";
  ```

- [ ] **Step 5: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 6: Commit:**

  ```sh
  git add packages/phone-core
  git commit -m "feat(phone-core): add menu path utilities"
  ```

---

### Task 4: Machine core — power, boot, ticks, long-press

`createPhone()` with the full state model, the run-wrapper (pathchange detection + subscriber notification, both throw-safe), key-event bookkeeping with long-press derivation (≥ 800 ms, detected in `tick`), the boot sequence (`hands` → `welcome` → standby, timed by `bootMs`; `bootMs: 0` skips), power-off, and the standby screen. Menu navigation lands in Tasks 5–7 — this task ships the named stubs those tasks replace.

**Files**

- Create: `packages/phone-core/src/machine.ts`
- Create: `packages/phone-core/tests/fixtures.ts`
- Modify: `packages/phone-core/src/index.ts`
- Test: `packages/phone-core/tests/power.test.ts`

**Steps**

- [ ] **Step 1: Write the shared fixtures** `packages/phone-core/tests/fixtures.ts`:

  ```ts
  import { createPhone } from "../src/index";
  import type { MenuNode, Phone, PhoneConfig } from "../src/index";

  /** Small but representative tree: submenus, lists, a reader, an app node, an action node. */
  export function testMenu(): MenuNode[] {
    return [
      {
        type: "submenu",
        id: "phone-book",
        label: "Phone book",
        children: [
          {
            type: "list",
            id: "search",
            label: "Search",
            items: [
              {
                id: "alice",
                label: "Alice",
                body: "Alice's card. Email alice@example.com. Likes long walks through menu trees.",
              },
              { id: "bob", label: "Bob", body: "Bob's card." },
            ],
          },
          {
            type: "reader",
            id: "memory-status",
            label: "Memory status",
            body: "SIM memory 2/2 used.",
          },
        ],
      },
      {
        type: "submenu",
        id: "messages",
        label: "Messages",
        children: [
          { type: "app", id: "write", label: "Write messages", appId: "write-message" },
          {
            type: "list",
            id: "inbox",
            label: "Inbox",
            items: [{ id: "hello", label: "Hello", body: "First message." }],
          },
        ],
      },
      { type: "reader", id: "chat", label: "Chat", body: "> hi\n< hello" },
      {
        type: "submenu",
        id: "call-register",
        label: "Call register",
        children: [
          {
            type: "list",
            id: "dialled-numbers",
            label: "Dialled numbers",
            items: [{ id: "proj", label: "Project X", body: "Shipped 2025." }],
          },
        ],
      },
      {
        type: "action",
        id: "github",
        label: "GitHub",
        action: { kind: "href", value: "https://github.com/example" },
      },
    ];
  }

  export function testConfig(overrides: Partial<PhoneConfig> = {}): PhoneConfig {
    return { menu: testMenu(), bootMs: 0, ...overrides };
  }

  /** A phone that has been powered on (bootMs 0 → straight to standby). */
  export function bootedPhone(overrides: Partial<PhoneConfig> = {}): Phone {
    const phone = createPhone(testConfig(overrides));
    phone.tick(0);
    phone.pressKey("power", 1000);
    return phone;
  }
  ```

- [ ] **Step 2: Write the failing test** `packages/phone-core/tests/power.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { createPhone } from "../src/index";
  import { testConfig } from "./fixtures";

  describe("power & boot", () => {
    it("starts powered off, path 'standby'", () => {
      const phone = createPhone(testConfig());
      expect(phone.screen).toEqual({ kind: "off" });
      expect(phone.path).toBe("standby");
    });

    it("short power press while off does nothing", () => {
      const phone = createPhone(testConfig());
      phone.pressKey("power");
      expect(phone.screen).toEqual({ kind: "off" });
    });

    it("hold power ≈1s turns the phone on (bootMs 0 → straight to standby)", () => {
      const phone = createPhone(testConfig());
      phone.pressKey("power", 1000);
      expect(phone.screen.kind).toBe("standby");
    });

    it("plays hands frames, then welcome, then standby when bootMs is set", () => {
      const phone = createPhone(testConfig({ bootMs: 3000 }));
      phone.tick(0);
      phone.send({ type: "down", key: "power" });
      phone.tick(800); // long-press fires here → boot starts at now=800
      expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 0 });
      phone.send({ type: "up", key: "power" });
      phone.tick(1300); // 500ms into hands → frame 2 (200ms per frame)
      expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 2 });
      phone.tick(800 + 2200); // past the hands phase (2/3 of 3000 = 2000ms)
      expect(phone.screen).toEqual({ kind: "boot", phase: "welcome", frame: 1 });
      phone.tick(800 + 3000); // bootMs elapsed
      expect(phone.screen.kind).toBe("standby");
    });

    it("standby shows carrier, clock, full signal and battery", () => {
      const phone = createPhone(testConfig({ carrier: "LACHLAN", clock: () => "12:34" }));
      phone.pressKey("power", 1000);
      expect(phone.screen).toEqual({
        kind: "standby",
        carrier: "LACHLAN",
        clock: "12:34",
        signal: 4,
        battery: 4,
      });
    });

    it("carrier defaults to LACHLAN, clock omitted without a clock fn", () => {
      const phone = createPhone(testConfig());
      phone.pressKey("power", 1000);
      expect(phone.screen).toMatchObject({ kind: "standby", carrier: "LACHLAN" });
    });

    it("hold power while on powers off; path returns to 'standby'", () => {
      const phone = createPhone(testConfig());
      phone.pressKey("power", 1000);
      expect(phone.screen.kind).toBe("standby");
      phone.pressKey("power", 1000);
      expect(phone.screen).toEqual({ kind: "off" });
      expect(phone.path).toBe("standby");
    });

    it("notifies subscribers on changes; unsubscribe stops notifications", () => {
      const phone = createPhone(testConfig());
      const seen: string[] = [];
      const off = phone.subscribe((snap) => seen.push(snap.screen.kind));
      phone.pressKey("power", 1000);
      expect(seen).toContain("standby");
      const count = seen.length;
      off();
      phone.pressKey("power", 1000);
      expect(seen).toHaveLength(count);
    });
  });
  ```

- [ ] **Step 3: Run & expect FAIL** (no `createPhone` export): `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 4: Write `packages/phone-core/src/machine.ts`.** This is the full core; the four functions marked "Replaced in Task N" are real stubs that later tasks overwrite:

  ```ts
  import type {
    KeyEvent,
    MenuNode,
    Phone,
    PhoneApp,
    PhoneConfig,
    PhoneEventMap,
    PhoneKey,
    PhoneSnapshot,
    ScreenModel,
  } from "./types";

  export const LONG_PRESS_MS = 800;
  export const SHORTCUT_WINDOW_MS = 3000;
  export const BOOT_FRAME_MS = 200;
  export const DEFAULT_BOOT_MS = 3000;
  export const READER_VISIBLE_LINES = 3;
  export const READER_LINE_CHARS = 14;

  type SubmenuNode = Extract<MenuNode, { type: "submenu" }>;
  type ListNode = Extract<MenuNode, { type: "list" }>;
  type ReaderNode = Extract<MenuNode, { type: "reader" }>;
  type AppNode = Extract<MenuNode, { type: "app" }>;

  /** One level of the navigation stack. stack[0] is always the menu carousel. */
  type NavFrame =
    | { kind: "carousel"; index: number }
    | { kind: "submenu"; node: SubmenuNode; selected: number }
    | { kind: "list"; node: ListNode; selected: number }
    | { kind: "item"; node: ListNode; itemIndex: number; scrollTop: number }
    | { kind: "reader"; node: ReaderNode; scrollTop: number };

  type Mode =
    | { kind: "off" }
    | { kind: "boot"; startedAt: number; targetPath: string | null }
    | { kind: "standby" }
    | { kind: "nav"; stack: NavFrame[] }
    | { kind: "app"; node: AppNode; app: PhoneApp; stack: NavFrame[] };

  interface HeldKey {
    downAt: number;
    longFired: boolean;
  }

  interface Machine {
    config: PhoneConfig;
    carrier: string;
    bootMs: number;
    /** Last time seen via tick(nowMs). The machine's ONLY clock. */
    now: number;
    mode: Mode;
    held: Map<PhoneKey, HeldKey>;
    /** Menu-shortcut digit window (Task 7). */
    shortcut: { digits: number[]; deadline: number } | null;
    dirty: boolean;
    subscribers: Set<(snap: PhoneSnapshot) => void>;
    listeners: { [K in keyof PhoneEventMap]: Set<PhoneEventMap[K]> };
  }

  function emit<K extends keyof PhoneEventMap>(
    m: Machine,
    ev: K,
    arg: Parameters<PhoneEventMap[K]>[0],
  ): void {
    const set = m.listeners[ev] as Set<(a: Parameters<PhoneEventMap[K]>[0]) => void>;
    for (const cb of set) {
      try {
        cb(arg);
      } catch {
        // listeners must never throw the machine into inconsistency
      }
    }
  }

  /**
   * Every public entry point runs through here: detect path changes (emit
   * 'pathchange' only on actual change) and flush one snapshot to subscribers.
   */
  function run(m: Machine, fn: () => void): void {
    const before = currentPath(m);
    fn();
    const after = currentPath(m);
    if (after !== before) {
      m.dirty = true;
      emit(m, "pathchange", after);
    }
    if (m.dirty) {
      m.dirty = false;
      const snap = snapshot(m);
      for (const cb of m.subscribers) {
        try {
          cb(snap);
        } catch {
          // subscribers must never throw the machine into inconsistency
        }
      }
    }
  }

  function snapshot(m: Machine): PhoneSnapshot {
    return { path: currentPath(m), screen: renderScreen(m), poweredOn: m.mode.kind !== "off" };
  }

  function stackIds(stack: NavFrame[]): string[] {
    const ids: string[] = [];
    for (const f of stack) {
      if (f.kind === "submenu" || f.kind === "list" || f.kind === "reader") ids.push(f.node.id);
    }
    return ids;
  }

  function currentPath(m: Machine): string {
    if (m.mode.kind === "nav") {
      const ids = stackIds(m.mode.stack);
      return ids.length === 0 ? "menu" : `menu/${ids.join("/")}`;
    }
    if (m.mode.kind === "app") {
      return `menu/${[...stackIds(m.mode.stack), m.mode.node.id].join("/")}`;
    }
    return "standby"; // off, boot and standby all read as 'standby'
  }

  /** Greedy word-wrap at `width` chars; hard-breaks longer words; '\n' = paragraph. */
  export function wrapLines(body: string, width = READER_LINE_CHARS): string[] {
    const lines: string[] = [];
    for (const para of body.split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        let w = word;
        while (w.length > width) {
          if (line !== "") {
            lines.push(line);
            line = "";
          }
          lines.push(w.slice(0, width));
          w = w.slice(width);
        }
        if (line === "") line = w;
        else if (line.length + 1 + w.length <= width) line = `${line} ${w}`;
        else {
          lines.push(line);
          line = w;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  function renderScreen(m: Machine): ScreenModel {
    switch (m.mode.kind) {
      case "off":
        return { kind: "off" };
      case "boot": {
        const elapsed = m.now - m.mode.startedAt;
        const handsMs = Math.floor((m.bootMs * 2) / 3);
        if (elapsed < handsMs) {
          return { kind: "boot", phase: "hands", frame: Math.floor(elapsed / BOOT_FRAME_MS) };
        }
        return {
          kind: "boot",
          phase: "welcome",
          frame: Math.floor((elapsed - handsMs) / BOOT_FRAME_MS),
        };
      }
      case "standby":
        return {
          kind: "standby",
          carrier: m.carrier,
          clock: m.config.clock?.(),
          signal: 4,
          battery: 4,
        };
      case "nav":
        return renderFrame(m, m.mode.stack[m.mode.stack.length - 1]!);
      case "app":
        try {
          return m.mode.app.render();
        } catch {
          return { kind: "reader", title: m.mode.node.label, lines: ["App error"], scrollTop: 0 };
        }
    }
  }

  function renderFrame(m: Machine, frame: NavFrame): ScreenModel {
    switch (frame.kind) {
      case "carousel": {
        const node = m.config.menu[frame.index]!;
        const iconId = node.type === "submenu" && node.iconId !== undefined ? node.iconId : node.id;
        return {
          kind: "menu-carousel",
          label: node.label,
          menuNumber: frame.index + 1,
          total: m.config.menu.length,
          iconId,
        };
      }
      case "submenu":
        return {
          kind: "list",
          title: frame.node.label,
          items: frame.node.children.map((c) => c.label),
          selected: frame.selected,
          softkey: "Select",
        };
      case "list":
        return {
          kind: "list",
          title: frame.node.label,
          items: frame.node.items.map((i) => i.label),
          selected: frame.selected,
          softkey: "Select",
        };
      case "item": {
        const item = frame.node.items[frame.itemIndex]!;
        return {
          kind: "reader",
          title: item.label,
          lines: wrapLines(item.body),
          scrollTop: frame.scrollTop,
        };
      }
      case "reader":
        return {
          kind: "reader",
          title: frame.node.label,
          lines: wrapLines(frame.node.body),
          scrollTop: frame.scrollTop,
        };
    }
  }

  // --- power -----------------------------------------------------------------

  function togglePower(m: Machine): void {
    if (m.mode.kind === "off") powerOn(m, null);
    else powerOff(m);
  }

  function powerOn(m: Machine, targetPath: string | null): void {
    if (m.bootMs <= 0) {
      m.mode = { kind: "standby" };
      if (targetPath !== null) applyPath(m, targetPath);
    } else {
      m.mode = { kind: "boot", startedAt: m.now, targetPath };
    }
    m.dirty = true;
  }

  function powerOff(m: Machine): void {
    exitAppIfActive(m);
    m.mode = { kind: "off" };
    m.shortcut = null;
    m.dirty = true;
  }

  /** Tear down a hosted app when the machine leaves it (power off, navigate, …). */
  function exitAppIfActive(m: Machine): void {
    if (m.mode.kind !== "app") return;
    for (const h of m.held.values()) h.longFired = true; // swallow in-flight key releases
    try {
      m.mode.app.onExit?.();
    } catch {
      // apps must never throw the machine into inconsistency
    }
  }

  function goStandby(m: Machine): void {
    exitAppIfActive(m);
    m.mode = { kind: "standby" };
    m.shortcut = null;
    m.dirty = true;
  }

  function tickBoot(m: Machine): void {
    if (m.mode.kind !== "boot") return;
    m.dirty = true; // animation frame may have advanced
    if (m.now - m.mode.startedAt >= m.bootMs) {
      const target = m.mode.targetPath;
      m.mode = { kind: "standby" };
      if (target !== null) applyPath(m, target);
    }
  }

  // --- key events --------------------------------------------------------------

  function handleKeyEvent(m: Machine, e: KeyEvent): void {
    if (e.type === "down") {
      if (m.held.has(e.key)) return; // duplicate down (e.g. OS key repeat)
      m.held.set(e.key, { downAt: m.now, longFired: false });
      if (m.mode.kind !== "off") emit(m, "sound", { kind: "key", id: "beep" });
      forwardToApp(m, e);
      return;
    }
    const held = m.held.get(e.key);
    m.held.delete(e.key);
    if (m.mode.kind === "app") {
      forwardToApp(m, e); // the app owns its keys (incl. its own long-press logic)
      return;
    }
    if (held === undefined || held.longFired) return; // long press already handled in tick()
    onShortPress(m, e.key);
  }

  function forwardToApp(m: Machine, e: KeyEvent): void {
    if (m.mode.kind !== "app") return;
    try {
      m.mode.app.onKey(e);
    } catch {
      // apps must never throw the machine into inconsistency
    }
    m.dirty = true;
  }

  function handleTick(m: Machine, nowMs: number): void {
    m.now = Math.max(m.now, nowMs);
    for (const [key, h] of m.held) {
      if (!h.longFired && m.now - h.downAt >= LONG_PRESS_MS) {
        h.longFired = true;
        onLongPress(m, key);
      }
    }
    if (m.mode.kind === "boot") tickBoot(m);
  }

  function onShortPress(m: Machine, key: PhoneKey): void {
    switch (m.mode.kind) {
      case "standby":
        standbyShortPress(m, key);
        return;
      case "nav":
        navShortPress(m, key);
        return;
      default:
        return; // off/boot ignore short presses; apps got the raw events already
    }
  }

  function onLongPress(m: Machine, key: PhoneKey): void {
    if (key === "power") {
      togglePower(m);
      return;
    }
    if (m.mode.kind === "nav" && key === "c") {
      goStandby(m); // hold-C exits to standby
    }
    // everything else: long presses belong to the active app (if any) or do nothing
  }

  function standbyShortPress(_m: Machine, _key: PhoneKey): void {
    // Replaced in Task 5 (navi → menu, up → phone book, down → dialled numbers).
  }

  function navShortPress(_m: Machine, _key: PhoneKey): void {
    // Replaced in Task 5 (carousel), extended in Tasks 6 (lists/readers) and 7 (shortcuts).
  }

  function applyPath(_m: Machine, _path: string): void {
    // Replaced in Task 5 (jump the machine to a resolved menu path).
  }

  function handleNavigate(_m: Machine, _path: string): void {
    // Replaced in Task 10 (external router control).
  }

  // --- public factory ----------------------------------------------------------

  export function createPhone(config: PhoneConfig): Phone {
    const m: Machine = {
      config,
      carrier: config.carrier ?? "LACHLAN",
      bootMs: config.bootMs ?? DEFAULT_BOOT_MS,
      now: 0,
      mode: { kind: "off" },
      held: new Map(),
      shortcut: null,
      dirty: false,
      subscribers: new Set(),
      listeners: { pathchange: new Set(), action: new Set(), sound: new Set() },
    };

    const phone: Phone = {
      send(e: KeyEvent): void {
        run(m, () => handleKeyEvent(m, e));
      },
      pressKey(key: PhoneKey, holdMs = 0): void {
        phone.send({ type: "down", key });
        if (holdMs > 0) phone.tick(m.now + holdMs); // advances the machine clock
        phone.send({ type: "up", key });
      },
      tick(nowMs: number): void {
        run(m, () => handleTick(m, nowMs));
      },
      navigate(path: string): void {
        run(m, () => handleNavigate(m, path));
      },
      get path(): string {
        return currentPath(m);
      },
      get screen(): ScreenModel {
        return renderScreen(m);
      },
      subscribe(cb: (snap: PhoneSnapshot) => void): () => void {
        m.subscribers.add(cb);
        return () => {
          m.subscribers.delete(cb);
        };
      },
      on<K extends keyof PhoneEventMap>(ev: K, cb: PhoneEventMap[K]): () => void {
        const set = m.listeners[ev] as Set<PhoneEventMap[K]>;
        set.add(cb);
        return () => {
          set.delete(cb);
        };
      },
    };
    return phone;
  }
  ```

- [ ] **Step 5: Append the machine exports to `packages/phone-core/src/index.ts`:**

  ```ts
  export {
    BOOT_FRAME_MS,
    createPhone,
    DEFAULT_BOOT_MS,
    LONG_PRESS_MS,
    READER_LINE_CHARS,
    READER_VISIBLE_LINES,
    SHORTCUT_WINDOW_MS,
    wrapLines,
  } from "./machine";
  ```

- [ ] **Step 6: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 7: Run `mise exec -- vp check --fix`** — expect pass (fix any reported lint nits without changing behavior).
- [ ] **Step 8: Commit:**

  ```sh
  git add packages/phone-core
  git commit -m "feat(phone-core): add phone machine core with power and boot"
  ```

---

### Task 5: Standby keys & menu carousel

Standby: `navi` opens the menu carousel; `up` jumps to the phone book name list (`menu/phone-book/search`); `down` jumps to the redial list (`menu/call-register/dialled-numbers`) — verified 3310 behavior (spec §4/§6). Carousel: one item at a time, `down` = next / `up` = previous with wraparound, `navi` selects, `c` steps back (carousel → standby; deeper → pop one level), hold-`c` exits to standby from anywhere in the menus.

**Files**

- Modify: `packages/phone-core/src/machine.ts`
- Test: `packages/phone-core/tests/carousel.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-core/tests/carousel.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { bootedPhone } from "./fixtures";

  describe("standby keys & menu carousel", () => {
    it("navi in standby opens the carousel on menu 1", () => {
      const phone = bootedPhone();
      phone.pressKey("navi");
      expect(phone.path).toBe("menu");
      expect(phone.screen).toEqual({
        kind: "menu-carousel",
        label: "Phone book",
        menuNumber: 1,
        total: 5,
        iconId: "phone-book",
      });
    });

    it("down cycles forward; up cycles backward; both wrap around", () => {
      const phone = bootedPhone();
      phone.pressKey("navi");
      phone.pressKey("down");
      expect(phone.screen).toMatchObject({
        kind: "menu-carousel",
        label: "Messages",
        menuNumber: 2,
      });
      phone.pressKey("up");
      phone.pressKey("up"); // wraps from 1 to 5
      expect(phone.screen).toMatchObject({ kind: "menu-carousel", label: "GitHub", menuNumber: 5 });
      phone.pressKey("down"); // wraps back to 1
      expect(phone.screen).toMatchObject({ kind: "menu-carousel", menuNumber: 1 });
    });

    it("scrolling the carousel does not change the path", () => {
      const phone = bootedPhone();
      phone.pressKey("navi");
      phone.pressKey("down");
      expect(phone.path).toBe("menu");
    });

    it("navi enters the selected menu; c steps back; c again returns to standby", () => {
      const phone = bootedPhone();
      phone.pressKey("navi");
      phone.pressKey("navi"); // enter Phone book
      expect(phone.path).toBe("menu/phone-book");
      expect(phone.screen).toMatchObject({
        kind: "list",
        title: "Phone book",
        items: ["Search", "Memory status"],
        selected: 0,
        softkey: "Select",
      });
      phone.pressKey("c");
      expect(phone.path).toBe("menu");
      expect(phone.screen).toMatchObject({ kind: "menu-carousel", label: "Phone book" });
      phone.pressKey("c");
      expect(phone.path).toBe("standby");
    });

    it("entering a top-level reader shows it (Chat)", () => {
      const phone = bootedPhone();
      phone.pressKey("navi");
      phone.pressKey("down");
      phone.pressKey("down"); // Chat
      phone.pressKey("navi");
      expect(phone.path).toBe("menu/chat");
      expect(phone.screen).toMatchObject({ kind: "reader", title: "Chat", scrollTop: 0 });
    });

    it("hold-c exits to standby from deep in the menus", () => {
      const phone = bootedPhone();
      phone.pressKey("navi");
      phone.pressKey("navi"); // Phone book
      phone.pressKey("navi"); // Search list
      expect(phone.path).toBe("menu/phone-book/search");
      phone.pressKey("c", 1000);
      expect(phone.path).toBe("standby");
    });

    it("standby up opens the phone book name list", () => {
      const phone = bootedPhone();
      phone.pressKey("up");
      expect(phone.path).toBe("menu/phone-book/search");
      expect(phone.screen).toMatchObject({
        kind: "list",
        title: "Search",
        items: ["Alice", "Bob"],
      });
    });

    it("standby down opens the dialled numbers list", () => {
      const phone = bootedPhone();
      phone.pressKey("down");
      expect(phone.path).toBe("menu/call-register/dialled-numbers");
      expect(phone.screen).toMatchObject({ kind: "list", title: "Dialled numbers" });
    });

    it("standby up is a no-op when the menu lacks phone-book/search", () => {
      const phone = bootedPhone({
        menu: [{ type: "reader", id: "only", label: "Only", body: "x" }],
      });
      phone.pressKey("up");
      expect(phone.path).toBe("standby");
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (standby/nav handlers are still stubs): `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 3: Extend the imports** at the top of `packages/phone-core/src/machine.ts` — add this line directly below the `import type { ... } from "./types";` block:

  ```ts
  import { childrenOf, parsePath, resolveIds } from "./paths";
  ```

- [ ] **Step 4: Replace the stub `standbyShortPress`** in `packages/phone-core/src/machine.ts` with:

  ```ts
  function standbyShortPress(m: Machine, key: PhoneKey): void {
    if (key === "navi") {
      enterMenu(m);
      return;
    }
    // Verified 3310 standby shortcuts: ▲ = phone book name list, ▼ = last dialled numbers.
    if (key === "up") tryApplyPath(m, "menu/phone-book/search");
    if (key === "down") tryApplyPath(m, "menu/call-register/dialled-numbers");
  }
  ```

- [ ] **Step 5: Replace the stub `navShortPress`** with the carousel handler (lists/readers extended in Task 6, digit shortcuts in Task 7):

  ```ts
  function navShortPress(m: Machine, key: PhoneKey): void {
    if (m.mode.kind !== "nav") return;
    const stack = m.mode.stack;
    const frame = stack[stack.length - 1]!;

    if (key === "c") {
      popFrame(m);
      return;
    }

    if (frame.kind === "carousel") {
      const total = m.config.menu.length;
      if (key === "down") {
        frame.index = wrapIndex(frame.index + 1, total);
        m.shortcut = null; // scrolling cancels the digit-shortcut window
        m.dirty = true;
      } else if (key === "up") {
        frame.index = wrapIndex(frame.index - 1, total);
        m.shortcut = null;
        m.dirty = true;
      } else if (key === "navi") {
        m.shortcut = null;
        enterNode(m, m.config.menu[frame.index]!);
      }
      return;
    }

    if (frame.kind === "submenu" && key === "navi" && frame.node.children.length > 0) {
      enterNode(m, frame.node.children[frame.selected]!);
    }
    // List selection, item opening and reader scrolling arrive in Task 6.
  }
  ```

- [ ] **Step 6: Replace the stub `applyPath`** with the real version, and add its helpers (`enterMenu`, `tryApplyPath`, `buildNavStack`, `enterNode`, `popFrame`, `wrapIndex`) directly below it:

  ```ts
  /** Jump the machine to a parsed path as if the user had navigated there. Unknown → standby. */
  function applyPath(m: Machine, path: string): void {
    const parsed = parsePath(path);
    if (parsed === null || parsed.kind === "standby") {
      goStandby(m);
      return;
    }
    if (parsed.ids.length === 0) {
      exitAppIfActive(m);
      m.mode = { kind: "nav", stack: [{ kind: "carousel", index: 0 }] };
      m.shortcut = null;
      m.dirty = true;
      return;
    }
    const nodes = resolveIds(m.config.menu, parsed.ids);
    if (nodes === null) {
      goStandby(m);
      return;
    }
    buildNavStack(m, nodes);
  }

  /** Apply a well-known path if the configured menu has it; otherwise do nothing. */
  function tryApplyPath(m: Machine, path: string): void {
    const parsed = parsePath(path);
    if (parsed === null || parsed.kind === "standby") return;
    const nodes = resolveIds(m.config.menu, parsed.ids);
    if (nodes === null) return;
    buildNavStack(m, nodes);
  }

  /** Open the menu carousel from standby and start the 3s shortcut window. */
  function enterMenu(m: Machine): void {
    m.mode = { kind: "nav", stack: [{ kind: "carousel", index: 0 }] };
    m.shortcut = { digits: [], deadline: m.now + SHORTCUT_WINDOW_MS };
    m.dirty = true;
  }

  /**
   * Build a nav stack for the resolved nodes, positioning each parent's
   * carousel index / list selection on the path (so backing out with C
   * lands on the item the user "came through").
   */
  function buildNavStack(m: Machine, nodes: MenuNode[]): void {
    exitAppIfActive(m);
    m.shortcut = null;
    const stack: NavFrame[] = [{ kind: "carousel", index: 0 }];
    let siblings: MenuNode[] = m.config.menu;
    for (const node of nodes) {
      const indexInSiblings = siblings.findIndex((n) => n.id === node.id);
      const parent = stack[stack.length - 1]!;
      if (parent.kind === "carousel") parent.index = indexInSiblings;
      else if (parent.kind === "submenu") parent.selected = indexInSiblings;
      if (node.type === "submenu") stack.push({ kind: "submenu", node, selected: 0 });
      else if (node.type === "list") stack.push({ kind: "list", node, selected: 0 });
      else if (node.type === "reader") stack.push({ kind: "reader", node, scrollTop: 0 });
      else break; // app/action targets handled in Task 8; stop at the parent view
      siblings = childrenOf(node);
    }
    m.mode = { kind: "nav", stack };
    m.dirty = true;
  }

  /** Enter a node from the carousel or a submenu list. */
  function enterNode(m: Machine, node: MenuNode): void {
    if (m.mode.kind !== "nav") return;
    m.shortcut = null;
    switch (node.type) {
      case "submenu":
        m.mode.stack.push({ kind: "submenu", node, selected: 0 });
        m.dirty = true;
        return;
      case "list":
        m.mode.stack.push({ kind: "list", node, selected: 0 });
        m.dirty = true;
        return;
      case "reader":
        m.mode.stack.push({ kind: "reader", node, scrollTop: 0 });
        m.dirty = true;
        return;
      case "app":
      case "action":
        // App launching arrives in Task 8, action events in Task 9.
        return;
    }
  }

  /** C: pop one level; from the carousel itself, back to standby. */
  function popFrame(m: Machine): void {
    if (m.mode.kind !== "nav") return;
    const stack = m.mode.stack;
    if (stack.length === 1) {
      goStandby(m);
      return;
    }
    stack.pop();
    m.dirty = true;
  }

  function wrapIndex(i: number, total: number): number {
    return ((i % total) + total) % total;
  }
  ```

- [ ] **Step 7: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 8: Commit:**

  ```sh
  git add packages/phone-core
  git commit -m "feat(phone-core): standby keys and menu carousel navigation"
  ```

---

### Task 6: Lists, items & readers

Submenu/list selection moves with ▲▼ (wrapping, like the carousel — best guess for Series 20 lists), `navi` opens a list item as a reader (path unchanged — see deviation note 4), readers scroll line-by-line with ▲▼ clamped to `[0, lines - 3]`, `c` pops one level.

**Files**

- Modify: `packages/phone-core/src/machine.ts`
- Test: `packages/phone-core/tests/lists.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-core/tests/lists.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { wrapLines } from "../src/index";
  import type { ScreenModel } from "../src/index";
  import { bootedPhone } from "./fixtures";

  describe("lists, items & readers", () => {
    it("wrapLines wraps at 14 chars, hard-breaks long words, honors newlines", () => {
      expect(wrapLines("hello world")).toEqual(["hello world"]);
      expect(wrapLines("a veryverylongword14 b")).toEqual(["a", "veryverylongwo", "rd14 b"]);
      expect(wrapLines("one\ntwo")).toEqual(["one", "two"]);
    });

    it("list selection moves with up/down and wraps", () => {
      const phone = bootedPhone();
      phone.pressKey("up"); // standby shortcut → Search list (Alice, Bob)
      expect(phone.screen).toMatchObject({ kind: "list", items: ["Alice", "Bob"], selected: 0 });
      phone.pressKey("down");
      expect(phone.screen).toMatchObject({ selected: 1 });
      phone.pressKey("down"); // wraps
      expect(phone.screen).toMatchObject({ selected: 0 });
      phone.pressKey("up"); // wraps backward
      expect(phone.screen).toMatchObject({ selected: 1 });
    });

    it("navi opens the selected item as a reader; the path stays at the list", () => {
      const phone = bootedPhone();
      phone.pressKey("up");
      phone.pressKey("navi");
      expect(phone.screen).toMatchObject({ kind: "reader", title: "Alice", scrollTop: 0 });
      expect(phone.path).toBe("menu/phone-book/search");
      phone.pressKey("c"); // back to the list, selection kept
      expect(phone.screen).toMatchObject({ kind: "list", selected: 0 });
    });

    it("submenu selection is restored when stepping back from a child", () => {
      const phone = bootedPhone();
      phone.pressKey("navi");
      phone.pressKey("navi"); // Phone book submenu
      phone.pressKey("down"); // select Memory status
      phone.pressKey("navi"); // open it (reader node)
      expect(phone.path).toBe("menu/phone-book/memory-status");
      phone.pressKey("c");
      expect(phone.path).toBe("menu/phone-book");
      expect(phone.screen).toMatchObject({ kind: "list", selected: 1 });
    });

    it("reader scrolls down and up, clamped to the content", () => {
      const phone = bootedPhone();
      phone.pressKey("up");
      phone.pressKey("navi"); // open Alice (long body → several wrapped lines)
      phone.pressKey("up"); // already at top — no change
      expect(phone.screen).toMatchObject({ kind: "reader", scrollTop: 0 });
      phone.pressKey("down");
      expect(phone.screen).toMatchObject({ scrollTop: 1 });
      for (let i = 0; i < 50; i++) phone.pressKey("down");
      const reader = phone.screen as Extract<ScreenModel, { kind: "reader" }>;
      expect(reader.scrollTop).toBe(reader.lines.length - 3); // clamped at maxTop
      phone.pressKey("up");
      expect(phone.screen).toMatchObject({ scrollTop: reader.scrollTop - 1 });
    });

    it("an empty list ignores navi and arrows", () => {
      const phone = bootedPhone({
        menu: [{ type: "list", id: "empty", label: "Empty", items: [] }],
      });
      phone.pressKey("navi"); // carousel
      phone.pressKey("navi"); // enter the empty list
      expect(phone.path).toBe("menu/empty");
      phone.pressKey("down");
      phone.pressKey("navi");
      expect(phone.screen).toMatchObject({ kind: "list", items: [], selected: 0 });
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (list keys not handled yet): `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 3: Replace `navShortPress`** in `packages/phone-core/src/machine.ts` with the full per-frame switch (digit shortcuts still arrive in Task 7):

  ```ts
  function navShortPress(m: Machine, key: PhoneKey): void {
    if (m.mode.kind !== "nav") return;
    const stack = m.mode.stack;
    const frame = stack[stack.length - 1]!;

    if (key === "c") {
      popFrame(m);
      return;
    }

    switch (frame.kind) {
      case "carousel": {
        const total = m.config.menu.length;
        if (key === "down") {
          frame.index = wrapIndex(frame.index + 1, total);
          m.shortcut = null; // scrolling cancels the digit-shortcut window
          m.dirty = true;
        } else if (key === "up") {
          frame.index = wrapIndex(frame.index - 1, total);
          m.shortcut = null;
          m.dirty = true;
        } else if (key === "navi") {
          m.shortcut = null;
          enterNode(m, m.config.menu[frame.index]!);
        }
        return;
      }
      case "submenu": {
        const total = frame.node.children.length;
        if (total === 0) return;
        if (key === "down") {
          frame.selected = wrapIndex(frame.selected + 1, total);
          m.dirty = true;
        } else if (key === "up") {
          frame.selected = wrapIndex(frame.selected - 1, total);
          m.dirty = true;
        } else if (key === "navi") {
          enterNode(m, frame.node.children[frame.selected]!);
        }
        return;
      }
      case "list": {
        const total = frame.node.items.length;
        if (total === 0) return;
        if (key === "down") {
          frame.selected = wrapIndex(frame.selected + 1, total);
          m.dirty = true;
        } else if (key === "up") {
          frame.selected = wrapIndex(frame.selected - 1, total);
          m.dirty = true;
        } else if (key === "navi") {
          stack.push({ kind: "item", node: frame.node, itemIndex: frame.selected, scrollTop: 0 });
          m.dirty = true;
        }
        return;
      }
      case "item":
      case "reader": {
        const body =
          frame.kind === "item" ? frame.node.items[frame.itemIndex]!.body : frame.node.body;
        const maxTop = Math.max(0, wrapLines(body).length - READER_VISIBLE_LINES);
        if (key === "down" && frame.scrollTop < maxTop) {
          frame.scrollTop += 1;
          m.dirty = true;
        } else if (key === "up" && frame.scrollTop > 0) {
          frame.scrollTop -= 1;
          m.dirty = true;
        }
        return;
      }
    }
  }
  ```

- [ ] **Step 4: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 5: Commit:**

  ```sh
  git add packages/phone-core
  git commit -m "feat(phone-core): list selection and reader scrolling"
  ```

---

### Task 7: Menu digit shortcuts (3-second window)

Verified 3310 behavior (spec §5): press `Menu` (navi), then digits within 3 seconds jump to that menu number — e.g. `Menu`,`2` shows Messages in the carousel; `Menu`,`2`,`2` descends to Inbox. Each digit restarts the window. `navi` enters the shortcut target immediately; the window timing out also enters it. Scrolling cancels the window (already wired in Tasks 5–6). Digits 1–9 per level (deviation note 5).

**Files**

- Modify: `packages/phone-core/src/machine.ts`
- Test: `packages/phone-core/tests/shortcuts.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-core/tests/shortcuts.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { bootedPhone } from "./fixtures";

  describe("menu shortcuts", () => {
    it("a digit inside the window positions the carousel on that menu without entering", () => {
      const phone = bootedPhone();
      phone.pressKey("navi");
      phone.pressKey("2");
      expect(phone.screen).toMatchObject({
        kind: "menu-carousel",
        label: "Messages",
        menuNumber: 2,
      });
      expect(phone.path).toBe("menu");
    });

    it("navi enters the shortcut target", () => {
      const phone = bootedPhone();
      phone.pressKey("navi");
      phone.pressKey("2");
      phone.pressKey("navi");
      expect(phone.path).toBe("menu/messages");
    });

    it("the window times out after 3s and enters the target", () => {
      const phone = bootedPhone();
      phone.tick(10_000);
      phone.pressKey("navi"); // window: 10000 → 13000
      phone.pressKey("2"); // restarts: still 13000 (no tick since)
      phone.tick(12_999);
      expect(phone.path).toBe("menu");
      phone.tick(13_000);
      expect(phone.path).toBe("menu/messages");
    });

    it("multi-digit shortcuts descend levels: Menu 2 2 opens the Inbox", () => {
      const phone = bootedPhone();
      phone.pressKey("navi");
      phone.pressKey("2");
      phone.pressKey("2");
      phone.pressKey("navi");
      expect(phone.path).toBe("menu/messages/inbox");
      expect(phone.screen).toMatchObject({ kind: "list", title: "Inbox" });
    });

    it("an expired window without digits just stays in the carousel; later digits are ignored", () => {
      const phone = bootedPhone();
      phone.tick(10_000);
      phone.pressKey("navi");
      phone.tick(14_000); // window (no digits) expires silently
      expect(phone.path).toBe("menu");
      phone.pressKey("2"); // no window → ignored
      expect(phone.screen).toMatchObject({ kind: "menu-carousel", menuNumber: 1 });
    });

    it("out-of-range digits leave the carousel where it is", () => {
      const phone = bootedPhone();
      phone.pressKey("navi");
      phone.pressKey("9"); // only 5 menus in the fixture — no preview jump
      expect(phone.screen).toMatchObject({ kind: "menu-carousel", menuNumber: 1 });
      phone.pressKey("navi"); // digits [9] resolve to nothing → window cleared, still in carousel
      expect(phone.path).toBe("menu");
      phone.pressKey("navi"); // a plain navi now enters the selection
      expect(phone.path).toBe("menu/phone-book");
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 3: Add the shortcut handlers** to `packages/phone-core/src/machine.ts`, directly below `enterMenu`:

  ```ts
  /** A digit pressed in the carousel while the 3s window is open. */
  function shortcutDigit(m: Machine, digit: number): void {
    if (m.mode.kind !== "nav" || m.shortcut === null) return;
    m.shortcut.digits.push(digit);
    m.shortcut.deadline = m.now + SHORTCUT_WINDOW_MS; // each digit restarts the window
    const first = m.shortcut.digits[0]!;
    const top = m.mode.stack[0]!;
    if (top.kind === "carousel" && first >= 1 && first <= m.config.menu.length) {
      top.index = first - 1; // preview: the shortcut number shows top-right on the real phone
      m.dirty = true;
    }
  }

  /** Enter the accumulated digit path (navi pressed or window timed out). */
  function commitShortcut(m: Machine): void {
    if (m.mode.kind !== "nav" || m.shortcut === null) return;
    const digits = m.shortcut.digits;
    m.shortcut = null;
    if (digits.length === 0) return; // expired without input — stay in the carousel
    const nodes: MenuNode[] = [];
    let level: MenuNode[] = m.config.menu;
    for (const d of digits) {
      const node = level[d - 1];
      if (node === undefined) break; // stop at the first invalid digit
      nodes.push(node);
      level = childrenOf(node);
    }
    if (nodes.length === 0) return;
    buildNavStack(m, nodes);
  }
  ```

- [ ] **Step 4: Replace the `case "carousel":` block inside `navShortPress`** with the digit-aware version (the rest of the switch is unchanged from Task 6):

  ```ts
      case "carousel": {
        const total = m.config.menu.length;
        if (key === "down") {
          frame.index = wrapIndex(frame.index + 1, total);
          m.shortcut = null; // scrolling cancels the digit-shortcut window
          m.dirty = true;
        } else if (key === "up") {
          frame.index = wrapIndex(frame.index - 1, total);
          m.shortcut = null;
          m.dirty = true;
        } else if (key === "navi") {
          if (m.shortcut !== null && m.shortcut.digits.length > 0) {
            commitShortcut(m);
            return;
          }
          m.shortcut = null;
          enterNode(m, m.config.menu[frame.index]!);
        } else if (m.shortcut !== null && /^[1-9]$/.test(key)) {
          shortcutDigit(m, Number(key));
        }
        return;
      }
  ```

- [ ] **Step 5: Replace `handleTick`** with the version that expires the window:

  ```ts
  function handleTick(m: Machine, nowMs: number): void {
    m.now = Math.max(m.now, nowMs);
    for (const [key, h] of m.held) {
      if (!h.longFired && m.now - h.downAt >= LONG_PRESS_MS) {
        h.longFired = true;
        onLongPress(m, key);
      }
    }
    if (m.mode.kind === "boot") tickBoot(m);
    if (m.shortcut !== null && m.now >= m.shortcut.deadline) commitShortcut(m);
  }
  ```

- [ ] **Step 6: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 7: Commit:**

  ```sh
  git add packages/phone-core
  git commit -m "feat(phone-core): menu digit shortcuts with 3s window"
  ```

---

### Task 8: App hosting

A `type:"app"` MenuNode launches `config.apps[appId]` through `AppFactory` with an `exit()` context. While an app is active: raw key down/up events and tick deltas are delegated to it (it does its own long-press detection), its `render()` is passed straight through, the machine still emits key beeps and still honors long-press power. `exit()` returns to the containing menu; external teardown (power off, navigate away, future hold-C-from-host) calls `onExit?.()`.

**Files**

- Modify: `packages/phone-core/src/machine.ts`
- Modify: `packages/phone-core/tests/fixtures.ts`
- Test: `packages/phone-core/tests/apps.test.ts`

**Steps**

- [ ] **Step 1: Add a fake app to the fixtures.** In `packages/phone-core/tests/fixtures.ts`, replace the import block at the top with:

  ```ts
  import { createPhone } from "../src/index";
  import type {
    AppFactory,
    KeyEvent,
    MenuNode,
    Phone,
    PhoneApp,
    PhoneConfig,
    ScreenModel,
  } from "../src/index";
  ```

  and append at the end of the file:

  ```ts
  export interface FakeApp {
    factory: AppFactory;
    keys: KeyEvent[];
    ticks: number[];
    exitCount(): number;
  }

  /** Records delegated keys/ticks; exits itself when it sees a 'c' key-up. */
  export function makeFakeApp(appId = "write-message"): FakeApp {
    const keys: KeyEvent[] = [];
    const ticks: number[] = [];
    let exited = 0;
    const factory: AppFactory = (ctx) => {
      const app: PhoneApp = {
        onKey(e: KeyEvent): void {
          keys.push(e);
          if (e.type === "up" && e.key === "c") ctx.exit();
        },
        tick(dtMs: number): void {
          ticks.push(dtMs);
        },
        render(): ScreenModel {
          return {
            kind: "custom",
            appId,
            frame: { width: 84, height: 48, pixels: new Uint8Array(84 * 48) },
          };
        },
        onExit(): void {
          exited += 1;
        },
      };
      return app;
    };
    return { factory, keys, ticks, exitCount: () => exited };
  }
  ```

- [ ] **Step 2: Write the failing test** `packages/phone-core/tests/apps.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { bootedPhone, makeFakeApp } from "./fixtures";
  import type { FakeApp } from "./fixtures";
  import type { Phone } from "../src/index";

  /** Boots a phone with the fake app registered and navigates by key to Write messages. */
  function appPhone(): { fake: FakeApp; phone: Phone } {
    const fake = makeFakeApp();
    const phone = bootedPhone({ apps: { "write-message": fake.factory } });
    phone.pressKey("navi"); // carousel (Phone book)
    phone.pressKey("down"); // Messages
    phone.pressKey("navi"); // enter Messages submenu
    phone.pressKey("navi"); // launch Write messages (first child, app node)
    return { fake, phone };
  }

  describe("app hosting", () => {
    it("launching an app node updates the path and shows the app's screen", () => {
      const { phone } = appPhone();
      expect(phone.path).toBe("menu/messages/write");
      expect(phone.screen).toMatchObject({ kind: "custom", appId: "write-message" });
    });

    it("delegates raw key events and tick deltas to the app", () => {
      const { fake, phone } = appPhone();
      phone.send({ type: "down", key: "5" });
      phone.send({ type: "up", key: "5" });
      expect(fake.keys).toEqual([
        { type: "down", key: "5" },
        { type: "up", key: "5" },
      ]);
      const before = fake.ticks.length;
      phone.tick(50_000);
      phone.tick(50_016);
      expect(fake.ticks.slice(before + 1)).toEqual([16]); // dt, not absolute time
    });

    it("ctx.exit() returns to the containing menu", () => {
      const { fake, phone } = appPhone();
      phone.pressKey("c"); // fake app exits on c key-up
      expect(phone.path).toBe("menu/messages");
      expect(phone.screen).toMatchObject({ kind: "list", title: "Messages", selected: 0 });
      expect(fake.exitCount()).toBe(0); // voluntary exit does NOT call onExit
    });

    it("powering off tears the app down via onExit", () => {
      const { fake, phone } = appPhone();
      phone.pressKey("power", 1000);
      expect(fake.exitCount()).toBe(1);
      expect(phone.screen).toEqual({ kind: "off" });
    });

    it("an app node with no registered factory is a no-op", () => {
      const phone = bootedPhone(); // no apps registered
      phone.pressKey("navi");
      phone.pressKey("down");
      phone.pressKey("navi"); // Messages submenu
      phone.pressKey("navi"); // try to launch Write messages — unregistered
      expect(phone.path).toBe("menu/messages");
      expect(phone.screen).toMatchObject({ kind: "list", title: "Messages" });
    });

    it("a throwing app cannot break the machine", () => {
      const fake = makeFakeApp();
      const phone = bootedPhone({
        apps: {
          "write-message": (ctx) => {
            const inner = fake.factory(ctx);
            return {
              onKey() {
                throw new Error("boom");
              },
              tick() {
                throw new Error("boom");
              },
              render: () => inner.render(),
            };
          },
        },
      });
      phone.pressKey("navi");
      phone.pressKey("down");
      phone.pressKey("navi");
      phone.pressKey("navi"); // launch
      phone.pressKey("5"); // onKey throws — swallowed
      phone.tick(99_000); // tick throws — swallowed
      expect(phone.path).toBe("menu/messages/write");
      phone.pressKey("power", 100_000); // machine-level keys still work
      expect(phone.screen).toEqual({ kind: "off" });
    });
  });
  ```

- [ ] **Step 3: Run & expect FAIL:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 4: Add `launchApp`** to `packages/phone-core/src/machine.ts`, directly below `enterNode`:

  ```ts
  /** Launch an app node's factory; no registered factory → no-op. */
  function launchApp(m: Machine, node: AppNode): void {
    const factory = m.config.apps?.[node.appId];
    if (factory === undefined) return; // unregistered appId: stay where we are
    const stack: NavFrame[] =
      m.mode.kind === "nav" ? m.mode.stack : [{ kind: "carousel", index: 0 }];
    const app = factory({
      exit: () => {
        // Voluntary exit — must be called synchronously from onKey/tick.
        if (m.mode.kind !== "app" || m.mode.app !== app) return;
        for (const h of m.held.values()) h.longFired = true; // swallow in-flight key releases
        m.mode = { kind: "nav", stack };
        m.dirty = true;
      },
    });
    m.mode = { kind: "app", node, app, stack };
    m.dirty = true;
  }
  ```

- [ ] **Step 5: Replace `enterNode`** so app nodes launch (action nodes arrive in Task 9):

  ```ts
  /** Enter a node from the carousel or a submenu list. */
  function enterNode(m: Machine, node: MenuNode): void {
    if (m.mode.kind !== "nav") return;
    m.shortcut = null;
    switch (node.type) {
      case "submenu":
        m.mode.stack.push({ kind: "submenu", node, selected: 0 });
        m.dirty = true;
        return;
      case "list":
        m.mode.stack.push({ kind: "list", node, selected: 0 });
        m.dirty = true;
        return;
      case "reader":
        m.mode.stack.push({ kind: "reader", node, scrollTop: 0 });
        m.dirty = true;
        return;
      case "app":
        launchApp(m, node);
        return;
      case "action":
        // Action events arrive in Task 9.
        return;
    }
  }
  ```

- [ ] **Step 6: Replace `buildNavStack`** so navigated/shortcut paths ending on an app node launch it:

  ```ts
  /**
   * Build a nav stack for the resolved nodes, positioning each parent's
   * carousel index / list selection on the path (so backing out with C
   * lands on the item the user "came through").
   */
  function buildNavStack(m: Machine, nodes: MenuNode[]): void {
    exitAppIfActive(m);
    m.shortcut = null;
    const stack: NavFrame[] = [{ kind: "carousel", index: 0 }];
    let siblings: MenuNode[] = m.config.menu;
    for (const node of nodes) {
      const indexInSiblings = siblings.findIndex((n) => n.id === node.id);
      const parent = stack[stack.length - 1]!;
      if (parent.kind === "carousel") parent.index = indexInSiblings;
      else if (parent.kind === "submenu") parent.selected = indexInSiblings;
      if (node.type === "submenu") stack.push({ kind: "submenu", node, selected: 0 });
      else if (node.type === "list") stack.push({ kind: "list", node, selected: 0 });
      else if (node.type === "reader") stack.push({ kind: "reader", node, scrollTop: 0 });
      else if (node.type === "app") {
        m.mode = { kind: "nav", stack }; // the stack the app returns to
        launchApp(m, node);
        return;
      } else break; // action target: stop at the parent view with it selected
      siblings = childrenOf(node);
    }
    m.mode = { kind: "nav", stack };
    m.dirty = true;
  }
  ```

- [ ] **Step 7: Replace `handleTick`** with the final version that delegates tick deltas to the app:

  ```ts
  function handleTick(m: Machine, nowMs: number): void {
    const dtMs = Math.max(0, nowMs - m.now);
    m.now = Math.max(m.now, nowMs);
    for (const [key, h] of m.held) {
      if (!h.longFired && m.now - h.downAt >= LONG_PRESS_MS) {
        h.longFired = true;
        onLongPress(m, key);
      }
    }
    if (m.mode.kind === "boot") tickBoot(m);
    if (m.shortcut !== null && m.now >= m.shortcut.deadline) commitShortcut(m);
    if (m.mode.kind === "app") {
      try {
        m.mode.app.tick(dtMs);
      } catch {
        // apps must never throw the machine into inconsistency
      }
      m.dirty = true;
    }
  }
  ```

- [ ] **Step 8: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 9: Commit:**

  ```sh
  git add packages/phone-core
  git commit -m "feat(phone-core): app hosting via AppFactory"
  ```

---

### Task 9: Actions & event guarantees

`type:"action"` nodes emit the `action` event when selected (no navigation). Verify the event contract end-to-end: every key-down emits `sound {kind:'key', id:'beep'}` while powered on (none when off), `pathchange` fires only on actual path changes, and throwing listeners/subscribers never corrupt the machine (the wrappers already exist — these tests pin them).

**Files**

- Modify: `packages/phone-core/src/machine.ts`
- Test: `packages/phone-core/tests/events.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-core/tests/events.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { createPhone } from "../src/index";
  import { bootedPhone, testConfig } from "./fixtures";

  describe("actions & events", () => {
    it("selecting an action node emits 'action' and stays on the carousel", () => {
      const phone = bootedPhone();
      const actions: { kind: string; value: string }[] = [];
      phone.on("action", (a) => actions.push(a));
      phone.pressKey("navi");
      phone.pressKey("up"); // wraps backward to GitHub (last top-level item)
      phone.pressKey("navi");
      expect(actions).toEqual([{ kind: "href", value: "https://github.com/example" }]);
      expect(phone.path).toBe("menu");
      expect(phone.screen).toMatchObject({ kind: "menu-carousel", label: "GitHub" });
    });

    it("every key-down emits one key beep while powered on", () => {
      const phone = bootedPhone();
      const sounds: { kind: string; id: string }[] = [];
      phone.on("sound", (s) => sounds.push(s));
      phone.pressKey("navi");
      phone.pressKey("down");
      phone.pressKey("5");
      expect(sounds).toEqual([
        { kind: "key", id: "beep" },
        { kind: "key", id: "beep" },
        { kind: "key", id: "beep" },
      ]);
    });

    it("no beep while powered off", () => {
      const phone = createPhone(testConfig());
      const sounds: unknown[] = [];
      phone.on("sound", (s) => sounds.push(s));
      phone.pressKey("5");
      expect(sounds).toEqual([]);
    });

    it("pathchange fires only on actual path changes", () => {
      const phone = bootedPhone();
      const paths: string[] = [];
      phone.on("pathchange", (p) => paths.push(p));
      phone.pressKey("navi"); // standby → menu
      phone.pressKey("down"); // carousel scroll: path unchanged
      phone.pressKey("up");
      phone.pressKey("navi"); // menu → menu/phone-book
      phone.pressKey("navi"); // → menu/phone-book/search
      phone.pressKey("navi"); // open item: path unchanged (deviation note 4)
      phone.pressKey("down"); // reader scroll: path unchanged
      expect(paths).toEqual(["menu", "menu/phone-book", "menu/phone-book/search"]);
    });

    it("unsubscribing an event listener stops delivery", () => {
      const phone = bootedPhone();
      const paths: string[] = [];
      const off = phone.on("pathchange", (p) => paths.push(p));
      phone.pressKey("navi");
      off();
      phone.pressKey("navi");
      expect(paths).toEqual(["menu"]);
    });

    it("throwing listeners and subscribers never break the machine or each other", () => {
      const phone = bootedPhone();
      const seen: string[] = [];
      phone.on("pathchange", () => {
        throw new Error("boom");
      });
      phone.on("pathchange", (p) => seen.push(p));
      phone.subscribe(() => {
        throw new Error("boom");
      });
      phone.pressKey("navi");
      expect(phone.path).toBe("menu");
      expect(seen).toEqual(["menu"]);
      phone.pressKey("navi");
      expect(phone.path).toBe("menu/phone-book"); // machine still consistent
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (the action test fails — action nodes are inert): `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 3: Replace `enterNode`** in `packages/phone-core/src/machine.ts` with the final version:

  ```ts
  /** Enter a node from the carousel or a submenu list. */
  function enterNode(m: Machine, node: MenuNode): void {
    if (m.mode.kind !== "nav") return;
    m.shortcut = null;
    switch (node.type) {
      case "submenu":
        m.mode.stack.push({ kind: "submenu", node, selected: 0 });
        m.dirty = true;
        return;
      case "list":
        m.mode.stack.push({ kind: "list", node, selected: 0 });
        m.dirty = true;
        return;
      case "reader":
        m.mode.stack.push({ kind: "reader", node, scrollTop: 0 });
        m.dirty = true;
        return;
      case "app":
        launchApp(m, node);
        return;
      case "action":
        emit(m, "action", node.action); // the host opens the link; the phone stays put
        return;
    }
  }
  ```

- [ ] **Step 4: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 5: Commit:**

  ```sh
  git add packages/phone-core
  git commit -m "feat(phone-core): action and sound events with safe emission"
  ```

---

### Task 10: External control — `navigate(path)`

`navigate(path)` jumps the machine to show that path as if the user had navigated there: carousel positioned on the right top-level item, parent list selections set (this is what `buildNavStack` already does). Unknown path → standby. **Echo safety:** `navigate()` to the current path is a strict no-op and emits no `pathchange` (integration-notes §4 relies on this to terminate the router⇄phone loop). Navigating while off powers the phone on, plays the boot animation, then lands on the target ("loading /menu/games/snake boots the phone straight into Snake" — VISION); navigating while booting retargets the pending path.

**Files**

- Modify: `packages/phone-core/src/machine.ts`
- Test: `packages/phone-core/tests/navigate.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-core/tests/navigate.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { createPhone } from "../src/index";
  import { bootedPhone, makeFakeApp, testConfig } from "./fixtures";

  describe("navigate(path)", () => {
    it("jumps to a deep path with carousel and selections positioned", () => {
      const phone = bootedPhone();
      phone.navigate("menu/messages/inbox");
      expect(phone.path).toBe("menu/messages/inbox");
      expect(phone.screen).toMatchObject({ kind: "list", title: "Inbox" });
      phone.pressKey("c"); // back: Messages submenu with Inbox selected
      expect(phone.path).toBe("menu/messages");
      expect(phone.screen).toMatchObject({ kind: "list", title: "Messages", selected: 1 });
      phone.pressKey("c"); // back: carousel positioned on Messages
      expect(phone.screen).toMatchObject({
        kind: "menu-carousel",
        label: "Messages",
        menuNumber: 2,
      });
    });

    it("accepts 'menu' and 'standby' and leading/trailing slashes", () => {
      const phone = bootedPhone();
      phone.navigate("/menu/");
      expect(phone.path).toBe("menu");
      phone.navigate("standby");
      expect(phone.path).toBe("standby");
    });

    it("unknown paths fall back to standby", () => {
      const phone = bootedPhone();
      phone.navigate("menu/messages/inbox");
      phone.navigate("menu/does-not-exist");
      expect(phone.path).toBe("standby");
      phone.navigate("complete/garbage");
      expect(phone.path).toBe("standby");
    });

    it("navigating to the current path is a no-op and emits no pathchange", () => {
      const phone = bootedPhone();
      phone.navigate("menu/messages");
      const paths: string[] = [];
      phone.on("pathchange", (p) => paths.push(p));
      phone.navigate("menu/messages");
      phone.navigate("/menu/messages/"); // same after normalization
      expect(paths).toEqual([]);
      expect(phone.path).toBe("menu/messages");
    });

    it("emits exactly one pathchange when the path actually changes", () => {
      const phone = bootedPhone();
      const paths: string[] = [];
      phone.on("pathchange", (p) => paths.push(p));
      phone.navigate("menu/phone-book");
      expect(paths).toEqual(["menu/phone-book"]);
    });

    it("navigate while off powers on through boot, then lands on the target", () => {
      const phone = createPhone(testConfig({ bootMs: 1000 }));
      phone.tick(0);
      phone.navigate("menu/chat");
      expect(phone.screen.kind).toBe("boot");
      expect(phone.path).toBe("standby"); // not there yet
      const paths: string[] = [];
      phone.on("pathchange", (p) => paths.push(p));
      phone.tick(500);
      phone.tick(1000); // boot completes → land on target
      expect(phone.path).toBe("menu/chat");
      expect(paths).toEqual(["menu/chat"]);
      expect(phone.screen).toMatchObject({ kind: "reader", title: "Chat" });
    });

    it("navigate('standby') while off leaves the phone off", () => {
      const phone = createPhone(testConfig());
      phone.navigate("standby");
      expect(phone.screen).toEqual({ kind: "off" });
    });

    it("navigate while booting retargets the pending path", () => {
      const phone = createPhone(testConfig({ bootMs: 1000 }));
      phone.tick(0);
      phone.navigate("menu/chat");
      phone.navigate("menu/phone-book"); // changed our mind mid-boot
      phone.tick(1000);
      expect(phone.path).toBe("menu/phone-book");
    });

    it("navigate to an app path launches the app", () => {
      const fake = makeFakeApp();
      const phone = bootedPhone({ apps: { "write-message": fake.factory } });
      phone.navigate("menu/messages/write");
      expect(phone.path).toBe("menu/messages/write");
      expect(phone.screen).toMatchObject({ kind: "custom", appId: "write-message" });
    });

    it("navigating away from an app tears it down via onExit", () => {
      const fake = makeFakeApp();
      const phone = bootedPhone({ apps: { "write-message": fake.factory } });
      phone.navigate("menu/messages/write");
      phone.navigate("menu/chat");
      expect(fake.exitCount()).toBe(1);
      expect(phone.path).toBe("menu/chat");
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (`handleNavigate` is a stub): `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 3: Extend the paths import** in `packages/phone-core/src/machine.ts` to include `normalizePath`:

  ```ts
  import { childrenOf, normalizePath, parsePath, resolveIds } from "./paths";
  ```

- [ ] **Step 4: Replace the stub `handleNavigate`** with:

  ```ts
  /** External (router) control: show `path` as if the user had navigated there. */
  function handleNavigate(m: Machine, path: string): void {
    const target = normalizePath(path);
    if (m.mode.kind === "off") {
      if (target === "standby") return; // off already reads as 'standby'
      powerOn(m, target); // deep link: boot, then land on the target
      return;
    }
    if (m.mode.kind === "boot") {
      m.mode.targetPath = target === "standby" ? null : target;
      return;
    }
    if (target === currentPath(m)) return; // echo safety: no state change, no pathchange
    applyPath(m, target);
  }
  ```

- [ ] **Step 5: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 6: Commit:**

  ```sh
  git add packages/phone-core
  git commit -m "feat(phone-core): external navigate() control"
  ```

---

### Task 11: Multi-tap text-entry engine

A pure, immutable-state engine (no machine coupling — the editor app in Task 12 consumes it). Verified 3310 behavior (spec §6): digit cycles its letters, a 1 s pause (or a different key, or a cursor move) commits; `0` = space; `1` cycles punctuation; short `#` toggles upper/lower case; hold-digit inserts the number; hold-`0` toggles `123` mode; `C` deletes left; hold-`C` clears all; ▲/▼ move the cursor. `Abc` is sentence case: after one letter commits, the mode downshifts to `abc`.

**Files**

- Create: `packages/phone-core/src/multitap.ts`
- Modify: `packages/phone-core/src/index.ts`
- Test: `packages/phone-core/tests/multitap.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-core/tests/multitap.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import {
    clearAll,
    commitPending,
    createMultitap,
    deleteLeft,
    holdDigit,
    moveCursor,
    MULTITAP_TIMEOUT_MS,
    pressDigit,
    pressHash,
    tickMultitap,
  } from "../src/multitap";

  describe("multitap", () => {
    it("starts empty in Abc (sentence case) mode", () => {
      expect(createMultitap()).toEqual({ text: "", cursor: 0, mode: "Abc", pending: null });
    });

    it("cycles letters on repeated presses of the same key", () => {
      let s = createMultitap();
      s = pressDigit(s, "2", 0);
      expect(s.text).toBe("A");
      s = pressDigit(s, "2", 100);
      expect(s.text).toBe("B");
      s = pressDigit(s, "2", 200);
      expect(s.text).toBe("C");
      s = pressDigit(s, "2", 300);
      expect(s.text).toBe("2");
      s = pressDigit(s, "2", 400); // wraps
      expect(s.text).toBe("A");
      expect(s.cursor).toBe(1);
    });

    it("commits after the 1s timeout and downshifts out of Abc", () => {
      let s = pressDigit(createMultitap(), "4", 0); // G
      s = tickMultitap(s, MULTITAP_TIMEOUT_MS - 1);
      expect(s.pending).not.toBeNull();
      s = tickMultitap(s, MULTITAP_TIMEOUT_MS);
      expect(s.pending).toBeNull();
      expect(s.mode).toBe("abc");
      s = pressDigit(s, "4", 1100); // same key after commit starts a NEW letter
      expect(s.text).toBe("Gg");
    });

    it("a different key commits the pending letter", () => {
      let s = pressDigit(createMultitap(), "4", 0); // G
      s = pressDigit(s, "4", 100); // H
      s = pressDigit(s, "4", 200); // I
      s = pressDigit(s, "2", 300); // commit I, then lowercase a (sentence case downshift)
      expect(s.text).toBe("Ia");
    });

    it("1 cycles punctuation", () => {
      let s = pressHash(createMultitap()); // → abc
      s = pressDigit(s, "1", 0);
      expect(s.text).toBe(".");
      s = pressDigit(s, "1", 100);
      expect(s.text).toBe(",");
    });

    it("0 inserts a space; hold-0 toggles 123 mode", () => {
      let s = pressDigit(createMultitap(), "8", 0); // T
      s = pressDigit(s, "0", 100);
      expect(s.text).toBe("T ");
      s = holdDigit(s, "0");
      expect(s.mode).toBe("123");
      s = pressDigit(s, "5", 200); // digits insert directly in 123 mode
      expect(s.text).toBe("T 5");
      s = holdDigit(s, "0");
      expect(s.mode).toBe("abc");
    });

    it("hold-digit inserts the number even in letter mode", () => {
      let s = pressDigit(createMultitap(), "6", 0); // M
      s = holdDigit(s, "7");
      expect(s.text).toBe("M7");
      expect(s.pending).toBeNull();
    });

    it("# toggles upper/lower case (no-op in 123)", () => {
      let s = createMultitap(); // Abc
      s = pressHash(s);
      expect(s.mode).toBe("abc");
      s = pressDigit(s, "3", 0);
      expect(s.text).toBe("d");
      s = pressHash(s);
      expect(s.mode).toBe("Abc");
      s = holdDigit(s, "0"); // → 123
      s = pressHash(s);
      expect(s.mode).toBe("123");
    });

    it("C deletes left; hold-C clears; cursor moves commit and clamp", () => {
      let s = createMultitap();
      s = pressDigit(s, "4", 0); // "G" pending
      s = deleteLeft(s); // commits, then deletes the G
      expect(s.text).toBe("");
      expect(deleteLeft(s).text).toBe(""); // delete on empty is safe
      s = pressDigit(s, "2", 100); // downshifted to abc by the commit → "a"
      expect(s.text).toBe("a");
      s = pressDigit(s, "3", 1200); // commit a, insert d → "ad"
      s = moveCursor(s, -1);
      expect(s.cursor).toBe(1);
      s = moveCursor(s, -1);
      s = moveCursor(s, -1); // clamped at 0
      expect(s.cursor).toBe(0);
      s = pressDigit(s, "6", 1300); // insert at cursor → "mad"
      s = tickMultitap(s, 99_999);
      expect(s.text).toBe("mad");
      s = clearAll(s);
      expect(s).toMatchObject({ text: "", cursor: 0, pending: null });
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `src/multitap.ts`): `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 3: Write `packages/phone-core/src/multitap.ts`:**

  ```ts
  /**
   * Traditional multi-tap text entry (Nokia 3310 spec §6) as pure functions.
   * No timers — callers pass time in; state updates are immutable.
   */

  export type MultitapMode = "abc" | "Abc" | "123";

  export type MultitapKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

  export interface MultitapState {
    text: string;
    /** Insertion point, 0..text.length. */
    cursor: number;
    mode: MultitapMode;
    /** Letter being cycled at cursor-1, awaiting commit. */
    pending: { key: MultitapKey; index: number; deadline: number } | null;
  }

  export const MULTITAP_TIMEOUT_MS = 1000;

  /** Letters per key; '1' cycles punctuation; '0' is handled as space. */
  const TABLE: Partial<Record<MultitapKey, string>> = {
    "1": ".,'?!\"1-()@/:_",
    "2": "abc2",
    "3": "def3",
    "4": "ghi4",
    "5": "jkl5",
    "6": "mno6",
    "7": "pqrs7",
    "8": "tuv8",
    "9": "wxyz9",
  };

  export function createMultitap(): MultitapState {
    return { text: "", cursor: 0, mode: "Abc", pending: null };
  }

  function applyCase(ch: string, mode: MultitapMode): string {
    return mode === "Abc" ? ch.toUpperCase() : ch;
  }

  function insertAt(s: MultitapState, ch: string): MultitapState {
    const text = s.text.slice(0, s.cursor) + ch + s.text.slice(s.cursor);
    return { ...s, text, cursor: s.cursor + ch.length, pending: null };
  }

  /** Commit the pending letter. Sentence case: Abc downshifts to abc after one commit. */
  export function commitPending(s: MultitapState): MultitapState {
    if (s.pending === null) return s;
    const mode: MultitapMode = s.mode === "Abc" ? "abc" : s.mode;
    return { ...s, pending: null, mode };
  }

  /** Advance time; commits the pending letter once its 1s deadline passes. */
  export function tickMultitap(s: MultitapState, nowMs: number): MultitapState {
    if (s.pending !== null && nowMs >= s.pending.deadline) return commitPending(s);
    return s;
  }

  /** Short press of a digit key. */
  export function pressDigit(s: MultitapState, key: MultitapKey, nowMs: number): MultitapState {
    if (s.mode === "123") return insertAt(commitPending(s), key);
    if (key === "0") return insertAt(commitPending(s), " "); // verified: 0 = space
    const chars = TABLE[key]!;
    if (s.pending !== null && s.pending.key === key) {
      // Cycle: replace the letter at cursor-1 with the next one.
      const index = (s.pending.index + 1) % chars.length;
      const ch = applyCase(chars[index]!, s.mode);
      const text = s.text.slice(0, s.cursor - 1) + ch + s.text.slice(s.cursor);
      return { ...s, text, pending: { key, index, deadline: nowMs + MULTITAP_TIMEOUT_MS } };
    }
    const base = commitPending(s);
    const ch = applyCase(chars[0]!, base.mode);
    const text = base.text.slice(0, base.cursor) + ch + base.text.slice(base.cursor);
    return {
      ...base,
      text,
      cursor: base.cursor + 1,
      pending: { key, index: 0, deadline: nowMs + MULTITAP_TIMEOUT_MS },
    };
  }

  /** Press-and-hold a digit: insert the number itself; hold-0 toggles 123 mode. */
  export function holdDigit(s: MultitapState, key: MultitapKey): MultitapState {
    if (key === "0") {
      const base = commitPending(s);
      return { ...base, mode: base.mode === "123" ? "abc" : "123" };
    }
    return insertAt(commitPending(s), key);
  }

  /** Short '#': switch upper/lower case (verified); no-op in 123 mode. */
  export function pressHash(s: MultitapState): MultitapState {
    const base = commitPending(s);
    if (base.mode === "123") return base;
    return { ...base, mode: base.mode === "abc" ? "Abc" : "abc" };
  }

  /** 'C': delete the character left of the cursor. */
  export function deleteLeft(s: MultitapState): MultitapState {
    const base = commitPending(s);
    if (base.cursor === 0) return base;
    return {
      ...base,
      text: base.text.slice(0, base.cursor - 1) + base.text.slice(base.cursor),
      cursor: base.cursor - 1,
    };
  }

  /** Hold-'C': clear all text. */
  export function clearAll(s: MultitapState): MultitapState {
    return { ...s, text: "", cursor: 0, pending: null };
  }

  /** Scroll keys move the cursor: ▲ = left, ▼ = right (verified, manual §6). */
  export function moveCursor(s: MultitapState, dir: -1 | 1): MultitapState {
    const base = commitPending(s);
    const cursor = Math.min(base.text.length, Math.max(0, base.cursor + dir));
    return { ...base, cursor };
  }
  ```

- [ ] **Step 4: Append the multitap exports to `packages/phone-core/src/index.ts`:**

  ```ts
  export {
    clearAll,
    commitPending,
    createMultitap,
    deleteLeft,
    holdDigit,
    moveCursor,
    MULTITAP_TIMEOUT_MS,
    pressDigit,
    pressHash,
    tickMultitap,
  } from "./multitap";
  export type { MultitapKey, MultitapMode, MultitapState } from "./multitap";
  ```

- [ ] **Step 5: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 6: Commit:**

  ```sh
  git add packages/phone-core
  git commit -m "feat(phone-core): multi-tap text entry engine"
  ```

---

### Task 12: Editor app — multi-tap entry as a `PhoneApp`

`editorApp(opts): AppFactory` hosts the Task 11 engine behind the app contract (deviation note 2): it receives raw key down/up events, derives its own long presses from accumulated tick deltas, and renders the `editor` ScreenModel variant. Keys: digits multi-tap; `#` case; ▲/▼ cursor; `navi` = accept (calls `onAccept(text)`, then exits); `c` deletes left, exits when the text is empty; hold-`c` clears all; hold-digit inserts the number; hold-`0` toggles `123`. `*` (special-character picker on the real phone) is a no-op for now.

**Files**

- Create: `packages/phone-core/src/editor.ts`
- Modify: `packages/phone-core/src/index.ts`
- Test: `packages/phone-core/tests/editor.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-core/tests/editor.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { createPhone, editorApp } from "../src/index";
  import type { Phone, ScreenModel } from "../src/index";
  import { testConfig } from "./fixtures";

  function editorPhone(onAccept?: (text: string) => void): Phone {
    const phone = createPhone(
      testConfig({ apps: { "write-message": editorApp({ title: "Message:", onAccept }) } }),
    );
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.navigate("menu/messages/write");
    return phone;
  }

  function editorScreen(phone: Phone): Extract<ScreenModel, { kind: "editor" }> {
    const s = phone.screen;
    if (s.kind !== "editor") throw new Error(`expected editor screen, got ${s.kind}`);
    return s;
  }

  describe("editor app", () => {
    it("renders an empty editor in Abc mode", () => {
      const phone = editorPhone();
      expect(editorScreen(phone)).toEqual({
        kind: "editor",
        title: "Message:",
        text: "",
        cursor: 0,
        mode: "Abc",
      });
    });

    it("types via multi-tap through phone key events", () => {
      const phone = editorPhone();
      phone.pressKey("4"); // G
      phone.pressKey("4"); // cycles to H
      expect(editorScreen(phone).text).toBe("H");
      phone.tick(99_999); // 1s pause → commit (and sentence-case downshift)
      phone.pressKey("4");
      phone.pressKey("4");
      phone.pressKey("4"); // g → h → i
      expect(editorScreen(phone).text).toBe("Hi");
      expect(editorScreen(phone).mode).toBe("abc");
    });

    it("0 = space, # toggles case", () => {
      const phone = editorPhone();
      phone.pressKey("8"); // T
      phone.pressKey("0"); // space (commits)
      phone.pressKey("8"); // t (downshifted)
      expect(editorScreen(phone).text).toBe("T t");
      phone.pressKey("#");
      expect(editorScreen(phone).mode).toBe("Abc");
    });

    it("holding a digit inserts the number; hold-0 toggles 123 mode", () => {
      const phone = editorPhone();
      phone.pressKey("5", 1000);
      expect(editorScreen(phone).text).toBe("5");
      phone.pressKey("0", 1000);
      expect(editorScreen(phone).mode).toBe("123");
      phone.pressKey("7");
      expect(editorScreen(phone).text).toBe("57");
    });

    it("up/down move the cursor", () => {
      const phone = editorPhone();
      phone.pressKey("2");
      phone.tick(99_999);
      phone.pressKey("3");
      phone.tick(199_999);
      expect(editorScreen(phone)).toMatchObject({ text: "Ad", cursor: 2 });
      phone.pressKey("up");
      expect(editorScreen(phone).cursor).toBe(1);
      phone.pressKey("down");
      expect(editorScreen(phone).cursor).toBe(2);
    });

    it("C deletes; hold-C clears; C on empty exits to the containing menu", () => {
      const phone = editorPhone();
      phone.pressKey("8");
      phone.pressKey("0");
      phone.pressKey("8");
      expect(editorScreen(phone).text).toBe("T t");
      phone.pressKey("c");
      expect(editorScreen(phone).text).toBe("T ");
      phone.pressKey("c", 1000); // hold-C → clear all
      expect(editorScreen(phone).text).toBe("");
      phone.pressKey("c"); // empty → exit
      expect(phone.path).toBe("menu/messages");
    });

    it("navi accepts: onAccept gets the committed text, then the editor exits", () => {
      const accepted: string[] = [];
      const phone = editorPhone((t) => accepted.push(t));
      phone.pressKey("3"); // D (still pending)
      phone.pressKey("navi");
      expect(accepted).toEqual(["D"]);
      expect(phone.path).toBe("menu/messages");
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `editorApp` export): `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 3: Write `packages/phone-core/src/editor.ts`:**

  ```ts
  import { LONG_PRESS_MS } from "./machine";
  import {
    clearAll,
    commitPending,
    createMultitap,
    deleteLeft,
    holdDigit,
    moveCursor,
    pressDigit,
    pressHash,
    tickMultitap,
  } from "./multitap";
  import type { MultitapKey, MultitapState } from "./multitap";
  import type { AppFactory, KeyEvent, PhoneApp, PhoneKey, ScreenModel } from "./types";

  export interface EditorOptions {
    title: string;
    initial?: string;
    /** Called with the final text when the user presses the NaviKey. */
    onAccept?: (text: string) => void;
  }

  const DIGITS: ReadonlySet<PhoneKey> = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

  /**
   * A traditional multi-tap text editor hosted as a PhoneApp (the contract's
   * MenuNode union has no editor variant — wire it as {type:'app'}).
   * Time arrives only via tick(dtMs), so the app keeps its own clock.
   */
  export function editorApp(opts: EditorOptions): AppFactory {
    return (ctx) => {
      const initial = opts.initial ?? "";
      let state: MultitapState = { ...createMultitap(), text: initial, cursor: initial.length };
      let now = 0;
      let held: { key: PhoneKey; downAt: number; longFired: boolean } | null = null;

      function shortPress(key: PhoneKey): void {
        if (DIGITS.has(key)) {
          state = pressDigit(state, key as MultitapKey, now);
          return;
        }
        if (key === "#") {
          state = pressHash(state);
          return;
        }
        if (key === "up") {
          state = moveCursor(state, -1);
          return;
        }
        if (key === "down") {
          state = moveCursor(state, 1);
          return;
        }
        if (key === "c") {
          if (state.text.length === 0) {
            ctx.exit(); // backing out of an empty editor leaves it
            return;
          }
          state = deleteLeft(state);
          return;
        }
        if (key === "navi") {
          state = commitPending(state);
          opts.onAccept?.(state.text);
          ctx.exit();
        }
        // '*' (special-character picker) and 'power' are not handled here.
      }

      function longPress(key: PhoneKey): void {
        if (DIGITS.has(key)) {
          state = holdDigit(state, key as MultitapKey); // hold-digit = number, hold-0 = 123
          return;
        }
        if (key === "c") state = clearAll(state);
      }

      const app: PhoneApp = {
        onKey(e: KeyEvent): void {
          if (e.type === "down") {
            held = { key: e.key, downAt: now, longFired: false };
            return;
          }
          if (held === null || held.key !== e.key) return;
          const wasLong = held.longFired;
          held = null;
          if (!wasLong) shortPress(e.key);
        },
        tick(dtMs: number): void {
          now += dtMs;
          if (held !== null && !held.longFired && now - held.downAt >= LONG_PRESS_MS) {
            held.longFired = true;
            longPress(held.key);
          }
          state = tickMultitap(state, now);
        },
        render(): ScreenModel {
          return {
            kind: "editor",
            title: opts.title,
            text: state.text,
            cursor: state.cursor,
            mode: state.mode,
          };
        },
      };
      return app;
    };
  }
  ```

- [ ] **Step 4: Append the editor exports to `packages/phone-core/src/index.ts`:**

  ```ts
  export { editorApp } from "./editor";
  export type { EditorOptions } from "./editor";
  ```

- [ ] **Step 5: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 6: Commit:**

  ```sh
  git add packages/phone-core
  git commit -m "feat(phone-core): editor app with multi-tap entry"
  ```

---

### Task 13: `nokia3310Menu(content)` — the default menu tree

The 13 verified top-level menus in manual order (spec §5), parameterized by a typed `Nokia3310Content` so the website injects portfolio data. Submenus the VISION sitemap needs are real (Search, Inbox, Write, call-register lists, diverts, games, reminders…); deep telephony-only submenus are reader stubs. All ids are kebab-case and match the VISION route table (`menu/phone-book`, `menu/games/snake`, …).

**Files**

- Create: `packages/phone-core/src/nokia-menu.ts`
- Modify: `packages/phone-core/src/index.ts`
- Test: `packages/phone-core/tests/nokia-menu.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-core/tests/nokia-menu.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { createPhone, isValidPath, nokia3310Menu } from "../src/index";
  import type { Nokia3310Content } from "../src/index";

  function sampleContent(): Nokia3310Content {
    return {
      phonebook: [{ id: "email", label: "Email", body: "lachlan@example.com" }],
      inbox: [{ id: "intro", label: "Hello!", body: "Short intro SMS." }],
      chat: [
        { who: "them", text: "Great engineer." },
        { who: "me", text: "Thanks!" },
      ],
      missedCalls: [{ id: "one", label: "The one", body: "Got away." }],
      receivedCalls: [{ id: "acme", label: "Acme 2020", body: "Senior engineer." }],
      dialledNumbers: [{ id: "proj", label: "Project X", body: "Shipped." }],
      diverts: [{ id: "github", label: "GitHub", href: "https://github.com/example" }],
      reminders: [{ id: "now", label: "Learning", body: "three.js" }],
    };
  }

  describe("nokia3310Menu", () => {
    it("builds all 13 menus with verified labels, order and kebab-case ids", () => {
      const menu = nokia3310Menu(sampleContent());
      expect(menu.map((n) => n.label)).toEqual([
        "Phone book",
        "Messages",
        "Chat",
        "Call register",
        "Tones",
        "Settings",
        "Call divert",
        "Games",
        "Calculator",
        "Reminders",
        "Clock",
        "Profiles",
        "SIM services",
      ]);
      expect(menu.map((n) => n.id)).toEqual([
        "phone-book",
        "messages",
        "chat",
        "call-register",
        "tones",
        "settings",
        "call-divert",
        "games",
        "calculator",
        "reminders",
        "clock",
        "profiles",
        "sim-services",
      ]);
    });

    it("exposes every path the VISION sitemap needs", () => {
      const menu = nokia3310Menu(sampleContent());
      const required = [
        "menu/phone-book",
        "menu/phone-book/search",
        "menu/messages",
        "menu/messages/write",
        "menu/messages/inbox",
        "menu/chat",
        "menu/call-register/missed-calls",
        "menu/call-register/received-calls",
        "menu/call-register/dialled-numbers",
        "menu/tones",
        "menu/settings",
        "menu/call-divert",
        "menu/games",
        "menu/games/snake",
        "menu/calculator",
        "menu/reminders",
        "menu/clock",
        "menu/profiles",
        "menu/sim-services",
      ];
      for (const path of required) {
        expect(isValidPath(menu, path), path).toBe(true);
      }
    });

    it("renders the chat as a > / < conversation reader", () => {
      const menu = nokia3310Menu(sampleContent());
      const chat = menu[2]!;
      if (chat.type !== "reader") throw new Error("chat must be a reader");
      expect(chat.body).toBe("> Great engineer.\n< Thanks!");
    });

    it("call divert entries are href action nodes", () => {
      const menu = nokia3310Menu(sampleContent());
      const divert = menu[6]!;
      if (divert.type !== "submenu") throw new Error("call-divert must be a submenu");
      expect(divert.children[0]).toEqual({
        type: "action",
        id: "github",
        label: "GitHub",
        action: { kind: "href", value: "https://github.com/example" },
      });
    });

    it("games: Snake II is an app node; the other three are listed (stub readers)", () => {
      const menu = nokia3310Menu(sampleContent());
      const games = menu[7]!;
      if (games.type !== "submenu") throw new Error("games must be a submenu");
      expect(games.children[0]).toEqual({
        type: "app",
        id: "snake",
        label: "Snake II",
        appId: "snake",
      });
      expect(games.children.map((c) => c.label)).toEqual([
        "Snake II",
        "Space Impact",
        "Bantumi",
        "Pairs II",
      ]);
    });

    it("Write messages is an app node wired to 'write-message'", () => {
      const menu = nokia3310Menu(sampleContent());
      const messages = menu[1]!;
      if (messages.type !== "submenu") throw new Error("messages must be a submenu");
      expect(messages.children[0]).toEqual({
        type: "app",
        id: "write",
        label: "Write messages",
        appId: "write-message",
      });
    });

    it("drives a full phone: standby ▲ reaches the phone book name list", () => {
      const phone = createPhone({ menu: nokia3310Menu(sampleContent()), bootMs: 0 });
      phone.tick(0);
      phone.pressKey("power", 1000);
      phone.pressKey("up");
      expect(phone.path).toBe("menu/phone-book/search");
      expect(phone.screen).toMatchObject({ kind: "list", items: ["Email"] });
    });

    it("the carousel reports 13 menus", () => {
      const phone = createPhone({ menu: nokia3310Menu(sampleContent()), bootMs: 0 });
      phone.tick(0);
      phone.pressKey("power", 1000);
      phone.pressKey("navi");
      expect(phone.screen).toMatchObject({ kind: "menu-carousel", total: 13, menuNumber: 1 });
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `nokia3310Menu` export): `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 3: Write `packages/phone-core/src/nokia-menu.ts`:**

  ```ts
  import type { MenuNode } from "./types";

  /** A content entry surfaced as a list item that opens as a reader. */
  export interface ContentItem {
    id: string; // kebab-case, stable
    label: string;
    body: string;
  }

  /** One line of the Chat (Menu 3) conversation: '>' them, '<' Lachlan. */
  export interface ChatLine {
    who: "them" | "me";
    text: string;
  }

  /** A Call divert target — becomes an href action node. */
  export interface DivertTarget {
    id: string;
    label: string;
    href: string;
  }

  /** Portfolio content injected into the authentic 3310 menu tree. */
  export interface Nokia3310Content {
    /** Phone book → Search entries (contact cards). */
    phonebook: ContentItem[];
    /** Messages → Inbox ("SMS" intros). */
    inbox: ContentItem[];
    /** Messages → Outbox (optional). */
    outbox?: ContentItem[];
    /** Chat (Menu 3): testimonials as a chat session. */
    chat: ChatLine[];
    /** Call register 4-1 Missed calls ("ones that got away"). */
    missedCalls: ContentItem[];
    /** Call register 4-2 Received calls (roles held). */
    receivedCalls: ContentItem[];
    /** Call register 4-3 Dialled numbers (projects shipped). */
    dialledNumbers: ContentItem[];
    /** Tones → Ringing tone names (optional; defaults provided). */
    ringtones?: string[];
    /** Call divert → external profile links. */
    diverts: DivertTarget[];
    /** Reminders (Menu 10): the "Now" page entries. */
    reminders: ContentItem[];
    /** Clock (Menu 11) reader body — local time / availability blurb (optional). */
    clockNote?: string;
  }

  function reader(id: string, label: string, body: string): MenuNode {
    return { type: "reader", id, label, body };
  }

  /** Telephony-only submenu placeholder, kept for authentic menu shape. */
  function stub(id: string, label: string): MenuNode {
    return reader(id, label, `${label}: not available. No network connection.`);
  }

  function kebab(s: string): string {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * The verified Nokia 3310 menu tree (docs/specs/nokia-3310.md §5):
   * 13 top-level menus in manual order, portfolio content injected.
   */
  export function nokia3310Menu(content: Nokia3310Content): MenuNode[] {
    const chatBody =
      content.chat.map((l) => `${l.who === "them" ? ">" : "<"} ${l.text}`).join("\n") ||
      "No chat history.";
    const ringtones = content.ringtones ?? ["Nokia tune", "Ring ring", "Grande valse"];

    return [
      {
        type: "submenu",
        id: "phone-book",
        label: "Phone book",
        iconId: "phone-book",
        children: [
          { type: "list", id: "search", label: "Search", items: content.phonebook },
          stub("service-nos", "Service Nos."),
          stub("add-name", "Add name"),
          stub("erase", "Erase"),
          stub("edit", "Edit"),
          stub("assign-tone", "Assign tone"),
          stub("send-bcard", "Send b'card"),
          stub("options", "Options"),
          stub("speed-dials", "Speed dials"),
          stub("voice-tags", "Voice tags"),
        ],
      },
      {
        type: "submenu",
        id: "messages",
        label: "Messages",
        iconId: "messages",
        children: [
          { type: "app", id: "write", label: "Write messages", appId: "write-message" },
          { type: "list", id: "inbox", label: "Inbox", items: content.inbox },
          { type: "list", id: "outbox", label: "Outbox", items: content.outbox ?? [] },
          stub("picture-messages", "Picture messages"),
          stub("templates", "Templates"),
          stub("smileys", "Smileys"),
          stub("message-settings", "Message settings"),
          stub("info-service", "Info service"),
          stub("voice-mailbox-number", "Voice mailbox number"),
          stub("service-command-editor", "Service command editor"),
        ],
      },
      reader("chat", "Chat", chatBody),
      {
        type: "submenu",
        id: "call-register",
        label: "Call register",
        iconId: "call-register",
        children: [
          { type: "list", id: "missed-calls", label: "Missed calls", items: content.missedCalls },
          {
            type: "list",
            id: "received-calls",
            label: "Received calls",
            items: content.receivedCalls,
          },
          {
            type: "list",
            id: "dialled-numbers",
            label: "Dialled numbers",
            items: content.dialledNumbers,
          },
          stub("erase-recent-call-lists", "Erase recent call lists"),
          stub("show-call-duration", "Show call duration"),
          stub("show-call-costs", "Show call costs"),
          stub("call-cost-settings", "Call cost settings"),
          stub("prepaid-credit", "Prepaid credit"),
        ],
      },
      {
        type: "submenu",
        id: "tones",
        label: "Tones",
        iconId: "tones",
        children: [
          {
            type: "list",
            id: "ringing-tone",
            label: "Ringing tone",
            items: ringtones.map((name) => ({ id: kebab(name), label: name, body: `♪ ${name}` })),
          },
          stub("ringing-volume", "Ringing volume"),
          stub("incoming-call-alert", "Incoming call alert"),
          stub("composer", "Composer"),
          stub("message-alert-tone", "Message alert tone"),
          stub("keypad-tones", "Keypad tones"),
          stub("warning-and-game-tones", "Warning and game tones"),
          stub("vibrating-alert", "Vibrating alert"),
          stub("screen-saver", "Screen saver"),
        ],
      },
      {
        type: "submenu",
        id: "settings",
        label: "Settings",
        iconId: "settings",
        children: [
          stub("call-settings", "Call settings"),
          stub("phone-settings", "Phone settings"),
          stub("security-settings", "Security settings"),
          stub("restore-factory-settings", "Restore factory settings"),
        ],
      },
      {
        type: "submenu",
        id: "call-divert",
        label: "Call divert",
        iconId: "call-divert",
        children: [
          ...content.diverts.map(
            (d): MenuNode => ({
              type: "action",
              id: d.id,
              label: d.label,
              action: { kind: "href", value: d.href },
            }),
          ),
          stub("cancel-all-diverts", "Cancel all diverts"),
        ],
      },
      {
        type: "submenu",
        id: "games",
        label: "Games",
        iconId: "games",
        children: [
          { type: "app", id: "snake", label: "Snake II", appId: "snake" },
          stub("space-impact", "Space Impact"),
          stub("bantumi", "Bantumi"),
          stub("pairs-ii", "Pairs II"),
        ],
      },
      { type: "app", id: "calculator", label: "Calculator", appId: "calculator" },
      { type: "list", id: "reminders", label: "Reminders", items: content.reminders },
      reader("clock", "Clock", content.clockNote ?? "Clock not set."),
      {
        type: "list",
        id: "profiles",
        label: "Profiles",
        items: [
          { id: "general", label: "General", body: "Profile: General (active)." },
          { id: "silent", label: "Silent", body: "Profile: Silent." },
          { id: "discreet", label: "Discreet", body: "Profile: Discreet." },
          { id: "loud", label: "Loud", body: "Profile: Loud." },
          { id: "empty", label: "(empty)", body: "Replace with a profile you have received." },
        ],
      },
      reader(
        "sim-services",
        "SIM services",
        "SIM services: page not found. This phone accepts no SIM cards from strangers.",
      ),
    ];
  }
  ```

- [ ] **Step 4: Append the menu-builder exports to `packages/phone-core/src/index.ts`:**

  ```ts
  export { nokia3310Menu } from "./nokia-menu";
  export type { ChatLine, ContentItem, DivertTarget, Nokia3310Content } from "./nokia-menu";
  ```

- [ ] **Step 5: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-core#test`
- [ ] **Step 6: Commit:**

  ```sh
  git add packages/phone-core
  git commit -m "feat(phone-core): nokia3310Menu default tree builder"
  ```

---

### Task 14: Full-suite verification, README, plan status

**Files**

- Create: `packages/phone-core/README.md`
- Modify: `docs/plans/README.md`

**Steps**

- [ ] **Step 1: Run the full suite:** `mise exec -- vp run @hellotimber/phone-core#test` — expect **all 12 test files green** (types, paths, power, carousel, lists, shortcuts, apps, events, navigate, multitap, editor, nokia-menu).
- [ ] **Step 2: Coverage sanity:** from `packages/phone-core`, run `mise exec -- vp test run --coverage`. Expect high statement coverage on `src/` (the machine is pure logic; everything is reachable from tests). If the coverage provider is not installed in this workspace, do **not** add dependencies — note the omission in your completion report and move on.
- [ ] **Step 3: Run `mise exec -- vp check --fix`** from the repo root — expect pass.
- [ ] **Step 4: Write `packages/phone-core/README.md`** (standalone usage — rule: every package works outside this repo):

  ````md
  # @hellotimber/phone-core

  The Nokia 3310 "firmware" as a pure TypeScript state machine. **Zero runtime
  dependencies, no DOM, no timers** — time is injected through `tick(nowMs)`, which
  makes every behavior (boot animation, long presses, multi-tap timeouts, the 3-second
  menu-shortcut window) deterministic and unit-testable.

  It models: the boot/power sequence, the one-softkey menu system (carousel → lists →
  readers), `Menu`+digit shortcuts, multi-tap text entry, app hosting (games draw raw
  pixels), key sounds as events, and external `navigate(path)` control for URL sync.

  ## Usage

  ```ts
  import { createPhone, editorApp, nokia3310Menu } from "@hellotimber/phone-core";

  const phone = createPhone({
    menu: nokia3310Menu({
      phonebook: [{ id: "email", label: "Email", body: "you@example.com" }],
      inbox: [{ id: "hello", label: "Hello!", body: "Welcome to my portfolio." }],
      chat: [{ who: "them", text: "Highly recommended." }],
      missedCalls: [],
      receivedCalls: [{ id: "acme", label: "Acme 2020", body: "Senior engineer." }],
      dialledNumbers: [{ id: "site", label: "This site", body: "A Nokia 3310 portfolio." }],
      diverts: [{ id: "github", label: "GitHub", href: "https://github.com/you" }],
      reminders: [{ id: "now", label: "Now", body: "Learning three.js." }],
    }),
    apps: { "write-message": editorApp({ title: "Message:" }) },
    carrier: "LACHLAN",
    clock: () => new Date().toTimeString().slice(0, 5),
    bootMs: 3000, // 0 skips the boot animation (handy in tests)
  });

  // observe state
  const unsubscribe = phone.subscribe(({ path, screen, poweredOn }) => {
    console.log(path, screen.kind, poweredOn);
  });
  phone.on("pathchange", (path) => console.log("→", path)); // sync to a router
  phone.on("sound", (s) => console.log("play", s.kind, s.id)); // play audio in the host
  phone.on("action", (a) => console.log("open", a.value)); // open href actions

  // drive time from the host (rAF, setInterval, or a test loop)
  let t = 0;
  setInterval(() => phone.tick((t += 100)), 100);

  // press keys
  phone.pressKey("power", 1000); // hold ≈1s → boots to standby
  phone.pressKey("navi"); // open the menu carousel
  phone.pressKey("down"); // next menu (wraps around all 13)
  phone.pressKey("navi"); // select
  phone.pressKey("c"); // back one level (hold-C → standby)

  // or control it from the outside (deep links / back button)
  phone.navigate("menu/games/snake");
  console.log(phone.path, phone.screen);

  unsubscribe();
  ```

  ## Notes

  - `tick(nowMs)` takes an absolute, monotonically increasing timestamp (e.g.
    `performance.now()`); the machine never calls `Date.now()` itself.
  - `pressKey(key, holdMs)` is down + up; a `holdMs ≥ 800` advances the internal clock
    and derives a long press (power toggle, hold-C exit/clear, hold-digit numbers).
  - `navigate()` to the current path is a strict no-op and emits no `pathchange` —
    safe for router bridges with echo suppression. Unknown paths fall back to
    `standby`. Navigating while off boots the phone and lands on the target.
  - Apps (`PhoneApp` via `config.apps`) receive raw key down/up events and `tick(dtMs)`
    deltas; call `ctx.exit()` synchronously from `onKey`/`tick` to return to the menu.
  - `Bitmap` convention: one byte per pixel, row-major, `pixels.length === width * height`.
  ````

- [ ] **Step 5: Update the plan index:** in `docs/plans/README.md`, change the Status cell of the row `| 01  | [phone-core](./01-phone-core.md) | ... | not started |` from `not started` to `done`.
- [ ] **Step 6: Commit:**

  ```sh
  git add packages/phone-core/README.md docs/plans/README.md
  git commit -m "docs(phone-core): standalone usage README; mark plan 01 done"
  ```

- [ ] **Step 7: Report completion** — summarize: tasks finished, test-file/assertion counts, coverage result (or that the provider was unavailable), and any deviations encountered (there should be none beyond the "Contract deviations" notes at the top of this plan).
