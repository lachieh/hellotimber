# Plan 18c - Messages III: Chat, Templates, Smileys, Picture messages and Info service

> **Fidelity standard (2026-10-15):** `AGENTS.md` "Fidelity standard" supersedes this plan's tolerance text.

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, the spec or the code, STOP and report.

**Prerequisites:** plans 13-16 done. Plan 18 done (text entry engine, `editor`/`textInput`/
`numberEntry`/`symbolTable` widgets, `EDITOR_OPTIONS`, the messages record, `StockNetworkPort`,
`StockMessaging`, `setNotice({ open })`). Plan 18b done before Task 8 (Chat's editor is T9 by
default). Plan 19 through its Task 5 before Task 7's business-card part (saving a received card
uses `StockPhoneBook.add`) and its Task 10 for Chat's `Search` (the name-list picker). The
per-plan split has landed for the existing firmware, capture sets and acceptance tests. Plan 18
and 18b still describe some pre-split paths. The owner prerequisites below must land before
the tasks that consume them; their proposed APIs are not present in this checkout.
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only): the
plan 14 goldens for Messages, Chat, Topics and Screen saver (virgin), plan 15's factory image and
scrolls, plan 16's factory note recordings (`captures/6.39/plan16/notes/`), plan 18's planning
probes and recaptures, the planning probes in `$REF/captures/scratch-plan18c/` (evidence only,
never imported; `NOTES.md` lists them), and the canonical recaptures Task 0 writes to
`$REF/captures/6.39/plan18c/`. Read `$REF/captures/README.md`
and plans 13-16, 18, 18b and 19 in full before starting.
**Status:** not started.

## Goal

Give `@hellotimber/nokia-os` the remaining stock v6.39 Messages content and Chat, pixel- and
timing-faithful to the captures:

- **Templates** (2-5) and **Smileys** (2-6): the lists, reading, Edit and Erase, the `(empty)`
  slots, and the editor's Options › **Template** and **Insert smiley** in every editor (Write
  messages, Reply/Edit/Forward, Chat), with the preloaded content observed in the factory-restored image; Task 0 verifies the
  transition through Restore itself;
- **Picture messages** (2-4): the folder when captured on a verified v6.39 picture-memory image (D4), viewing,
  Options (Edit text, Erase, Use number, Forward, Details), **incoming picture messages** (notice,
  View, Save, the full-memory cases) and **sending** a picture through the host network port;
