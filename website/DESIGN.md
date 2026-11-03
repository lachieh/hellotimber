---
name: hellotimber
description: A working Nokia 3310, put down on a graffitied school desk in 2001; what you need to use it is lying around it.
colors:
  biro-blue: "#1f2c86"
  red-pen: "#b0171b"
  desk-laminate: "#cb9f63"
  laminate-light: "#d4a96b"
  laminate-deep: "#c0915a"
  sticky-yellow: "#f6e36c"
  sticky-light: "#f9e978"
  pad-edge: "#e8d45a"
  pencil-graphite: "#3a3631"
  graffiti-graphite: "#4b4640"
  graffiti-biro: "#22308c"
  graffiti-red: "#a51e1c"
  graffiti-marker: "#1c1a17"
  carved-cream: "#fff4de"
  nylon-navy: "#2a3a70"
  correction-fluid: "#f4f1e6"
  marker-yellow: "#ffe75a"
  masking-tape: "#f0e5c2"
  comic-ink: "#16130f"
  lcd-ink: "#1f2d22"
  window-cream: "#ffecc8"
  shadow-umber: "#2d1404"
typography:
  headline:
    fontFamily: "D01 Kalam, Comic Sans MS, cursive"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.25
  hint:
    fontFamily: "D01 Kalam, Comic Sans MS, cursive"
    fontSize: "1.45rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "D01 Kalam, Comic Sans MS, cursive"
    fontSize: "1.2rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "D01 Kalam, Comic Sans MS, cursive"
    fontSize: "1.04rem"
    fontWeight: 400
    lineHeight: 1.35
  scrawl:
    fontFamily: "D01 Reenie, D01 Kalam, cursive"
    fontSize: "1.6rem"
    fontWeight: 400
    lineHeight: 1
rounded:
  pad: "2px"
  sheet-curl: "1px 1px 2px 14px / 1px 1px 2px 6px"
  nylon: "30px 34px 28px 32px / 30px 28px 34px 30px"
  tick: "6px"
spacing:
  hair: "4px"
  tight: "6px"
  sheet: "22px"
  gap: "32px"
  edge: "24px"
components:
  sticky-pad:
    backgroundColor: "{colors.pad-edge}"
    rounded: "{rounded.pad}"
    width: "280px"
  sticky-sheet:
    backgroundColor: "{colors.sticky-yellow}"
    textColor: "{colors.red-pen}"
    typography: "{typography.hint}"
    rounded: "{rounded.sheet-curl}"
    padding: "34px 22px 22px"
  mute-tick:
    textColor: "{colors.biro-blue}"
    typography: "{typography.body}"
    rounded: "{rounded.tick}"
    padding: "4px 6px"
  pencil-case:
    backgroundColor: "{colors.nylon-navy}"
    textColor: "{colors.correction-fluid}"
    rounded: "{rounded.nylon}"
    padding: "40px 24px 24px"
    width: "320px"
  pencil-case-link-hover:
    textColor: "{colors.marker-yellow}"
---

# Design System: hellotimber

## Overview

**Creative North Star: "Left on the desk, 2001"**

The page is not a page. It is a school desk: one sheet of pale, honey-coloured laminate, worn paler where arms rest along its front, scratched and written over by years of kids, lit by one window at the top left. A working Nokia 3310 has just been put down in the middle of it, at the size of the real handset. Only two things lie beside it: a full pad of sticky notes at its bottom right that says what to press next, and a navy nylon pencil case at its bottom left that says whose desk this is. A biro pokes out from under the case.

The graffiti is the desk's history, not information: faded older names and dates under newer pencil, biro, red pen, permanent marker and compass-point carvings, hearts, tallies and scribbled-out patches. It stays texture, always quieter than the objects on top of it, with one exception: the freshest biro on the desk, pressed hard, gives the phone's own number for Lachlan.

