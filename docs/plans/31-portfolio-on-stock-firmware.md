# Plan 31 - Portfolio on the stock firmware

> **Fidelity standard (2026-10-15):** `AGENTS.md` "Fidelity standard" governs the phone; this plan
> changes the website only and asserts no new golden.

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, the spec or the code, STOP and report.

**Prerequisites:** plan 30 done through its Task 9 (`StockSimCard.messages`/`toolkit`,
`stockMenuFor`, `imei`, `preload`, `describeStockScreen`). Plans 19 (phone book, `StockSimCard`),
22 through its Task 8 (calls through `StockNetworkPort.dial`, `*#06#`), 25 (lights port), 16
(sound port), 18/18b (SMS, T9) done. Plan 21 Task 11 (Reminders) and plan 18c's Chat are used where
they exist; each use is conditional and names its fallback (D17).
**Structural convention:** website only, plus one subtraction task in `packages/phone-core` and
`packages/phone-screen` (Task 8). Integration code lives in `website/src/` (AGENTS.md rule 5).
**Background:** the website runs its own phone-core menu (`website/src/content/menu.ts`,
`siteMenu`) with website applications and phone-screen's own painter. A painter-only swap to
nokia-os broke the site and was reverted (`b446466`): `paintStockScreen` draws only the stock
firmware's screens. The fix is to run the stock firmware itself.
**Status:** in progress (Tasks 0-2 complete; runtime cutover pending).

## Goal

The website runs `createStockPhone` from `@hellotimber/nokia-os`, and the portfolio lives inside
the stock v6.39 features, as Lachlan decided (2026-10-15):

> "I want it as close to the original as possible. All of the portfolio content should go inside
> standard os features like messages, contacts, etc. If there's something that genuinely doesn't
> fit into the existing menu, we can add it to sim services. At some point, this will break down,
> because we'll need to do things like links (though for things like github links etc. they could
> be contacts that 'making a call' to will open in a new tab)."

- **Content** on a portfolio SIM card: people and links in the phone book, intros, work history and
  testimonials as SMS in the Inbox, projects and the colophon in SIM services, "now" items as
  Reminders; calling a link contact opens its URL in a new tab;
- **messaging**: Write messages and Chat reach the LLM personas through a website
  `StockNetworkPort` backed by `/api/sms`;
- **runtime**: localStorage EEPROM, WebAudio sound, phone-3d lights, Brisbane clock, keys, tick
  loop, power-on, reduced motion, mute;
- **routes**: URLs mirror the stock menu paths; server-rendered panels, sitemap and redirects
  derived from stock paths and content; the 404;
- **removal** of `siteMenu`, the website applications, the website painter use and the superseded
  settings, with the tests rewritten;
