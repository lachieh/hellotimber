---
name: hellotimber
description: A working Nokia 3310, put down on a teenager's desk in 2001; everything you need to use it is lying around it.
colors:
  biro-blue: "#1f2c86"
  red-pen: "#b0171b"
  score-red: "#8e1418"
  highlighter-green: "#136b3b"
  desk-wood: "#84522c"
  sticky-yellow: "#f6e36c"
  notebook-paper: "#fbf9f1"
  feint-rule: "#a9c3e0"
  margin-red: "#e88b8b"
  pencil-graphite: "#3a3631"
  nylon-navy: "#2a3a70"
  correction-fluid: "#f4f1e6"
  marker-yellow: "#ffe75a"
  brushed-aluminium: "#cdd2d8"
  silk-ink: "#262d33"
  switch-orange: "#f37c22"
  switch-slot: "#15191d"
  voucher-blue: "#0a5aa8"
  voucher-cyan: "#3dbbe9"
  window-cream: "#fff3dc"
  shadow-umber: "#2d1404"
typography:
  display:
    fontFamily: "D01 Kalam, Comic Sans MS, cursive"
    fontSize: "1.55rem"
    fontWeight: 700
    lineHeight: 1.1
  headline:
    fontFamily: "D01 Kalam, Comic Sans MS, cursive"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "D01 Kalam, Comic Sans MS, cursive"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: "28px"
  body:
    fontFamily: "D01 Kalam, Comic Sans MS, cursive"
    fontSize: "1.04rem"
    fontWeight: 400
    lineHeight: "28px"
  scrawl:
    fontFamily: "D01 Reenie, D01 Kalam, cursive"
    fontSize: "1.6rem"
    fontWeight: 400
    lineHeight: 1
  label:
    fontFamily: "D01 Michroma, Eurostile, sans-serif"
    fontSize: "max(11px, 3.6cqw)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.1em"
  brand-word:
    fontFamily: "D01 Lilita, D01 Michroma, sans-serif"
    fontSize: "2rem"
    fontWeight: 400
    lineHeight: 1
rounded:
  slot: "2px"
  card: "10px"
  drawn-key: "14px 11px 13px 10px / 11px 14px 10px 13px"
  drawn-pad-key: "9px 7px 9px 6px"
  drawn-ring: "48% 52% 44% 56% / 60% 46% 54% 40%"
  sticky-curl: "1px 1px 2px 18px / 1px 1px 2px 8px"
  nylon: "30px 34px 28px 32px / 30px 28px 34px 30px"
spacing:
  hair: "4px"
  tight: "6px"
  line: "10px"
  gap: "12px"
  pad: "22px"
  scatter: "36px"
  ruled-line: "28px"
components:
  drawn-key:
    backgroundColor: "rgb(255 255 255 / 0.18)"
    textColor: "{colors.biro-blue}"
    typography: "{typography.title}"
    rounded: "{rounded.drawn-key}"
    padding: "0 7px"
    height: "32px"
  drawn-key-hover:
    backgroundColor: "rgb(255 255 255 / 0.55)"
  drawn-key-active:
    backgroundColor: "rgb(31 44 134 / 0.16)"
  drawn-pad-key:
    rounded: "{rounded.drawn-pad-key}"
    size: "26px"
  sticky-note:
    backgroundColor: "{colors.sticky-yellow}"
    textColor: "{colors.biro-blue}"
    rounded: "{rounded.sticky-curl}"
    padding: "22px 22px 18px"
    width: "300px"
  notebook-strip:
    backgroundColor: "{colors.notebook-paper}"
    textColor: "{colors.pencil-graphite}"
    typography: "{typography.body}"
    padding: "14px 20px 26px 46px"
    width: "330px"
  slide-switch:
    backgroundColor: "{colors.switch-slot}"
    textColor: "{colors.silk-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.slot}"
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