The phone arrives as a comic drawing. The server renders the handset in flat comic ink with "Loading…" and a segmented bar on its LCD; when three.js and the model are ready, a bright edge sweeps down the drawing, turning it into the real phone, which pitches up and leaps out of the desk as the edge passes, then drops back to hover. On a device with a tilt sensor, tilting it moves the window's light across the phone; the phone itself stays put.

**Key Characteristics:**

- One light source: a window at the top left; every shadow falls down and to the right.
- Handwriting is the UI type. Nothing is set in a neutral web sans.
- Objects sit a few degrees off square, never aligned to the viewport.
- The phone is dead centre, at most its real 113 mm, and nothing covers it.
- Every object that carries information is a real control or real text; decoration is `aria-hidden`.

## Colors

A pale laminate ground with paper, ink and nylon colours a 2001 kid's desk would plausibly hold; the hues come from the objects and the pens, not from a brand palette.

### Primary

- **Biro Blue** (`biro-blue`): the default ink. The mute tick-box and its label, the desk's focus ring (dashed), and the one readable line of graffiti.

### Secondary

- **Red Pen** (`red-pen`): the live hint on the sticky pad, its scribbled arrow, and the tick in the mute box. The pen for "look here now", never decoration.

### Neutral

- **Desk Laminate** (`desk-laminate`), with **Laminate Light** (`laminate-light`) at the top and **Laminate Deep** (`laminate-deep`) at the front: the ground, a vertical gradient with a faint paler wash where arms rest, under multiplied fine fractal grain.
- **Sticky Yellow** (`sticky-yellow`, lighter at `sticky-light`): each sheet of the pad. **Pad Edge** (`pad-edge`): the pad's body, its stacked sheet edges stepping down and to the right in alternating darker and lighter yellows.
- **Nylon Navy** (`nylon-navy`): the pencil case, a radial from a lighter navy at the top left to near-black blue at the far edge, with a ripstop grid and fibre noise.
- **Correction Fluid** (`correction-fluid`): all writing on the pencil case except the name. **Masking Tape** (`masking-tape`): the strip the name is written on in black marker.
- **Comic Ink** (`comic-ink`) and **LCD Ink** (`lcd-ink`): the loading drawing's outlines and the dark pixels of its green LCD.
- **Window Cream** (`window-cream`): the window's warm light from the top left, at 0.38 alpha fading out. **Shadow Umber** (`shadow-umber`): every cast shadow, 0.3 to 0.45 alpha; shadows are warm brown, never grey.

### Graffiti inks

Each mark's ink follows what it was made with; all sit at reduced opacity so the graffiti reads as old, cleaned-at writing.

- **Graffiti Graphite** (`graffiti-graphite`): pencil at 0.5, and the faded "ghost" layer of older writing at 0.2.
- **Graffiti Biro** (`graffiti-biro`, 0.62), **Graffiti Red** (`graffiti-red`, 0.6): pen.
- **Graffiti Marker** (`graffiti-marker`, 0.5, faintly blurred into the grain): permanent marker.
- **Carved Cream** (`carved-cream` at 0.75, dark groove shadow up-left): scratched in with a compass point.
- **Marker Yellow** (`marker-yellow`): hover and focus on the pencil case's links, where biro would vanish on navy.

### Named Rules

**The Right Pen Rule.** Ink follows the object and the act: biro writes, red pen points at the live state, correction fluid belongs to the pencil case, marker is for names on tape. A new mark picks its pen from what a kid would have used.

**The Quiet History Rule.** Graffiti never outweighs the desk's objects. Its heaviest marks (marker) stay at or below 0.5 opacity and under 2rem; only the way-in line is written fresh, at 0.9.

**The Window Rule.** There is exactly one light, from the top left. Device tilt moves that light across the phone; nothing is lit from anywhere else.

## Typography

**Hand Font:** Kalam (self-hosted as "D01 Kalam", 400 and 700, with Comic Sans MS and cursive as fallback)
**Scrawl Font:** Reenie Beanie (self-hosted as "D01 Reenie", falling back to Kalam)

