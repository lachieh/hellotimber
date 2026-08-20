# Plan 12 - Reference-accurate LCD graphics and menu shortcuts

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 01-11 complete.
**Ground truth:** `docs/todos-assets/home-screen-reference.png`, the Nokia menu-list
reference supplied with this plan, and `docs/specs/nokia-3310.md` sections 2, 4, and 5.
**Status:** done.

**Completion note:** The source references are perspective photographs rather than firmware
bitmaps. Their active LCD areas were rectified for visual comparison, while the reviewed
84x48 literal fixtures remain the canonical reproducible output. Task 5 and 6 changes remain
unstaged because those same core and website files contained pre-existing uncommitted Plan 11
work; committing them separately would also commit unrelated worktree changes.

## Goal

Make the Nokia LCD reproducible at its native 84x48 resolution from explicit pixel data,
then use that capability to match the reference standby and menu screens exactly:

- authentic signal and battery ladders;
- a dedicated fixed-cell 5x6 clock font and correct standby composition;
- reference-derived notification icons;
- the authentic one-pixel menu position rail and seven-pixel bumpout;
- 10-pixel inverted menu selections;
- hierarchical numeric shortcut feedback such as `5 • 3 • _`;
- immediate screen and URL navigation after every valid shortcut digit.

This is not a new package. `@hellotimber/phone-screen` already is the graphics library:
its `Framebuffer` is exactly 84x48, one byte per logical pixel, and its canvas and
three.js consumers preserve that mapping with nearest-neighbor sampling. Extend that
library rather than introducing a second rasterizer or changing package boundaries.

## Why this plan exists

The current raster pipeline is exact, but several authored assets and coordinates are
best guesses that no longer match the photographic evidence:

1. Standby icons are above four equal 3x4 bars; the reference puts unequal bars above
   bottom icons.
2. The clock uses the general variable-width body font at lower-right; the reference
   uses a fixed 5x6 clock face at top-right.
3. The carrier starts at y=12; the reference starts near y=8.
4. Menu lists render a title above three rows. In the reference, `Search`, `Add name`,
   and `Erase` are the three rows; there is no separate `Phone book` title.
5. The position indicator is currently a 3-pixel solid thumb on a right-edge track.
   The reference is a one-pixel rail that temporarily steps one pixel right.
6. Shortcut digits are accumulated invisibly and committed only on timeout/Navi. The
   reference behavior previews each resolved level and displays the entered hierarchy.
7. Existing tests mostly build expected output from the same production primitives.
   They protect implementation consistency, not photographic fidelity.

## Accepted decisions

1. `Framebuffer`, `Bitmap`, `PixelFont`, and string-art sprites remain the low-level
   graphics API. No canvas drawing, SVG, CSS, antialiasing, or fractional coordinates
   enter `phone-screen`.
2. Photographs are evidence used to reconstruct canonical 84x48 fixtures. Runtime code
   never reads, scales, thresholds, or ships the photographs.
3. Full-frame literal fixtures are the visual source of truth. Expected frames must not
   be assembled with the same helpers under test.
4. The body font remains available for existing screens. The clock receives a separate
   fixed 5x6 font; do not globally force the body font into clock metrics.
5. Menu shortcuts remain one `1`-`9` digit per hierarchy level. Existing top-level menu
   orders 10-13 remain visible but not directly shortcut-addressable; resolving that
   ambiguity is separate scope.
6. Every valid digit immediately enters the matching menu entry. The phone screen, phone
   path, browser URL, and numeric indicator update together; there is no display-only
   preview stack.
7. The three-second shortcut window remains. Every accepted digit restarts it.
8. The trailing `_` appears only after at least one valid digit. Timeout or any
   non-shortcut key removes `_` before normal handling of that key. The resolved numeric
   path remains visible without `_`.
9. `0`, `*`, `#`, power, Navi, C, up, and down are non-shortcut keys for this grammar.
10. An invalid `1`-`9` digit does not change the path or append to the indicator. The
    existing active window remains so the user can press a valid sibling number.