The page is not a page. It is a warm wooden desk top lit by one window at the top left, and the 3D Nokia 3310 has just been put down in the middle of it. Everything a visitor needs to use the phone is an object lying around it: a yellow sticky note with the controls, a torn notebook strip that copies the LCD out by hand, a brushed-aluminium Walkman whose orange slide switches are the phone's Sound and Lights, and a navy nylon pencil case that says whose desk this is. Period clutter (a txt spk cheat sheet, a prepaid top-up card, a biro) fills the edges without carrying anything essential.

Every object is a real material with a real light source. Paper has rules, margins, punched holes and torn edges; the sticky note curls off the desk; nylon has a weave and a stitched seam; the Walkman has a slot cut into its metal. Writing is done with the tool that object would have been written on with: biro on the sticky note and notebook, red pen for corrections and the live hint, black marker on masking tape, correction pen on the pencil case, Reenie Beanie scrawl for the asides. No web chrome, no header, no footer, no cards-on-a-grid.

The phone is the biggest thing on the desk and stays dead centre. The objects are information that happens to look like stuff, and every one that carries information is a real control or real text, never a picture of one.

**Key Characteristics:**

- One light source: a window at the top left; every shadow falls down and to the right.
- Handwriting is the UI type; printed type appears only where a 2001 object would carry print (Walkman silk-screen, top-up voucher).
- Objects sit at small rotations (between -13deg and 11deg), never square to the viewport.
- Information objects are live: the notebook re-copies the LCD and the sticky note's "now:" line follows the phone.
- The phone is never covered, never framed, never competed with.

## Colors

A warm wood ground under paper, ink and plastic colours that a 2001 teenager's desk would plausibly hold; the hues come from the objects, not from a brand palette.

### Primary

- **Biro Blue** (`biro-blue`): the default ink of the whole desk. Sticky-note text, drawn keys, the notebook's copied LCD, strip titles, the masking-tape-free handwriting, and the dashed focus ring. If it is written on paper and it matters, it is in biro.

### Secondary

- **Red Pen** (`red-pen`): corrections and the live hint only. The sticky note's "now:" line and the struck-through previous hint. Never used for decoration.
- **Score Red** (`score-red`): the deeper red of the notebook's "play snake!!" / "snake hi N!!" scrawl.

### Tertiary

- **Highlighter Green** (`highlighter-green`): the txt spk cheat sheet's title and abbreviations; a second pen, kept to that one card.
- **Marker Yellow** (`marker-yellow`): hover and focus colour for links on the dark pencil case, where biro would vanish.
- **Switch Orange** (`switch-orange`, ribbed with a darker `#c95708` stripe): the Walkman's slide knobs. The only saturated warm accent that is a control.

### Neutral

- **Desk Wood** (`desk-wood`): the ground. Applied as a vertical gradient (`#8e5a31` to wood to `#7a4826`) with multiplied fractal grain and two faint plank seams.
- **Sticky Yellow** (`sticky-yellow`): the sticky note, with a lighter top (`#f9e978`) and darker foot (`#ecd75c`).
- **Notebook Paper** (`notebook-paper`) with **Feint Rule** (`feint-rule`, every 28px) and **Margin Red** (`margin-red`, a 1.5px line at 34px): the notebook strip. The txt card uses a whiter paper (`#fefefe`) with a 24px rule (`#cfe0ee`).
- **Pencil Graphite** (`pencil-graphite`): secondary writing on paper (notebook row text, txt card definitions).
- **Nylon Navy** (`nylon-navy`): the pencil case, a radial from `#3e5290` at the top left to `#141c40` at the far edge, with a light ripstop grid and fibre noise.
- **Correction Fluid** (`correction-fluid`): all writing on the pencil case except the name.
- **Brushed Aluminium** (`brushed-aluminium`), **Silk Ink** (`silk-ink`), **Switch Slot** (`switch-slot`): the Walkman casing, its printed legends, and the cut slot its switches ride in.
- **Voucher Blue** (`voucher-blue`) and **Voucher Cyan** (`voucher-cyan`): the top-up card's printed plastic only.
- **Window Cream** (`window-cream`): the "more on the desk" scrawl written straight onto the wood on mobile.
- **Shadow Umber** (`shadow-umber`): the colour of every cast shadow, at 0.3 to 0.42 alpha. Shadows are warm brown, never grey or black-on-white.

