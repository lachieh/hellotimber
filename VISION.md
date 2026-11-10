# VISION — The Nokia 3310 Portfolio

## Concept

A portfolio website built around a working Nokia 3310. The visitor lands on a 3D render of
the phone (three.js / react-three-fiber). It boots like the real thing — Nokia logo,
connecting-hands animation — and drops to the standby screen. Every button works.
Navigating the phone's menus with the NaviKey, C key, and scroll keys behaves like the
year-2000 firmware. The homepage phone runs Lachlan Heywood's own firmware: the stock look,
keys, sounds and navigation with his sections as the menu (About, Work, Writing, Now,
Contact, Chat, Games with Snake II). The strict stock v6.39 firmware runs in the Nokia
emulator experiment at `/exp/nokia-emulator` (plan 32).

The phone and the browser URL are two views of one state: entering **Work** on the phone
takes the browser to `/work`, where the page shows Work and the phone docks beside it;
loading `/snake` opens the phone at Snake II. Deep links work, the back button works, and
every section is a real, crawlable HTML page that works without the phone or JavaScript.

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

- The website owns no telephony. nokia-os's network ports carry SMS and calls to website
  adapters for LLM personas and links. The firmware owns the phone and SIM behaviour.
- Maintaining a website T9 dictionary. The website loads nokia-os's English dictionary,
  built from an openly licensed word-frequency list (plan 18b).
- Mobile-first 3D performance heroics. It should run fine on a laptop; on small
  screens the HTML panels carry the content.
- Pixel-perfect photogrammetry of the shell. Convincing > exact; the screen behavior
  is where authenticity is non-negotiable.

## The menu is the sitemap