- **Screen saver › Screen saver** (5-9-4 and every profile's 12-n-2-9-4): the picture gallery,
  `Use`, `Screen saver missing`;
- **Chat** (menu 3, and Inbox › Options › Chat): number, `Chat name:`, the T9 chat editor, Send,
  the chat history with `<`/`>` lines, partner messages arriving during Chat, Options;
- **Info service › Topics** (2-8-4): the virgin box-glyph topics, the factory `Add topic`, Select,
  Edit, Erase; the **Service command editor** (2-10) as far as the emulator's network goes;
- **receiving business cards** (plan 19's follow-up): notice, View, Save into the phone book;
- EEPROM records for templates, smileys, pictures and topics; a Chat record only if persistence
  is captured; goldens for all verified flows.

The website does not change (D15). Its Chat (an LLM persona) is the contrast: the interface a later
portfolio integration uses is plan 18's `StockNetworkPort` (D8).

## Ownership (from plans 14, 15, 18 and 19)

Plan 18 D1 re-owned these to 18c; plan 19 added business-card receipt.

| Node or behaviour                                | v6.39 virgin state (plan 14 golden)            | This plan                                          |
| ------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------- |
| 2-4 Picture messages                             | no response (`tree/02-messages/2-4.leaf`)      | the folder (D4-D6)                                 |
| 2-5 Templates, 2-6 Smileys                       | no response (same golden, shared)              | lists after Restore; virgin stays as captured (D3) |
| Editor Options › Template, Insert smiley         | no response (plan 18 binds the virgin capture) | the lists (D3)                                     |
| 2-8-4 Topics (Select, Edit, Erase)               | five box-glyph topics (`2-8-4-*` goldens)      | topics record, flows (D11)                         |
| 2-10 Service command editor                      | editor, `Back` (`tree/02-messages/2-10.leaf`)  | editor and its Send (D12)                          |
| 3 Chat; Inbox › Options › Chat                   | `Phone number:` (`menu/03-chat.sub`)           | Chat (D8-D10)                                      |
| 5-9-4, 12-n-2-9-4 Screen saver › Screen saver    | no response (shared golden)                    | the gallery (D7)                                   |
| Incoming picture messages, sending pictures      | not reachable in plan 14                       | network port extension (D6)                        |
| Incoming business cards                          | not reachable                                  | network port extension, plan 19's store (D6)       |
| Restore: Topics reduced to `Add topic` (plan 15) | captured by plan 15, not implemented           | `factory()` of the topics record (D11)             |

## Why this plan exists (measured gap)

| Area                        | nokia-os after plans 18, 18b, 19                         | v6.39 evidence                                                                                                        |
| --------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Templates, Smileys          | placeholders `18c`; editor entries reproduce no-response | Factory-restored image has 8 template and 8 smiley slots; lists, `Read`, Options Edit/Erase; Template inserts (C2-C5) |
| Picture messages            | placeholder                                              | 8 EEPROM slots + 6 built-in pictures (v5.79), the viewer, Options (C7-C9)                                             |
| Incoming binary SMS         | text SMS only (plan 18 port)                             | `Picture message received`, View, Save; `Business card received` (C9, firmware strings)                               |
| Screen saver › Screen saver | placeholder                                              | gallery with `Use`, `Screen saver missing` (C10)                                                                      |
| Chat                        | placeholder; Inbox › Chat owned by `18c`                 | number, name, T9 editor `140/1`, 11-12 Options, `>` arrivals (C12)                                                    |
| Topics                      | placeholder (box glyphs)                                 | five junk topics (virgin), `Add topic` (factory), `Topic number:`/`Topic name:` (C11)                                 |
| Service command editor      | placeholder                                              | editor, counter `182`, `Back` (C13)                                                                                   |

## Planning investigation (2026-10-14)

Scratch probes in `$REF/captures/scratch-plan18c/` (scripts `tools/p1.py`…`p8.py`, outputs
`out-*`). The scratch harness copy adds `smsbin <from> <destPort> <srcPort> <hex>` over the
emulator's own `dct3_web_incoming_sms_bin` (it keeps plan 18's `sms` and `callin`). Images: the
virgin image (`v639-setup.inc`), plan 15's factory-restored image
(`firmware/work/v639-plan15-restored.fls`), the virgin image with PPM B, and the v5.79 used-phone
image (native, not the graft plan 18 S13 used). Times are emulated. Task 0 recaptures everything
canonically.

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                              | Evidence                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| C1  | **Virgin:** 2-4, 2-5, 2-6 and 5-9-4 do nothing, with PPM E and with PPM B (German UI). Changing PPM alone did not populate these lists.                                                                                                                                                                                                                                                                                                              | `out-p2-virgin/`, `out-p2-ppm-B/`                   |
| C2  | **The factory-restored image contains templates.** On the factory image 2-5 lists 8 entries, indicator `2-5-n`, soft key `Read`, an icon per row and the text from x 10 (long texts cut with a `...` mark): `Please call`, `I'm at home. Please call`, `I'm at work. Please call`, `I can't answer right now, call me later at`, `I am late. I will be there at` (each read in full in the view), then `(empty)` three times; ▼ wraps after the 8th. | `out-p2-factory/1*-templates*`, `out-p8/`           |
| C3  | **The factory-restored image contains smileys:** 8 rows without icons (text from x 2): `:-)`, `:-(`, `:-/`, `;o)`, `;oD`, `(empty)` × 3; `Read`.                                                                                                                                                                                                                                                                                                     | `out-p2-factory/1*-smileys*`                        |
| C4  | `Read` shows the text in the small face from x 0, top 0, soft key `Options` → `Edit`, `Erase` (indicator `2-5-n-1`/`-2`, `Select`). An `(empty)` slot reads `(empty)` with the same Options.                                                                                                                                                                                                                                                         | `out-p8/tpl-*`, `smi-*`                             |
| C5  | Write messages › Options › Template (factory): the template list as an option list (indicator `3-1` = the option's number + entry), `Select` inserts the text **with its trailing space** (counter 459 → 447, cursor after the space). Insert smiley: `4-1`, inserts `:-)` (447 → 444).                                                                                                                                                              | `out-p8/w-*`                                        |
| C6  | The prior worker reports that template and smiley texts equal firmware text-table strings (cross-check only: `Please call ` 0x48f, 0x492-0x495; smileys 0x0bf-0x0c3; the `(empty)` slots). This supports firmware defaults materialised in EEPROM. A fresh Restore and a language comparison are still needed to prove the write and language-selection rules.                                                                                       | `extracted/6.39/text/english.txt`                   |
| C7  | **v5.79 used phone, Picture messages:** 14 entries. Entries 1-8 are EEPROM slots (one named by its sender, the rest `Imagine 2`…`Imagine 8`, i.e. `Picture %N` by position; Options Edit text, Erase, Use number, Forward, Details, Exit). Entries 9-14 are the **six built-in pictures** (`Imagine 9`…`14`; Options Edit text and Forward only). View: the 72×28 picture at x 6, y 0, soft key `Options`.                                           | `out-p6-v579/l*`, `v*`, `o*`                        |
| C8  | The prior worker reports six MCU 72×28 OTA bitmaps matching the v5.79 views, the same six in v6.39 and copies in virgin PMM 0x100-byte slots (comparison manifest still needed). Yet v6.39 opens no folder (virgin or factory), and saving an incoming picture **hangs the UI**: a picture-directory or emulator fault is a hypothesis (D4), not a proven cause.                                                                                     | `out-p6-v579/`, `out-p4-*/b*`                       |
| C9  | **Incoming picture message** (`smsbin … 5514`, 3 concatenated parts): ≈16.2 s later standby shows `Picture` / `message` / `received` with `View`; View: the picture at x 6, y 0, its text below in the small face, ▼ scrolls, soft key `Save` (which hangs, C8).                                                                                                                                                                                     | `out-p4-factory/b-arrive`, `b02-view`               |
| C10 | **Screen saver › Screen saver:** factory opens a gallery on `7` with `Use` over junk slots and the emulator soon stops following keys (plan 15's `GU_FAULT_NOTE_DISPATCH` note); profiles whose saver is On first show `Screen saver missing` (large, the 1750 Hz warning tone, plan 16); virgin: no response.                                                                                                                                       | `out-p2-factory/1*-screensaver*`, plan 16 notes     |
| C11 | **Topics:** virgin five box-glyph topics (Select multi-select, Edit `Topic number:` with junk such as `p9`, then `Topic name:`; Erase `Topic erased`); factory `Add topic` only → `Topic number:`.                                                                                                                                                                                                                                                   | plan 14 goldens, plan 15 scrolls, `out-p1-factory/` |
| C12 | **Chat:** `Phone number:` (`Search`) → `Chat name:` → the T9 editor with counter `140/1` → Options: Send, Template, Insert smiley, (Matches with a composed word), Insert word, Insert number, Insert symbol, Dictionary, Chat name, Erase, Exit (indicator `3-n`). An SMS from the partner during Chat (even on the `Insert word:` prompt) shows `>Hey back` with `OK`. Held C on the Options list returns to standby.                              | plan 18 `out-p4/c*`, `out-p7/`                      |
| C13 | **Service command editor** (factory): pen header, counter `182`, soft key `Back` while empty.                                                                                                                                                                                                                                                                                                                                                        | `captures/6.39/plan16/notes/2-10`                   |
| C14 | The emulator's network has SMS (text and binary to a port) and incoming calls only: no USSD, no cell broadcast.                                                                                                                                                                                                                                                                                                                                      | `tools/nokia-dct3-emulator/src/web/main.c`          |

### Where the preloaded content comes from (the brief's research question)

- **Templates and smileys:** the virgin PPM E and B images have no working lists; the
  factory-restored v6.39 image has eight slots each (five texts and three empty slots). The
  previous worker reports matching defaults in the firmware text table (C6). This supports
  firmware defaults copied into EEPROM by Restore. The scratch probes did not record a fresh
  Restore or first boot with a known-empty content area, so they do not prove factory-line
  provisioning or first-boot copying. Task 0 F captures that transition and edited-slot reset.
- **Pictures:** native v5.79 has eight stored slots followed by six 72×28 pictures. The prior
  worker reports the same six bitmaps in both MCU versions and copies in the virgin PMM.
  That cross-check has no retained comparison script/hash manifest, so it remains corroborating
  evidence to reproduce in Task 0 R/V. v6.39 receives and displays an invented picture but
  stalls on Save. The exact cause and a valid v6.39 directory have not been established.
- **Content policy:** derive LCD-visible text and art from canonical captures through the
  committed importer. Firmware tables may guide local research, never feed a repo generator.
  If a required item can only be recovered from extracted data, a researcher extracts it locally
  and writes a behaviour/format spec; a separate clean-room implementer uses own or open content.
  Record provenance and licence. That replacement must not be called pixel-exact stock content.
  The strict stock-content task stays incomplete until captures exist.
- **T9 isolation:** do not read `$REF/t9` or `$REF/captures/plan18b`, import their scripts, or use
  firmware candidate lists for Chat expectations. Read `docs/specs/t9-behaviour.md` and plan 18b's
  approved dictionary interface. Chat captures use invented user words or dictionary-independent
  screens; prediction tests use the fixture/open dictionary. A source may be safe for UI mechanics
  while its candidate pixels remain unsuitable as goldens.
- **Topics:** preserve captured virgin box glyphs and junk numbers; factory state is `Add topic`.

**Resume audit (2026-10-14):** retained the eight scratch probes and logs. Re-read `NOTES.md`
and drivers; checked the insertion counters (447/1, then 444/1) and v5.79 stored/built-in Options
via the existing OCR helper. `p2`'s Topics navigation is off by one and `p7` never successfully
turned Dictionary off; neither proves those behaviours. No new capture process was started.
The draft's factory-provisioning claim and composed-picture fallback are withdrawn below.

## Scope and non-goals

In scope: the Goal items; additive nokia-os contract changes (D6); captures, goldens, glyphs,
sprites, picture bitmaps, sound goldens; documentation.

Out of scope (owner in brackets): the screen saver itself at standby (the picture after the
timeout; unowned, proposed for 25, Open question 5); receiving Info service messages (the emulator
has no cell broadcast, C14; unowned); USSD answers (no emulator support; D12); ringing tones and
operator logos over SMS (27 and unowned); the hidden main-menu `Picture` entry (0x047, never shown
on the 3310); a picture editor (the 3310 has none); templates in other UI languages (26); Cyrillic
input (26); any website change.

## Decisions

Each decision states what changes relative to the brief and to plans 13-19.

**D1 - Four feature modules, one plan (new; the brief's split).** `features/templates.ts`
(Templates, Smileys and the editor's Template/Insert smiley), `features/picture-messages.ts`
(2-4, incoming and outgoing pictures, Screen saver › Screen saver), `features/chat.ts` (menu 3 and
Inbox › Chat; it replaces the existing placeholder module), `features/info-service.ts` (2-8-4
Topics and the 2-10 Service command editor, the two network-service leaves; it takes Info
service's existing setter/note/reset tables from the split owner's transfer, before Task 9). Business-card receipt lives in `picture-messages.ts` beside the other Smart Messaging
arrival (the same binary-SMS path, D6).

**D2 - Captures or clean room; no extracted stock-content import.** Generate template/smiley
texts from factory Read captures and insertion cursor/counter probes, including trailing spaces.
Generate picture art only from verified v6.39 views. v5.79 is comparative evidence, not a fallback
source of v6.39 flow goldens. The stock-content provenance record lists source image hashes,
capture paths, crop rectangles and text runs. The extraction-only branch follows the clean-room
policy above; it never silently substitutes own art for the strict reproduction.

**D3 - Templates and smileys are EEPROM records whose `factory()` writes the defaults (new; plan 15
D2/D5).** `templates` (v1) and `smileys` (v1): 8 slots each (`string | null`, null = `(empty)`;
Task 0 confirms the count and whether texts can be added beyond 8). Virgin: no record → 2-5, 2-6,
Template and Insert smiley keep the captured no-response (plan 14's golden stays asserted for 2-5
and 2-6). `factory()` writes the defaults if Task 0 F verifies this transition; whether it overwrites a user-edited template comes from
Task 0 F. Edit opens plan 18's editor on the text (count style and limit from Task 0); Save/Erase write the slot and show the query/note text and timings measured by Task 0 T.
`Template saved`, `Smiley saved`, `Template erased` and `Smiley erased` are research targets,
not yet captured outcomes. Plan 15 D4 stands: an empty storage is the virgin
EEPROM (Open question 1).

**D4 - Preserve virgin no-response; gate picture-folder work on v6.39 evidence.** The scratch
Save stall suggests unusable picture storage, but does not establish a particular directory fault.
Task 0 R tries a firmware-driven reset on disposable image copies, then a documented EEPROM
repair. Accept a repair only when the folder, Save, reboot persistence and neighbouring features
work. The repaired image is a separate test state, never the default virgin state.

If R fails, retain the virgin no-response goldens and `18c` placeholders for unverified picture
folder, Save/Forward and screen-saver flows. Record them as a capture dependency. Implement the
verified incoming notice/view independently where possible. Do not compose a folder from v5.79,
firmware strings or template layouts; do not claim 18c complete while those tasks remain blocked.
If only extraction yields content, use D2's clean-room branch and record the fidelity limitation.

**D5 - Pictures are 72×28 1-bit art; the EEPROM slots hold received and saved pictures (new).** The
`pictures` record (v1) holds the slots (capacity from Task 0 P; eight is a v5.79 hypothesis until verified on v6.39) with the picture,
its text, the sender, the time stamp and the name rule Task 0 records (the sender or
`Picture %N`). The built-in pictures are not stored (ROM): they cannot be erased (C7); Task 0 must establish whether Edit text on a built-in stores a slot copy or an overlay;
do not choose a persistence rule from the v5.79 first screen alone. `No space for
new pictures`, `Old picture replaced` and `Save picture message first?` follow Task 0 P.

**D6 - Picture messages and business cards travel through plan 18's network port (contract change,
additive).** `deliver` accepts a picture message (`kind: "picture"`) and a business card
(`kind: "business-card"`) besides plan 18's SMS (no `kind`); `StockNetworkPort` gains an optional
`sendPicture`, settled like plan 19's `sendBusinessCard` (absent = `"sent"` after the phone's link
time). The phone shows each arrival with the captured notice and link time (`PICTURE_LINK_MS`,
`BCARD_RECEIVE_LINK_MS`: Task 0 medians; a picture is 3 concatenated SMS on the air, C9). Pictures
from hosts are validated (28 rows of 72 `#`/`.`; text within the limit Task 0 measures); a bad one
throws from `deliver`, naming the field. The port still carries no protocol detail: no ports, no
OTA bytes, no vCard text. A received business card's Save goes to plan 19's
`StockPhoneBook.add` (`Saved`, `Memory full` as plan 19 captured).

**D7 - Screen saver › Screen saver is the gallery over the folder; the standby saver is not this
plan's (new; Open question 5).** The gallery shows the folder's pictures one per screen with the
indicator (`n`), ▲/▼ and `Use` → the note Task 0 S verifies (`Screen saver selected` is a research target) and stores
the choice under the profile's screen-saver keys (plan 14's aliases). `Screen saver missing`
(before the gallery when the profile's saver is On and no picture is chosen, C10) keeps plan 16's
warning tone. Displaying the saver at standby after the timeout is out of scope.

**D8 - Chat is a flow over plan 18's messaging; partners are whoever the host network answers as
(new; no contract change).** Chat sends each line with `StockMessaging.send` (the network port's
`send`, plan 18 D9) in the exact text the firmware puts on the air (Task 0 C reads it from the
emulator's `MO SMS … text=` log: with or without the chat name). An SMS delivered from the chat's
number while Chat runs is shown in the history (`>` line, `OK`) and, per Task 0 C, stored in the
Inbox or not. A host that answers chat numbers (a later portfolio integration with the website's
LLM persona) only implements `StockNetworkPort`. The website's
`website/src/phone/applications/chat.ts` stays as it is.

**D9 - Chat's screens follow the captures; the editor is plan 18's with 18b's T9 (new).** `Phone
number:` is plan 18's `numberEntry` (`Search` → plan 19's picker; the empty-phone-book note is valid only for an empty book), `Chat name:` plan 18's `textInput` (prefilled per Task 0 C), the editor plan 18's
`editor` with the chat counter (`140/1` style, the limit from Task 0) and the Options list of C12.
The history screen (`<` own lines, `>` partner lines, wrapped, scrolled, `OK` back to the editor)
is a new painter measured from Task 0's goldens. Whether Chat shares `messages/dictionary` with
Write messages comes from Task 0 C. The chat name persists in a `chat` record (v1) if Task 0 shows
it survives a power cycle, else it is session state.

**D10 - Arrivals elsewhere follow plan 18 (dependency).** A picture message or business card
arriving at standby uses plan 18's notice mechanism (`setNotice({ open })`) with the captured texts
and `View`; elsewhere it does what Task 0 records, through the interface plan 18 Task 1 added if one
was needed. A partner SMS during Chat is routed by the messages service to the running chat
session (an internal subscription; no phone-core change).

**D11 - Topics: a record with virgin junk and an empty factory value (new; plan 17 D2's slot-6
precedent).** `info-topics` (v1): the topic list. Keep the virgin display number as a string (including junk such as `p9`)
separate from a validated user-entered topic ID. Task 0 establishes valid bounds; `0-999` is
a provisional hypothesis. Virgin: the five
topics the plan 14 goldens show, names of U+E000 boxes and junk numbers (`p9` included) as
captured, so every `2-8-4-*` golden is asserted. `factory()` empties it (plan 15's captured `Add
topic`). Flows: Add topic (`Topic number:` numberEntry, `Topic name:` textInput, `Topic added`),
Select (plan 14's multi-select over the topics; the marks stored), Edit (number, then name), Erase
(`Topic erased`), and the empty and full cases Task 0 I records. Receiving info messages is out of
scope (C14).

**D12 - Service command editor: plan 18's editor; Send shows what the emulator shows (new).**
Counter `182`, `Back` while empty; the soft key and Send flow after typing come from Task 0 X. If
the request never completes (expected: no USSD, C14), capture its actual request/result UI; `Requesting` with `Quit` → `Request not confirmed`
is a hypothesis based on plan 14's network-request widgets, not a captured 2-10 result. No network interface for USSD (Open
question 6).

**D13 - Glyphs and sprites (extends plan 18 D6).** The U+E000 box in the small faces (topics), the
`<`/`>` history marks, the Templates row icon, picture-folder row icons (if any), the picture
message notice icon and every new note's art are harvested from Task 0's goldens. Every default
template and smiley character renders in `small` (test).

**D14 - Notes, timings and sounds come from the goldens (plan 14 D8, plan 16 D12).** Research targets for note
classes (`Template saved`, `Template erased`, `Smiley saved`, `Smiley erased`, `Picture message
saved`, `Picture message erased`, `Old picture replaced`, `No space for new pictures`, `Topic
added`, `Topic erased`, `Screen saver selected`, `Sending picture message`, `Picture message sent`,
the business-card notes) get generated timelines only when their own captures verify them, and their warning tones (if any) come from Task 0
N's sound goldens through plan 16's `NOTE_SOUNDS`. Arrival alerts reuse plan 18's message alert
(plan 16's `messageAlert`).

**D15 - The website does not change.** `git diff --stat <commit before Task 1> -- website/` is empty
at the end. `website/src/messages/**`, `website/src/phone/applications/{sms,chat}.ts` and
`/api/sms` stay the portfolio's LLM messaging; they meet nokia-os only through `StockNetworkPort`
at integration time.

## Ground truth and artefacts

| Source                                                   | Contents                                                    | Use                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| plan 14 goldens `tree/02-messages/*`, `menu/03-chat.sub` | virgin first screens, the box-glyph topics                  | asserted (re-owned `18c`; virgin covers remain unchanged under D4) |
| `captures/6.39/plan15/factory/scroll/2-8-4*`             | factory Topics                                              | evidence (D11)                                                     |
| `captures/6.39/plan16/notes/{2-5,2-6,2-10,3,5-9-4,…}`    | factory first screens with sound                            | evidence; their sound goldens become asserted (Task 10)            |
| `captures/scratch-plan18c/` (planning)                   | C1-C14                                                      | evidence for the decisions; never imported                         |
| `captures/6.39/plan18c/<section>/` (Task 0)              | canonical recaptures, LCD and audio                         | goldens                                                            |
| `captures/scratch-plan18c/out-p6-v579/`                  | the v5.79 views of the six built-in pictures and the folder | comparative research only; never imported as v6.39 behaviour       |
| `captures/6.39/plan18c/text.json` (Task 0)               | OCR runs (plan 14 format)                                   | template/smiley texts, text runs, label checks                     |

New artefacts (spec, Task 1):

| Artefact                                                 | Cause                                                  | Handling                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Picture messages and Screen saver do nothing; Save hangs | picture-directory/emulator fault suspected, not proven | repair attempt planned (D4); preserve virgin no-response; gate repaired-state flows on R |
| Screen saver gallery on junk slots, then a UI stall      | cause unproven; plan 15 records an emulator fault      | blocked on verified repaired-state captures (D4, D7)                                     |
| Picture arrival ≈16.2 s, chat and card link times        | synthetic cell, concatenated SMS                       | phone link times (D6; plan 18 D10 policy); UNVERIFIED live                               |
| Templates and smileys absent until Restore               | virgin EEPROM                                          | reproduced (D3; Open question 1)                                                         |
| Topics of box glyphs and junk numbers                    | uninitialised EEPROM                                   | reproduced as the virgin state (D11)                                                     |
| Service commands never answered                          | no USSD in the emulator                                | reproduced as captured (D12); UNVERIFIED live                                            |

## Package boundaries

Unchanged from plans 13-19. nokia-os gains no dependency and touches no network or audio API: the
host port is the only way in or out. phone-core does not change in this plan (D10 routes chat
arrivals inside nokia-os). Nothing under `$REF` is read by tests.

## Contract changes

Task 1 writes these into `VISION.md`.

### `@hellotimber/nokia-os` (additive)

```ts
/** Plan 18c: a picture message's picture: 28 rows of 72 characters, `#` = ink, `.` = blank. */
export interface StockPicture {
  readonly rows: readonly string[];
}

/** Plan 18c: a picture message as the phone sends or receives it. */
export interface StockPictureMessage {
  readonly number: string;
  readonly text: string; // may be empty; within the limit Task 0 measures
  readonly picture: StockPicture;
}

export interface StockIncomingPictureMessage extends StockPictureMessage {
  readonly kind: "picture";
  readonly sentAt: StockTimestamp;
}

/** Plan 18c: a business card arriving over SMS (plan 19's `StockContact`). */
export interface StockIncomingBusinessCard {
  readonly kind: "business-card";
  readonly number: string;
  readonly card: StockContact;
  readonly sentAt: StockTimestamp;
}

/** Plan 18c: what a host may deliver. Plan 18's `StockIncomingSms` (no `kind`) is a text SMS. */
export type StockIncoming =
  | StockIncomingSms
  | StockIncomingPictureMessage
  | StockIncomingBusinessCard;

export interface StockNetworkPort {
  // ...plan 18 and 19 members unchanged, except:
  /** Called once by `createStockPhone`; the host calls `deliver` for each incoming message. */
  subscribe(deliver: (message: StockIncoming) => void): () => void;
  /** Plan 18c: a picture message (Forward). Absent = settled "sent" after the link time. */
  sendPicture?(message: StockPictureMessage): StockSendOutcome | Promise<StockSendOutcome>;
}

// createSyntheticNetwork(): `deliver` takes a `StockIncoming`; gains
// `readonly pictures: readonly StockPictureMessage[]` (what phones sent with `sendPicture`).
```

Rules (Task 7 pins each with a test): a host calling plan 18's `deliver(sms)` is unchanged; a
picture with the wrong row count, row width or characters, or a card failing plan 19's contact
rules, throws from `deliver` naming the field; `sendPicture` follows plan 18's `send` rules (a
rejected promise is `"failed"`, outcomes after power-off are ignored); deliveries while off wait
for standby (plan 18's rule).

## Internal API

Signatures are fixed by Tasks 4-9; a change is a Deviation recorded here.

```ts
// src/content/slots.ts (pure): templates and smileys
export interface TextSlots {
  readonly slots: readonly (string | null)[]; // null = (empty)
}
export const TEMPLATES_RECORD: EepromRecord<TextSlots>; // factory(): STOCK_TEMPLATES
export const SMILEYS_RECORD: EepromRecord<TextSlots>; // factory(): STOCK_SMILEYS

// src/content/pictures.ts
export interface PictureEntry {
  readonly picture: StockPicture;
  readonly text: string;
  readonly name: string; // the sender or `Picture N`, per Task 0
  readonly builtIn: boolean;
  readonly sender?: string;
  readonly sentAt?: StockTimestamp;
}
export const PICTURES_RECORD: EepromRecord<PictureSlotsState>;
export class StockPictures {
  constructor(eeprom: StockEeprom);
  list(): readonly PictureEntry[]; // slots in use, then ROM_PICTURES (order per Task 0, D4/D5)
  save(message: StockIncomingPictureMessage): "saved" | "replaced" | "full";
  erase(index: number): void; // throws for a built-in picture
  setText(index: number, text: string): void;
}
export function validatePicture(picture: StockPicture, field: string): void;

// src/content/topics.ts
export const INFO_TOPICS_RECORD: EepromRecord<TopicsState>; // virgin junk, factory() empty

// src/chat/session.ts
export class ChatSession {
  constructor(messaging: StockMessaging, number: string, name: string);
  lines(): readonly { readonly from: "me" | "them"; readonly text: string }[];
  send(text: string, settled: (outcome: StockSendOutcome) => void): void;
}

// src/widgets/picture-view.ts, gallery.ts, chat-history.ts
export function pictureView(options: PictureViewOptions): Widget;
export function pictureGallery(options: GalleryOptions): Widget;
export function chatHistory(options: ChatHistoryOptions): Widget;
```

Setting keys added: the per-profile screen-saver picture choice (under plan 14's aliases; the key
name is fixed in Task 6). Records added: `templates`, `smileys`, `pictures`, `info-topics`, and
`chat` if D9's condition holds, each registered through its feature's `records`.

## Golden pipeline additions

The capture set is `scripts/capture-sets/18c-chat-templates-pictures-info-service.ts`, an explicit
table like plan 19's. IDs are `pending:18c` until their implementation task supplies a passing driver; every
asserted ID has a scenario in its owning acceptance file:

| Fixture id(s)                               | Source (`$REF/captures/`)                   | Kind               | Asserts                                                                                     |
| ------------------------------------------- | ------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| `content/restore-*`                         | `6.39/plan18c/factory/*`                    | timelines / stills | Restore, then the 2-5 and 2-6 lists; Restore over edited slots                              |
| `content/templates-*`, `content/smileys-*`  | `6.39/plan18c/templates/*`, `smileys/*`     | timelines / stills | lists, Read, ▼, Options, Edit (editor, Save), Erase (query, note), `(empty)` slots          |
| `content/editor-*`                          | `6.39/plan18c/editor/*`                     | timelines          | Template and Insert smiley from Write messages, Reply and Chat; at the limit                |
| `pictures/folder-*`, `pictures/view-*`      | `6.39/plan18c/pictures/*`                   | timelines / stills | the folder, each built-in picture's view, each Options set, Edit text, Erase, Details       |
| `pictures/arrive-*`, `pictures/save-*`      | `6.39/plan18c/arrive/*`                     | timelines          | notice, View, scroll, Save, full, replaced, arrivals elsewhere                              |
| `pictures/send-*`                           | `6.39/plan18c/send/*`                       | timelines          | Forward: `Phone number:`, `Sending picture message`, `Picture message sent`                 |
| `pictures/rom-<n>`                          | `6.39/plan18c/rom/` (after verified repair) | stills             | one real viewer scenario per built-in picture, plus crop freshness/integrity                |
| `screen-saver/*`                            | `6.39/plan18c/screen-saver/*`               | timelines          | the gallery, ▲/▼, `Use`, `Screen saver missing` per profile                                 |
| `chat/*`                                    | `6.39/plan18c/chat/*`                       | timelines / stills | number, name, editor, Options, Send, history, partner and other arrivals, Inbox › Chat      |
| `topics/*`                                  | `6.39/plan18c/topics/*`                     | timelines / stills | virgin Select/Edit/Erase, factory Add topic, adding and erasing to the full and empty cases |
| `service-command/*`                         | `6.39/plan18c/service-command/*`            | timelines          | editor, typing, Send, `Requesting`, Quit                                                    |
| `bcard/*`                                   | `6.39/plan18c/bcard/*`                      | timelines          | notice, View, Save (phone book), C, a full phone book (plan 19's fixtures)                  |
| `sound/note/<name>`, `sound/picture/arrive` | `6.39/plan18c/notes/*`, `arrive/*`          | sound              | warning tones of the new notes, the arrival alert (plan 16's format)                        |

The shared `tree/02-messages/2-4.leaf` retains all virgin no-response covers. Assert it only
when every covered node's virgin behaviour is implemented. Its index stays in plan 14.
`menu/03-chat.sub` stays in plan 13. Plan 16 sound fixtures stay in plan 16. Never list these IDs
in 18c's `scenarios`: the guard rejects scenarios for another index. Their owning acceptance
files need their own drivers/status registrations (the owner prerequisite below).

Every new asserted resource still also needs a scenario: current `acceptancePlan` has no
resource exemption. For a built-in picture still, drive the captured viewer in the verified
image state. No scenario means keep it pending, not an asserted fixture with an integrity-only
test. During Task 2 use `pending:18c`, then assert each group when its task supplies drivers.
No `awaitsPlan18cScenario` escape hatch or shared guard edits.

## Owner prerequisites and current discrepancies

The split already exists in this checkout. Existing code provides `StockFeature.screens`,
`records`, `widgets` and `settings`; `stock.ts` composes them and rejects duplicate bindings.
The planned plan 18/18b text widgets and messages services are not implemented yet. Check their
landed contracts before implementation; stop and report drift instead of adapting shared code.

Shared runtime files receive registration lines only. These prerequisites belong to their
owners; this plan documents the required changes without assigning 18c workers their internals:

| Owner                                      | Required result before dependent task                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18, before Tasks 5/8                       | `src/messages/bindings.ts` exposes editor-option registration for Template/Insert smiley and Inbox Chat, including the live editor state and insertion callback. Register handlers by one line per option; every caller uses the same options.                                                                                                                                      |
| 18, before Task 7                          | `src/messages/network.ts` supports D6's incoming union/outgoing picture contract via a one-line type/handler registration from `src/content/network.ts`. `src/messages/service.ts` supports delivery dispatch and session subscriptions with cleanup. Exactly one subscription per phone; no second SMS transport. The default synthetic network supports registered message kinds. |
| 18, before Task 8                          | Chat can subscribe to partner SMS before normal Inbox handling and report whether an arrival was consumed. This hook is required, not a current API. Capture decides Inbox storage.                                                                                                                                                                                                 |
| Split owner, before Task 9                 | Info service's existing `setterLevels`, `noteEnds`, language factory default and topic placeholders move intact from `features/messages.ts` into `features/info-service.ts`. No duplicate binding during the transfer. 18c then extends this feature.                                                                                                                               |
| Resource tooling owner, before Task 3      | A one-line registration imports 18c's glyph/text-run/crop/timeline provider into the shared resource pipeline. Current `extract-resources.ts` has fixed output tables; the registration mechanism is a prerequisite, not permission for a broad rewrite.                                                                                                                            |
| 13/14/16 acceptance owners, before Task 10 | Existing owned IDs can be asserted with drivers imported from `tests/support/18c-content.ts`, one registration per ID/group, while remaining in their original indexes. Remove the `18c` group from tree/sound placeholder tables only when its whole covered set works.                                                                                                            |
| 19                                         | Task 5 provides `StockPhoneBook.add` for card Save; Task 10 provides the name picker for Chat Search. Both are completion dependencies for those flows, not substitute behaviours.                                                                                                                                                                                                  |
| 17                                         | Profile-specific gallery captures need profile selection/alias behaviour. Test direct Personalise leaves independently while waiting; do not change Profiles.                                                                                                                                                                                                                       |

`regenerate` is a Vite+ task defined in `packages/nokia-os/vite.config.ts`. Use
`mise exec -- vp run @hellotimber/nokia-os#regenerate` for shared generated resources.
No package build script or new dependencies are required.

## Conventions for every task

- Paths below are under `packages/nokia-os/` unless they begin `docs/` or `VISION.md`.
- TDD: write and run the failing behaviour test before implementation; import APIs from
  `vite-plus/test`. Unit tests use invented inputs; acceptance uses independently captured pixels.
- Every implementation task runs `mise exec -- vp run @hellotimber/nokia-os#test` and
  `mise exec -- vp check --fix` before its commit. Closeout also runs all workspace tests and
  the website build. Never claim a pending golden is verified.
- Run `mise exec -- vp fmt <explicit files>` twice until stable. Stage explicit owned paths;
  run `git commit --no-verify -m "<task message>"` only after the manual checks. Never stage
  `TODOS.md`, never stash, never stage another worker's files.
- This design assignment writes only this plan and row 18c of the index; it implements nothing
  and makes no commit. Commit lines below are instructions for future implementation tasks.
- Goldens and generated resources are importer/generator outputs. Never edit them by hand.
  Run generators twice and prove the second run changed no bytes. Tests never read REF.
- New capture-set export: `scripts/capture-sets/index.ts`, one line. Feature exports:
  `src/firmware/features/index.ts`, one line each for the three new modules; Chat is registered.
  Widget variants/painters and resource providers each get one registration per variant/provider.
  No changes to `stock.ts`, acceptance guard internals, `demo/main.ts` or generated stock tree.
- Work is sequential unless the task coordinator explicitly delegates independent modules.
  Capture groups can run in isolated processes with bounded waits; no worker alters the common
  REF harness while plan 18 owns it. Use the retained private harness or an isolated copy.
- If evidence or a prerequisite is missing, finish independent verified work and record the
  dependency. Do not invent stock behaviour or mark the whole plan done.

Execution order: Task 0 supplies evidence; Task 1 pins contracts; Task 2 imports pending
fixtures; Task 3 derives resources; Task 4 models records; Tasks 5-9 implement their feature
and assert its scenarios; Task 10 checks ownership; Task 11 closes out. Task 3 also waits for
plan 18's glyph/text resources. Tasks 6/7 have the D4 picture gate; Task 8 has the 18b/19 gates.
Independent verified groups can finish while a capture or owner dependency is unresolved.

## Tasks

### Task 0 - Complete research and capture the v6.39 flows (REF only)

**Files:** explorations only under `$REF/captures/scratch-plan18c/` (tools, image copies, logs,
notes). After verification, canonical generator `$REF/captures/scripts/gen_v639_plan18c.py`,
command logs `v639-plan18c-<section>.cap`, captures `$REF/captures/6.39/plan18c/**` and a small
append to `$REF/captures/README.md`. v5.79 outputs remain comparative scratch evidence.

- [ ] Inventory existing p1-p8 outputs before rerunning. Keep failed navigation and negative
      results; p2 Topics and p7 Dictionary-off are incomplete, not canonical evidence.
- [ ] Use `scratch-plan18c/harness/build/dct3cap` with its retained `smsbin` command, or build
      another isolated copy. Do not modify `tools/harness/*` or emulator sources. Only the plan 18
      worker may update the common harness. Keep all experimental image mutations in scratch.
- [ ] **R picture directory (bounded research, maximum 3 hours):** try a fresh Restore on an image
      copy, PPM E versus B, native v5.79, then documented EEPROM experiments. Prefer calling
      firmware initialisation in context over guessed writes. Record image hashes, every mutation,
      results and failures. A repair succeeds only if folder, incoming Save, reboot persistence,
      Templates, Inbox and Restore work; capture raw and repaired states separately. If it fails,
      keep the picture-folder capture dependency explicit (D4). Do not broaden the time box.
- [ ] **F defaults:** record virgin lists, fresh Restore with accepted code, factory lists, Read
      of every entry and every page of long templates. Edit/erase a default and fill an empty
      slot; Restore again; saveflash/reboot. Compare PPM language defaults after Restore. Capture
      first boot separately from reset; distinguish observation from factory-provisioning inference.
- [ ] **T lists/editing:** eight slots and wrap both directions, row icon/text origin, truncation,
      Read, Options, Edit keys/counter/limit, empty Save, Erase confirmation/cancel and notes.
      Establish actual capacity rather than assuming a ninth slot can be added.
- [ ] **E insertion:** Template and Insert smiley in Write, Reply/Edit/Forward and Chat; empty,
      middle of text, T9 on/off, pending multi-tap/composing T9 word, truncation/overflow and cursor
      placement at the limit. Measure trailing spaces using counter and cursor, not OCR alone.
- [ ] **P pictures, after R:** list/order/capacity, all six built-in views, stored views with text,
      scroll/wrap, each Options set, Edit text (copy versus overlay), Erase, Use number, Forward,
      Details and Exit. Fill memory; capture replacement/full queries and notes. Establish Restore
      retention. Native v5.79 cannot replace v6.39 scenarios or prove v6.39 slot capacity.
- [ ] **A arrivals:** invented picture from `tools/pic.py`, no text and long text, standby notice,
      View/scroll/Save/C; menu/editor/Chat/game arrival, two arrivals before Save. Five arrival
      timings including key/injection timestamps; keep all concatenated-part logs. Card payloads
      use invented vCard text (port 9204); picture payload uses port 5514. Payloads stay REF-only.
- [ ] **S send/gallery, after R:** forward built-in and stored pictures; keep MO logs with the
      scratch driver's `ROM6_LOG=1` flag; repeated send timings. Tones/profile galleries, Off/On,
      missing image, selection and persistence. Record 30 seconds at standby as follow-up evidence.
- [ ] **C Chat:** Menu 3 and Inbox Chat; number/Search/name, name prefill/empty/cancel, T9 header
      and `140/1` boundaries, Options with and without composed word. Send and exact on-air text,
      successful/failed send, wrapped multi-line history, scroll, OK/C/held C/Exit. Partner and
      unrelated SMS in editor/Options/prompt/history, Inbox/Outbox effects, dictionary sharing,
      session exit/re-entry and cold reboot. Use invented user words for dictionary-dependent
      states; never read forbidden T9 research directories or firmware candidate output lists.
- [ ] **I Topics:** navigate by verified highlighted label, not assumed index (p2 lesson).
      Virgin five box-glyph names/numbers/marks; Select Mark/Unmark/exit; Edit number/name;
      Erase to empty. Factory Add topic, 0/999/1000 and empty/duplicate cases, name length, capacity,
      menus with existing topics, full note, persistence and Restore. Record actual dynamic order
      and path numbering so `Add topic` does not overwrite existing Select's identity.
- [ ] **X Service command editor:** empty header/counter `182`/Back, digits/letters/`*`/`#`, limit,
      Options/Send, `*100#` for 20 seconds, Quit/C and result. No USSD reply invention.
- [ ] **B cards:** receipt/View/Save/C and full phone book using plan 19's isolated SIM fixtures.
      Gate on plan 19; do not edit its SIM or storage implementation.
- [ ] **N/G:** audio/events/keys.csv for new notes with Warning tones On/Off; glyphs for default
      texts, Topics boxes and `<`/`>`; crop provenance. Extraction comparisons stay local and
      record their manifest; no generator consumes extracted tables or bitmaps.
- [ ] Promote only successful scripts into canonical sections; implement `--only`, `ocr`, `check`
      and bounded runs. Each section restarts a documented image/setup state. Use `record` before
      trigger, same-name audio and key logs; OCR to `text.json` (plan 14 format). `check` verifies
      parent/notice frames, complete recordings and fixture payload identity.
- [ ] Append findings briefly to REF README. Record outcome here: capture counts, exact layouts,
      limits, medians/spread, repair success/failure, default provenance, on-air Chat text,
      storage/reset rules, language comparison and unresolved dependencies. No commit.

### Task 1 - Contracts and firmware specification

**Files:** this plan, `docs/specs/stock/chat-and-content.md` (new),
`docs/specs/nokia-3310.md` (§10 pointer), `VISION.md` (contract registration),
`docs/plans/README.md` (row 18c).

- [ ] Resolve D3-D12 from Task 0; qualify remaining hypotheses. Publish the source/provenance
      inventory and clean-room rule. Record picture repair separately from virgin defaults.
- [ ] Document D6 types and host behaviour; Chat remains SMS through plan 18's network port.
      Confirm owner prerequisites, exact landed widget APIs and paths before dependent work.
- [ ] Keep menu-tree corrections in the new spec and a pointer; its owner updates the shared
      menu-tree spec. The factory-provisioning mechanism is UNVERIFIED until directly established.
- [ ] Row 18c becomes `in progress` only when implementation starts.
- [ ] Verify: manual `mise exec -- vp check --fix` and scoped formatter twice.
- [ ] Commit: `docs: define chat and Messages content contracts (plan 18c)`.

### Task 2 - Capture set and initial acceptance registration (TDD)

**Files:** `scripts/capture-sets/18c-chat-templates-pictures-info-service.ts` (new),
`tests/capture-sets/18c-chat-templates-pictures-info-service.test.ts` (new),
`tests/support/18c-fixtures.ts` (new), `tests/acceptance/18c-chat-templates-pictures-info-service.test.ts` (new),
`scripts/capture-sets/index.ts` (one export), generated `goldens/index/18c.json` and listed grids.

- [ ] Failing synthetic-loader tests pin source paths, state, fixture ID uniqueness, trigger frame,
      source hash, omitted frames and sound alignment. Import no scratch images or v5.79 flows.
- [ ] Export a `PlanCaptureSet` with `plan: "18c"`, `lcd`/`sounds` and `notImported`; only verified
      groups enter the table. Explicit invented fixtures live in `tests/support/18c-fixtures.ts`;
      the REF generator reads the same fixture data supplied as an argument, not repo runtime code.
- [ ] Initial new fixtures use `pending:18c`. The acceptance file calls
      `acceptancePlan({ plan: "18c", scenarios, knownGaps, timeoutsMs })` once, no other tests.
      Assert groups as Tasks 5-9 add their independently driven scenarios. No todo/guard shim.
- [ ] Preserve older indexes/covers. A pending golden remains in its original owner index.
- [ ] Run twice: `mise exec -- vp run @hellotimber/nokia-os#import-captures /Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310`. Compare byte manifests before/after the
      second run; scope output changes to this plan plus explicit owner status registrations.
- [ ] Verify: package test and manual `vp check --fix`. Report fixture/image/byte counts.
- [ ] Commit: `feat(nokia-os): import Chat and Messages content captures (plan 18c)`.

### Task 3 - Capture-derived content resources (TDD)

**Files:** `scripts/content-resources.ts` (new), `scripts/content-text-runs.ts` (new),
`src/resources/generated/content.ts` (generated), `tests/content-resources.test.ts` (new),
resource-provider and `src/resources/index.ts` registrations (one line each).

- [ ] Failing synthetic-golden tests pin OCR/golden agreement, multi-page text reconstruction,
      null empty slots, trailing-space evidence, binary crops and malformed-input errors.
- [ ] Emit `STOCK_TEMPLATES`, `STOCK_SMILEYS`, and verified `ROM_PICTURES` with source citations.
      Record glyphs, icons and named note timelines through the owner's provider interface.
      No blanket changes to shared `widget-sprites.ts`, `glyph-overrides.ts` or resource tests.
- [ ] Each generated picture equals its independently imported v6.39 viewer crop (72×28 at the
      measured origin). Every default text renders in the required stock faces. Resource stills
      receive real viewer scenarios before becoming asserted.
- [ ] Emit measured arrival/send timings with sample count and spread. Use plan 16's sound
      format/comparison rather than asserting WAV synthesis. Reuse existing sound programs.
- [ ] Run twice: `mise exec -- vp run @hellotimber/nokia-os#regenerate` (owner registers
      the provider); prove idempotence and freshness. Verify package test and manual `vp check --fix`.
- [ ] Commit: `feat(nokia-os): derive Messages content resources from goldens`.

### Task 4 - Persistent content records (TDD)

**Files:** `src/content/{slots.ts,pictures.ts,topics.ts,index.ts}` (new),
`src/chat/record.ts` (only if captured persistence), `tests/content-records.test.ts`,
`tests/picture-store.test.ts` (new).

- [ ] Failing tests over host storage pin virgin absence, factory defaults, immediate writes,
      reloads, schema version and decode rules consistent with plan 15; Restore over edited slots.
- [ ] Topics encode valid IDs separately from captured junk display strings. Marks/order/names,
      add/edit/erase bounds, duplicate/full behaviour and factory-empty state follow I captures.
- [ ] Pictures encode slots and any built-in text overlays/copies only after P verifies them.
      Test capacity/order/name/retention, Save/replace/full and erased selection using independent
      expected states. Preserve virgin no-response; repair-state data is an explicit test seed.
- [ ] Register each record through its feature's `records`; no `records.ts` rewrite. Chat name
      gets a record only if cold reboot proves persistence; history retention follows C.
- [ ] Verify package test and manual `vp check --fix`.
- [ ] Commit: `feat(nokia-os): persist templates, smileys, pictures and Info topics`.

### Task 5 - Templates, Smileys and insertion (TDD)

**Files:** `src/firmware/features/templates.ts` (new), `tests/templates-flows.test.ts` (new),
`tests/support/18c-content.ts` (new), the plan's acceptance file; feature and editor-option
registration lines; delete only these nodes' owned placeholder lines.

- [ ] Failing key-driven tests for virgin no-response and factory rows/Read/Edit/Erase, including
      all empty slots, list wrap, truncation and note return selection. Bind nodes 2-5/2-6.
- [ ] Use plan 18 widgets; registered Template/Insert smiley handlers serve Write, Reply/Edit/
      Forward and Chat. Test insertion mid-text, limit handling, trailing space, cursor/counter,
      cancellation, pending multi-tap and composed T9 state from E's captures.
- [ ] Supply scenarios and assert `content/*` only as they pass; older leaf covers stay intact.
- [ ] Verify package test and manual `vp check --fix`.
- [ ] Commit: `feat(nokia-os): implement Templates, Smileys and editor insertion`.

### Task 6 - Picture folder and screen-saver gallery (TDD, R gate)

**Files:** `src/firmware/features/picture-messages.ts` (new),
`src/widgets/{picture-view,gallery}.ts`, `src/display/widgets/{picture,gallery}.ts` (new),
`tests/widgets-picture.test.ts`, `tests/picture-flows.test.ts` (new), plan acceptance/support;
one-line feature/widget/painter registrations and owned placeholder removals.

- [ ] Gate on R's verified v6.39 image. If missing, retain placeholders/pending covers and report
      the dependency; continue verified incoming view work in Task 7. No composed folder fallback.
- [ ] Failing pixel tests use literal models and independent goldens for image origin, text
      wrapping/scroll, icon rows, counter and gallery. Key tests cover folder order/wrap, stored
      versus built-in Options, Edit text, Erase/cancel/full, Use number and Details/Exit.
- [ ] Gallery binds 5-9-4 and profile copies, shares alias policy with 17, saves choice and follows
      captured missing/selected notes. Virgin remains no-response. Standby saver is follow-up.
- [ ] Add `pictures/folder-*`, `view-*`, `rom-*`, `screen-saver/*` scenarios for captured state;
      one state must not satisfy another state's golden by changing its input behind the test.
- [ ] Verify package test and manual `vp check --fix`.
- [ ] Commit: `feat(nokia-os): implement the captured picture folder and saver gallery`.

### Task 7 - Picture and business-card network flows (TDD)

**Files:** `src/content/network.ts` (new), `src/firmware/features/picture-messages.ts`,
`tests/picture-network.test.ts`, `tests/picture-arrivals.test.ts` (new),
`tests/support/18c-fixtures.ts`, plan acceptance/support; one-line network/public-type registrations.

- [ ] Gate on plan 18's registered delivery/dispatch interface. Keep D6 payload types here;
      reuse plan 18 validation for number/timestamp and plan 19 validation for contacts.
- [ ] Failing tests: unchanged text SMS, invalid art/timestamp/text, one send, missing optional
      sender, rejected Promise, late result after power-off, off-phone queue, two arrivals,
      cleanup and phone isolation. Tick sizes 1/16/1000 ms produce identical due event times.
- [ ] Notice/View/C at standby and interruptions elsewhere use captured A/B policy. Picture
      Save/Forward/full notes require P/S captures; do not implement or assert the captured stall
      as a successful Save. Reuse plan 16 message alert and plan 18 `setNotice({ open })`.
- [ ] Business-card View/Save/full/cancel requires B and plan 19 Task 5. If unavailable, keep
      that subtask pending and report it; do not fake a phone book. Add every verified arrival,
      save/send and sound scenario to the plan file.
- [ ] Verify package test and manual `vp check --fix`.
- [ ] Commit: `feat(nokia-os): deliver pictures and business cards through the network port`.

### Task 8 - Stock Chat with T9 (TDD)

**Files:** `src/firmware/features/chat.ts` (existing), `src/chat/{session.ts,index.ts}` (new),
`src/widgets/chat-history.ts`, `src/display/widgets/chat-history.ts`, `tests/chat.test.ts` (new),
plan acceptance/support; one-line Inbox-option/widget/painter registrations.

- [ ] Gate on 18/18b, approved English T9 configuration and plan 18's session-subscription hook.
      Search with names requires 19 Task 10; without it leave that subtask incomplete.
- [ ] Failing tests for number/name/editor entry, empty/cancel/defaults, Options, T9 header/counter,
      Matches/Spell, insertions and limits. Use fixture/open dictionary, no stock candidate list.
- [ ] Session sends exact C-observed text over `StockMessaging.send`; define partner-number match
      policy from captures. Test success/failure, wrapped history, both directions, arrivals in
      editor/Options/prompt/history, other sender, Inbox/Outbox effects and OK/C/Exit/held C.
- [ ] Close subscriptions exactly once on Exit/navigate/power-off; no reply mutates a closed
      session. Chat name/history persistence follows C, not the website persona's behaviour.
- [ ] Add `chat/*` scenarios. Export the Menu 3 first-screen driver for plan 13's existing
      `menu/03-chat.sub`; its owner asserts it in that index/file. Remove Chat's owned placeholder.
- [ ] Verify package test and manual `vp check --fix`.
- [ ] Commit: `feat(nokia-os): implement stock T9 Chat over SMS`.

### Task 9 - Info service Topics and Service command editor (TDD)

**Files:** `src/firmware/features/info-service.ts` (owner-prepared module),
`tests/info-service.test.ts` (new), plan acceptance/support; one-line feature registration
if not already present and owned topic/service-command placeholder removals.

- [ ] Gate on the split owner's table transfer; retain existing Info service On/Off/Topic index
      and Language behaviour. Do not edit their shared owner tables in this task.
- [ ] Failing tests drive virgin Select/Edit/Erase and factory Add topic. Match box counts,
      junk prefill, selection marks, invalid/empty/duplicate/max/full handling, dynamic menu order,
      persisted records and Restore. Use plan 18 number/text widgets with I's measured policies.
- [ ] Service editor follows X's actual mode/header/counter/options/Send/Quit/cancel results.
      `Requesting` is a hypothesis until X captures it; reuse its existing progress widget only
      if the pixels match. No host USSD or cell-broadcast API added without captured behaviour.
- [ ] Add `topics/*`, `service-command/*` scenarios and export old tree drivers to their owner.
- [ ] Verify package test and manual `vp check --fix`.
- [ ] Commit: `feat(nokia-os): implement Info topics and the Service command editor`.

### Task 10 - Acceptance and ownership closeout

**Files:** `tests/acceptance/18c-chat-templates-pictures-info-service.test.ts`,
`tests/support/18c-content.ts`; owned placeholder/status registration lines only.

- [ ] Exactly one `acceptancePlan` call; each `scenarios` ID belongs to `goldens/index/18c.json`.
      Every asserted still/timeline/sound has a real driver; no resource/no-scenario exemption.
- [ ] Old Menu 3, shared no-response, Topics/service and sound-note goldens stay in their owner
      indexes and have owner-registered drivers. Change inputs/covers only from recorded evidence.
- [ ] Pixel comparisons are exact. Timelines use ±2 ms after first changed frame alignment;
      inherited ±25 ms probe tolerance needs measured disagreement and a per-scenario reason.
      Sound compares registers/events under plan 16's established onset/drift rules.
- [ ] Coverage guard passes across all plans. Pending capture/card/picker dependencies remain
      named and counted. `knownGaps` is for independently evidenced recording disagreements,
      not missing implementation. Any required pending task prevents `done` status.
- [ ] Run `mise exec -- vp run @hellotimber/nokia-os#test`,
      `mise exec -- vp run -r test`, `mise exec -- vp check --fix`; report totals and runtime.
- [ ] Commit: `test(nokia-os): verify Chat and Messages content against captures`.

### Task 11 - Demo, README and final verification

**Files:** `demo/panels/chat-and-content.ts` (new), `demo/panels/index.ts` (one export),
`packages/nokia-os/README.md`, `docs/specs/stock/chat-and-content.md`, this plan,
`docs/plans/README.md` (row 18c only).

- [ ] Use the existing `DemoPanel` interface. Add factory-state controls, invented incoming
      picture/card and deterministic SMS Chat partner, sent-picture inspection. Demo uses the
      approved English dictionary; host supplies partners through `StockNetworkPort`.
- [ ] Run `mise exec -- vp run @hellotimber/nokia-os#demo`; drive real keypad paths in the
      collaborative preview (status, open, navigate, snapshot). Existing repository
      `agent-browser` workflow is a fallback when selected by the coordinator. Capture proof of
      factory Templates Read/insertion, picture receipt/View/Save/Forward, T9 Chat reply and
      Topics Add/Edit/Erase. Missing picture evidence remains an incomplete task, not a demo fix.
- [ ] README gives standalone host network usage, content provenance and limitations. Specs list
      verified layouts/timings and unresolved research; proposed standby saver owner is plan 25,
      languages plan 26, ringtone Smart Messaging plan 27. No edits to those plans here.
- [ ] Run `mise exec -- vp check --fix`, `mise exec -- vp run -r test`,
      `mise exec -- vp run website#build`; verify `git diff <implementation-base> -- website/`
      and phone-core are empty. Run generators and scoped formatter twice to stability.
- [ ] Mark row 18c and this plan `done` only after all scope/dependency gates pass; otherwise
      report verified groups and exact remaining gates. Never stage `TODOS.md`.
- [ ] Commit: `docs: complete stock Chat and Messages content (plan 18c)`.

## Open questions resolved provisionally

1. **Factory provisioning:** observed restored-image defaults are the basis; Task 0 captures
   reset writes. Whether the factory line seeds EEPROM or invokes the same reset is unproven.
   No runtime depends on choosing one. Empty host storage stays virgin (plan 15 D4).
2. **Picture directory and source:** preserve raw no-response and require verified v6.39 repaired
   captures for folder/Save/gallery. v5.79 is research only. If capture repair fails, those tasks
   wait; strict reproduction is the product decision. Extraction-only content uses a separate
   clean-room spec and own/open assets, with a reported fidelity limitation.
3. **Chat transport:** existing SMS send/deliver; no LLM, HTTP or persona implementation in the OS.
   Session wire text, name/history retention and Inbox effects are Task 0 measurements.
4. **Phone book dependency:** Search and received-card Save are scoped to 19's existing APIs;
   completion waits for its Tasks 5/10. Other content and Chat editor/history work can proceed.
5. **Service commands and info reception:** reproduce observed unanswered service-command UI.
   No cell-broadcast receipt without a capture source. Standby saver is follow-up, gallery is 18c.
6. **Shared registrations:** new delivery/editor/resource hooks are owner prerequisites. Report
   API drift before implementation; do not improvise edits to shared dispatchers.

## Conflicts found while planning

- The earlier draft treated factory-line provisioning and a particular corrupt PMM directory as
  proven. Scratch captures establish restored-image contents and a Save stall, not those causes.
- Plan 18's factory/used content-empty claim is contradicted by factory Templates/Smileys and
  native v5.79 pictures. Its used-phone probe grafted EEPROM into v6.39; native v5.79 differs.
- Plan 15 defers factory-empty Topics; 18c owns the record/reset and those box-glyph leaves.
- Plans 18/18b contain pre-split acceptance/capture/resource paths. This plan uses the landed
  per-plan structure and records required owner APIs; it does not rewrite their plans.
- Current acceptance rejects scenarios for another index and asserted resources without a driver.
  No shared guard escape hatch, fabricated golden or v5.79 composed v6.39 flow is allowed.
- Menu-tree Shared no-response covers Picture messages/Templates/Smileys and gallery copies;
  preserve all raw virgin covers while testing factory/repaired states separately.
- `regenerate` is defined in `vite.config.ts`, rather than the package scripts.

## Done means

- All scoped flows are implemented and match independently imported v6.39 pixels/timings;
  provenance and virgin/factory/repaired states are explicit. Uncaptured required flows remain
  pending and prevent a completion claim.
- Templates/Smileys/default texts and stock picture art come from captures through the committed
  importer; any extraction-only work followed the documented clean-room policy. No extracted
  firmware content or T9 dictionary data was copied into the repository.
- Chat's editor uses approved T9; host SMS partners work through plan 18's network port; picture
  and card delivery use the same registered infrastructure. No website/phone-core changes.
- Every asserted golden has an owner driver; coverage and freshness pass; no unfinished `18c`
  placeholder or pending dependency is hidden. Scope status matches the evidence.
- Manual `vp check --fix`, workspace tests and website build pass; generation/formatting are stable;
  specs, README and plan status describe the delivered behaviour.