### Named Rules

**The Right Pen Rule.** Ink colour follows the object and the act: biro writes, red pen corrects or points at the live state, green belongs to the txt card, correction fluid belongs to the pencil case. A new note picks its pen from what a teenager would have used, not from a role table.

**The Window Rule.** There is exactly one light: warm cream from the top left (`rgb(255 236 200 / 0.38)`), umber dark toward the bottom right, plus the soft shadow of the window frame across the desk. Nothing is lit from anywhere else.

## Typography

**Display / Body Font:** Kalam (self-hosted as "D01 Kalam", 400 and 700, with Comic Sans MS and cursive as fallback)
**Scrawl Font:** Reenie Beanie (self-hosted as "D01 Reenie", falling back to Kalam)
**Label Font:** Michroma (self-hosted as "D01 Michroma", with Eurostile fallback), for Walkman silk-screen and top-up print
**Brand-word Font:** Lilita One (self-hosted as "D01 Lilita"), for the top-up card's printed "top-up" only

**Character:** a neat teenage biro hand for everything a person wrote, a fast scrawl for the asides, and wide techno-grotesque print only where a 2001 manufacturer printed onto plastic or metal. Fonts live in `public/desk/fonts/` and are all `font-display: swap`.

### Hierarchy

- **Display** (Kalam 700, 1.55rem, 1.1): an object's handwritten heading ("how to work it"), underlined with a drawn squiggle.
- **Headline** (Kalam 700, 1.75rem, 1.25): the name in black marker on the pencil case's masking tape (`#151515`).
- **Title** (Kalam 700, 1.15 to 1.2rem): the notebook strip's heading and the pencil case's job line.
- **Body** (Kalam 400, 0.98 to 1.08rem; 28px line height on the notebook so text sits on its rules, 24px on the txt card): legends, copied LCD rows, taglines, links. Body on objects never drops below 0.92rem.
- **Scrawl** (Reenie Beanie, 1.6 to 1.7rem, line height 1): asides written quickly ("play snake!!", "txt spk", "more on the desk").
- **Label** (Michroma, max(11px, 3.6cqw), 0.1em tracking, uppercase): Walkman switch names; marks (off / on) at max(9px, 3cqw), 0.06em. Sized in container units so they scale with the Walkman.
- **Brand-word** (Lilita One, 2rem, 1): the voucher's printed word, with a 1px 2px hard print shadow.

### Named Rules

**The Who Wrote It Rule.** Every line of text was either written by hand (Kalam or Reenie) or printed by a manufacturer (Michroma or Lilita). Nothing is set in a neutral web sans.

**The Ruled Line Rule.** Writing on lined paper sits on its lines: line height equals the rule pitch (28px on the notebook, 24px on the txt card).

## Layout

On wide screens the desk is a full-viewport, non-scrolling, three-column grid: `left | phone | right`, with the phone column at `minmax(360px, 40vw)` and the stage `min(88vh, 860px)` tall, centred. Information objects pin to the corners of their column: sticky note top-left, notebook strip bottom-left, Walkman top-right, pencil case bottom-right, each pushed in from the edge with viewport-height margins (6vh to 11vh). Decorative objects (txt card, top-up card, biro) tuck behind or under them and may run off the desk's edge. Objects overlap by stacking order (z 1 to 4), never by covering the phone.

