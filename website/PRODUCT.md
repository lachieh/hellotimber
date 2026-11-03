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

hellotimber is Lachlan Heywood's portfolio, built as a faithful, working Nokia 3310 rendered
in three.js. The phone runs a reproduction of the stock v6.39 firmware; its menus hold the
portfolio content, and the site's routes mirror the phone's screens. Success: a visitor plays
with the phone, understands how to drive it, and can find out who Lachlan is and how to get in
touch.

## Positioning

The portfolio is not a page about a phone; it is the phone. Behaviour (menu order, key
handling, timings, pixels) matches the real handset to human-perceivable fidelity, checked
against emulator captures of the real firmware.

## Operating Context

- Desktop: keyboard drives the phone (arrows scroll, Enter = NaviKey, Backspace/Escape = C,
  digits, `*`, `#`, `p` = power); pointer presses the 3D keys.
- Touch: tap the 3D keys.
- The phone boots (~5 s) before standby; the LCD is 84×48 monochrome.
- Live phone state is available to the page: the current route/menu path, a text rendering of
  the LCD (`describeStockScreen`, today an sr-only `role=status` mirror), sound and backlight settings.

## Capabilities and Constraints

- The 3D phone stage (`PhoneStageHost`) mounts once in `routes/_phone.tsx` and must never
  remount across routes.
- Per-route portfolio content is server-rendered and crawlable; today it is visually hidden.
- The phone packages must not know about the router; the website owns all bridging.
- The 2001 school desk carries a sticky pad with the live "what to press next" hint (worded for
  keyboard or touch) and a Sound off tick-box, and a pencil case with the name and contact
  links. There is no key legend and no LCD transcription on the desk: the phone teaches itself,
  one step at a time. The phone's number for Lachlan (0491 570 006) is written on the desk.
- The phone renders at most its real physical size; the server sends a comic-ink drawing of it
  that turns into the 3D phone once it has loaded, or says it can't switch on if it can't.

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

## Stock runtime desk (plan 31)

The sticky pad's hint reads the stock screen (its kind, softkey and accessible description);
it never reconstructs the LCD. The Sound off tick-box gates the stock audio adapter's master
gain and never rewrites firmware settings. Lights follow the firmware's own automatic timeout.

A direct unknown URL keeps the handset and desk available while the runtime loads, then
opens stock SIM services. The server response remains a 404; client navigation follows the
phone to SIM services. Route changes and browser Back/Forward keep the same stage canvas.

Confirming a project's Open question in SIM services opens its link through the same call
flow as a phone-book contact: the handset shows the existing Calling, connected and call-end
screens, then standby. The toolkit composition is UNVERIFIED against real SET UP CALL
firmware; plan 30 records the missing capture.
