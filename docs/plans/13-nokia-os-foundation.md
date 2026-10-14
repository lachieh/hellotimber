# Plan 13 - Nokia OS foundation: the stock 3310 v6.39 firmware as a package

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 01-12 complete.
**Ground truth:** emulator captures of the real v6.39 firmware under
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only),
reproduced in-repo as committed golden fixtures (`packages/nokia-os/goldens/`). Read
`$REF/captures/README.md` before touching captures. Deeper menu levels come from
`docs/specs/nokia-3310-menu-tree.md` (produced by a concurrent crawl). This plan does not need that spec.
**Status:** done.

## Goal

Create `@hellotimber/nokia-os`, a strict reproduction of the stock Nokia 3310 firmware (v6.39,
PPM E, English) built on the generic `phone-core` kernel. Every pixel and every timing step
must match the captured firmware. This plan covers:

- boot: LCD power-on sequence and the connecting-hands animation, then standby;
- standby: operator line, clock, signal and battery ladders, `Menu`;
- the main-menu carousel: all 12 stock entries in order, animated icons with captured timings,
  the position rail, the menu-number indicator and the first-digit shortcut dots;
- every level-1 submenu screen, in both firmware presentations (row lists and one-item pages,
  including the current-value line on pages);
- leaves that open a clearly marked placeholder until later plans implement them;
- a golden pipeline: REF captures become committed text-grid fixtures, and tests run without REF;
- a standalone demo page (`vp dev`) for trying the stock OS outside the website.

The website's phone, routes, content and pixels stay unchanged. How portfolio content
integrates with the stock OS is decided later and is out of scope.

## Why this plan exists (measured gap)

Plan 12 reconstructed the LCD from perspective photographs. The emulator captures are exact
firmware output, and they disagree with today's `phone-screen` rendering almost everywhere:

| Element            | phone-screen today (website)                                   | v6.39 capture (`$REF/captures/6.39`)                                                                                                                                                                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signal/battery     | four 6-row bars at y 0/8/16/24, icons at y 32                  | 7-row bars at y 0/8/16, a 6-row bar at y 24, icons at y 31                                                                                                                                                                                                                                                                                        |
| Softkey            | y 41                                                           | y 40 (descenders reach y 47)                                                                                                                                                                                                                                                                                                                      |
| Body font          | fan-made "Nokia Cellphone FC Small"                            | firmware glyphs; many differ (`S` is `.####/##.../##.../.###./...##/...##/####.`)                                                                                                                                                                                                                                                                 |
| Carousel           | body-font label at y 9, static 16x16 icon at (34,18)           | large bold label (11-row capitals) at y 7, centred near x 37.5; animated icon inside x 10..63, y 23..36                                                                                                                                                                                                                                           |
| Position rail      | x 81, y 8..39, bump offset `round(i*25/(n-1))`                 | x 81, y 7..36, bump offset `floor(i*23/(n-1))` (fits all 12 carousel and the 10- and 3-item list captures)                                                                                                                                                                                                                                        |
| Menu indicator     | right-aligned to x 83, `•` separator, `_` cursor after a digit | right edge x 81/82, 2-pixel `-` separator (`1-1`). While the first shortcut digit is awaited the indicator is three dots, and after 3 s it becomes the number                                                                                                                                                                                     |
| Submenu levels     | always three rows with an inverted band (rows at y 9/19/29)    | **two presentations.** Rows (Phone book, Games, Reminders, Profiles): band y 7..16, text at y 8/18/28, selection held on the bottom row once scrolled. Pages (Messages, Call register, Tones, Settings, Call divert, Clock): one item per screen, label lines at y 7/16/25 from x 0, plus a thin-font current value right-aligned to x 76 at y 29 |
| Label line breaks  | auto-wrapped or truncated                                      | firmware text contains explicit breaks (`Show call` / `duration`)                                                                                                                                                                                                                                                                                 |
| Boot               | 4 synthetic hand frames at 600 ms, text `NOKIA`, welcome text  | LCD self-test (blank, all-on, blank, battery ladder), then 7 firmware hand frames with captured timings                                                                                                                                                                                                                                           |
| Menu wording/count | manual (doc 9357246) wording, 13 entries                       | v6.39 wording, 12 entries (Call divert: 5 items such as `Divert if not answered`; Games adds `Settings`)                                                                                                                                                                                                                                          |

Two kernel gaps also block a faithful OS:

1. `phone-core` hardcodes website policy: the standby ▲/▼ targets (`menu/phone-book/search`,
   `menu/call-register/dialled-numbers`) and the default carrier `LACHLAN`.
2. `ScreenModel` cannot express icon animation frames, page presentation, a per-item value,
   or the "awaiting first shortcut digit" state.

## Scope and non-goals

In scope: the items in Goal; additive kernel and renderer seams; documentation.

Out of scope (later plans, see "Follow-up plans"): level 2+ menus, every leaf behaviour,
text entry with stock fonts, sound, backlight/LED timing, keyguard, storage, games, and any
website integration. The website does not import `@hellotimber/nokia-os` in this plan.

## Decisions

Each decision states what changes relative to the brief this plan was written from.

**D1 - `@hellotimber/nokia-os` owns the stock firmware _and its pixels_. It has runtime
dependencies on `phone-core` and on `phone-screen`'s LCD toolkit (brief #1 changed).** The brief
proposed type-level phone-screen use only, with `phone-screen` rendering stock screens from
content references. The captures show that the stock look has its own fonts (four faces),
geometry, two submenu presentations, a different rail and indicator, and line-break rules.
Hosting that in `phone-screen` beside the website layout would need either a large
parametric "skin" or a second layout inside phone-screen, fed by assets from nokia-os, with
golden fixtures in a different package from the layout code they check. Instead, nokia-os paints
its own screens with `phone-screen`'s `Framebuffer`, `bitmapFromArt` and `createPixelFont`, so the
stock fonts, layout, resources and fixtures live in one package. When the website later adopts the
stock OS, phone-screen's legacy layouts can be deleted and phone-screen becomes a pure LCD toolkit
plus canvas presenter.

**D2 - The renderer seam is an injectable painter plus additive ScreenModel fields (brief #2
refined).** `createScreenRenderer({ paint })` accepts `(fb, screen) => void`. The default is today's
`renderScreen`, so the website output stays byte-identical. `ScreenModel` gains only optional,
semantic fields: `iconFrame`, `presentation`, `detail` and `awaitingFirst`. Every new field is
omitted when unused, so all website models and pixels are unchanged. ScreenModels do **not**
carry Bitmaps for menu graphics: the kernel resolves _which_ frame is visible from a timeline,
and the painter (the resource owner) maps graphic id + frame to pixels. Softkey labels are not
generalised in this plan. Stock and kernel labels coincide for every screen in scope
(`Menu`, `Select`), so the work belongs with the i18n/Settings→Language plan. Adding them now
would rewrite exact-model tests across the repo with no observable change.

**D3 - The timeline primitive lives in phone-core and is driven by `tick()`.** A `Timeline` is a
sequence of `{ frame, durationMs }` steps with an optional `loopFrom` index. A `MenuGraphic` can
carry a timeline, and the carousel model then exposes `iconFrame`. The machine restarts the
graphic's timeline whenever a carousel slot becomes visible, and marks the model dirty only when
the visible frame index changes. `PhoneConfig.bootTimeline` does the same for boot. Timelines hold
no pixels.

**D4 - Submenu presentation is a kernel attribute: `"rows" | "pages"`, default rows.** The firmware
draws native menus (object kind 0x0387: Messages, Call register, Tones, Settings, Call divert,
Clock) one item per screen. Phone book and application lists (Games, Reminders, Profiles) are rows.
How a level is presented is a menu-model fact, not a Nokia-specific behaviour, so it lives on
`SubmenuEntry` and reaches the painter as `list.presentation`. A submenu may also supply a
`detail` reader that returns the selected child's current-value text, which pages draw on row 3.

**D5 - The shortcut window's first-digit state becomes visible.** Plan 12's `awaitingNext` means
"after at least one digit". The firmware shows three dots while the window is open and no digit
has been typed, so `MenuIndicator` gains `awaitingFirst?: true`. The legacy painter ignores it.
What the stock firmware shows _after_ a digit is not captured. The stock painter renders the
resolved segments without a cursor (UNVERIFIED; plan 14 confirms it from the menu-tree crawl).

**D6 - Nokia/website policy moves out of the kernel only where nokia-os needs it.** Moved:
standby ▲/▼ targets become `PhoneConfig.standbyKeys` (no default), and the default carrier
becomes `""`. The website passes its current values explicitly, so its behaviour is unchanged.
Kept, because the stock OS uses identical values: the 800 ms long press, the 3000 ms
shortcut window (it matches the captured dots duration), full signal and battery, the softkey
strings, and the `App error` reader. Host strings shown on screen (the standby clock and
`detail`) are re-read on each tick and mark the model dirty when they change. This is required
for a live clock, and it fixes a latent website bug: the website's standby clock repaints only
after a key press (see Open questions).

**D7 - Goldens are text grids imported from REF by a script, and tests never read REF.** Each
fixture is an 84x48 `#`/`.` grid with timing metadata, committed under `packages/nokia-os/goldens/`.
A generated `index.json` lists every fixture as `asserted` or `pending:<plan>`. Capture artefacts
are never imported: the importer's capture-set table records why they are omitted. A single
acceptance test file maps every asserted golden id to a scenario, and it fails if an asserted id
has no scenario (coverage guard).