- **verification**: build, tests, headless QA through the `[role=status]` mirror, deploy readiness
  (no deploy without Lachlan's OK).

## Why this plan exists (measured gap)

| Area             | Website today                                                                                                 | After this plan                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Firmware         | `createPhone({ menu: siteMenu })`: a 13-entry imitation menu, stubs (`not available. No network connection.`) | `createStockPhone`: the v6.39 tree (279 nodes), every screen against goldens      |
| Painter          | phone-screen's own layouts (`createScreenRenderer({ welcomeText })`)                                          | `createScreenRenderer({ paint: paintStockScreen })`                               |
| Content          | website-shaped: list readers, `ActionEntry` redirects, call-register metaphors                                | SIM data the stock features show (D1-D8)                                          |
| Messaging        | `SmsApplication`/`ChatApplication` (website applications) over `/api/sms`                                     | stock Write messages, Inbox and Chat over a website `StockNetworkPort` (D9)       |
| Sound and lights | 1800 Hz website key beeps, website ringtones, a `backlight` setting                                           | the firmware's sound events through WebAudio; lights from the firmware's LED port |
| Settings         | `hellotimber.settings` (keypad tones, backlight, welcome note, ringtone, screensaver, mute)                   | the EEPROM (`nokia-os/…` keys); the website keeps mute only                       |
| Routes           | `siteMenu.paths()` + website metadata                                                                         | `stockMenuFor(PORTFOLIO_SIM).paths()` + a website route-content table             |

## Content inventory (2026-10-15)

Every item in `website/src/content/**` (all marked SAMPLE DATA except structure):

| Module             | Items                                                                                   | Shape today                                   |
| ------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| `site.ts`          | name, job title, description, tagline, `sameAs`, origin                                 | SEO and JSON-LD                               |
| `phonebook.ts`     | Email, GitHub, LinkedIn, CV (`href`, `rel`, `download`)                                 | Phone book › Search list                      |
| `contacts.ts`      | personas Lachlan, Recruiter Rachel, Y2K Support (system prompts, canned replies)        | Write messages recipients, Chat partner       |
| `messages.ts`      | four intros (hello, stack, work, say-hi), Write's destination email                     | Inbox list                                    |
| `chat.ts`          | five testimonial lines (`>` them, `<` Lachlan)                                          | Chat's opening history                        |
| `call-register.ts` | roles (2), projects (3, two with URLs), missed calls (2)                                | Received calls, Dialled numbers, Missed calls |
| `reminders.ts`     | three "now" items                                                                       | Reminders list                                |
| `clock.ts`         | time zone `Australia/Brisbane`, availability line                                       | Clock reader                                  |
| `divert.ts`        | GitHub, LinkedIn, X                                                                     | Call divert `ActionEntry` redirects           |
| `profiles.ts`      | visitor-mode copy (stretch, unused)                                                     | Profiles list                                 |
| `menu.ts`          | `siteMenu`, `SITE_STANDBY_KEYS`, website applications, SIM services 404 reader          | the whole phone                               |
| (panels)           | standby bio paragraph (`routes/_phone/index.tsx`), SIM services IMEI (`__BUILD_HASH__`) | HTML only                                     |

## Scope and non-goals

In scope: everything under `website/`; AGENTS.md's dependency rule and VISION's website sections;
deleting package code whose only consumer was the website (Task 8).

Out of scope: any nokia-os behaviour (plan 30 and the feature plans own it); the phone-3d model;
incoming calls to the visitor (D11); a letter keyboard for SMS (Open question 13); deploying
(Lachlan approves it, Task 9); real copy (Lachlan supplies it; the structure and the sample data
follow the constraints, D8).

## Decisions

**D1 - The visitor holds a phone with Lachlan's SIM card in it (the conceit).** The operator line
reads `LACHLAN` (the SIM's operator); the phone book, the Inbox and SIM services come from the
SIM; Reminders and Snake II's score are the phone's own memory. Everything the visitor changes
persists in the browser's EEPROM like a real phone's. This decides every mapping below: content
goes where Lachlan's SIM (or a phone he handed over) would carry it.

**D2 - Content mapping (the starting point, adjusted).**

| Content                                                   | Stock home                                          | Form                                                                                                 | Why                                                                                                     |
| --------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Personas (Lachlan, Recruiter Rachel, Y2K Support)         | Phone book (SIM `EF_ADN`)                           | name + a fiction-range mobile number (D6)                                                            | people are contacts; texting them reaches the LLM (D9)                                                  |
| Email, GitHub, LinkedIn, X, CV                            | Phone book (SIM `EF_ADN`)                           | name + a fiction-range number; **Call opens the URL in a new tab** (D10)                             | Lachlan's decision; Call divert's three links move here                                                 |
| Source code (this repo)                                   | Service Nos. (SIM `EF_SDN`)                         | `Source code` + number; Call opens the repo                                                          | an operator's own service number; the operator is `LACHLAN`, the site                                   |
| Intros (hello, stack, say-hi), bio                        | Inbox (SIM `EF_SMS`), from Lachlan's number         | one SMS each, ≤160 GSM septets; the bio split into at most two SMS                                   | "About me, in SMS form" was already the Inbox's job                                                     |
| Availability                                              | the say-hi SMS                                      | one sentence in it                                                                                   | fits an SMS; the Clock shows the time itself (D13)                                                      |
| Work history (roles)                                      | Inbox, from Lachlan's number                        | one SMS per role: period, title, organisation, one line                                              | a received-calls list holds numbers, not roles; an SMS holds 160 characters                             |
| Testimonials                                              | Inbox, from Lachlan's number                        | one SMS each, quoting the giver: `CTO@Acme: Lachlan shipped the impossible. Twice.`                  | stock Chat keeps no history to seed; a forwarded quote is how 2000 phones carried one (Open question 4) |
| Projects (name, blurb, year, URL)                         | **SIM services › Projects**                         | `SELECT ITEM` of projects → a text page (blurb, year) → a call step `Open <name>?` when it has a URL | breaks down: a contact holds no text and an SMS holds no link (D16)                                     |
| Colophon (how the site is built)                          | **SIM services › About this site**                  | a text page → a call step to Source code                                                             | longer than an SMS and about the SIM itself (D16)                                                       |
| "Now" items                                               | Reminders (phone memory)                            | plan 30's `preload.reminders`, no alarm, within plan 21's text limit                                 | Reminders are notes to self; a used phone has them (D7)                                                 |
| Tagline                                                   | none on the phone; SEO only                         | `site.tagline`                                                                                       | a Welcome note would replace the boot hands animation (Open question 6)                                 |
| Missed calls ("ones that got away")                       | dropped                                             | —                                                                                                    | call lists record events (plan 30 D8); the joke has no stock home (Open question 5)                     |
| Profile modes (stretch copy)                              | dropped; Profiles stay stock                        | —                                                                                                    | the stock Profiles are the feature                                                                      |
| Write's destination email                                 | the Email contact; the Write panel's `mailto:`      | —                                                                                                    | unchanged in HTML                                                                                       |
| Clock, Call divert, Tones, Settings, Snake II, Calculator | stock                                               | —                                                                                                    | the firmware is the content                                                                             |
| IMEI easter egg                                           | stock `*#06#` with `imei` from the build hash (D12) | 15 digits, Luhn                                                                                      | `*#06#` is stock (plan 22 S8); the IMEI is the phone's                                                  |

**D3 - The portfolio SIM card is generated from content and named by its hash (decision).**
`website/src/content/sim.ts` builds `PORTFOLIO_SIM: StockSimCard` from the content modules: id
`hellotimber-<8 hex of FNV-1a over the SIM's JSON>`, the phone book (people, then links, in content
order; 50 locations, 16-character names), service numbers, 15 message slots with the SMS, and the
toolkit (title `LACHLAN`, items `projects` and `about`). A content change is a new SIM card: plan
19 D3 and plan 30 D2 read the host's SIM only until the phone writes that SIM, so a stable id would
hide new content from returning visitors behind their stored copy. The cost: a visitor's edits and
received replies stay with the old SIM (Open question 1). With Phone security On, a new SIM asks
for the security code at power-on, as a real phone does.

**D4 - Content rules are tested, not trusted (TDD).** `tests/sim-content.test.ts` creates a stock phone
with `PORTFOLIO_SIM`, `PRELOAD` and `IMEI` (it throws on any plan 30 D12 violation) and, for helpful
failures, checks each field itself: names ≤16 SIM characters and drawable in small and large; SMS
≤160 GSM septets and drawable in small; toolkit labels and texts in their faces and limits;
reminder texts typeable and within plan 21's limit; numbers unique, in the fiction ranges (D6),
dialling as calls (2-20 digits, not `112`/`000`/`911`); at most `slots - 5` SIM messages (room
for replies); every link number in `LINKS` is a contact, a service number or a toolkit call step,
and every such number is in `LINKS` or `PEOPLE`.

**D5 - Content style for the stock glyphs (rewrite rule).** Plain ASCII punctuation: `'` and `"`
(no curly quotes), `-` (no en or em dash), `...` (no ellipsis character), `x` (no `×`), no emoji,
no non-GSM characters in SMS. Task 2 rewrites the sample data accordingly (`—` in the hello intro,
`→` in persona prompts' plugs are the known cases) and keeps every `SAMPLE DATA` marker.

**D6 - Numbers come from Australia's fiction ranges (decision).** Personas use ACMA's mobile numbers
reserved for creative works (`0491 570 006`, `0491 570 156`, … ;
https://www.acma.gov.au/phone-numbers-use-tv-shows-films-and-creative-works, re-checked at Task 2),
links use the reserved Brisbane landline range `07 5550 xxxx` with the last four digits spelling
the link on the keypad where possible (GitHub `0755504484`, LinkedIn `0755505465`, Email
`0755506245`). No number can reach a real subscriber if a visitor copies it into a real phone.

**D7 - Phone-memory content uses plan 30's preload, once (decision).** `PRELOAD = { reminders }`
(the "now" items, no Welcome note: Open question 6). Preload writes only where no record exists, so
a returning visitor keeps their reminders and Lachlan's later edits reach new visitors only (Open
question 7). Without plan 21 Task 11 the "now" items become one more SIM SMS (`Now: …`) and
`PRELOAD` is empty (D17).

**D8 - Sample data stays sample.** Lachlan supplies real copy later (VISION assumption); this plan
moves the sample data into the new shape under the D4/D5 rules and keeps the `SAMPLE DATA` markers.

**D9 - The website network port backs SMS and Chat with the personas (replaces
`website/src/phone/applications/{sms,chat}.ts`).** `createPortfolioNetwork()` implements
`StockNetworkPort`:

- `send({ number, text })`: a persona number → POST `/api/sms` `{ contactId, text, history }` with
  the last 12 turns of that number's thread → `deliver({ number, text: reply, sentAt: now })`
  (Brisbane time); resolves `"sent"` as soon as the POST is accepted (the reply arrives after it, as
  an SMS does). Offline or a network error → `"failed"` (plan 18's failure note). Any other number
  → `"sent"` and no reply (the synthetic network's behaviour);
- thread history in `hellotimber.threads` (localStorage, keyed by SIM id and number, last 12 turns),
  because the firmware does not keep sent messages (plan 18 D8);
- `subscribe(deliver)`: keeps `deliver`; no server push;
- `/api/sms` accepts up to 459 characters in (a three-part SMS, the editor's `459/1`), keeps replies
  ≤160, tells personas "plain ASCII, no emoji", and sanitises replies (D5's map, then drops
  characters `missingStockGlyphs` reports in the small face).
  Chat (plan 18c) uses the same port: its lines are SMS to the partner's number and the reply comes
  back as a `>` line.

**D10 - Calling a link opens it; the call is a short connected call (decision).** The port's
`dial(number, control)`:

- a link number → open the URL **synchronously** (plan 30 D6 guarantees `dial` runs inside the
  key event, so the browser keeps the user activation): `window.open(href, "_blank",
"noopener,noreferrer")` for `https:`, `location.assign` for `mailto:`, a download link for the CV;
  then `control.alerting()`, `control.connected()` and, after `LINK_CALL_MS` (1500 ms),
  `control.released()`. The phone shows `Calling` with the name, the connected `GitHub` screen, the
  network's end (the checkered icon, three beeps) and returns; Dialled numbers lists `GitHub`;
- a persona number → `alerting()`, then `released()` after `NO_ANSWER_MS` (30 s) unless the visitor
  ends it: nobody answers (Lachlan answers texts, not calls);
- any other number → plan 22's synthetic behaviour (alerts and connects, until End).
  A blocked popup (`window.open` returns `null`) still completes the call; the HTML panel holds the
  same link (Open question 8).

**D11 - No incoming calls.** `subscribeCalls` is not implemented; the site never rings the visitor
(Open question 9).

**D12 - Runtime adapters (website/src/phone/).**

| Concern        | Adapter                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phone          | `stock-phone.ts`: one `createStockPhone` per session (client-only, as `getPhoneRuntime` today) with `carrier: "LACHLAN"`, `sim: PORTFOLIO_SIM`, `preload`, `imei`, `storage: window.localStorage`, `network`, `sound`, `lights`, `clock`, `date`, `t9`, `boot`                                                                                                                                                                                        |
| Storage        | `window.localStorage`; the firmware writes only `STOCK_STORAGE_PREFIX` (`nokia-os/`) keys. The website's old keys `hellotimber.settings` (all but `muted`) and `hellotimber.messages` are removed once at start-up                                                                                                                                                                                                                                    |
| Painter        | `createScreenRenderer({ paint: paintStockScreen })` at 84×48; phone-3d upscales                                                                                                                                                                                                                                                                                                                                                                       |
| Sound          | `stock-sound.ts`: the nokia-os demo's `WebAudioSound` (`demo/panels/sound.ts`) without its DOM: buzzer square, tone sine plus a second sine for plan 22's `hz2` (DTMF), its gain tables, scheduling at `ctx.currentTime + (atMs - phoneNow)/1000 + 0.03`, the context created on the first key or pointer gesture; mute (the site's SoundToggle) sets the master gain to 0; the vibrator calls `navigator.vibrate` where it exists, never while muted |
| Lights         | `StockLightsPort` events → React state → `<PhoneStage backlightOn keypadLightOn>` (plan 25's README sketch); the `backlight` setting is deleted                                                                                                                                                                                                                                                                                                       |
| Clock and date | `host-clock.ts`: `Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane" })` → `"HH:MM"` and `"DD.MM.YYYY"` (plan 21 D1's validated formats); SMS replies' `sentAt` from the same clock                                                                                                                                                                                                                                                        |
| Keys           | `keyboard.ts` unchanged: arrows ▲/▼, Enter Navi, Backspace/Escape C, digits, `*`, `#`, `P` power; 3D key taps as today. The 3310 has no green/red keys: Navi is `Call`/`Answer`/`End` by its soft key, C rejects or goes back, held C returns to standby                                                                                                                                                                                              |
| Tick loop      | `requestAnimationFrame` → `phone.tick(Math.floor(performance.now()))`, the sound port's `phoneNow` set first; a hidden tab catches up on its next frame                                                                                                                                                                                                                                                                                               |
| Power-on       | at first construction: power down, up 1000 ms later (the nokia-os README's sequence); deep links retarget the boot as today                                                                                                                                                                                                                                                                                                                           |
| Reduced motion | `boot: "skip"` (no self-test, hands or welcome note; a security-code gate still runs)                                                                                                                                                                                                                                                                                                                                                                 |
| T9             | `import("@hellotimber/nokia-os/t9-english")` starts with the stage; the phone is created when it resolves, or without T9 if it fails (Open question 12)                                                                                                                                                                                                                                                                                               |
| IMEI           | `imei.ts`: `__BUILD_HASH__` → 14 digits (`35` + 12 from the hash) + the Luhn digit                                                                                                                                                                                                                                                                                                                                                                    |
| Screen mirror  | `ScreenMirror` renders `describeStockScreen(snapshot.screen)` (plan 30 D11); `screen-text.ts` is deleted                                                                                                                                                                                                                                                                                                                                              |
| Screensaver    | the website's idle screensaver and `*#06#` funnel are deleted (the firmware has `*#06#`; its screen saver is plan 18c's gallery, out of scope)                                                                                                                                                                                                                                                                                                        |

**D13 - Routes mirror the stock menu (replaces `site-tree.ts`).** URL = `/` + stock path, from
`stockMenuFor(PORTFOLIO_SIM)` (plan 30 D5): the same shape as today (`menu/<slug>/…`), now the
v6.39 tree plus `menu/sim-services/{projects,about}`. `stock-routes.ts` projects a path to
`{ title, description, indexing, panel, slugChain }` from the stock entry's label (firmware lines
joined by a space) and the website's `ROUTE_CONTENT` table (`content/routes.ts`, keyed by stock
path); a path not in the table is a real page, `noindex`, with the generic panel (the stock label and
its children as links). Router sync (`router-sync.ts`) is unchanged in design: the stock phone is a
phone-core `Phone` (`navigate`, `pathchange`); standby applications (the ▼ name list, the Inbox from
a notice, dialling) keep the path `standby` and the URL `/`.

**D14 - Indexable paths and panels (SEO).** `ROUTE_CONTENT` marks these `index` with a description
and a panel; everything else is `noindex`:

| Path                                                                            | Panel (server-rendered, `sr-only`)                                                |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `/`                                                                             | standby: name, job title, the bio (the intro SMS texts), how to drive the phone   |
| `/menu`                                                                         | the 12/13 top-level entries as links                                              |
| `/menu/phone-book`, `/menu/phone-book/search`                                   | `<address>`: people and links with real `<a>` (`rel="me"`, `download` for the CV) |
| `/menu/phone-book/service-nos`                                                  | Source code                                                                       |
| `/menu/messages`, `/menu/messages/inbox`                                        | the SIM messages as articles with `<time>` and sender names                       |
| `/menu/messages/write`, `/menu/chat`                                            | how to text the personas; the `mailto:` fallback                                  |
| `/menu/reminders`, `/menu/reminders/view-all`                                   | the "now" items                                                                   |
| `/menu/clock`                                                                   | Brisbane time zone and availability                                               |
| `/menu/games`, `/menu/games/snake`, `/menu/calculator`                          | what the stock game and calculator do                                             |
| `/menu/sim-services`, `/menu/sim-services/projects`, `/menu/sim-services/about` | the toolkit's items; projects with blurbs, years and links; the colophon          |

The sitemap is `/` plus these paths in stock order (only those `stockMenuFor` lists). The JSON-LD
Person and `pageHead` are unchanged. A test proves every `ROUTE_CONTENT` key is a stock path and
every indexable panel renders its content without a phone (SSR, jsdom).

**D15 - Old URLs: 301 to their new homes when the path left the tree; the 404 opens SIM services.**
`content/routes.ts` `REDIRECTS` (checked in `$.tsx`'s loader before `notFound`, `throw redirect({
to, statusCode: 301 })`):

| Old (siteMenu) path                           | New                             |
| --------------------------------------------- | ------------------------------- |
| `/menu/call-divert/github`, `/linkedin`, `/x` | `/menu/phone-book/search`       |
| `/menu/settings/phone-settings/lights`        | `/menu/settings/phone-settings` |
| `/menu/tones/warning-and-game-tones`          | `/menu/tones/warning-tones`     |

Every other siteMenu path is also a stock path, so it stays (content that moved, such as Call
register's work history, is pointed to from that path's panel; a redirect there would fight the
phone's own navigation). Task 0 commits the siteMenu path list as a fixture; a test proves every
legacy path is a stock path or a `REDIRECTS` key. An unknown URL is a 404 (`noindex`) whose panel
says "No service" with links, and steers the handset to `menu/sim-services` as VISION's 404 did
(Open question 10).

**D16 - Where the model breaks down (explicit list).**

| Content                              | Why no standard feature fits                                              | Fallback                                                             |
| ------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Project with a blurb and a link      | a contact holds a name and number; an SMS holds text but no callable link | SIM services › Projects: list → text page → `Open <name>?` call step |
| Colophon, longer than 160 characters | one SMS; concatenated SIM SMS are not supported (plan 30 D2)              | SIM services › About this site (a text page) → Source code call step |
| A link without a person (repo, CV)   | fits as a contact or service number whose call opens it                   | none needed (D10)                                                    |
| `mailto:` and downloads              | fit the same way                                                          | none needed                                                          |
| Lost URLs                            | a phone has no 404                                                        | SIM services (D15)                                                   |
| `rel="me"`, rich text, images        | an 84×48 phone shows none                                                 | the HTML panels only                                                 |
| Profile modes, missed-call jokes     | no stock feature holds them                                               | dropped (Open question 5)                                            |

**D17 - Dependencies are conditional, each with its fallback.**

| Needs                                                                           | From              | If it has not landed                                                                             |
| ------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| SIM messages, toolkit, `stockMenuFor`, `describeStockScreen`, `imei`, `preload` | plan 30 Tasks 4-9 | blocked (Tasks 2-6 build against them)                                                           |
| `dial` (calls), `*#06#`                                                         | plan 22 Task 8    | blocked for Task 6's cutover: without calls no link opens, a regression from today's Call divert |
| Reminders and `preload.reminders`                                               | plan 21 Task 11   | the "now" items become one SIM SMS; `/menu/reminders` is `noindex`                               |
| Chat                                                                            | plan 18c (Chat)   | `/menu/chat` shows the stock placeholder; its panel is `noindex` and points to Write messages    |
| Sender names                                                                    | plan 30 Task 5    | the Inbox shows Lachlan's number; the content's first SMS signs off `- Lachlan`                  |

**D18 - The website stops depending on `@hellotimber/snake` and phone-screen's layouts
(dependency rule).** `website/package.json` gains `@hellotimber/nokia-os` and drops
`@hellotimber/snake`; AGENTS.md's rule becomes `website ──▶ nokia-os, phone-core (types and
router bridge), phone-screen (renderer), phone-3d`; `vite.config.ts` adds nokia-os to
`ssr.noExternal` and drops snake. phone-core's website-only text entry and phone-screen's
website-only layouts are deleted where nothing else uses them (Task 8); the snake package stays
until Lachlan decides (Open question 11).

## Website contract changes

No package contract changes (plan 30 owns them). Task 1 rewrites:

- **VISION:** "The menu is the sitemap" table (D2/D14's homes and routes; standby ▼ = names,
  ▲ = dialled numbers, as v6.39 does); the Architecture diagram and table (website ──▶ nokia-os;
  "not consumed by the website yet" removed); the non-goal "The portfolio website simulating
  telephony … or SIM features" becomes "The website owns no telephony: nokia-os's ports carry SMS
  and calls to the website's adapters (LLM personas, links)"; "Router integration design": stock
  paths, redirects, the 404.
- **AGENTS.md:** the dependency diagram (D18).

## Website test files (23 today)

| File                                     | Fate                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `app-lifecycle-characterization.test.ts` | delete (website applications)                                                                  |
| `calculator-app.test.ts`                 | delete (stock Calculator, plan 20)                                                             |
| `chat-app.test.ts`                       | delete (stock Chat; `network.test.ts` covers replies)                                          |
| `composer.test.ts`                       | delete (website ringtones)                                                                     |
| `contacts.test.ts`                       | delete → `people.test.ts` (prompts, canned replies, numbers)                                   |
| `content.test.ts`                        | delete → `sim-content.test.ts` (D4)                                                            |
| `keyboard.test.ts`                       | keep                                                                                           |
| `menu-golden.test.ts`                    | delete (stock goldens live in nokia-os)                                                        |
| `menu-tree.test.ts`                      | delete                                                                                         |
| `messages-store.test.ts`                 | delete → `threads.test.ts`                                                                     |
| `object-applications.test.ts`            | delete                                                                                         |
| `panel-registry.test.ts`                 | rewrite (panels by `ROUTE_CONTENT`)                                                            |
| `paths.test.ts`                          | keep, plus `sim-services` shapes                                                               |
| `picker-app.test.ts`                     | delete                                                                                         |
| `pixel-art.test.ts`                      | delete (screensaver art)                                                                       |
| `router-sync.test.ts`                    | rewrite against a stock phone (`boot: "skip"`, memory storage)                                 |
| `screen-text.test.ts`                    | delete (`describeStockScreen` is tested in nokia-os); the mirror gets `screen-mirror.test.tsx` |
| `seo.test.ts`                            | rewrite (sitemap from stock paths, D14)                                                        |
| `settings.test.ts`                       | rewrite (mute only; old keys removed)                                                          |
| `site-tree.test.ts`                      | rewrite → `stock-routes.test.ts` (projection, redirects, legacy paths)                         |
| `sms-api.test.ts`                        | keep, plus 459-character input, ASCII rule, sanitising                                         |
| `sms-app.test.ts`                        | delete → `network.test.ts`                                                                     |
| `snake-app.test.ts`                      | delete (stock Snake II)                                                                        |

New: `network.test.ts`, `threads.test.ts`, `stock-sound.test.ts`, `host-clock.test.ts`,
`imei.test.ts`, `stock-phone.test.ts`, `stock-routes.test.ts`, `panels.test.tsx`,
`screen-mirror.test.tsx`, `people.test.ts`, `sim-content.test.ts`. Never mount an R3F `<Canvas>` in jsdom.

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` (repeat `mise exec -- vp fmt` until stable),
  `mise exec -- vp run website#test` and `mise exec -- vp run website#build`.
- Commit rule: `mise exec -- vp check --fix` yourself, then
  `git commit --no-verify -m "<message>" -- <paths>`. Never `git add -A`/`git add .`, never
  `git stash`. Never stage `TODOS.md`. Never edit `website/src/routeTree.gen.ts` or
  `pnpm-lock.yaml` by hand (`mise exec -- vp install` updates the lock).
- No dependency beyond `@hellotimber/nokia-os` (a workspace package).
- Never deploy. Task 9 prepares a deploy for Lachlan's approval.
- Parallelism (max 3 concurrent agents): Task 0, then 1. Then lanes A (2 → 5), B (3) and C (4).
  Task 6 needs 2-5; Tasks 7 and 8 need 6 and may run together; Task 9 needs 7 and 8.

## Tasks

### Task 0 - Legacy URL snapshot (TDD fixture; no runtime change)

**Files:** `website/tests/fixtures/legacy-paths.ts` (new), `website/tests/legacy-paths.test.ts`
(new, temporary: Task 6 replaces it).

- [x] Write `LEGACY_PATHS`: `siteMenu.paths()` plus `/`, as literal strings (generated once by a test
      that prints them; commit the literal list, not the generator).
- [x] A test asserts the literal list equals `siteMenu.paths()` today (so the snapshot is exact).
- [x] Commit: `test(website): snapshot the legacy menu URLs`.

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `AGENTS.md`, `docs/plans/README.md` (row 31), this plan.

- [x] VISION and AGENTS.md as "Website contract changes"; record D2's table in VISION's sitemap
      section.
- [x] Plans README: row 31 `in progress`. No runtime code. `mise exec -- vp check --fix`.
- [x] Commit: `docs: define the portfolio on the stock firmware (plan 31)`.

### Task 2 - Portfolio content in stock shape (TDD)

**Files:** `website/src/content/{people,links,sim-messages,toolkit,now,sim,routes}.ts` (new),
`website/src/content/{site,clock}.ts` (kept), `website/src/content/index.ts` (new exports),
`website/package.json` (`@hellotimber/nokia-os`), `pnpm-lock.yaml` (by `vp install`),
`website/tests/{sim-content,people}.test.ts` (new). The old modules and their tests stay until
Task 6 (they still feed `siteMenu`).

- [x] Re-check ACMA's list (D6); write the numbers.
- [x] TDD D4's rules first (`sim-content.test.ts` with an intentionally bad fixture for each rule), then
      the modules: `PEOPLE` (persona prompts and canned replies from `contacts.ts`, plus numbers),
      `LINKS` (name, number, href, label, `rel`, `download`), `SIM_MESSAGES` (D2's intros, roles,
      testimonials as `StockSimMessage`s from Lachlan's number, `sentAt` in September 2000),
      `TOOLKIT` (title `LACHLAN`; `projects` and `about`), `NOW` (reminder preloads), `PORTFOLIO_SIM`
      and its hashed id (D3), `PRELOAD`.
- [x] Rewrite the sample copy under D5; keep `SAMPLE DATA` markers.
- [x] `mise exec -- vp install`, `vp run website#test`, `vp check --fix`.
- [x] Commit: `feat(website): portfolio content as a SIM card`.

### Task 3 - The network port and the SMS API (TDD)

**Files:** `website/src/phone/network.ts` (new), `website/src/phone/threads.ts` (new),
`website/src/messages/generate-reply.ts`, `website/src/routes/api/sms.ts`,
`website/tests/{network,threads,sms-api}.test.ts`.

- [x] TDD `send` with a stubbed `fetch`: persona number → POST body (contactId, text, the last 12
      turns) → `deliver` called with the reply, the number and a Brisbane `sentAt`; thread updated
      both ways; other numbers → `"sent"`, no POST; a rejected fetch → `"failed"`.
- [x] TDD `dial` with stubbed `window.open`/`location.assign` and fake timers: a link opens before
      `dial` returns (synchronously), then `alerting`, `connected`, `released` after `LINK_CALL_MS`;
      `hangUp` cancels the release; persona numbers alert and release after `NO_ANSWER_MS`; others
      alert and connect.
- [x] Drive it through a real stock phone (`createStockPhone`, `boot: "skip"`, memory storage): ▼,
      GitHub, Navi → `window.open` called during that `send()`; Write messages to Lachlan → a reply in
      the Inbox (canned client).
- [x] TDD the API: 459 characters in, replies ≤160 and sanitised (D9), personas told "plain ASCII".
- [x] Commit: `feat(website): a network port for SMS personas and link calls`.

### Task 4 - Host adapters: sound, clock and IMEI (TDD)

**Files:** `website/src/phone/{stock-sound,host-clock,imei}.ts` (new),
`website/tests/{stock-sound,host-clock,imei}.test.ts` (new). Lights and mute are wired in Task 6
(they replace settings the old menu still reads).

- [x] Port the demo's `WebAudioSound` (D12): a fake `AudioContext` records scheduled values; buzzer
      and tone gains per register, `hz2` on a second oscillator, `hz: null` silences, scheduling
      offset, mute → master gain 0, the vibrator → `navigator.vibrate` (none when muted).
- [x] `host-clock.ts` with a fixed `Date`: `"HH:MM"`/`"DD.MM.YYYY"` in Brisbane across a UTC date
      change; the `sentAt` stamp.
- [x] `imei.ts`: 15 digits, Luhn-valid, stable per hash.
- [x] Commit: `feat(website): stock sound, clock and IMEI adapters`.

### Task 5 - Stock routes, redirects and the sitemap (pure, TDD; not wired)

**Files:** `website/src/phone/stock-routes.ts` (new), `website/src/content/routes.ts` (Task 2's,
filled here), `website/tests/stock-routes.test.ts` (new).

- [ ] TDD `projectStockRoute(path)`: titles from stock labels (lines joined by a space),
      descriptions and indexing from `ROUTE_CONTENT`, `null` for unknown paths; `indexablePaths()`
      in stock order; `redirectFor(path)`; `stockSitemapPaths()` = `/` + `indexablePaths()`.
- [ ] Every `ROUTE_CONTENT` key is in `stockMenuFor(PORTFOLIO_SIM).paths()`; every `LEGACY_PATHS`
      entry is a stock path or a `REDIRECTS` key; every redirect target is a stock path; D14's
      indexable set exactly.
- [ ] Commit: `feat(website): stock routes, redirects and sitemap paths`.

### Task 6 - Cutover to the stock firmware

**Files:** `website/src/phone/{stock-phone.ts,PhoneStageHost.tsx,router-sync.ts}`,
`website/src/components/{ScreenMirror,SoundToggle}.tsx`, `website/src/settings.ts`, `website/src/seo.ts`,
`website/src/routes/{_phone.tsx,_phone/$.tsx,_phone/index.tsx,sitemap[.]xml.ts}`,
`website/src/panels/{registry,GenericPanel}.tsx`, `website/vite.config.ts`, `website/package.json`
(drop `@hellotimber/snake`); deletions:
`website/src/content/{menu,phonebook,contacts,chat,call-register,divert,profiles,reminders,messages}.ts`
(what Task 2 superseded; `types.ts` keeps `SiteMeta` only), `website/src/phone/{phone.ts,applications/**,site-tree.ts,screen-text.ts,pixel-art.ts,tones.ts,composer.ts,audio.ts,notice-binding.ts}`,
`website/src/messages/store.ts`, every bespoke panel (Task 7 writes the new ones); the test files
the table marks delete or rewrite (`panels.test.tsx` and `panel-registry.test.ts` wait for Task 7);
`website/tests/legacy-paths.test.ts` (folded into `stock-routes.test.ts`).

- [ ] `stock-phone.ts` (D12): the runtime, power-on, reduced motion, T9, the adapters; one instance
      per session; `stock-phone.test.ts` creates it under jsdom with a stub `AudioContext` and checks
      the config passed (storage, sim, preload, imei, boot).
- [ ] `PhoneStageHost`: `paintStockScreen` renderer, lights → `backlightOn`/`keypadLightOn`,
      keyboard and 3D keys to `phone.send`, the first gesture starts audio.
- [ ] `settings.ts`: `muted` only (SoundToggle → the sound port's master gain); start-up removes the
      other `hellotimber.settings` fields and `hellotimber.messages`; `settings.test.ts` rewritten.
- [ ] `router-sync.ts` unchanged in design; `router-sync.test.ts` rewritten against a stock phone
      (URL → phone, phone → URL, echo suppression, `/menu/sim-services/projects`, standby
      applications keep `/`).
- [ ] `$.tsx`: projection from `stock-routes.ts`, `REDIRECTS` (301), the 404 (D15); every path
      renders `GenericPanel` over the stock entry (the standby route keeps its bio panel) until
      Task 7; `seo.ts`'s `SITEMAP_PATHS` = `stockSitemapPaths()`; `ScreenMirror` uses
      `describeStockScreen`.
- [ ] Delete the superseded files; `grep -rn "siteMenu\|phone/applications\|createPhone(" website/src`
      is empty.
- [ ] `mise exec -- vp run website#test`, `vp run website#build`, `vp check --fix`; run
      `mise exec -- vp run website#dev` and load `/`, `/menu/phone-book/search`, `/menu/sim-services/projects`,
      `/menu/call-divert/github` (301), `/nope` (404).
- [ ] Commit: `feat(website): run the portfolio on the stock firmware`.

### Task 7 - Content panels for the indexable paths (TDD)

**Files:** `website/src/panels/**` (new bespoke panels, the registry keyed by `ROUTE_CONTENT`'s
panel ids), `website/tests/{panels,panel-registry}.test.tsx` (new or rewritten), `website/tests/seo.test.ts`.

- [ ] TDD in jsdom, from content alone (no phone): each D14 panel renders its content (the contacts
      with their `href`, `rel="me"` and `download`; the SIM messages with `<time>` and sender names;
      the projects with blurbs, years and links; the "now" items; the colophon); `GenericPanel` lists
      a stock level's children as links.
- [ ] Every `ROUTE_CONTENT` panel id has a panel; every panel id is used.
- [ ] `seo.test.ts`: the sitemap lists D14's paths in stock order; noindex pages carry `robots`.
- [ ] `mise exec -- vp run website#test`, `vp run website#build`, `vp check --fix`.
- [ ] Commit: `feat(website): content panels for the stock routes`.

### Task 8 - Subtract package code only the website used

**Files:** `packages/phone-core/src/**` (text entry), `packages/phone-screen/src/**` (layouts),
their tests and READMEs, `VISION.md` (their contract sections), `pnpm-workspace.yaml` only if Open
question 11 says to delete the snake package.

- [ ] For each candidate, prove no consumer remains (`grep -rn` over `packages/` and `website/`):
      phone-core's `multitap.ts` and `EditorApplication` (plan 18 D2 kept them for the website);
      phone-screen's own screen layouts and `welcomeText` (plan 13: phone-screen becomes an LCD
      toolkit once the website paints with nokia-os). Delete what has none; record what still has a
      consumer and why.
- [ ] `mise exec -- vp run -r test`, `vp run website#build`, `vp check --fix`.
- [ ] Commit: `refactor: delete phone-core and phone-screen code only the old website used`.

### Task 9 - Headless QA, verification gate and closeout

**Files:** `docs/plans/README.md`, this plan (completion notes), `website/README.md` if it exists
(deploy notes).

- [ ] `mise exec -- vp check`, `vp run -r test`, `vp run website#build`; report the client bundle's
      gzip size against `main` (no gate; record it).
- [ ] Headless QA with `agent-browser` against `mise exec -- vp run website#dev`, reading the
      `[role=status]` mirror (boot ≈5 s; Enter, arrows, Escape, digits). Record each result: 1. `/` boots to standby (`LACHLAN`, the Brisbane time); reduced motion skips the boot. 2. ▼ opens the name list; ▼ to GitHub; Enter (`Call`) opens a new tab on GitHub; the mirror
      shows `Calling`, the connected screen, the end, the list. 3. Menu 2 2: the Inbox lists the SIM messages; reading one shows its text and `Sender:`
      (Lachlan, or the number per D17). 4. Write messages to Lachlan (via Options › Send › Search): `Message sent`, then a reply in
      the Inbox (canned without `ANTHROPIC_API_KEY`). 5. Menu 13: Projects › a project › its text page › OK › `Open <name>?` › OK opens the project. 6. `*#06#` shows the IMEI. 7. Deep links: `/menu/phone-book/search` and `/menu/sim-services/projects` load on that screen;
      Back/Forward keep phone and URL aligned. 8. `/menu/call-divert/github` answers 301 to `/menu/phone-book/search`; `/nope` answers 404
      and the handset shows SIM services. 9. Persistence: Add name `Zoe`, reload, the name is there; `localStorage` holds only
      `nokia-os/…`, `hellotimber.threads`, `hellotimber.settings` (`muted`) and `theme`. 10. View source of `/menu/phone-book/search`: the contacts' links are in the HTML.
- [ ] Deploy readiness (no deploy): Vercel builds from `main` through Nitro (no `vercel.json`);
      `ANTHROPIC_API_KEY` set in the project; `BUILD_HASH` set for the IMEI. Write the steps and ask
      Lachlan for approval to merge and deploy.
- [ ] Plans README: row 31 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete the portfolio on the stock firmware (plan 31)`.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **A new SIM per content change (D3):** returning visitors see new content; their edits and
   replies stay with the old SIM. Reverse: a fixed SIM id (new content reaches only new visitors).
2. **Projects in SIM services (D2, D16):** a list with blurbs and an `Open` call. Reverse: projects
   as phone book contacts (call opens them) with blurbs as SMS.
3. **Work history as SMS (D2):** one SMS per role from Lachlan. Reverse: SIM services › Work history.
4. **Testimonials as quoted SMS from Lachlan (D2):** `CTO@Acme: …`. Reverse: SMS from the givers'
   own (fiction) numbers, in the phone book or not.
5. **Missed-call jokes and profile modes dropped (D2).** Reverse: one SMS each.
6. **No Welcome note (D2):** the boot shows the hands. Reverse: the tagline (≤36 characters) as a
   preloaded Welcome note, shown for ≈5 s instead of the hands.
7. **Preload once (D7):** reminders are written for new phones only. Reverse: tie them to the SIM id
   (a new SIM rewrites them, overwriting a visitor's reminders).
8. **Link calls (D10):** connect, open the tab, end after 1.5 s with the network's end beeps.
   Reverse: end at once (no connected screen) or stay connected until End.
9. **No incoming calls (D11).** Reverse: the website rings the visitor once (e.g. after a minute)
   through `subscribeCalls`, with Lachlan's name.
10. **The 404 (D15):** a 404 page that steers the handset to SIM services. Reverse: the handset stays
    where it is (a phone has no 404).
11. **The snake package (D18):** kept, unused by the website. Reverse: delete it in Task 8.
12. **T9 before the phone (D12):** the phone waits for the T9 chunk (≈117 kB gzip), loaded beside
    the 3D model. Reverse: start without T9 (multi-tap) and never switch.
13. **No letter keyboard:** desktop letters do not type multi-tap. Reverse: map letters to their
    multi-tap key sequences (a convenience a real phone does not have).
14. **Phone time is Brisbane's (D12):** the visitor sees Lachlan's time. Reverse: the visitor's own.
15. **Service Nos. holds Source code (D2).** Reverse: an empty Service Nos. (the stock note).

## Conflicts found while planning

- VISION's sitemap table maps Call register to work history, Chat to testimonials, Call divert to
  external profiles and standby ▲ to the phone book; the stock firmware gives those menus their own
  behaviour (D2) and v6.39's ▼ opens the names (plan 19 S1). Task 1 rewrites the table.
- VISION's non-goal "simulating telephony … or SIM features" on the website: the website now backs
  nokia-os's ports (Task 1 narrows it).
- AGENTS.md: "website ──▶ phone-core, phone-screen, phone-3d, snake (not nokia-os yet)" (D18).
- Plans 18, 18c, 19, 21 and 22 each say "the website does not change" and leave "portfolio
  integration (not sequenced)" as a follow-up: this plan is that follow-up; their follow-up notes are
  satisfied here (D9 replaces `applications/{sms,chat}.ts`; Task 8 deletes phone-core's multitap).
- The website's `/menu/sim-services` was a stub reader with the IMEI; it becomes the SIM's toolkit,
  and the IMEI moves to `*#06#` (D12).

## Done means

- The website runs `createStockPhone` with `paintStockScreen`; `siteMenu`, the website applications
  and the website painter use are gone.
- Every content item has the stock home D2 gives it; calling a link contact, a service number or a
  toolkit call step opens its URL; texting or chatting with a persona brings an LLM (or canned)
  reply as an SMS.
- URLs mirror stock paths; indexable panels are server-rendered; the sitemap lists D14's paths;
  legacy URLs redirect or still resolve; unknown URLs 404 to SIM services.
- `vp check`, `vp run -r test` and `vp run website#build` pass; the headless QA list passes; VISION,
  AGENTS.md and the plans README match what shipped; a deploy waits for Lachlan's OK.

## Implementation notes (2026-10-29)

- Tasks 0-1: captured all 66 legacy URLs as literals, including `/`; the equality test
  failed with an incomplete fixture before passing with the captured list. Runtime unchanged.
- The website contract now permits nokia-os. The existing snake dependency remains until
  Task 6, as the ordered plan requires. VISION distinguishes the target from the runtime
  still running before that cutover.
- Preserve the 2001 desk through the cutover. Task 6 must also migrate `desk/live.ts`
  (runtime and breadcrumbs), its screen-text consumers and the Lights control to stock
  state; leaving the desk on deleted adapters would break the build and live controls.
- Plan 18c remains in progress, but `features/chat.ts` already binds node 3 to `chatScreen`.
  Use that implementation through the network port; do not classify Chat as a placeholder
  solely because the broader plan is in progress. Verify actual Chat integration in Tasks
  3 and 9. No change to Games is part of this batch.

### Task 2 delivery (2026-10-29)

- Added the stock-shaped content without wiring it into the website runtime. The desk,
  its controls, and the single phone mount remain on the working legacy runtime until Task 6.
- Re-checked ACMA's creative-works list:
  https://www.acma.gov.au/phone-numbers-use-tv-shows-films-and-creative-works.
  Personas use 0491 570 006 / 156 / 157; links use 07 5550 xxxx.
- Preserved existing sample projects, employers and quotes. The phone bio, roles and quotes
  explicitly say SAMPLE; the sample testimonial replies share one additional SMS. Ten seeded
  messages leave exactly five slots for replies. The fictional bio fits in one SMS.
- Projects with URLs use toolkit calls; Source code uses the existing sample repository URL
  through Service Nos. and About. No real repository URL or CV asset was invented. The two
  placeholder project URLs share their corresponding link numbers.
- Shortened the three existing now notes to the stock 35-character limit and preloaded them
  without alarms. No Welcome note replaces the boot animation. Reminders preload is landed,
  so D17's fallback SMS is unnecessary.
- Used FNV-1a over UTF-8 JSON for the SIM identity, with an independent `{}` test vector.
  Route metadata is reserved in routes.ts for Task 5; legacy content stays until Task 6.
- TDD: the new suites failed before their modules existed, then passed after implementation.
  Fourteen deliberately bad fixtures cover stock validation and portfolio constraints.
- Runtime tooling: direct `mise exec -- node -v` reports 22.22.3, but Vite+ task subprocesses
  inherited host Node 26. Run the workspace-local Vite+ entry with the absolute mise Node 22
  executable and `SHELL=/bin/sh`, with PATH limited to that Node directory, /usr/bin and /bin.
  This also avoids the host's global tool wrapper and its missing-jsdom virtual store.
- `vp install` regenerated the lockfile and refreshed existing `latest` catalog resolutions;
  the only added dependency is the authorized nokia-os workspace package.
- Chat: no new 18c dependency in Task 2. Tasks 3 and 9 must still verify the landed Chat
  implementation through the new network port; Task 6 must migrate desk/live.ts and document
  the new runtime in website/DESIGN.md and PRODUCT.md. Games remains outside this batch.
- QA: this worktree's dev server uses port 3001 (3000 is occupied). All 66 captured legacy
  URLs returned HTTP 200; report: /tmp/plan31-task2-legacy-urls.json. Headless agent-browser
  read the status mirror: `Standby. LACHLAN. 16:28. Press Menu.` Screenshot:
  /tmp/plan31-task2-desk.png. Waking the legacy screensaver then pressing the desk NaviKey
  produced `Menu 1. Phone book, 1 of 13.` (/tmp/plan31-task2-menu.png). This is legacy-runtime
  regression evidence, not stock cutover QA.
- Website validation: 27 test files, 198 tests passed; production build passed. Tasks 3-9
  remain outstanding; this delivery completes Task 2 only.

- Final Task 2 gate: `vp check` passed; `vp run -r --no-cache test` exited 0 with
  276 test files, 11,941 passed tests, 120 expected failures and 161 TODOs. Stock firmware
  accounted for 11,081 passed, 120 expected failures and 161 TODOs (798 seconds);
  website accounted for 198 passed. No firmware or Games files were modified.
- The settled phone-book deep link mirror reads `Menu 1 then 1. Search. Email, 1 of 7. Select.`;
  screenshot: /tmp/plan31-task2-phonebook.png. The agent-browser QA session was closed.

### Task 3 delivery (2026-10-29)

- Added the network port without changing the mounted legacy runtime. Link calls open
  synchronously; HTTPS uses noopener/noreferrer, mail uses location.assign, downloads use
  a temporary anchor. Link calls connect for 1500 ms; persona calls release unanswered
  after 30 seconds; emergency calls retain the synthetic network's no-connect behavior.
- SMS settles sent on successful HTTP headers; JSON reply delivery is asynchronous.
  A failed POST is failed; a body that fails after acceptance cannot retract a sent SMS
  and produces no incoming reply. Threads keep twelve turns per SIM and number, tolerate
  blocked/corrupt storage, and live under hellotimber.threads.
- API uses PEOPLE, accepts 459 characters, requests ASCII and sanitises punctuation and
  unsupported small-face glyphs before the 160-character reply limit. No real copy added.
- Preserved cannedReply's narrow canned-data contract while legacy menu.ts still uses it;
  requiring a stock persona number there would break the pre-cutover runtime.
- TDD: missing network/thread modules, the former input limit and Unicode replies failed
  first. Website: 29 files / 209 tests pass; vp check --fix and production build pass.
- Public createStockPhone key tests prove GitHub opens inside send(), Write messages
  delivers a canned reply into Inbox, and landed Chat sends A: Hi and renders the reply.
  No Task 3 work waits on 18c. Full browser cutover QA remains for Tasks 6 and 9.

### Task 4 delivery (2026-10-29)

- Added a gesture-started WebAudio adapter with the demo's register-to-gain mapping,
  30 ms scheduling headroom, square buzzer and two sine voices for DTMF. A single tone
  and tone-off silence the second voice. Mute changes master gain, stops vibration,
  and prevents queued on events from restarting vibration while muted. Browser vibration
  is renewed until the firmware turns it off; no browser vibration support is required.
- Unified SMS timestamps and the future phone clock on one Brisbane formatter. UTC
  date-boundary and midnight cases are pinned. IMEI uses 35 + a twelve-digit padded
  FNV-1a hash + a Luhn check digit, deterministic for a build hash.
- These adapters are not mounted until Task 6. No desk controls or Games code changed.
- TDD: all three new adapter suites failed for absent modules before implementation;
  website suite, production build and vp check --fix pass (final totals below).
