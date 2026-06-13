# VISION — The Nokia 3310 Portfolio

## Concept

A portfolio website that _is_ a working Nokia 3310. The visitor lands on a 3D render of
the phone (three.js / react-three-fiber). It boots like the real thing — Nokia logo,
connecting-hands animation — and drops to the standby screen. Every button works.
Navigating the phone's menus with the NaviKey, C key, and scroll keys behaves exactly
like the year-2000 firmware, except the menus contain Lachlan Heywood's portfolio:
contacts, work history, projects, an about page — and a fully playable Snake II.

The phone and the browser URL are two views of one state: scrolling into
**Menu → Phone book** on the keypad takes the browser to `/menu/phone-book`; loading
`/menu/games/snake` boots the phone straight into Snake. Deep links work, the back
button works, and every menu screen is a real, crawlable route with an HTML content
panel beside/behind the phone for readability, accessibility, and SEO.

**The bit only lands if the phone is convincing.** Authenticity — pixel layout, menu
order, key semantics, timings, sounds — is a hard requirement, specified in
`docs/specs/nokia-3310.md`.

## Goals

1. A Nokia 3310 replica good enough that someone who owned one grins within 10 seconds.
2. A real portfolio: content is reachable, readable, linkable, and indexable — the
   gimmick must never hide the information.
3. Standalone, reusable packages with hard boundaries (the 3D phone could ship to npm).
4. A codebase an inexpensive coding agent can extend by following `docs/plans/`.

## Non-goals

- Simulating telephony (calls/SMS over a network), SIM features, or T9 dictionaries
  beyond what the UI bit needs.
- Mobile-first 3D performance heroics. It should run fine on a laptop; on small
  screens the HTML panels carry the content.
- Pixel-perfect photogrammetry of the shell. Convincing > exact; the screen behavior
  is where authenticity is non-negotiable.

## The menu is the sitemap

Original 3310 menu structure, repurposed. URL = `/` + phone path. (Exact original menu
names/order are governed by `docs/specs/nokia-3310.md`; this table holds the mapping.)

All 13 original menus, in the verified order (Menu 1–13):

| #   | Phone menu    | Portfolio content                                                                                                      | Route                                                            |
| --- | ------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| —   | _(standby)_   | Landing. Operator line reads `LACHLAN`. Up = phone book, down = redial list, just like the real phone                  | `/`                                                              |
| —   | Menu          | One-item-at-a-time menu carousel with animated icons and `Menu`+digit shortcuts                                        | `/menu`                                                          |
| 1   | Phone book    | Contact: email, GitHub, LinkedIn, CV. "Search" finds entries; entries open like contact cards                          | `/menu/phone-book`                                               |
| 2   | Messages      | About me. Inbox = short "SMS" intros; Write message = real contact form with multi-tap text entry                      | `/menu/messages`, `/menu/messages/inbox`, `/menu/messages/write` |
| 3   | Chat          | Testimonials/recommendations rendered as a 3310 chat session (`>` them, `<` Lachlan)                                   | `/menu/chat`                                                     |
| 4   | Call register | Work history. Received calls = roles held; Dialled numbers = projects shipped; Missed calls = fun "ones that got away" | `/menu/call-register/…`                                          |
| 5   | Tones         | Sound settings + ringtone picker (plays through WebAudio). Composer is a **stretch** easter egg                        | `/menu/tones`                                                    |
| 6   | Settings      | Site settings dressed as phone settings: keypad tones, backlight, welcome note                                         | `/menu/settings`                                                 |
| 7   | Call divert   | "Divert" visitors to external profiles: GitHub, LinkedIn, X, etc. (literal redirects)                                  | `/menu/call-divert`                                              |
| 8   | Games         | Snake II, playable, with persistent top score (localStorage). Space Impact/Bantumi/Pairs II listed, **stretch**        | `/menu/games`, `/menu/games/snake`                               |
| 9   | Calculator    | Working 3310 calculator (`*` cycles + − × ÷, `#` decimal point)                                                        | `/menu/calculator`                                               |
| 10  | Reminders     | "Now" page — what Lachlan is currently doing/learning                                                                  | `/menu/reminders`                                                |
| 11  | Clock         | Lachlan's local time + availability; alarm/stopwatch as easter eggs                                                    | `/menu/clock`                                                    |
| 12  | Profiles      | Visitor modes (General / Recruiter / Engineer…) that re-weight content — **stretch**                                   | `/menu/profiles`                                                 |
| 13  | SIM services  | Easter egg; also serves as the 404 experience                                                                          | `/menu/sim-services`                                             |

