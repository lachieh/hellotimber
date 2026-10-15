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

- The portfolio website simulating telephony (calls/SMS over a network) or SIM features.
  nokia-os accepts SMS through a host network port; the host owns the network.
- T9 dictionaries beyond what the UI bit needs, on the website. nokia-os ships one English T9
  dictionary built from an openly licensed word-frequency list (plan 18b); the website adopts it
  only when it adopts nokia-os.
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

| Package                     | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                   | Dependencies                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `@hellotimber/phone-core`   | The "firmware": menu tree model, navigation state machine, key handling (press/long-press), text entry, app hosting, path serialization, sound _events_                                                                                                                                                                                                                                                                                          | none                                                               |
| `@hellotimber/phone-screen` | Rasterizes a `ScreenModel` to an 84×48 monochrome framebuffer on a 2D canvas: pixel font, icons, status bars, boot animation                                                                                                                                                                                                                                                                                                                     | `phone-core` (type-only)                                           |
| `@hellotimber/phone-3d`     | The physical phone in three.js: body, keypad with pressable meshes, screen mesh textured from a provided canvas, backlight                                                                                                                                                                                                                                                                                                                       | peers: `react`, `three`, `@react-three/fiber`, `@react-three/drei` |
| `@hellotimber/snake`        | Snake II rules engine + pure bitmap rasterizer (`Uint8Array`), zero deps                                                                                                                                                                                                                                                                                                                                                                         | none                                                               |
| `@hellotimber/nokia-os`     | Strict reproduction of the stock 3310 v6.39 firmware on the phone-core kernel: stock menu, SMS through a host network port (plan 18, in progress), T9 English (open dictionary, plan 18b), placeholder applications, stock painter, fonts/icons/boot frames derived from committed LCD goldens, buzzer/tone/vibrator events from sound goldens, keyguard and display/keypad LED events on the light tick (plan 25, in progress), standalone demo | `phone-core`, `phone-screen` (runtime: LCD toolkit)                |

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
  /**
   * Plan 14, shortcutEntry only: present while a digit is awaited at a level; the digits typed
   * toward its next number ("" = none). `segments` then end at that level and the painter draws
   * `segments-typed` plus the awaiting dots without adding a selection number (`12-`, `11-0`, `1`).
   */
  typed?: string;
  /**
   * Plan 14 closeout: present for SubmenuOptions.entryIndicatorMs after Select entered the shown
   * level; `segments` are the level's own path, drawn with the awaiting mark and no selection
   * number (`5-9-` and dots).
   */
  entering?: true;
}