**D8 - Resources are reproductions derived from the committed goldens, never from
`$REF/extracted`.** Fonts are harvested from text runs in goldens. Icons, boot frames and status
art are cropped from goldens. Timelines come from golden timing rows. A generator writes
`src/resources/generated/*.ts`, and a freshness test proves the committed data equals a fresh
extraction. `$REF/extracted` may be _read_ to cross-check counts and strings (for example the
icon frame counts in `extracted/6.39/menu/main_menu.json`). It is never copied or imported.

**D9 - Timing is compared after aligning on the transition.** Captured `start_ms` values are
rounded cumulatively to whole milliseconds, which gives step durations with no drift. Acceptance
drives the kernel with a 1 ms virtual tick and compares each frame's start relative to the
aligned transition within `TIMING_TOLERANCE_MS = 2`. The emulator's jitter (for example
208/179 ms around a ~194 ms period) is real recorded firmware behaviour and is reproduced
as captured, not smoothed.

**D10 - Labels carry firmware line breaks as `\n`; there is no auto-wrap.** Page labels are
transcribed with the line structure visible in the goldens, for example `"Show call\nduration"`.
The painter splits on `\n`, and a line wider than the page is a thrown error in tests, not a
silent wrap. Consumers that need a single-line label replace `\n` with a space.

**D11 - Capture artefacts are documented and never reproduced as behaviour.** See "Ground
truth and artefacts". Artefact _values_ may still be **test inputs**. For example, the standby
golden is rendered from `carrier: "Orange F", clock: "10:10"`, so the layout is checked
pixel-exactly while the OS hardcodes neither value.

**D12 - Boot uses a clean-boot capture when one can be produced (Task 0); otherwise a documented
composition.** The available capture is power-on → security-code prompt → "Code accepted" →
hands → clock prompt. All of these are virgin-EEPROM effects except the self-test and the hands.
Fallback: self-test frames 0-3 of `boot/power-on` followed by hands frames 4-10 of `boot/welcome`.
The last hands frame is held for its captured 4230.6 ms, then standby. The fallback is flagged
UNVERIFIED in the spec.

**D13 - Leaves open a `PlaceholderApplication`.** It renders a `custom` frame: a 1-pixel dotted
border (never drawn by the firmware) and the entry label in the stock font. C exits to the parent.
Chat and Calculator, which are top-level applications, open the placeholder too. Their captured
first screens are imported as `pending` goldens.

**D14 - The website changes only by a behaviour-preserving config (`standbyKeys`) and by
updates to exact-model assertions for `awaitingFirst`.** `phone-screen`'s render code and
fixtures are not touched.

**D15 - Supplementary captures are written to REF (Task 0).** The existing 3 s icon
recordings start after the key press and truncate several animations. The firmware has 17 Tones
frames, 13 Calculator frames and 14 Reminders frames, but the recordings hold 14, 8 and 11 distinct
states. So Task 0 re-records each transition with `record ... start` _before_ the key and runs it
for 10 s. It writes only to new REF directories, so it does not collide with the concurrent crawl.
Nothing from REF is committed.

## Ground truth and artefacts

Capture inventory used by this plan (`$REF/captures/6.39/` unless noted):

| Source                                    | Contents                                                                     | Use                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `boot/power-on/` (6 frames)               | blank (LED off), all-on, blank, battery ladder, blank 42 ms, security prompt | frames 0-3 (fallback boot); 4-5 omitted                    |
| `boot/welcome/` (16 frames)               | "Code accepted" 0-3, hands 4-10, clock prompt 11-15                          | frames 4-10 (hands); others omitted                        |
| `standby/01-standby.png`                  | standby, "Orange F", 10:10                                                   | asserted (artefact values as test inputs)                  |
| `standby/standby-10s/`                    | one frame for 10 s                                                           | asserted: no blinking, no change                           |
| `menu/NN-<slug>.png` (12)                 | carousel after its 3 s recording                                             | asserted                                                   |
| `menu/NN-<slug>/anim/`                    | ~3 s of icon frames (truncated)                                              | fallback only; replaced by `menu-anim-long/` from Task 0   |
| `menu/NN-<slug>/sub/MM.png`               | level-1 screens in scroll order                                              | asserted, except Chat/Calculator (pending) and Profiles 06 |
| `menu-anim-long/` (Task 0)                | per-item transition + 10 s, plus revisit/return probes                       | asserted timelines                                         |
| `boot-clean/` (Task 0, optional)          | power-on to standby without the security prompt                              | asserted boot timeline if produced                         |
| `clock-time/{1948,0759}/` (Task 11)       | standby and every Clock page with the clock set to 19:48 / 07:59             | asserted (every digit in the digits and thin fonts)        |
| `menu-scroll-up/01-phone-book/` (Task 11) | Phone book from item 6, ▲ through the wrap                                   | `pending:14` (rows window state)                           |

Artefacts (never reproduced as behaviour):