Deep submenu state that has no content value (e.g. cursor position inside the
calculator) stays phone-internal and is not reflected in the URL.

## Architecture

A Vite+ (`vp`) pnpm monorepo. Workspaces: `website`, `packages/*`. Hard rule: packages
are independent and reusable; **only `website/` composes them**.

```
                       ┌──────────────────────────────────────────┐
                       │ website/  (TanStack Start)               │
                       │  routes ⇄ PhoneBridge ⇄ adapters         │
                       │  HTML content panels · WebAudio · SEO    │
                       └──┬───────────┬───────────┬───────────┬───┘
                          ▼           ▼           ▼           ▼
                   phone-core   phone-screen   phone-3d     snake
                   (firmware)   (rasterizer)   (R3F model)  (game logic)
```

| Package                     | Responsibility                                                                                                                                          | Dependencies                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `@hellotimber/phone-core`   | The "firmware": menu tree model, navigation state machine, key handling (press/long-press), text entry, app hosting, path serialization, sound _events_ | none                                                               |
| `@hellotimber/phone-screen` | Rasterizes a `ScreenModel` to an 84×48 monochrome framebuffer on a 2D canvas: pixel font, icons, status bars, boot animation                            | `phone-core` (type-only)                                           |
| `@hellotimber/phone-3d`     | The physical phone in three.js: body, keypad with pressable meshes, screen mesh textured from a provided canvas, backlight                              | peers: `react`, `three`, `@react-three/fiber`, `@react-three/drei` |
| `@hellotimber/snake`        | Snake II rules engine + pure bitmap rasterizer (`Uint8Array`), zero deps                                                                                | none                                                               |

**Control inversion (the key design decision):** the phone packages never import the
router. `phone-core` exposes `navigate(path)` and emits `pathchange` events;
TanStack Router and the phone are bridged _in the website_ by a small adapter that
maps URL ⇄ phone path with echo suppression. The phone is equally controllable by
Storybook, tests, or any other host.

`phone-3d` is even more decoupled: it accepts a ready-made `HTMLCanvasElement` for the
screen texture and reports physical key presses via callback. It renders whatever it is
given — it doesn't know phone-core exists.

## Public contracts

These interfaces are the seams between work streams. Plans must conform to them;
changing a contract requires updating this document first.

### `@hellotimber/phone-core`

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

/** Monochrome bitmap, row-major, ONE BYTE per pixel (pixels.length === width*height); 0 = clear, 1 = set. */
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

export function createPhone(config: PhoneConfig): Phone;
```

**Path scheme:** `standby` | `menu` | `menu/<id>/<id>/…` — node ids from the `MenuNode`
tree, kebab-case, joined by `/`. `navigate()` to an unknown path falls back to `standby`.

### `@hellotimber/phone-screen`

```ts
import type { ScreenModel } from "@hellotimber/phone-core"; // type-only

export interface ScreenRenderer {
  readonly canvas: HTMLCanvasElement; // 84×48 logical px, scaled by opts.scale
  render(screen: ScreenModel): void; // draw + bump version when output changes
  readonly version: number; // increments on visible change
}
export function createScreenRenderer(opts?: {
  scale?: number; // default 1: native 84×48 — three.js NearestFilter and CSS
  // image-rendering:pixelated handle upscaling crisply
  fg?: string;
  bg?: string; // default classic green LCD palette
  welcomeText?: string; // shown during the boot "welcome" phase (the ScreenModel carries no text)
}): ScreenRenderer;
```

### `@hellotimber/phone-3d`

```tsx
// Defines its OWN key union (same literals as phone-core's PhoneKey) — no internal dep.
export type Nokia3310Key =
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

