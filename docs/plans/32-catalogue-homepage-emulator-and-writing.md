# Plan 32 - Catalogue homepage, Nokia emulator experiment, and Writing

> **Supersedes** plan 31's website contract (URL = `/` + stock phone path) and the school-desk
> direction in `website/DESIGN.md`. VISION.md, AGENTS.md, PRODUCT.md and DESIGN.md are updated in
> the phase that changes the behaviour they describe, not before.

**Status:** planned (2026-11-03). Decisions from the grilling session with Lachlan.

**Package names:** every workspace package is scoped `@hellotimber/*` (`packages/<name>` → `@hellotimber/<name>`). Short names below mean the scoped package.

## Goal

Three experiences instead of one:

1. **Homepage (`/`)**: a Braun / Dieter Rams catalogue. The phone runs a custom firmware, a stock
   3310 look and behaviour with Lachlan's own menu tree. Moving through the menu changes a catalogue
   spread beside the phone. Entering a section goes to that section's HTML page, with the phone
   docked to one side.
2. **Nokia emulator (`/exp/nokia-emulator`)**: the strict stock v6.39 firmware, floating in a dark
   studio stage, with a collapsible control panel on the right.
3. **Writing (`/writing`, `/writing/<slug>`)**: a technical blog in the spirit of samwho.dev and
   joshwcomeau.com. Its first post is how the phone was built, and it links to the emulator.

## Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Homepage sections:** About, Work, Writing, Now, Contact, plus the phone-only extras Chat and Snake. Calculator, Tones, Settings, Call divert, Profiles and Clock exist only in the emulator.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D2  | **Homepage firmware:** the stock look, font, keys, sounds and navigation idioms (carousel, Select/Back, scroll bar), with a custom menu tree. It isn't the stock firmware: `nokia-os` stays a strict reproduction (D13).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D3  | **The emulator runs only the stock firmware.** There's no firmware switch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D4  | **Emulator controls:** an inspector (live machine state, a clickable menu tree that jumps to a screen, a timestamped key/event log), world controls (battery, signal, phone time, incoming call, incoming SMS, backlight, EEPROM reset) and stage controls (lights, camera, the reveal scrubber, LCD size). There's no menu or copy editor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D5  | **Controls style:** a modern developer-tool inspector (Chrome DevTools / Xcode) with some lab-instrument character. Typed technical readouts with units, 1px thin-line SVG icons, and finely made micro-controls (small knobs, 2px toggles, LED dots, grooved sliders). Labels in a crisp small sans and tabular mono for the numbers. One signal colour plus amber for warnings, on near-black.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D6  | **Emulator on small screens:** below 760px the panel becomes a bottom sheet with Inspector / World / Stage tabs. The emulator's state lives only in the panel, with no deep URLs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D7  | **Homepage visual:** a Braun catalogue (off-white stock, a precise grid, spec-sheet captions, product-as-exhibit). The comic sketch is redrawn as a technical/patent drawing ("Fig. 1") that reveals into the 3D phone. The callout leader lines first stay as spec annotations (model, dimensions, weight). If they compete with the spread, cut them (expected).                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D8  | **Menu → spread:** each highlighted menu item shows its catalogue spread (name, one-line summary, three or four specs) beside the phone, and the spread changes as the highlight moves.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D9  | **Entering a section:** the URL changes (`/about`, `/work`, `/now`, `/contact`) and the page becomes a full HTML catalogue page. The phone docks smaller to one side and its LCD shows the section's screen. Back on the phone returns to `/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D10 | **Writing on the phone:** the LCD lists post titles, and selecting one opens `/writing/<slug>`. Posts don't dock the phone. They get the full reading layout and a small "back to phone" link.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D11 | **Chat and Snake:** `/chat` and `/snake` put the phone in the centre at real size, and the spread becomes a short key guide.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D12 | **Path without the phone:** the catalogue's contents column is a plain list of links to every section. It's always present, keyboard-first and visible to screen readers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D13 | **Package boundary (revised):** a new package `@hellotimber/nokia-kit` holds the modular OS: `ui` (widgets, painter, fonts, sounds), `system` (boot, home screen, battery, signal, lights, clock, keyguard, power, storage, settings registry), `apps/*` (one module per app) and `firmware` (`defineFirmware(manifest)`). `nokia-os` shrinks to the v6.39 firmware snapshot: the manifest, captured tree and tables, and golden tests. Only the emulator uses it. The homepage firmware is a manifest in `website/src/home/`, so there's no `portfolio-os` package. See Phase 0.                                                                                                                                                                                                                                                 |
| D20 | **Phone services:** a new package `@hellotimber/phone-services` holds the shared state the original OS tangled together: the SMS store and messaging, the chat session, the phone book store, the SIM card and its messages, the telephone and the call log, and the network port. It has no screens and no menus, and it depends on neither phone-core nor nokia-kit. It talks to the outside world through `storage`, `network`, `clock`, `settings` and `events` ports. `phone-core` gets an optional, generic service slot (`createPhone({ services })`), which hands one shared instance to every application. phone-core never knows what's in it. The apps (Messages, Chat, Phone book, SIM services, Call register) depend on phone-services, never on each other. The emulator's World controls drive the same instance. |
| D14 | **Content:** each section's content is one typed record in `website/src/content/` with an `lcd` short form and a `page` long form, so the phone and the HTML page can't drift apart. Writing posts are MDX files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D15 | **No redirects.** The old `/menu/...` URLs return 404. The sitemap lists only the new routes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D16 | **Blog visuals:** the page uses the homepage's type, palette and grid, set for long reading (65–75ch). Interactive figures can use their subject's own look (the Nokia figures in LCD green-grey).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D17 | **`/exp/*` frame:** a thin shared frame with a back-to-home mark, the experiment's title and a link to its write-up. There's no `/exp` index. Experiments are linked from posts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D18 | **Kept from today:** the sketch-to-3D wipe and lift (`reveal.ts`), the real-size phone (`--d01-ppi`), tilt moving the light, the WebGL failure fallback and mute. Mute moves from the post-it into the catalogue's colophon on the homepage and into World on the emulator.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D19 | **Removed from the homepage:** the desk, graffiti, sticky pad, pencil case, the laminate and their CSS and tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## Phases

