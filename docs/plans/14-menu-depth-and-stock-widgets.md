# Plan 14 - Menu tree depth and stock widgets

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plan 13 complete (`@hellotimber/nokia-os` with level 0/1, goldens, painter).
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only):
`$REF/captures/6.39/tree.json` (the crawled tree), `$REF/captures/6.39/tree/` (per-node crawl
captures, reference only), and the canonical plan 14 captures that Task 0 writes to
`$REF/captures/6.39/plan14/`. `docs/specs/nokia-3310-menu-tree.md` is the human-readable form of
`tree.json`. Read `$REF/captures/README.md` and plan 13 in full before starting.
**Status:** in progress.

## Goal

Make the stock v6.39 menu tree navigable end to end in `@hellotimber/nokia-os`, pixel- and
timing-faithful to the captures:

- every menu level below level 1 from `docs/specs/nokia-3310-menu-tree.md`, in order, with hidden
  menu-number gaps, both presentations, the level's softkey and its opening selection;
- the stateful, circular rows window (`menu/01-phone-book.sub-up` becomes asserted; ▼ wrap from
  the last item captured and asserted);
- the generic stock widgets the leaves need: option lists (single choice, unset state,
  multi-select marks), timed notes, static notes, progress notes, confirm queries, info pages and
  info screens, level bars, text pages, game splash intros, and number/code/text input prompts
  as far as their first screen;
- an in-memory settings store so option-list choices persist and pages show them;
- a golden pipeline that scales to the whole tree: a rule-based asserted set, generic
  key-driven scenarios, and a coverage guard over every tree node.

Leaves that are whole applications keep opening the plan 13 placeholder, each tagged with the
plan that owns it ("Leaf ownership"). The website does not change. How the portfolio uses the
stock OS is decided later.

## Why this plan exists (measured gap)

| Area                    | nokia-os after plan 13                          | v6.39 captures                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depth                   | levels 0-1; every level-1 item a placeholder    | 279 numbered nodes, depth 6, 94 option lists (675 choices), 58 submenus                                                                                                                                                                                                                                           |
| Rows window             | stateless `max(0, selected - 2)`                | stateful and circular: ▲ above the window puts the selection on the top row; ▲ from the first item shows `Voice tags / Search / Service Nos.`; ▼ past the last continues circularly (`tree/01-phone-book/02-service-nos/open/000.png`: `Voice tags / Search / Service Nos.` with the selection on the bottom row) |
| Opening selection       | always the first child                          | levels and option lists open on the current value; with more than 3 items the window starts at it (`Maximum time / 1 hour / 6 hours`, `Off / Topic index / Topics`), with 3 or fewer it starts at 0 (`Name list / Name, number / Large font`)                                                                     |
| Softkey                 | kernel lists always `Select`                    | 19 of 58 submenus read `OK` (Info service, Screen saver, divert levels, every profile); option lists `OK`, `Quit` (unset), `Mark`/`Unmark` (multi-select); info pages `Back`                                                                                                                                      |
| Option lists            | none                                            | rows with the current value highlighted (no radio glyph); an unset virgin-EEPROM value opens with no rows, indicator `5-1-0`, softkey `Quit`; multi-select rows have ☑/☐ marks at x 1..5 and a band from x 8                                                                                                      |
| Notes                   | none                                            | large-font text from x 0 at tops 3/18/33 plus an icon at the right: an animated tick (`Done`, 3 steps), a dotted `!` (information), an octagon (`Not allowed`); some notes start with a ~110 ms blank frame; durations ≈1.45 s or ≈2.9 s                                                                          |
| Pages after a choice    | static snapshot                                 | the page shows the new value (`Type of view` → `Name list`; `Incoming call alert` → `Ringing`), so choices must persist                                                                                                                                                                                           |
| Progress notes, prompts | none                                            | `Requesting` with a looping hatched bar (~271 ms per step) and `Quit`; prompts with a mode icon (pen + `abc`, key, phone book), a label, an entry box or value, and `OK`/`Search`/`Assign`/`Start`                                                                                                                |
| Games                   | placeholders                                    | each game opens with an animated splash, then a rows menu (New game, Level, Mazes, Top score, Score IDs, Instructions)                                                                                                                                                                                            |
| Golden scale            | 46 hand-listed fixtures, hand-written scenarios | ~230 fixtures needed; hand-written scenarios and a hand-listed capture set do not scale                                                                                                                                                                                                                           |

## Scope and non-goals

In scope: the Goal items; additive, opt-in kernel seams; the generated stock tree data; resources
derived from goldens; documentation.

Out of scope (owned by the plans named in "Leaf ownership"): text entry and editing beyond a
prompt's first screen, code verification, sound (tone previews while scrolling Ringing tone are
silent), persistence across power cycles and factory defaults (plan 15), profile activation and
the standby profile indicator (plan 17), message/phone book/call data, gameplay, the calculator,
the stopwatch, language switching, keyguard and backlight, and any website integration.

## Decisions

Each decision states what changes relative to the brief and to plan 13.

**D1 - Stock widgets are nokia-os flow applications that render `custom` frames; kernel
submenus stay kernel submenus (new).** Option lists, notes, prompts and the rest are
`PhoneApplication`s built by nokia-os. Each runs a small internal stack of widgets (a "flow"):
an option list replaces itself with its `Done` note, the note's end pops back past the list to
the page, info pages push an option list and get it back. The kernel list cannot express these
screens: `OK`/`Quit` softkeys that change with state, an unset list with no rows and index `-0`,
two-level returns, multi-select marks. Kernel submenus keep what needs the kernel: paths,
shortcuts, presentation, page values, the rows window. Widgets paint with the same nokia-os
painters and share the window rule through a phone-core helper, so one rule draws every rows
list. Plan 13 D2 ("ScreenModels do not carry Bitmaps for menu graphics") is about the kernel's
own models and still holds: a widget's `custom` frame is nokia-os painting its own application.

**D2 - phone-core gains five opt-in seams; nothing changes for hosts that do not use them
(revises plan 13 D2's softkey deferral).** (1) `PhoneConfig.rowsWindow` turns on the circular
rows window and adds `windowTop` to rows list models; `rowsWindowTop()` exports the rule. (2)
`SubmenuOptions.softkey` (default `Select`). (3) `SubmenuOptions.opening()` chooses the child
selected on entry. (4) `SubmenuOptions.intro` runs an application before a level's list (game
splash). (5) `ApplicationContext.exit({ to: "standby" })`. Plan 13 deferred softkeys because
stock and kernel labels coincided; the tree shows `OK` on 19 submenus, so the deferral ends here.

Deviation (Task 0): P5, P12 and C2 need two more opt-in seams, added to "Contract changes".
(6) `PhoneConfig.shortcutEntry` switches the shortcut digits to the stock rules of D14 (numbers
matched as numbers, delayed opening, an invalid-number application). (7) `ApplicationContext.exit`
also takes `levels` (close enclosing submenu levels too: 10-2 View all returns to the carousel,
a 7-3-4 Set delay choice to the Call divert page) and `select` (Top score returns to its game
menu with New game selected). Hosts that set neither see no change.

**D3 - The rows window rule (D2.1), from the captures.** With `count <= rows` the window is
always 0. Otherwise the window keeps its position while the selection stays inside it (indices
taken modulo `count`); when the selection moves to the item just after the window's last row, the
window scrolls so the selection is on the bottom row; when it moves anywhere else outside the
window (▲ above it, the wrap from the first item, a jump), the selection goes on the top row.
Entering a level puts the window at `selected` (`count > rows`) or 0. The window survives a
child opening and closing (the frame stays on the stack) and is rebuilt when the level is
entered again. Task 0 probes confirm or correct the return, re-entry and shortcut cases before
Task 4 is written.

Task 0 outcome: confirmed, no correction (P1-P5, P10). ▼ from the last item continues
circularly (`Speed dials / Voice tags / Search`, then `Voice tags / Search / Service Nos.`, then
`Search / Service Nos. / Add name`); ▲ from the first item puts the last on the top row; both hold
for 5 and 6 items (Games, Profiles), and lists of 2 or 3 never scroll. The window survives a child
submenu and a timed note (P3: Erase on the top row stays there; `Voice tags / Search / Service
Nos.` comes back unchanged). Entering the level again starts at the opening item on the top row
(P4). A level entered through shortcut digits puts the typed entry on the top row (`Speed dials /
Voice tags / Search`, `Settings / Snake II / Space impact`), which is the entry rule with
`selected` = the typed entry. An unset list's first ▼ selects its first item (window 0), its
first ▲ its last item on the top row (`Level 5 / Level 1 / Level 2`).

**D4 - The stock tree is generated data; behaviour bindings are hand-written (new).**
`scripts/import-tree.ts` reads `$REF/captures/6.39/tree.json` plus Task 0's OCR text
(`plan14/text.json`) and writes `src/firmware/generated/stock-tree.ts`: numbers, slugs, labels
with firmware line breaks, presentations, softkeys, opening selections, leaf kinds and texts,
option labels, defaults and results, value hints. It drops firmware string ids, capture paths
and OCR metadata. `src/firmware/bindings.ts` maps tree nodes to behaviour (setting keys,
placeholders and their owner plans, note styles, aliases). The hand-written `STOCK_LEVELS` table in
`src/firmware/menu.ts` is deleted, and level 1 comes from the generated tree. A test proves the
generated level 1 equals plan 13's `LEVEL1` transcription.

**D5 - Golden sources are Task 0's canonical recaptures, not the crawl's per-node captures
(new).** The crawl's `item.png` window states depend on the crawler's route, and its `open/` and
`after/` recordings are short and not contiguous (Done: `open` ends at 1290 ms, `after` starts at
an unknown later time). Task 0 recaptures every list as a ▼ scroll from entry, and every leaf and
first-occurrence option choice as one recording from before the key to the settled screen. It
also captures the probes this plan's decisions depend on. `tree/` stays reference only.

**D6 - The asserted set is selected by rules, deduplicated, and every node is accounted for
(new).** See "Golden selection". It amounts to about 230 fixtures (≈200 asserted, ≈30 pending)
and ≈700 images, about 3 MB of text grids. Grids compress about 25× in git (plan 13's 1.27 MB of
goldens gzip to 51 KB), so the pack grows by roughly 150 KB. Images are not deduplicated across
fixtures, so each fixture stays readable on its own.

**D7 - Generated goldens carry their scenario; the coverage guard walks the tree (extends plan
13 D7).** A golden header may declare `scenario: list|options|open|leaf|choose` and the tree
nodes it `covers`. The acceptance runner derives the key presses from the generated tree, so no
generated golden needs a hand-written scenario. Plan 13's goldens and the probes keep hand-written
scenarios. The guard fails unless every node of the stock tree (entries and option choices) is
covered by an asserted golden, by a pending golden whose plan matches the node's placeholder
owner, or by a declared same-as subtree whose structure is proven equal.

**D8 - Timing: align on the first changed frame; reproduce durations, not entry latency
(refines plan 13 D9).** The firmware redraws 50-110 ms after a Select (75 ms for Service Nos., 61
ms for Done), and the delay depends on the screen. A widget timeline golden therefore sets
`trigger-frame` to the first frame that differs from frame 0. Frames shown after that,
including the 110 ms blank before an information note, are reproduced as captured, within ±2 ms.
The key-to-redraw latency is not reproduced (Open question 4). Per-leaf durations come from the
goldens: identical notes share a golden only when every step matches within ±2 ms. Otherwise each
gets its own golden and its own generated timeline (Screen saver's `Done` lasts ≈2.9 s, the
option-list `Done` ≈1.45 s).