11. Direct URL navigation and ordinary up/down/Navi navigation show the resolved numeric
    path without `_`.
12. Numeric context is structured data in `ScreenModel`, never a preformatted string in
    phone-core. `phone-screen` owns separators, glyphs, alignment, and cursor pixels.
13. Standby notification icons are conditional. The reference fixture may enable
    voicemail and SMS, but the production website does not invent notifications when no
    corresponding state exists.

## Package boundaries

Unchanged:

```text
website ---------------------> phone-core
   |                              |
   |                              | ScreenModel types only
   +--------------------------> phone-screen
   |
   +--------------------------> phone-3d
   |
   +--------------------------> snake
```

- `phone-core` owns menu hierarchy, numeric-entry state, timeout behavior, and paths.
- `phone-screen` owns fonts, sprites, pixel coordinates, inversion, and indicator shape.
- `website` owns content, current time, notification sources, router synchronization,
  and accessible text.
- `phone-3d` continues to receive only a ready-made canvas and version.
- `snake` keeps its standalone bitmap implementation; this plan does not create a new
  dependency for it.

## Public contract changes

Task 1 must update `VISION.md` before implementation.

Add plain serializable menu and standby status context:

```ts
export interface MenuIndicator {
  /** One-based MenuOrder values from the root to the screen being displayed. */
  segments: readonly number[];
  /** True while another 1-9 shortcut digit is being accepted. */
  awaitingNext: boolean;
}

export interface StandbyIndicators {
  voicemail?: boolean;
  message?: boolean;
}
```

Apply the fields as follows:

```ts
type ScreenModel =
  | {
      kind: "standby";
      carrier: string;
      clock?: string;
      signal: 0 | 1 | 2 | 3 | 4;
      battery: 0 | 1 | 2 | 3 | 4;
      indicators?: StandbyIndicators;
      notice?: { text: string; softkey: string };
    }
  | {
      kind: "menu-carousel";
      label: string;
      menuNumber: number;
      total: number;
      iconId: string;
      menuIndicator: MenuIndicator;
    }
  | {
      kind: "list";
      title: string;
      items: string[];
      selected: number;
      softkey: string;
      menuIndicator?: MenuIndicator;
    }
  | {
      kind: "reader";
      title: string;
      lines: string[];
      scrollTop: number;
      menuIndicator?: MenuIndicator;
    };
// remaining variants unchanged
```

`menuIndicator` is required on the firmware carousel because it always has a numeric
identity. It is optional on generic list/reader models so standalone applications can use
those screen kinds without pretending to be menu navigation. Firmware-generated menu
lists/readers always provide it.

## Canonical pixel geometry

All coordinates are native framebuffer coordinates, zero-based.

### Standby

The first implementation pass uses this reconstructed grid, then adjusts the literal
fixture only if a nearest-neighbor overlay against the reference proves a one-pixel error:

| Element           | Geometry                                            |
| ----------------- | --------------------------------------------------- |
| Signal level 4    | x=0..3, y=0..5                                      |
| Signal level 3    | x=0..2, y=8..13                                     |
| Signal level 2    | x=0..1, y=16..21                                    |
| Signal level 1    | x=0..1, y=24..29                                    |
| Signal icon       | 5x6 sprite at x=0, y=32                             |
| Battery level 4   | x=80..83, y=0..5                                    |
| Battery level 3   | x=81..83, y=8..13                                   |
| Battery level 2   | x=82..83, y=16..21                                  |
| Battery level 1   | x=82..83, y=24..29                                  |
| Battery icon      | 5x6 sprite at x=79, y=32                            |
| Clock             | fixed 5x6 cells, right edge x=75, y=0               |
| Notification area | x=7..48, y=0..6; voicemail then SMS                 |
| Carrier           | body font centered, y=8                             |
| Softkey           | body font centered, y=41 unless fixture proves y=40 |

Levels fill from the bottom upward. Level 1 draws only the narrow bar nearest the icon;
level 4 draws all four bars. Signal bars are left-aligned; battery bars are right-aligned.