export interface StandbyIndicators {
  voicemail?: boolean;
  message?: boolean;
  /** Plan 17: the host's "silent" icon (stock: drawn top-left while the active profile is silent). */
  silent?: boolean;
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
      line?: string; // plan 17: PhoneConfig.standbyLine's text, present only when it returns one
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
      opening?: true; // plan 14: shortcutEntry only; a typed entry is about to open (no soft key)
    }
  | {
      kind: "list";
      title: string;
      items: string[];
      itemOrders?: number[]; // a submenu's menu numbers; present only when they are not 1..n
      selected: number;
      softkey: string;
      menuIndicator?: MenuIndicator;
      presentation?: "pages"; // present only for pages; absent = rows
      detail?: string; // selected child's current value, when the submenu's reader returns one
      windowTop?: number; // plan 14: rows levels with PhoneConfig.rowsWindow; index on the first row
      opening?: true; // plan 14: shortcutEntry only; a typed entry is about to open (no soft key)
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
  /** Softkey label on this level (plan 14). Default "Select"; must be non-empty. */
  softkey?: string;
  /**
   * The child selected when the level is entered by Select, a shortcut or a path that ends at the
   * level; re-read on every entry (plan 14). Undefined or not a child = the first child.
   */
  opening?(): MenuEntry<Metadata> | undefined; // method syntax: keeps SubmenuEntry covariant
  /**
   * Runs when the level is entered with Select, before its list (plan 14). While it runs the path
   * is the level's path; its exit() reveals the list. Paths that land on the level, and returns
   * from a child, skip it. Must not be the level's own child application.
   */
  intro?: PhoneApplication;
  /**
   * Plan 14 closeout: for this long after Select-entry the level's indicator is `entering` (its
   * own path and the awaiting mark) instead of the selection's number; any key ends it. Paths,
   * shortcuts, intros and returns from a child do not show it. Default 0; non-negative integer.
   */
  entryIndicatorMs?: number;
  /**
   * Plan 23: whether `child` is shown; re-read when the level's list is built and on every tick.
   * Hidden children are skipped by display, ▲/▼, the rail, shortcuts and `opening()`, and a path
   * that lands on one falls back to the level. A level with `shown` numbers its shown children
   * by position (1..n) instead of by MenuOrder. Default: every child shown, numbered by order.
   */
  shown?(child: MenuEntry<Metadata>): boolean; // method syntax: keeps SubmenuEntry covariant
  /**
   * Plan 17: the text `child` shows in this level's list and as its own level's title; re-read on
   * every tick (a change emits one snapshot). Undefined (or a non-string) = the child's label;
   * paths and slugs do not change. `SubmenuEntry.labelOf(child)` throws for a blank label; the
   * kernel shows the child's own label then, and when the reader throws.
   */
  label?(child: MenuEntry<Metadata>): string | undefined; // method syntax: keeps SubmenuEntry covariant
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
  readonly softkey: string; // plan 14: options.softkey ?? "Select"
  readonly intro: PhoneApplication | undefined; // plan 14
  /** The options' detail reader for `child` (re-read on every tick); undefined unless it returns a string. */
  detailOf(child: MenuEntry<Metadata>): string | undefined;
  /** Plan 14: the child selected on entry: options.opening()'s child, else the first child. */
  openingChild(): MenuEntry<Metadata> | undefined;
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

export interface ExitOptions {
  to?: "standby";
  levels?: number;
  select?: string;
  row?: "top" | "bottom"; // plan 14 closeout: where `select` lands in a rows window
}

export interface ApplicationContext {
  /**
   * Leave the application: back to the launching stack (default) or straight to standby
   * (deactivation reason `exit`; the menus are left as C-hold leaves them). Plan 14: `levels`
   * (default 1) also closes `levels - 1` enclosing submenu levels, and `select` selects that
   * child (by slug) in the level returned to, placed by `row` in a rows window (default
   * "bottom"); they are ignored with `to: "standby"`, and `row` without `select` throws. exit()
   * may be called inside createSession: the kernel returns without rendering the application.
   */
  exit(options?: ExitOptions): void;
  open(application: PhoneApplication): void;
  /**
   * Plan 14 (Task 5 deviation): the indicator for this application's position, including the
   * shortcutEntry state (`typed` while a digit is awaited), for applications that paint their own
   * indicator. Always provided by the kernel; optional so hosts may wrap contexts.
   */
  menuIndicator?(): MenuIndicator;
  /**
   * Plan 17: powers the phone off (deactivation reason `power-off`), as the power long press does.
   * Always provided by the kernel; optional so hosts may wrap contexts; stale activations no-op.
   */
  powerOff?(): void;
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
  /** Plan 18: re-read per tick; change emits one snapshot; standby includes only true fields. */
  standbyIndicators?: () => StandbyIndicators | undefined;
  /**
   * Plan 17: a second standby line under the operator, re-read on every tick with the time since
   * standby was last entered (boot end, a return from the menus or an application, a notice
   * cleared); a change emits one snapshot. An exception omits it. Default: none.
   */
  standbyLine?: (shownMs: number) => string | undefined;
  /**
   * Plan 17: opened on the power key's key-down at standby as a standby application (plan 18's
   * activation: empty stack, path `standby`, `exit()` returns to standby, `levels`/`select`/`row`
   * throw), also over a notice and when the running application's handling of that key-down
   * leaves for standby. The power long press still powers off. Elsewhere the short press does
   * nothing.
   */
  standbyPower?: PhoneApplication;
  bootMs?: number; // 0 skips boot; otherwise defaults to bootTimeline?.durationMs ?? 3000
  /** Finite boot animation; when set, boot length = its durationMs. */
  bootTimeline?: Timeline;
  /** Paths opened by ▲/▼ in standby; unknown/absent = no-op. */
  standbyKeys?: { up?: string; down?: string };
  /** Menu in standby: standby stays on screen with `leaving: true` this long, then the carousel opens. Default 0. */
  menuOpenDelayMs?: number;
  /** Menu+digit shortcut window, from the Menu press and after each digit. Default 3000. */
  shortcutWindowMs?: number;
  /** Plan 14: rows submenus keep a stateful circular window of this many rows. Default: off. */
  rowsWindow?: number; // positive integer
  /**
   * Plan 14: stock shortcut digits. Menu numbers are matched as numbers at each level (a prefix
   * of a longer number waits for shortcutWindowMs), a selected entry opens openDelayMs after its
   * digit (models carry `opening: true` meanwhile), and digits that match no number open
   * `invalid`, whose exit goes to standby. Default: off (per-digit shortcuts below).
   */
  shortcutEntry?: { openDelayMs: number; invalid: PhoneApplication };
  /** Plan 15: applications that hold the boot at offsets into it, in ascending `atMs`. */
  bootGates?: readonly BootGate[];
}

/** Plan 15: an application that may hold the boot at an offset into it. */
export interface BootGate {
  /** Offset into the boot (ms) at which the gate is asked; an integer in 0..bootMs. */
  atMs: number;
  /**
   * Called once per power-on when the boot reaches `atMs`. An application holds the boot until it
   * exits; undefined lets the boot go on.
   */
  open(): PhoneApplication | undefined;
}

/** Plan 14: the rows-window rule. `previousTop` undefined = entering the level. */
export function rowsWindowTop(
  previousTop: number | undefined,
  selected: number,
  count: number,
  rows: number,
): number;

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
  /**
   * Standby-scoped notice ("1 message received"): standby renders it; C clears it. Navi navigates
   * to `path` (default: clears), or (plan 18) runs `open` as a standby application: empty stack,
   * path stays `standby`, `menuIndicator()` has no segments, `exit()` returns to standby
   * (`levels`/`select`/`row` throw). `path` and `open` together throw. null clears.
   */
  setNotice(
    n: { text: string; softkey: string; path?: string; open?: PhoneApplication } | null,
  ): void;
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
slugs/orders, non-contiguous top-level order, empty labels/graphics, cycles, reused semantic
entries, invalid list item IDs, and application entries without a definition. A submenu level
may skip an order (plan 13): the stock firmware keeps a hidden entry's menu number, so Call
divert's visible entries are numbered 1-4 and 6. Shortcuts use the number, ▲/▼ and the position
rail use the visible position, and the list model carries `itemOrders` for such a level.

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

**Kernel policy (plan 17).** Every plan 17 seam is opt-in and generic; the website
sets none. _Standby line_: `standbyLine(shownMs)` is re-read per tick; `shownMs` restarts whenever
standby is entered (a new standby state: boot end, C, C held, an application's exit, a standby
application's exit, a cleared notice), and the line also rides on Menu's `leaving` model. _Labels_:
`SubmenuOptions.label` renames a child in its level's list and its own title without touching paths
or slugs. _Power key_: `standbyPower` opens on the power key's down at standby (the release and later
keys reach it; the long press still powers off) and `ApplicationContext.powerOff()` switches off
from any application. nokia-os uses them for profile names under the operator, stored profile
names in Profiles, and the power key's profile list; its Tones are the active profile's
Personalise settings (docs/plans/17-profiles.md).

**Kernel policy (plan 18, in progress).** Standby indicators are host readers re-read per tick.
A notice may open an application at standby with an empty navigation stack. Neither interface
contains Nokia policy. Existing hosts that omit them keep their current models. Captured SMS
arrivals do not require general interruption of applications.

Digit shortcuts preserve the current one-digit-per-level behavior: orders 1-9 are direct
targets, while orders 10-13 remain visible and traversable but are not direct digit targets.
`shortcutEntry` (plan 14, opt-in) replaces this with the stock firmware's number matching.

**Kernel policy (plan 14).** Every plan 14 addition is opt-in and generic; the website sets none,
so its models are unchanged. _Rows window_ (`rowsWindow`): with `count <= rows` the window is 0;
otherwise it keeps its position while the selection stays inside it (indices modulo `count`),
scrolls so the selection is on the bottom row when the selection moves to the item just after
the window's last row, and puts the selection on the top row for any other move outside it (▲
above it, the wrap from the first item, a jump). Entering a level puts the window at `selected`
(`count > rows`) or 0; the window survives a child opening and closing and is rebuilt when the
level is entered again. `rowsWindowTop` exports the rule. _Opening selection_: a level's
`opening()` picks the child selected on every entry (Select, shortcut, path landing). _Intro_: a
level's `intro` application runs on Select-entry before the list. _Entry indicator_: a level's
`entryIndicatorMs` shows its own path as `entering` for that long after Select-entry; the list
works meanwhile, and any key ends it (Screen saver shows `5-9-` and dots for ≈2.9 s). _Softkey_: a level's `softkey`
replaces `Select` in its list model. _Exit_: `exit({ select, row })` places the selected child in a
rows window: `row: "bottom"` (default) puts it on the bottom row (Snake II's Top score returns to
`Score IDs / Instructions / New game`); `row: "top"` rebuilds the window at it as on entry (Space
impact's and Pairs II's Top score return to `New game / Top score / Score IDs`).
_Shortcut entry_ (`shortcutEntry`): digits 0-9 form menu numbers at the level the digits apply
to (the pending entry's children while an entry is opening, else the shown level). A number that
prefixes a longer one, or is all zeros, waits; the window end resolves it (or opens `invalid`)
and the indicator keeps the typed digits until the entry opens. A number with no candidate opens
`invalid` at once. A selected entry shows in its level (`opening: true`, the entry on the top
row of a rows window; a pending parent opens implicitly) and opens `openDelayMs` later; a
submenu with an intro runs it at once, keys go to the intro, and timers wait until it ends. When
it ends, its parent shows the entry opening again, the window restarts, and an opening that
fell due meanwhile waits for the window end. The window restarts at every digit and resolve;
the window end opens an entry still pending and closes the shortcut.

**Kernel policy (plan 23).** _Shown children_ (`SubmenuOptions.shown`, opt-in, generic; the
website sets none): a level with `shown` lists, steps through, windows and shortcut-matches only
its shown children, numbered by position (1..n), with no `itemOrders`. `shown` is re-read on
every tick, and a change emits one snapshot. A selected child that becomes hidden gives way to
the first shown child, and the rows window is rebuilt at the selection. A path or an `opening()`
that lands on a hidden child falls back to the level and its first shown child. A level that
shows no child throws, naming the level. `exit({ select })` may select a child that was hidden
when the application started and is shown now (Snake II's Continue after Navi). A hidden child's
number is the position it would take among the shown ones.

**Kernel policy (plan 17 seam, added by plan 27).** _Read labels_ (`SubmenuOptions.label`, opt-in,
generic; the website sets none): a level with `label` shows each child as the reader's text in its
list and as the title of the child's own level (a submenu, list or reader), and an application
the child opens is titled by it too; `SubmenuEntry.labelOf(child)` returns it. The reader is
re-read on every tick and a change emits one snapshot; it returns undefined for the child's own
label, an empty string throws, and an exception it throws is contained (the child's label shows).
Slugs, paths and numbers do not change. nokia-os's Composer slots show their saved tones' names.

**Kernel policy (plan 15).** _Boot gates_ (`bootGates`, opt-in, generic; the website sets none,
so its models are unchanged): gates must be in ascending `atMs` (equal offsets run in order) and
each `atMs` an integer in `0..bootMs`, else `createPhone` throws. With `bootMs: 0` the gates run
in order at power-on, before standby. When the boot reaches a gate's offset the kernel calls its
`open()` once per power-on; an application it returns holds the boot. While it runs the boot
clock is paused, the screen is the application's, keys go to it, the path stays `standby`, and
`navigate()` only records the target, applied when the boot ends; the power long press still
powers off (deactivation reason `power-off`). Its `exit()` resumes the boot at `atMs` (the next
gate at the same offset first); `exit({ to: "standby" })` ends the boot at once; `levels`,
`select` and `row` throw. `open()` from the gate application replaces it in place, and
`menuIndicator()` returns no segments. An exception from the gate's `open()` or from
`createSession` skips that gate.

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
  /** Default "animated". "skip" = bootMs 0 (tests, reduced motion); still runs the security gate. */
  boot?: "animated" | "skip";
  /** Plan 15: where settings persist. Default: a fresh in-memory storage. Empty = virgin EEPROM. */
  storage?: StockStorage;
  /**
   * Plan 15: the inserted SIM card's identity. With Phone security On, power-on asks for the
   * security code when this SIM is not among the last five used. Default "sim-1"; non-empty.
   */
  sim?: string;
  /** Plan 16: the phone's buzzer, tone generator and vibrator. Default: nowhere. */
  sound?: StockSoundPort;
  /** Plan 25: the display and keypad LEDs. Default: nowhere. */
  lights?: StockLightsPort;
  /** Plan 18, in progress: SMS host port. Default: createSyntheticNetwork(). */
  network?: StockNetworkPort;
  /**
   * Plan 18b: T9 dictionaries. With `english`, Write messages starts in T9 English as the virgin
   * firmware does. Without it, T9 English is unavailable (Dictionary off, plan 18 behaviour).
   */
  t9?: { readonly english?: T9Dictionary };
}

/** Plan 18b: a T9 language dictionary (opaque; build it with `createT9Dictionary`). */
export interface T9Dictionary {
  readonly language: "english";
  /** Number of words. */
  readonly size: number;
}

/**
 * Plan 18b: a dictionary from the generated format: words in descending frequency, one per line,
 * `#<w>` lines setting the weight 2^(w/4) of the words after them. Throws on a malformed line,
 * naming it.
 */
export function createT9Dictionary(language: "english", source: string): T9Dictionary;

/** Plan 18: one SMS as the phone sees it: a typed recipient number/address and text. */
export interface StockSms {
  readonly number: string;
  readonly text: string;
}

/** Plan 18: the service centre's time stamp of an incoming SMS (local time, as the phone shows it). */
export interface StockTimestamp {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

export interface StockIncomingSms extends StockSms {
  readonly sentAt: StockTimestamp;
}

export type StockSendOutcome = "sent" | "failed";

/** Plan 18: the phone's network for SMS. The host owns delivery and outcomes; times are the phone's. */
export interface StockNetworkPort {
  /** An outgoing SMS. The phone shows `Sending message` until this settles (and its link time). */
  send(sms: StockSms): StockSendOutcome | Promise<StockSendOutcome>;
  /** Called once by `createStockPhone`; the host calls `deliver` for each incoming SMS. */
  subscribe(deliver: (sms: StockIncomingSms) => void): () => void;
}

/**
 * Plan 18: the emulator's network: every send is "sent", nothing loops back. `deliver` injects
 * an incoming SMS into every subscribed phone; `sent` lists what phones sent, in order.
 */
export function createSyntheticNetwork(): StockNetworkPort & {
  deliver(sms: StockIncomingSms): void;
  readonly sent: readonly StockSms[];
};

/**
 * Plan 16: one change of the phone's sound outputs at kernel time `atMs`. `volume` is the
 * firmware's level register as captured: buzzer, MAD2 PUP 0x1E (0-194 seen; higher is louder);
 * tone, the DSP tone-level word at 0x100A8 (e.g. 0x9108/0x9104/0x9100 for Keypad tones Level
 * 1/2/3; a lower low nibble is louder). Hosts map it to gain (loudness is not captured).
 */
export type StockSoundEvent =
  | {
      readonly output: "buzzer" | "tone";
      readonly atMs: number;
      readonly hz: number; // > 0: sounding at this frequency (buzzer: 13 MHz / divider)
      readonly volume: number;
    }
  | { readonly output: "buzzer" | "tone"; readonly atMs: number; readonly hz: null } // silent
  | { readonly output: "vibrator"; readonly atMs: number; readonly on: boolean };

/** Plan 16: where the phone's sound goes. Events arrive in `atMs` order from `tick()`. */
export interface StockSoundPort {
  change(event: StockSoundEvent): void;
}

/** Plan 25: one change of the phone's lights at kernel time `atMs`. */
export interface StockLightEvent {
  /** `display`: the LCD backlight LEDs; `keypad`: the keypad LEDs (MAD2's two LED lines). */
  readonly light: "display" | "keypad";
  readonly atMs: number;
  readonly on: boolean;
}

/** Plan 25: where the phone's lights go. Events arrive in `atMs` order from `tick()`. */
export interface StockLightsPort {
  change(event: StockLightEvent): void;
}

/** Plan 15: the phone's EEPROM, as the Web Storage subset (`window.localStorage` fits). */
export interface StockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** nokia-os writes only keys that start with this. */
export const STOCK_STORAGE_PREFIX = "nokia-os/";

/** A fresh in-memory storage (the default; tests). */
export function createMemoryStorage(): StockStorage;

/** Throws when a stored record is malformed or newer than the code, naming the storage key. */
export function createStockPhone(config: StockPhoneConfig): Phone;
export const paintStockScreen: ScreenPainter;
export const stockMenu: PhoneMenu; // the whole v6.39 tree (plan 14); application leaves without behaviour open placeholders
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

**Sound (plan 16).** nokia-os's sound goes through `StockPhoneConfig.sound`, not phone-core's
id-only `sound` event (that stays the website's contract). The phone emits every buzzer, tone
generator and vibrator change from `tick()` once kernel time reaches it, stamped with its own
`atMs`, so the output is the same at any tick rate and a host schedules each event at
`audioNow + (atMs - phoneNow) + latency`. Rules: `atMs` never exceeds the emitting tick's kernel
time and never decreases; an output's consecutive events differ; power-off silences both
outputs and stops the vibrator if they were active; a phone with no port behaves identically.
nokia-os touches no audio API. Its sound programs are generated from committed sound goldens
(event timelines of captured buzzer, tone and vibrator registers; never audio). See
`docs/plans/16-tones-and-sound.md`.

**Lights (plan 25, in progress; contract ahead of runtime).** nokia-os's LEDs go through
`StockPhoneConfig.lights`, as its sound goes through `sound`: the phone emits every change of the
display LEDs and the keypad LEDs from `tick()` once kernel time reaches it, stamped with its own
`atMs`, so the output is the same at any tick rate. The two lights are separate events although
v6.39 always switches them together (the hardware has two lines; phone-3d renders them
differently). Rules: `atMs` never exceeds the emitting tick's kernel time and never decreases; a
light's consecutive events differ; both lights are off at power-on until the boot lights them,
and power-off emits `on: false` for each light that is on; a phone with no port behaves
identically. The LEDs go off on the firmware's 1982.61 ms light tick (from power-on), at the first
tick at least 13.62 s after the last light activity. nokia-os touches no DOM or light API. The
keyguard (Menu then `*`) is nokia-os's own standby mode; phone-core does not change. See
`docs/plans/25-keyguard-and-backlight.md` and
[stock keyguard and lights](docs/specs/stock/keyguard-and-backlight.md).

**T9 (plan 18b).** The English T9 dictionary is a separate entry point,
`@hellotimber/nokia-os/t9-english` (`export const englishT9: T9Dictionary`, indexed on first
lookup), generated from the MIT-licensed IlyaSemenov/wikipedia-word-frequency list by a committed
build script (provenance and licence in `packages/nokia-os/src/text/t9/THIRD_PARTY.md`). Hosts
pass it as `StockPhoneConfig.t9.english`, typically after `await import(...)` so bundlers emit it
as its own chunk. With it the virgin phone writes in T9 English; without it nokia-os behaves as
after plan 18 (Dictionary off, English a placeholder). User words are an EEPROM record and
survive a power cycle. No firmware dictionary content is in the repository. See
`docs/plans/18b-t9-predictive-text.md` and [T9 behaviour](docs/specs/t9-behaviour.md).

**SMS network (plan 18, in progress; contract ahead of runtime).** The host supplies delivery
and outcomes. The phone uses kernel time and preserves the typed number/address and text.
Synthetic sends succeed without loopback; `deliver` broadcasts to subscribers and `sent` records
outgoing SMS in order. The phone subscribes once for its host lifetime; no disposal API exists.
Send settles after max(2662.4 ms, host settle time); receive delay is 2324.3 ms. Measured ranges
are 2574.3-2790.4 ms and 2141.3-2464.4 ms respectively, unverified on a live network.
Rejected sends count as failed; late outcomes after power-off are ignored. Off-phone deliveries
queue until standby (host policy, UNVERIFIED in the emulator). Malformed synthetic delivery
throws naming number, text or the out-of-range timestamp field. Failed-send UI is an unverified
composition, never a captured fact. The provisional per-SIM messages record has 15 shared
Inbox/Outbox slots, retains Save but not Send, and survives Restore; SIM ownership remains
inconclusive. See [stock text entry and SMS](docs/specs/stock/text-entry-and-sms.md).

Plan 18c's delivery-kind/editor/session registration requirements await owner reconciliation;
this SMS-only contract does not authorize its proposed picture/card extension.

**Profiles (plan 17).** A profile is its Personalise settings plus a name. The active
profile is a stored choice in the settings record (General when never written, and after Restore),
and Tones read and write its Personalise settings, so every audible effect follows it. The public
API is unchanged; standby shows the active profile's name and the silent icon through phone-core's
`standbyLine` and `standbyIndicators`, the Profiles level shows stored names through `label`, and the
power key's list is `standbyPower`. See [stock profiles](docs/specs/stock/profiles.md).

**Storage (plan 15).** The phone's memory is a host `StockStorage`, synchronous and written at
once on every change, as EEPROM writes are. nokia-os keeps one versioned JSON record per owner
under `STOCK_STORAGE_PREFIX` and touches no other key. Empty storage is the virgin EEPROM: the
state every golden asserts. Restore factory settings writes the factory state. See
`docs/plans/15-storage-and-settings.md`.

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
  /** The display LEDs: LCD backlight and its glow. Default true. */
  backlightOn?: boolean;
  /** Plan 25 (in progress): the keypad LEDs (legend and NaviKey glow). Default: `backlightOn`. */
  keypadLightOn?: boolean;
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

phone-3d does not know nokia-os: a host maps nokia-os's `StockLightEvent`s to `backlightOn`
(display) and `keypadLightOn` (keypad). The website passes only `backlightOn`, so its keypad
follows it (plan 25 D13).

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

`@hellotimber/snake` is the website's game only. The stock OS (`@hellotimber/nokia-os`) has its
own Snake II engine reproduced from the v6.39 captures (plan 23 D1).

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