**Character:** a neat teenage biro hand for everything a person wrote, and a fast scrawl for asides and the quicker graffiti. Fonts live in `public/desk/fonts/` and are all `font-display: swap`. The loading drawing's LCD uses a monospace in LCD ink, as the phone's own screen would.

### Hierarchy

- **Headline** (Kalam 700, 1.75rem, 1.25; 1.5rem on narrower desktops): the name in black marker on the pencil case's masking tape, on one line.
- **Hint** (Kalam 700, 1.45rem, 1.2): the sticky pad's "now: …", in red pen.
- **Title** (Kalam 700, 1.2rem): the pencil case's job line.
- **Body** (Kalam 400, 1.04rem): the pencil case's tagline and links, the mute label. Body on objects never drops below 0.92rem.
- **Scrawl** (Reenie Beanie, 1.6rem, 1): "more on the desk" on mobile, and quick graffiti.

### Named Rules

**The Who Wrote It Rule.** Every line of visible text was written by hand, in Kalam or Reenie, or shown on the phone's own LCD.

## Layout

On wide screens the desk is a full-viewport, non-scrolling grid of `left | phone | right`, the phone column `minmax(360px, 40vw)` (`minmax(320px, 34vw)` from 900 to 1180px wide). The phone's stage is `min(88vh, real size)` tall, where real size is 113 mm at the CSS pixels in an inch for the kind of screen (110 on desktop, 120 at high density, 132 on tablets, 160 on phones; browsers don't report physical size). The phone's canvas overscans its stage 1.6× each way, centred, so the leap out of the desk is never cut off, and the phone is framed smaller to keep its size.

The pad and the pencil case sit beside the phone, low on the desk: each `32px` clear of the handset when the screen has room for it. With less room each slides in, its outer edge kept `24px` inside the screen, and sinks out of the way, at the least its top peeking up just below the phone's bottom edge; neither ever covers the phone.

- **899px and below:** the desk scrolls. The phone stage takes `min(74svh, real size)` so the top of the pad, with its hint, shows on the first screen; "more on the desk" points down; the pad and the case follow in a single centred column at `min(330px, 100vw - 48px)`, slightly rotated. The biro and wide-only graffiti are removed.
- **900px+ wide and 760px or less tall:** the pad scales to 0.85.

## Elevation & Depth

Depth is physical: every object lies on the desk and casts a warm, two-part shadow down and to the right, a tight contact shadow plus a soft far one. The phone's shadow follows the phone: a tight contact shadow while it is drawn flat in the desk, stretching and softening as it leaps, settling to a hover shadow at rest.

### Shadow Vocabulary

- **Desk contact** (`box-shadow: 1px 2px 2px rgb(45 20 4 / 0.32), 8px 14px 22px rgb(45 20 4 / 0.38)`): any object on the desk.
- **Pad stack** (eight 1px steps down and to the right in alternating pad yellows, then desk contact and `12px 18px 18px -6px rgb(45 20 4 / 0.45)`): the full pad's sheet edges.
- **Pencil case bulk** (contact plus `10px 18px 26px rgb(45 20 4 / 0.42)`, with insets for the puffed nylon): a soft, stuffed object.
- **Phone contact** (a blurred pill of `rgb(24 8 0 / 0.78)`, from 3px blur at 6px/8px offset flat, to 16px blur at 42px/50px at rest, to 30px blur at its highest leap).

### Named Rules

**The Down-Right Rule.** Every shadow offset is positive on both axes.

**The Lying Flat Rule.** Nothing floats except the phone in its entrance. No hover lift, no glow.

## Shapes

Nothing is a clean rectangle unless the real object was. The pad is square (`2px` corners) with sheets that curl at the bottom left (`sheet-curl`) and a gum strip across their tops; masking tape has a torn clip-path; the nylon case is a puffy, uneven rounded rectangle (`nylon`) with a stitched seam. Drawn things are drawn: the mute box is a wobbly biro square ticked in red pen, the hint's arrow is a scribbled stroke, the graffiti's hearts, stars, tallies and cube are hand-stroked SVG with round caps.