The 5x6 clock font uses five-pixel cells with spacing baked into each cell. `21:51`
therefore occupies 25 pixels and starts at x=51 when right-aligned to x=75.

### Menu list

| Element           | Geometry                                           |
| ----------------- | -------------------------------------------------- |
| Item text origins | `(2,9)`, `(2,19)`, `(2,29)`                        |
| Selected band     | x=0..81, y=`textY-1`, width=82, height=10          |
| Selected padding  | 1 pixel above seven rows of ink, 2 pixels below    |
| Selected text     | body font, color 0, same origin as unselected text |
| Softkey           | centered at y=41                                   |
| Position rail     | x=82, y=8..39                                      |
| Bump column       | x=83                                               |
| Numeric indicator | right-aligned to x=80, y=0                         |

When `menuIndicator` is present, a list does not render `screen.title`. The three visible
menu items use all three content rows, matching the `Search / Add name / Erase` reference.
Generic application lists without `menuIndicator` retain their existing title behavior
unless their own renderer explicitly opts out.

The seven-pixel position bump replaces a section of the rail; it is not a filled thumb:

```text
rail x=82:  |           |
             \         upper 1px step to x=83
bump x=83:   | 5px run
             /         lower 1px step back to x=82
rail x=82:  |           |
```

For bump top `y`:

```text
(83, y)          upper connector
(83, y+1..y+5)   five-pixel vertical run
(82, y+6)        lower connector / resumed rail
```

Do not also draw the hidden x=82 section at `y..y+5`. The bump offset is:

```ts
round((index * (32 - 7)) / max(1, total - 1));
```

so the complete bump remains inside y=8..39 for first, middle, and last items.

### Numeric menu indicator

`phone-screen` formats structured data as:

```text
segments=[5], awaitingNext=true     -> 5 • _
segments=[5,3], awaitingNext=true   -> 5 • 3 • _
segments=[5,3], awaitingNext=false  -> 5 • 3
```

Add a literal `•` glyph to the body font. Keep the existing `_` glyph, but add an exact
bitmap assertion for both glyphs. The formatted indicator is right-aligned to x=80 and
must not touch the x=82 rail.

## Shortcut state and data flow

Target flow for `Menu`, `5`, `3`, then a non-number key:

```text
Menu
  screen: top-level item 1
  path: menu
  indicator: 1
  shortcut window: open but no cursor (no digit accepted yet)

5
  resolve root MenuOrder(5)
  immediately build/enter that navigation stack
  screen and URL move to the fifth item
  indicator: 5 • _
  restart 3000ms deadline

3
  resolve MenuOrder(3) from the current shortcut level
  immediately build/enter that navigation stack
  screen and URL move to the nested item
  indicator: 5 • 3 • _
  restart 3000ms deadline

non-number or timeout
  preserve current screen and path
  indicator: 5 • 3
  close shortcut window
  then process the non-number normally
```

The persistent segments come from canonical entry `MenuOrder`s in the active navigation
stack, including the stack retained by an application activation. Do not retain duplicate
display-only path state after the shortcut closes.

While a shortcut is active, digit handling must occur before frame-specific handling so
nested submenu/list/reader screens can accept the next segment. Application sessions must
not receive a digit that phone-core accepted as a menu shortcut. Once a digit does not
resolve against a numbered child level, it is ignored by shortcut handling and the current
screen remains unchanged.

## Tasks

### Task 1 - Contracts, reference record, and plan activation

- [x] Update `VISION.md` first with `MenuIndicator`, `StandbyIndicators`, and the changed
      `ScreenModel` fields exactly as specified above.
- [x] Update `docs/specs/nokia-3310.md`: replace the old clock/font guesses with the
      reference-derived standby geometry; document the menu rail, inversion, numeric path,
      and which details are photographic evidence versus project interpretation.
- [x] Add the supplied menu photograph to `docs/todos-assets/menu-list-reference.png` if
      it is not already available as a repository asset. Do not substitute the existing
      rendered screenshots in `docs/plans/assets/`.