Task 0 outcome: the jitter between identical notes is larger than ±2 ms (the `Done` box step
runs 671-704 ms, `No phone numbers` 2884-2924 ms), so few recordings share a golden and most
notes get their own timeline. Note classes after alignment: confirmations with the tick
(`Done`, `... erased`, `... selected`, `Info message reception on/off`, `Clock hidden`) box
671-704, half 218-247, full 509-569 ms, ≈1.43-1.50 s in all; long confirmations (Screen saver
`Done`, `Timeout selected`, `Selected profile: ...`) the same with a 1962-2015 ms full step,
≈2.9 s; information and error notes (`No phone numbers`, `No numbers`, `No voice tags saved`,
`Not allowed`, `Set PIN code request on`, `Request not confirmed`, `Invalid shortcut`) one step,
2884-2938 ms. Leading frames that are reproduced as captured: a ≈90 ms blank before `No phone
numbers` from Service Nos. only, a 45-60 ms `Opening` before the Inbox/Outbox notes, a 55-63 ms
erase before the Info service notes, 15 ms partial draws, and 8-9 ms partial erases before
standby.

**D9 - Settings: an internal in-memory store behind a narrow port (new; brings forward part of
plan 15).** Pages must show choices (D5 evidence), so deferral would leave every choice
invisible. `src/firmware/settings.ts` defines `StockSettings` (`choice`/`choose` for
single-choice settings, `marks`/`toggle` for multi-select, `text` for non-option values) and
`createMemorySettings(initial)`. Initial state is the captured virgin EEPROM (D10): option-list
defaults from the tree, `null` for lists that open unset, and value hints as display text until
the first choice. A page's value is the chosen option's label, else the value hint. Tones entries
alias the General profile's Personalise settings, because General is the active profile and
plan 17 makes the active profile switchable (Task 0 probe P11 confirms the sharing). The store
is not exported. Plan 15 adds the host persistence port, factory defaults and the public API, so
a storage contract is not fixed before it has a consumer.

Task 0 outcome: P11 confirms the sharing. Tones › Ringing volume → Level 3 shows `Level 3`
on General › Personalise › Ringing volume (page and list, which opens on Level 3), while
Silent's stays unset with its `Level 1` hint. Closing an unset list without choosing keeps it
unset (P10).

**D10 - The virgin-EEPROM state is the asserted initial state (continues plan 13 Open question
3).** Unset tone lists (`-0`, no rows, `Quit`), `Top score: 45`, junk score IDs (`ç`, `ÆG`),
the SIM's message centre `+1234567890` and voice mailbox `793000333`, `50 free` memory, and the
other captured values are reproduced as captured and listed as artefacts. Plan 15 decides
factory defaults. Two crawl artefacts are not reproduced. The Info service topic names drawn as
U+E000 boxes keep the Topics subtree a placeholder (plan 18). Profiles slot 6 keeps plan 13's
`(empty)` label (UNVERIFIED).

**D11 - Input prompts stop at their first screen.** Text, number and code prompts paint their
first screen, including a blinking cursor if Task 0 captures one, as a timeline. C closes the
prompt and the other keys are inert. The plans in "Leaf ownership" add entry, editing,
verification and results.

Task 0 outcome (P9, C2): text and number prompts blink a cursor every ≈480 ms (Add name,
message centre and voice mailbox numbers, Alarm clock, Set the time, Date, Set timer `hh:mm`,
Rename, Chat and divert numbers, Topic number, Group number, Club Nokia ID). Search `Name:`,
Speed dials `Key 2:` and the code prompts (security code, PIN, PIN2, barring password) do not
blink. C returns to the list at once.

**D12 - Game menus belong to this plan; gameplay stays with plans 23/24 (changes plan 13's
follow-up text for 23/24).** The brief asks for level bars and text pages, and only the game
menus use them. Snake II, Space impact, Bantumi and Pairs II become rows submenus with a splash
`intro` (D2.4). Their Level, Mazes, Top score, Score IDs and Instructions leaves are stock
widgets. New game opens the placeholder. Plans 23/24 keep the splash art (generated here),
gameplay and the scores that gameplay writes. Task 14 updates the plan table rows 23/24.

Task 0 outcome (P12): any key during a splash skips to the game menu and is consumed (▼, C and
Navi at 300 ms all land on New game). Splashes (frames, time to the menu): Snake II 6, ≈2.56 s;
Space impact 9, ≈2.48 s; Bantumi 13, ≈3.46 s; Pairs II 10, ≈3.06 s. Level: ▲/▼ are inert, OK and C return. Instructions: More cycles from
the last page back to the first; C leaves. Top score is not static: the note animates (≈193 ms
frames, some ≈387 ms) and returns by itself after ≈5.84 s, or at once on a key, to the game menu
with New game selected and drawn as `Score IDs / Instructions / New game` (a ▼ key then selects
Level). The tree's `static-note` kind for Top score is a crawl misreading (3.5 s window).

**D13 - Text comes from the corpus's exact OCR; glyph bitmaps come only from goldens (extends
plan 13 D8).** Plan 13 transcribed every text run by hand. With ~700 images that does not
scale, so Task 0 runs `$REF/tools/menutree/ocr.py` (exact template matching: a glyph matches
only where its whole box equals the LCD) over every captured image used here and writes the runs
to `plan14/text.json`. `import-tree.ts` turns them into the stock tree's text and into
`scripts/generated/tree-text-runs.ts`, which the harvester reads beside plan 13's manual
`text-runs.ts`. The extracted firmware fonts that the OCR uses are never copied: every in-repo
glyph is still harvested from golden pixels, and the harvester's consistency checks and the
pixel acceptance reject a wrong reading.

**D14 - Shortcut display and shortcuts into deeper levels follow the Task 0 probes.** Plan 13 D5
left the indicator after a typed digit UNVERIFIED and expected the crawl to settle it. The crawl
navigated with ▼ only, so Task 0 records Menu 1, Menu 1 8, Menu 1 8 1, Menu 1 8 1 2 (into an
option list), Menu 1 1 0 (two-digit 1-10), and Menu 8 1 (splash). Task 5 implements what they
show. Anything that needs more than the D2 seams is recorded as a Deviation with its own kernel
test, or as UNVERIFIED in the spec.

Deviation (Task 0, P5): the stock shortcut rules differ from the kernel's per-digit shortcuts
and need the `shortcutEntry` seam (D2 deviation). Observed:

- Digits form menu **numbers**, not one digit per level. At the top level `1` is a prefix of 10,
  11 and 12: the carousel shows `1` and three dots for the window (≈2948 ms from the digit), then
  the number resolves to 1. `1 1` is Clock, `1 2` Profiles; `1 8` and `1 9` match nothing and
  show `Invalid shortcut` (≈2.9 s) at once, then standby, where further digits start a phone
  number (`1`, `12`, key Call; out of scope). At Clock, `0` is shown as `11-0` and dots, and
  `Invalid shortcut` follows when the window ends.
- A digit that selects an entry shows it at once with the typed path (`8`, `12`, `8-6`,
  `8-6-3`, `1-9`) and **no soft key**, and opens it ≈1.43-1.50 s later. An opened submenu then
  shows `<path>-` and three dots with its soft key for ≈1.46-1.48 s (awaiting the next digit),
  then its normal index (`12-1`, `8-6-1`). A typed leaf (Speed dials) opens its screen.
- `Menu 8 1` plays the Snake II splash first, then shows the Games list with `8-1` and no soft
  key for ≈2.9 s, then the game menu (`8-1-1`). A digit during the splash only skips it (`8 1 2`
  ends on New game).
