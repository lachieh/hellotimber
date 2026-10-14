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
                      ▲  ▲          ▲
                      │  └──────────┤ (type-only)
                      │             │
                   ┌──┴─────────────┴──┐
                   │ nokia-os          │  stock v6.39 firmware + its pixels
                   │ (not consumed by  │  (menu, placeholders, painter, goldens,
                   │  the website yet) │   standalone demo)
                   └───────────────────┘
```

| Package                     | Responsibility                                                                                                                                                                                                  | Dependencies                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `@hellotimber/phone-core`   | The "firmware": menu tree model, navigation state machine, key handling (press/long-press), text entry, app hosting, path serialization, sound _events_                                                         | none                                                               |
| `@hellotimber/phone-screen` | Rasterizes a `ScreenModel` to an 84×48 monochrome framebuffer on a 2D canvas: pixel font, icons, status bars, boot animation                                                                                    | `phone-core` (type-only)                                           |
| `@hellotimber/phone-3d`     | The physical phone in three.js: body, keypad with pressable meshes, screen mesh textured from a provided canvas, backlight                                                                                      | peers: `react`, `three`, `@react-three/fiber`, `@react-three/drei` |
| `@hellotimber/snake`        | Snake II rules engine + pure bitmap rasterizer (`Uint8Array`), zero deps                                                                                                                                        | none                                                               |
| `@hellotimber/nokia-os`     | Strict reproduction of the stock 3310 v6.39 firmware on the phone-core kernel: stock menu, placeholder applications, stock painter, fonts/icons/boot frames derived from committed LCD goldens, standalone demo | `phone-core`, `phone-screen` (runtime: LCD toolkit)                |

The website does **not** consume `@hellotimber/nokia-os` yet (plan 13). How portfolio content
integrates with the stock OS is decided later. Until then the website keeps phone-screen's own
layout; phone-screen's painter seam lets a host swap in `paintStockScreen`.

The Nokia content graph is website-owned (`website/src/content/menu.ts`) and is composed as
one `PhoneMenu<WebMetadata>` object graph. `phone-core` owns only the generic immutable menu
model, traversal, and firmware behavior. Website metadata crosses that boundary as opaque
generic data: phone-core stores and returns it but never interprets, mutates, or recursively
freezes it. The website projects the same graph into routes, sitemap entries, SEO metadata,
and HTML panels; router loaders return plain serializable projections, never class instances.

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

export interface MenuIndicator {
  /** One-based MenuOrder values from the root to the screen being displayed. */
  segments: readonly number[];
  /** True while another 1-9 shortcut digit is being accepted (after at least one digit). */
  awaitingNext: boolean;
  /** Present only while the shortcut window is open and no digit has been accepted. */
  awaitingFirst?: true;
}

export interface StandbyIndicators {
  voicemail?: boolean;
  message?: boolean;
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
      indicators?: StandbyIndicators;
      notice?: { text: string; softkey: string }; // e.g. "1 message received" + Read
      leaving?: true; // only during PhoneConfig.menuOpenDelayMs, between Menu and the carousel
    }
  | {
      kind: "menu-carousel";
      label: string;
      menuNumber: number;
      total: number;
      iconId: string;
      iconFrame?: number; // present iff the slot's graphic has a timeline
      menuIndicator: MenuIndicator;
    }
  | {
      kind: "list";
      title: string;
      items: string[];
      selected: number;
      softkey: string;
      menuIndicator?: MenuIndicator;
      presentation?: "pages"; // present only for pages; absent = rows
      detail?: string; // selected child's current value, when the submenu's reader returns one
    }
  | {
      kind: "reader";
      title: string;
      lines: string[];
      scrollTop: number;
      menuIndicator?: MenuIndicator;
    }
  | {
      kind: "editor";
      title: string;
      text: string;
      cursor: number;
      mode: "abc" | "Abc" | "123";
      limit?: number; // countdown basis: screens render `limit - text.length` top-right
    }
  | { kind: "confirm"; text: string; softkey: string }
  | { kind: "custom"; appId: string; frame: Bitmap }; // games draw raw pixels
// boot: unchanged shape; with PhoneConfig.bootTimeline, phase is "hands" and frame = timeline frame

export class MenuSlug {
  readonly value: string;
  constructor(value: string); // kebab-case only
  toString(): string;
}

export class MenuOrder {
  readonly value: number;
  constructor(value: number); // positive integer, one-based
}

export interface TimelineStep {
  frame: number; // non-negative integer; host-defined frame index
  durationMs: number; // positive integer
}

export class Timeline {
  constructor(steps: readonly TimelineStep[], options?: { loopFrom?: number });
  readonly steps: readonly TimelineStep[];
  /** One pass, in ms; Infinity when `loopFrom` is set. */
  readonly durationMs: number;
  /** Visible frame `elapsedMs` after start. Holds the last step unless looping. */
  frameAt(elapsedMs: number): number;
}

/** How a carousel slot became visible: menu opened (standby or path), ▼, ▲, back from a deeper screen. */
export type CarouselReveal = "enter" | "next" | "previous" | "return";

export class MenuGraphic {
  constructor(
    id: string, // non-empty identifier; renderer registry key
    timeline?: Timeline, // default timeline; undefined = static graphic
    options?: { reveals?: Partial<Record<CarouselReveal, Timeline>> }, // per-reveal overrides; need a default
  );
  readonly id: string;
  readonly timeline: Timeline | undefined;
  /** The timeline played for `reveal`: its override, else `timeline`. */
  timelineFor(reveal: CarouselReveal): Timeline | undefined;
}

export type MenuPresentation = "rows" | "pages";

export interface SubmenuOptions<Metadata = unknown> {
  presentation?: MenuPresentation; // default "rows"
  /** Current-value text for a child (e.g. "Off"); undefined = none. Opaque host function. */
  detail?(child: MenuEntry<Metadata>): string | undefined; // method syntax: keeps SubmenuEntry covariant
}

export abstract class MenuEntry<Metadata = unknown> {
  readonly slug: MenuSlug;
  readonly order: MenuOrder;
  readonly label: string;
  readonly metadata: Metadata | undefined;

  abstract accept<Result>(visitor: MenuEntryVisitor<Metadata, Result>): Result;
}

export class SubmenuEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  constructor(
    slug: MenuSlug,
    order: MenuOrder,
    label: string,
    children: MenuLevel<Metadata>,
    metadata?: Metadata,
    options?: SubmenuOptions<Metadata>,
  );
  readonly children: MenuLevel<Metadata>;
  readonly presentation: MenuPresentation;
  /** The options' detail reader for `child` (re-read on every tick); undefined unless it returns a string. */
  detailOf(child: MenuEntry<Metadata>): string | undefined;
}

export class ListEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly source: MenuListSource;
}

export class ReaderEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly body: string;
}

export class ActionEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly action: { kind: "href"; value: string };
}

export class ApplicationEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly application: PhoneApplication;
}

export interface MenuEntryVisitor<Metadata, Result> {
  visitSubmenu(entry: SubmenuEntry<Metadata>): Result;
  visitList(entry: ListEntry<Metadata>): Result;
  visitReader(entry: ReaderEntry<Metadata>): Result;
  visitAction(entry: ActionEntry<Metadata>): Result;
  visitApplication(entry: ApplicationEntry<Metadata>): Result;
}

export class MenuLevel<Metadata = unknown> implements Iterable<MenuEntry<Metadata>> {
  constructor(entries: readonly MenuEntry<Metadata>[]);
  readonly entries: readonly MenuEntry<Metadata>[]; // canonical order
  bySlug(slug: string): MenuEntry<Metadata> | undefined;
  byOrder(order: number): MenuEntry<Metadata> | undefined;
}

export class TopLevelEntry<Metadata = unknown> {
  readonly entry: MenuEntry<Metadata>;
  readonly graphic: MenuGraphic;
}

export class PhoneMenu<Metadata = unknown> {
  constructor(entries: readonly TopLevelEntry<Metadata>[]);
  readonly entries: readonly TopLevelEntry<Metadata>[];
  resolve(path: string): readonly MenuEntry<Metadata>[] | null;
  paths(): readonly string[];
  isValidPath(path: string): boolean;
  walk<Result>(visitor: MenuEntryVisitor<Metadata, Result>): readonly Result[];
}

export interface MenuListItem {
  id: string;
  label: string;
  body: string;
}

export interface MenuListSource {
  read(): readonly MenuListItem[];
}

export class StaticMenuListSource implements MenuListSource {
  /* defensive copy */
}

export class DynamicMenuListSource implements MenuListSource {
  /* injected reader */
}

export type DeactivationReason = "exit" | "replace" | "navigate" | "power-off";

export abstract class PhoneApplication {
  readonly id: string; // diagnostics/custom ScreenModel identity; never a URL segment
  abstract createSession(context: ApplicationContext): PhoneApplicationSession;
}

export interface ApplicationContext {
  exit(): void;
  open(application: PhoneApplication): void;
}

export interface PhoneApplicationSession {
  onKey(event: KeyEvent): void;
  tick(dtMs: number): void;
  render(): ScreenModel;
  onDeactivate?(reason: DeactivationReason): void;
}

export interface PhoneConfig<Metadata = unknown> {
  menu: PhoneMenu<Metadata>;
  carrier?: string; // standby line, default "" (was "LACHLAN"; the website passes its own)
  clock?: () => string | undefined; // host supplies time; re-read on each tick
  bootMs?: number; // 0 skips boot; otherwise defaults to bootTimeline?.durationMs ?? 3000
  /** Finite boot animation; when set, boot length = its durationMs. */
  bootTimeline?: Timeline;
  /** Paths opened by ▲/▼ in standby; unknown/absent = no-op. */
  standbyKeys?: { up?: string; down?: string };
  /** Menu in standby: standby stays on screen with `leaving: true` this long, then the carousel opens. Default 0. */
  menuOpenDelayMs?: number;
  /** Menu+digit shortcut window, from the Menu press and after each digit. Default 3000. */
  shortcutWindowMs?: number;
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
  // Standby-scoped notice ("1 message received"): standby renders it;
  // NaviKey navigates to `path` (default: clears); C clears; null clears.
  setNotice(n: { text: string; softkey: string; path?: string } | null): void;
  readonly path: string; // e.g. 'standby', 'menu/games/snake'
  readonly screen: ScreenModel;
  subscribe(cb: (snap: PhoneSnapshot) => void): () => void;
  on<K extends keyof PhoneEventMap>(ev: K, cb: PhoneEventMap[K]): () => void;
}

export function createPhone<Metadata = unknown>(config: PhoneConfig<Metadata>): Phone;
```