Each phase ships on its own, and `main` keeps working after each one.

### Phase 0 - Split `@hellotimber/phone-services` and `@hellotimber/nokia-kit` out of `@hellotimber/nokia-os`

Measured today (`cdc423d`): features already contribute screens, settings and records through
`StockFeature`, but three things tie them to the stock phone:

- They're keyed by absolute stock node numbers ("3", "9", "2-9").
- They share one `StockServices` bag (`settings` is used by 25 feature files, `eeprom` by 16).
- `createStockPhone` wires boot, standby, lights, clock, the telephone and the menu by hand.

The import graph also runs the wrong way: `widgets/` imports from `calculator`, `calls`,
`composer`, `messages` and `phone-book`, and `messages`, `chat`, `phone-book` and `sim` import
each other.

Target layers, where an arrow means "may import":

```
firmware (manifests) ──▶ apps/* ──▶ system ──▶ ui ──▶ @hellotimber/phone-core (+ optional service slot)
                            │
                            └──▶ @hellotimber/phone-services (no UI, no phone-core)
apps/* ──▶ other apps only through declared capabilities
```

The comms domain (D20) needs only small changes to come out cleanly, measured at `cdc423d`:

| Leak                                                                                                    | Fix                                                                                                      |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `messages/store`, `phone-book/store` and `calls/log` import `firmware/eeprom`                           | A `storage` port of records. The v6.39 EEPROM layout becomes one adapter.                                |
| `calls/telephone` imports `firmware/settings` and `sound/sounder`                                       | A `settings` reader plus outgoing `events` (ring, connect, end). The kit's system turns them into sound. |
| `messages/network` imports `composer/program`                                                           | Move the ringtone type into phone-services.                                                              |
| `phone-book/sim-card` imports `sim/toolkit`, which draws screens                                        | Split the toolkit's data types from its screens. Only the screens stay in the kit.                       |
| `messages/service`, `phone-book/sim-card` and `sim/messages` import `resources` (glyph and font tables) | Pass text limits in as config.                                                                           |

The app contract replaces `StockFeature`:

