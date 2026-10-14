# Plan 13 - Nokia OS foundation: the stock 3310 v6.39 firmware as a package

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 01-12 complete.
**Ground truth:** emulator captures of the real v6.39 firmware under
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only),
reproduced in-repo as committed golden fixtures (`packages/nokia-os/goldens/`). Read
`$REF/captures/README.md` before touching captures. Deeper menu levels come from
`docs/specs/nokia-3310-menu-tree.md` (produced by a concurrent crawl). This plan does not need that spec.
**Status:** not started.

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

| Source                           | Contents                                                                     | Use                                                        |
| -------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `boot/power-on/` (6 frames)      | blank (LED off), all-on, blank, battery ladder, blank 42 ms, security prompt | frames 0-3 (fallback boot); 4-5 omitted                    |
| `boot/welcome/` (16 frames)      | "Code accepted" 0-3, hands 4-10, clock prompt 11-15                          | frames 4-10 (hands); others omitted                        |
| `standby/01-standby.png`         | standby, "Orange F", 10:10                                                   | asserted (artefact values as test inputs)                  |
| `standby/standby-10s/`           | one frame for 10 s                                                           | asserted: no blinking, no change                           |
| `menu/NN-<slug>.png` (12)        | carousel after its 3 s recording                                             | asserted                                                   |
| `menu/NN-<slug>/anim/`           | ~3 s of icon frames (truncated)                                              | fallback only; replaced by `menu-anim-long/` from Task 0   |
| `menu/NN-<slug>/sub/MM.png`      | level-1 screens in scroll order                                              | asserted, except Chat/Calculator (pending) and Profiles 06 |
| `menu-anim-long/` (Task 0)       | per-item transition + 10 s, plus revisit/return probes                       | asserted timelines                                         |
| `boot-clean/` (Task 0, optional) | power-on to standby without the security prompt                              | asserted boot timeline if produced                         |

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

export class MenuGraphic {
  constructor(id: string, timeline?: Timeline);
  readonly id: string;
  readonly timeline: Timeline | undefined;
}

export type MenuPresentation = "rows" | "pages";