- **900 to 1180px wide:** the phone column narrows to `minmax(320px, 34vw)`, the txt card and top-up card leave the desk, and the four information objects shrink to `min(300px, 31vw)`.
- **900px+ wide and 760px or less tall:** the sticky note tucks up (2vh margin, scaled 0.9) and the txt card leaves.
- **899px and below:** the desk scrolls. The phone comes first at `min(80svh, 720px)`, a "more on the desk" scrawl points down, and the objects follow in a single centred column at `min(330px, 100vw - 48px)`, 36px apart, each still slightly rotated and nudged off-axis. The biro and the Walkman's headphone cord are removed.

Spacing inside objects is small and hand-placed rather than on a strict scale: 4px between keypad keys, 6px between paired keys, 9 to 10px between legend rows, 12px before a new block, 22px sticky-note padding.

## Elevation & Depth

Depth is physical: every object is lying on the desk and casts a two-part warm shadow down and to the right, a tight contact shadow plus a soft far one. Objects with irregular silhouettes (torn paper, the Walkman, the biro, masking tape) cast the same shadow through `drop-shadow` filters so the shadow follows the shape. Inset shadows are used only for material: the slot cut into the Walkman, the puffed edges of the nylon case.

### Shadow Vocabulary

- **Desk contact** (`box-shadow: 1px 2px 2px rgb(45 20 4 / 0.32), 8px 14px 22px rgb(45 20 4 / 0.38)`): the default for any rectangular object on the desk.
- **Torn paper** (`filter: drop-shadow(1px 2px 1.5px rgb(45 20 4 / 0.3)) drop-shadow(7px 12px 14px rgb(45 20 4 / 0.32))`): objects with a cut or torn outline.
- **Sticky curl** (`4px 20px 14px -10px rgb(45 20 4 / 0.5), 14px 22px 18px -14px rgb(45 20 4 / 0.4)`, added to desk contact): the deeper shadow under a paper edge lifting off the desk.
- **Pencil case bulk** (contact plus `10px 18px 26px rgb(45 20 4 / 0.42)`, with insets `inset 0 3px 3px rgb(255 255 255 / 0.12)` and `inset -10px -16px 22px rgb(4 8 26 / 0.55)`): a soft, stuffed object.
- **Phone contact** (a blurred 12px pill of `rgb(24 8 0 / 0.78)`, offset 30px right and 34px down): the handset's shadow, sized from the stage height.
- **Cut slot** (`inset 1px 2px 2px rgb(0 0 0 / 0.8), 0 1px 0 rgb(255 255 255 / 0.8)`): a groove in metal.

### Named Rules

**The Down-Right Rule.** Every shadow offset is positive on both axes. A shadow that falls up or left breaks the window.

**The Lying Flat Rule.** Shadows stay soft and close: nothing floats more than a few millimetres off the desk. No hover lift, no glow.

## Shapes

Nothing is a clean rectangle unless the real object was. Paper has a torn bottom edge (a fixed, seeded polygon so it never jitters) and punched spiral holes masked out of it; masking tape has a jagged clip-path; the sticky note is square on top with a curled bottom-left corner (`sticky-curl`); the nylon case is a puffy, uneven rounded rectangle (`nylon`) with a dashed stitched seam 7px inside its edge. Drawn things are drawn: keys are wobbly biro outlines with four different corner radii (`drawn-key`), the highlighted LCD row is ringed in an uneven ellipse (`drawn-ring`), headings are underlined with a hand squiggle, arrows are scribbled SVG strokes. Manufactured plastic and metal keep honest, small radii (2px slots, 3px scratch panel, 10px voucher card).

## Components

### Drawn Keys (buttons)

Pen-drawn keys on the sticky note that really press the phone's keys.

