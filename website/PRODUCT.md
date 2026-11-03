# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: people who arrive out of nostalgia or curiosity (general visitors, not a hiring
funnel) and want to pick up and play with a Nokia 3310. Their job is to get the phone working
in their hands within seconds, find their way around its menus, and leave knowing whose phone
it is and how to reach them.

## Product Purpose

hellotimber is Lachlan Heywood's portfolio, built around a faithful, working Nokia 3310
rendered in three.js. The homepage phone runs Lachlan's own firmware: the stock look, keys,
sounds and navigation with his sections as the menu. Each section is also a plain HTML page.
Success: a visitor plays with the phone, understands how to drive it, and can find out who
Lachlan is and how to get in touch, with or without the phone.

## Positioning

The portfolio is not a page about a phone; it is the phone. Behaviour (menu order, key
handling, timings, pixels) matches the real handset to human-perceivable fidelity, checked
against emulator captures of the real firmware.

## Operating Context

- Desktop: keyboard drives the phone (arrows scroll, Enter = NaviKey, Backspace/Escape = C,
  digits, `*`, `#`, `p` = power); pointer presses the 3D keys.
- Touch: tap the 3D keys.
- The phone boots (~5 s) before standby; the LCD is 84×48 monochrome.
- Live phone state is available to the page: the current menu path and highlighted item, a text
  rendering of the LCD (the runtime's `describe`, an sr-only `role=status` mirror), sound and
  backlight settings.

## Capabilities and Constraints

- Routes: `/` (the phone and the spread of the highlighted menu item), `/about`, `/work`,
  `/writing`, `/now`, `/contact` (the section's page with the phone docked beside it), `/chat`
  and `/snake` (the phone centred at real size with a key guide). Entering a section on the
  phone changes the URL; Back on the phone returns to `/` with the carousel on that item; a
  deep link opens the phone at the section. Old `/menu/...` URLs return 404.
- Each section is one content record (`website/src/content/`): the LCD's short form and the
  page's long form, so they can't drift apart.
- A contents column of plain links to every section is always present, keyboard-first and
  works without JavaScript.
- Contact's LCD list opens GitHub, LinkedIn, Bluesky and X in a new tab; Writing's list opens
  the post's page. Chat texts the personas through `/api/sms`; Games has Snake II.
- The 3D phone stage (`PhoneStageHost`) mounts once in `routes/_home.tsx` and must never
  remount across the section routes.
- The phone packages must not know about the router; the website owns all bridging.
- The phone renders at most its real physical size; the server sends a technical drawing of it
  (Fig. 1, with its dimensions) that turns into the 3D phone once it has loaded, or says it
  can't switch on if it can't.
- The page around the phone is a Braun-style product catalogue (`DESIGN.md`): a running head,
  the contents as the catalogue's index, the phone as the exhibit with its figure caption, the
  spread or page beside it, and a colophon with the sound switch, the emulator and the source.
  It is light only. On narrow screens a section page docks the phone as a strip above it.
- The stock v6.39 firmware runs only at `/exp/nokia-emulator`, with its inspector, world and
  stage controls.

## Brand Commitments

- The Nokia 3310 itself (its shape, keypad, LCD and stock firmware behaviour) is the identity.
  Authenticity is a requirement, not a vibe.
- Name: Lachlan Heywood. Site name: hellotimber.

## Evidence on Hand

- Portfolio content is real and sourced from Lachlan's public GitHub profile and history or
  supplied directly by him. The site uses hellotimber.com and his real social handles.
- There is no public email or CV yet. Contact links lead to GitHub, LinkedIn, Bluesky and X.
- Recruiter Rachel and Y2K Support remain fictional personas.

## Product Principles

1. The phone is the hero: everything around it serves using it, never competes with it.
2. Play first: a visitor should be pressing keys before they read anything.
3. Teach the device in its own terms (keys, menus, the LCD), not in web-UI idioms.
4. Who and how-to-reach must be findable without driving the phone.
5. Fidelity is the craft: never fake phone behaviour in the surrounds.