export interface Nokia3310Props {
  screenCanvas: HTMLCanvasElement; // texture source
  screenVersion: number; // bump → texture.needsUpdate
  onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
  backlightOn?: boolean;
  pressedKeys?: ReadonlySet<Nokia3310Key>; // visually depress keys (e.g. kbd input)
}
/** The phone model; must be rendered inside an R3F <Canvas>. */
export function Nokia3310(props: Nokia3310Props): React.JSX.Element;
/** Convenience scene: Canvas + lighting + resize + subtle idle motion. */
export function PhoneStage(props: Nokia3310Props & { className?: string }): React.JSX.Element;
```

### `@hellotimber/snake`

```ts
// Same shape/encoding as phone-core's Bitmap: one byte per pixel, row-major, 0/1.
export interface Bitmap {
  width: number;
  height: number;
  pixels: Uint8Array;
}
export type SnakeInput = "up" | "down" | "left" | "right";
export interface SnakeState {
  /* grid, snake, food, bonus, score, status — single life, per the 3310 (see plan 04 for full fields) */
}
export interface SnakeGame {
  readonly state: Readonly<SnakeState>;
  dispatch(input: SnakeInput): void; // also starts an idle game / resumes a paused one
  tick(): boolean; // advance one step; false when game over
  pause(): void;
  resume(): void;
  reset(): void;
}
export function createSnake(opts?: { speed?: number; maze?: number; seed?: number }): SnakeGame;
export function renderSnakeFrame(state: SnakeState): Bitmap; // 84×48
/** Host tick cadence per level 1–9 (600 − level·55 ms). */
export function tickIntervalMs(speed: number): number;
export const MAZE_NAMES: readonly string[]; // ['No maze','Box','Tunnel','Mill','Rails','Apartment']
```

`website/src/phone/` hosts the adapters: snake→`PhoneApp`, renderer→3D props, and the
router bridge. Adapters are the only place two packages meet.

## Router integration design (website)

- The 3D scene mounts once in a pathless layout route (`routes/_phone.tsx`),
  client-only via the router's `<ClientOnly>` + `lazy()` (SSR renders the HTML panels;
  the canvas hydrates in). Route changes must never remount the canvas.
- **URL → phone:** on route change, `phone.navigate(pathFromUrl(pathname))`.
- **Phone → URL:** on `pathchange`, `router.navigate({ to: urlFromPhonePath(path) })`.
- **Echo suppression:** the bridge keeps the last path it applied in each direction and
  ignores the reflected event, so the loop terminates.
- A catch-all route under the phone layout (`routes/_phone/$.tsx`) absorbs phone-pushed
  URLs that have no dedicated route file (deep submenus like `menu/phone-book/search`),
  so navigation never 404s out of the layout and unmounts the canvas. It doubles as the
  SIM-services/404 experience.
- Keyboard input (arrows/enter/backspace/digits) maps to phone keys for desktop users;
  on-screen keys are pointer targets in 3D.
- Each route also renders its content as plain HTML in a side panel — same data source
  as the phone menu (single content module), so phone and page can never drift apart.

## Milestones

Implementation is sliced into independently shippable plans under `docs/plans/`
(see `docs/plans/README.md` for status):

1. **phone-core** — firmware state machine, fully unit-tested, no DOM.
2. **phone-screen** — rasterizer + pixel font + boot animation; visual harness page.
3. **phone-3d** — the 3D phone with a test-pattern canvas; standalone demo.
4. **snake** — Snake II engine + bitmap renderer, unit-tested.
5. **website shell** — routes, router⇄phone bridge, client-only stage, keyboard input.
6. **content & polish** — real portfolio content, sound, SEO/meta, easter eggs, deploy.

Milestones 1–4 have no cross-dependencies and can be built in parallel by separate
agents. Milestone 5 depends on 1–3; milestone 6 on 5 (snake plugs in whenever ready).

## Assumptions & open questions

Decisions made without blocking on input — flag if any is wrong:

- **Package scope** `@hellotimber/*` (repo name); packages `private` for now,
  publishable later.
- **Portfolio copy** (bio, roles, project list) isn't known yet; plans build the
  content _structure_ in `website/src/content/` with clearly-marked sample data for
  Lachlan to replace. Structure is real; words are placeholders.
- **Stretch items** (Profiles modes, ringtone composer, Space Impact/Bantumi/Pairs II)
  are designed-around but not planned in detail. Chat ships as read-only testimonials.
- **Deployment target** not chosen (old 2017 `deploy.sh` was removed with the legacy
  site); milestone 6 leaves a placeholder task.
- The menu list/order above is verified against the original user manual (doc 9357246)
  — see `docs/specs/nokia-3310.md`, including its flagged UNVERIFIED details (signal
  bar count, Snake scoring formula, font metrics). Where the spec is unverified, plans
  pick the documented best guess.