- **Shape:** a 2px biro outline with wobbly corners (`drawn-key`), 32px tall and at least 38px wide; the NaviKey is a wider pill (64px, `40% 40% 50% 50% / 60% 60% 40% 40%`); keypad keys are 26px squares with a 1.5px line (`drawn-pad-key`).
- **Fill:** a faint white wash on the yellow (0.18), rising to 0.55 on hover; on press it takes a biro tint (`rgb(31 44 134 / 0.16)`) and sinks 1px.
- **Motion:** background 160ms and translate 120ms on `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Icons:** hand-stroked inline SVG (chevrons, power), `currentColor`, round caps.
- **Focus:** a 2.5px dashed biro outline 3px out, as if circled.

### Sticky Note (container)

The key legend and the live hint.

- **Corner Style:** `sticky-curl`. **Background:** sticky yellow gradient, a light adhesive band at the top, a curl highlight at the foot. **Shadow:** desk contact plus sticky curl. **Padding:** 22px 22px 18px. **Rotation:** -3deg (-2deg on mobile).
- **Live hint:** below a 1.5px dashed biro rule, a red-pen arrow and "now: …". When the hint changes, the old one is struck through in red (a 260ms line drawn left to right) and the new one is written in under it (620ms ink wipe after 220ms). The struck line is dropped at mid widths and under reduced motion.

### Notebook Strip (signature)

The LCD copied out by hand.

- **Paper:** notebook paper with 28px feint rules, a margin-red line, punched holes along a torn bottom edge. Padding 14px 20px 26px 46px so writing starts right of the margin.
- **Content:** the screen's header right-aligned, rows in biro, the selected row ringed (`drawn-ring`), the softkey label centred and underlined, then "at Menu › …" in bold biro and a score-red scrawl.
- **Behaviour:** on every screen change the copy is re-keyed and re-written with a 700ms left-to-right ink wipe (`clip-path` inset).

### Walkman Slide Switches (toggle)

The phone's Sound and Lights as real `role="switch"` buttons silk-screened onto the casing.

- **Style:** Michroma label above an `off — slot — on` row; the active mark is darkened and underlined. The slot is near-black with a cut-groove inset; the knob is a ribbed orange slider covering 52% of the slot.
- **State:** the knob slides 220ms on the house ease; hover brightens the knob 8%. When Sound is on, the cassette hubs turn (full hub 4.2s, near-empty hub 2.6s per turn).
- **Focus:** the shared dashed biro outline, 2px out.

### Pencil Case (contact)

Whose desk this is.

- **Corner Style:** `nylon`. **Background:** nylon navy radial with ripstop grid and fibre noise; zip teeth and slider across the top. **Padding:** 40px 24px 24px.
- **Name:** black marker on a torn masking-tape strip, rotated 1.5deg.
- **Everything else:** correction fluid, run through a chalky SVG displacement filter with a raised text-shadow and a 0.6px stroke.
- **Links:** correction-fluid, 2px underline 4px offset; hover and focus turn marker yellow.

### Navigation

There is none outside the phone. The phone's menus are the navigation; the notebook's "at …" trail reports where you are.

## Do's and Don'ts

### Do:

- **Do** put every new piece of information on a plausible 2001 desk object, in the pen that object would be written with.
- **Do** cast every shadow down and to the right in shadow umber, using desk contact for rectangles and the torn-paper drop-shadow for irregular shapes.
- **Do** rotate objects a few degrees off square and keep the phone dead centre and uncovered.
- **Do** make every object that carries information a real control or real text (buttons, switches, links, headings), and mark purely decorative objects `aria-hidden`.
- **Do** animate writing as writing: a left-to-right ink wipe on `cubic-bezier(0.16, 1, 0.3, 1)`, removed entirely under `prefers-reduced-motion`.
- **Do** keep handwritten body text at 0.92rem or larger and in biro, graphite or red pen on light paper.

### Don't:

- **Don't** add a header, footer, nav bar or any web chrome around the phone.
- **Don't** set text in a neutral web sans or system font; it was either written or printed.
- **Don't** light anything from a second direction or add hover lift, glows or floating shadows.
- **Don't** draw a picture of a control where a working control belongs.
- **Don't** reuse the legacy sea/lagoon tokens in `src/styles.css` (`--surface`, `--line`, …); they belong to the original site template, not this world.
