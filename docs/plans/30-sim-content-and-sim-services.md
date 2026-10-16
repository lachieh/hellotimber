# Plan 30 - SIM content and SIM services

> **Fidelity standard (2026-10-15):** `AGENTS.md` "Fidelity standard" governs every comparison in
> this plan.

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, the spec or the code, STOP and report.

**Prerequisites:** plans 13-18, 18b and 23 done. Plan 19 done (`StockSimCard`, `StockContact`,
`StockPhoneBook`, the `phone-book` record and its persistence rule). Plan 22 through its Task 8
(`StockTelephone.dial`, `StockNetworkPort.dial`, the Calling flow, `*#06#`) before Task 7's SET
UP CALL and Task 8's IMEI; plan 21 through its Task 11 (`StockReminders`, `REMINDERS_RECORD`)
before Task 8's reminder preload; plan 18c's Chat (D8) for Task 5's chat sender names. Each use
is conditional and names its fallback (D15). The per-plan file split has landed.
**Structural convention:** acceptance tests in `packages/nokia-os/tests/acceptance/30-sim-content.test.ts`;
behaviour in `packages/nokia-os/src/firmware/features/sim-services.ts` (new) plus pure modules
under `src/sim/`; the capture set in `packages/nokia-os/scripts/capture-sets/30-sim-content.ts`
(goldens indexed in `goldens/index/30.json`); spec facts in `docs/specs/stock/sim-services.md`.
Shared files change by one-line registrations except the edits listed under "Shared-file edits".
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only): plan
18's SMS goldens and `captures/6.39/plan18/`, plan 19's SIM fixtures (`captures/6.39/plan19/sims/`)
and the canonical captures Task 0 writes to `$REF/captures/6.39/plan30/`. The emulator SIM has no
SIM Toolkit; Task 0 adds one to the harness (D4). Read `$REF/captures/README.md`, plans 18, 19 and
22 in full, and `tools/nokia-dct3-emulator/third_party/swsim/README.md` before starting.
**Status:** in progress (Task 0 done; Task 1 applies its outcome).

## Goal

Give `@hellotimber/nokia-os` the stock v6.39 features a host needs to supply its own content
through the SIM card, the way an operator's SIM did in 2000, so a host (plan 31's portfolio)
writes data and implements nothing else:

- **SMS stored on the SIM** (`EF_SMS`): host-supplied messages appear in the Inbox, read or
  unread, with their sender and service-centre time stamp, in a SIM of the host's capacity;
- **sender names**: an SMS from a number in the phone book is listed and read under that name, as
  the firmware does (Task 0 N; plan 18 lists numbers only);
- **SIM services** (Menu 14, Task 0 K; planned as 13): present only when the SIM has a SIM Toolkit menu (`SET UP MENU`);
  its items open the SIM's screens through stock widgets: text pages (`DISPLAY TEXT`), item lists
  (`SELECT ITEM`) and calls the SIM asks to place (`SET UP CALL`), which go out through plan 22's
  network port, so a host maps a number to whatever it wants (plan 31: a link);
- **host identity and preload**: the phone's IMEI for `*#06#`, and a documented **preload** of
  phone-memory content a user could have typed (Welcome note, Reminders), applied once when the
  record does not exist;
- **glyph and size validation** of every host string at creation, by the face that draws it;
- **screen text for hosts**: a plain-text description of every screen, including the stock
  widgets' `custom` frames, for a host's accessibility mirror and headless QA;
- goldens for everything the emulator can show, composed flows (UNVERIFIED) only where it cannot.

The website does not change (D16). Plan 31 consumes this plan.

## Why this plan exists (measured gap)

| Area                        | nokia-os after plans 13-22                                                                    | v6.39 / GSM evidence                                                                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Messages on the SIM         | Inbox holds only what arrives over the network port (plan 18); the SIM card carries no SMS    | GSM 11.11 `EF_SMS` (6F3C) holds received messages with a status byte (read/unread); the emulator SIM has 15 records (plan 18 S14) and the 3310 reads them (plan 18 D7: 15 shared slots)                |
| Sender names                | Inbox and `Sender:` show the number                                                           | Nokia phones of the period show the phone book name for a known number (UNVERIFIED for v6.39; Task 0 N)                                                                                                |
| SIM services                | absent; the stock tree has 12 entries (`nokia-3310-menu-tree.md` "Hidden": 13 needs STK)      | firmware main-menu table entry 14 with a dynamic label and its own 15-frame icon (`extracted/6.39/menu/main_menu.json`); strings `SIM services` 0x3f2, `Allow SIM card to call?` 0x3ec, `Enter:` 0x3ef |
| Confirm SIM service actions | 6-2-6 stores `Asked`/`Not asked` and nothing reads it                                         | the setting that decides whether a SIM's send/call requests are confirmed (strings 0x3f3-0x3f9)                                                                                                        |
| `*#06#`                     | `Serial No.` with `?` glyphs (plan 22 S8: the virgin EEPROM has no IMEI)                      | a real phone shows its IMEI; plan 22 Open question 8 reserves a host IMEI                                                                                                                              |
| Phone-memory content        | a host can only reach the Welcome note or Reminders by typing them                            | a used phone carries them; no SIM file holds them                                                                                                                                                      |
| Host screen text            | `custom` frames are pixels only; the demo's status line shows the screen kind and application | plan 31's `[role=status]` mirror must say what a note, list or editor shows                                                                                                                            |

## Planning investigation (2026-10-15)

Desk research only; no capture was run. Task 0 captures everything.

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Evidence                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| R1  | **The emulator's SIM can run a SIM Toolkit, switched off.** swSIM ships proactive scaffolding (`src/proactive.c`: `SET UP MENU`, `SELECT ITEM`, `DISPLAY TEXT`, `SET UP CALL`, `GET INPUT`, …; a default applet). `sim_swsim.c` keeps `app_default_enable = false` because the 3310's `TERMINAL RESPONSE` under the GSM class (`A0 14`) hits the same GSM-CLA gap the README's other local patches closed, and the session loops.                                                                    | `third_party/swsim/{sim_swsim.c:32-36,README.md,include/proactive.h}` |
| R2  | **The 3310 announces toolkit support at boot**: it sends `TERMINAL PROFILE`, which the harness answers `90 00` and ignores. Its bytes say which proactive commands v6.39 implements; nobody has recorded them.                                                                                                                                                                                                                                                                                       | `src/mad2/mad2_sim.c:772`, swSIM README patch 1                       |
| R3  | **Firmware strings name the toolkit screens** (cross-check only): `SIM services` 0x3f2, `Confirm SIM service actions` 0x3f3 with `Not asked`/`Asked`, `Valid length from %0N to %1N`, `Enter:` and its `(one character)`, `(one digit 0-9)`, `(number)` variants (GET INKEY/INPUT), `Allow SIM card to call?`, `Allow SIM card to send a message?`, `Allow SIM card to send a request to the network?`, `Allow SIM action?`. No browser string: there is no `LAUNCH BROWSER` on a phone without WAP. | `extracted/6.39/text/english.txt` 0x3ec-0x3f9                         |
| R4  | **SIM services is the hidden 14th main-menu record**: label "dynamic text" (not the 0x3f2 string), icon records 212-226. The label is probably the SIM's `SET UP MENU` alpha identifier; UNVERIFIED.                                                                                                                                                                                                                                                                                                 | `extracted/6.39/menu/main_menu.json` entry 14                         |
| R5  | **The emulator SIM's files**: `EF_SMS` 6F3C (15 records), `EF_LND` 6F44 (last numbers dialled), `EF_SDN` 6F49 (plan 19's service numbers), `EF_SST` 6F38 (the service table that must allocate the toolkit). Plan 19's `tools/sim.py` already writes SIM fixtures from `gsm.json`.                                                                                                                                                                                                                   | `third_party/swsim/gsm.json`, `captures/scratch-plan19/NOTES.md`      |
| R6  | **Plan 18's messages record is per SIM identity** (`{"sims":{"sim-1":{"inbox":[…]}}}`) and plan 19's phone book reads the host's entries only while the record holds no copy of that SIM. SIM messages fit the same rule with no new record.                                                                                                                                                                                                                                                         | `packages/nokia-os/README.md` "Records", plan 19 D3                   |
| R7  | **Reminders and the Welcome note are phone memory** (plan 21's `reminders` record, plan 15's settings key `settings/phone-settings/welcome-note`). No SIM file carries them, and there is no SIM file for alarms or call lists other than `EF_LND`.                                                                                                                                                                                                                                                  | plan 21 D7, plan 15 D2, GSM 11.11 file list                           |

## Scope and non-goals

In scope: the Goal items; public nokia-os contract additions (D2, D3, D5, D9, D10, D12); a harness
addition and captures; goldens, glyphs, sprites, timelines; composed flows where captures cannot
exist; documentation.

Out of scope (owner in brackets): what a host does with a number it is asked to dial (the host;
plan 31 maps numbers to links); `GET INKEY`, `GET INPUT`, `PLAY TONE`, `SEND SHORT MESSAGE`,
`SEND SS`/`USSD`, `SET UP EVENT LIST`, `REFRESH`, `PROVIDE LOCAL INFORMATION`, timers and every
other proactive command (not sequenced, D4); `LAUNCH BROWSER` (the 3310 has none, R3); SIM data
download and cell broadcast; call-register seeding (D8); templates, pictures and the phone book's
own screens (18c, 19); any website change (31).

## Decisions

Each decision states what changes relative to plans 13-22 and the brief.

