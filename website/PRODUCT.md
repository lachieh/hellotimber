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
- The 2001 desk carries real key controls, a live LCD transcription, Sound/Lights switches and contact links.

## Brand Commitments

- The Nokia 3310 itself (its shape, keypad, LCD and stock firmware behaviour) is the identity.
  Authenticity is a requirement, not a vibe.
- Name: Lachlan Heywood. Site name: hellotimber.

## Evidence on Hand

- Content in `website/src/content/` (phone book, messages, chat, profiles, …) is largely
  SAMPLE DATA pending real copy; do not invent claims, roles, employers or testimonials.
- No real CV, origin URL or social handles yet (`site.ts` holds placeholders).

## Product Principles

1. The phone is the hero: everything around it serves using it, never competes with it.
2. Play first: a visitor should be pressing keys before they read anything.
3. Teach the device in its own terms (keys, menus, the LCD), not in web-UI idioms.
4. Who and how-to-reach must be findable without driving the phone.
5. Fidelity is the craft: never fake phone behaviour in the surrounds.

## Stock runtime desk (plan 31)

The notebook transcribes the firmware's accessible screen description, including stock
widgets, messages, calls and game scores. It does not reconstruct the old website LCD
layout. The sticky note reads the same stock softkey. The Snake scrawl says "play snake!!";
it no longer reads the removed website game's score store.

Sound gates the stock audio adapter's master gain. Lights is a session-only gate on the
stock display and keypad LED outputs: Off suppresses both; On follows the firmware's
automatic timeout. Neither switch rewrites firmware settings or invents phone behaviour.