The menu hierarchy is closed: consumers compose the concrete entry classes and implement
visitors, but cannot add new entry kinds. Every semantic entry has an explicit kebab-case
`MenuSlug` and one-based `MenuOrder`; order is the sole source for display position, menu
number, shortcuts, traversal, and parent-selection restoration. `MenuLevel` defensively
copies and canonically sorts entries. Construction rejects invalid or duplicate sibling
slugs/orders, non-contiguous order, empty labels/graphics, cycles, reused semantic entries,
invalid list item IDs, and application entries without a definition.

**Timelines (plan 13).** `Timeline` steps must be non-empty, each `frame` a non-negative
integer and each `durationMs` a positive integer; `loopFrom` must be in range. Timelines hold
no pixels: the kernel resolves _which_ frame is visible and the painter maps graphic id + frame
to pixels. A carousel slot whose `MenuGraphic` has a timeline exposes `iconFrame`; the machine
restarts that timeline on every reveal: `enter` (Menu from standby, `navigate("menu")` or any
path navigation that lands on the carousel), `next` (▼), `previous` (▲) and `return` (C or an
application exit back to the carousel). A graphic may supply a different timeline per reveal,
because the recorded firmware timing of one icon differs by entry key (plan 13, Task 4). The
machine emits a snapshot only when the visible frame index changes (a settled timeline stops
producing snapshots). `bootTimeline` must
be finite; combining it with a `bootMs` other than 0 or its duration throws.