## Components

### Sticky Pad (live hint)

What to press next, in the phone's own terms.

- **Shape:** a full square pad (280px; 240px on narrower desktops) of stacked sheets, rotated 4deg (-2deg on mobile).
- **Content:** only the live hint, "now: …" in red pen after a scribbled red arrow. Wording follows the input: keyboard visitors read "press Menu (Enter)", touch visitors read "tap Menu, the big middle key"; entry screens say to type.
- **Behaviour:** when the hint changes, the top sheet peels off from its bottom edge, curls toward the viewer and flies away up and to the right (720ms), and the new hint is written on the blank sheet beneath with a left-to-right ink wipe (760ms after 380ms). Under reduced motion the sheet simply changes.
- **Accessibility:** one stable, visually hidden live element announces "now: …"; the sheets themselves are hidden from assistive tech.

### Mute Tick-box (switch)

Sound off, drawn in the pad's bottom left corner.

- **Style:** a 24px wobbly biro square and "shh, no sound" in biro; a faint white wash in the box rising on hover; ticked in red pen when sound is off.
- **Behaviour:** a real `role="switch"` button labelled "Sound off", bound to the site's mute setting (persisted). It stays as sheets peel.
- **Focus:** the desk's dashed biro ring.

### Pencil Case (contact)

Whose desk this is.

- **Shape and fill:** `nylon` corners, nylon navy with ripstop grid and fibre noise, zip across the top, 40px 24px 24px padding.
- **Name:** black marker on a torn masking-tape strip, rotated 1.5deg, on one line.
- **Everything else:** correction fluid, run through a chalky displacement filter.
- **Links:** correction fluid with a 2px underline; hover and focus turn marker yellow, the focus ring dashed marker yellow.

### Loading Drawing (signature)

The phone, drawn flat in comic ink until the real one is ready.

- **Drawing:** traced from the 3D model's front view, flat comic fills with Ben-Day dot shading and a bold outer contour, framed exactly where the 3D phone lies flat.
- **LCD:** "Loading…" with blinking dots and a ten-segment bar filling as the page, three.js, the firmware and the model arrive. If the 3D phone can't load, the LCD reads "Can't switch on. Reload to try again" and the desk stays usable.
- **Reveal:** a bright edge trailing dissolving print dots sweeps top to bottom (650ms) while the phone pitches up and leaps out of the desk (1.6s), then settles.

### Graffiti

Decoration only, under the window's light and every object.

- **Marks:** text or hand-drawn doodles placed by percentage across the desk, each in its ink at a small rotation. Marks that need room are dropped on mobile.

## Do's and Don'ts

### Do:

- **Do** put new information on a plausible 2001 desk object, in the pen that object would be written with.
- **Do** keep the phone dead centre, at most its real size, uncovered, with the pad and case clear of it when there is room.
- **Do** cast every shadow down and to the right in shadow umber.
- **Do** make every object that carries information a real control or real text, and mark decoration `aria-hidden`.
- **Do** name the visitor's own keys: keyboard keys for keyboards, the phone's keys for touch.
- **Do** animate writing as writing: a left-to-right ink wipe on `cubic-bezier(0.16, 1, 0.3, 1)`, removed under `prefers-reduced-motion`.

### Don't:

- **Don't** add a header, footer, nav bar or any web chrome around the phone.
- **Don't** put a key legend or instructions on the desk; the pad shows only what to press next.
- **Don't** let graffiti outweigh the desk's objects (The Quiet History Rule).
- **Don't** light anything from a second direction, or add hover lift, glows or floating shadows.
- **Don't** reuse the legacy sea/lagoon tokens in `src/styles.css` (`--surface`, `--line`, …); they belong to the original site template.