- `id`
- `needs` and `provides` capabilities
- `menu`: the app's own subtree, with relative paths, labels, and a static or animated graphic per item
- `screens` by relative path
- `settings` and `records`

The manifest then places the apps:

- It gives every app its menu position and number.
- The captured v6.39 tables (prompt layouts, note styles, factory values) stay keyed by absolute
  node number and live with the stock firmware as overrides.
- Cross-app links such as Inbox › Options › Chat go through capabilities, e.g. `chat.open(number)`.
- The Settings app lists whatever settings the system and the mounted apps register.

Each step below keeps every golden test green, and `createStockPhone` stays as the public API
until step 6:

- [x] 1. Fence: a dependency rule for the target layers, with today's violations as its baseline.
- [x] 2. Move app-specific widgets (calculator, call, composer, snake, etc.) into their apps.
- [x] 3. Extract `ui`: widgets, display, resources, text and T9, and the sound sequencer, with
     timelines and settings passed in.
- [x] 4. Extract `system`: boot, standby/home, power list, battery and signal state, lights,
     clock and alerts, keyguard, security, storage and the settings registry. Battery and signal
     become real state the emulator can drive.
- [x] 5a. Extract `packages/phone-services` (D20). Fix the leaks in the table above, add phone-core's
      optional service slot, and give the stock phone the services it creates.
- [ ] 5b. Write the app contract and relative addressing. Port calculator, then games and Snake, then
      Messages, Chat, Phone book, SIM services and Call register. Each becomes its own app over
      phone-services.
- [x] 6. `defineFirmware`: the v6.39 manifest, with `createStockPhone = defineFirmware(v639)`.
- [x] 7. Move the kit into `packages/nokia-kit`. `@hellotimber/nokia-os` becomes `@hellotimber/firmware-v639`
     (manifest, generated tree, captured tables, goldens).
- [x] 8. (Done as Phase 2's first task.) The homepage manifest in `website/src/home/firmware.ts`, built from kit apps (a reader,
     a list, links, chat, Snake) and the content records (D14).

Phase 1 can run alongside steps 1-5 because it only uses `createStockPhone`.

**As built (2026-11-03, `66d8cd0`..`8a99f15`):**

- **Packages:** `@hellotimber/phone-services` (no deps) and `@hellotimber/nokia-kit` (`ui`, `system`, `apps/{calculator,games}`; deps: phone-services, phone-core, phone-screen) were split out. Fences: `packages/nokia-kit/tests/layers.test.ts` and `packages/nokia-os/tests/package-boundaries.test.ts`.
- **Composition:** the engine stays in `@hellotimber/nokia-os`, and the package is **not** renamed `firmware-v639`. The engine is `composeFirmware({ tree, features, handset, models?, simServices? })`, `createFirmwarePhone(firmware, config)`, the menu builder, the leaves and the settings schema. `firmware/phone.ts` still wires the stock standby shortcuts (▲ dialled numbers, ▼ phone book, number entry) and the call and keyguard flows, which import stock features. Until that wiring is pluggable, the engine can't move into the kit, so a rename would mislabel the package the homepage also builds on.
- **Steps 5b and 6 changed shape.** The app contract is the existing `StockFeature`, placed in a firmware with `remountFeature(feature, from, to)`: it rewrites node-keyed tables and records the stock recording model. The rest is in place:
  - a handset settings registry (`STOCK_HANDSET`);
  - per-node carousel graphics (`FirmwareNode.graphic`);
  - explicit recording models;
  - a firmware-owned SIM services slot.

  The cross-app capability wiring is not needed for the homepage (Chat and Snake II remount cleanly; `tests/custom-firmware.test.ts`) and is left undone.

- **Not yet moved into the kit:** the stock app screens (messages, phone book, composer, clock screens, SIM session). They still read `StockServices`.

### Phase 1 - `/exp/nokia-emulator`

The stock firmware moves off the homepage and into its own experiment.

- [ ] Route `website/src/routes/exp/nokia-emulator.tsx` with the `/exp` frame layout (D17).
- [ ] A dark studio stage: `PhoneStage` with a studio light rig (key, rim and a floor bounce), a
      gradient cyclorama and the phone floating with a soft contact shadow. It reuses `phone-3d`
      and adds no new package.
