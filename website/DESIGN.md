---
name: hellotimber
description: A working Nokia 3310 shown as the exhibit in a 1960s Braun product catalogue; every page around it is set like the catalogue's spec sheets.
colors:
  paper: "#f4f3f0"
  ink: "#191816"
  ink-2: "#565552"
  hairline: "#cbcac7"
  signal: "#dd530f"
  lcd-tint: "#c7f0d8"
typography:
  display:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(2.5rem, 1.75rem + 2vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
  standfirst:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.4
  reading:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  entry-title:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.35
  caption:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
  code:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
  not-found-title:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.1
rounded:
  none: "0"
  keycap: "3px"
  button: "2px"
spacing:
  hair: "4px"
  tight: "8px"
  row: "12px"
  block: "16px"
  group: "24px"
  section: "48px"
  margin: "clamp(1.5rem, 3vw, 3rem)"
  gutter: "clamp(1.5rem, 3.5vw, 4rem)"
components:
  index-link:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "7px 0"
  spec-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "8px 0 9px"
  keycap:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.keycap}"
    padding: "0 0.35em"
  strip-toggle:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "8px 14px"
---

# Design System: hellotimber

## Overview

**Creative North Star: "The 3310 in the Braun catalogue"**

The site is a product catalogue of the kind Braun printed in the 1960s and 70s, with one product in it: a working Nokia 3310. Off-white paper, near-black type, a precise grid ruled with hairlines, the product photographed on the page as the exhibit, and spec-sheet captions in tabular figures. One functional colour, signal orange, is used the way Braun used its power marks: rarely, and only to say "here" or "on".

The phone arrives as a technical drawing, its front elevation with dimension lines (113 mm by 48 mm), and a fine rule sweeps down the figure turning it into the 3D phone, which pitches up off the page and settles. That reveal is the page's one authored moment. Everything else is quick and quiet.

The catalogue is refined, not skeuomorphic: no paper texture, no props, no imitation objects. It reads in daylight, so it is light only.

**Key Characteristics:**

- The phone is the exhibit, at about its real size, and nothing covers it.
- One typeface, Archivo, in three weights; numbers in tabular figures wherever they're data.
- Hairline rules organise everything: a full ink rule opens each table, list and index; grey hairlines separate rows.
- The signal orange appears in exactly two places: where the phone is (in the index, or in a post's menu diagram), and the sound lamp when sound is on (plus the focus ring, caret and `accent-color`).
- Section numbers are the phone's own menu numbers, the figure its LCD shows in the corner.

## Colors

Paper and ink, a grey for secondary text, a grey for hairlines, and one signal. Defined in OKLCH in `src/styles.css`; hex here is the sRGB equivalent.

### Primary

- **Ink** (`ink`, `oklch(21% 0.004 95)`): all type, the opening rule of every table and list, the running head's rule, keycap borders, the drawing's lines. 16:1 on paper.

### Secondary

- **Signal** (`signal`, `oklch(62% 0.185 41)`): the square hung in the index's margin beside the section the phone is on (and, in a post's StateMachine figure, beside the state the phone is on); the sound lamp when sound is on; focus rings; the caret; `accent-color`. Never type, never a fill larger than 8px. 3.6:1 on paper.

### Neutral

- **Paper** (`paper`, `oklch(96.4% 0.004 95)`): the ground of every page, the drawing's ground, the selection's text.
- **Ink 2** (`ink-2`, `oklch(45% 0.005 95)`): spec labels, captions, dates, the section number before a heading, the running head's second line. 6.7:1 on paper.
- **Hairline** (`hairline`, `oklch(84% 0.005 95)`): row rules in tables, the index and lists; the caption's rule; the scrollbar thumb. Decorative only (1.5:1); nothing reads by it alone.
- **LCD tint** (`lcd-tint`): the drawing's LCD pane at 55% over paper, the one colour in the figure.

### Named Rules

**The Power Mark Rule.** The signal colour marks state ("the phone is here", "sound is on", "focus is here"), never decoration, never text, never a region. If a second thing wants it, it doesn't get it.

**The Paper Rule.** No gradients, textures, glass or tinted panels. Ground is paper; structure is rules and space.

## Typography

**Face:** Archivo (Omnibus-Type, SIL Open Font License 1.1), a grotesque in the late-nineteenth-century lineage Akzidenz-Grotesk comes from. Self-hosted variable woff2 (weights 400–700) in `public/fonts/` in latin and latin-ext subsets, `font-display: swap`, the latin file preloaded. Fallbacks: Helvetica Neue, Arial. The licence is `public/fonts/Archivo-OFL.txt`.

**Character:** firm and slightly narrow, with real ink at small sizes, so 13px spec labels and captions hold up. `tnum` is on for every spec value, date and number.

### Hierarchy