- [x] Change this plan's status to `in progress` and update `docs/plans/README.md`.
- [x] Do not change runtime code in this task.
- [x] Commit: `docs: specify reference-accurate LCD rendering`

### Task 2 - Formalize the 1:1 pixel-authoring API and golden fixtures

- [x] TDD: add tests proving every font/sprite fixture has integral dimensions and only
      0/1 pixels; add exact bitmap tests for new clock glyphs, `•`, `_`, signal, battery,
      voicemail, and SMS.
- [x] Rename/export the private font compiler as a small reusable `createPixelFont()` only
      if needed to define both body and clock fonts without duplicating validation. Do not
      add a retained scene graph, drawing context, generic geometry framework, or dependency.
- [x] Add `packages/phone-screen/src/font/clock.ts` with fixed 5x6 cells for `0`-`9` and
      `:`. Unknown clock characters must fail or be rejected; they must not silently use the
      body-font `?`.
- [x] Keep `bitmapFromArt`, `Framebuffer`, and `PixelFont` as the direct public authoring
      seam; update `packages/phone-screen/README.md` with a native 84x48 sprite/font example.
- [x] Add literal 48-row-by-84-column ASCII golden fixtures for the reference standby and
      menu list. Fixtures must be hand-reviewed data, not generated by production helpers.
- [x] Extend test helpers to compare a complete framebuffer to a literal fixture and report
      the first differing `(x,y)` plus a readable diff.
- [x] Commit: `feat(phone-screen): add reference pixel assets and goldens`

### Task 3 - Reference standby screen

- [x] TDD: rewrite status-icon tests for levels 0-4, unequal widths, six-pixel bar heights,
      two-pixel gaps, bottom icons, and mirrored outer-edge alignment.
- [x] TDD: add exact clock-font placement for `21:51`, carrier y-position, conditional
      notification icons, softkey placement, and full-frame reference equality.
- [x] Replace `drawRungs()` in `packages/phone-screen/src/icons/status.ts` with explicit
      level geometry. Keep levels typed `0 | 1 | 2 | 3 | 4`.
- [x] Replace the antenna/battery art with reference-derived 5x6 sprites and add voicemail
      and SMS sprites. Render notifications in canonical voicemail-then-message order.
- [x] Update `renderStandby()` to use the fixed clock font at top-right, move the carrier,
      and preserve notice takeover behavior without overlapping the side ladders.
- [x] Update phone-core exact-model tests for optional `indicators`; default production
      snapshots omit it.
- [x] Commit: `fix(phone-screen): match the reference standby LCD`

### Task 4 - Reference menu-list pixels

- [x] TDD: add a literal full-frame `Search / Add name / Erase` fixture with the second row
      selected and a middle-position rail bump.
- [x] TDD: pin the rail at x=82, blank replaced rail pixels, seven-pixel bump path, and first,
      middle, and last bump offsets.
- [x] TDD: pin selection bands to x=0..81 and exactly 10 pixels high; assert one-pixel top
      and two-pixel bottom padding around the seven visible glyph rows.
- [x] Replace `drawScrollIndicator()` with `drawPositionRail()` implementing the path above.
      Use it in both list and carousel renderers.
- [x] When `menuIndicator` exists, render three item rows and omit the list title. Preserve
      generic application-list behavior when it is absent.
- [x] Add the `•` glyph and `drawMenuIndicator()`; right-align to x=80 and test active and
      inactive hierarchy strings.
- [x] Ensure labels truncate by measured pixel width before x=82 rather than by a fixed
      character count. Do not let wide glyphs enter the rail.
- [x] Preserve inverted-video rendering: fill the band first, then draw selected glyph ink
      with color 0.
- [x] Commit: `fix(phone-screen): match the reference menu LCD`

### Task 5 - Immediate hierarchical numeric navigation

- [x] TDD in `packages/phone-core/tests/shortcuts.test.ts`: Menu shows no cursor before a
      digit; `5` immediately changes screen/path and yields `[5], awaitingNext`; `3`
      immediately enters the nested screen and yields `[5,3], awaitingNext`.