export interface SubmenuOptions<Metadata = unknown> {
  presentation?: MenuPresentation; // default "rows"
  /** Current-value text for a child (e.g. "Off"); undefined = none. Opaque host function. */
  detail?: (child: MenuEntry<Metadata>) => string | undefined;
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

| Fixture id                  | Source (prefer → fallback)                                                             | Kind     | Status                         |
| --------------------------- | -------------------------------------------------------------------------------------- | -------- | ------------------------------ |
| `boot/power-on`             | `boot-clean/power-on` → `boot/power-on` frames 000-003 + `boot/welcome` 004-010        | timeline | asserted                       |
| `standby/standby`           | `standby/01-standby.png`                                                               | still    | asserted                       |
| `standby/idle`              | `standby/standby-10s`                                                                  | timeline | asserted                       |
| `menu/NN-<slug>` (×12)      | `menu/NN-<slug>.png`                                                                   | still    | asserted                       |
| `menu/NN-<slug>.anim` (×12) | `menu-anim-long/NN-<slug>` → `menu/NN-<slug>/anim` (`trigger-frame: before-recording`) | timeline | asserted                       |
| `menu/revisit.anim`         | `menu-anim-long/90-revisit` (only if captured)                                         | timeline | asserted                       |
| `menu/return.anim`          | `menu-anim-long/91-return` (only if captured)                                          | timeline | asserted                       |
| `menu/NN-<slug>.sub` (×10)  | `menu/NN-<slug>/sub/*.png` (Profiles omits `06`)                                       | stills   | asserted                       |
| `menu/03-chat.sub`          | `menu/03-chat/sub/*.png`                                                               | stills   | `pending:18` (Messages & Chat) |
| `menu/09-calculator.sub`    | `menu/09-calculator/sub/01.png`                                                        | stills   | `pending:20` (Calculator)      |

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
which becomes `\n` in data. Breaks marked "verify" must be read from the golden before use.

| #   | Slug            | Label         | Kind / presentation | Level-1 children (order)                                                                                                                                                        |
| --- | --------------- | ------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `phone-book`    | Phone book    | submenu, rows       | Search, Service Nos., Add name, Erase, Edit, Assign tone, Send b'card, Options, Speed dials, Voice tags                                                                         |
| 2   | `messages`      | Messages      | submenu, pages      | Write/messages, Inbox, Outbox, Picture/messages, Templates, Smileys, Message/settings (verify), Info/service, Voice/mailbox/number (verify), Service/command/editor             |
| 3   | `chat`          | Chat          | application         | placeholder (captured first screens are `pending:18`)                                                                                                                           |
| 4   | `call-register` | Call register | submenu, pages      | Missed/calls, Received/calls, Dialled/numbers, Erase recent call/lists, Show call/duration, Show call/costs, Call cost/settings (verify), Prepaid credit                        |
| 5   | `tones`         | Tones         | submenu, pages      | Ringing/tone, Ringing/volume, Incoming/call alert, Composer, Message/alert tone, Keypad/tones, Warning and game tones (verify), Vibrating/alert, Screen saver                   |
| 6   | `settings`      | Settings      | submenu, pages      | Call/settings, Phone/settings, Security/settings, Restore/factory/settings (verify)                                                                                             |
| 7   | `call-divert`   | Call divert   | submenu, pages      | Divert all/voice calls/without ringing, Divert when/busy (verify), Divert if not/answered (verify), Divert if out/of reach/... (verify; third line present), Cancel all/diverts |
| 8   | `games`         | Games         | submenu, rows       | Snake II, Space Impact, Bantumi, Pairs II, Settings                                                                                                                             |
| 9   | `calculator`    | Calculator    | application         | placeholder (captured first screen is `pending:20`)                                                                                                                             |
| 10  | `reminders`     | Reminders     | submenu, rows       | Add new, View all, Erase (verify)                                                                                                                                               |
| 11  | `clock`         | Clock         | submenu, pages      | Alarm/clock, Clock/settings, Date setting, Stopwatch, Countdown/timer, Auto update of/date and time (verify)                                                                    |
| 12  | `profiles`      | Profiles      | submenu, rows       | General, Silent, Discreet, Loud, (empty), (empty) - slot 6 UNVERIFIED                                                                                                           |

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

- [ ] Read `$REF/captures/README.md`. Build the harness if `cap` asks for it. Do not modify the
      emulator, existing captures or `v639-all.cap`. The concurrent crawl may be using the
      harness, so write only the new paths above.
- [ ] Write `v639-plan13.cap`: `include v639-setup.inc`, then `key c` and `run 2s` to clear the
      first-standby prompt, then:
  - `record menu-anim-long/01-phone-book start`, `key menu`, `run 10s`, `record stop`;
  - for items 2-12: `record menu-anim-long/NN-<slug> start`, `key down`, `run 10s`, `record stop`;
  - `90-revisit`: `record ... start`, `key up`, `run 6s`, `record stop` (12 → 11: does the icon restart?);
  - `91-return`: `record ... start`, `key menu`, `run 1500ms`, `key c`, `run 6s`, `record stop`
    (does the icon restart after returning from a submenu?).
- [ ] Clean boot, time-boxed to one attempt. Find the setting that removes the boot
      security-code prompt (Settings → Security settings; use `docs/specs/nokia-3310-menu-tree.md`
      if it exists). Then `saveflash firmware/work/v639-clean.fls`, `reboot` from it, and record to
      `boot-clean/power-on` for 20 s. If the prompt cannot be removed, write
      `boot-clean/NOT-ACHIEVED.md` describing what was tried, and use the D12 fallback.
- [ ] Factory defaults: after the clean-boot step, run Settings → Restore factory settings
      (security code `12345`), `saveflash firmware/work/v639-factory.fls`, then re-record every
      level-1 list into `factory-sub/NN-<slug>/` (same scroll order as `menu/NN-<slug>/sub`).
      These replace the virgin-EEPROM page values and the Profiles slot-6 artefact as asserted
      goldens (see Open questions 2-3). If restore is unavailable or changes nothing, note it in
      the README section and keep the original `sub` captures.
- [ ] Run the script with `tools/harness/cap firmware/raw/6.39/combined/3310_v639_ppm_E_virgin_eeprom_2MiB.fls captures/scripts/v639-plan13.cap captures/6.39`.
- [ ] Check: each `menu-anim-long/NN-*/timings.csv` has frame 0 = the previous screen and
      frame 1 = the new screen. Each recording either settles (last row is a lower bound
      ≥ 1 s) or visibly loops. Record which in the README section.
- [ ] Append a "Plan 13 supplementary captures" section to `$REF/captures/README.md`.
- [ ] No commit. Report: icons that settle vs loop, restart behaviour from the probes, and the
      clean-boot outcome.

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `AGENTS.md`, `docs/plans/README.md`, `docs/specs/nokia-3310.md`, this plan.

- [ ] VISION: add the `@hellotimber/nokia-os` row to the package table and architecture diagram,
      the phone-core additions, the `ScreenPainter` option, and the nokia-os contract,
      all exactly as in "Contract changes". State that the website does not consume nokia-os yet.
- [ ] AGENTS.md: add `nokia-os/` to the workspace layout. Add `nokia-os ──▶ phone-core,
  phone-screen` to the allowed directions. Clarify rule 3 (declared dependencies). Add the
      golden workflow: REF is never committed, and `import-captures` / `extract-resources`
      regenerate `goldens/` and `src/resources/generated/`.
- [ ] Spec: add "§10 Firmware ground truth (v6.39 captures)". It covers the two submenu
      presentations, the rail and indicator geometry, first-digit dots, firmware line breaks,
      the 12-entry main menu, v6.39 level-1 labels, the boot self-test, and the artefact table.
      Mark plan 12's photographic geometry as _website-only_. Keep §5 as manual-sourced history
      and point to §10 and `nokia-3310-menu-tree.md`.
- [ ] Plans README: add row 13 (`not started` → `in progress`), with dependencies `01-12`.
- [ ] No runtime code.
- [ ] `mise exec -- vp check --fix`.
- [ ] Commit: `docs: define nokia-os package and stock firmware contracts (plan 13)`.

### Task 2 - Scaffold `@hellotimber/nokia-os`, golden format and diff helpers (TDD)

**Files:** `packages/nokia-os/{package.json,tsconfig.json,vite.config.ts,README.md,src/index.ts}`,
`scripts/golden-format.ts`, `tests/support/golden.ts`, `tests/golden-format.test.ts`,
`tests/golden-diff.test.ts`.

- [ ] Scaffold with `mise exec -- vp create vite:library --directory packages/nokia-os --no-interactive --no-git`.
      Delete the cruft listed in AGENTS.md.
- [ ] `package.json`: source exports; scripts `test` (`vp test run`), `demo` (`vp dev demo`),
      `import-captures` (`node scripts/import-captures.ts`) and `extract-resources`
      (`node scripts/extract-resources.ts`); dependencies `@hellotimber/phone-core` and
      `@hellotimber/phone-screen` (`workspace:*`); devDependencies `@types/node`, `typescript`,
      `vite-plus` (`catalog:`).
- [ ] `tsconfig.json`: the AGENTS template, with include `src`, `tests`, `scripts`, `demo`, plus
      `"allowImportingTsExtensions": true` and `types: ["vite-plus/client", "node"]`.
- [ ] TDD `golden-format.ts`: parse and serialize round trip; reject bad headers, wrong
      dimensions, non-`#`/`.` characters, duplicate images, unknown image references,
      non-monotonic starts and misplaced `+`. Every error names `file:line`.
- [ ] TDD `expectLcd` / `expectTimeline`: assert the exact failure text for a synthetic 3-pixel
      difference (window, ruler, legend, counts, first coordinate). Cover `LCD_DIFF=full`.
      Cover timing failures (early, late, missing image, last-frame lower bound) and alignment
      by `trigger-frame` and by `before-recording`.
- [ ] `mise exec -- vp install`, `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): scaffold package with LCD golden format and diff helpers`.

### Task 3 - Capture importer and committed goldens

**Files:** `scripts/png.ts`, `scripts/capture-set.ts`, `scripts/import-captures.ts`,
`tests/png.test.ts`, `tests/goldens-integrity.test.ts`, `goldens/**`.

- [ ] TDD `png.ts` against PNGs built inside the test with `node:zlib` (1-bit and 8-bit palette,
      every filter type, rejection of interlaced and truecolour images).
- [ ] Encode the capture-set table above. Each entry carries id, source, fallback, frame
      selection, status, note and omitted reasons.
- [ ] Implement the importer per "Importer CLI". Compute `source-sha256`. Deduplicate timeline
      images. Use cumulative rounding.
- [ ] TDD `goldens-integrity.test.ts`: every index entry parses and is 84x48; ids are unique;
      no fixture file is missing from the index; asserted timelines have a `trigger-frame`;
      every `pending` status names a plan.
- [ ] Run the importer against REF twice; the second run must produce no diff.
- [ ] Note in this plan's completion notes which rows used fallbacks.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): import v6.39 LCD captures as committed goldens`.

### Task 4 - phone-core: timelines for menu graphics and boot (TDD)

**Files:** `packages/phone-core/src/timeline.ts` (new), `menu.ts`, `machine.ts`, `types.ts`,
`index.ts`, `README.md`; tests `timeline.test.ts` (new), `animated-graphics.test.ts` (new),
`power.test.ts`.

- [ ] TDD `Timeline`: validation, `frameAt` at step boundaries (a step starts exactly at its
      cumulative start), hold-last, `loopFrom` cycles, `durationMs`, defensive copy and freeze.
- [ ] TDD `MenuGraphic(id, timeline?)` and its immutability.
- [ ] TDD machine: `iconFrame` is present only for timeline graphics. Each restart condition
      (per the Task 0 probes) resets it. Subscribers are notified exactly when the frame index
      changes, and never on ticks that leave it unchanged. A settled timeline stops producing
      snapshots.
- [ ] TDD `bootTimeline`: the boot model's frame follows the timeline; standby follows its
      duration; `bootMs: 0` still skips; conflicting `bootMs` throws; deep-link navigation during
      boot is still honoured.
- [ ] Existing tests pass unchanged. Graphics without a timeline produce identical models.
- [ ] `mise exec -- vp run @hellotimber/phone-core#test`, `vp run -r test`, `vp run website#build`, `vp check --fix`.
- [ ] Commit: `feat(phone-core): tick-driven timelines for menu graphics and boot`.

### Task 5 - phone-core: presentation, details, first-digit state, host-owned standby policy (TDD)

**Files:** `packages/phone-core/src/{menu.ts,machine.ts,types.ts,index.ts}`, README; tests
`presentation.test.ts` (new), `shortcuts.test.ts`, `carousel.test.ts`, `power.test.ts`,
`fixtures.ts`; `website/src/phone/phone.ts`, `website/src/content/menu.ts`, and the website
tests that exercise standby ▲/▼ or assert the indicator while the shortcut window is open.

- [ ] TDD `SubmenuOptions`: `presentation` defaults to rows. `list.presentation` is emitted only
      for pages. `detail` is emitted only when the reader returns a string, is evaluated for the
      _selected_ child, and does not change when the selection moves to a child without a value.
- [ ] TDD tick refresh: when a standby `clock()` value or a visible `detail` value changes
      between ticks, exactly one snapshot is emitted; an unchanged value emits none.
- [ ] TDD `awaitingFirst`: present from Menu until the first digit, the timeout or a
      non-digit key; absent everywhere else. Update the exact-model assertions that observe
      the open window.
- [ ] TDD `standbyKeys`: configured paths open on ▲/▼; absent or unknown paths are no-ops.
      Remove the hardcoded slugs from `machine.ts`.
- [ ] Carrier default `""`; update the power test that pinned `LACHLAN`.
- [ ] Website: export `SITE_STANDBY_KEYS` (the current two paths) from `website/src/content/menu.ts`.
      Pass it in `phone.ts` and in every website test helper that relies on standby ▲/▼. Make no
      other website changes.
- [ ] `mise exec -- vp run -r test`, `vp run website#build`, `vp check --fix`.
- [ ] Commit: `feat(phone-core): menu presentation, item details, first-digit state, host standby keys`.

### Task 6 - phone-screen: injectable painter (TDD)

**Files:** `packages/phone-screen/src/renderer.ts`, `src/index.ts`, `README.md`,
`tests/renderer.test.ts` (new cases only).

- [ ] TDD: a custom `paint` controls every pixel; `version` bumps only when output changes;
      `paint` and `welcomeText` together is a type error (`@ts-expect-error` test); the default is
      the existing renderer.
- [ ] Export `type ScreenPainter`.
- [ ] `git diff --stat main -- packages/phone-screen/src/render packages/phone-screen/src/font packages/phone-screen/src/icons packages/phone-screen/tests/fixtures`
      must be empty, and all existing phone-screen tests pass unmodified.
- [ ] `mise exec -- vp run @hellotimber/phone-screen#test`, `vp run -r test`, `vp run website#build`, `vp check --fix`.
- [ ] Commit: `feat(phone-screen): injectable screen painter`.

### Task 7 - Stock resources derived from goldens (TDD)

**Files:** `scripts/text-runs.ts`, `scripts/glyph-overrides.ts`, `scripts/harvest-glyphs.ts`,
`scripts/extract-resources.ts`, `src/resources/generated/{fonts,menu-icons,boot,status}.ts`,
`src/resources/index.ts`, `tests/harvest.test.ts`, `tests/resources.test.ts`.

- [ ] `text-runs.ts`: per golden image, the text runs it contains:
      `{ font, text, top, inverted? }`. Transcribe them from the images, guided by the label
      table. This is the only manual input.
- [ ] TDD the harvester on synthetic rows. It finds each run's ink columns in its band,
      inverting the band for selected rows, and splits glyphs on blank columns. Advance is the
      distance between consecutive left edges within a word, and space width comes from word
      gaps. It reports, without guessing: a segment count that differs from the character
      count, conflicting bitmaps or advances for the same character, and characters with
      unknown advance. Overrides in `glyph-overrides.ts` resolve the reported cases
      explicitly. Each override carries a comment naming its golden.
- [ ] Extractor:
  - icons: per carousel `.anim` golden, take the union ink bounding box of all images within
    x 0..79, y 20..39. Assert no icon ink at y < 20 apart from label descenders. Emit the art,
    the origin and the timeline (image index per step, durations, `loopFrom` when the
    recording ends in a detected cycle, flagged `// loop inferred`);
  - boot: full-frame images and timeline from `boot/power-on`;
  - status: signal and battery ladders plus icons cropped from `standby/standby`.
- [ ] Generated files start with `// GENERATED by scripts/<name>.ts from goldens/ - do not edit`.
- [ ] TDD `resources.test.ts`: running extraction and harvesting in-process over `goldens/`
      deep-equals the committed generated data (freshness). Every font glyph is binary and
      consistent in height. Every label in `stockMenu`'s data table and every softkey is
      renderable (`missingStockGlyphs` returns `[]`).
- [ ] Cross-check only: icon frame counts per menu against `$REF/extracted/6.39/menu/main_menu.json`.
      Report differences; do not import.
- [ ] Run `vp run @hellotimber/nokia-os#extract-resources` twice; the second run produces no diff.
- [ ] Commit: `feat(nokia-os): derive stock fonts, icons and boot frames from goldens`.

### Task 8 - Stock painter I: standby, boot, indicator, custom and unsupported (TDD against goldens)

**Files:** `src/display/{paint.ts,standby.ts,boot.ts,indicator.ts,unsupported.ts}`,
`tests/paint-standby.test.ts`, `tests/paint-boot.test.ts`.

- [ ] TDD: `paintStockScreen` with the literal model
      `{ kind: "standby", carrier: "Orange F", clock: "10:10", signal: 4, battery: 4 }` equals
      `standby/standby`.
- [ ] TDD: for every boot step, `{ kind: "boot", phase: "hands", frame }` equals that golden
      image; `off` is blank.
- [ ] Signal and battery levels 0-3 drop bars from the top. They are UNVERIFIED and covered by
      a unit test only, since the kernel emits 4.
- [ ] `custom` blits its frame verbatim. Kinds not used by the stock OS in this plan (`reader`,
      `editor`, `confirm`) paint the dotted-border "unsupported" marker plus the kind name, and
      the test asserts that marker.
- [ ] Commit: `feat(nokia-os): stock standby and boot painting`.

### Task 9 - Stock firmware composition (TDD)

**Files:** `src/firmware/{menu.ts,placeholder.ts,settings-snapshot.ts,phone.ts}`, `src/index.ts`,
`tests/firmware-menu.test.ts`, `tests/firmware-phone.test.ts`.

- [ ] TDD `stockMenu`: 12 top-level entries in order with the graphics from Task 7 (each with a
      timeline), level-1 children per the table, presentations, `\n` line breaks, and no other
      levels. Paths are unique and kebab-case.
- [ ] `PlaceholderApplication`: renders a `custom` frame (dotted border plus label in `small`).
      C exits to the parent, other keys are swallowed, and the path stays at the leaf.
- [ ] `settings-snapshot.ts`: the `detail` values per the table. Clock settings and Date
      setting read the host ports.
- [ ] TDD `createStockPhone`: rejects a carrier with missing glyphs and names the characters;
      `boot: "skip"` reaches standby immediately; animated boot uses the Task 7 timeline;
      standby ▲/▼ use the stock standby keys; the clock and date ports drive standby and the
      Clock page details.
- [ ] Commit: `feat(nokia-os): stock v6.39 menu, placeholders and phone factory`.

### Task 10 - Stock painter II: carousel, rail, rows, pages and placeholder (TDD against goldens)

**Files:** `src/display/{carousel.ts,rail.ts,list-rows.ts,list-pages.ts,placeholder.ts}`,
`tests/paint-carousel.test.ts`, `tests/paint-lists.test.ts`.

- [ ] TDD: for each `menu/NN-<slug>` still, painting the literal carousel model (label and
      graphic from `stockMenu`, `menuIndicator: { segments: [NN], awaitingNext: false }`)
      matches the golden for exactly one `iconFrame` of that graphic.
- [ ] TDD: `awaitingFirst` paints the dots; this matches the first `menu/01-phone-book.anim`
      image.
- [ ] TDD: for every image of every asserted `.sub` golden, painting the literal list model
      (items from the level's labels, the selected index, `presentation`, `detail` from the
      snapshot, `menuIndicator: { segments: [NN, i+1], awaitingNext: false }`) equals the image.
- [ ] TDD rail: bump offsets for n = 3, 5, 6, 8, 9, 10, 12 at first, middle and last positions.
      Pin the pixel shape.
- [ ] TDD: a page line wider than the page throws and names the label (D10).
- [ ] Commit: `feat(nokia-os): stock carousel, rail and submenu painting`.

### Task 11 - Acceptance: drive the stock phone through every asserted golden

**Files:** `tests/support/rig.ts`, `tests/acceptance.test.ts`.

- [ ] Rig per "Scenario harness". Scenarios:
  - `boot/power-on`: hold power, record until standby; `expectTimeline`, then the final frame
    equals `standby/standby` (carrier `Orange F`, clock `10:10`);
  - `standby/standby`, `standby/idle` (10 s, no change);
  - `menu/01-phone-book.anim`: from standby, Menu (dots for 3000 ms, then `1`);
    `menu/NN.anim`: from item NN-1, ▼;
  - `menu/revisit.anim`, `menu/return.anim`, if present;
  - `menu/NN-<slug>`: the frame at the still's capture time, matched within ±2 ms of a frame
    boundary when the icon is animating;
  - `menu/NN-<slug>.sub`: Menu, ▼×(NN-1), Select, then ▼ per image.
- [ ] Coverage guard: any asserted id without a scenario fails; pending ids are `it.todo`.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp check --fix`.
- [ ] Commit: `test(nokia-os): pixel and timing acceptance against v6.39 goldens`.

### Task 12 - Standalone demo and README

**Files:** `packages/nokia-os/demo/{index.html,main.ts,style.css}`, `packages/nokia-os/README.md`.

- [ ] Demo: `createStockPhone` plus `createScreenRenderer({ paint: paintStockScreen, scale: 6 })`
      with a requestAnimationFrame tick loop. Keys: arrows → ▲/▼, Enter → Navi,
      Backspace/Escape → C, digits, `*`, `#`, and `p` → power (held for 1 s). Clickable buttons
      for the same keys. A carrier input validated with `missingStockGlyphs`. A "skip boot"
      toggle. A live `[role=status]` line showing `phone.path` and `screen.kind`.
- [ ] Golden overlay: a select over `goldens/**` loaded with `import.meta.glob(..., { query: "?raw" })`
      and parsed with `scripts/golden-format.ts`. Overlay and difference views, as in
      phone-screen's harness. Dev-only.
- [ ] Verify with `mise exec -- vp run @hellotimber/nokia-os#demo` and the project's
      `agent-browser` tool. Capture screenshots after boot, at standby, after Menu (dots) and in a
      pages submenu, and check the status line.
- [ ] README: what the package is, the asset policy, the golden workflow (import → extract →
      test), standalone usage with phone-screen (and with phone-3d through the canvas), and the
      artefact table summary.
- [ ] Commit: `feat(nokia-os): standalone stock OS demo`.

### Task 13 - Verification gate and documentation closeout

**Files:** this plan, `docs/plans/README.md`, `docs/specs/nokia-3310.md`.

- [ ] `mise exec -- vp check --fix`, `mise exec -- vp run -r test`, `mise exec -- vp run website#build`.
- [ ] Prove the website is untouched: `git diff --stat <commit before Task 1> -- website/src/routes website/src/panels website/public`
      is empty. Any website change must be limited to the Task 5 items.
- [ ] Update the spec with verified facts (restart rule, settle/loop per icon, boot path) and
      remaining UNVERIFIED items.
- [ ] Add completion notes here (fallbacks used, open questions answered), set the status to
      `done`, and update the README row. Add the follow-up plans below to the README as
      `not started`.
- [ ] Commit: `docs: complete nokia-os foundation (plan 13)`.

## Follow-up plans (14+)

- **14 - Menu tree depth and stock widgets.** Implement every remaining navigable level from
  `docs/specs/nokia-3310-menu-tree.md` with goldens. Add the reusable stock widgets those levels
  need: option lists with selection marks, confirmation notes ("Done"-style animations with
  captured timings), `Options` menus, and multi-digit shortcut display. Leaves without behaviour
  stay placeholders.
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