- [ ] A control panel shell: a collapsible right dock, then the bottom sheet below 760px (D6), the
      style tokens (D5) and the micro-controls (knob, toggle, slider, LED, readout) as website
      components under `website/src/exp/nokia-emulator/controls/`.
- [ ] Inspector: machine-state readout via `describeStockScreen` and the phone snapshot, a menu
      tree from `stockMenuFor`, jump-to-screen, and an event log.
- [ ] World: battery, signal, phone time, synthetic incoming call and SMS
      (`createSyntheticNetwork`), backlight, EEPROM reset. Any missing host hooks are added to the
      website's ports, not to `nokia-os`.
- [ ] Stage: light angle and intensity, camera orbit and reset, reveal scrubber (`revealAt`), LCD
      scale.
- [ ] Verify: build, tests and a browser pass on desktop and at 390px.

### Phase 2 - Homepage firmware and section routes

- [x] Requires Phase 0 through step 8. The homepage manifest provides the menu tree (D1), each
      section's `lcd` screens, and the Writing list (D10).
- [x] Content records (D14) for About, Work, Now and Contact, migrated from `sim-messages.ts`,
      `people.ts`, `now.ts` and `toolkit.ts`. Delete the SIM-card portfolio content the
      emulator doesn't need.
- [x] Routes `/`, `/about`, `/work`, `/now`, `/contact`, `/writing`, `/chat`, `/snake`. Rebuild the
      router bridge on the new tree. Delete the `/menu/...` routes, `ROUTE_CONTENT`, `REDIRECTS` and the
      panels registry (D15).
- [x] A spread and docking state machine in the website: the highlighted item → spread, entered →
      route and docked phone, Back → `/` (D8, D9, D11).
- [x] Rewrite the VISION.md routes and content sections, the AGENTS.md website contract, and the
      PRODUCT.md capabilities.
- [x] Verify: SSR of each route, the sitemap, the contents column without JS (D12), and the tests.

**As built (2026-11-03):**

- **Firmware** (`website/src/home/firmware.ts`): a hand-written tree, one top-level item per
  section in `content/sections.ts` order: 1 About (reader pages), 2 Work (rows; each entry opens
  reader pages), 3 Writing (rows of posts), 4 Now (reader pages), 5 Contact (rows: GitHub,
  LinkedIn, Bluesky, X open their links; Hours reads), 6 Chat (stock 3 remounted), 7 Games (stock
  8 with Snake II only, remounted). `composeFirmware` over `STOCK_HANDSET` with no SIM services
  slot. Reader pages are the stock `text-pages` widget (thin font, three lines, More); the
  website wraps and glyph-checks them (`home/lcd.ts`). Link rows are a website feature whose
  screen binding opens the link and shows no response, so the list stays. Games keeps only the
  stock Games feature's Snake II part (Continue, Top score's return): the rest binds Space
  impact, Bantumi and Pairs II, which this tree leaves out.
- **Carousel graphics** (`home/icons.ts`): About (head and shoulders) and Work (briefcase) are
  drawn 1-bit beside the stock hand and pen every icon carries, right-aligned like the stock
  ones; Writing, Now and Contact reuse the stock Messages, Reminders and Phone book icons (frames
  and timeline, not their per-reveal timelines); Chat and Games are their stock icons by slug.