- **Display** (600, `clamp(2.5rem, 1.75rem + 2vw, 3.5rem)`, line-height 1, tracking -0.03em): the spread's or page's heading, the section's menu number before it in Ink 2 at 400.
- **Standfirst** (400, 1.25rem, 1.4): the one-line summary under the heading.
- **Reading** (400, 1.0625rem, 1.6, max 68ch): a section page's body.
- **Body** (400–500, 1rem, 1.5): spec values, index links, the spread's text.
- **Entry title** (600, 1.0625rem): a job, project or post on a page.
- **Label** (600, 0.8125rem): "Contents", the running head's name, the sound switch, keycaps.
- **Caption** (400, 0.8125rem, Ink 2): spec labels, figure captions, dates.

Weights step 400 → 500 (index links) → 600 (headings, labels) → 650 (the current page in the index). Headings use `text-wrap: balance`, prose `pretty`.

### Named Rules

**The One Face Rule.** Archivo for everything on the catalogue, including the drawing's lettering (the SVG inherits the page's font). No monospace costume, no second family. The one exception is code in a post (code blocks and inline code), set in the system's monospace (`ui-monospace`, no web font) because code's alignment depends on it.

## Layout

A three-column grid under a running head: **index** (11rem) | **exhibit** (the phone's stage, as wide as the phone) | **main** (the rest). Page margin `clamp(1.5rem, 3vw, 3rem)`, gutter `clamp(1.5rem, 3.5vw, 4rem)`. The running head is a subgrid, so the name sits over the index and the job line over the exhibit, closed by an ink rule.

**The top line.** The index's opening rule, the phone's top edge and the heading's capitals all sit on one line: the index's "Contents" label hangs above it, the stage is lifted by the 6.5% of it above the handset, and the heading's line box by 0.12em.

**The phone's size.** The stage is `min(100svh − 10rem, real size)`, where real size is 113 mm at the CSS pixels in an inch for the kind of screen (110 on desktop, 120 at high density, 132 on tablets, 160 on phones) and the handset spans 0.87 of it. The canvas overscans the stage 1.6× each way so the lift is never cut off.

**Views** (`.cat[data-view]`, derived from the route and the phone, `home/view.ts`):

- **spread** (`/`): index | phone at real size | the spread (max 32rem).
- **docked** (`/about`, `/work`, `/writing`, `/now`, `/contact`): the stage at 0.62, sticky, with the page beside it (max 42rem; body 68ch).
- **centred** (`/chat`, `/snake`): from 1280px wide, index | space | phone | key guide, so the phone sits in the middle at real size; narrower, the spread's columns.

**Narrow screens (899px and below):** one column: the running head, the index as two wrapped lines of numbered links, the phone, the spread or page, the colophon. On a section page the phone docks as a **strip**: a 9rem-tall phone beside its caption and a "Use the phone" button, between hairlines. A tap on the phone or the button opens it to full size (`data-phone="open"`, keyed to the route, so leaving the page closes it); "Smaller" docks it again. The strip's phone is too small to press, so it takes taps only to open.

Spacing steps: 4, 8, 12, 16, 24, 48px, with the page margin and gutter fluid. More space above a group than inside it.

## Elevation & Depth

Flat paper, one shadow: the phone's, a soft blurred handset shape in `oklch(21% 0.004 95 / 0.28)` like a product photographed on a sheet. It is absent while the phone is a drawing and grows as it forms and lifts (PhoneSlot sets `--phone-rest` and `--phone-leap`). Nothing else casts a shadow, lifts on hover or glows.

## Shapes

Rectangles and rules. Corners are square except keycaps (3px) and the strip's button (2px). The sound lamp is a round 8px lamp, ringed in ink when off and filled signal when on.

## Components

### Running head

The name (Label, links home) over the index column and "Software Engineer, Atlanta" (Ink 2) over the rest, closed by a 1px ink rule. On narrow screens they sit at either end of one line.

### Index (contents)

`nav` labelled "Contents": an ordered list of every section, always present, rendered on the server, plain links in tab order. Each row: the menu number (tabular, Ink 2) in a 1.75rem column, the label (500), a hairline under it; an ink rule opens the list. The current route is `aria-current="page"` and 650. The section the phone is on (its carousel highlight, or the page it's at) gets a 7px signal square hung 1rem into the margin.

### Exhibit and figure caption

The phone's stage, then a caption under a hairline, as wide as the stage: on `/`, `/chat` and `/snake`, "**Fig. 1** Nokia 3310, front. 113 × 48 × 22 mm, 133 g. Shown at about actual size."; beside a page, "The phone at About. [C] goes back to the menu."

### Spread

The highlighted section's menu number and name (Display), its summary (Standfirst), its spec sheet, and "**Open Work**, or Select (Enter) on the phone." At standby it is the introduction: the name, the tagline and the phone's spec sheet. It changes as the carousel moves.

### Spec sheet

`dl`: an ink rule, then rows of label (Caption, Ink 2, 6–10rem column) and value (Body, tabular), each closed by a hairline. Used for specs, Contact's links and the key guide.

### Section page

Heading and standfirst, then the reading column: paragraphs; lists as hairline-ruled rows; entries (Work, Writing) as rows with the title and its date (tabular, Ink 2, right-aligned) above the body, with the link inline at its end.

### Key guide

Chat and Snake: heading, standfirst, a spec sheet whose labels are keycaps (`kbd`: 1px ink border, 3px corners, Label), then the section's specs.

### Colophon

Under a hairline: the **sound switch** (`role="switch"`, labelled "Sound", the lamp and "On"/"Off"; persisted), then the emulator and source links.

### Reading layout (posts)

`/writing/<slug>` (`src/writing/PostPage.tsx`, `writing.css`): the running head, then two columns: the **index column** (11rem, sticky) holds "← Back to the phone" and the post's details as a spec sheet (Published and Updated as `<time>`, Reading in minutes, In: Writing); the **main column** holds the title (Display), the summary (Standfirst) and the body. No phone docks here (D10). The body is one 68ch measure at the Reading size: paragraphs, square-bulleted lists, `h2`s opened by an ink rule (1.5rem, 600), and code blocks between an ink rule and a hairline on paper, highlighted at build time by Shiki in ink and Ink 2 only (bold keywords and names, italic comments; `code-theme.ts`). Narrow screens: one column, the details as a wrapped line above the title.

### Figures (posts)

A figure takes the measure: an ink rule, the exhibit, then the caption under a hairline, "**Fig. n**" numbered down the post by a CSS counter. The frame, caption, keys and controls follow the catalogue (keycaps 1px ink, 3px corners, Label size; pressed keys fill ink); the subject keeps its own look: the LCD in the 3310's green-grey (`#c7f0d8`, pixels `#43523d`) in a dark surround, at native 84×48 scaled with `image-rendering: pixelated`. The StateMachine's tree is drawn like the index (menu numbers in tabular Ink 2, hairline rails); the state the phone is on gets the signal square, the screens above it go ink. Phone figures and the 3D phone load as they near the screen; before that (and on the server) the LCD is a blank pane and the reveal is the drawing.

### Technical drawing (the reveal's first frame)

`@hellotimber/phone-3d/sketch`: the 3310's front elevation traced from the model. A 1.5px contour, 0.8px detail lines, 0.6px shading lines down the right side (away from the light) and dimension lines, all fixed in screen pixels at any scale (`vector-effect: non-scaling-stroke`); filled arrowheads; the height (113) and width (48) set in the page's font on paper knock-outs; key legends in Archivo. Its LCD shows "Loading…" over a ten-segment bar as the page, three.js, the firmware and the model arrive, or "Can't switch on. Reload to try again" when WebGL or the model fails, and the page works around it. The emulator draws it light on its dark stage (`ink`/`paper` props).

### Spec callouts (off)

`Nokia3310Callouts` draws leader lines from the formed phone's display, Navi key, C key and keypad to labels beside it. `SPEC_CALLOUTS` in `routes/_home.tsx` is **false**: in the browser the labels run into the spread and the key guide and repeat what the caption and the drawing's dimensions already say.

## Motion

- **The reveal** (the one authored moment): the drawing's rule sweeps top to bottom over 650ms (ease-in-out) while the 3D phone pitches up and leaps off the page from 100ms (`formPose`, 1.6s), then settles. Under reduced motion it jumps to the formed phone.
- **The spread turning**: 260ms on `cubic-bezier(0.16, 1, 0.3, 1)`, from 15% opacity and 6px down. Reduced motion: a 150ms fade.
- **Docking**: the stage's size eases over 320ms on the same curve. Reduced motion: none.
- **Small states**: link underlines and the sound lamp, 150ms; a figure's key filling as it's pressed, 100ms.
- Tilting a device moves the light across the phone; the phone stays put.

## Browser surfaces

Selection is paper on ink. Focus is a 2px signal outline 3px off the element. The caret and `accent-color` are signal. Scrollbars are a hairline thumb on paper. Links carry a 1px underline at 35% ink, 0.22em below, going full ink on hover. `color-scheme: light`.

## Do's and Don'ts

### Do:

- **Do** keep the phone the exhibit: at most its real size, uncovered, top-aligned with the index and the heading.
- **Do** set every new piece of information as a spec row, a caption or a ruled list before reaching for anything else.
- **Do** use tabular figures for numbers that are data, and the phone's menu numbers for sections.
- **Do** name the visitor's keys in the phone's terms first, the keyboard's in brackets: "Select (Enter)".
- **Do** keep the index plain links, server-rendered and first in tab order after the running head.

### Don't:

- **Don't** add a second accent, a second typeface, gradients, textures, glass, cards or rounded panels.
- **Don't** put a kicker or eyebrow above a heading; the section number sits beside it, in the heading.
- **Don't** animate anything else on load; the reveal is the moment.
- **Don't** turn the spec callouts on without checking they no longer meet the spread.
- **Don't** reuse the desk's or the template's old tokens (biro, laminate, sea/lagoon); they are gone.