| Artefact                                                | Cause                                  | Handling                                                                                                    |
| ------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Operator `Orange F`                                     | emulator synthetic PLMN 208-01         | `carrier` is required host config; goldens pass `"Orange F"` as input; demo default per Open questions      |
| Clock frozen at `10:10`                                 | emulator RTC (issue #1)                | host `clock()` port; goldens pass `"10:10"`                                                                 |
| Date on Clock → Date setting                            | date typed during setup (`13 10 2026`) | host `date()` port; goldens pass the captured string                                                        |
| Security-code prompt, `Code accepted`, time/date wizard | virgin EEPROM                          | not reproduced; boot per D12                                                                                |
| First standby `Snooze` prompt and `0000000000`          | virgin EEPROM alarm state              | not imported                                                                                                |
| Profiles slot 6 (two boxes)                             | uninitialised EEPROM name              | `profiles.sub` image 06 omitted; slot 6 exists (it changes the rail) and is labelled `(empty)` (UNVERIFIED) |
| Page values (`Level 1`, `No tone`, `Off`, ...)          | virgin-EEPROM settings                 | reproduced as a static settings snapshot for this plan; the storage plan replaces it                        |
| Snake II speed                                          | emulator/EEPROM (README)               | out of scope                                                                                                |

## Package boundaries

```text
website ─────────▶ phone-core, phone-screen, phone-3d, snake      (unchanged; no nokia-os yet)
nokia-os ────────▶ phone-core (runtime: kernel, menu model, Timeline)
         ────────▶ phone-screen (runtime: Framebuffer, bitmapFromArt, createPixelFont; ScreenPainter type)
phone-screen ────▶ phone-core (type-only)
snake, phone-3d ─▶ (no internal deps)
```

- `phone-core` stays generic: no Nokia labels, slugs, fonts or timings.
- `nokia-os` owns the stock menu, placeholder applications, stock config defaults, resources
  (fonts, icons, boot frames, status art), the stock painter and the goldens.
- `nokia-os` never imports `@tanstack/*`, `website/`, `phone-3d` or `snake`.
- `phone-screen` gains only the painter seam. Its render code, fonts, icons and fixtures do not change.

AGENTS.md (Task 1) records the new layout entry and the new dependency edges, and it reads
rule 3 ("works standalone") as: tests pass with only the package's _declared_ dependencies.

## Contract changes

Task 1 writes these into `VISION.md` before any code changes.

### `@hellotimber/phone-core` (additive)

```ts
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

export type CarouselReveal = "enter" | "next" | "previous" | "return"; // Task 4 deviation

export class MenuGraphic {
  constructor(
    id: string,
    timeline?: Timeline,
    options?: { reveals?: Partial<Record<CarouselReveal, Timeline>> },
  );
  readonly id: string;
  readonly timeline: Timeline | undefined;
  timelineFor(reveal: CarouselReveal): Timeline | undefined;
}

export type MenuPresentation = "rows" | "pages";

export interface SubmenuOptions<Metadata = unknown> {
  presentation?: MenuPresentation; // default "rows"
  /** Current-value text for a child (e.g. "Off"); undefined = none. Opaque host function. */
  detail?(child: MenuEntry<Metadata>): string | undefined; // method syntax: keeps SubmenuEntry covariant
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
  readonly presentation: MenuPresentation;
}

export interface MenuIndicator {
  segments: readonly number[];
  awaitingNext: boolean;
  /** Present only while the shortcut window is open and no digit has been accepted. */
  awaitingFirst?: true;
}

// ScreenModel additions (all optional, omitted when unused):
//   menu-carousel: iconFrame?: number      // present iff the slot's graphic has a timeline
//   list:          presentation?: "pages"  // present only for pages
//   list:          detail?: string         // selected child's value, when the reader returns one
//   boot:          unchanged shape; with bootTimeline, phase is "hands" and frame = timeline frame

export interface PhoneConfig<Metadata = unknown> {
  menu: PhoneMenu<Metadata>;
  carrier?: string; // default "" (was "LACHLAN")
  clock?: () => string | undefined;
  bootMs?: number; // 0 skips boot; otherwise defaults to bootTimeline?.durationMs ?? 3000
  /** Finite boot animation; when set, boot length = its durationMs. */
  bootTimeline?: Timeline;
  /** Paths opened by ▲/▼ in standby; unknown/absent = no-op. */
  standbyKeys?: { up?: string; down?: string };
  menuOpenDelayMs?: number; // Task 5 deviation; default 0 (standby model gains leaving?: true)
  shortcutWindowMs?: number; // Task 5 deviation; default 3000
}
```

Timeline rules: steps must be non-empty, `frame` is a non-negative integer, `durationMs` is a
positive integer, and `loopFrom` is in range. `bootTimeline` must be finite. Combining it with a
`bootMs` other than 0 or the timeline's duration throws.

Carousel timeline restart rule: the timeline restarts when the menu is entered, when ▲/▼ changes
the slot, when C returns to the carousel, and when `navigate("menu")` lands on it. Task 0's
`90-revisit` and `91-return` probes confirm or correct this before Task 4 is written. If the probes
are not captured, keep this rule and mark it UNVERIFIED in the spec.

### `@hellotimber/phone-screen` (additive)

```ts
export type ScreenPainter = (fb: Framebuffer, screen: ScreenModel) => void;

export type ScreenRendererOptions = {
  scale?: number;
  fg?: string;
  bg?: string;
} & (
  | { paint?: undefined; welcomeText?: string } // legacy painter (default, unchanged)
  | { paint: ScreenPainter; welcomeText?: never }
);
```

### `@hellotimber/nokia-os` (new)

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

## Golden pipeline

### Fixture format (`*.lcd.txt`)

```text
lcd-golden 1
id: menu/05-tones.anim
status: asserted
source: captures/6.39/menu-anim-long/05-tones
source-sha256: 9c1e...  (sha256 over each source PNG's bytes in name order, then timings.csv)
trigger-frame: 1
note: ▼ from Call register at frame 1; frame 0 is the previous screen.
omitted: none

@image a
....................................................................................
(48 rows of exactly 84 characters, '#' = lit pixel, '.' = clear)

@image b
...

@timeline
# frame image start_ms duration_ms lcd    leds
0      a     1        412         normal 3
1      b     413      193         normal 3
...
13     a     2892     500+        normal 3
```

Rules, enforced by `scripts/golden-format.ts` with `file:line` errors:

- Header keys appear in this order: `id`, `status` (`asserted` | `pending:<plan>`), `source`,
  `source-sha256`, optional `trigger-frame` (an integer, or `before-recording`), optional
  `note`, and `omitted` (`none` or a comma list `name (reason)`).
- Images are named `[a-z0-9-]+` and are unique. Timeline fixtures name images `a`, `b`, ... in
  first-appearance order, and repeated states reuse their image. Multi-still fixtures (`.sub`) use
  the source names (`01`, `02`, ...) in scroll order.
- `start_ms` and `duration_ms` are integers produced by cumulative rounding (D9). A trailing `+`
  marks a lower bound (the recording stopped). `lcd` is `normal` | `inverse` | `blank`; `leds` is
  0-3 and is kept for the future backlight plan.
- A fixture is a still (one or more images, no timeline) or a timeline (images plus `@timeline`).

### Capture set (`scripts/capture-set.ts`)

A declarative table that the importer executes. Fixture ids and sources:

| Fixture id                    | Source (prefer → fallback)                                                             | Kind     | Status                         |
| ----------------------------- | -------------------------------------------------------------------------------------- | -------- | ------------------------------ |
| `boot/power-on`               | `boot-clean/power-on` → `boot/power-on` frames 000-003 + `boot/welcome` 004-010        | timeline | asserted                       |
| `standby/standby`             | `standby/01-standby.png`                                                               | still    | asserted                       |
| `standby/idle`                | `standby/standby-10s`                                                                  | timeline | asserted                       |
| `menu/NN-<slug>` (×12)        | `menu/NN-<slug>.png`                                                                   | still    | asserted                       |
| `menu/NN-<slug>.anim` (×12)   | `menu-anim-long/NN-<slug>` → `menu/NN-<slug>/anim` (`trigger-frame: before-recording`) | timeline | asserted                       |
| `menu/revisit.anim`           | `menu-anim-long/90-revisit` (only if captured)                                         | timeline | asserted                       |
| `menu/return.anim`            | `menu-anim-long/91-return` (only if captured)                                          | timeline | asserted                       |
| `menu/NN-<slug>.sub` (×10)    | `menu/NN-<slug>/sub/*.png` (Profiles omits `06`)                                       | stills   | asserted                       |
| `menu/03-chat.sub`            | `menu/03-chat/sub/*.png`                                                               | stills   | `pending:18` (Messages & Chat) |
| `menu/09-calculator.sub`      | `menu/09-calculator/sub/01.png`                                                        | stills   | `pending:20` (Calculator)      |
| `standby/standby-HHMM` (×2)   | `clock-time/HHMM/standby.png` (Task 11; HHMM = 1948, 0759)                             | still    | asserted                       |
| `menu/11-clock.sub-HHMM` (×2) | `clock-time/HHMM/clock-sub/*.png` (Task 11)                                            | stills   | asserted                       |
| `menu/01-phone-book.sub-up`   | `menu-scroll-up/01-phone-book/*.png` (Task 11)                                         | stills   | `pending:14` (Menu tree depth) |

Slugs: `01-phone-book 02-messages 03-chat 04-call-register 05-tones 06-settings
07-call-divert 08-games 09-calculator 10-reminders 11-clock 12-profiles`.

### Importer CLI

```sh
mise exec -- vp run @hellotimber/nokia-os#import-captures /Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310
```

- Runs with Node's built-in type stripping (Node 22.22 via mise). Scripts import only
  `node:*` modules and sibling `scripts/*.ts` files, with explicit `.ts` extensions.
  They never import `src/`, because extensionless bundler imports do not resolve under Node.
- Decodes PNGs with `scripts/png.ts`, a minimal decoder over `node:zlib` for 1/8-bit indexed,
  non-interlaced images with filters 0-4. It rejects anything else, and pixels with palette
  index 1 are lit. No new dependency.
- Fails with a clear message if `$REF/captures/6.39` is missing. Falls back per row and reports
  each fallback.
- Writes the fixtures and `goldens/index.json`:
  `[{ id, file, status, kind, images, frames }]`, sorted by id.
- Idempotent: running it twice leaves `git status --porcelain packages/nokia-os/goldens` empty.

### Diff helper output (`tests/support/golden.ts`)

`expectLcd(actual, golden, context)` compares 4,032 pixels. On failure it throws exactly this
shape. The window is the difference bounding box padded by 4 px and clamped to the frame. When
the window is wider than 48 columns, it shows the full width:

```text
LCD mismatch: menu/02-messages.sub image "01"
scenario: Menu, ▼×1, Select
14 px differ (6 extra, 8 missing); first at (x=1, y=9); differences in x=0..6, y=7..13
legend: '#' ink in both  '.' clear in both  '+' ink only in actual  '-' ink only in golden

          0         1
          0123456789012345
     4    ................
     5    ................
     6    ................
     7    ##...##+........
     8    ##...##.........
     9    #-.#.##.##+#.##.
    10    ###+###.####.##.
    11    .#####-.##..##..
    12    .##.##..##...##.
    13    .##.##-.##...+##
    14    ................
    15    ................
    16    ................
window x=0..15, y=4..16 of 84x48; set LCD_DIFF=full to print golden | actual | diff side by side
```

`expectTimeline(recorded, golden, context)` prints one row per golden frame from the trigger
onward. It marks every failing row and then appends the `LCD mismatch` block for the first
pixel failure:

```text
Timeline mismatch: menu/05-tones.anim (aligned: golden frame 1 = trigger; tolerance ±2 ms)
 frame image  golden start  actual start       Δ  pixels
     1 b              0.0           0.0     0.0  ok
     2 c            193.0         193.0     0.0  ok
     7 h           1356.0        1390.0   +34.0  ok       ✗ timing
     8 i           1550.0             -       -  missing  ✗ never shown
 last: golden holds ≥ 500 ms; actual changed after 120 ms  ✗
```

Alignment: with `trigger-frame: N`, the scenario's trigger time is matched to frame N's start.
With `before-recording` (fallback captures), the first in-recording change (frame 1) is matched,
and frame 0's duration is not compared.

### Scenario harness and coverage guard

`tests/support/rig.ts` provides `createRig(config)`, a stock phone driven on a virtual clock:

- `press(key, holdMs?)`, `advance(ms)` (ticks every 1 ms), `paint(): Framebuffer`;
- `record(durationMs, trigger?)`: subscribes, paints on each snapshot and keeps distinct frames
  with their start times, like the harness `record` command. Painting happens only on snapshots,
  so 10 s of 1 ms ticks stays cheap.

`tests/acceptance.test.ts` reads `goldens/index.json`. It requires a scenario for every
`asserted` id in its `SCENARIOS` map and fails with `no scenario for <id>` otherwise. It
registers `it.todo` for each `pending` id.

## Stock display observations

These are observed values to start from. The goldens are authoritative; when the two disagree,
fix the observation in this plan and in the spec.

| Element    | Observation                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonts      | `small` (labels, operator, softkeys; 2-px stems, 7-row capitals plus descenders), `large` (carousel title, 11-row capitals), `digits` (indicator and standby clock, 6 rows), `thin` (page values, 1-px stems)       |
| Standby    | signal bars x 0, rows 0-6 (w4), 8-14 (w3), 16-22 (w2), 24-29 (w2); antenna icon at (0,31); battery mirrored, icon 4x6 at (80,31); operator centred, top y 8; clock right edge ≈ x 76, y 0; `Menu` centred, top y 40 |
| Carousel   | title `large` centred near x 37.5, top y 7; icon art within x 10..63, y 23..36; rail as below; indicator top-right; `Select` centred y 40                                                                           |
| Rail       | x 81, y 7..36; bump top `b = 7 + floor(i*23/(n-1))`: pixels (81..82, b), (83, b+1..b+5), (81..82, b+6); x 81 is absent at b+1..b+5                                                                                  |
| Indicator  | `digits`, right edge x 81 (`1`) / 82 (`2`); levels joined by a 2-px `-`; first-digit wait = three 1-px dots at y 5, x 78/80/82                                                                                      |
| Rows list  | band x 0..77, y 7+10r .. 16+10r; text x 2, top y 8+10r, inverted in band; window `max(0, selected-2)`; rail; `Select` at y 40                                                                                       |
| Pages list | label lines from x 0 at tops y 7/16/25; value (`thin`) right edge x 76, top y 29; rail; `Select` at y 40                                                                                                            |
| Boot       | full-frame images; the self-test turns the LED on at frame 1                                                                                                                                                        |

## Stock firmware model (level 0 and 1)

Labels below are the v6.39 text as read from the captures. `/` marks a firmware line break,
which becomes `\n` in data. Task 7 verified every label against its golden; the transcription
used for the fonts is `packages/nokia-os/scripts/text-runs.ts`.

| #   | Slug            | Label         | Kind / presentation | Level-1 children (order)                                                                                                                                                    |
| --- | --------------- | ------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `phone-book`    | Phone book    | submenu, rows       | Search, Service Nos., Add name, Erase, Edit, Assign tone, Send b'card, Options, Speed dials, Voice tags                                                                     |
| 2   | `messages`      | Messages      | submenu, pages      | Write/messages, Inbox, Outbox, Picture/messages, Templates, Smileys, Message/settings, Info/service, Voice/mailbox/number, Service/command/editor                           |
| 3   | `chat`          | Chat          | application         | placeholder (captured first screens are `pending:18`)                                                                                                                       |
| 4   | `call-register` | Call register | submenu, pages      | Missed/calls, Received/calls, Dialled/numbers, Erase recent/call lists, Show call/duration, Show call/costs, Call cost/settings, Prepaid credit                             |
| 5   | `tones`         | Tones         | submenu, pages      | Ringing/tone, Ringing/volume, Incoming/call alert, Composer, Message/alert tone, Keypad/tones, Warning tones, Vibrating/alert, Screen saver                                 |
| 6   | `settings`      | Settings      | submenu, pages      | Call/settings, Phone/settings, Security/settings, Restore/factory/settings                                                                                                  |
| 7   | `call-divert`   | Call divert   | submenu, pages      | Divert all/voice calls/without ringing, Divert/when busy, Divert if not/answered, Divert when/phone off/or no coverage, Cancel all/diverts (menu number 6: a 5th is hidden) |
| 8   | `games`         | Games         | submenu, rows       | Snake II, Space impact (lower-case i), Bantumi, Pairs II, Settings (menu number 6: a 5th is hidden)                                                                         |
| 9   | `calculator`    | Calculator    | application         | placeholder (captured first screen is `pending:20`)                                                                                                                         |
| 10  | `reminders`     | Reminders     | submenu, rows       | Add new, View all, Erase                                                                                                                                                    |
| 11  | `clock`         | Clock         | submenu, pages      | Alarm/clock, Clock/settings, Date setting, Stopwatch, Countdown/timer, Auto update of/date and time                                                                         |
| 12  | `profiles`      | Profiles      | submenu, rows       | General, Silent, Discreet, Loud, (empty), (empty) - slot 6 UNVERIFIED                                                                                                       |

Children are `ApplicationEntry` placeholders with kebab-case slugs from their labels. Reuse the
website's slugs where the label matches (for example `search`, `send-bcard`, `dialled-numbers`).
Page `detail` values come from a static settings snapshot that reproduces the captured values
(for example Messages → Info service `Off`, Tones → Ringing volume `Level 1`, Message alert tone
`No tone`, Keypad tones `Level 1`, Screen saver `Off`, Clock → Alarm clock `Off`, Countdown
timer `Off`, Auto update `Off`). The exceptions are Clock → Clock settings (the host `clock()`)
and Clock → Date setting (the host `date()`). Transcribe each value from its golden.

Stock standby keys: ▲ → `menu/phone-book/search`, ▼ → `menu/call-register/dialled-numbers`.
Both are placeholders in this plan; the Phone book and Call register plans replace them with
the real name and redial lists.

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task, run `mise exec -- vp check --fix` and the named test commands.
- Any task that touches `phone-core` or `phone-screen` also runs
  `mise exec -- vp run -r test` and `mise exec -- vp run website#build`.
- Never hand-edit `goldens/**` or `src/resources/generated/**`: change the generator or its input
  tables and regenerate.
- No new dependencies beyond `@types/node` (dev, already in the catalog) for `nokia-os` scripts.
- Commit per task in the existing style; the pre-commit hook runs `vp check --fix`.
- Parallelism (max 3 concurrent agents): Task 0 can run alongside Tasks 1-2, 4-6. Tasks 4→5 are
  sequential (both touch `machine.ts`). Task 6 is independent of 4/5. Task 3 waits for Task 0.

## Tasks

### Task 0 - Supplementary REF captures (no repository changes)

**Files (all under `$REF`, gitignored):** `captures/scripts/v639-plan13.cap`,
`captures/6.39/menu-anim-long/**`, optionally `captures/6.39/boot-clean/**`, an appended section in
`captures/README.md`, and a scratch flash image under `firmware/work/`.

- [x] Read `$REF/captures/README.md`. Build the harness if `cap` asks for it. Do not modify the
      emulator, existing captures or `v639-all.cap`. The concurrent crawl may be using the
      harness, so write only the new paths above.
- [x] Write `v639-plan13.cap`: `include v639-setup.inc`, then `key c` and `run 2s` to clear the
      first-standby prompt, then:
  - `record menu-anim-long/01-phone-book start`, `key menu`, `run 10s`, `record stop`;
  - for items 2-12: `record menu-anim-long/NN-<slug> start`, `key down`, `run 10s`, `record stop`;
  - `90-revisit`: `record ... start`, `key up`, `run 6s`, `record stop` (12 → 11: does the icon restart?);
  - `91-return`: `record ... start`, `key menu`, `run 1500ms`, `key c`, `run 6s`, `record stop`
    (does the icon restart after returning from a submenu?).
- [x] Clean boot, time-boxed to one attempt. Find the setting that removes the boot
      security-code prompt (Settings → Security settings; use `docs/specs/nokia-3310-menu-tree.md`
      if it exists). Then `saveflash firmware/work/v639-clean.fls`, `reboot` from it, and record to
      `boot-clean/power-on` for 20 s. If the prompt cannot be removed, write
      `boot-clean/NOT-ACHIEVED.md` describing what was tried, and use the D12 fallback.
- [x] Factory defaults: after the clean-boot step, run Settings → Restore factory settings
      (security code `12345`), `saveflash firmware/work/v639-factory.fls`, then re-record every
      level-1 list into `factory-sub/NN-<slug>/` (same scroll order as `menu/NN-<slug>/sub`).
      These replace the virgin-EEPROM page values and the Profiles slot-6 artefact as asserted
      goldens (see Open questions 2-3). If restore is unavailable or changes nothing, note it in
      the README section and keep the original `sub` captures.
- [x] Run the script with `tools/harness/cap firmware/raw/6.39/combined/3310_v639_ppm_E_virgin_eeprom_2MiB.fls captures/scripts/v639-plan13.cap captures/6.39`.
- [x] Check: each `menu-anim-long/NN-*/timings.csv` has frame 0 = the previous screen and
      frame 1 = the new screen. Each recording either settles (last row is a lower bound
      ≥ 1 s) or visibly loops. Record which in the README section.
- [x] Append a "Plan 13 supplementary captures" section to `$REF/captures/README.md`.
- [x] No commit. Report: icons that settle vs loop, restart behaviour from the probes, and the
      clean-boot outcome.

**Task 0 outcome (2026-10-13).** Script `captures/scripts/v639-plan13.cap`; details in the
"Plan 13 supplementary captures" section of `$REF/captures/README.md`.

- All 12 icons **settle** (each recording ends on a held frame ≥ 3.5 s); none loops. All end on
  their first frame except Settings, which plays 8 frames once and holds the last. Distinct icon
  frames: Phone book 4, Messages 14, Chat 12, Call register 12, Tones 17, Settings 8, Call divert
  11, Games 4, Calculator 13, Reminders 14, Clock 8, Profiles 4.
- Probes: the icon **restarts** from its first frame on ▲ (`90-revisit`) and on C back from a
  submenu (`91-return`). The restart rule in "Contract changes" stands. The Clock's first step
  lasted 1400 ms after ▼ but 1385 ms after ▲ or C (15 ms, beyond the ±2 ms tolerance).
- `01-phone-book`: frame 1 is a 39 ms transient (standby with the bars erased); the carousel
  with the first-digit dots is frame 2 (76 ms); the dots become `1` at 2985 ms.
- `04-call-register` frame 3 is held only 15 ms (real firmware output).
- Clean boot: **not achieved** (`$REF/captures/6.39/boot-clean/NOT-ACHIEVED.md`). Phone security
  is On in the virgin EEPROM, and the in-menu security-code check answers `Code error` to
  `12345` although the power-on gate accepts it. The D12 fallback applies.
- Factory restore: **not available** for the same reason (`Code error`). No `factory-sub/`; the
  original `menu/*/sub` captures stay the asserted page goldens (virgin-EEPROM values) and
  Profiles slot 6 stays UNVERIFIED (Open questions 2-3 resolve to their fallbacks).

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `AGENTS.md`, `docs/plans/README.md`, `docs/specs/nokia-3310.md`, this plan.

- [x] VISION: add the `@hellotimber/nokia-os` row to the package table and architecture diagram,
      the phone-core additions, the `ScreenPainter` option, and the nokia-os contract,
      all exactly as in "Contract changes". State that the website does not consume nokia-os yet.
- [x] AGENTS.md: add `nokia-os/` to the workspace layout. Add `nokia-os ──▶ phone-core,
phone-screen` to the allowed directions. Clarify rule 3 (declared dependencies). Add the
      golden workflow: REF is never committed, and `import-captures` / `extract-resources`
      regenerate `goldens/` and `src/resources/generated/`.
- [x] Spec: add "§10 Firmware ground truth (v6.39 captures)". It covers the two submenu
      presentations, the rail and indicator geometry, first-digit dots, firmware line breaks,
      the 12-entry main menu, v6.39 level-1 labels, the boot self-test, and the artefact table.
      Mark plan 12's photographic geometry as _website-only_. Keep §5 as manual-sourced history
      and point to §10 and `nokia-3310-menu-tree.md`.
- [x] Plans README: add row 13 (`not started` → `in progress`), with dependencies `01-12`.
- [x] No runtime code.
- [x] `mise exec -- vp check --fix`.
- [x] Commit: `docs: define nokia-os package and stock firmware contracts (plan 13)`.

### Task 2 - Scaffold `@hellotimber/nokia-os`, golden format and diff helpers (TDD)

**Files:** `packages/nokia-os/{package.json,tsconfig.json,vite.config.ts,README.md,src/index.ts}`,
`scripts/golden-format.ts`, `tests/support/golden.ts`, `tests/golden-format.test.ts`,
`tests/golden-diff.test.ts`.

- [x] Scaffold with `mise exec -- vp create vite:library --directory packages/nokia-os --no-interactive --no-git`.
      Delete the cruft listed in AGENTS.md.
- [x] `package.json`: source exports; scripts `test` (`vp test run`), `demo` (`vp dev demo`),
      `import-captures` (`node scripts/import-captures.ts`) and `extract-resources`
      (`node scripts/extract-resources.ts`); dependencies `@hellotimber/phone-core` and
      `@hellotimber/phone-screen` (`workspace:*`); devDependencies `@types/node`, `typescript`,
      `vite-plus` (`catalog:`).
- [x] `tsconfig.json`: the AGENTS template, with include `src`, `tests`, `scripts`, `demo`, plus
      `"allowImportingTsExtensions": true` and `types: ["vite-plus/client", "node"]`.
- [x] TDD `golden-format.ts`: parse and serialize round trip; reject bad headers, wrong
      dimensions, non-`#`/`.` characters, duplicate images, unknown image references,
      non-monotonic starts and misplaced `+`. Every error names `file:line`.
- [x] TDD `expectLcd` / `expectTimeline`: assert the exact failure text for a synthetic 3-pixel
      difference (window, ruler, legend, counts, first coordinate). Cover `LCD_DIFF=full`.
      Cover timing failures (early, late, missing image, last-frame lower bound) and alignment
      by `trigger-frame` and by `before-recording`.
- [x] `mise exec -- vp install`, `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [x] Commit: `feat(nokia-os): scaffold package with LCD golden format and diff helpers`.

Deviation: adding the `packages/nokia-os` importer made pnpm re-resolve the catalog's `latest`
entries (TanStack patch/minor bumps) in `pnpm-lock.yaml` (an offline, lockfile-only install
bumps them the same way). The bumped router plugin reorders the generated
`website/src/routeTree.gen.ts` (import/route order only); it is committed as generated. All tests
and the website build pass.
Deviation: the plan's sample `LCD mismatch` block is illustrative (its counts and window do not
match its grid). The helper reports the first difference in row-major (reading) order, prints a
tens digit at the window's first column and at every multiple of 10, and `LCD_DIFF=full` prints
`golden | actual | diff` rows prefixed by y. Timeline fixtures must also chain
(`start_ms` = previous start + duration), which cumulative rounding (D9) guarantees.

### Task 3 - Capture importer and committed goldens

**Files:** `scripts/png.ts`, `scripts/capture-set.ts`, `scripts/import-captures.ts`,
`tests/png.test.ts`, `tests/goldens-integrity.test.ts`, `goldens/**`.

- [x] TDD `png.ts` against PNGs built inside the test with `node:zlib` (1-bit and 8-bit palette,
      every filter type, rejection of interlaced and truecolour images).
- [x] Encode the capture-set table above. Each entry carries id, source, fallback, frame
      selection, status, note and omitted reasons.
- [x] Implement the importer per "Importer CLI". Compute `source-sha256`. Deduplicate timeline
      images. Use cumulative rounding.
- [x] TDD `goldens-integrity.test.ts`: every index entry parses and is 84x48; ids are unique;
      no fixture file is missing from the index; asserted timelines have a `trigger-frame`;
      every `pending` status names a plan.
- [x] Run the importer against REF twice; the second run must produce no diff.
- [x] Note in this plan's completion notes which rows used fallbacks.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [x] Commit: `feat(nokia-os): import v6.39 LCD captures as committed goldens`.

Deviation: single `shot` stills name their image after the file stem (`01-standby`,
`01-phone-book`); the plan only fixes names for timelines (`a`, `b`, …) and `.sub` (`01`, …).
`menu/return.anim` uses `trigger-frame: 2` (the C press); frame 1 is the Select into Clock.

### Task 4 - phone-core: timelines for menu graphics and boot (TDD)

**Files:** `packages/phone-core/src/timeline.ts` (new), `menu.ts`, `machine.ts`, `types.ts`,
`index.ts`, `README.md`; tests `timeline.test.ts` (new), `animated-graphics.test.ts` (new),
`power.test.ts`.

- [x] TDD `Timeline`: validation, `frameAt` at step boundaries (a step starts exactly at its
      cumulative start), hold-last, `loopFrom` cycles, `durationMs`, defensive copy and freeze.
- [x] TDD `MenuGraphic(id, timeline?)` and its immutability.
- [x] TDD machine: `iconFrame` is present only for timeline graphics. Each restart condition
      (per the Task 0 probes) resets it. Subscribers are notified exactly when the frame index
      changes, and never on ticks that leave it unchanged. A settled timeline stops producing
      snapshots.
- [x] TDD `bootTimeline`: the boot model's frame follows the timeline; standby follows its
      duration; `bootMs: 0` still skips; conflicting `bootMs` throws; deep-link navigation during
      boot is still honoured.
- [x] Existing tests pass unchanged. Graphics without a timeline produce identical models.
- [x] `mise exec -- vp run @hellotimber/phone-core#test`, `vp run -r test`, `vp run website#build`, `vp check --fix`.
- [x] Commit: `feat(phone-core): tick-driven timelines for menu graphics and boot`.

Deviation: `MenuGraphic` takes an optional `{ reveals }` map of per-reveal timelines
(`CarouselReveal = "enter" | "next" | "previous" | "return"`) and exposes `timelineFor(reveal)`.
The three Clock goldens cannot share one timeline. Frame starts relative to the reveal are
▼ `11-clock.anim` c 1400, d 1619, then 1850/2083/2315/2547/2780/3012; ▲ `revisit.anim` c 1385,
d 1617, then 1849/…/3011; C `return.anim` c 1386, d 1628, then 1858/…/3020. ▼ and ▲ differ only
at c (one frame shown 15 ms late), and C runs about 9 ms late from d onwards, so no single
timeline (and no entry-dependent first-step offset) fits all three within ±2 ms. Per D9 the
jitter is reproduced as captured: Tasks 7/9 give the Clock graphic `previous` (from
`menu/revisit.anim`) and `return` (from `menu/return.anim`) timelines; every other icon has only a
default timeline. Path navigation that lands on the carousel counts as `enter`.
Deviation: snapshots for timeline frames come from a generic "tick signature" compared after
every run (boot frame with `bootTimeline`, visible carousel icon frame). The legacy boot (no
`bootTimeline`) still repaints on every tick, so existing tests and the website are unchanged.

### Task 5 - phone-core: presentation, details, first-digit state, host-owned standby policy (TDD)

**Files:** `packages/phone-core/src/{menu.ts,machine.ts,types.ts,index.ts}`, README; tests
`presentation.test.ts` (new), `shortcuts.test.ts`, `carousel.test.ts`, `power.test.ts`,
`fixtures.ts`; `website/src/phone/phone.ts`, `website/src/content/menu.ts`, and the website
tests that exercise standby ▲/▼ or assert the indicator while the shortcut window is open.

- [x] TDD `SubmenuOptions`: `presentation` defaults to rows. `list.presentation` is emitted only
      for pages. `detail` is emitted only when the reader returns a string, is evaluated for the
      _selected_ child, and does not change when the selection moves to a child without a value.
- [x] TDD tick refresh: when a standby `clock()` value or a visible `detail` value changes
      between ticks, exactly one snapshot is emitted; an unchanged value emits none.
- [x] TDD `awaitingFirst`: present from Menu until the first digit, the timeout or a
      non-digit key; absent everywhere else. Update the exact-model assertions that observe
      the open window.
- [x] TDD `standbyKeys`: configured paths open on ▲/▼; absent or unknown paths are no-ops.
      Remove the hardcoded slugs from `machine.ts`.
- [x] Carrier default `""`; update the power test that pinned `LACHLAN`.
- [x] Website: export `SITE_STANDBY_KEYS` (the current two paths) from `website/src/content/menu.ts`.
      Pass it in `phone.ts` and in every website test helper that relies on standby ▲/▼. Make no
      other website changes.
- [x] `mise exec -- vp run -r test`, `vp run website#build`, `vp check --fix`.
- [x] Commit: `feat(phone-core): menu presentation, item details, first-digit state, host standby keys`.

Deviation: `menu/01-phone-book.anim` needs two more kernel timings, added as host config with
website-preserving defaults. (1) Frame 1 is a 39 ms firmware frame (standby with the signal and
battery ladders and icons erased) before the carousel: `PhoneConfig.menuOpenDelayMs` (default 0)
keeps the standby model on screen with `leaving: true` for that long after Menu; the path is
already `menu`, the carousel's icon timeline starts when it opens (Phone book's first step
1129 ms is counted from the carousel, frame 2), a key that moves the carousel opens it at once,
and C returns to standby. (2) Aligned on the trigger (frame 1, D9), the dots become `1` at
2948 ms, not 3000 (capture 2985 ms minus the 37 ms trigger start), so D6's "3000 ms matches" is
off by 52 ms, outside ±2 ms: `PhoneConfig.shortcutWindowMs` (default 3000) is timed from the Menu
press and after each digit. nokia-os sets 39 and 2948 (Task 9). Path navigation to `menu` never
waits for the delay.
Deviation: phone-core's own `lists.test.ts` used the hardcoded standby ▲; it now passes
`TEST_STANDBY_KEYS` from `fixtures.ts`. The only website test using standby ▲/▼ was
`tests/menu-tree.test.ts`; no website test asserted the indicator while the window is open.
`cancelShortcut` now always emits (the open window is always visible), so the Menu window
timeout produces one snapshot on the website (no pixel change).

### Task 6 - phone-screen: injectable painter (TDD)

**Files:** `packages/phone-screen/src/renderer.ts`, `src/index.ts`, `README.md`,
`tests/renderer.test.ts` (new cases only).

- [x] TDD: a custom `paint` controls every pixel; `version` bumps only when output changes;
      `paint` and `welcomeText` together is a type error (`@ts-expect-error` test); the default is
      the existing renderer.
- [x] Export `type ScreenPainter`.
- [x] `git diff --stat main -- packages/phone-screen/src/render packages/phone-screen/src/font packages/phone-screen/src/icons packages/phone-screen/tests/fixtures`
      must be empty, and all existing phone-screen tests pass unmodified.
- [x] `mise exec -- vp run @hellotimber/phone-screen#test`, `vp run -r test`, `vp run website#build`, `vp check --fix`.
- [x] Commit: `feat(phone-screen): injectable screen painter`.

Deviation: none to the contract. The renderer hands the painter the framebuffer as-is (it still
holds the previous frame), so a custom painter clears it itself, as the legacy `renderScreen`
does; the README says so.

### Task 7 - Stock resources derived from goldens (TDD)

**Files:** `scripts/text-runs.ts`, `scripts/glyph-overrides.ts`, `scripts/harvest-glyphs.ts`,
`scripts/extract-resources.ts`, `src/resources/generated/{fonts,menu-icons,boot,status}.ts`,
`src/resources/index.ts`, `tests/harvest.test.ts`, `tests/resources.test.ts`.

- [x] `text-runs.ts`: per golden image, the text runs it contains:
      `{ font, text, top, inverted? }`. Transcribe them from the images, guided by the label
      table. This is the only manual input.
- [x] TDD the harvester on synthetic rows. It finds each run's ink columns in its band,
      inverting the band for selected rows, and splits glyphs on blank columns. Advance is the
      distance between consecutive left edges within a word, and space width comes from word
      gaps. It reports, without guessing: a segment count that differs from the character
      count, conflicting bitmaps or advances for the same character, and characters with
      unknown advance. Overrides in `glyph-overrides.ts` resolve the reported cases
      explicitly. Each override carries a comment naming its golden.
- [x] Extractor:
  - icons: per carousel `.anim` golden, take the union ink bounding box of all images within
    x 0..79, y 20..39. Assert no icon ink at y < 20 apart from label descenders. Emit the art,
    the origin and the timeline (image index per step, durations, `loopFrom` when the
    recording ends in a detected cycle, flagged `// loop inferred`);
  - boot: full-frame images and timeline from `boot/power-on`;
  - status: signal and battery ladders plus icons cropped from `standby/standby`.
- [x] Generated files start with `// GENERATED by scripts/<name>.ts from goldens/ - do not edit`.
- [x] TDD `resources.test.ts`: running extraction and harvesting in-process over `goldens/`
      deep-equals the committed generated data (freshness). Every font glyph is binary and
      consistent in height. Every label in `stockMenu`'s data table and every softkey is
      renderable (`missingStockGlyphs` returns `[]`).
- [x] Cross-check only: icon frame counts per menu against `$REF/extracted/6.39/menu/main_menu.json`.
      Report differences; do not import.
- [x] Run `vp run @hellotimber/nokia-os#extract-resources` twice; the second run produces no diff.
- [x] Commit: `feat(nokia-os): derive stock fonts, icons and boot frames from goldens`.

Deviation: a text run also takes optional `left`/`right` column bounds (default 0..83). Text bands
share rows with the standby bars, the rail and the indicator, so the harvester needs to know which
columns belong to the run. Overrides come in three kinds: `bearing` (the digits and thin `1` sit
one column into a tabular digit cell), `advance` (characters seen only at a word end; every
in-word measurement in all four fonts is ink plus one blank column), and `split` (the large `R` of
`Reminders` touches the `e`). Runs cover the standby, carousel and `.sub` stills, including the
pending Chat/Calculator screens; `.anim` images are not transcribed (their titles repeat the
stills).
Deviation: the goldens corrected the label table above: `Space impact`, `Divert/when busy`,
`Divert when/phone off/or no coverage`, `Warning tones` (one line), `Date setting` (one line).
The firmware keeps hidden entries' menu numbers: the last Call divert and Games entries show
`7-6` and `8-6` while the rail places them 5th of 5. Tasks 9 and 10 must let the indicator number
differ from the position (the rail uses the visible count).
Deviation: the generated files are JSON-style literals excluded from oxfmt (root
`vite.config.ts`), so the extractor's output is stable; the freshness test compares them as data.
An inferred loop is flagged with a `loopInferred: true` field rather than a comment (none occurs:
every icon settles). `resources.test.ts` checks that every transcribed label, value and softkey is
renderable; `stockMenu` lands in Task 9, which extends the check to its data table. Resource
accessors (`STOCK_FONTS`, `STOCK_MENU_ICONS`, `stockMenuGraphic`, `BOOT_FRAMES`, `BOOT_TIMELINE`,
`STATUS_SPRITES`) live in `src/resources/index.ts`; only `missingStockGlyphs` is public.
Cross-check (`$REF/extracted/6.39/menu/main_menu.json`, read only): icon record counts equal the
distinct golden frames except Call register (11 records, 12 frames: the 15 ms frame is a distinct
state) and Profiles (8 records, 4 distinct frames: the records spell the 0-1-2-3-0-3-2-1 sequence).

### Task 8 - Stock painter I: standby, boot, indicator, custom and unsupported (TDD against goldens)

**Files:** `src/display/{paint.ts,standby.ts,boot.ts,indicator.ts,unsupported.ts}`,
`tests/paint-standby.test.ts`, `tests/paint-boot.test.ts`.

- [x] TDD: `paintStockScreen` with the literal model
      `{ kind: "standby", carrier: "Orange F", clock: "10:10", signal: 4, battery: 4 }` equals
      `standby/standby`.
- [x] TDD: for every boot step, `{ kind: "boot", phase: "hands", frame }` equals that golden
      image; `off` is blank.
- [x] Signal and battery levels 0-3 drop bars from the top. They are UNVERIFIED and covered by
      a unit test only, since the kernel emits 4.
- [x] `custom` blits its frame verbatim. Kinds not used by the stock OS in this plan (`reader`,
      `editor`, `confirm`) paint the dotted-border "unsupported" marker plus the kind name, and
      the test asserts that marker.
- [x] Commit: `feat(nokia-os): stock standby and boot painting`.

Deviation: `tests/paint-indicator.test.ts` (new) checks `src/display/indicator.ts` against the
indicator band of every carousel still and asserted level-1 image, and the first-digit dots
against `menu/01-phone-book.anim` image `c`; `tests/support/goldens.ts` (new) loads goldens by id
for Tasks 10-11. Measured layout: softkeys and the operator are centred at
`floor((84 - advance width) / 2)` (`Menu`, `Select`, `Search`, `Options`, `Orange F` all fit, as
phone-screen's `drawTextCentered` computes); the standby clock's last digit cell ends at x 78;
the indicator's last digit cell ends at x 84. Until Task 10, `menu-carousel` and `list` paint the
unsupported marker too (`menu carousel`, since the small font has no `-`), and so does the legacy
boot `welcome` phase, which the stock phone never emits.

### Task 9 - Stock firmware composition (TDD)

**Files:** `src/firmware/{menu.ts,placeholder.ts,settings-snapshot.ts,phone.ts}`, `src/index.ts`,
`tests/firmware-menu.test.ts`, `tests/firmware-phone.test.ts`.

- [x] TDD `stockMenu`: 12 top-level entries in order with the graphics from Task 7 (each with a
      timeline), level-1 children per the table, presentations, `\n` line breaks, and no other
      levels. Paths are unique and kebab-case.
- [x] `PlaceholderApplication`: renders a `custom` frame (dotted border plus label in `small`).
      C exits to the parent, other keys are swallowed, and the path stays at the leaf.
- [x] `settings-snapshot.ts`: the `detail` values per the table. Clock settings and Date
      setting read the host ports.
- [x] TDD `createStockPhone`: rejects a carrier with missing glyphs and names the characters;
      `boot: "skip"` reaches standby immediately; animated boot uses the Task 7 timeline;
      standby ▲/▼ use the stock standby keys; the clock and date ports drive standby and the
      Clock page details.
- [x] Commit: `feat(nokia-os): stock v6.39 menu, placeholders and phone factory`.

Deviation: hidden entries keep their numbers through a kernel change, committed separately as
`feat(phone-core): submenu levels keep hidden entries' menu numbers`: a submenu `MenuLevel` may
skip an order (top-level orders stay contiguous), so Call divert's and Games' last entries are
`new MenuOrder(6)` after 1-4. Shortcuts resolve by number (Menu 7 6 opens Cancel all diverts;
7 5 is ignored); ▲/▼, selection and the rail use the visible position. The list model gains
`itemOrders`, emitted only when a level's numbers are not 1..n, so website models are unchanged.
VISION and the phone-core README record it.
Deviation: `stockMenu` is `createStockMenu()` without host ports; `createStockPhone` builds its
own menu with the config's `clock`/`date`, which feed the Clock settings and Date setting page
details. Slugs derive from labels (line breaks as spaces, apostrophes dropped) except where the
website's slug is reused (`write`, `snake`); Profiles slot 6 is `empty-2` (label `(empty)`,
UNVERIFIED). The placeholder frame painter is `src/display/placeholder.ts` (listed under Task
10), because the placeholder application renders it; its label lines are centred at a 9-row
pitch. `scripts/text-runs.ts` exports `LEVEL1`, and `tests/firmware-menu.test.ts` checks
`stockMenu` titles, presentations, labels, menu numbers and page values against it (Profiles
adds slot 6, which the goldens omit); `resources.test.ts` checks every `stockMenu` label renders
(titles in `large`, level-1 labels in `small`).

### Task 10 - Stock painter II: carousel, rail, rows, pages and placeholder (TDD against goldens)

**Files:** `src/display/{carousel.ts,rail.ts,list-rows.ts,list-pages.ts,placeholder.ts}`,
`tests/paint-carousel.test.ts`, `tests/paint-lists.test.ts`.

- [x] TDD: for each `menu/NN-<slug>` still, painting the literal carousel model (label and
      graphic from `stockMenu`, `menuIndicator: { segments: [NN], awaitingNext: false }`)
      matches the golden for exactly one `iconFrame` of that graphic.
- [x] TDD: `awaitingFirst` paints the dots; this matches the first `menu/01-phone-book.anim`
      image.
- [x] TDD: for every image of every asserted `.sub` golden, painting the literal list model
      (items from the level's labels, the selected index, `presentation`, `detail` from the
      snapshot, `menuIndicator: { segments: [NN, i+1], awaitingNext: false }`) equals the image.
- [x] TDD rail: bump offsets for n = 3, 5, 6, 8, 9, 10, 12 at first, middle and last positions.
      Pin the pixel shape.
- [x] TDD: a page line wider than the page throws and names the label (D10).
- [x] Commit: `feat(nokia-os): stock carousel, rail and submenu painting`.

Deviation: the kernel's submenu indicator is the level's own path (`[NN]`), not `[NN, i+1]`, and
the website depends on that. So the literal list models carry `segments: [NN]` (plus `itemOrders`
for Call divert and Games), and the stock painter appends the selected item's menu number
(`itemOrders[selected]`, else `selected + 1`) to draw `7-6`; the rail uses the visible position
and count. All 12 carousel stills (each matches exactly one icon frame), the first-digit dots and
every image of the ten asserted `.sub` goldens pass pixel-exact.
Deviation: measured layout: the carousel title is centred in x 0..77 at
`floor((78 - width) / 2)` (the rows band's columns; checked on all 12 stills). A rows label
wider than the band (x 2..77) also throws, like a page line (x 0..79). With one item the rail's
bump sits at the top. The rows window is `max(0, selected - 2)` only; how the firmware scrolls
back up is not captured (the model holds no window state). The placeholder frame painter landed
in Task 9.

### Task 11 - Acceptance: drive the stock phone through every asserted golden

**Files:** `tests/support/rig.ts`, `tests/acceptance.test.ts`.

- [x] Rig per "Scenario harness". Scenarios:
  - `boot/power-on`: hold power, record until standby; `expectTimeline`, then the final frame
    equals `standby/standby` (carrier `Orange F`, clock `10:10`);
  - `standby/standby`, `standby/idle` (10 s, no change);
  - `menu/01-phone-book.anim`: from standby, Menu (dots for 3000 ms, then `1`);
    `menu/NN.anim`: from item NN-1, ▼;
  - `menu/revisit.anim`, `menu/return.anim`, if present;
  - `menu/NN-<slug>`: the frame at the still's capture time, matched within ±2 ms of a frame
    boundary when the icon is animating;
  - `menu/NN-<slug>.sub`: Menu, ▼×(NN-1), Select, then ▼ per image.
- [x] Coverage guard: any asserted id without a scenario fails; pending ids are `it.todo`.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp check --fix`.
- [x] Commit: `test(nokia-os): pixel and timing acceptance against v6.39 goldens`.

Deviation: the thin font had only the digits of `10:10` and `13.10.2026`, so Clock settings
threw for any live time with 4, 5, 7, 8 or 9. A supplementary REF script,
`captures/scripts/v639-plan13-clock.cap`, runs `v639-setup.inc`'s setup twice (`reboot` between)
with the clock set to 19:48 and to 07:59, and shoots standby and every Clock page into
`clock-time/`. Four asserted goldens come from it (`standby/standby-1948`, `standby/standby-0759`,
`menu/11-clock.sub-1948`, `menu/11-clock.sub-0759`); `text-runs.ts` transcribes them and one
override (`thin 8`, ink 4 columns, a full digit cell) resolves the harvester's report. Both fonts
now hold every digit (`resources.test.ts`), so a live clock and date never throw. The firmware
keeps the leading zero (`07:59`) on standby and on the page.
Deviation: the same script records a rows list scrolling up (`menu-scroll-up/01-phone-book`,
golden `menu/01-phone-book.sub-up`, `pending:14`). The window is stateful and circular: from item 6
(window 4..6) ▲ moves the selection within the window, ▲ above it puts the selection on the top
row (window = selected), and ▲ from Search wraps to Voice tags shown as `Voice tags / Search /
Service Nos.` with Voice tags on top. The painter's `max(0, selected - 2)` matches only the
scroll-down captures. Asserting this needs window state in the kernel's list model, which is
beyond Task 11, so plan 14 owns it; how ▼ wraps from the last item is still uncaptured.
Deviation: a carousel still's capture time is per item, 3537-3576 ms after its trigger
(`STILL_AT_MS` in `tests/acceptance.test.ts`): `v639-all.cap` taps the key, records 3 s from
when the tap returns, then shoots, and the tap's return varies. Each time was measured in REF by
aligning the 3 s recording's first icon change with `menu-anim-long`. Every still matches the
frame on screen at that time (±2 ms).
Deviation: `record(durationMs, trigger)` ticks 1 ms before running `trigger` (the harness starts
recording before the key), and the trigger time is the rig time when `trigger` returns. The boot
scenario holds power and records with a trigger that ticks once, onto the tick where the 800 ms
long press turns the phone on. Frames are kept on a pixel change or a power change; a screen
replaced within the same millisecond is dropped. Every scenario drives real key presses (the
kernel's `navigate("menu")` skips the 39 ms delay, so no scenario uses it).

### Task 12 - Standalone demo and README

**Files:** `packages/nokia-os/demo/{index.html,main.ts,style.css}`, `packages/nokia-os/README.md`.

- [x] Demo: `createStockPhone` plus `createScreenRenderer({ paint: paintStockScreen, scale: 6 })`
      with a requestAnimationFrame tick loop. Keys: arrows → ▲/▼, Enter → Navi,
      Backspace/Escape → C, digits, `*`, `#`, and `p` → power (held for 1 s). Clickable buttons
      for the same keys. A carrier input validated with `missingStockGlyphs`. A "skip boot"
      toggle. A live `[role=status]` line showing `phone.path` and `screen.kind`.
- [x] Golden overlay: a select over `goldens/**` loaded with `import.meta.glob(..., { query: "?raw" })`
      and parsed with `scripts/golden-format.ts`. Overlay and difference views, as in
      phone-screen's harness. Dev-only.
- [x] Verify with `mise exec -- vp run @hellotimber/nokia-os#demo` and the project's
      `agent-browser` tool. Capture screenshots after boot, at standby, after Menu (dots) and in a
      pages submenu, and check the status line.
- [x] README: what the package is, the asset policy, the golden workflow (import → extract →
      test), standalone usage with phone-screen (and with phone-3d through the canvas), and the
      artefact table summary.
- [x] Commit: `feat(nokia-os): standalone stock OS demo`.

Deviation: the demo's golden overlay paints the current screen with `paintStockScreen` into its
own framebuffer (the renderer does not expose its pixels) and draws either the golden in magenta
over the LCD or a per-pixel difference (shared ink dark, phone-only red, golden-only blue) with a
count. The host clock and date ports format as the firmware does (`07:59`, `13.10.2026`). The
phone starts switched off; `P` or the Power button holds power for 1 s. Verified headless with
`agent-browser` (status line `path: standby · screen: off` → `boot` → `standby`, Menu dots, a
Messages page, Clock settings with the live time).

### Task 13 - Verification gate and documentation closeout

**Files:** this plan, `docs/plans/README.md`, `docs/specs/nokia-3310.md`.

- [x] `mise exec -- vp check --fix`, `mise exec -- vp run -r test`, `mise exec -- vp run website#build`.
- [x] Prove the website is untouched: `git diff --stat <commit before Task 1> -- website/src/routes website/src/panels website/public`
      is empty. Any website change must be limited to the Task 5 items.
- [x] Update the spec with verified facts (restart rule, settle/loop per icon, boot path) and
      remaining UNVERIFIED items.
- [x] Add completion notes here (fallbacks used, open questions answered), set the status to
      `done`, and update the README row. Add the follow-up plans below to the README as
      `not started`.
- [x] Commit: `docs: complete nokia-os foundation (plan 13)`.

## Follow-up plans (14+)

- **14 - Menu tree depth and stock widgets.** Implement every remaining navigable level from
  `docs/specs/nokia-3310-menu-tree.md` with goldens. Add the reusable stock widgets those levels
  need: option lists with selection marks, confirmation notes ("Done"-style animations with
  captured timings), `Options` menus, and multi-digit shortcut display. Give rows lists their
  stateful, circular window (kernel list-model state) so `menu/01-phone-book.sub-up` becomes
  asserted, and capture how ▼ wraps. Leaves without behaviour stay placeholders.
- **15 - Storage port and Settings.** Add an EEPROM-like persistence port (in-memory default,
  host adapters), replace the plan 13 settings snapshot with real state, and implement Settings
  (call, phone and security settings, welcome note, restore factory settings) and the factory
  defaults, with the virgin-EEPROM values resolved.
- **16 - Tones and sound sequencer.** Add a tone sequencer driven by the kernel clock with
  captured event timing (`*.events.csv`/`.wav`), keypad and warning tones, the ringing tone list
  and preview, ringing volume, alerts, vibration events, and the Composer.
- **17 - Profiles.** Add profile activation and personalisation on the storage port, the power-key
  short-press profile list, and per-profile tone settings. Resolve the slot 5/6 labels.
- **18 - Messages and Chat.** Add stock text entry (multi-tap and dictionary indicators in stock
  fonts), Write messages, Inbox/Outbox, Templates, Smileys, Picture messages, message settings,
  and the Chat flow (`menu/03-chat.sub` goldens become asserted).
- **19 - Phone book.** Add a SIM/phone memory model on the storage port: Search (and standby ▲),
  Add name, Edit, Erase, Speed dials, Options/memory status, Send b'card and Voice tag stubs as
  the firmware shows them.
- **20 - Calculator restyle.** Implement the stock calculator screens, operators and options in
  stock fonts (`menu/09-calculator.sub` asserted), reusing the website calculator's arithmetic
  rules where they agree with captures.
- **21 - Clock and Reminders.** Implement the alarm clock with snooze, clock and date settings,
  stopwatch, countdown timer, auto update, reminders with alarms, and the standby clock toggle,
  on the host clock port.
- **22 - Call register and Call divert.** Add call lists (Missed/Received/Dialled, standby ▼
  redial), durations and costs, and the divert flows with the firmware's "no network" notes.
- **23 - Games I: Snake II.** Add the splash, menu, level, top score and gameplay in stock
  sprites. Recapture with a fixed level or EEPROM to correct the emulator speed issue.
- **24 - Games II: Space Impact, Bantumi, Pairs II.** Implement each game, its options and its
  top scores, from captures.
- **25 - Keyguard and backlight.** Add Menu+`*` lock and Unlock+`*`, the keyguard icon and
  notes, and backlight/keypad LED timing from the `leds` column, exposed as a phone-3d
  `backlightOn` signal through the host.

Portfolio integration (how the website adopts nokia-os) is deliberately not sequenced; Lachlan
decides it later.

## Open questions for Lachlan

Resolved provisionally by the orchestrating session (2026-10-13) so execution is not blocked;
each is cheap to reverse. Lachlan may override any of them.

1. **Demo carrier default:** configurable; the demo defaults to `Telstra` if the harvested
   font covers it, otherwise `NOKIA`. Not a website concern.
2. **Profiles slot 6:** Task 0 also runs Settings → Restore factory settings (security code
   `12345`) in the harness and re-captures the Profiles list. If that yields a real factory
   name, use it; otherwise `(empty)` (UNVERIFIED) until the profiles plan.
3. **Page values:** Task 0 captures level-1 pages again after Restore factory settings and
   imports those as the asserted page goldens; the virgin-EEPROM captures are then omitted as
   artefacts. If factory restore is unavailable or changes nothing, keep the captured values.
4. **Live standby clock on the website:** accepted. It fixes a latent bug.
5. **Boot path:** the D12 composition is acceptable if Task 0 cannot produce a clean boot.
6. **D1 runtime dependency on phone-screen:** accepted.

## Done means

- `@hellotimber/nokia-os` exists, with declared dependencies on phone-core and phone-screen only.
- Every `asserted` golden (boot, standby, idle, 12 carousel stills, 12 icon timelines, 10 level-1
  sequences, and the probes when captured) passes pixel-for-pixel, and every timeline passes
  within ±2 ms after alignment.
- The coverage guard proves no asserted golden lacks a scenario. Pending goldens are `it.todo`
  entries that name their plan.
- Fonts, icons, boot frames and status art are generated from committed goldens and are fresh.
  Nothing from `$REF/extracted` is in the repo.
- The demo runs the stock OS from power-on with the keyboard.
- The kernel is still Nokia-agnostic: no stock labels, slugs or timings in `phone-core`.
- Website pixels, routes and content are unchanged. Existing phone-screen goldens and all
  website tests pass, and the only website edits are the Task 5 config and assertions.
- `vp check`, `vp run -r test` and `vp run website#build` pass, and VISION, AGENTS, the spec and the
  plans README match what shipped.

## Completion notes

- Task 3 (importer): 41 fixtures, 39 asserted and 2 pending (`menu/03-chat.sub` → plan 18,
  `menu/09-calculator.sub` → plan 20). Fallbacks: only `boot/power-on`, which uses the D12
  composition (`boot/power-on` 000-003 + `boot/welcome` 004-010) because Task 0 could not produce
  `boot-clean/`. Every `menu/NN-<slug>.anim` uses `menu-anim-long/` (no `before-recording`
  fallback), and both probes (`menu/revisit.anim`, `menu/return.anim`) are present. The `.sub`
  goldens are the virgin-EEPROM captures (factory restore was unavailable); Profiles omits `06`.
- Task 11 (acceptance): 46 fixtures, 43 asserted and 3 pending. All 43 asserted goldens pass
  pixel for pixel through key-driven scenarios, and all 16 asserted timelines (boot, idle, 12
  icons, both probes) pass within ±2 ms after alignment. The supplementary REF script
  `captures/scripts/v639-plan13-clock.cap` added `clock-time/` (four asserted goldens: standby and
  the Clock pages at 19:48 and 07:59, which complete the digits and thin fonts) and
  `menu-scroll-up/` (`menu/01-phone-book.sub-up`, `pending:14`). Pending: `menu/03-chat.sub`
  (plan 18), `menu/09-calculator.sub` (plan 20), `menu/01-phone-book.sub-up` (plan 14).
- Task 12 (demo): `vp run @hellotimber/nokia-os#demo` boots the stock OS from power-on with the
  keyboard; verified headless with `agent-browser`.
- Task 13 (gate): `vp check`, `vp run -r test` and `vp run website#build` pass. `git diff --stat
b5baa66 -- website/src/routes website/src/panels website/public` is empty; the only website
  changes since plan 13 began are Task 5's (`content/menu.ts`, `phone/phone.ts`,
  `tests/menu-tree.test.ts`) and the regenerated `routeTree.gen.ts` (Task 2 deviation).
- Open questions, as resolved: (1) the demo operator is `Telstra`; (2) Profiles slot 6 stays
  `(empty)`, UNVERIFIED (factory restore was refused); (3) the asserted page values are the
  virgin-EEPROM captures; (4) the live standby clock is in the kernel (D6); (5) boot is the D12
  composition, UNVERIFIED as one sequence; (6) nokia-os depends on phone-screen at runtime (D1).
- Still UNVERIFIED (recorded in the spec §10): the boot composition, the indicator after a typed
  shortcut digit, rows-list ▼ wrap (and ▲ scrolling, captured but not reproduced), signal and
  battery levels below full, Profiles slot 6, and the firmware's power-key threshold.