**Presentation and details (plan 13).** How a submenu level is drawn is a menu-model fact:
`SubmenuEntry.presentation` is `"rows"` (default) or `"pages"` (one item per screen), and reaches
the painter as `list.presentation` (emitted only for pages). A submenu's `detail` reader returns
the _selected_ child's current-value text; `list.detail` is emitted only when it returns a
string. Host strings shown on screen (the standby clock and `detail`) are re-read on each tick
and mark the model dirty only when they change.

**Kernel policy (plan 13).** phone-core keeps no Nokia or website policy for standby ▲/▼
(`standbyKeys`, no default) or the operator line (`carrier`, default `""`). It keeps the 800 ms
long press, full signal and battery, the softkey strings and the `App error` reader, because the
stock firmware uses identical values. Two stock timings that the captures pin more tightly than
the kernel defaults are host config with website-preserving defaults: `shortcutWindowMs`
(default 3000) and `menuOpenDelayMs` (default 0; while it runs, the path is already `menu` and
the screen is the standby model with `leaving: true`, and the carousel's timeline and the
shortcut window are timed from the carousel opening and the Menu press respectively; a key
that moves the carousel opens it at once, C returns to standby).

Digit shortcuts preserve the current one-digit-per-level behavior: orders 1-9 are direct
targets, while orders 10-13 remain visible and traversable but are not direct digit targets.

`TopLevelEntry` is a presentation slot, not a path segment. It adds the required
`MenuGraphic` for each carousel position around exactly one semantic entry. Nested entries
cannot carry graphics. The renderer continues to receive the graphic ID through
`ScreenModel.iconId`.

Metadata, application definitions, list sources, and typed arrays are opaque dependencies.
Only owned topology and list snapshots are defensively copied/frozen; phone-core does not
recursively freeze host-owned values. List rows have stable IDs but no slug or menu order.
Each `read()` becomes an immutable, validated snapshot, and an open reader retains its
snapshot until the visitor backs out.