Plan 32 defines this website contract (it supersedes plan 31's URL = `/` + stock phone path).
The homepage firmware (`website/src/home/firmware.ts`) is a hand-written tree composed with
`composeFirmware` over the stock handset; Chat and Snake II are the stock features remounted
to their places. Each top-level item is one section and one route:

| Menu | Item    | LCD                                                         | Route      | Page                                                     |
| ---- | ------- | ----------------------------------------------------------- | ---------- | -------------------------------------------------------- |
| —    | Standby | Operator `LACHLAN` and US Eastern time                      | `/`        | The spread of the highlighted item (an intro at standby) |
| 1    | About   | Reader pages                                                | `/about`   | Who Lachlan is                                           |
| 2    | Work    | A list of jobs and projects; each opens reader pages        | `/work`    | Jobs and projects with years and links                   |
| 3    | Writing | A list of posts; Select opens `/writing/<slug>`             | `/writing` | The post index                                           |
| 4    | Now     | Reader pages                                                | `/now`     | What he's doing now                                      |
| 5    | Contact | GitHub, LinkedIn, Bluesky, X (Select opens the link), Hours | `/contact` | Links, the Chat number and hours                         |
| 6    | Chat    | Stock Chat; personas answer over the SMS network port       | `/chat`    | Phone centred at real size with a key guide              |
| 7    | Games   | Stock Games with Snake II only                              | `/snake`   | Phone centred at real size with a key guide              |

The phone anywhere inside a section is on its route; standby and the carousel are `/`
(`website/src/home/routes.ts`). Old `/menu/...` URLs return 404 with no redirects (D15). The
sitemap lists exactly the routes above, then each published post.

**Content (D14).** Each section is one typed record in `website/src/content/` (`about.ts`,
`work.ts`, `writing.ts`, `now.ts`, `contact.ts`, `chat.ts`, `snake.ts`; types in
`section.ts`): a name, a one-line summary, three or four spec rows for the spread, an `lcd`
short form (reader text or a list of readers and links, checked against the stock fonts) and a
`page` long form (paragraphs, entries, lists, links). The phone and the page read the same
record, so they can't drift apart. Writing's record (`content/writing.ts`) is built from the
posts. The homepage SIM carries only the three personas in its phone book, so Chat's Search finds them.

**Around the phone (D8, D9, D11, D12).** `website/src/home/view.ts` derives what the page shows
from the route and the phone: on `/` the spread of the carousel's highlighted item; on a page
section the page, the phone docked smaller beside it; on `/chat` and `/snake` the phone
centred at real size with a key guide. A contents column of plain links to every section is
always present and works without JavaScript. The page is set as a Braun product catalogue
(`website/DESIGN.md`): the phone is the exhibit, the menu numbers number the index, and on
narrow screens a section page docks the phone as a strip that opens to full size on a tap.

**Writing (plan 32 Phase 4).** Posts are MDX files in `website/content/writing/<slug>.mdx` with
typed frontmatter (`title`, `date`, `summary`, optional `lcd` for the LCD row, `updated`,
`draft`). `website/src/writing/posts.ts` reads only the frontmatter at build time (a
`?frontmatter` import, `vite.config.ts`) and is the one list the `/writing` index, the phone's
Writing rows, `/rss.xml` and the sitemap read; drafts are left out of production builds.
`/writing/<slug>` is the reading layout (no phone; a "Back to the phone" link), its MDX compiled
by `@mdx-js/rollup` with Shiki highlighting at build time. Posts use the figure kit in
`website/src/writing/figures/` (`LiveLcd`, `StateMachine`, `KeyReplay`, `RevealScrubber`): the
real firmware, painter and reveal, loaded lazily as each figure nears the screen. The emulator's
frame links to its write-up.

Portfolio copy is sourced from Lachlan's public GitHub profile and history or supplied
directly by him; Recruiter Rachel and Y2K Support are fictional personas.

## Architecture

A Vite+ (`vp`) pnpm monorepo. Workspaces: `website`, `packages/*`. Hard rule: packages
are independent and reusable; **`website/` owns production composition; package demos may compose siblings through devDependencies**.

```
website (TanStack Start, router bridge, content, host adapters)
  ├── nokia-os (stock firmware and painter)
  │     ├── nokia-kit (UI, system and apps)
  │     ├── phone-services (shared phone state)
  │     ├── nokia-games-sdk (plan 28 shell contract)
  │     ├── phone-core (kernel and menu model)
  │     └── phone-screen (LCD toolkit)
  ├── phone-core (types and router bridge)
  ├── phone-screen (canvas renderer)
  └── phone-3d (R3F model)

nokia-kit ──▶ phone-services, phone-core, phone-screen
nokia-games ──▶ nokia-games-sdk
nokia-games-sandbox ──▶ nokia-games-sdk, ses
nokia-games-sdk ──▶ (none at runtime)
nokia-os/demo ──▶ nokia-games, nokia-games-sandbox (planned devDependencies)
phone-screen ──▶ phone-core (type-only)
snake (standalone package; unused by the website after cutover)
```

| Package                     | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Dependencies                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `@hellotimber/phone-core`   | The "firmware": menu tree model, navigation state machine, key handling (press/long-press), app hosting, path serialization, sound _events_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | none                                                                           |
| `@hellotimber/phone-screen` | LCD framebuffer, bitmap/font primitives and canvas renderer; the host supplies the painter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `phone-core` (type-only)                                                       |
| `@hellotimber/phone-3d`     | The physical phone in three.js: body, keypad with pressable meshes, screen mesh textured from a provided canvas, backlight                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | peers: `react`, `three`, `@react-three/fiber`, `@react-three/drei`             |
| `@hellotimber/snake`        | Snake II rules engine + pure bitmap rasterizer (`Uint8Array`), zero deps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | none                                                                           |
| `@hellotimber/nokia-os`     | Strict reproduction of the stock 3310 v6.39 firmware on the phone-core kernel: stock menu, SMS through a host network port (plan 18), T9 English (open dictionary, plan 18b), number entry, calls and the call register over the same port (plan 22), the SIM card port with its phone book (plan 19), clock and alerts (plan 21), SIM content and SIM services (SIM-stored SMS, sender names, the SIM Toolkit's Menu 14, IMEI, preload, screen text; plan 30), placeholder applications, stock painter, fonts/icons/boot frames derived from committed LCD goldens, buzzer/tone/vibrator events from sound goldens, keyguard and display/keypad LED events on the light tick (plan 25), standalone demo | `nokia-kit`, `phone-services`, `phone-core`, `phone-screen`, `nokia-games-sdk` |

| `@hellotimber/phone-services` | Shared SMS, chat, phone book, SIM, telephone, call log and network state | none |
| `@hellotimber/nokia-kit` | Modular Nokia UI, system and apps | `phone-services`, `phone-core`, `phone-screen` |
| `@hellotimber/nokia-games-sdk` | Plan 28: game contracts, drawing, sessions, replays and protocol | none at runtime; dev: `watr` |
| `@hellotimber/nokia-games` | Plan 28: first-party games and example user packages | `nokia-games-sdk`; dev: `watr` |
| `@hellotimber/nokia-games-sandbox` | Plan 28: browser sandbox, worker watchdog and self-test | `nokia-games-sdk`, `ses` |

The homepage creates one runtime per session (`website/src/home/runtime.ts`) running the
homepage firmware through `createFirmwarePhone`, with a SIM holding the personas, a Snake II
level preload, its own localStorage EEPROM prefix (`hellotimber.home/`, so stock-firmware state
from older visits can't reach it), the network, sound, lights, Eastern clock and build-derived
IMEI. `firmwarePainter(firmware)` draws its screens. The emulator runs the stock firmware
through the same runtime (`website/src/phone/runtime.ts`) on its own prefix. The website's
mute control sets the sound adapter's master gain; firmware settings and the light port own the
handset's sound choices and LED state.

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
  /** Plan 21: an alarm is set (or snoozed). */
  alarm?: boolean;
  /** Plan 21: a countdown runs. */
  timer?: boolean;
  /** Plan 21: the stopwatch runs. */
  stopwatch?: boolean;
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
  /**
   * Plan 22: with `to: "standby"`, the held key `key` then starts `standbyEntry` as if it had
   * gone down at standby. Throws without `to: "standby"` (and from a boot gate, an interruption
   * or a wake application); ignored when `key` is not listed.
   */
  key?: PhoneKey;
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
  /** Plan 22: an interruption (plan 21) began holding this session. Called once; errors ignored. */
  onInterrupted?(): void;
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
  /**
   * Plan 22: keys that start a standby application with themselves. At standby the key-down of a
   * listed key runs `open(key)` as a standby application (plan 18: empty stack, path `standby`,
   * `menuIndicator()` without segments, `exit()` to standby; a notice is cleared) and forwards that
   * key-down (and its up) to it. In menu levels a listed key that no open shortcut window takes
   * leaves the menus (as held C) and does the same; at the carousel so does a stock window's first
   * key that begins no menu number. Not consulted during the boot, a boot gate, an application or
   * an interruption. `keys` must not hold `navi`, `c` or `power` (throws). Default: none.
   */
  standbyEntry?: { keys: readonly PhoneKey[]; open(key: PhoneKey): PhoneApplication };
  bootMs?: number; // 0 skips boot; otherwise defaults to bootTimeline?.durationMs ?? 3000
  /** Finite boot animation; when set, boot length = its durationMs. */
  bootTimeline?: Timeline;
  /**
   * Paths (or, plan 19, applications) opened by ▲/▼ in standby; unknown/absent = no-op. An
   * application runs as a standby application (plan 18 D11 rules: empty stack, path stays
   * `standby`, `menuIndicator()` has no segments, `exit()` returns to standby, `levels`/`select`/
   * `row` throw).
   */
  standbyKeys?: { up?: string | PhoneApplication; down?: string | PhoneApplication };
  /**
   * Plan 19: after a standby key, standby stays on screen with `leaving: true` this long before
   * its target opens (as `menuOpenDelayMs` for Menu); a key meanwhile opens the target at once
   * and goes to it. Default 0; non-negative integer.
   */
  standbyKeyDelayMs?: number;
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
  /**
   * Plan 21: polled on every tick while the phone is on and not booting. An application it
   * returns interrupts whatever is shown: the interrupted mode is held (no keys, no ticks), the
   * path is unchanged, navigate() is recorded and applied after it. Its exit() restores the held
   * mode; exit({ to: "standby" }) deactivates the held mode (reason `navigate`) and shows standby;
   * levels/select/row throw. Default: none.
   */
  interruption?: () => PhoneApplication | undefined;
  /**
   * Plan 21: polled on every tick while the phone is off. An application it returns powers the
   * phone on without the boot (empty stack, path `standby`); its exit() powers the phone off
   * again; exit({ to: "standby" }) runs the normal power-on (boot and gates). Default: none.
   */
  wake?: () => PhoneApplication | undefined;
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
slugs/orders, empty labels/graphics, cycles, reused semantic entries, invalid list item IDs,
and application entries without a definition. Any level may skip an order (plan 13): the stock
firmware keeps a hidden entry's menu number, so Call divert's visible entries are numbered 1-4
and 6, and SIM services is Menu 14 in the carousel's 13th slot (plan 30; the carousel model then
carries the slot's `position`). Shortcuts use the number, ▲/▼ and the position
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
**Kernel policy (plan 21).** Two opt-in, Nokia-agnostic seams poll host functions, as
`bootGates` and `standbyIndicators` do. `interruption` runs an application above whatever is
shown, holding the interrupted mode untouched (one at a time; never during the boot, a boot gate
or a wake activation); plan 22's incoming call reuses it. `wake` lets a powered-off phone run an
application without the boot. nokia-os decides when to use them: its alerts (alarm, countdown,
reminders) wait for standby (the v6.39 firmware shows none over a menu, a note, an editor or a
game) and its alarm wakes a switched-off phone. Configs without them produce identical models.
`SubmenuOptions.label` (plan 17 D8) lets a level relabel a child per tick (Show clock).

**Kernel policy (plan 19).** A standby key may open an application, run as a standby
application like a notice's, after an optional leaving delay (`standbyKeyDelayMs`) during which
standby shows `leaving: true`; a key in the delay opens the target at once and goes to it. Both
are opt-in and carry no Nokia labels or timings; the website sets neither. A key held when an
application exits keeps its long press (C held from a screen that leaves at C's down reaches
standby) while its release is swallowed.

**Kernel policy (plan 22).** Both plan 22 seams are opt-in and generic; the website
sets none. _Standby entry_: `standbyEntry` starts a standby application with the key that opened
it (the stock number entry types its first digit and sounds its DTMF while the key is held);
applications hand a held key over with `exit({ to: "standby", key })` (a note or option list that
a digit leaves for the entry). _Interrupted sessions_: plan 21's interruptions call the held
session's `onInterrupted()` once (Snake II suspends its game for a call). nokia-os's calls use plan
21's interruption seam; phone-core has no telephony concept.

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
navigation. Stock text entry belongs to nokia-os.

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
/** Paints one ScreenModel into the 84×48 framebuffer. The host supplies the painter. */
export type ScreenPainter = (fb: Framebuffer, screen: ScreenModel) => void;

export type ScreenRendererOptions = {
  scale?: number; // default 1: native 84×48 — three.js NearestFilter and CSS
  // image-rendering:pixelated handle upscaling crisply
  fg?: string;
  bg?: string; // default classic green LCD palette
  paint: ScreenPainter;
};
export function createScreenRenderer(opts: ScreenRendererOptions): ScreenRenderer;
```

The toolkit has no built-in screen layouts. nokia-os supplies stock pixels; the website
passes its painter to the canvas renderer.

### `@hellotimber/nokia-os`

```ts
import type { Phone, PhoneMenu, ScreenModel } from "@hellotimber/phone-core";
import type { ScreenPainter } from "@hellotimber/phone-screen";

export interface StockPhoneConfig {
  /** Operator line. Every glyph must exist in the stock small font (validated; throws). */
  carrier: string;
  /**
   * The phone's real-time clock: "HH:MM", 24-hour, re-read on every tick (plan 21: validated;
   * any other value counts as no time). The phone shows this plus its own offset (Clock settings,
   * Date setting) and fires alarms and reminders on its minute changes.
   */
  clock?: () => string | undefined;
  /** The RTC's date: "DD.MM.YYYY" (plan 21: validated like `clock`). */
  date?: () => string | undefined;
  /** Default "animated". "skip" = bootMs 0 (tests, reduced motion); still runs the security gate. */
  boot?: "animated" | "skip";
  /** Plan 15: where settings persist. Default: a fresh in-memory storage. Empty = virgin EEPROM. */
  storage?: StockStorage;
  /**
   * Plan 15: the inserted SIM card's identity (with Phone security On, power-on asks for the
   * security code when this SIM is not among the last five used), or (plan 19) the whole SIM card.
   * Default "sim-1": the emulator SIM (50 locations, 16-character names, empty).
   */
  sim?: string | StockSimCard;
  /** Plan 16: the phone's buzzer, tone generator and vibrator. Default: nowhere. */
  sound?: StockSoundPort;
  /** Plan 25: the display and keypad LEDs. Default: nowhere. */
  lights?: StockLightsPort;
  /** Plan 18: SMS host port; plan 22: calls too. Default: createSyntheticNetwork(). */
  network?: StockNetworkPort;
  /**
   * Plan 18b: T9 dictionaries. With `english`, Write messages starts in T9 English as the virgin
   * firmware does. Without it, T9 English is unavailable (Dictionary off, plan 18 behaviour).
   */
  t9?: { readonly english?: T9Dictionary };
  /** Plan 30: 15 digits, Luhn-valid (throws otherwise). `*#06#` shows it. Default: none. */
  imei?: string;
  /** Plan 30: phone-memory content written once, only where its record does not exist. */
  preload?: {
    readonly welcomeNote?: string;
    readonly reminders?: readonly StockReminderPreload[]; // plan 21's reminders, added in order
  };
}

/** Plan 30: a reminder as the user could have typed it. */
export interface StockReminderPreload {
  readonly text: string;
  readonly alarm?: { readonly date: string; readonly time: string }; // "DD.MM.YYYY", "HH:MM"
}

/** Plan 19: one SIM phone book entry or service number. */
export interface StockContact {
  /** Within the SIM's name length; every glyph in the small and large faces; "" = no name. */
  readonly name: string;
  /** 0-20 of `0-9 * # p` after an optional `+` (a SIM cannot hold `w`); "" = no number. */
  readonly number: string;
}

/** Plan 19: the inserted SIM card. Plan 15's string `sim` is `{ id }` with these defaults. */
export interface StockSimCard {
  /** Identity (plan 15: Phone security's recent SIMs; plan 18: messages). Non-empty. */
  readonly id: string;
  readonly phoneBook?: {
    readonly locations?: number; // default 50 (the emulator SIM)
    readonly nameLength?: number; // default 16
    /** Initial entries by location (index 0 = location 1); null = a free location. */
    readonly entries?: readonly (StockContact | null)[];
  };
  /** The SIM's service numbers (Service Nos.), in SIM order. Default none. */
  readonly serviceNumbers?: readonly StockContact[];
  /** Plan 30: `EF_SMS`: 15 slots by default; entries by slot (index 0 = slot 1), null = free. */
  readonly messages?: {
    readonly slots?: number;
    readonly entries?: readonly (StockSimMessage | null)[];
  };
  /** Plan 30: the SIM Toolkit menu (`SET UP MENU`). Default none: no Menu 14. */
  readonly toolkit?: StockSimToolkit;
}

/** Plan 30: one received SMS stored on the SIM. */
export interface StockSimMessage {
  readonly number: string; // `+` and 1-20 digits
  /** GSM 7-bit (extension table counts two), ≤ 160 septets, drawable; `[ ] { } ~ | ^` show `?`. */
  readonly text: string;
  readonly sentAt: StockTimestamp;
  readonly read?: boolean; // default true
  readonly centre?: string; // Details' Message centre; default ""
}

/** Plan 30: what the SIM applet does when an item is chosen. */
export type StockToolkitStep =
  | { readonly kind: "text"; readonly text: string; readonly clear?: "user" | "delay" }
  | {
      readonly kind: "select";
      readonly title?: string;
      readonly items: readonly StockToolkitItem[];
    }
  | { readonly kind: "call"; readonly number: string; readonly confirm?: string };

export interface StockToolkitItem {
  readonly id: string; // kebab-case, unique among siblings; top level: `menu/sim-services/<id>`
  readonly label: string;
  readonly steps: readonly StockToolkitStep[];
}

/** Plan 30: the SIM's toolkit menu; `title` is Menu 14's carousel label. */
export interface StockSimToolkit {
  readonly title: string;
  readonly items: readonly StockToolkitItem[];
}

/** Plan 19: a business card as Send b'card sends it. */
export interface StockBusinessCard {
  readonly to: string; // the number typed at `Phone number:`
  readonly card: StockContact;
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
  /** Plan 19: Send b'card. Absent = settled "sent" after the phone's link time. */
  sendBusinessCard?(card: StockBusinessCard): StockSendOutcome | Promise<StockSendOutcome>;
  /**
   * Plan 22: the phone places a call (Calling is on screen). Absent: the synthetic network's
   * behaviour. The host reports the call's progress on `phone`; the returned link hears the user.
   */
  dial?(call: StockOutgoingCall, phone: StockCallControl): StockCallLink;
  /** Plan 22: called once by createStockPhone; the host calls `ring` for each incoming call. */
  subscribeCalls?(
    ring: (call: StockIncomingCall, link: StockCallLink) => StockCallControl,
  ): () => void;
}

/** Plan 22: an outgoing call as the phone places it, at the moment Calling appears. */
export interface StockOutgoingCall {
  /** The number dialled: the entry cut at a later `+` or the first `p`/`w`. */
  readonly number: string;
  /** The phone book name saved for the number, when the phone book knows one. */
  readonly name?: string;
  /** `112` and the like: `Attempting emergency call`. */
  readonly emergency: boolean;
}

/** Plan 22: an incoming call as the network presents it (digits; a leading `+` is dropped). */
export interface StockIncomingCall {
  readonly number: string;
}

/** Plan 22: the host's side of one call; the phone calls these, each at most once. */
export interface StockCallLink {
  /** Incoming calls only: the user answered. */
  answer(): void;
  /** The user ended the call, or rejected it while it rang (End, C, power-off). */
  hangUp(): void;
}

/** Plan 22: the phone's side of one call; the host calls these, applied at the phone's next tick. */
export interface StockCallControl {
  /** Outgoing: the far end is ringing (`Call 1`, the ringback). */
  alerting(): void;
  /** The speech channel connected (the ringback stops, the duration starts). */
  connected(): void;
  /**
   * The far end or the network ended the call, or refused it before it alerted: the phone shows
   * its network end (the checkered `Call 1`, three beeps) and returns to standby; an incoming
   * call released before Answer is a missed call.
   */
  released(): void;
}

/**
 * Plan 18: the emulator's network: every send is "sent", nothing loops back. `deliver` injects
 * an incoming SMS into every subscribed phone; `sent` lists what phones sent, in order. Plan 22:
 * every dialled call alerts and connects at once and lasts until the phone or `ring`'s handle
 * ends it; `ring(number)` rings every subscribed phone; `dialled` lists what phones dialled.
 */
export function createSyntheticNetwork(): StockNetworkPort & {
  deliver(sms: StockIncomingSms): void;
  readonly sent: readonly StockSms[];
  ring(number: string): { hangUp(): void; readonly state: "ringing" | "connected" | "ended" };
  readonly dialled: readonly StockOutgoingCall[];
  /** Plan 19: the business cards phones sent, in order. */
  readonly cards: readonly StockBusinessCard[];
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
      /** Plan 22: the tone generator's second oscillator (DTMF); absent for single tones. */
      readonly hz2?: number;
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
/** Plan 30: the stock menu for a SIM: `stockMenu`, plus Menu 14 when it has a toolkit. Validates. */
export function stockMenuFor(sim: string | StockSimCard): PhoneMenu;
/** Plan 30: plain-text description of any screen a stock phone emits (accessibility, QA). */
export function describeStockScreen(screen: ScreenModel): string;
/** Plan 30: `*#06#`'s two digit lines for a valid IMEI. */
export function stockImeiLines(imei: string): readonly [string, string];
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
id-only `sound` event. The website mounts the stock sound port. The phone emits every buzzer, tone
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
`@hellotimber/nokia-kit/t9-english` (`export const englishT9: T9Dictionary`, indexed on first
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

**SIM card (plan 19).** The host's `sim` is the inserted card: a string is the
emulator SIM under that identity; a `StockSimCard` adds its phone book (locations, name length,
initial entries by location) and service numbers, and is the contacts seam a portfolio
integration uses. `createStockPhone` throws for an invalid card (an empty id, `locations` or
`nameLength` below 1, more entries than locations, an invalid entry), naming the field and the
location. The phone keeps each SIM's locations in its `phone-book` EEPROM record under the SIM's
identity once it first writes them; until then the host's entries are the SIM's contents. Speed
dials and assigned ringing tones are phone memory kept per SIM identity; Restore factory settings
keeps all of it. Send b'card goes through the network port's optional `sendBusinessCard`, with
plan 18's send rules (link time 3240 ms). See [stock phone book](docs/specs/stock/phone-book.md).

**SIM content and SIM services (plan 30).** A host supplies content where a 2000
phone kept it, and nowhere else:

| Content                                  | Where a 3310 keeps it           | nokia-os                                    |
| ---------------------------------------- | ------------------------------- | ------------------------------------------- |
| contacts, service numbers                | SIM `EF_ADN`, `EF_SDN`          | `StockSimCard.phoneBook`, `.serviceNumbers` |
| received SMS                             | SIM `EF_SMS`                    | `StockSimCard.messages`                     |
| SIM services menu and screens            | the SIM's toolkit applet        | `StockSimCard.toolkit`                      |
| IMEI                                     | the phone                       | `StockPhoneConfig.imei`                     |
| Welcome note, Reminders                  | phone memory, typed by the user | `StockPhoneConfig.preload`, applied once    |
| missed/received calls, durations, alarms | phone memory, made by events    | none: a host plays the events               |

SIM messages are the Inbox (unread first, then read, each in slot order) until the phone first
writes that SIM's messages (a read, an erase, an arrival), then the `messages` record's copy, as
plan 19's phone book; capacity is the SIM's `slots`. Senders in the phone book are named (last 9
digits match). A toolkit adds Menu 14 (`menu/sim-services`, one path per top-level item) whose
label is the toolkit's title; its items run text pages, lists and calls the phone confirms; a
confirmed call goes through plan 22's dial (a placeholder until plan 22 lands), inside the
confirming key's `send()` so a browser host keeps the user activation. Every host string is
validated when the phone (or `stockMenuFor`) is created, naming the field path. `preload` writes
the Welcome note only while storage has no settings record, and the reminders only while it has
no reminders record. `describeStockScreen` reads every
screen as plain text (stock widgets attach their text to their frames). See
[stock SIM services](docs/specs/stock/sim-services.md).

Incoming delivery remains text SMS only; picture/card delivery is still unimplemented.

**Composer transmission (plan 18c).** The optional `StockNetworkPort.sendRingtone({ to, tone })`
transmits a named `ComposerTone` (name, tempo and notation tokens). The host owns encoding and
transport. An absent callback settles as sent, matching the synthetic cell; rejection settles
as failed and power-off drops the pending result. `createSyntheticNetwork().tones` records
snapshots of outgoing tones. This additive callback preserves existing text-SMS hosts.

**Chat and Messages content (plan 18c, in progress).** Templates, Smileys
and Info service topics are EEPROM records (`templates`, `smileys`, `info-topics`): the virgin
EEPROM has no Templates or Smileys list and five junk topics; Restore factory settings provisions
the lists (eight slots, the firmware's five defaults each) and empties the topics. Chat sends each
line through the network port's `send` as `<name>: <text>`; an SMS delivered from the chat's
number while Chat runs is the partner's line (shown in the history, not stored in Inbox), so a
host that answers chat numbers (the website's LLM contacts) implements only `StockNetworkPort`.
Picture messages, the screen-saver gallery and business-card receipt are not implemented (no
verified v6.39 captures; the picture/card port extension stays unauthorized). See
[stock chat and content](docs/specs/stock/chat-and-content.md).

**Calls (plan 22).** nokia-os simulates no network: calls go through
`StockNetworkPort.dial` and `subscribeCalls`, and the host owns what a call does. Each call is a
pair of narrow objects, the phone's `StockCallControl` and the host's `StockCallLink`. The phone
applies host events at its next tick, after its own link times (alerting ≥ 2200 ms after Calling
shows, a ring's screen ≈1870 ms after `ring`), and keeps durations and the call lists itself.
`dial(call, phone)` is called the moment Calling shows, with the number dialled and, when the
phone book knows it, its name (`StockOutgoingCall`); `phone.released()` before `alerting()`
refuses the call with the network's end, so a host can open a portfolio link for a number and end
the call (nokia-os README "Calls"). Rules: a host
event for a call that has ended is ignored; `alerting` after `connected` is ignored; a ring while
the phone is off or booting is released at once; a ring during a call waits until the call ends;
power-off hangs every call up. The call lists are RAM (a power cycle empties them, as v6.39
does); the duration totals are the `calls` EEPROM record. See
[stock calls](docs/specs/stock/calls.md).

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
/** Convenience scene: Canvas + lighting + resize + light that moves with device tilt. */
export function PhoneStage(props: Nokia3310Props & { className?: string }): React.JSX.Element;
```

phone-3d does not know nokia-os: the website maps nokia-os's `StockLightEvent`s to `backlightOn`
(display) and `keypadLightOn` (keypad). The website passes both LED states through the Walkman's session-only output gate.

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

`website/src/phone/` hosts the runtime adapters and router bridge. The stock OS has its own
Snake II engine reproduced from v6.39 captures (plan 23 D1). The website has no
dependency on `@hellotimber/snake`; the standalone package remains available.

## Router integration design (website)

- The 3D scene mounts once in a pathless layout route (`routes/_home.tsx`), client-only via
  the router's `<ClientOnly>` + `lazy()` (SSR renders the contents column and the page; the
  canvas hydrates in). Route changes between `/` and the section routes never remount it.
- **URL → phone** (`phone/router-sync.ts`): landing on a section's route navigates the phone to
  its node (`menu/work`, `menu/games/snake`); a deep link sets the boot's target path. Going
  back to `/` from inside a section puts the carousel on that section's item.
- **Phone → URL:** on `pathchange`, the route of the phone's section; standby replaces the
  history entry instead of pushing one.
- **Echo suppression:** each direction does nothing while URL and phone already agree, and a
  flag swallows the path changes a URL-driven move makes.
- Contact's link items open in a new tab from the key press; Writing's post items navigate
  through the router.
- Keyboard input (arrows/enter/backspace/digits) maps to phone keys for desktop users;
  on-screen keys are pointer targets in 3D. The `[role=status]` mirror exposes the LCD as text.
- Unknown URLs, the old `/menu/...` ones included, render a plain 404 page with status 404.

## Milestones

Implementation is sliced into independently shippable plans under `docs/plans/`
(see `docs/plans/README.md` for status):

1. **phone-core** — firmware state machine, fully unit-tested, no DOM.
2. **phone-screen** — framebuffer, bitmap/font toolkit and canvas renderer.
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
- **Stock features** keep their firmware behaviour. Testimonials move to Inbox SMS; Chat
  uses the network port. Missed-call jokes and visitor profile modes are dropped (plan 31 D2).
- **Deployment target** not chosen (old 2017 `deploy.sh` was removed with the legacy
  site); milestone 6 leaves a placeholder task.
- The menu list/order above is verified against the original user manual (doc 9357246)
  — see `docs/specs/nokia-3310.md`, including its flagged UNVERIFIED details (signal
  bar count, Snake scoring formula, font metrics). Where the spec is unverified, plans
  pick the documented best guess.

## Planned game contracts (plan 28)

These contracts describe behaviour being built by plan 28; they are not shipped guarantees.

Extra games are opt-in through `games`, after Pairs II: stock games keep 8-1…8-4, extras take 8-5 onward, and Settings stays 8-6 with zero or one extra, then becomes 8-(5+n). Their gameplay and composed error note are non-stock screens. Games request wakes on the kernel session clock, which stops during suspension. D19 limits only protect the host: 504-byte frames, 1 MiB Wasm memory, 1024-byte storage, 512 KiB packages, 64 effects and 8192 notes per reply, 1000/5000 ms play/load watchdogs, 10 ms minimum wakes, i32 time and scores, and labels that fit stock glyphs and widgets; other counts and durations belong to the game.

### `@hellotimber/nokia-games-sdk` (new)

```ts
export const SCREEN_WIDTH = 84;
export const SCREEN_HEIGHT = 48;
/** Packed frame: 84×48 bits, row-major, MSB first, 1 = ink (504 bytes). */
export const PACKED_FRAME_BYTES = 504;

/** The host limits (D19); the only caps on a game. */
export const MIN_WAKE_MS = 10;
export const MAX_STORAGE_BYTES = 1024;
export const MAX_PACKAGE_BYTES = 512 * 1024;
export const MAX_EFFECTS_PER_REPLY = 64;
export const MAX_NOTES_PER_REPLY = 8192;
export const MAX_SESSION_MS = 2 ** 31 - 1; // also the largest score
export const WATCHDOG_MS = { play: 1000, load: 5000 } as const;

export type GameKey =
  | "up"
  | "down"
  | "*"
  | "#"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9";

/** Plain data (JSON in a user package). `validateManifest` checks structure; the host checks glyphs. */
export interface GameManifest {
  readonly sdk: 1;
  /** Kebab-case: the menu slug and the storage namespace; not a stock Games slug. */
  readonly id: string;
  /** The Games list label (stock small face, one row). */
  readonly name: string;
  /** The game's menu animation (D2). */
  readonly splash: GameSplash;
  /** The game menu in order (D5); the first item is a `play`. */
  readonly menu: readonly GameMenuItem[];
  /** Integers, 1 <= initial <= max; no upper cap (D19). Absent: no Level page, `start.level` is 1. */
  readonly level?: { readonly max: number; readonly initial: number };
  /** Navi/C suspend the game and add Continue (default false: they quit to the game menu). */
  readonly suspend?: boolean;
  /** Default true: `over(score)` shows the stock game-over screens and keeps a top score. */
  readonly scores?: boolean;
  /** Saved bytes the game may keep: 0..MAX_STORAGE_BYTES, default 0. */
  readonly storageBytes?: number;
}

export interface GameSplash {
  /** Packed frames, base64 (504 bytes each); at least one. */
  readonly frames: readonly string[];
  /** At least one step; `ms` a positive integer. Count and length are the game's; any key skips (shell). */
  readonly steps: readonly { readonly frame: number; readonly ms: number }[];
}

export type GameMenuItem =
  | { readonly kind: "play"; readonly slug: string; readonly label: string; readonly mode?: string }
  | { readonly kind: "level" }
  | {
      readonly kind: "choice";
      readonly slug: string;
      readonly label: string;
      readonly options: readonly string[]; // at least one; the stock list scrolls
      readonly initial: number;
    }
  | { readonly kind: "top-score" }
  /** Each page's text wraps in the thin face and continues on the next screen; `\n` breaks a line. */
  | { readonly kind: "instructions"; readonly pages: readonly string[] };

export interface GameStart {
  readonly mode: string; // the play item's mode ("" for none)
  readonly level: number;
  readonly choices: Readonly<Record<string, number>>; // by choice slug
  readonly seed: number; // uint32
  readonly topScore: number;
  readonly storage: Uint8Array; // the saved bytes (<= storageBytes)
}

/** Glyph rows of `#`/`.`; a row's length is the glyph's advance (STOCK_FONT_DATA's shape). */
export interface GameFont {
  readonly height: number;
  readonly glyphs: Readonly<Record<string, readonly string[]>>;
}
export interface GameFonts {
  readonly game: GameFont; // GAME_DIGITS, always
  readonly small?: GameFont;
  readonly large?: GameFont;
  readonly digits?: GameFont;
  readonly thin?: GameFont;
}

export type GameSound =
  | "eat"
  | "crash"
  /** Positive integers; any number of notes (D10). */
  | { readonly notes: readonly { readonly hz: number; readonly ms: number }[] };

export interface GameContext {
  readonly start: GameStart;
  readonly fonts: GameFonts;
  /** The session's seeded generator (mulberry32 over start.seed): a uint32 per call. */
  random(): number;
  sound(sound: GameSound): void;
  vibrate(ms: number): void; // a positive integer
  /** Replaces the saved bytes; false (nothing saved) over storageBytes. */
  save(bytes: Uint8Array): boolean;
  /** Ends the session after the current call; the shell takes over (D5). */
  over(score?: number): void;
}

/**
 * When the game next needs `update` (D4): a delay in ms from the call's time (raised to
 * MIN_WAKE_MS; a fraction rounds up), or null: sleep until a key.
 */
export type GameWake = number | null;

export interface GameInstance {
  /** At session time 0 (New game), then at each requested wake; `nowMs` is exactly the time asked for. */
  update(nowMs: number): GameWake;
  /** A game key went down at `nowMs`. A wake replaces the pending one; undefined (no return) keeps it. */
  keyDown?(key: GameKey, nowMs: number): GameWake | undefined;
  /** As keyDown, for a release (only of keys whose key-down the game got). */
  keyUp?(key: GameKey, nowMs: number): GameWake | undefined;
  /** Called after every update, keyDown and keyUp; the screen keeps the previous frame. */
  draw(screen: GameScreen): void;
}

export interface GameDefinition {
  readonly manifest: GameManifest;
  create(ctx: GameContext): GameInstance;
}

/** What a game module evaluates to: the SDK's helpers arrive as the argument (no imports). */
export type GameFactory = (sdk: GameSdk) => GameDefinition;

export interface GameSdk {
  readonly version: 1;
  readonly GAME_DIGITS: GameFont;
  readonly MIN_WAKE_MS: number;
  createScreen(): GameScreen;
  drawText(
    screen: GameScreen,
    font: GameFont,
    text: string,
    x: number,
    y: number,
    ink?: 0 | 1,
  ): number;
  textWidth(font: GameFont, text: string): number;
  drawNumber(
    screen: GameScreen,
    value: number,
    x: number,
    y: number,
    options?: {
      font?: GameFont;
      scale?: 1 | 2 | 3;
      gap?: number;
      align?: "left" | "right";
      ink?: 0 | 1;
    },
  ): number;
  encodeFrame(screen: GameScreen): string; // base64 of the packed frame (splash building)
}
export const sdk: GameSdk;

export class GameScreen {
  readonly width: 84;
  readonly height: 48;
  readonly pixels: Uint8Array; // 4032 bytes, 0/1, row-major (phone-core Bitmap layout)
  get(x: number, y: number): 0 | 1; // 0 outside
  set(x: number, y: number, ink?: 0 | 1): void; // clipped
  clear(): void;
  fill(x: number, y: number, w: number, h: number, ink?: 0 | 1): void;
  invert(x: number, y: number, w: number, h: number): void;
  blit(art: readonly string[], x: number, y: number): void; // `#` ink, `.` paper, other chars skip
  pack(): Uint8Array; // 504 bytes
}
export function unpackFrame(packed: Uint8Array): Uint8Array; // 4032 bytes
export const GAME_DIGITS: GameFont;
export function createRandom(seed: number): () => number; // mulberry32
export function mixSeed(a: number, b: number): number; // uint32 hash of two uint32s
export function validateManifest(value: unknown): GameManifest; // throws naming the field

// --- hosts -----------------------------------------------------------------------------------
/** `at`: the session ms of the call that made the effect. */
export type GameEffect =
  | { readonly kind: "sound"; readonly at: number; readonly sound: GameSound }
  | { readonly kind: "vibrate"; readonly at: number; readonly ms: number }
  | { readonly kind: "save"; readonly at: number; readonly bytes: Uint8Array }
  | { readonly kind: "over"; readonly at: number; readonly score: number | undefined };

/** One running game, driven synchronously by a host (D6). Times are session ms, non-decreasing. */
export interface GameSession {
  /** Runs every wake due at or before `nowMs` (each at its own time), then delivers the key. */
  keyDown(key: GameKey, nowMs: number): void;
  keyUp(key: GameKey, nowMs: number): void;
  /** Runs every wake due at or before `nowMs`, each at its own time. */
  advance(nowMs: number): void;
  /** The session ms of the next wake; null while the game sleeps (remote: or an advance is in flight). */
  wake(): number | null;
  /** The newest packed frame; undefined before the first. Remote sessions lag by the round trip. */
  frame(): Uint8Array | undefined;
  /** Effects since the last drain, in order. */
  drain(): readonly GameEffect[];
  /** Set once the game threw, broke the protocol or a limit, or tripped the watchdog; the session is dead. */
  readonly failure: string | undefined;
  dispose(): void;
}
export interface GameModule {
  readonly manifest: GameManifest;
  /** Creates the instance and runs `update(0)`. */
  start(start: GameStart, fonts: GameFonts): GameSession;
}
export function localGame(definition: GameDefinition): GameModule;
export function wasmGame(manifest: GameManifest, bytes: Uint8Array): GameDefinition; // ABI v1
export function parseGamePackage(value: unknown): GamePackage; // `nokia-game 1`
export function recording(module: GameModule): GameModule & { lastReplay(): string | undefined };
// replays: parseReplay, serializeReplay, recordReplay, checkReplay (see "Replay goldens")
// protocol: HostMessage, WorkerMessage, serveGame, remoteGameModule (see "Message protocol")
// conformance: CONFORMANCE_JS, CONFORMANCE_WASM, CONFORMANCE_MANIFEST, CONFORMANCE_REPLAY
```

### `@hellotimber/nokia-games` (new)

```ts
export const factory2048: GameFactory;
export const game2048: GameDefinition; // factory2048(sdk)
export const dotWasm: Uint8Array; // the Wasm example's bytes (generated)
export const EXAMPLE_PACKAGES: { readonly "2048": unknown; readonly dot: unknown }; // `nokia-game 1` JSON
```

### `@hellotimber/nokia-games-sandbox` (new)

```ts
export interface GameSandboxOptions {
  /** Where the hidden iframe goes (default document.body). */
  readonly container?: HTMLElement;
  /** A served copy of SANDBOX_HTML, for host pages whose CSP forbids 'unsafe-eval' (F10). */
  readonly src?: string;
  readonly watchdogMs?: number; // default WATCHDOG_MS.play
}
export interface GameSandbox {
  /** Validates, loads once in a worker (manifest equality, D14) and returns a module whose sessions are remote. */
  install(pkg: unknown): Promise<GameModule>;
  /** Probes the browser's enforcement outside SES (D7 (5)): fetch, WebSocket, importScripts, nested worker. */
  selfTest(): Promise<SandboxSelfTest>;
  dispose(): void;
}
export function createGameSandbox(options?: GameSandboxOptions): GameSandbox;
export const SANDBOX_HTML: string;
export const SANDBOX_CSP: string;
```

### `@hellotimber/nokia-os` (additive)

```ts
export interface StockPhoneConfig {
  // ...plan 13/15/16 fields unchanged...
  /**
   * Plan 28: extra games, appended to Games after Pairs II in this order (D3). Default: none,
   * which is the stock phone. Throws when a game fails `validateStockGame`, naming it.
   */
  games?: readonly GameModule[];
}
/** Problems that keep `manifest` off the stock phone (glyphs, row and note fit, slugs; D12, D19); [] when fine. */
export function validateStockGame(manifest: GameManifest): string[];
```

`stockMenu`, `paintStockScreen`, `missingStockGlyphs`, the storage and sound contracts are
unchanged. Internal: `src/games/sdk/**`, the `sdk-games` record in `STOCK_RECORDS`, the
`notes` cue, `levelPage` (generalised from `snakeLevel`), the `game-frame` widget model.