**D1 - Host content goes where the real phone kept it (the brief's rule, made concrete).** A host
supplies content in one of three places, chosen per item by where a v6.39 phone stored it:

| Content                                  | Where a 3310 keeps it           | This plan                                      |
| ---------------------------------------- | ------------------------------- | ---------------------------------------------- |
| contacts, service numbers                | SIM `EF_ADN`, `EF_SDN`          | plan 19's `StockSimCard` (unchanged)           |
| received SMS                             | SIM `EF_SMS`                    | `StockSimCard.messages` (D2)                   |
| SIM services menu and screens            | the SIM's toolkit applet        | `StockSimCard.toolkit` (D3)                    |
| IMEI                                     | the phone                       | `StockPhoneConfig.imei` (D9)                   |
| Welcome note, Reminders                  | phone memory, typed by the user | `StockPhoneConfig.preload`, applied once (D10) |
| missed/received calls, durations, alarms | phone memory, made by events    | none: a host cannot fake events (D8)           |

**D2 - SMS on the SIM (`EF_SMS`, contract change).** `StockSimCard.messages` holds the SIM's
message slots (`slots`, default 15, the emulator SIM) and the received messages in them (sender,
text, service-centre time stamp, `read`). Until the `messages` record holds a copy of that SIM's
inbox (plan 18 D7, plan 19 D3's rule), the Inbox shows the host's messages; the first write (a
read flag, an erase, an arrival) stores the whole inbox under the SIM's identity. Unread SIM
messages light the standby envelope and, at power-on, show what Task 0 M records (a notice or the
envelope only). Text must be one SMS: GSM 7-bit default alphabet only, at most 160 septets (the
extension table's characters count two), and drawable in the small face; the sender is a number
(`+` and 1-20 digits). An SMS needing UCS-2 or concatenation is refused at creation (Open question
6). Whether the capacity follows the SIM's record count is Task 0 M's (slots 10, 15 and 30); if the
firmware caps it, `slots` above the cap throws.

Deviation (Task 1, from Task 0 M): capacity follows the SIM (no cap at 30), so `slots` is any
positive integer. A message's slot matters (the Inbox order and the slot an arrival takes), so
`entries` is by slot like plan 19's phone book (index 0 = slot 1, `null` = a free slot). The Inbox
lists unread messages first, then read ones, each in slot order (time stamps play no part); the
order is taken when the Inbox opens (plan 18's list keeps its order while open). An arrival or a
Save takes the first free slot; Inbox and Outbox share the slots. Power-on with unread SIM
messages shows only the standby envelope (no notice, no tone). Reading and Erase persist (on the
SIM in the firmware; in nokia-os, D14's stored copy); Restore factory settings keeps them. The
extension table counts two septets; its `[ ] { } ~ | ^` draw as `?` (`€` and `\` draw), so they
are accepted and shown as the firmware shows them. Details' `Message centre:` is the record's
service-centre address: `StockSimMessage.centre` (default `""`, UNVERIFIED blank line; the
fixtures' `+123456789`).

**D3 - SIM services is the SIM's toolkit menu, declared as data (contract change).**
`StockSimCard.toolkit` describes what the SIM applet would send: the `SET UP MENU` title and items,
and for each item what the SIM does when it is chosen, as a small tree of steps: show text
(`DISPLAY TEXT`), offer a list (`SELECT ITEM`), ask to place a call (`SET UP CALL`). nokia-os plays
the applet: choosing an item runs its steps as a proactive session through stock widgets and ends
it (`END SESSION`) where the tree ends. A SIM with no `toolkit` (the default) shows no Menu 13,
so every plan 13-22 golden is unchanged. Considered: a host callback applet (`select(id,
session)`, the real envelope/proactive model): it lets a host do anything at any time, cannot be
validated at creation or listed for routes and sitemaps, and no portfolio need asks for it.
Rejected for now; the data form is a subset a callback form could later run.

Deviation (Task 1, from Task 0 K): a text step has `clear?: "user" | "delay"` (`DISPLAY TEXT`'s
qualifier: wait for the user, the default, or clear itself after ≈3.58 s); a `select` step's
`title` is SIM data the 3310 does not draw. A SIM with a toolkit is a phase 2+ SIM: v6.39 sends
its `TERMINAL PROFILE` only to one (`EF_PHASE` 03), so nokia-os's toolkit implies it.

**D4 - Three proactive commands, captured on a patched SIM (scope; fidelity).** Task 0 enables
swSIM's proactive layer in the harness (a build-copy patch closing the `A0 12`/`A0 14` GSM-CLA gap,
`EF_SST` allocating the toolkit, and a scripted applet `CAP_STK=<script.json>`), records the 3310's
`TERMINAL PROFILE` and captures `SET UP MENU`, `DISPLAY TEXT`, `SELECT ITEM` and `SET UP CALL` as
the phone draws them. If the harness cannot complete a proactive session, the screens are
**composed** from stock widgets (plan 15 D8 and plan 18 D14's policy: `COMPOSED_FLOWS`, each
UNVERIFIED, firmware strings as cross-check only): the level as a stock rows list with the
captured rows window, text as plan 14's text pages in the small face with `OK`, a list as an
option list with `Select`, and the call confirm as a confirm query `Allow SIM card to call?`. The
carousel icon has no capture then: it is a known gap with a clean-room icon drawn for the plan
(policy: `AGENTS.md`, plan 18c "Content policy"), never cropped from `$REF/extracted`. The other
proactive commands are not sequenced (Open question 4).

Deviation (Task 1, from Task 0 K0): the harness completed sessions at the first attempt, so the
carousel entry, its icon, the level, text pages and lists are asserted from captures. Only `SET UP
CALL` never completes in the emulator (the phone fetches it and freezes on a blank `OK` screen):
the call confirm is the one composed flow (`Allow SIM card to call?`, or the step's `confirm`, as
a confirm query; UNVERIFIED). No clean-room icon is needed.

**D5 - SIM services in the menu (contract change: `stockMenuFor`).** The menu depends on the SIM,
so `stockMenu` (the emulator SIM's 12 entries, unchanged) gains a sibling,
`stockMenuFor(sim: string | StockSimCard): PhoneMenu`, which validates the SIM (D12) and appends
Menu 13 when it has a toolkit. Its slug is `sim-services`; each `SET UP MENU` item is an entry
`menu/sim-services/<id>` (the host's kebab-case `id`, the stable route key) in the presentation,
numbering (`13-n`), soft key and opening selection Task 0 K records; a `SELECT ITEM` list or text
page inside an item is that entry's application state and has no path (VISION: deep state stays
phone-internal). `createStockPhone` uses `stockMenuFor(config.sim)`. The carousel label is what
Task 0 K shows: the toolkit's title if v6.39 uses the alpha identifier (R4), else `SIM services`.

Deviation (Task 1, from Task 0 K): SIM services is **Menu 14** (its counter reads `14`; there is
no 13, so `Menu 1 3` is `Invalid shortcut` and `Menu 1 4` opens the level); its carousel slot is
the 13th of 13 (▲ from Phone book wraps to it, ▼ from it wraps to Phone book). The label is the
`SET UP MENU` alpha identifier in the carousel's large face, as many words as fit its one line
(`Portfolio menu` shows `Portfolio`). The icon (a SIM card and a hand) animates 11 frames and
settles at ≈3.8 s, restarting on every reveal. The level is a three-row rows list with the rail,
soft key `OK`, **no title and no menu number**, opening on item 1; a label wider than its row is
cut to the characters that fit before ` ...` (`Sixteen char ...`). The items' paths stay
`menu/sim-services/<id>` (their numbers `14-n` are phone-core's only: the screen draws none).

**D6 - SET UP CALL goes through plan 22 and is dialled inside the confirming key's event
(contract rule).** A call step shows the confirmation Task 0 K records (with the step's alpha
identifier if it has one; Settings › Phone settings › Confirm SIM service actions decides only what
Task 0 C shows it decides) and, on OK, enters plan 22's Calling flow with the step's number, so
the call reaches `StockNetworkPort.dial` and the call register as any call does. **Rule (pinned by
a test, for this flow and plan 22's):** the phone calls `dial` synchronously inside the `send()` of
the key event that places the call, so a browser host keeps the user activation it needs to open
a window. If plan 22 places calls later than its key event, Task 7 records the Deviation in plan
22 and moves the port call (not the screens) to the key event.

Deviation (Task 1, from Task 0 K and D15): no `SET UP CALL` screen exists (the emulator never
completes one) and Confirm SIM service actions changed nothing Task 0 could see, so the confirm is
composed (D4) and ignores the setting (UNVERIFIED). Plan 22 has not landed, so the confirmed call
goes through one seam, `ToolkitDial` (`src/sim/session.ts`): the phone binds it to plan 22's
`StockTelephone.dial` when that lands (one line in `features/sim-services.ts`); until then it
opens plan 22's placeholder. D6's rule is pinned on the seam: it is called inside the confirming
key's `send()`.

**D7 - Sender names from the phone book (behaviour; Task 0 N).** If Task 0 N shows v6.39 naming a
known sender, the Inbox list, `Sender:`, Details, the received notice (if it names anyone) and
Chat's `>` lines use `StockPhoneBook.byNumber` with the comparison Task 0 N records (exact digits,
or the last n digits). If it does not, nothing changes and D7 is recorded as a finding.

Deviation (Task 1, from Task 0 N): v6.39 names known senders in the Inbox list, `Sender:` (the
name line, then the number line) and Details; the received notice names nobody and Chat opens
`Chat name:` empty, so neither changes. Two numbers match when their last 9 digits are equal, or
all digits of the shorter one when it has fewer than 9; `+` and leading digits beyond those are
ignored. `StockPhoneBook.byNumber` takes an exact match first, then the first entry in SIM order
that matches so (plan 22's caller names get the same rule). Known gap: when two entries share
their last 9 digits the firmware names only some senders (Task 0 N's Bob/Intl case); nokia-os
names the first.

**D8 - No call-register or event seeding (decision).** Missed, received and dialled calls,
durations and alarms record events the phone saw; a host that wants them plays the events (plan
22's synthetic network rings and dials). The only SIM-borne call data is `EF_LND`: if Task 0 L
shows v6.39 listing `EF_LND`'s numbers under Dialled numbers, `StockSimCard.lastDialled` supplies
them under plan 19 D3's persistence rule; if the firmware keeps its own list (plan 22 D13), the
field does not exist.

Deviation (Task 1, from Task 0 L): v6.39 never reads or writes `EF_LND` (no APDU selects 6F44;
Dialled numbers stays `No numbers` with three numbers in it). `StockSimCard.lastDialled` does not
exist and the D1 table's `EF_LND` row is dropped.

**D9 - The phone's IMEI (contract change; completes plan 22 Open question 8).**
`StockPhoneConfig.imei?: string`, 15 digits with a valid Luhn check digit (throws otherwise).
`*#06#` shows it in the layout Task 0 I captures (an IMEI written to a disposable image), else in
plan 22's captured `Serial No.` layout with the digits in place of the `?` glyphs (composed,
UNVERIFIED). Absent: plan 22's virgin screen.

Deviation (Task 1, from Task 0 I): captured with the emulator's one writable IMEI
(`490154203310018`): `Serial No.` over the first ten digits and the last five
(`4901542033` / `10018`). Plan 22's `*#06#` has not landed (D15): `imei` is validated and kept,
`stockImeiLines(imei)` gives the two lines, and the `sim/imei-*` goldens are `pending:22` until
plan 22's screen shows them.

**D10 - Preload: phone memory a user could have typed, applied once (contract change).**
`StockPhoneConfig.preload?: { welcomeNote?: string; reminders?: readonly StockReminderPreload[] }`.
When the phone is created and the record that holds an item does not exist in storage (`settings`
without the welcome-note key; no `reminders` record), the item is written as if typed: the Welcome
note through plan 18's key, reminders through plan 21's `StockReminders.add` in order (text and an
optional alarm date and time). An existing record is never touched, so a visitor's edits survive
and Restore factory settings behaves as plan 15/21 decided. Every preloaded string must be
typeable (plan 18's `TYPEABLE`) and within its editor's limit (Welcome note 36, reminder text plan
21's limit, at most plan 21's capacity), and drawable; anything else throws. Without plan 21 Task
11, `reminders` throws `preload.reminders needs plan 21` (D15).

Clarified (Task 1): "the record does not exist" is the storage key, not a value in it: Erase of
the Welcome note clears the key inside an existing `settings` record, so a preloaded note does not
come back after Erase. Plan 21 has not landed: a non-empty `reminders` throws as stated.

**D11 - Screen text for hosts (contract change).** `describeStockScreen(screen: ScreenModel):
string` describes any snapshot's screen in plain English: standby (operator, clock, profile line,
notice and soft key), the carousel (label and menu number, `Menu 14`), levels (selected row or page and its
value, soft key), and every stock widget's `custom` frame from the widget model that painted it
(a note's lines, a list's selected row and position, an editor's text and counter, a prompt's label
and entry, the name list's entry, call screens). Each widget model kind gets a describer; an
exhaustive switch makes a new kind without one a type error. The description is attached to the
frame object (a module `WeakMap` from frame to text), so snapshots and their equality do not change
and phone-core does not change. It is accessibility and QA text, not pixels: no golden asserts it.

**D12 - Every host string is validated at creation, by the face that draws it (extends plan 19
D2).** `normaliseSim` (plan 19) also validates `messages` (D2), `toolkit` (labels and titles in the
faces Task 0 K shows drawing them, a label width or length limit as measured, text pages in small,
numbers per plan 19's rules, ids kebab-case and unique among siblings, at most 255 items per list
and a depth limit of 4), and `createStockPhone` validates `imei` and `preload`. A bad value throws
naming the field path and the characters `missingStockGlyphs` reports, e.g.
`SIM card "lachlan-1": toolkit.items[1].steps[0].text has characters the stock small font lacks:
"…"`. `stockMenuFor` runs the same validation, so a host's build fails before a visitor sees it.

Deviation (Task 1, from Task 0 K): the measured layouts set no label length limit: the title shows
the words that fit the carousel's line (its first word must fit), labels are cut with ` ...`.
Faces: title large; labels, text pages and `confirm` small. A text page holds what one proactive
command can carry (GSM 11.14: 255 bytes, so at most 273 septets of packed GSM 7-bit text). The
plan's 255 items per list and depth 4 stay.

**D13 - Notes, timings and sounds come from the goldens (plan 14 D8, plan 16 D12).** New screens
(the toolkit level, text pages, item lists, the call confirm, any `SIM card busy` or
`Not supported by SIM card` note Task 0 reaches) get generated timelines and their warning tones
through `NOTE_SOUNDS`. Composed flows (D4) take the timings of the stock widget they reuse.

Deviation (Task 1, from Task 0 K): no toolkit screen plays a tone (key beeps only). Every SIM
screen opens with a `Wait` note on plan 14's hatched bar for as long as the phone fetches the
command (≈22 ms + 1.2 ms per character of its text: 40 ms for a short text, 311 ms for 240
characters); C on a SIM screen shows `Wait` ≈40 ms, then the level or parent list. OK on a text
returns at once.

**D14 - Persistence (reuses plans 18 and 19).** SIM messages follow D2's rule inside plan 18's
`messages` record (no new record). The toolkit is read-only SIM data: it is never stored, and a
host that changes it changes Menu 14 at the next creation. Preloaded items are ordinary records
once written. No record is added by this plan.

**D15 - Dependencies are conditional, each with its fallback.**

| Needs                                            | From              | If it has not landed                                                                                    |
| ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------- |
| `StockSimCard`, `normaliseSim`, `StockPhoneBook` | plan 19           | blocked: this plan extends them (plan 19 is done on `t3/p19-phone-book`)                                |
| `StockTelephone.dial`, `StockNetworkPort.dial`   | plan 22 Tasks 6-8 | a call step opens a placeholder owned by `22`; D6's rule is pinned when 22 lands (its Task 8 adopts it) |
| `*#06#` (`immediateCode`)                        | plan 22 Task 7    | `imei` is validated and stored; the screen is plan 22's when it lands                                   |
| `StockReminders`                                 | plan 21 Task 11   | `preload.reminders` throws naming plan 21; `welcomeNote` works                                          |
| Chat's history lines                             | plan 18c (Chat)   | D7 covers the Inbox, `Sender:` and Details only; Chat follows when 18c lands                            |

**D16 - The website does not change.** `git diff --stat <commit before Task 1> -- website/` is
empty at the end. Plan 31 integrates.

## Ground truth and artefacts

| Source (`$REF/captures/`)           | Contents                                                      | Use                                         |
| ----------------------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| plan 18 `sms/*` goldens (committed) | arrivals, Inbox, reading, Details                             | stay asserted (an empty SIM inbox)          |
| `6.39/plan19/sims/*.json`           | SIM fixtures with `EF_ADN`/`EF_SDN`                           | the base for Task 0's SIM fixtures          |
| `6.39/plan30/sims/*.json` (Task 0)  | SIM fixtures with `EF_SMS`, `EF_LND`, `EF_SST` and the applet | capture inputs, restated in the capture set |
| `6.39/plan30/<section>/` (Task 0)   | canonical captures, LCD and audio                             | goldens                                     |
| `6.39/plan30/terminal-profile.txt`  | the 3310's `TERMINAL PROFILE` bytes, decoded                  | spec (which commands v6.39 implements)      |
| `6.39/plan30/text.json` (Task 0)    | OCR runs (plan 14 format)                                     | text runs, label checks                     |

New artefacts (spec, Task 1):

| Artefact                                      | Cause                                          | Handling                                                    |
| --------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| the scripted applet and its fixed item texts  | the harness plays the SIM                      | test inputs; the host's toolkit is data (D3)                |
| proactive timing (fetch, terminal response)   | the harness answers at once                    | the phone's own timing as captured; UNVERIFIED on real SIMs |
| composed toolkit screens (if Task 0 K fails)  | no proactive session completes in the emulator | `COMPOSED_FLOWS`, UNVERIFIED (D4)                           |
| a clean-room Menu 13 icon (if Task 0 K fails) | no capture of the carousel entry               | known gap, named in the acceptance file (D4)                |

## Package boundaries

Unchanged from plans 13-22. nokia-os gains no dependency, touches no network, browser or audio API
and has no concept of a URL: a toolkit call step is a number, and the host's `dial` decides what it
means. phone-core does not change (D5 builds Menu 13 from existing entries; D11 attaches text
outside the snapshot). If Task 7 finds the kernel cannot present the toolkit level, stop and report.

## Contract changes

Task 1 writes these into `VISION.md`.

### `@hellotimber/nokia-os` (additive)

Task 1 applies Task 0's outcome (Deviations under D2, D3, D5, D8, D9, D12).

```ts
/** Plan 30: one received SMS stored on the SIM (`EF_SMS`). */
export interface StockSimMessage {
  /** The originator: `+` and 1-20 digits (plan 19's number rules, no `* # p`). */
  readonly number: string;
  /**
   * One SMS: GSM 7-bit default alphabet and its extension table (two septets each), at most 160
   * septets, every character drawable in the small face; `[ ] { } ~ | ^` draw as `?` (Task 0 M).
   */
  readonly text: string;
  /** The service centre's time stamp (plan 18's `StockTimestamp`). */
  readonly sentAt: StockTimestamp;
  /** `EF_SMS` status: read (default) or unread. */
  readonly read?: boolean;
  /** Details' `Message centre:`: the record's service-centre address (`+` and digits). Default "". */
  readonly centre?: string;
}

/** Plan 30: what the SIM applet does when an item is chosen (D3). */
export type StockToolkitStep =
  /** `DISPLAY TEXT`: a text page; OK goes on to the next step, C ends the session. */
  | {
      readonly kind: "text";
      readonly text: string;
      /** "user" (default): until a key or the ≈54 s timeout; "delay": clears itself after ≈3.58 s. */
      readonly clear?: "user" | "delay";
    }
  /** `SELECT ITEM`: a list; choosing an item runs its steps. The 3310 does not draw `title`. */
  | {
      readonly kind: "select";
      readonly title?: string;
      readonly items: readonly StockToolkitItem[];
    }
  /** `SET UP CALL`: the phone confirms (with `confirm` as the alpha identifier) and dials `number`. */
  | { readonly kind: "call"; readonly number: string; readonly confirm?: string };

export interface StockToolkitItem {
  /** Kebab-case, unique among its siblings; top-level items are route keys (`menu/sim-services/<id>`). */
  readonly id: string;
  /** Small face; cut with ` ...` where wider than its row. */
  readonly label: string;
  /** Run in order; the session ends after the last (back to the item's list). */
  readonly steps: readonly StockToolkitStep[];
}

/** Plan 30: the SIM's toolkit menu (`SET UP MENU`). */
export interface StockSimToolkit {
  /** The alpha identifier: Menu 14's carousel label (the words that fit its line; large face). */
  readonly title: string;
  readonly items: readonly StockToolkitItem[];
}

export interface StockSimCard {
  // ...plan 19 unchanged...
  /**
   * Plan 30: `EF_SMS`. Default: 15 slots, none used. `entries` by slot (index 0 = slot 1); null =
   * a free slot.
   */
  readonly messages?: {
    readonly slots?: number;
    readonly entries?: readonly (StockSimMessage | null)[];
  };
  /** Plan 30: the SIM applet's menu. Default: none (no Menu 14). */
  readonly toolkit?: StockSimToolkit;
  // No `lastDialled`: v6.39 never reads `EF_LND` (Task 0 L, D8).
}

/** Plan 30: a reminder as the user could have typed it (D10). */
export interface StockReminderPreload {
  readonly text: string;
  /** Optional alarm, phone time ("DD.MM.YYYY", "HH:MM"). */
  readonly alarm?: { readonly date: string; readonly time: string };
}

export interface StockPhoneConfig {
  // ...plans 13-22 unchanged, except:
  /** Plan 30: 15 digits, Luhn-valid. `*#06#` shows it (D9). Default: none (the virgin screen). */
  imei?: string;
  /** Plan 30: phone-memory content written once, only where its record does not exist (D10). */
  preload?: {
    readonly welcomeNote?: string;
    readonly reminders?: readonly StockReminderPreload[];
  };
}

/** Plan 30: the stock menu for a SIM (Menu 14 when it has a toolkit). Validates the SIM (D12). */
export function stockMenuFor(sim: string | StockSimCard): PhoneMenu;

/** Plan 30: plain-text description of a screen, for accessibility mirrors and headless QA (D11). */
export function describeStockScreen(screen: ScreenModel): string;

/** Plan 30: `*#06#`'s two digit lines for a valid IMEI (`["4901542033", "10018"]`); throws otherwise. */
export function stockImeiLines(imei: string): readonly [string, string];
```

Rules (Tasks 4, 6-9 pin each with a test): an invalid SIM, IMEI or preload throws from
`createStockPhone` and `stockMenuFor`, naming the field path; the host's SIM messages are read only
while the `messages` record holds no copy of that SIM's messages; `stockMenu` equals
`stockMenuFor("sim-1")`; a toolkit call step reaches the dial seam (plan 22's `StockTelephone.dial`,
then `StockNetworkPort.dial`, once plan 22 lands) inside the confirming `send()` (D6); a preload
never overwrites a stored record; `describeStockScreen` returns a non-empty string for every
screen a phone emits.

## Internal API for later plans

```ts
// src/sim/messages.ts (pure)
export function gsmSeptets(text: string): number | undefined; // undefined: not GSM 7-bit
export function simMessagesProblem(messages: unknown, where: string): string | undefined;

// src/sim/toolkit.ts (pure)
export function normaliseToolkit(toolkit: unknown, where: string): StockSimToolkit; // throws (D12)
export function toolkitPaths(toolkit: StockSimToolkit): readonly string[]; // "menu/sim-services/<id>"

// src/sim/session.ts
export type ToolkitDial = (number: string, flow: Flow) => void; // D6's seam (plan 22's dial)
export function toolkitSession(item: StockToolkitItem, deps: ToolkitDeps): Widget; // the flow's root

// src/phone-book/numbers.ts (pure)
export function sameSubscriber(a: string, b: string): boolean; // D7's rule

// src/display/describe.ts
export function describeStockScreen(screen: ScreenModel): string;
export function attachDescription(frame: Bitmap, text: string): void; // flow.ts calls it
```

## Shared-file edits

| File                                                   | Edit                                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `src/firmware/features/index.ts`                       | one line: `simServicesFeature`                                                                      |
| `scripts/capture-sets/index.ts`                        | one line: the plan 30 set                                                                           |
| `src/phone-book/sim-card.ts` (plan 19's)               | `StockSimCard` gains `messages`/`toolkit`; `normaliseSim` calls the two validators (≈15 lines)      |
| `src/messages/store.ts`, `src/messages/read.ts` (18's) | the SIM's messages as the inbox until the first write (D2, ≈20 lines); sender names (D7, ≈10 lines) |
| `src/firmware/menu.ts`                                 | `createStockMenu(sim)` behind `stockMenuFor`; Menu 14 appended (≈25 lines)                          |
| `src/firmware/phone.ts`                                | `stockMenuFor(config.sim)`, `imei`, `preload` (≈20 lines)                                           |
| `src/widgets/flow.ts`                                  | one call: `attachDescription(frame, describeWidget(model))` (D11)                                   |
| `src/calls/*` (plan 22's)                              | `imei` into `*#06#` (≈5 lines); D6's synchronous `dial`, only if plan 22 placed it later            |
| `src/index.ts`                                         | one line each: the new types, `stockMenuFor`, `describeStockScreen`                                 |
| `demo/panels/index.ts`                                 | one line: the SIM content panel                                                                     |

## Golden pipeline additions

The capture set is `scripts/capture-sets/30-sim-content.ts`, an explicit table like plan 19's. It
exports `SIM_CONTENT_SIMS`: every Task 0 SIM fixture as a `StockSimCard` (messages, toolkit mirrored
from the applet script), checked against `plan30/sims/*.json` by Task 0's `check`. Ids,
`status: asserted` unless noted (`composed:` rows only if Task 0 K fails):

| Fixture id(s)                       | Source (`$REF/captures/6.39/plan30/`) | Kind               | Asserts                                                                          |
| ----------------------------------- | ------------------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| `sim/sms-boot-*`                    | `sms/boot/*`                          | timelines          | power-on with read, unread and no SIM messages: notice, envelope (D2)            |
| `sim/sms-inbox-*`, `sim/sms-read-*` | `sms/inbox/*`, `sms/read/*`           | stills / timelines | list order, icons, reading, `Sender:`, `Sent:`, Details, Erase, the record after |
| `sim/sms-slots-*`                   | `sms/slots/*`                         | timelines          | 10, 15, 30 slots: arrivals until `No space for new messages`                     |
| `sim/names-*`                       | `names/*`                             | stills             | a sender in the phone book: list, `Sender:`, Details, notice, Chat `>` (D7)      |
| `sim/lnd-*`                         | `lnd/*`                               | stills             | Dialled numbers and standby ▲ with `EF_LND` filled (D8)                          |
| `sim/stk-carousel-*`                | `stk/carousel/*`                      | timelines          | Menu 14: label, icon animation, `14`, ▲/▼ wrap past it, `Menu 1 3`, `Menu 1 4`   |
| `sim/stk-level-*`                   | `stk/level/*`                         | timelines / stills | the items: presentation, rows window, numbers, soft key, long labels, C, held C  |
| `sim/stk-text-*`                    | `stk/text/*`                          | timelines          | `DISPLAY TEXT`: short, long, paging, OK, C, held C, a following step             |
| `sim/stk-select-*`                  | `stk/select/*`                        | timelines          | `SELECT ITEM`: title, rows, Select, C, nested                                    |
| `sim/stk-call-*`, `sound/stk/*`     | `stk/call/*`                          | timelines / sound  | `SET UP CALL` confirm with and without alpha, OK, C, Confirm SIM service actions |
| `sim/imei-*`                        | `imei/*`                              | stills             | `*#06#` with an IMEI (D9)                                                        |
| `sound/note/<name>`                 | `notes/*`                             | sound              | warning tones of the new notes                                                   |

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` (repeat `mise exec -- vp fmt` until stable) and
  the named test commands.
- Commit rule: `mise exec -- vp check --fix` yourself, then
  `git commit --no-verify -m "<message>" -- <paths>`. Never `git add -A`/`git add .`, never
  `git stash`. Never stage `TODOS.md`.
- Never hand-edit `goldens/**`, `src/resources/generated/**`, `src/firmware/generated/**` or
  `scripts/generated/**`; change the generator or its tables and regenerate
  (`mise exec -- vp run @hellotimber/nokia-os#regenerate`). Each generator runs twice with no diff.
- Tests never read `$REF`. Generators that read `$REF` fail clearly when it is missing. Nothing from
  `$REF/extracted` is copied; firmware strings are cross-checks only.
- No new dependencies.
- When reality differs from this plan, follow the captures and append a `Deviation:` paragraph
  under the task. If a deviation breaks a contract in VISION.md, stop and report.
- Parallelism (max 3 concurrent agents): Task 0 gates everything, then Task 1. Then lanes A
  (2 → 3), B (4 → 5) and C (6, 9). Task 7 needs 3 and 6; Task 8 needs 4; Task 10 needs 5, 7, 8 and
  9; then 11.

## Tasks

### Task 0 - SIM fixtures, the toolkit harness and canonical REF captures (no repository changes)

**Files (all under `$REF`, gitignored):** `tools/harness/{build.sh,swsim-stk.patch,stk-applet.c}`,
`captures/scripts/gen_v639_plan30.py`, `captures/scripts/v639-plan30-<section>.cap`,
`captures/6.39/plan30/**` (SIM fixtures in `plan30/sims/`), a "Plan 30 supplementary captures"
section in `captures/README.md`, `firmware/work/v639-plan30-*.fls`.

- [x] Read `$REF/captures/README.md`, plan 19's `scratch-plan19/NOTES.md` and `tools/sim.py`, the
      swSIM README and `src/proactive.c`. Do not modify existing captures, scripts or emulator
      sources; `build.sh` applies patches to a build-directory copy (plan 22's pattern). With no
      `CAP_STK`, output is byte-identical to the stock harness (rerun the plan 13 clock script).
- [x] **Harness K0:** `swsim-stk.patch` answers `FETCH` (`A0 12`) and `TERMINAL RESPONSE` (`A0 14`)
      under the GSM class as the README's patches 1-4 did for other commands; `stk-applet.c` replaces
      the default applet with one that reads `CAP_STK=<script.json>` (the `StockSimToolkit` shape:
      `SET UP MENU`, then per `ENVELOPE (MENU SELECTION)` the item's steps as `DISPLAY TEXT`,
      `SELECT ITEM`, `SET UP CALL`, then `END SESSION`) and logs every command and response; the
      fixture's `EF_SST` allocates the proactive services. Record the 3310's `TERMINAL PROFILE`
      decoded per GSM 11.14 into `plan30/terminal-profile.txt`. If no session completes after a
      bounded effort (record what was tried), stop K, write the outcome and continue with M-I;
      Tasks 2-7 then follow D4's composed branch.
- [x] `gen_v639_plan30.py` (`sims`, `run -j 3`, `--only`, `ocr`, `check`) driving
      `tools/menutree/emu.py` like plans 19 and 22. Fixtures (invented, restated in the capture set):
      `sms` (`EF_SMS` with read and unread messages from numbers in and out of `EF_ADN`, 160-septet
      and extension-character texts, two time stamps), `slots10`, `slots30`, `lnd` (`EF_LND` with
      three numbers), `stk` (the applet script below), `empty` (plan 19's).
- [x] **M SIM messages** (`plan30/sms/`, virgin): power-on with unread messages (notice? envelope?
      sound on factory), Inbox order and icons, reading every message (`Sender:`, `Sent:`), Details,
      Erase (then reboot in one process: the SIM after the write), an arrival into a SIM with free and
      with no free slots at 10, 15 and 30 slots (does capacity follow the SIM?), Restore factory
      settings with SIM messages.
- [x] **N sender names:** an arrival and a SIM message from a number in `EF_ADN` (exact, with and
      without `+61`/leading `0`, and differing in the last digit): the notice, the list, `Sender:`,
      Details, Reply's number, Chat's `>` line (if 18c's Chat runs in the harness).
- [x] **L last numbers dialled:** Dialled numbers and standby ▲ with `lnd`; after a call (plan 22's
      harness commands): does `EF_LND` change (read the SIM after `saveflash`)?
- [x] **K toolkit** (if K0 succeeded): the carousel with Menu 13 (label for titles `SIM services`,
      `LACHLAN` and a 14-character title; icon frames; ▲/▼ past 12 and 1; `Menu 1 3` and the
      shortcut window); the level with 1, 3 and 12 items, labels of 10/16/24 characters; each item's
      first screen; `DISPLAY TEXT` short, 160 and 240 characters (paging, scroll, OK, C, held C,
      timeout); `SELECT ITEM` with and without a title, nested two deep, Select, C, held C;
      `SET UP CALL` with and without an alpha identifier, with Confirm SIM service actions `Asked`
      and `Not asked` (OK, C, then plan 22's Calling); a selection while the phone is in a call;
      the session's end (where the phone returns); audio of every new note (factory).
- [x] **I IMEI:** write an IMEI into a disposable image (the emulator's PMM/EEPROM IMEI field, as
      plan 15 wrote the security code) and capture `*#06#`; if impossible, record why.
- [x] OCR every new image into `plan30/text.json`.
- [x] `check`: every recording starts on its parent; `plan30/sims/*.json` equal the capture set's
      `SIM_CONTENT_SIMS` (the repo file as an argument); every audio recording has `keys.csv`.
- [x] Append "Plan 30 supplementary captures" to `$REF/captures/README.md`. No commit. Record the
      outcome under this task: the harness result and the terminal profile, the SIM message rules
      (boot, order, capacity, persistence), the name rule, `EF_LND`, every toolkit layout and flow
      with timings, the IMEI screen, what failed.

**Task 0 outcome (2026-10-15).** Generator `$REF/captures/scripts/gen_v639_plan30.py` (32 sections),
harness `$REF/tools/harness-p30/` (README "Plan 30 supplementary captures"), output
`$REF/captures/6.39/plan30/`: 219 recordings (all with audio and `keys.csv`), 1,718 base images, all
OCRed into `text.json`, `check`: 0 problems (13 single-frame notes, below). Timings are ms after the
key-down of the recorded key.

Deviation (files): the harness pieces live in `tools/harness-p30/{build.sh,swsim-stk.patch,stk-applet.c}`,
not `tools/harness/` (plans 21/22's copy pattern; `tools/harness` and `harness-p22` are untouched). The copy
starts from plan 22's (`answer`, `hangup`, `CAP_TCH`) and adds a `reprovision` command. With no `CAP_STK`
or `CAP_STK_LOG` the plan 13 clock script writes the same 44 files (SHA-256) as `tools/harness`.

- **Harness K0: succeeded at the first attempt.** `swsim-stk.patch` routes FETCH `A0 12`, TERMINAL
  RESPONSE `A0 14` and ENVELOPE `A0 C2` under the GSM class; `stk-applet.c` (`CAP_STK=<script.json>`)
  plays the StockSimToolkit shape. Full sessions complete: SET UP MENU, ENVELOPE (MENU SELECTION),
  DISPLAY TEXT or SELECT ITEM (nested two deep), TERMINAL RESPONSE, then the next step or the session
  end. The fixture needs `EF_SST` services 27 and 29 and **`EF_PHASE` 03**: with the emulator SIM
  (phase 2) the 3310 sends no TERMINAL PROFILE at all. The applet re-issues the parent SELECT ITEM on
  result 11 (a harness choice). **SET UP CALL fails** (below): no `stk/call/*` screen after the
  confirm is usable as a golden.
- **Terminal profile** (`plan30/terminal-profile.txt`): `4F 67 FF 7F 11` (5 bytes). Download: profile,
  SMS-PP, CB, menu selection, USSD in call control. Other: command result, call control (with cell
  id), UCS2 entry and display; no MO SMS control, no 9.1.3 alpha handling, no extension text. Proactive:
  DISPLAY TEXT, GET INKEY, GET INPUT, MORE TIME, PLAY TONE, POLL INTERVAL, POLLING OFF, REFRESH, SELECT
  ITEM, SEND SMS, SEND SS, SEND USSD, SET UP CALL, SET UP MENU, PROVIDE LOCAL INFORMATION (not NMR).
  Events: SET UP EVENT LIST and location status only. No timers, no LAUNCH BROWSER, no idle-mode text
  (R3 holds).
- **M SIM messages.** v6.39 reads every `EF_SMS` record at power-on and lists them as the Inbox.
  Order: **unread first, then read, each in SIM slot order; time stamps play no part**
  (`sms/order`). An arrival takes the first free slot, so it is listed by that slot among the unread.
  Power-on: unread SIM messages show **only the standby envelope**: no notice and no tone, virgin or
  factory (`sms/boot/*`); read-only messages show no envelope. Reading writes the record's status byte
  `03` to `01` on the SIM (UPDATE RECORD); Erase (`Erase message?`, OK) writes status `00` and leaves
  the rest of the record. Both survive a cold power-on with the same SIM (`sms/erase/reboot-*`): the
  inbox state lives on the SIM, not in phone memory. **Capacity follows the SIM:** with 10, 15 and 30
  records the last free slot takes one arrival (`1 message received`); the next arrival shows
  `No space for new messages` (OK) and `EF_SMSS` is written `04 FE` (memory-full flag); no cap was hit at 30. Restore factory settings keeps every SIM message. Reading shows text pages of 4 lines
  (`Options`), then `Sender:` (name line and number line, or the number alone), then `Sent:`
  `13-Oct-2026` / `08:05:00`; ▼ wraps from `Sent:` to the first page. Options: Erase, Reply, Chat,
  Edit, Use number, Forward, Details (`Sender:`, `Message centre:`, `Time:`; `Back`). The Inbox list's
  top-right counter reads like `2-2-1` (menu path and position). A 160-septet text reads in full.
  **Extension-table characters `[ ] { } ~ | ^` draw as `?`**; `€` and `\` draw (D2's drawable check
  must refuse the former, or the screen must show `?`).
- **N sender names: v6.39 names known senders** wherever it shows a sender: the Inbox list, `Sender:`
  (name, then number) and Details (`Sender:` name and number). The arrival notice names nobody
  (`4 messages received` counts every unread message; `Read` opens the Inbox list). Chat opens
  `Chat name:` empty (no name pre-filled). Reply's Send opens the SMS-centre `Set` list in the virgin image,
  so Reply's number was not reached. **Rule (`names/digits`, `names/*`): two numbers match when their
  last 9 digits are equal, or all digits of the shorter one when it has fewer than 9; the type of
  number (`+`) and any leading digits beyond those are ignored** (`61412345678`, `5412345678`,
  `0061412345678`, `412345678` and `2345678` all name Ann 0412345678; a difference in any of the last
  9 digits, as in `0312345678` or `0412345679`, does not; `23456` names Sam 123456). Gap: when two
  phone-book numbers share their last 9 digits (Bob 0412345678, Intl +61412345678), the SIM message
  from `+61412345678` names Intl, network arrivals `5412345678`, `412345678` and `61412345678` name
  nobody and `44412345678` names Bob: unresolved; Task 5 should treat a shared 9-digit suffix as a
  known gap. Network originators lose their `+` in the harness (`sms` takes digits only), so the
  international form is covered by SIM messages only. Chat's `>` lines were not captured.
- **L `EF_LND`: v6.39 never reads or writes it.** With three numbers in `EF_LND`, standby ▲ shows
  `No last dialled numbers` and Call register › Dialled numbers `No numbers`; no APDU in any section
  selects 6F44, and a call (`lnd/call`) lists `Dialled 1: 0411222333` with no UPDATE on 6F44. (After
  that call, the image saved 4 s later shows `No last dialled numbers` again after a reboot: the
  phone's own list had not reached flash; plan 22's concern.) **D8: `StockSimCard.lastDialled` does
  not exist.**
- **K toolkit layouts and flows** (`stk/*`, toolkit `main` unless named):
  - Carousel: the entry is **Menu 14** (the counter reads `14`; ▲ from Phone book wraps to it, ▲
    again gives Profiles `12`, ▼ from 14 wraps to Phone book); there is no 13 (`Menu 1 3` gives an
    `Invalid shortcut` note at 430 ms for ≈2.9 s, then standby). `Menu 1 4` opens the level (the SIM
    services page at 436 ms, the level at 1901 ms). **The label is the SET UP MENU alpha identifier**
    in the carousel's large face: `SIM services`, `LACHLAN`; the 14-character `Portfolio menu` shows
    `Portfolio` only. Icon: a SIM card and hand, 11 frames (61 ms, held 1377 ms, then steps of
    ≈232-449 ms), settling at 3769 ms; it restarts on every arrival (▲, ▼, C from the level). D5's
    numbering `13-n` becomes `14-n`.
  - Level: a 3-row rows list with a scroll bar, soft key `OK`, **no title and no item counter**,
    opening on item 1 (91 ms after Select); ▼ wraps 12 to 1; labels longer than the row (≈13
    characters: `Sixteen char ...`, `Twenty-four ...`) are cut with ` ...`; 10 characters fit. C goes
    to the carousel (66 ms), held C to standby (≈530-615 ms).
  - Every SIM screen opens with a `Wait` note with a hatched bar at ≈55-80 ms, then the SIM's screen
    at ≈90-115 ms (≈300 ms for 160 and ≈390 ms for 240 characters).
  - DISPLAY TEXT: bold face, 4 lines a page, soft key `OK`, no scroll bar; ▼ pages (160 characters: 3
    pages, 240: 4); ▲, ▼ and digits on a one-page text change nothing. OK (result 00) returns to the
    level at ≈65-90 ms with the item still selected; C (result 11) shows `Wait`, then the level
    (≈145-200 ms); held C (result 10) goes to standby (≈530-630 ms). A wait-for-user text (qualifier
    0x80) times out after ≈54 s (result 12) to the level; a clear-after-delay text (0x00) clears after
    ≈3.58 s (result 00). Two texts: OK on the first shows the second (via a 25 ms level frame).
  - SELECT ITEM: the level's rows list with `OK`; **the alpha identifier (title) is not drawn**;
    nesting works; OK opens the chosen item's next screen; C returns to the parent list (the harness
    re-issues it) or the level; held C goes to standby.
  - SET UP CALL: **not captured.** The phone FETCHes it, sends one STATUS and shows a blank screen with
    only an edit-mode indicator and `OK`; OK and digits do nothing, C answers result 22 (user did not
    accept) for the alpha variant; no call setup reaches the network. Tried (bounded): qualifiers 0, 2
    and 4, a `+` number, a 3-digit number, with and without alpha, Confirm SIM service actions `Asked`
    and `Not asked`, with `CAP_TCH=1`. Tasks 2-7 follow **D4's composed branch for the call confirm
    only** (`Allow SIM card to call?`, UNVERIFIED); carousel, level, text and list are asserted.
  - Confirm SIM service actions (6-2-6) opens on `Not asked` in the virgin image; `Asked` shows `Done`.
  - During a call the in-call Options are End active call, Hold, New call, Send DTMF, Phone book and
    Mute: **no Menu entry, so SIM services cannot be reached in a call**.
  - Sound: no new tones; every toolkit screen, timeout and C plays only the key beep (`sound/stk/*`).
- **I IMEI: captured.** `reprovision` (the emulator's identity provisioning through the firmware's MBUS
  handlers) writes the 3310 model's minted IMEI `490154203310018`; `*#06#` then shows `Serial No.`
  over `4901542033` / `10018` (two lines in place of the virgin `?` glyphs), live and from
  `firmware/work/v639-plan30-imei.fls`. Only this one IMEI can be written (the model's pinned value):
  D9's layout is asserted for it; other digits use the same layout with other glyphs.
- **Pending or failed:** SET UP CALL and the Calling flow after it (above); Chat `>` lines; Reply's
  prefilled number (behind the virgin SMS-centre `Set` list); the shared 9-digit suffix case.
  Single-frame notes in `check`: the frozen call screen's keys, a one-item level's ▲, keys on a
  one-page text. Two `stk-call*` processes logged a firmware wild-PC post-mortem that the call probes
  do not reproduce.

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `docs/specs/stock/sim-services.md` (new), `docs/specs/nokia-3310.md` (§10:
one row; §5 item 13 a pointer), `docs/specs/nokia-3310-menu-tree.md` ("Hidden": 13 now with a
toolkit SIM), `docs/plans/README.md` (row 30), this plan.

- [x] Apply Task 0's outcome to D2-D13 and the contracts (Deviation lines where it changes them).
- [x] VISION: the nokia-os contracts exactly as in "Contract changes"; the nokia-os row mentions SIM
      content and SIM services; the D1 table as the rule for host content.
- [x] `docs/specs/stock/sim-services.md`: SIM messages, sender names, `EF_LND`, the toolkit screens
      and terminal profile, the IMEI screen, the artefacts above; unasserted facts marked
      "(plan 30, in progress)".
- [x] Plans README: row 30 `in progress`. No runtime code. `mise exec -- vp check --fix`.
- [x] Commit: `docs: define SIM content and SIM services contracts (plan 30)`.

### Task 2 - Goldens and the capture set (TDD)

**Files:** `scripts/capture-sets/30-sim-content.ts` (new), the capture-set index (one line),
`tests/capture-sets/30-sim-content.test.ts` (new), `tests/acceptance/30-sim-content.test.ts` (new:
the todo shim only), `goldens/**`, `goldens/index/30.json` (generated).

- [x] TDD the capture set on synthetic recordings (an injected loader, as plan 19's): ids, kinds,
      cut points, `trigger-frame`, `note:` naming the SIM fixture, sound rows in plan 16's format.
- [x] `SIM_CONTENT_SIMS` in a JSON-style block; a test validates each against D2/D12's rules.
- [x] If Task 0 K failed: no `sim/stk-*` golden exists; the set lists the composed flows instead
      (`COMPOSED_FLOWS` rows with their reason), and `sim/stk-*` coverage is the acceptance file's
      known gap (D4).
- [x] Register the set (one line). Run `import-captures` twice; no diff the second time. Record
      fixture counts and bytes (budget guide: ≤ 1.5 MB of new text grids).
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): import SIM content and SIM services goldens (plan 30)`.

Deviation (Task 2): Task 0 K succeeded, so there are `sim/stk-*` goldens and no `COMPOSED_FLOWS`
rows; the composed call confirm (no capture) is pinned by unit tests (Task 7). `SIM_CONTENT_SIMS`'s
block is in the shape `gen_v639_plan30.py check` reads (time stamps as `DD.MM.YYYY HH:MM:SS`,
`slot`, the applet's `qualifier`); the module turns it into `StockSimCard` values (messages by
slot, `clear: "delay"`); `check` reports 0 problems. Not imported (reasons in
`SIM_CONTENT_NOT_IMPORTED`): `lnd/*` (D8: plan 22's empty screens), `stk/call/*` (never completes),
`stk/in-call/*` (plan 22's), every held-C recording (the kernel's 800 ms long press against the
firmware's ≈530 ms, plan 19's known gap), the power-on recordings (the virgin image's date prompt;
their standby and Inbox stills are imported, replayed by hand). `*#06#` is plan 22's screen:
`sim/imei-screen` is `pending:22`. Capture logs are transcribed for the replays by
`scripts/sim-content-scripts.ts` (`vp run @hellotimber/nokia-os#sim-content-scripts <REF>`).
Imported: 97 LCD goldens and 10 sound goldens, 1.53 MB of text grids (images past a list's wrap,
the same icon animation again and the names' text and time pages trimmed to stay near the 1.5 MB
guide); a second import changes nothing.

### Task 3 - Glyphs, sprites and timelines (TDD)

**Files:** `scripts/resource-inputs/30-sim-content.ts` (new; plan 29's registrations),
`src/resources/generated/**` (regenerated), `tests/resources.test.ts` (new cases only).

- [x] Text runs for the new images; overrides naming their golden. Every fixture string renders in
      the face its screen uses.
- [x] Sprites: the Menu 14 icon frames (from `sim/stk-carousel-*`; or, on D4's composed branch, the
      clean-room icon in a separate, labelled source file whose header names it non-stock), any new
      note icon, the toolkit level's marks.
- [x] Timelines (`WIDGET_TIMELINE_BY_NAME`): the carousel slot's animation, the level's opening, the
      text page and list openings, the call confirm, each new note.
- [x] TDD freshness; every sprite binary and inside its golden's ink; every timeline finite.
- [x] `mise exec -- vp run @hellotimber/nokia-os#regenerate` twice; no diff.
- [x] Commit: `feat(nokia-os): SIM services glyphs, icon and timelines`.

Deviation (Task 3): nothing new to harvest but the icon. Every fixture string renders with the
existing fonts (`missingStockGlyphs` finds only the extension table's `[ ] { } ~ | ^`, which the
firmware draws as `?`), `Wait` is plan 14's hatched bar (`progress-*`), the level and lists are the
rows layout and rail, and no toolkit screen plays a tone; so no text runs, sprites or note
timelines are added (the acceptance replays compare every pixel). SIM services' icon is a carousel
icon (`STOCK_MENU_ICONS["sim-services"]`: 6 distinct frames played as 11 steps, the hand out and
back, settled 3709 ms after the reveal), extracted like plan 13's twelve: `ResourceDeclarations`
gains `menuIcons` (slug → reveal golden), which `extract-resources` adds to plan 13's twelve. C's
return from the level (`sim/stk-level-main-c`) is cut off before the icon settles, so it gives no
reveal timeline of its own; every reveal plays the ▲ timeline.

### Task 4 - SIM messages (pure and store, TDD)

**Files:** `src/sim/messages.ts` (new), `src/phone-book/sim-card.ts` and `src/messages/store.ts`
("Shared-file edits"), `tests/sim-messages.test.ts` (new).

- [x] TDD `gsmSeptets`: the default alphabet (1), the extension table (2), anything else
      `undefined`; 160 septets accepted, 161 refused.
- [x] TDD `simMessagesProblem` and `normaliseSim`'s messages: `slots` positive and at most Task 0
      M's cap; entries at most `slots`; each number, text, time stamp (plan 18's ranges) and `read`;
      errors naming `messages.entries[i].<field>`.
- [x] TDD the store: with no stored copy of this SIM, `inbox()` is the SIM's messages in Task 0 M's
      order with their read flags; `unread()` counts them; the first `markRead`, `erase` or
      `receive` writes the whole inbox under the SIM id; another SIM id sees its own; capacity is
      `slots` (`receive` returns `"full"` past it); Restore keeps them (plan 18 D7).
- [x] Power-on with unread SIM messages does what Task 0 M recorded (envelope, notice).
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [x] Commit: `feat(nokia-os): SMS stored on the SIM card`.

Deviation (Task 4): the store is slot-based (Task 0 M: order and arrivals follow the SIM's
records): every stored message carries its `slot` (plan 18's records without one get the first
free slots when read, so no record version change), `receive` and `save` take the first free slot
of the SIM's `slots`, `markRead` and `erase` name a slot, and `inbox()` lists unread then read,
each by slot. The Inbox list keeps the order it opened with (a message read stays in place until
the Inbox opens again, as plan 18's `sms/inbox/list-one-read` and plan 30's `sms/erase` show).
`stockMessaging` takes the normalised SIM card. Found on the way and fixed with their goldens:
Read on an Inbox message shows `Opening message` on the hatched bar first (270-625 ms in plan 30's
recordings; nokia-os 270 ms; plan 18 captured no message opening); C held on a notice clears it at
its release (`sms/slots/*`; the kernel's long press at standby did nothing); a word stays on a
message page's line when its cells end one column short of the LCD (`right here with a`); the
`Sent:` day is not padded (`1-Jan-2026`, new golden `sim/sms-order-read`); the extension table's
`[ ] { } ~ | ^` draw as `?` (`drawable`). The acceptance compares the screen after `Opening` and
`Opening message` within 600 ms, and an arrival's notice within 475 ms: plan 18's and plan 30's
recordings of the same paths differ by that much (the emulator's SIM against Task 0's swSIM
fixture; the synthetic cell's link time), which the fidelity standard counts as imperceptible.
Every golden that shows a sender from the phone book is Task 5's (names), so Task 4 asserts the
SIM messages without names: power-on (empty, factory), messages 2 and 3, the order, capacity and
arrivals at 10/15/30 slots.

### Task 5 - Sender names (TDD against goldens)

**Files:** `src/messages/read.ts` ("Shared-file edits"), plan 18c's chat screens (one call, if
landed), `tests/sim-names.test.ts` (new).

- [x] If Task 0 N found no names (it found them: not applicable): record the finding in the spec, delete this task's rows from the
      capture set (none were imported), skip to the commit with docs only.
- [x] Otherwise TDD the list, `Sender:`, Details, the notice and Chat's `>` lines through
      `StockPhoneBook.byNumber` with Task 0 N's number comparison, against `sim/names-*`; plan 18's
      goldens (numbers not in the phone book) still pass.
- [x] Commit: `feat(nokia-os): name SMS senders from the phone book`.

Deviation (Task 5): Chat's `>` lines were not captured (Task 0 N: Chat opens `Chat name:` empty)
and the arrival notice names nobody, so neither changes; the list, `Sender:` (name line, number
line) and Details are named. The rule is `sameSubscriber` (`src/phone-book/numbers.ts`), used by
`StockPhoneBook.byNumber` (exact match first, then the first entry in SIM order that is the same
subscriber; an entry without a name names nobody), so plan 22's caller names follow it too.
`names/digits` (22 numbers against Ann, Zed and Sam) is asserted; the shared 9-digit suffix cases
`sim/names-bob-9digits`, `-bob-k10` and `-bob-plus` are known gaps (v6.39 names nobody there, by no
rule Task 0 found). Details' `Message centre:` of a network arrival is not imported (plan 18's
model shows Set 1's centre; the emulator network writes `+1234567890`).

### Task 6 - The toolkit model and `stockMenuFor` (pure, TDD)

**Files:** `src/sim/toolkit.ts` (new), `src/phone-book/sim-card.ts`, `src/firmware/menu.ts`,
`src/index.ts` (one line), `tests/sim-toolkit.test.ts` (new).

- [x] TDD `normaliseToolkit` (D12): title and labels in their faces and limits; ids kebab-case and
      unique per list; steps non-empty; a `select` with 1-255 items; depth ≤ 4; call numbers per
      plan 19; `confirm` in its face; field-path errors.
- [x] TDD `stockMenuFor`: `"sim-1"` and a SIM without a toolkit equal `stockMenu` (paths, labels,
      numbers); a toolkit SIM adds `menu/sim-services` and one path per top-level item, in order;
      the carousel label per D5; an invalid SIM throws as `createStockPhone` does.
- [x] `createStockPhone` builds its menu with `stockMenuFor(config.sim)`; every existing test passes.
- [x] Commit: `feat(nokia-os): the SIM toolkit model and stockMenuFor`.

Deviation (Task 6): phone-core numbers top-level entries 1..n and refuses a gap ("Sibling menu
orders must be contiguous from 1"), and indexes the carousel by order, so SIM services is the
kernel's 13th slot (`src/sim/slot.ts`: `SIM_SERVICES_ORDER` 13) and the stock painter draws its
counter as 14 (`SIM_SERVICES_NUMBER`) and its level without a menu number. What phone-core decides
by number stays 13: `Menu 1 3` opens SIM services and `Menu 1 4` is `Invalid shortcut`, the reverse
of v6.39 (`sim/stk-carousel-main-menu-13`, `-menu-14`: known gaps until phone-core lets a top-level
entry carry its own menu number; phone-core does not change in this plan). `createStockPhone` and
`stockMenuFor` both build the menu through `createStockMenu(…, sim)` with the normalised card (the
SIM's toolkit, messages and phone book). A cut label (Task 0 K) ends in `CUT_MARK` (`…`): the rows
painter draws its text, then `...` at a fixed column (x 68-76) wherever the text stops, and the
text keeps a space's width before it (`Sixteen char`, `Twenty-four`). Items open a placeholder until
Task 7.

### Task 7 - SIM services screens (TDD against goldens, or composed)

**Files:** `src/firmware/features/sim-services.ts` (new), `src/sim/session.ts` (new), the features
index (one line), plan 22's telephone only for D6's rule, `tests/sim-services.test.ts` (new).

- [x] The carousel slot (icon timeline, label, `13`) and the level (presentation, numbers, soft key,
      opening selection, rows window) against `sim/stk-carousel-*` and `sim/stk-level-*`.
- [x] `ToolkitSession`: text steps as Task 0 K's text page (or plan 14's text pages, composed), OK
      to the next step, C ending the session where Task 0 K returns; select steps as its list (or
      an option list with `Select`, composed); call steps as its confirm (or the confirm query
      `Allow SIM card to call?`, composed) honouring Confirm SIM service actions as Task 0 C shows,
      then plan 22's Calling flow; the session's end.
- [x] D6's rule: a test drives `send({ type: "down", key: "navi" })` on the confirm and asserts the
      port's `dial` was called before `send` returned, here and for plan 22's `Call` from the name
      list; without plan 22, call steps open the `22` placeholder (D15).
- [x] TDD through keys against `sim/stk-*` and `sound/stk/*`; composed flows against their stock
      widgets' existing goldens.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [x] Commit: `feat(nokia-os): SIM services through the SIM toolkit`.

Deviation (Task 7): plan 22 has not landed, so D6's rule is pinned on the session's dial seam
(`ToolkitDial`, `tests/sim-services.test.ts`: the number arrives inside the confirming key's
`send()`), and the phone's seam (`toolkitDial` in `features/sim-services.ts`) opens plan 22's
`Calling` placeholder until plan 22 binds it to `StockTelephone.dial`; plan 22's own `Call` from
the name list is its Task 8's to pin. Corrections to Task 0's outcome from the replays: OK on the
last step of an item chosen from a list ends the session (back on the level, `select-ok`,
`leaf-ok`), as at the top; only C goes back to the list, which the SIM issues anew (opening on
its first item). The clear-after-delay and wait-for-user timeouts run from when the text shows:
4867 ms and 58328 ms (Task 0 read 3581 ms and 54040 ms inside the recordings that followed
`open`). `Wait` lasts 20 ms + 1.2 ms per character of the fetched command's text. A message page
(text page) keeps a word on its line while the word's cells fit all 84 columns (`scroll. the
toolkit`), also for SMS (plan 18's reader). The call confirm is a confirm query of at most three
lines (`confirm` longer than that is refused at creation). C held is the kernel's long press, as
plan 19's known gap; its recordings are not imported.

### Task 8 - IMEI and preload (TDD)

**Files:** `src/firmware/phone.ts`, plan 22's `*#06#` code (≈5 lines), `src/firmware/preload.ts`
(new), `tests/preload.test.ts` (new), `tests/imei.test.ts` (new).

- [x] TDD `imei`: 15 digits, Luhn; `*#06#` against `sim/imei-*` (or composed per D9).
- [x] TDD `preload`: the Welcome note written when the settings record lacks its key (then shown at
      power-on as plan 15 does), never over a stored note, not after Erase; reminders added in order
      when no `reminders` record exists, never otherwise; limits and typeable characters (D10);
      without plan 21, `preload.reminders` throws naming it.
- [x] Commit: `feat(nokia-os): host IMEI and phone-memory preload`.

Deviation (Task 8): plan 21 merged during this plan (t3/integration a624df4), so
`preload.reminders` binds to its `StockReminders.add` (text and an optional alarm, in order,
while storage has no `reminders` record; plan 21's 10 reminders of 35 characters) instead of
throwing. Plan 22's `*#06#` has not landed: `imei` is checked when the phone is created, kept as
`StockServices.imei` for plan 22's screen, and `stockImeiLines` gives its two lines
(`sim/imei-screen` stays `pending:22`). Every preloaded string must be typeable (plan 18's
`TYPEABLE`), within its editor's limit and drawn by the faces that show it (the Welcome note: large
and small; a reminder: small and large); the preload is checked before anything is written. The
Welcome note's record is the `settings` record, so a preload never returns after Erase.

### Task 9 - Screen text (TDD)

**Files:** `src/display/describe.ts` (new), `src/widgets/flow.ts` (one call), each widget model
module (a `describe` beside its model), `src/index.ts` (one line), `tests/describe.test.ts` (new).

- [ ] TDD `describeStockScreen` for off, boot, standby (operator, clock, profile line, notice,
      indicators), the carousel and both level presentations.
- [ ] A describer per widget model kind (exhaustive switch; the test enumerates the widget-model
      union): notes, queries, prompts and entries (label, text, counter), option lists, the editor,
      the symbol table, the name list, call screens, Snake II (`Snake II, score 12`), placeholders
      (`<label> (not implemented)`), toolkit screens.
- [ ] A property test: driving every asserted golden's scenario of plans 14, 18 and 19, every
      emitted screen has a non-empty description.
- [ ] Commit: `feat(nokia-os): describe stock screens for hosts`.

### Task 10 - Acceptance and the coverage guard

**Files:** `tests/acceptance/30-sim-content.test.ts`, `tests/support/sim-content.ts` (new).

- [ ] `acceptancePlan({ plan: "30", scenarios, knownGaps, timeoutsMs })`: a hand-written scenario for
      every golden in `goldens/index/30.json`; delete the todo shim. Known gaps only with a reason
      (D4's composed icon, if any).
- [ ] Coverage guard: no golden or placeholder names `30`; Menu 14 (when present) is covered.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp check --fix`.
- [ ] Commit: `test(nokia-os): drive SIM content and SIM services against their goldens`.

### Task 11 - Demo, README, verification gate and closeout

**Files:** `packages/nokia-os/demo/panels/sim.ts` (new), `demo/panels/index.ts` (one line),
`packages/nokia-os/README.md`, `docs/specs/stock/sim-services.md`, `docs/plans/README.md`, this plan.

- [ ] Demo: a "Sample SIM" with three SIM messages (one unread), a toolkit (`Info`: a text page;
      `Places`: a list of two items, one a call step) and the status line from
      `describeStockScreen`; the demo's dial log shows the numbers the toolkit dialled. Verify with
      `mise exec -- vp run @hellotimber/nokia-os#demo` and `agent-browser` (headless, Skip boot,
      the `[role=status]` line): the Inbox, Menu 14, a text page, a list, a call step's confirm and
      dial.
- [ ] README: "SIM content" (messages, toolkit, the persistence rule, validation), "Host identity
      and preload", "Screen text"; the D1 table.
- [ ] `mise exec -- vp check --fix`, `vp run -r test`, `vp run website#build`;
      `git diff --stat <commit before Task 1> -- website/` is empty.
- [ ] Spec: replace "(plan 30, in progress)" with verified facts; list what stays UNVERIFIED.
- [ ] Plans README: row 30 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete SIM content and SIM services (plan 30)`.

## Follow-up plan adjustments

- **19 - Phone book:** `StockSimCard` gains `messages` and `toolkit`; `normaliseSim` validates them.
- **18 - Messages I:** the inbox starts from the SIM's messages (D2); senders are named (D7).
- **18c - Chat:** `>` lines name the partner (D7).
- **21 - Reminders:** `StockReminders.add` is called by the preload (D10); no behaviour change.
- **22 - Calls:** `dial` is called inside the placing key's `send()` (D6); `*#06#` shows `imei`
  (D9, its Open question 8 resolved); toolkit call steps use its Calling flow.
- **31 - Portfolio on the stock firmware:** consumes every contract above.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Toolkit as data (D3):** the host declares menu items and steps; nokia-os plays the applet.
   Reverse: a callback applet (`select(id, session)`), which can do anything but cannot be validated
   or routed ahead of time.
2. **Composed toolkit screens if the harness fails (D4):** stock widgets, UNVERIFIED, with a
   clean-room Menu 13 icon as a known gap. Reverse: no SIM services until a capture exists (plan 31
   then has no home for what does not fit).
3. **SIM messages persistence (D2):** the host's messages until the phone first writes the inbox,
   then the stored copy (plan 19's rule). Reverse: always the host's messages (a visitor's erase and
   read flags do not survive a reload).
4. **Three proactive commands (D4):** text, list, call. Reverse: add `GET INPUT` (a SIM item could
   ask a question) or `SEND SHORT MESSAGE` later, each with its captures.
5. **Preload (D10):** Welcome note and reminders, written once where no record exists. Reverse: no
   preload (a host's "now" items must live on the SIM as messages instead).
6. **One SMS per SIM message (D2):** GSM 7-bit, 160 septets. Reverse: UCS-2 (70 characters) and
   concatenated messages, if Task 0 M shows the firmware reading them from the SIM.
7. **IMEI composition (D9):** if the emulator cannot carry an IMEI, the digits replace plan 22's `?`
   glyphs in its captured layout (composed). Reverse: no `imei` until captured.
8. **`EF_LND` (D8):** only if v6.39 reads it. Reverse: never (dialled numbers stay phone events).

## Conflicts found while planning

- VISION's non-goals exclude "SIM features" on the website; this plan adds them to nokia-os only.
  Plan 31 narrows the non-goal when the website adopts them.
- Plan 18 lists senders by number; if Task 0 N shows names, plan 18's screens were incomplete for
  known numbers (its goldens used unknown numbers, so none changes).
- Plan 22 D16 says "Portfolio integration stays unsequenced"; it is now plans 30 and 31.
- VISION's table and plan 07 use `menu/sim-services` as the website's 404 easter egg; in v6.39 Menu
  13 exists only with a toolkit SIM (this plan); plan 31 decides the 404.

## Done means

- A host's `StockSimCard` supplies SIM messages and a toolkit; the Inbox, sender names (if the
  firmware shows them), Menu 14 and its text pages, lists and calls match their goldens (or their
  documented composed flows); a toolkit call reaches `StockNetworkPort.dial` inside the key event.
- `imei` and `preload` work as D9 and D10 state; every host string is validated at creation.
- `describeStockScreen` describes every screen; `stockMenuFor` lists the SIM's paths.
- The default SIM reproduces every plan 13-22 golden; no golden or placeholder names plan 30.
- The website is unchanged; `vp check`, `vp run -r test` and `vp run website#build` pass; VISION,
  the specs and the plans README match what shipped.