- **Runtime:** `phone/runtime.ts` `startPhoneRuntime({ firmware? })` serves both the homepage
  (`home/runtime.ts`: its own EEPROM prefix `hellotimber.home/`, a SIM with the personas so
  Chat's Search finds them, Snake II level 5) and the emulator (stock). The network port keeps
  persona SMS over `/api/sms` and drops the plan 31 link calls.
- **Routes:** `routes/_home.tsx` mounts the stage once; `_home/{index,about,work,writing,now,
contact,chat,snake}.tsx`. The sitemap lists those eight. Unknown URLs, `/menu/...` included,
  get the root 404 page. `/writing/<slug>` 404s until Phase 4.
- **Bridge** (`phone/router-sync.ts`, `home/routes.ts`): phone path → its section's route
  (`/` at standby and the carousel); a route → the section's node; back to `/` from inside a
  section reopens the section afresh and presses C, so the carousel lands on its item.
- **View** (`home/view.ts`): derived, not stored: `homeView(route, highlighted)` is `spread`
  (the highlighted item's section, or an intro at standby), `docked` (page sections) or
  `centred` (Chat, Snake); `highlightedSection` reads the carousel's item or the section the
  phone is in.
- **Layout:** plain CSS grid (`home/home.css`): contents column with Sound off, the phone, the
  spread or page. The desk, graffiti, sticky pad and pencil case were deleted with their CSS and
  tests (D19, early): nothing in the new composition used them.
- **nokia-os fix:** messages delivered to a phone whose boot a host sent straight to a menu path
  (a deep link) now land; before, they queued until standby was drawn, which a deep-linked boot
  never does (plan 31's deep-boot SMS limitation).

### Phase 3 - Braun catalogue visual

- [x] Run `/impeccable shape` on the catalogue direction: type (a self-hosted grotesk), the
      off-white palette with a single functional accent (Braun's signal green or orange), and the grid.
- [x] Redraw `Nokia3310Sketch` as a technical drawing: line weights, "Fig. 1", dimension lines. Keep
      the wipe mask and the timing.
- [x] The landing composition: the phone at real size as the exhibit, the spread, the contents column,
      the colophon (mute, source link).
- [x] Section page template and docked phone. Spec callouts (D7) behind a flag, decided in a
      browser review.
- [x] Delete the desk, graffiti, pad and pencil case (D19). Rewrite DESIGN.md and its sidecar.
- [x] Run `/impeccable critique` and `polish`.

**As built (2026-11-03):**

- **Direction** was set with Lachlan before the work, so the shape step ran from that brief rather
  than an interview. `website/DESIGN.md` ("The 3310 in the Braun catalogue") and
  `website/.impeccable/design.json` describe the system as built.
- **Type:** Archivo (Omnibus-Type, OFL 1.1), variable 400–700, self-hosted in `website/public/fonts/`
  (latin and latin-ext; the licence beside them), the latin file preloaded. Tabular figures for
  spec values, dates and menu numbers.
- **Palette** (OKLCH in `src/styles.css`): paper `#f4f3f0`, ink `#191816`, ink 2 `#565552`,
  hairline `#cbcac7`, and one signal orange `#dd530f` for the phone's place in the index, the
  sound lamp, focus rings and the caret. Light only: the template's dark theme script, its
  sea/lagoon tokens, Google Fonts import and the Tailwind classes on `<body>` are gone.
- **Grid:** a running head (subgrid) over index (11rem) | exhibit (the stage) | main; the index's
  rule, the phone's top and the heading's capitals share one line. Section numbers are the menu
  numbers the LCD shows. `/chat` and `/snake` centre the phone from 1280px wide.
- **Drawing** (`phone-3d` `Nokia3310Sketch`): the front elevation in fixed-pixel line weights
  (contour, detail, shading down the right side), dimension lines for 113 mm and 48 mm with filled
  arrowheads, key legends in the page's font, a pale LCD pane with the loading bar or the
  can't-switch-on text. `ink`/`paper` props draw it light on the emulator's dark stage. The wipe
  keeps its mask and clock (edge from the phone's top to 0.9 below it); its edge is a fine rule
  across the figure. "Fig. 1" is the HTML caption under the exhibit, which stays after the reveal.
- **Spec callouts:** `Nokia3310Callouts` (phone-3d) behind `SPEC_CALLOUTS` in `routes/_home.tsx`,
  set to **false**: in the browser the leader labels ran into the spread and the key guide and
  repeated the caption and the drawing's dimensions.
- **Narrow screens (≤ 899px):** one column (head, index as two wrapped lines, phone, spread or
  page, colophon). A section page docks the phone as a strip (a 9rem phone beside its caption and
  a "Use the phone" button); a tap on the phone or the button opens it to full size until the
  route changes. The strip's phone takes taps only to open.
- **Removed (D19):** the desk's fonts in `public/desk/` and the desk's surface brief.
- **Detector:** `impeccable detect` is clean on the changed sources and on the built `/`, `/about`,
  `/chat`, `/snake`, `/work` at 1440×900 and 390×844.

### Phase 4 - Writing

- [x] MDX pipeline in the TanStack Start app: posts in `website/content/writing/*.mdx`,
      frontmatter (title, date, summary), Shiki code blocks themed from the palette, and an RSS feed.
- [x] `/writing` index and `/writing/<slug>` reading layout (D16). Feed the post list to the
      portfolio-os Writing screen at build time.
- [x] Figure kit: an inline live LCD (the phone-screen painter, no 3D), a state-machine diagram
      driven by the real machine, a reveal scrubber, and a key-press replayer.
- [x] First post, "How I built a Nokia 3310": the kernel and firmware split, LCD goldens and
      fidelity, the painter, T9, the SMS personas over the network port, the 3D model and the
      reveal, the real-size calculation. It links to `/exp/nokia-emulator`.

**As built (2026-11-03):**

- **Pipeline** (`website/vite.config.ts`): `@mdx-js/rollup` with `remark-frontmatter` and
  `@shikijs/rehype` (theme `src/writing/code-theme.ts`: ink and Ink 2 only), so code is
  highlighted at build time and no highlighter ships to the client. A small plugin answers
  `post.mdx?frontmatter` with the post's frontmatter block and prose word count, and the MDX plugin
  skips queried ids (it drops the query and would compile them as MDX). `src/writing/frontmatter.ts`
  parses the block strictly (`title`, `date`, `summary` required; `lcd`, `updated`, `draft`
  optional; unknown keys, bad dates and `updated` before `date` throw, naming the file).
- **One list** (`src/writing/posts.ts`): posts newest first, drafts only outside production. It
  feeds `content/writing.ts` (the index's entries with `<time>` dates and reading time, and the
  phone's Writing rows from `lcd` or the title; `tests/content.test.ts` keeps rows glyph-valid and
  one row wide), `/rss.xml` (RSS 2.0, `src/writing/feed.ts`), the sitemap (after the sections) and
  the post route. The post route imports the compiled MDX bodies (`src/writing/bodies.ts`), so
  only its chunk carries them.
- **Post page** (`routes/writing/$slug.tsx`, `src/writing/PostPage.tsx`, `writing.css`): outside
  `_home`, so no phone; the running head, an index column with "Back to the phone" and the
  details, the body at 68ch. Head: title, description, canonical, Open Graph article tags,
  `BlogPosting` JSON-LD and the feed's `alternate` link. Unknown slugs 404.
- **Figures** (`src/writing/figures/`, given to MDX as components): `LiveLcd` (homepage or stock
  firmware, optional `start` path, digits, T9), `StateMachine` (the firmware's `tree` to a depth
  beside a live LCD; the carousel's item, a list's selected row or the open screen is marked),
  `KeyReplay` (a key sequence with `:long` holds; Play, Pause, Step, Reset) and `RevealScrubber`
  (the drawing over the **real 3D stage**, loaded lazily, scrubbed through `revealAt`; without
  WebGL the drawing and its readouts stay). Phones are created by `figure-phone.ts` (boot skipped,
  memory storage, no sound), imported only when a figure nears the screen and ticked only while
  it's on screen. The server sends a blank LCD pane and the drawing. Pure logic is in `machine.ts`.
- **phone-3d:** `formPose` and `FormPose` are exported from the three-free `./sketch` entry too, and
  `phone/reveal.ts` imports them there, so neither the post page nor the homepage pulls three.js
  into its route chunk through the reveal's timing.
- **Emulator:** `WRITE_UPS_PUBLISHED` is gone; the frame always shows its write-up link.
- **Not done:** heading anchors (no `rehype-slug`); the post's prose needs Lachlan's review before
  the branch is published.

## Risks

- **The screens' cross-links (Phase 0, step 5b):** once phone-services holds the shared state, what's
  left between the comms apps is jumps between their screens (Inbox › Options › Chat, phone book →
  Send message). Those become capabilities that the manifest wires. If one turns out to share real
  screen state, that pair ships as one app first.
- **Docked-phone layout on mobile:** a docked phone and a readable page don't fit side by side at
  390px. The working answer is that on mobile the phone docks as a small strip at the top that
  expands on tap. Check this in Phase 3.
- **SEO reset:** with no redirects (D15), existing indexed `/menu/...` URLs drop out. Lachlan
  accepted this for the current traffic.