- Unrelated to digits: entering Screen saver (5-9 and every profile's 12-n-2-9) shows `5-9` and
  three dots for ≈2.9 s before `5-9-1`.

Task 5 implements these with kernel tests where the seam allows; the standby number entry
after an invalid shortcut stays out of scope (UNVERIFIED in the spec).

**D15 - The website and nokia-os's public API do not change.** phone-core changes are additive
and opt-in. The website sets none of them, so its models, routes and pixels are unchanged.
`stockMenu`, `createStockPhone`, `paintStockScreen` and `StockPhoneConfig` keep their
signatures. `stockMenu` now holds the whole tree. `missingStockGlyphs`'s font union grows only if
Task 6 finds a firmware face beyond the four (an additive type change).

## Ground truth and artefacts

| Source (`$REF/captures/6.39/`)     | Contents                                                                                          | Use                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `tree.json`                        | the crawled tree: numbers, labels, list styles, softkeys, leaf kinds and texts, options, defaults | structure for `import-tree.ts` (D4)                  |
| `tree/**`                          | per-node crawl captures (`item`, `screen`, `open/`, `after/`, `then`)                             | reference only (D5)                                  |
| `plan14/scroll/<number>/` (Task 0) | every submenu and option list, ▼ from entry through the wrap                                      | `.sub`, `.options`, `.open` goldens                  |
| `plan14/open/<number>/` (Task 0)   | every leaf and every first-occurrence option choice: Select/OK, then 5 s (6 s for splashes)       | `.leaf`, `.choose` goldens                           |
| `plan14/probe/<name>/` (Task 0)    | window, shortcut, note-key, progress, confirm, prompt, unset, profile-sharing and game probes     | `probe/*` goldens and decision checks                |
| `plan14/text.json` (Task 0)        | OCR runs `{ text, font, x, y, inverted }` for every image above                                   | stock tree text, generated harvest runs (D13)        |
| `menu-scroll-up/01-phone-book/`    | plan 13 Task 11 capture                                                                           | `menu/01-phone-book.sub-up`: `pending:14` → asserted |

New artefacts (added to the spec §10 artefact table in Task 14; never behaviour beyond the
virgin initial state of D10):

| Artefact                                                                      | Cause                                 | Handling                                         |
| ----------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------ |
| Unset tone lists (`-0`, no rows, `Quit`) with a page value (`Level 1`)        | invalid stored index in virgin EEPROM | virgin initial state (D10)                       |
| `Top score: 45`, score IDs `ç` / `ÆG`, `Shakes` `1 player`, Club Nokia ID `T` | uninitialised game EEPROM             | virgin initial state                             |
| `+1234567890`, `793000333`, `SIM card: 50 free`                               | emulator SIM                          | virgin initial state                             |
| Info service topic names (U+E000 boxes)                                       | uninitialised EEPROM                  | Topics subtree stays a placeholder (plan 18)     |
| `Requesting` / `Searching` never finish                                       | emulator network                      | the progress note loops until Quit (as captured) |
| Picture messages, Templates, Smileys, Screen saver › Screen saver do nothing  | no preloaded content in virgin EEPROM | placeholders (plan 18)                           |

## Package boundaries

Unchanged from plan 13. `nokia-os` → `phone-core` (runtime) and `phone-screen` (runtime LCD
toolkit). `phone-core` stays Nokia-agnostic: the window rule, softkey, opening selection, intro
and exit target are generic list/application concepts with no stock labels, slugs or timings.
Scripts import only `node:*`, sibling `scripts/*.ts` and import-free generated data files, with
explicit `.ts` extensions (plan 13 convention).

## Contract changes

Task 1 writes these into `VISION.md`.

### `@hellotimber/phone-core` (additive, opt-in)

```ts
export interface SubmenuOptions<Metadata = unknown> {
  presentation?: MenuPresentation; // unchanged
  detail?(child: MenuEntry<Metadata>): string | undefined; // unchanged
  /** Softkey label on this level. Default "Select". */
  softkey?: string;
  /**
   * The child selected when the level is entered by Select, a shortcut digit or a path that ends
   * at the level; re-read on every entry. Undefined or not a child = the first child.
   */
  opening?(): MenuEntry<Metadata> | undefined; // method syntax: keeps SubmenuEntry covariant
  /**
   * Runs when the level is entered with Select (see Task 5 for shortcuts), before its list.
   * While it runs the path is the level's path; its exit() reveals the list. Paths that land on
   * the level, and returns from a child, skip it.
   */
  intro?: PhoneApplication;
}

export interface PhoneConfig<Metadata = unknown> {
  // ...plan 13 fields unchanged...
  /** Rows submenus keep a stateful circular window of this many rows (plan 14 D3). Default: off. */
  rowsWindow?: number; // positive integer
  /**
   * Stock shortcut digits (plan 14 D14): menu numbers matched as numbers at each level (a prefix
   * of a longer number waits for `shortcutWindowMs`), a selected entry opens `openDelayMs` after
   * its digit, and digits that match no number open `invalid` (whose exit goes to standby).
   * Default: off (plan 13's per-digit shortcuts). Task 5 fixes the exact shape with tests.
   */
  shortcutEntry?: { openDelayMs: number; invalid: PhoneApplication };
}

// ScreenModel `list` addition (omitted unless PhoneConfig.rowsWindow is set and the level is rows):
//   windowTop?: number; // index of the item on the first visible row
// ScreenModel `list` and `menu-carousel` addition (omitted unless shortcutEntry is set):
//   opening?: true; // a typed entry is about to open: the stock painter hides the soft key

/** The rows-window rule (D3). `previousTop` undefined = entering the level. */
export function rowsWindowTop(
  previousTop: number | undefined,
  selected: number,
  count: number,
  rows: number,
): number;

export interface ApplicationContext {
  /**
   * Leave the application: back to the launching stack (default) or straight to standby.
   * `levels` (default 1) also closes `levels - 1` enclosing submenu levels; `select` selects
   * that child (by slug) in the level it returns to. Both are ignored with `to: "standby"`.
   */
  exit(options?: { to?: "standby"; levels?: number; select?: string }): void;
  open(application: PhoneApplication): void; // unchanged
}
```

Rules (Task 0 added `shortcutEntry`, `opening`, `exit` `levels`/`select`): `softkey` must be non-empty. `opening` is evaluated with the level's children only. An
`intro` must not be the level's own child application. `exit({ to: "standby" })` deactivates
with reason `exit` and leaves the menus as C-hold does. An application may call `exit()` inside
`createSession`. The kernel then returns to the stack without rendering the application (Task 5
pins this with a test). `levels` must be a positive integer no larger than the levels below the
carousel plus one; `select` names a child of the level returned to, else it throws.

### `@hellotimber/nokia-os` (public API unchanged)

`stockMenu` holds the whole tree. Internals added (not exported): `src/firmware/generated/stock-tree.ts`,
`src/firmware/bindings.ts`, `src/firmware/settings.ts` (`StockSettings`, `createMemorySettings`),
`src/widgets/**` (flow host and widgets), `src/display/widgets/**` (widget painters),
`src/resources/generated/widgets.ts` (sprites and timelines).

```ts
// src/firmware/settings.ts (internal until plan 15)
export interface StockSettings {
  /** Chosen option index of a single-choice setting; null = never written (virgin EEPROM). */
  choice(key: string): number | null;
  choose(key: string, index: number): void;
  /** Multi-select marks, one per option. */
  marks(key: string): readonly boolean[];
  toggle(key: string, index: number): void;
  /** Free-text values shown on pages (virgin snapshot, e.g. "+1234567890"). */
  text(key: string): string | undefined;
}
export function createMemorySettings(initial: StockSettingsSnapshot): StockSettings;
```

## Stock tree data (`src/firmware/generated/stock-tree.ts`)

Import-free, JSON-style literal (excluded from oxfmt like the other generated files), header
`// GENERATED by scripts/import-tree.ts from tree.json and plan14/text.json - do not edit`.
The shape is indicative; Task 3 fixes the exact types and records any change as a Deviation.

```ts
export const STOCK_TREE: readonly StockTreeNode[] = [
  /* 12 top-level nodes in carousel order */
];

type StockTreeNode = {
  readonly number: string; // "1-8-1"; the last segment is the menu order (hidden gaps kept)
  readonly slug: string; // kebab-case; plan 13 slugs kept (write, snake, empty-2, ...)
  readonly label: string; // firmware lines joined with "\n" (pages), one line (rows)
  readonly valueHint?: string; // the page value as captured (virgin)
  readonly opens: StockScreenSpec;
  readonly children?: readonly StockTreeNode[]; // submenus only
};

type StockScreenSpec =
  | {
      kind: "submenu";
      presentation: "rows" | "pages";
      softkey: string;
      opening?: string;
      intro?: true;
    }
  | {
      kind: "option-list";
      softkey: string;
      opening: number | null;
      multi?: true;
      options: readonly { label: string; result: StockResult }[];
    }
  | {
      kind: "info-pages";
      softkey: string;
      pages: readonly { label: string; value?: string; result?: StockResult }[];
    }
  | { kind: "text-pages"; pages: readonly (readonly string[])[] }
  | { kind: StockLeafKind; lines: readonly string[]; softkey?: string; then?: "back" | "standby" };

type StockResult =
  | { kind: StockLeafKind; lines: readonly string[]; softkey?: string; then?: "back" | "standby" }
  | { kind: "returns-immediately" | "not-probed" };
// StockLeafKind: the spec's leaf screen kinds ("timed-note", "static-note", "progress-note",
// "confirm-query", "info-screen", "text-input", "number-input", "code-prompt", "level-bar",
// "text-editor", "application", "symbol-table", "no-response", "returns-immediately", "standby").
```

Line breaks come from the OCR runs' rows (pages at tops 7/16/25, notes at 3/18/33, and so on);
`import-tree.ts` refuses a node whose runs do not spell its `tree.json` label (whitespace aside) and
names it. Overrides for such cases live in `scripts/tree-overrides.ts`, each with a comment
naming the capture.

## Golden pipeline additions

### Header keys (`scripts/golden-format.ts`)

Two optional keys follow `omitted`, in this order, both present or both absent:

```text
scenario: leaf
covers: 1-2 1-4-1 1-4-2 1-5 1-6 1-7
```

`scenario` is one of `list`, `options`, `open`, `leaf`, `choose`. `covers` is a space-separated
list of tree node numbers (entries such as `1-8-1`, option choices such as `1-8-1-2`). A golden
with neither key needs a hand-written scenario (plan 13 goldens and probes). Version stays
`lcd-golden 1`.

### Golden selection (`scripts/tree-capture-set.ts`)

Rules, applied to `tree.json` in tree order; the importer appends the result to plan 13's capture
set. Ids are `tree/<NN-top-slug>/<number>.<kind>`; probes are `probe/<name>`.

| Rule | Selects                                                                                                                                              | Golden                                                                                       | Scenario     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------ |
| S1   | every submenu outside a same-as subtree                                                                                                              | `<n>.sub` from `plan14/scroll/<n>`: one image per child, ▼ from the opening item             | `list`       |
| S2   | the first option list (tree order) of each signature (labels, opening, softkey)                                                                      | `<n>.options` from `plan14/scroll/<n>`                                                       | `options`    |
| S3   | every other option list outside a same-as subtree                                                                                                    | `<n>.open`: the first image of its scroll                                                    | `open`       |
| S4   | every non-list leaf outside a same-as subtree; leaves whose recordings match (same images, every step within ±2 ms after alignment) share one golden | `<first n>.leaf` timeline from `plan14/open/<n>`, `trigger-frame` = first changed frame (D8) | `leaf`       |
| S5   | per S2 list: the option one ▼ from the opening item, plus every option whose result differs from its siblings'                                       | `<n-k>.choose` timeline from `plan14/open/<n-k>`; equal recordings share (as S4)             | `choose`     |
| S6   | same-as subtrees: below `7-2` and `7-4` (as `7-1`), below `12-3`…`12-6` Personalise (as `12-2`); their own level lists stay under S1                 | none; `SAME_AS` table, proven by a structure test                                            | -            |
| S7   | probes (Task 0 list)                                                                                                                                 | `probe/<name>` (still or timeline)                                                           | hand-written |
| S8   | placeholder leaves (owner table)                                                                                                                     | S4 golden with `status: pending:<plan>`                                                      | `leaf`       |

`tree-capture-set.ts` holds `SAME_AS` and `PLACEHOLDER_OWNERS` (node number or prefix → plan).
Task 13 proves both equal the firmware bindings' tables. A source with a missing capture fails
the import and names the node. Nothing is skipped silently.

### Generic scenarios and the coverage guard (`tests/support/drive.ts`, `tests/acceptance.test.ts`)

`goto(rig, number)` drives real keys from a settled standby until the node is highlighted in its
parent: Menu, ▼ to the top-level item, then for each level Select and ▼ (from the opening item,
by visible position), waiting out an `intro` when a level has one. `open(rig, number)` is `goto`
plus Select. For an option choice it opens the list and ▼ to
the option, starting from the unset state when the list is unset (P10). Per covered node:

- `list` / `options`: `open` the node; image 1; ▼ before each later image.
- `open`: `open` the node; image 1.
- `leaf`: highlight the node in its parent, then `record` with Select as the trigger; `expectTimeline`.
- `choose`: `goto` the option (opens its list and ▼ to it), `record` with OK (Navi) as the trigger.

The guard (one `describe`): every asserted golden has a generic or hand-written scenario; every
node of `STOCK_TREE` (entries and option choices) is covered by an asserted golden, or by a
`pending:<plan>` golden whose plan equals its placeholder owner, or lies inside a `SAME_AS`
subtree whose structure equals its model's, or (option choices only) by its list's `.options`
golden. Pending goldens are `it.todo` naming their plan, as in plan 13.

## Stock widget catalogue

Observations to start from (measured from `tree/` samples during planning). The goldens are
authoritative; Task 6/7 correct this table and the spec when they disagree.

| Widget              | Layout                                                                                                                                                                 | Keys and timing                                                                                                                                                 | Examples                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Option list         | rows layout (band x 0..77, text x 2, tops 8/18/28), rail, indicator `<list>-<k>`; current value highlighted, no radio glyph                                            | ▲/▼ circular window (D3); OK applies; C back to the page; softkey `OK` (`Quit` while unset: no rows, indicator `-0`)                                            | 1-8-1 Type of view, 5-2 Ringing volume (unset)            |
| Multi-select        | ☑ (filled 5×5) / ☐ (dotted) at x 1..5; band from x 8, text x 10                                                                                                        | softkey toggles (`Unmark` on a marked row, `Mark` otherwise); C leaves (P14)                                                                                    | 2-8-5 Language                                            |
| Timed note          | text in the large face from x 0, tops 3/18/33; icon within x 63..83, y 3..22: tick (3 steps: dotted box, half, full), dotted `!`, octagon                              | auto-dismiss: ≈1.45 s (confirmations), ≈2.9 s (information/errors), per-golden durations (D8); some start with a ≈110 ms blank; then back (or standby: 6-2-4-1) | Done, No phone numbers, Not allowed, Clock hidden         |
| Static note         | as a timed note without an icon or softkey                                                                                                                             | stays until a key (P12); then back                                                                                                                              | 8-1-4 Top score                                           |
| Progress note       | hatched bar x 0..83, y 7..14, animated (~271 ms per step, looping); text top 18; softkey `Quit`                                                                        | Quit/C (P7)                                                                                                                                                     | Requesting, Searching                                     |
| Confirm query       | small-face lines from x 0, tops 2/12/22; softkey `OK` or `Yes`                                                                                                         | OK → result; C → back (P8)                                                                                                                                      | Level 5, Club Nokia ID, Reminders Erase All               |
| Info pages / screen | pages: label lines 7/16/25, value thin, last cell ending x 78, top 29, rail, indicator; screen: small lines 7/16/25, no rail; softkey per page (`Back`, `Select`)      | ▲/▼ pages; `Back` exits; a page with a result opens it                                                                                                          | 4-5, 4-6, 4-8, Score IDs; 1-8-2 Memory status             |
| Input prompt        | mode icon y 0..5 from x 1, label small top 7; entry frame x 0..83, y 16..36, value large top 23 ending x 82 (or large top 16 from x 0); `OK`/`Search`/`Assign`/`Start` | first screen only (D11); cursor blink if captured (P9); C back                                                                                                  | 1-1 Search, 1-9 Speed dials, 6-4 Restore factory settings |
| Level bar           | `Level:` small at x 5, top 0; bars rising left to right within x 5..74, y 13..36; softkey `OK`                                                                         | per P12 (virgin: ▲/▼ do not change it)                                                                                                                          | 8-1-2 Level                                               |
| Text pages          | three thin-face lines from x 0 at tops 7/16/25, no rail; softkey `More`                                                                                                | `More` pages; after the last page back (P12)                                                                                                                    | 8-1-6 Instructions                                        |
| Splash (intro)      | full-frame animated game title                                                                                                                                         | ~250 ms frames, then the game's rows menu (P12: skip key, shortcut)                                                                                             | 8-1 Snake II                                              |

Deviation (Task 0 probes; layout corrections stay with Tasks 6/7): Option list: OK on a 7-3-4
Set delay choice returns at once to the Call divert page (two levels, no note). Multi-select: the
soft key toggles the row and flips to `Mark`/`Unmark`; C after a change asks the confirm query
`Save changes?` [Yes] (P14), it does not simply leave. Timed note: C dismisses and stays on the
list; ▼ during `Done` dismisses and moves (P6). Static note: Top score is an animated timed
note (D12). Progress note: C on `Searching` returns at once; Quit on `Requesting` after 10 s shows
`Request not confirmed` (≈2.9 s), then standby (P7). Confirm query: C returns to the list
unchanged; OK runs the result (Level 5: `Done`, page `Level 5`; Club Nokia ID: a `Club Nokia ID:`
text prompt; Erase › All › Yes: `Reminder memory empty` ≈2.87 s, then Reminders shows only `Add
new`) (P8). Confirm query text tops are 2/12/22 or 4/13 (`Are you / sure?`). Text pages: More
cycles; C leaves. Level bar: ▲/▼ inert. Info pages: 4-8-1 Credit info display opens an On/Off
option list (on Off); 4-8-4 Recharge status opens info pages `Last recharge:` / `Expiry date:`
with value `0` (P15).

## Leaf ownership

Leaves in scope get stock widgets. These open the placeholder (C exits; pending goldens name the
plan):

| Nodes                                            | What the firmware opens              | Owner |
| ------------------------------------------------ | ------------------------------------ | ----- |
| 2-1 Write messages, 2-10 Service command editor  | text editor                          | 18    |
| 2-4 Picture messages, 2-5 Templates, 2-6 Smileys | nothing (virgin)                     | 18    |
| 2-8-4-1…3 Topics Select/Edit/Erase               | lists of box-glyph names (virgin)    | 18    |
| 3 Chat                                           | number prompt (`menu/03-chat.sub`)   | 18    |
| 5-4-1…7 Composer slots                           | composer editor                      | 16    |
| 5-9-4, 12-n-2-9-4 Screen saver › Screen saver    | nothing (virgin)                     | 18    |
| 6-2-1 choices Русский, Български, Українська     | native-language note, then that UI   | 15    |
| 6-2-3 Welcome note                               | text editor                          | 15    |
| 8-1-1, 8-2-1, 8-3-1, 8-4-1-1, 8-4-2-1 New game   | gameplay                             | 23/24 |
| 9 Calculator                                     | calculator                           | 20    |
| 11-4 Stopwatch                                   | stopwatch                            | 21    |
| 12-n-1 Activate                                  | note, standby with profile indicator | 17    |

In scope but finished later (first screen or virgin behaviour now; the plan named adds the
rest): Phone book prompts and "No phone numbers" notes (19); message centre, voice mailbox,
Inbox/Outbox notes (18); Call register notes and info pages (22); divert and barring
`Requesting` and code prompts (22, 15); Clock prompts and notes, Reminders (21); Rename (17);
Closed user group, security prompts, Network selection (15); game menus' scores (23/24).
`10-2` View all (returns immediately, nothing to show) is a no-op leaf: an application that exits
inside `createSession`.
Deviation (Task 0): View all returns to the carousel (Reminders, icon restarting), not to the
Reminders list, so it exits inside `createSession` with `exit({ levels: 2 })`.

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` and the named test commands. Any task that
  touches `phone-core` or `phone-screen` also runs `mise exec -- vp run -r test` and
  `mise exec -- vp run website#build`.
- Commit rule: run `mise exec -- vp check --fix` yourself, stage files by explicit path, then
  `git commit --no-verify -m "<message>"`. Never `git add -A`/`git add .`. Never stage
  `TODOS.md` (Lachlan's untracked notes).
- Never hand-edit `goldens/**`, `src/resources/generated/**`, `src/firmware/generated/**` or
  `scripts/generated/**`: change the generator or its input tables and regenerate. Each generator
  runs twice with no diff (idempotence) before its commit.
- Tests never read `$REF`. Generators that read `$REF` fail with a clear message when it is
  missing.
- No new dependencies.
- When reality differs from this plan, follow the captures, then append a `Deviation:` paragraph
  under the task (what changed, the evidence, what later tasks must know). If a deviation breaks
  a contract in VISION.md, stop and report instead.
- Parallelism (max 3 concurrent agents): Task 0 gates everything. Then Task 1. Then lanes
  A (2 → 3 → 6 → 7), B (4 → 5) and C (8, after 3). Task 9 needs 4, 7 and 8. Tasks 10 and 11 run
  in parallel after 9 (11 also needs 5). Then 12 → 13 → 14.

## Tasks

### Task 0 - Canonical REF captures, probes and OCR (no repository changes)

**Files (all under `$REF`, gitignored):** `captures/scripts/gen_v639_plan14.py`,
`captures/scripts/v639-plan14.cap`, `captures/6.39/plan14/**`, a new section in
`captures/README.md`.

- [x] Read `$REF/captures/README.md` (harness commands incl. `fork`, `exit`, `hex`) and
      `$REF/tools/menutree/` (`crawl.py` already navigates every node, including carousel
      animations that drop keys; reuse its navigation). Do not modify existing captures or scripts.
- [x] Write `gen_v639_plan14.py`. It reads `tree.json` and emits `v639-plan14.cap`
      (`include v639-setup.inc`, `key c`, `run 2s`, then per item: navigate to the parent,
      `fork`, act, `exit`):
  - **C1 scroll:** every submenu and option list (all of them, including same-as copies):
    open it, `scroll plan14/scroll/<number> down <count + 2>`, which captures past the wrap.
    Use `max` ≥ 45 for Ringing tone (42 items).
  - **C2 open:** every non-list leaf, and every option of the first occurrence of each option
    list signature (S2): highlight it, `record plan14/open/<number> start`, `key menu`, `run 5s`
    (6 s for game entries and static notes), `record stop`.
  - **Probes** (`plan14/probe/<name>/`, records or shots as fits):
    P1 `wrap-down`: Phone book ▼×9, then 3 more ▼ with a shot each;
    P2 `wrap-small`: the same past the wrap for Reminders (3), Phone book › Erase (2), Games (5,
    hidden 8-5), Profiles (6);
    P3 `return`: Phone book ▼×4 (Erase), Select, C; Phone book ▲ (Voice tags), Select, C; Phone
    book ▼×4 then Select on Edit (note) and wait for the return. Shot after each;
    P4 `reenter`: Phone book ▼×5, C, Select;
    P5 `shortcut`: record 4 s each of Menu 1; Menu 1 8; Menu 1 8 1; Menu 1 8 1 2; Menu 1 1 0;
    Menu 1 9 then C (shot); Menu 8 1; Menu 8 1 2;
    P6 `note-keys`: Service Nos. note with C at 500 ms; Type of view › Name list `Done` with ▼ at
    300 ms (records);
    P7 `progress`: 7-6 for 10 s, then Quit (record); 6-2-4-2 Searching for 10 s, then C;
    P8 `confirm`: 5-2 ▼ to Level 5, OK, then C (record); again with OK (record); 8-6-4 OK and C;
    10-3 All, Yes;
    P9 `prompts`: record 5 s each of 1-1, 1-9, 6-4, 11-5 (cursor blink?), then C;
    P10 `unset`: 5-2 opened, ▼×6 with shots; reopened, ▲×6 with shots; Quit in the unset state;
    P11 `profile-share`: Tones › Ringing volume → Level 3; shots of Profiles › General ›
    Personalise › Ringing volume and Profiles › Silent › Personalise › Ringing volume;
    P12 `games`: each game Select with a 6 s record (splash timing); Snake II with a key at
    300 ms into the splash; Level ▲, ▼, OK (record); Top score for 8 s, then a key; every
    Instructions text paged with `key menu` until it leaves (shots);
    P13 `set-delay`: 7-3-4 choose 5 seconds (record 6 s);
    P14 `multiselect`: Language Unmark on All, ▼, Mark, then C (records);
    P15 `prepaid`: 4-8 Select on Credit info display (scroll), then on Recharge status (scroll).
- [x] Run it with the virgin-EEPROM image into `captures/6.39` (see the README's v6.39 command).
- [x] OCR: run `tools/menutree/ocr.py` over every image under `plan14/` and write
      `plan14/text.json`: `{ "<relative png path>": [{ "text", "font", "x", "y", "inverted" }] }`,
      with fonts named as `ocr.py` names them. Report which faces appear (`tiny6`, `plain8`,
      `bold8`, `plain13`, `bold13`, `large13`).
- [x] Check: every scroll wraps back to its first image; every `open` recording starts with the
      parent screen and ends settled (or loops, for progress notes); list any node with a
      missing capture and why.
- [x] Append "Plan 14 supplementary captures" to `$REF/captures/README.md`.
- [x] No commit. Report the probe outcomes (each P-number in one line), note classes with their
      durations after alignment, the faces found, and any node whose capture failed. Record the
      outcome under this task as plan 13 did for its Task 0.

**Task 0 outcome (2026-10-14).** Generator `captures/scripts/gen_v639_plan14.py` (`gen`, `run`,
`ocr`, `check`), script `captures/scripts/v639-plan14.cap` (93 sections), details in the "Plan 14
supplementary captures" section of `$REF/captures/README.md`. 4,367 images (1,604 distinct), 38 MB
under `plan14/`: 152 scrolls, 306 `open/` recordings, the probes, and `text.json`.

Deviation: the `.cap` uses `fork`/`exit`, which `tools/harness/cap` cannot replay from a file (the
forked parent re-reads the child's lines), so `gen_v639_plan14.py run` plays it through the
interactive driver (`tools/menutree/emu.py`) in three workers. Scrolls are explicit `shot`/`key
down` sequences of count + 2 images: the harness `scroll` command stops at the wrap. Info-pages
lists are scrolled like option lists and every page of the first list of each signature is
recorded (S2/S5 treat them as lists, Task 2). P3 also records Erase on the top row (▼×5, ▲×2) and
on the bottom row (▼×3; the plan's "▼×4 (Erase)" lands on Edit); P5 adds `1 2`, `8 6`, `8 6 3`
and `1`, wait, `9`; P12 records Top score untouched for 9 s and with C/▼ at 2 s (a key at 8 s
lands after the note has ended, and Navi then starts a game), and C on an Instructions page.

- Faces found: `tiny6`, `plain8`, `bold8`, `large13`. No `plain13`/`bold13`, so no new stock face.
- Checks: every scroll has count + 2 images with the expected index on each entry, except the
  Screen saver lists (their first screen shows `5-9` and dots, D14). Every `open/` recording starts
  on the parent with the entry highlighted. No capture failed. Recordings that do not settle:
  cursor blinks, progress bars, the Top score animation, gameplay (8-1-1 has 694 frames).
- P1 `wrap-down`: ▼ past the last item continues circularly (D3 confirmed).
- P2 `wrap-small`: Reminders (3) and Erase (2) never scroll; Games (5) and Profiles (6) wrap both
  ways as D3 says (▲ from the first puts the last on the top row).
- P3 `return`: the window survives Select + C on a child submenu (top row, bottom row, wrapped)
  and a timed note.
- P4 `reenter`: C to the carousel and Select again rebuilds the window (Search on top).
- P5 `shortcut`: numbers, not digits; delayed opening; `Invalid shortcut` (D14 deviation).
- P6 `note-keys`: C dismisses a note and stays on the list; ▼ during `Done` dismisses and moves.
- P7 `progress`: ≈271 ms bar loop; C on `Searching` returns at once; Quit on `Requesting` →
  `Request not confirmed` ≈2.89 s → standby.
- P8 `confirm`: C → back to the list unchanged; OK → result (`Done` then page `Level 5`; `Club
Nokia ID:` prompt; Yes → `Reminder memory empty` ≈2.87 s → Reminders shows only `Add new`).
- P9 `prompts`: 1-1, 1-9 and 6-4 do not blink; 11-5 blinks `hh:mm` every ≈480 ms (D11).
- P10 `unset`: first ▼ → first item, first ▲ → last item on the top row; C and reopen stays
  unset; Quit → page.
- P11 `profile-share`: Tones and General share settings; Silent does not (D9 confirmed).
- P12 `games`: splash skip on any key; Level inert; Instructions cycle, C leaves; Top score
  animates and returns by itself after ≈5.84 s with New game selected (D12).
- P13 `set-delay`: OK on 5 seconds returns at once to the Call divert page, no note.
- P14 `multiselect`: the soft key toggles `Mark`/`Unmark`; C after a change asks `Save changes?`.
- P15 `prepaid`: Credit info display → On/Off list on Off; Recharge status → `Last recharge:` /
  `Expiry date:` info pages, value `0`, Back.
- Note classes (D8): tick confirmations ≈1.43-1.50 s (box 671-704, half 218-247, full 509-569
  ms); long confirmations ≈2.9 s (full step 1962-2015 ms); information/error notes one step
  2884-2938 ms. Also: 10-2 View all returns to the carousel (Leaf ownership deviation).

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `docs/specs/nokia-3310.md`, `docs/plans/README.md`, this plan.

- [x] Apply Task 0's outcome to D3, D14 and the contracts above (Deviation lines where it
      changes them). If a probe needs a kernel seam beyond D2, add it to "Contract changes" now.
- [x] VISION: the phone-core additions exactly as in "Contract changes" (SubmenuOptions,
      `rowsWindow`, `windowTop`, `rowsWindowTop`, `ApplicationContext.exit` options), the
      kernel-policy paragraph (window rule, opening, intro), and `stockMenu`'s comment (whole tree).
- [x] Spec §10: add "Deeper levels and stock widgets (plan 14)". Cover the window rule with
      evidence, opening selection, softkeys, widget catalogue headings, and the probe outcomes. Mark
      everything not yet asserted as "(plan 14, in progress)". Replace the "How ▼ wraps … is
      UNVERIFIED" sentence with the P1 result.
- [x] Plans README: row 14 `in progress`.
- [x] No runtime code. `mise exec -- vp check --fix`.
- [x] Commit: `docs: define menu depth, rows window and stock widget contracts (plan 14)`.

### Task 2 - Golden header keys, tree capture set and import (TDD)

**Files:** `scripts/golden-format.ts`, `scripts/tree-capture-set.ts` (new),
`scripts/import-captures.ts`, `tests/golden-format.test.ts`, `tests/tree-capture-set.test.ts`
(new), `tests/fixtures/tree-mini.json` (new, hand-written, not REF data),
`tests/goldens-integrity.test.ts`, `goldens/**`.

- [x] TDD `golden-format.ts`: optional `scenario`/`covers` after `omitted` (order, both or
      neither, known scenario names, covers non-empty and well-formed numbers); round trip;
      plan 13 fixtures still parse unchanged.
- [x] TDD `tree-capture-set.ts` on `tree-mini.json` (a dozen nodes: a rows and a pages submenu, a
      hidden-number gap, two option lists with one signature, an unset list, a note pair with
      equal recordings, a placeholder leaf, a same-as subtree): rules S1-S8, ids, `covers`, and
      grouping by recording equality, which the test feeds through an injected recording loader.
      Unknown leaf kinds and missing captures throw and name the node.
- [x] Wire the importer: `CAPTURE_SET` (plan 13) + `treeCaptureSet(tree.json, captures root)`;
      `index.json` entries gain `covers` when present. Move `menu/01-phone-book.sub-up` to
      `asserted` and add `probe/*` rows (S7) with notes naming their probe.
- [x] Integrity test: tree goldens with `scenario` have `covers`; `leaf`/`choose` timelines have a
      numeric `trigger-frame`; no node number is covered twice by asserted goldens of the same
      scenario kind.
- [x] Run the importer against REF twice; the second run leaves `goldens/` unchanged. Record the
      fixture counts (asserted/pending, images, bytes) in the completion notes.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [x] Commit: `feat(nokia-os): import the v6.39 menu tree as rule-selected goldens`.

Deviation: level 0/1 keep plan 13's goldens. S1, S4 and S8 apply below the carousel: the
level-1 lists are `menu/NN-<slug>.sub` and the top-level applications Chat and Calculator are
`menu/03-chat.sub` (pending:18) and `menu/09-calculator.sub` (pending:20), so the guard (Task 13)
counts those as covering nodes `1`..`12`.
Deviation: info-pages lists (4-5, 4-6, 4-8, 4-8-4, Score IDs) follow the option-list rules: S2
`.options` (one image per page) for the first of each signature, S3 `.open` for the rest, S5
`.choose` for their pages (Task 0 records every page of the first list of each signature).
Deviation: S4/S5 equality compares the frames after the trigger up to the return to frame 0's
screen, plus whether it returns; frame 0 and the return differ per node (the node's own parent).
A shared golden's image `a` is the first covered node's parent, so Task 13's `leaf`/`choose`
scenario for the other covered nodes compares frame 0 and the return against that node's own
parent screen (its frame before the trigger), not image `a`. Identical notes jitter by up to
±17 ms (D8), so only six groups share: `1-5 1-6`, `4-1 4-2`, `6-3-5 6-3-6-1 6-4`, `8-4-1-2
8-4-2-2`, `5-4-1 5-4-2 5-4-6 5-4-7` (pending:16) and the no-response leaves `2-4 2-5 2-6 5-9-4
12-1-2-9-4 12-2-2-9-4` (pending:18).
Deviation: probes are an explicit table in `tree-capture-set.ts` (`probeCaptureSet`, 68 goldens
`probe/<name>`, trigger = first changed frame); named shots use a new `shots` capture source.
Pending timelines keep at most 40 frames (`MAX_PENDING_FRAMES`; Snake II gameplay has 694),
the rest listed under `omitted`. `goldens/index.json` (now with `covers` arrays) is excluded from
oxfmt in the root `vite.config.ts` so the importer stays idempotent. `tests/acceptance.test.ts`
lists asserted `tree/*`, `probe/*` and `menu/01-phone-book.sub-up` goldens without a scenario as
todos (`awaitsPlan14Scenario`; Task 13 deletes it), and `tests/paint-lists.test.ts` selects only
`menu/*.sub` goldens.

Completion (Task 2): 360 fixtures, 329 asserted and 31 pending; plan 14 adds 314 (217 tree + 68
probe asserted, 29 tree pending) and moves `menu/01-phone-book.sub-up` to asserted. Tree goldens:
44 `.sub`, 34 `.options`, 33 `.open`, 85 `.leaf`, 50 `.choose`. Images: 1,733 (1,466 new). Size:
7.28 MB of text grids (≈6.0 MB new); `goldens/` gzips to ≈450 KB (plan 13: 51 KB), so the pack
grows by ≈400 KB, not D6's ≈150 KB: few leaves share (jitter) and the probes add 420 images. A
second importer run leaves `goldens/` unchanged.

### Task 3 - Generated stock tree data (TDD)

**Files:** `scripts/import-tree.ts` (new), `scripts/tree-model.ts` (new, pure),
`scripts/tree-overrides.ts` (new), `src/firmware/generated/stock-tree.ts` (generated),
`scripts/generated/tree-text-runs.ts` (generated), `package.json` (script `import-tree`), root
`vite.config.ts` (fmt ignore for the generated files), `tests/tree-model.test.ts` (new),
`tests/stock-tree.test.ts` (new).

- [x] TDD `tree-model.ts` (pure) on `tree-mini.json` plus synthetic OCR runs: labels from runs
      joined with `\n` by row band per widget layout; refuse runs that do not spell the
      `tree.json` label and name the node; parse `tree.json` result strings
      (`timed-note "Done", then back`, `confirm-query "…" [OK]`, `returns immediately`,
      `not probed`) into `StockResult`; slugs via plan 13's `slugOf` with collision suffixes and
      the plan 13 overrides (`write`, `snake`, `empty-2`); value hints; opening selections;
      `intro` for game entries (`splash_first`); drop `text_ids`, `label_source`, capture paths.
- [x] Map OCR faces to stock fonts (`bold8` → small, `large13` → large, `tiny6` → digits,
      `plain8` → thin). If `bold13`/`plain13` appear, map them to new faces `tall`/`tallThin`
      and record a Deviation for Task 6.
- [x] `import-tree.ts`: reads `$REF/captures/6.39/tree.json` and `plan14/text.json`; writes
      `stock-tree.ts` and `tree-text-runs.ts` (runs per golden id and image, the font mapped,
      `left`/`right` bounds per layout, as plan 13 Task 7's runs). Package script `import-tree`.
- [x] TDD `stock-tree.test.ts` (reads the generated file only): 12 top-level nodes; level 1
      equals plan 13's `LEVEL1` (labels with breaks, presentations, numbers); numbers unique and
      consistent with their parents; hidden gaps 6-2-5, 6-3-3, 7-5, 8-5 and 12-n-2-4 kept; every
      option list's `opening` is null or in range; slugs unique among siblings.
- [x] Run `import-tree` twice; no diff. Review the generated file. Spot-check ten labels against
      `docs/specs/nokia-3310-menu-tree.md` and report.
- [x] Commit: `feat(nokia-os): generate the stock menu tree data from the v6.39 crawl`.

Deviation: the generated `stock-tree.ts` holds its types as well as the data, so it stays
import-free; the types are authored as `STOCK_TREE_TYPES` in `import-tree.ts`, and
`tree-model.ts` imports them type-only. Shape changes against the indicative types: a leaf's
`then` is `after` (an object with `then` is a thenable; the linter flags it); `info-pages` has no
list softkey, each `StockPage` has its own `softkey`; a multi-select `StockOption` carries
`marked` (virgin marks); `StockResult` adds `option-list` and `info-pages` (4-8-1, 4-8-4);
`text-pages` is its own spec, not a `StockLeafKind`.
Deviation: OCR cannot tell `I` from `l` (identical glyphs), so a label read from pixels must
spell its `tree.json` label up to that, and the label keeps `tree.json`'s characters broken where
the pixels break it (`AII calls'` → `All calls'\nduration`). A leaf's lines come from the
richest frame between the key and the return (the first frame with a menu index or standby's
`Menu` ends the search). Overrides (`tree-overrides.ts`): 12-6 keeps `(empty)` (D10), the
Topics option labels are six U+E000 boxes, and Top score (8-1-4, 8-2-2, 8-4-1-3, 8-4-2-3) is a
`timed-note` (P12). 7-3-4's choices stay `not-probed` in the data although P13 shows them
returning two levels; Task 12's bindings own that.
Deviation: `tree-text-runs.ts` matches every `tree/*` and `probe/*` golden image to its OCR'd
capture by pixels and keeps the OCR's exact column bounds (`left` = x, `right` = x1 - 1), mapping
`bold8` → small, `large13` → large, `tiny6` → digits, `plain8` → thin; lone `I`/`l`/`i`/`'`
readings (art) are dropped. Only those four faces occur, so Task 6 adds no font.

Completion (Task 3): 279 nodes (12 top-level). `stock-tree.ts` is 206 KB, `tree-text-runs.ts`
338 KB (314 goldens, 1,345 images with text). A second `import-tree` run changes nothing. Spot
check against `docs/specs/nokia-3310-menu-tree.md` (all equal, with firmware breaks): 2-7-1-1
`Message/centre/number`, 4-5 `Show call/duration`, 6-3-2-3 `International/except to/home
country`, 7-4 `Divert when/phone off/or no coverage`, 8-2 `Space impact`, 11-6 `Auto update
of/date and time`, 6-2-6 `Confirm SIM/service actions`, 1-7 `Send b'card`, 6-3-6-4 `Change
barring/password`, 12-1-2-5 `Message/alert tone`.

### Task 4 - phone-core: circular rows window (TDD)

**Files:** `packages/phone-core/src/{machine.ts,types.ts,index.ts}`, `src/window.ts` (new),
README; tests `window.test.ts` (new), `rows-window.test.ts` (new).

- [x] TDD `rowsWindowTop` (pure): every D3 case. Entry (`count <= rows` → 0, else `selected`);
      ▼ inside; ▼ to the item after the bottom row; ▲ inside; ▲ above; ▼ wrap from last
      (`[8, 9, 0]` for 10 items); ▲ wrap from first (`[9, 0, 1]`); jumps; `count` 1, 2, 3, 4.
      Apply every Task 0 correction (P1-P5).
- [x] TDD machine: with `rowsWindow: 3`, rows list models carry `windowTop` following the rule
      for ▲/▼, child open/close (kept), re-entry (rebuilt), path navigation and shortcuts
      (per P3-P5); pages levels and configs without `rowsWindow` produce models identical to
      today's (existing exact-model tests unchanged).
- [x] Export `rowsWindowTop`; document it in the README.
- [x] `mise exec -- vp run @hellotimber/phone-core#test`, `vp run -r test`, `vp run website#build`, `vp check --fix`.
- [x] Commit: `feat(phone-core): stateful circular rows window`.

Deviation: the window state lives on submenu levels only. `ListEntry` lists (a website concept
nokia-os does not use) carry no `windowTop`; Task 9's painter keeps a fallback for list models
without it. `rowsWindowTop` validates its input (positive `rows`, indices in range) and returns 0
for an empty level.

### Task 5 - phone-core: submenu softkey, opening, intro and exit to standby (TDD)

**Files:** `packages/phone-core/src/{menu.ts,machine.ts,application.ts,types.ts,index.ts}`,
README; tests `submenu-options.test.ts` (new), `intro.test.ts` (new), `applications.test.ts`.

- [x] TDD `softkey`: emitted as `list.softkey`; default `Select`; empty string throws.
- [x] TDD `opening`: selection on Select-entry, shortcut entry and path landing on the level;
      re-read each entry; a non-child or undefined result falls back to the first child;
      `windowTop` follows D3's entry rule.
- [x] TDD `intro`: runs on Select-entry with the level's path; its exit shows the list; C and
      other keys go to the intro; returns from a child and `navigate()` skip it; shortcuts per
      P5/P12 (Deviation if they differ from "Select only"); power-off and navigation deactivate
      it once.
- [x] TDD `exit({ to: "standby" })` from an application and from an intro; `exit()` called inside
      `createSession` returns to the stack, renders nothing, deactivates once.
- [x] Existing tests pass unchanged; website models unchanged.
- [x] `mise exec -- vp run @hellotimber/phone-core#test`, `vp run -r test`, `vp run website#build`, `vp check --fix`.
- [x] Commit: `feat(phone-core): submenu softkey, opening selection, intro and exit to standby`.

Deviation: tests live in `submenu-options.test.ts`, `intro.test.ts`, `shortcut-entry.test.ts`
(new, the P5 facts with D = 1460 ms, W = 2948 ms as test config) and `apps.test.ts` (there is no
`applications.test.ts`). `shortcutEntry` is implemented here (D14 deviation) with these choices,
each pinned by a kernel test:

- Digits are matched as numbers at the level they apply to: the pending entry's children while
  an entry is opening (`8 6` opens Games implicitly with Settings selected), else the shown level.
  All-zero digits wait like a prefix (P5 `1 1 0` shows `11-0` and dots until the window ends);
  `0 1` meaning 1 is UNVERIFIED. A digit with no candidate opens `invalid` at once, also when an
  application opened by a shortcut is showing (UNVERIFIED).
- A selected entry shows in its level with `opening: true` (and the entry on the top row) and
  opens `openDelayMs` after its digit; a submenu with an intro runs it at once (P5 `8 1`). Per-
  digit shortcuts (plan 13 mode) skip intros, like paths. While a shortcut intro runs it takes
  every key (a digit only skips it) and the timers wait; when it ends the parent shows the entry
  opening again, the window restarts, and an opening that fell due during the intro happens at
  the window end (P5 `8 1`: ≈2.92 s of `8-1` without a soft key, then `8-1-1`; `8 1 2`: opens
  1.46 s after the `1`, then `8-1-` and dots until 2.95 s after the `2`).
- The window restarts at every digit, at a resolve (from the deadline, so a late tick does not
  shift it) and when a shortcut intro ends. Its end resolves waiting digits; the indicator keeps
  the resolved digits with the dots until the entry opens (P5 `m1` image h: `1` and dots, no
  soft key).
- The indicator needs one field beyond the D2 seams: `MenuIndicator.typed` (digits typed toward
  the next number, `""` for none) marks the awaiting form `<segments>-<typed>` plus dots; the
  list painter must not append the selection number when it is present. An application opened
  by a shortcut shows `8-6-3-` and dots until the window ends (P5 `8 6 3` image h), so
  `ApplicationContext` gains an optional `menuIndicator()` (optional only so hosts that wrap
  contexts, like the website's chat flow, still type-check). VISION records both.
- `exit({ select })` puts the selected child on the bottom row of a rows window (P12
  `games-top-score-wait` image m), not by the D3 move rule; `levels` counts every frame of the
  launching stack including the carousel. An intro's exit with `levels`/`select` returns like
  an application's; a plain exit of a shortcut intro keeps the shortcut.
- `SubmenuEntry` exposes `softkey`, `intro` and `openingChild()` (the machine reads them).
  Exceptions thrown by an `opening()` reader are not contained (as `detail`).

For Tasks 9-13: stock painters must hide the soft key when `opening` is set, draw `typed` per
the rule above (top level: `segments` empty, so `1` and dots), and widgets that paint their own
indicator read `context.menuIndicator?.()`. nokia-os configures `shortcutEntry` (openDelayMs
≈1460 from the probes, `invalid` = the Invalid shortcut note whose exit goes to standby) in
Task 12; the standby number entry after it stays out of scope.

### Task 6 - Stock fonts from the tree goldens (TDD)

**Files:** `scripts/harvest-glyphs.ts`, `scripts/glyph-overrides.ts`,
`scripts/extract-resources.ts`, `src/resources/generated/fonts.ts`, `src/resources/index.ts`,
`tests/harvest.test.ts`, `tests/resources.test.ts`, this plan's widget catalogue, spec §10.

- [x] Measure each widget layout from the goldens (band tops, left edges, icon boxes, softkey
      row) and correct the "Stock widget catalogue" table. The generated text runs use these
      bounds. Fix them in `tree-model.ts` if needed and regenerate.
- [x] Feed `scripts/generated/tree-text-runs.ts` to the harvester beside `text-runs.ts`. Resolve
      reported issues with overrides that name their golden. Never edit generated runs; fix the
      overrides table or the model. Add new faces if Task 3 mapped any (`StockFontName`,
      `missingStockGlyphs` union).
- [x] TDD `resources.test.ts`: freshness still holds; every string the stock tree renders (labels,
      option labels, value hints, leaf lines, info pages, text pages, softkeys) has no missing
      glyphs in its face, except text owned by placeholders.
- [x] Run `extract-resources` twice; no diff.
- [x] Commit: `feat(nokia-os): harvest stock glyphs from the menu-tree goldens`.

Deviation: the thin face is 8 rows, not 7 (game instructions show its descender row: `grow`,
`pots.`); `FONT_HEIGHTS.thin` is 8 and plan 13's thin glyphs gain a blank bottom row. Bearings join
plan 13's: small `1`, large `1` and large `:` sit one column into their cells (`Level 1`, `10:10`,
`13.10.2026`). The large `R` touches every following `e` (`Reminders`, `Received`, `Request`), so
the per-source `split` override became a `touch` pair override (`Re`, R's ink 8 columns) that
applies wherever the pair occurs; the `unused-split` issue is gone. Unknown advances follow the
ink-plus-one rule (17 overrides, each naming its golden).
Deviation: fixes to Task 2/3 inputs, regenerated: `tree-model.ts` drops art read as text from the
harvester runs (runs with no letter or digit, or only `I`/`l`/`i`/`'` readings: the Clock pages'
icon read as `' '`, splash and Bantumi gameplay dots, the U+E000 boxes); `parseResult` splits
tree.json's `/` line breaks (`Maze 1` / `selected`, `Заверше-` / `но`, `Topic number:` / `p9`);
`tree-overrides.ts` gains `valueHints` (12-6-2-10 Rename shows `(empty)`, like slot 6's label, D10).
S5 picked "the most common result" even when no result repeats, so the first option of 4-4, 7-1-1,
8-1-3, 10-3 and 11-2-3 had no `.choose` golden and the large `A` of `All call lists erased` was in
no golden; S5 now chooses every option when no result repeats (5 new `.choose` goldens: 365
fixtures, 334 asserted, 31 pending). `tests/firmware-phone.test.ts` uses a carrier the small face
still cannot draw (`Zap & Zone@`).
Deviation: the glyph test (`resources.test.ts`) assigns faces per string kind as measured: titles
large; labels, option labels, page labels, softkeys, confirm/progress/info-screen/level-bar lines
small; value hints and page values thin; note lines large; prompt lines small through the last line
ending in `:`, then large; text pages thin. `no-response` lines are not drawn. Placeholder-owned
nodes (`PLACEHOLDER_OWNERS`) are skipped below their label.

Completion (Task 6): glyphs small 103, large 66, digits 12, thin 77 (Latin, the Cyrillic of the
language list and its notes, `çêñüÆ`). Gaps for later text entry: small lacks `Z j " ; / @ & * # %
= _ < > $ £`; large lacks `B E F H J K O Q U V W X Y Z j 8 , ? ' " + ; / @ & * # % = _ < > $ £`
(note the digit `8`: number entry with an 8 cannot draw until a golden shows one); thin lacks
`B C H J Q V W X Z j q z ? ! " - + ; / @ & % = _ < > $ £`. Plans 18/19 (editors, number entry)
need captures with these characters.

### Task 7 - Widget sprites and timelines from goldens (TDD)

**Files:** `scripts/extract-resources.ts`, `scripts/widget-sprites.ts` (new: crop table),
`src/resources/generated/widgets.ts` (generated), `src/resources/index.ts`,
`tests/resources.test.ts`.

- [x] Crop table (golden id, image, rectangle, sprite id): note icons (each tick step, `!`,
      octagon, and others found), progress bar frames, prompt mode icons, ☑/☐ marks, level-bar
      art, the four game splashes' frames.
- [x] Timelines: from each `leaf`/`choose`/probe timeline golden, the sprite frame sequence
      with durations from the trigger frame (D8), including the terminal step before the parent
      returns. Equal sequences share an id. Emit `WIDGET_TIMELINE_BY_NODE` (node number →
      timeline id) from the goldens' `covers`. Progress bars carry `loopFrom`.
- [x] TDD: freshness; every sprite is binary and inside its golden's ink; every timeline is
      finite except progress loops; every `leaf` golden of an in-scope note, progress note or
      splash has a timeline.
- [x] Run twice; no diff.
- [x] Commit: `feat(nokia-os): derive stock widget sprites and timelines from goldens`.

Deviation: a timeline step shows a `WidgetFrame`, not only a sprite: `sprite` (the widget's
screen with that sprite as its animated element), `cursor`/`plain` (a prompt's cursor shown or
hidden), `blank`, `image` (a leading frame of another screen kept whole as captured, sprite
`capture/<golden>/<image>`: the 45-60 ms `Opening` before the Inbox/Outbox notes, the 55-63 ms
erase before the Info service notes), `cut` (a partial draw: the next frame's first `bytes` LCD
bytes, written in 8-row pages column by column, over the previous screen; the 15 ms draw before
`Done` after Type of view, the 16 ms draw inside the Pairs II splash) and `edges` (the next screen
outside columns 5..78, the previous inside: the 8-9 ms draw before standby). Painters need the
previous screen for `cut`/`edges`; the flow host has it for its own widgets.
Deviation: blinking prompts (P9) get cursor timelines too, so loops are progress bars and prompt
cursors; both loop from step 1 (step 0 is the first, shorter draw). Timelines are keyed by their
first covered node (or probe key) and shared when equal (`1-5`/`1-6`, `6-3-4-2`/`11-2-2`, ...).
Probes have no `covers`, so `scripts/widget-sprites.ts` lists the probe timelines later tasks need
(`PROBE_TIMELINES`): the four splashes by game node (8-1..8-4) and, by name in
`WIDGET_TIMELINE_BY_NAME`, `request-not-confirmed` (P7), `level-5-done` and
`reminder-memory-empty` (P8) and `invalid-shortcut` (P5). Accessors in `src/resources/index.ts`:
`WIDGET_SPRITES`, `WIDGET_TIMELINES` (frames + phone-core `Timeline`), `WIDGET_TIMELINE_BY_NODE`,
`WIDGET_TIMELINE_BY_NAME`.

Completion (Task 7): 67 sprites (5 note icons: tick box/half/full, info `!`, error octagon; 11
Top score frames; 10 progress-bar frames; 3 prompt icons: pen, `abc`, phone book; 2 marks; 3 level
bars; 29 splash frames; 4 lead captures) and 87 timelines (78 tree nodes mapped, 4 splashes, 4
named). `widgets.ts` is 244 KB (splash frames are full-frame). A second run changes nothing.

### Task 8 - Settings store and page values (TDD)

**Files:** `src/firmware/settings.ts` (new), `src/firmware/bindings.ts` (new: setting keys and
aliases first), `src/firmware/settings-snapshot.ts` (deleted), `src/firmware/menu.ts` (detail
reader only), `tests/settings.test.ts` (new), `tests/firmware-menu.test.ts`.

- [x] TDD `createMemorySettings`: `choice` null until written; `choose` validates the index;
      `marks`/`toggle`; `text`; separate instances do not share state.
- [x] Virgin snapshot from `STOCK_TREE`: each option list's `opening` (null for unset lists),
      multi-select marks as captured, value hints as display text, free-text values (message
      centre, voice mailbox, memory status, scores). Setting key = the list's slug path.
      Aliases: Tones 5-1…5-9 ↔ `profiles/general/personalise/*` (P11 decides; Deviation if
      not shared).
- [x] Page detail: chosen label, else the value hint, else nothing; Clock settings and Date
      setting still read the host ports. Replace `settings-snapshot.ts` (subtract) and keep
      every plan 13 level-1 page value test green.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [x] Commit: `feat(nokia-os): in-memory stock settings with virgin-EEPROM state`.

Deviation: a key's virgin text is its page value until the key's first choice (or toggle), which
removes it; the page then shows the chosen label. "Chosen label, else the value hint" would show
`On` for Games › Settings › Shakes, whose list opens on On while its page reads `1 player`
(uninitialised EEPROM, D10). Only pages that show a value have one: nodes with a value hint, and
lists that open unset (their page shows the choice once made: Incoming call alert → `Ringing`,
`tree/05-tones/5-3-1.choose`). Lists that open on an entry without a page value (Erase recent call
lists) show none. Checked against the final page of every `.choose` golden.
Deviation: `StockSettingsSnapshot` is `{ choices: { key: { options, chosen } }, marks, texts,
aliases }`; aliased keys (Tones → `profiles/general/personalise/*`, 9 keys, not Composer) are
stored once under their target, and the virgin builder throws if an alias's virgin values differ.
Free texts are the value hints, info page values (`<list key>/<page label slug>`, e.g.
`games/snake/score-ids/top-score-id`) and `VIRGIN_TEXTS` in bindings.ts (message centre,
voice mailbox, memory status free/used, the four top scores). `StockPorts` and `HOST_VALUES`
(Clock settings, Date setting) moved to bindings.ts; `createStockMenu(ports, settings)` takes the
store (default: a fresh virgin store per menu). The store has no setter for texts: Task 12's leaf
setters (Info service, Screen saver On/Off) need one, or model those pages as choices.
For later tasks: prompts whose first screen shows a character counter (Add name, message centre,
Reminders › Add new, Rename) have no `lines` in the tree data (Task 3 reads leaf text only up to
the first frame with a `digits` run), so Task 11 takes their labels from the goldens. Choosing
12-hour in Time format changes the Clock settings page to `10:10 am`
(`tree/11-clock/11-2-3-2.choose`).

### Task 9 - Flow host, rows window painting and list widgets (TDD against goldens)

**Files:** `src/widgets/flow.ts` (new), `src/widgets/option-list.ts` (new),
`src/widgets/multi-select.ts` (new), `src/display/list-rows.ts`, `src/display/paint.ts`,
`src/display/widgets/{options.ts,multi.ts}` (new), `src/firmware/phone.ts` (`rowsWindow: 3`),
`tests/flow.test.ts`, `tests/widgets-lists.test.ts` (new), `tests/paint-lists.test.ts`.

- [x] TDD flow host (`StockFlowApplication`): a stack of widgets; `push`, `replace`,
      `back(levels)` (empty → `context.exit()`), `standby()` (→ `exit({ to: "standby" })`);
      keys act on short-press release as in the placeholder; tick drives the top widget; render
      returns a cached `custom` frame painted by `paintWidget`, repainted only when the model changes.
- [x] Rows painter takes `windowTop` (circular rows). Kernel lists use `screen.windowTop`. Remove
      the `max(0, selected - 2)` rule (subtract). Plan 13's literal list models in
      `paint-lists.test.ts` gain the `windowTop` the kernel now emits; their `.sub` goldens still pass.
- [x] TDD option list: opening per the store; D3 window; indicator `<path>-<k>` and `-0` unset;
      softkey `OK`/`Quit`; OK writes the store and runs the option's result (`replace` with its
      widget); C back. Unset ▼/▲ per P10.
- [x] TDD multi-select: marks from the store; softkey `Mark`/`Unmark` toggles; C leaves (P14).
- [x] Painting tests: the literal widget models equal every image of one `.options` golden per
      layout variant (single, unset, multi) and `menu/01-phone-book.sub-up`.
- [x] Commit: `feat(nokia-os): flow host, circular rows window and option lists`.

Deviation: option-list indicators are not always `<list path>-<k>`. Decoding the first image of
every option-list golden: the lists of Message settings › Set n show only the option's number
(`tree/02-messages/2-7-1-3.options`: `6`; all 2-7-n-m lists), and the Call divert lists show
their parent level's path (`tree/07-call-divert/7-3-4.options`: `7-3-0`, `7-3-1`;
`7-1-1.options`: `7-1-1`). The option list takes a `numbering` (`path`/`parent`/`option`) and
`bindings.ts` has `optionListNumbering(number)` (prefixes `2-7-` → option, `7-` → parent), which
Task 12 passes to every list. Every other list, info pages included, reads `<path>-<k>`.
Deviation: the indicator painter draws the stock awaiting form (`MenuIndicator.typed`): the
level's path, a dash and the typed digits, right-aligned to end at x 78, then the dots (`1`, `12-`,
`11-0`; probe/shortcut-m1-2 images d and i); kernel lists add no selection number then, and the
list and carousel painters hide the soft key while `opening`. `awaitingFirst` still draws only
the dots. Widget lists use the same rule through `rowsIndicator` (src/widgets/rows.ts, shared by
the option list and multi-select with the D3 cursor). Painters live in
`src/display/widgets/{options,multi,index}.ts`; `index.ts` holds the `WidgetModel` union and
`paintWidget`. `menu/01-phone-book.sub-up` gets its key-driven acceptance scenario here (Phone
book, ▼×5, ▲ per image), so `awaitsPlan14Scenario` keeps only `tree/*` and `probe/*`.
Deviation: multi-select toggles write the store at once and C leaves (this task's text); Task 10
adds the `Save changes?` query of P14.

Completion (Task 9): pixel-exact in unit tests, driven by keys through the flow host against the
virgin store: every asserted option-list `.options` golden (single choice, unset, multi-select
2-8-5) image by image, and every asserted option-list `.open` golden (Profiles' Personalise lists
included, through the Tones alias); literal models for 2-7-1-3, 5-2 and 2-8-5; the kernel's
`menu/01-phone-book.sub-up` (paint test and acceptance) and every plan 13 `.sub` with `windowTop`.

### Task 10 - Notes, progress notes and confirm queries (TDD against goldens)

**Files:** `src/widgets/{note.ts,progress.ts,confirm.ts}` (new),
`src/display/widgets/{note.ts,progress.ts,confirm.ts}` (new), `src/firmware/bindings.ts`
(`NOTE_STYLES` by note text), `tests/widgets-notes.test.ts` (new).

- [x] TDD timed note: text lines in the measured face; icon sprite per its timeline frame;
      ends with `back()` (or `standby()`) after the generated timeline; key behaviour per P6.
- [x] TDD static note (stays until a key; P12), progress note (looping bar; Quit/C per P7),
      confirm query (OK → result, C → back per P8; softkey from the tree).
- [x] Painting tests against one golden per note style, the progress loop images and each
      confirm query's first image.
- [x] Commit: `feat(nokia-os): stock timed, static and progress notes and confirm queries`.

Deviation: loops are reproduced as captured. Later cycles of a progress bar drift by 3-14 ms from
the first (`tree/06-settings/6-2-4-2.leaf` row 16), so `extract-resources.ts` now keeps every
recorded step of a looping timeline (progress bars and prompt cursors) and repeats only the last
full cycle; the last recorded step is dropped (the recording's end or a key cut it short). The
emulator is deterministic (the first 5.4 s of `probe/progress-7-6-quit` equal the 7-6 leaf's
rows), so `PROBE_TIMELINES` takes node 7-6's bar from that 10 s probe. `resources.test.ts` pins
the new shape. Regenerated twice, no diff.
Deviation: `NOTE_STYLES` (bindings.ts) maps note text to a representative generated timeline for
notes no golden recorded (`Done` → 2-7-3-3-2, `Timeout selected` → 5-9-3-1, `Requesting` → 7-6);
`noteTimelineId(byNode, number, lines)` prefers the node's own. Task 12 must map nodes inside
`SAME_AS` subtrees to their model's numbers first (12-3-2-9-1 → 12-2-2-9-1: a long Screen saver
`Done`, not the short style). Topics, language and profile notes are placeholder-owned.
Deviation: widget shapes as built. Notes end with `back`, `standby` or `{ select }` (Top score:
`new-game`, P12); any key ends a note at once (C and ▼ probed, other keys UNVERIFIED), and
▲/▼ select the bound neighbour (`moves`, sibling slugs from Task 12) in the level returned to
(P6), which needed `Flow.back(levels, { select })`. Progress notes: Quit and C both run `quit`
(default back; Requesting binds the `request-not-confirmed` note, `end: "standby"`; C on
Requesting is UNVERIFIED). Confirm queries: tops by line count (1: 2; 2: 4/13; 3: 2/12/22) and
an optional `cancel`. The Level 5 choice stores only after its query's OK, then the
`level-5-done` note replaces the query (bound in Task 12; pinned by a test). Multi-select now
keeps draft marks: C after a change pushes `Save changes?` [Yes] (`probe/multiselect` image
after-c), Yes stores and leaves, C on the query leaves without storing (UNVERIFIED). The flow
paints the outgoing widget before `push`/`replace`/`back`, so a `cut` draws over it; `edges` draws
standby's ladders (signal and battery 4) outside x 5..78. Test support:
`tests/support/flow-rig.ts` (a flow on a 1 ms clock, compared with a golden's widget rows and
its exit time) and `tests/support/tree.ts`.

Completion (Task 10): pixel- and timing-exact (±2 ms, aligned on the trigger) through the flow
host: all 39 asserted `.leaf` goldens whose node opens a timed or progress note (information,
error, tick, long, Inbox/Outbox `Opening` leads, Info service erase leads, 6-2-4-1's edges step
to standby, the four Top scores and every progress bar), including the exit time; all 35
asserted option-list `.choose` goldens whose result is a note, progress note or confirm query
(1-8-1-1's 15 ms `cut` included); `probe/progress-7-6-quit` (10 s of bar, Quit, `Request not
confirmed`, edges, standby), `probe/confirm-5-2-5-ok`, `probe/multiselect.rec` and the first
image of every confirm-query probe.

### Task 11 - Info pages, prompts, level bar, text pages and game splash (TDD against goldens)

**Files:** `src/widgets/{info-pages.ts,info-screen.ts,prompt.ts,level-bar.ts,text-pages.ts,splash.ts}`
(new), matching painters in `src/display/widgets/`, `tests/widgets-info.test.ts` (new).

- [x] TDD info pages (per-page softkey; `Back` exits; a page with a result pushes it, and the
      flow returns to the pages after it), info screen (`Back`).
- [x] TDD prompts: first screen for text, number and code prompts (icon, label lines, value or
      box, softkey); cursor timeline if P9 found one; C back; other keys inert (D11).
- [x] TDD level bar (P12 keys), text pages (`More` through every page captured in P12, then back),
      splash intro application (timeline, skip key and end per P12; exits to reveal the list).
- [x] Painting tests against the first image of each kind's goldens.
- [x] Commit: `feat(nokia-os): stock info pages, input prompts, level bars, text pages and splashes`.

Deviation: one module per widget as listed, plus `src/widgets/playback.ts` (Task 10) and
`promptFromLayout` in `src/widgets/prompt.ts`; the splash intro is `splashIntro(id, timeline)`
in `src/widgets/splash.ts` (a `StockFlowApplication`). Prompts differ per node beyond the
catalogue, so `bindings.ts` gains `PROMPT_LAYOUTS` (measured on the first image of every prompt
golden) and `promptLayout(number, kind)` (code prompts share the pen and label-only layout):
mode icons (`pen`, `Abc`, lower-case `abc`, phone book), the counter top right in the digits face
and the label of the prompts the tree has no lines for (Add name `16` `Name:`, message centre
`20`/`30` `Centre number:`, Reminders `35` `Remind about:`, Rename `4` `New name:` with
`Silent`), and the entry: `value` below the label (Speed dials), or a box from below the label to
y 36 (top 16, or 25 under a two-line label) holding `text` entry (large from x 2, two rows below
the box's top, cursor after it), a right-aligned value ending at x 83 on the box's bottom (large,
or small for `+1234567890`) with the cursor at its `end` (x 82) or `start` (time and date), or
none (Search). The cursor fills the last cell's blank column. `splitPromptLines` splits the
tree's lines (label through the last line ending in `:`). Rename's lower-case `abc` is a new crop
in `scripts/widget-sprites.ts` (`prompt/abc-lower`, `tree/12-profiles/12-2-2-10.leaf` b).
Deviation: `bindings.ts` also gains `LEVEL_BARS` (node → bars sprite) and `PAGE_RESULTS` (P15:
4-8-1 opens an On/Off list on its page value, 4-8-4 opens `Last recharge:`/`Expiry date:` pages
valued `0`), which the tree records only by kind. Info pages take each page's value as a
function (a choice made from a page shows at once) and push results through a flow whose
indicator adds the page's number (`4-8-1-2`). Text pages, level bars and info screens: the soft
key/More and C as P12; other keys inert. A splash ends with `back()`, any key skips it at once.
For Task 13: the splash-skip probes' first step lasts 252 ms against the 8-1 splash recording's
248 ms (capture jitter), so their scenario cannot hold ±2 ms on that row with the shared splash
timeline; Club Nokia ID's prompt (`probe/confirm-8-6-4-ok`) has no blink timeline of its own.

Completion (Task 11): pixel-exact, and timing-exact (±2 ms) for timelines, through the flow host:
every asserted info-pages `.options`/`.open` golden (4-5, 4-6, 4-8, 8-1-5, 8-2-3, 8-4-1-4,
8-4-2-4, ▼ per image) and every asserted info-page `.choose` (Back pages exit on the key; Not
allowed returns to the pages; Clear timers' code prompt; Credit info display's On/Off list;
Recharge status' pages), `probe/prepaid-credit-info-display`; Memory status (1-8-2); every
asserted prompt golden (17: text, number, time, date, code; the cursor blinks through each whole
recording) and Club Nokia ID's prompt images; the three level-bar goldens and P12's level keys;
the five Instructions probes (More cycles) and leaves, and `games-instructions-c`; the four
splash probes to the game menu, and the three skip probes (pixels and the exit at the key).

### Task 12 - Firmware composition: the whole tree (TDD)

**Files:** `src/firmware/menu.ts`, `src/firmware/bindings.ts`, `src/firmware/placeholder.ts`,
`src/firmware/phone.ts`, `tests/firmware-menu.test.ts`, `tests/firmware-phone.test.ts`.

- [ ] Build `createStockMenu(ports)` from `STOCK_TREE`: submenus with presentation, `softkey`,
      `opening` (from the store), `detail` (Task 8), `intro` (splash) and hidden numbers; leaves as
      flow applications from `bindings.ts` (default widget by kind; placeholders per "Leaf
      ownership" with their plan; `10-2` no-op; leaf setters such as Info service On/Off and
      Screen saver On/Off; 6-2-4-1 `standby()`). Delete `STOCK_LEVELS` (subtract).
- [ ] `PlaceholderApplication` gains `ownerPlan` (shown nowhere on screen; asserted by tests).
      Export `PLACEHOLDER_OWNERS` and `SAME_AS` from bindings for Task 13.
- [ ] TDD: every `STOCK_TREE` node maps to a menu entry or a flow; paths unique and kebab-case;
      every placeholder has an owner; level 1 unchanged against plan 13; `createStockPhone` sets
      `rowsWindow: 3`; standby ▲/▼ still open the plan 13 targets (now prompt/note widgets).
- [ ] Run the full nokia-os suite: plan 13's acceptance must stay green.
- [ ] Commit: `feat(nokia-os): compose the whole v6.39 menu tree with stock widgets`.

### Task 13 - Acceptance at scale and the coverage guard

**Files:** `tests/support/drive.ts` (new), `tests/support/rig.ts`, `tests/acceptance.test.ts`,
`tests/drive.test.ts` (new).

- [ ] TDD `goto` against a small synthetic stock-tree menu: key sequences for rows, pages,
      hidden gaps, opening selections, intros and option choices (including unset).
- [ ] Generic scenarios per "Generic scenarios"; hand-written scenarios for `probe/*` and
      `menu/01-phone-book.sub-up`. The rig skips repainting when a `custom` frame object is
      unchanged (performance; no behaviour change).
- [ ] Coverage guard per "Generic scenarios and the coverage guard", including `SAME_AS`
      structural equality (same shape, labels equal except profile names) and the equality of
      the importer's and the bindings' `PLACEHOLDER_OWNERS`/`SAME_AS`.
- [ ] Every asserted golden passes; timelines within ±2 ms after alignment. Report the suite's
      run time.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp check --fix`.
- [ ] Commit: `test(nokia-os): drive the whole menu tree against its goldens`.

### Task 14 - Demo, README, verification gate and closeout

**Files:** `packages/nokia-os/{README.md,demo/main.ts}`, `docs/specs/nokia-3310.md`,
`docs/plans/README.md`, this plan.

- [ ] Demo: the golden overlay lists the new goldens (grouped by top-level menu); verify with
      `mise exec -- vp run @hellotimber/nokia-os#demo` and `agent-browser`: an option-list
      choice with its `Done` note and the updated page, a progress note, a game splash, ▲ wrap in
      Phone book. Screenshots in the completion notes.
- [ ] README: the tree data pipeline (`import-captures` → `import-tree` → `extract-resources` →
      test), the settings store's scope (D9), leaf ownership.
- [ ] `mise exec -- vp check --fix`, `vp run -r test`, `vp run website#build`;
      `git diff --stat <commit before Task 1> -- website/` is empty.
- [ ] Spec §10: replace "(plan 14, in progress)" markers with verified facts; list what stays
      UNVERIFIED; add the new artefacts.
- [ ] Plans README: row 14 `done`; rows 23/24 "Builds" read gameplay and scores only (D12).
- [ ] Completion notes; status `done`.
- [ ] Commit: `docs: complete menu depth and stock widgets (plan 14)`.

## Follow-up plan adjustments

- **15 - Storage port and Settings:** starts from D9's internal store. It adds the host
  persistence port and exports it, adds factory defaults (replacing the virgin snapshot when
  configured), code verification, language switching (the three non-English choices) and the
  welcome note.
- **17 - Profiles:** Activate, the standby profile indicator, and switching the active profile
  that Tones aliases (D9).
- **18, 19, 21, 22:** take over the prompts and empty-state notes listed in "Leaf ownership".
  Each replaces a first-screen widget with the full flow.
- **23, 24:** gameplay and score writing only; the game menus, splashes and widgets exist (D12).

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Virgin vs factory state (D10):** the virgin-EEPROM state (unset tone lists, `Top score: 45`,
   junk score IDs) is the asserted initial state, as plan 13 did for page values. Reverse in plan
   15 by swapping the initial snapshot; the goldens stay as evidence of the virgin state.
2. **Game menus in plan 14 (D12):** included, because the brief's level bars and text pages exist
   only there. Reverse by moving Tasks 7/11's splash and game widgets to plans 23/24.
3. **Profiles › Activate (12-n-1):** placeholder for plan 17, because activating Silent, Discreet
   or Loud changes standby (profile icon) and a half-done Activate would show a wrong standby.
4. **Entry latency (D8):** the 50-110 ms between Select and the firmware's redraw is not
   reproduced; timelines align on the first new frame. Revisit if the website adopts nokia-os and
   the latency is perceptible.
5. **Settings store visibility (D9):** internal until plan 15 defines persistence.
6. **Tones ↔ General profile (D9):** shared storage, confirmed or corrected by P11.
7. **Chat (3):** stays a placeholder as the brief says. Its first screen is a number prompt that
   Task 11 builds, so plan 18 can adopt it.
8. **Repo size (D6):** ~3 MB of text goldens (≈150 KB packed) is accepted; if not, a run-length
   golden format is a separate, mechanical change.

## Done means

- Every navigable node of the v6.39 tree exists in `stockMenu` in order with hidden-number gaps,
  presentations, softkeys and opening selections; placeholders name their owner plan.
- Rows lists use the circular window everywhere (kernel levels and widget lists);
  `menu/01-phone-book.sub-up` and the ▼-wrap probe are asserted.
- Option lists, multi-select, timed/static/progress notes, confirm queries, info pages/screens,
  prompts (first screen), level bars, text pages and splashes are stock widgets checked
  pixel-exactly against goldens, with timelines within ±2 ms after alignment.
- Choices persist in the in-memory store and pages show them; the initial state is the captured
  virgin EEPROM.
- The coverage guard proves every tree node is asserted, pending with a matching owner, or inside
  a proven same-as subtree; generated data and resources are fresh and idempotent.
- phone-core is still Nokia-agnostic, the website is byte-for-byte unchanged in behaviour, and
  `vp check`, `vp run -r test` and `vp run website#build` pass.
- VISION, the spec and the plans README match what shipped.

## Completion notes

(Filled in as tasks complete.)