- [x] TDD: each valid digit restarts the exact 3000ms deadline; timeout removes only the
      cursor and emits a visible snapshot without changing the path.
- [x] TDD: C, Navi, up, down, `0`, `*`, `#`, and power remove the cursor before their normal
      behavior. Long-press behavior remains unchanged.
- [x] TDD: invalid `1`-`9` digits leave screen, path, segments, and deadline unchanged.
- [x] TDD: direct deep navigation and ordinary Navi navigation derive the same segments with
      `awaitingNext=false`; C/back shortens the derived path correctly.
- [x] TDD: subscribers receive every visible indicator transition, including cursor-only
      removal; no dirty-state optimization may suppress these frames.
- [x] Refactor shortcut state to hold accepted entry context plus deadline while active.
      Persistent display segments must derive from canonical nav/application stacks.
- [x] Handle shortcut digits before frame-specific nav handling so deeper levels update
      immediately. Parameterize stack construction so immediate navigation does not clear
      the active shortcut accidentally.
- [x] Remove commit-on-timeout behavior. Navigation already happened; timeout now closes
      numeric entry and marks the model dirty.
- [x] Preserve `pathchange` semantics: every valid digit emits the newly displayed path once.
- [x] Preserve the existing Plan 11 worktree boundary instead of committing mixed core changes.

### Task 6 - Cross-package rendering, router, and accessibility

- [x] Update phone-core characterization and exact `ScreenModel` tests for structured menu
      indicators on carousel, submenu/list, reader, direct-navigation, and app-return stacks.
- [x] Update phone-screen carousel/list/reader tests to consume structured indicators. Do
      not pass preformatted display strings across the package boundary.
- [x] Update `website/src/phone/screen-text.ts` to announce numeric hierarchy and whether
      another digit is expected without literally reading punctuation as visual noise.
- [x] Add website integration coverage for Menu -> 5 -> 3: after each key-up, assert phone
      screen, phone path, browser route, accessible mirror, and trailing-cursor state.
- [x] Verify browser back/forward and C/back restore the correct numeric hierarchy without
      reopening shortcut entry.
- [x] Verify application sessions receive keys normally after shortcut entry closes and do
      not receive digits consumed as valid hierarchy shortcuts.
- [x] Preserve the existing Plan 11 worktree boundary instead of committing mixed website changes.

### Task 7 - Visual gate, documentation, and completion

- [x] Add a package demo/harness mode that displays native 84x48 output at an integer scale
      with `image-rendering: pixelated`, plus optional reference overlay/difference views.
      This is development-only and must not ship photograph processing to production.
- [x] Capture light-on and light-off screenshots for standby, carousel, first/middle/last
      menu positions, selected rows 1-3, `5 • _`, `5 • 3 • _`, and committed `5 • 3`.
- [x] Compare the native framebuffer to both literal goldens pixel-for-pixel before judging
      the perspective-distorted three.js result.
- [x] Run `mise exec -- vp check --fix`.
- [x] Run `mise exec -- vp run -r test`.
- [x] Run `mise exec -- vp run website#build`.
- [x] Clear the completed standby/menu TODOs, set this plan and its README index row to
      `done`, and record any remaining photographic uncertainty explicitly.
- [x] Commit: `docs: complete LCD pixel-authenticity plan`

## Done means

- The reference standby and menu-list fixtures match all 4,032 framebuffer pixels.
- Signal and battery levels 0-4 have exact, tested geometry and bottom icons.
- The clock uses a dedicated fixed 5x6 face at top-right.
- Menu selection is a 10-pixel inverted band with exact padding and a separate rail.
- The position indicator is a one-pixel x=82 line with a seven-pixel x=83 bumpout.
- Every valid shortcut digit immediately updates the displayed screen, phone path, URL,
  accessible description, and structured numeric hierarchy.
- `_` appears only during active numeric entry and disappears on timeout or non-number input.
- `@hellotimber/phone-screen` remains the sole 84x48 raster library; no new runtime package
  or forbidden dependency direction is introduced.
- Full checks, all workspace tests, the website build, and the manual visual gate pass.