`PhoneApplication` objects are immutable, reusable definitions safe to construct at module
and SSR scope. Every launch calls `createSession()` for fresh mutable per-launch state;
definition construction performs no browser access, timers, subscriptions, fetches, storage,
random seeding, or game creation. `ApplicationEntry` refers directly to a definition object,
so `context.open(otherDefinition)` performs an in-place object handoff on the same launching
entry, path, and navigation stack without a string registry.

The machine retains the launching `ApplicationEntry`, definition, session, navigation stack,
and a unique activation token. `exit()` and `open()` verify both the active session and token,
making callbacks from stale asynchronous activations permanent no-ops. A successfully
created session is deactivated at most once with `exit`, `replace`, `navigate`, or
`power-off`. Application exceptions are contained: failed creation renders the existing
`App error` reader, while key, tick, render, and deactivation failures cannot break power or
navigation. `EditorApplication` is the reusable core multi-tap application definition and
follows the same session lifecycle.

**Path scheme:** `standby` | `menu` | `menu/<slug>/<slug>/…` — explicit entry slugs are
kebab-case and joined by `/`. Application IDs, graphics, labels, order, and metadata never
influence URLs. `navigate()` to an unknown path falls back to `standby`.

### `@hellotimber/phone-screen`

```ts
import type { ScreenModel } from "@hellotimber/phone-core"; // type-only

export interface ScreenRenderer {
  readonly canvas: HTMLCanvasElement; // 84×48 logical px, scaled by opts.scale
  render(screen: ScreenModel): void; // draw + bump version when output changes
  readonly version: number; // increments on visible change
}
/** Paints one ScreenModel into the 84×48 framebuffer. The default is the legacy renderScreen. */
export type ScreenPainter = (fb: Framebuffer, screen: ScreenModel) => void;

export type ScreenRendererOptions = {
  scale?: number; // default 1: native 84×48 — three.js NearestFilter and CSS
  // image-rendering:pixelated handle upscaling crisply
  fg?: string;
  bg?: string; // default classic green LCD palette
} & (
  | { paint?: undefined; welcomeText?: string } // legacy painter (default, unchanged);
  // welcomeText is shown during the boot "welcome" phase (the ScreenModel carries no text)
  | { paint: ScreenPainter; welcomeText?: never }
);
export function createScreenRenderer(opts?: ScreenRendererOptions): ScreenRenderer;
```

The painter seam is additive: without `paint`, output is byte-identical to the legacy renderer.
New optional ScreenModel fields (`iconFrame`, `presentation`, `detail`, `awaitingFirst`) are
ignored by the legacy painter.

### `@hellotimber/nokia-os`

```ts
import type { Phone, PhoneMenu } from "@hellotimber/phone-core";
import type { ScreenPainter } from "@hellotimber/phone-screen";

export interface StockPhoneConfig {
  /** Operator line. Every glyph must exist in the stock small font (validated; throws). */
  carrier: string;
  /** "HH:MM" for standby and Clock → Clock settings; undefined hides the standby clock. */
  clock?: () => string | undefined;
  /** Date text for Clock → Date setting, in the firmware's format as captured. */
  date?: () => string | undefined;
  /** Default "animated". "skip" = bootMs 0 (tests, reduced motion). */
  boot?: "animated" | "skip";
}

export function createStockPhone(config: StockPhoneConfig): Phone;
export const paintStockScreen: ScreenPainter;
export const stockMenu: PhoneMenu; // 12 top-level entries, level-1 children, placeholders below
/** Characters of `text` missing from a stock font; [] when renderable. */
export function missingStockGlyphs(
  text: string,
  font: "small" | "large" | "digits" | "thin",
): string[];
```

nokia-os owns the stock firmware _and its pixels_: it paints with phone-screen's `Framebuffer`,
`bitmapFromArt` and `createPixelFont`, and its fonts, icons, boot frames and status art are
generated from committed LCD golden fixtures (`packages/nokia-os/goldens/`) that an importer
derives from emulator captures of the real v6.39 firmware. Nothing from the capture corpus is
committed except those golden text grids. See `docs/plans/13-nokia-os-foundation.md`.

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
  screenBgColor?: string; // LCD fill behind/around the texture (default classic green)
  modelUrl?: string; // host-served GLB (default "/models/nokia3310-v3.glb")
  dracoPath?: string; // host-served Draco decoder dir (default "/draco/")
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

`website/src/phone/` hosts the concrete Snake `PhoneApplication`, renderer→3D props, and
the router bridge. Adapters are the only place two packages meet.

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
