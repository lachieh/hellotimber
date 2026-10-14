# Plan 18 - Messages I: stock text entry, Welcome note and SMS

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 13, 14 and 15 complete (`@hellotimber/nokia-os` with the whole v6.39
tree, stock widgets, the flow host, the storage port and EEPROM records, the welcome-note boot
gate). Plan 16 (sound) runs concurrently: this plan does not touch its files; the one call into it
is conditional (D15).
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only): the
plan 14 goldens already committed for Messages, the crawl's `tree/02-messages/` and
`tree/_with-content/02-messages/`, plan 15's `captures/6.39/plan15/welcome/`, the planning probes in
`$REF/captures/scratch-plan18/` (evidence only, never imported; `NOTES.md` there lists them), and
the canonical recaptures Task 0 writes to `$REF/captures/6.39/plan18/`. Read
`$REF/captures/README.md` and plans 13, 14, 15 and 23 in full before starting.
**Status:** in progress (Task 0 complete; Task 1 contracts documented).

## Goal

Give `@hellotimber/nokia-os` the stock v6.39 text entry and the SMS features built on it, pixel-
and timing-faithful to the captures:

- **multi-tap text entry** exactly as the firmware does it: every key's character cycle
  (punctuation on 1, accented letters on 2-9, space/0 on 0), the commit timeout, sentence case and
  the `#` case cycle, number mode on held `#`, held digits, the `*` symbol table, cursor movement,
  C delete and held-C clear, the characters-left counter, word wrap, scrolling and the blinking
  cursor;
- the reusable **editor**, **text-input** and **number-entry** widgets that later plans bind
  (Phone book names, Reminders, Rename, the Composer's tone name, Chat);
- **Welcome note** (6-2-3): the editor, Save and Erase, writing the note plan 15 shows at power-on;
- **Write messages** (2-1) in multi-tap mode with its Options menu: Send (number prompt, `Sending
message`, `Message sent` or the UNVERIFIED composed failure note), Send by set, Save, Erase, Exit,
  the Dictionary list, and the virgin-EEPROM behaviour of Send to many, Template and
  Insert smiley;
- **Inbox** (2-2) and **Outbox** (2-3): lists, reading, scrolling, Details, Options (Erase, Reply,
  Edit, Use number, Forward), the standby `1 message received` notice and envelope indicator;
- the **message centre number** (2-7-1-1, 2-7-2-1) and **voice mailbox number** (2-9) prompts made
  editable;
- a public **host network port** through which a host delivers incoming SMS and settles outgoing
  ones (the seam a later portfolio integration can back with the website's LLM contacts), with a
  default synthetic network that behaves like the emulator's;
- a **messages EEPROM record**, and goldens for all of it.

The website does not change (D16). Portfolio integration stays unsequenced.

## Scope split (decision)

The brief's plan 18 ("stock text entry, messages, Chat") is split in three. This file is the first;
the other two are listed in the plans README and written when scheduled.

| Plan    | Builds                                                                                                                                                                                                                                                         | Why it is separate                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **18**  | multi-tap entry, editor/text-input/number widgets, symbol table, Welcome note, Write messages (multi-tap), Send/Save, Inbox, Outbox, standby notice, centre and voice mailbox numbers, network port, messages record                                           | the base every other part needs                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **18b** | T9 predictive text: the English dictionary, word cycling with `*`, `?`/`Spell`, Matches, Insert word, the T9 icon and underline, Dictionary › English/Русский/Български, the virgin `English` default (`tree/02-messages/2-1.leaf` asserted)                   | v6.39 **has T9 and it is on by default** in Write messages (S1). Reproducing it needs the firmware's word list. The only policy-compliant source is harvesting it through the UI (key sequences typed in the emulator, matches read back from pixels): a capture job of its own with a sizeable generated asset and an IP question for Lachlan (Open question 3). Multi-tap is complete without it.                                                                       |
| **18c** | Chat (3, `menu/03-chat.sub` asserted), Picture messages (2-4), Templates (2-5), Smileys (2-6), the editor's Template/Insert smiley with content, Info service › Topics (2-8-4), Service command editor (2-10), Screen saver › Screen saver (5-9-4, 12-n-2-9-4) | Chat's editor is T9 by default (S12), so it follows 18b. The content features are empty in the virgin EEPROM and in the factory image; populating them needs its own investigation (binary picture SMS through the emulator's `dct3_web_incoming_sms_bin`, saving templates and smileys, the grafted used-phone EEPROM whose Smileys list exists but decodes to box glyphs, S13). Topics are box glyphs (virgin) or `Add topic` only (factory) and need text entry first. |

Order: 18 → 18b → 18c. Plan 27 (Composer, added by plan 16) needs 18's text-input widget for
`Tone name:` and 18c's Smart Messaging send for its Send flow.

## Why this plan exists (measured gap)

| Area                 | nokia-os after plan 15                                                         | v6.39 evidence                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Write messages (2-1) | placeholder (`pending:18`)                                                     | an editor with a mode header, counter `459/1`, Options (12-13 entries), T9 by default (S1-S10)                                                                               |
| Welcome note (6-2-3) | placeholder (`pending:18`); plan 15 stores and boots the note                  | editor counting down from 36, Options `Save`/`Erase`, tick notes (`plan15/welcome/`)                                                                                         |
| Text entry           | none (phone-core's `multitap.ts` is the website's: 9 letters per key, 1000 ms) | 10+ characters per key with accented letters, a ≈1.45 s commit, sentence case, `#` cycle, held `#` → `123`, symbol table, ▲/▼ cursor (S2-S8)                                 |
| Inbox / Outbox       | `Opening` + `No messages in …` notes                                           | lists with envelope icons, reading with `Sender:`/`Sent:` pages, 7 Options (S11); sent messages are not kept, saved ones are (S10)                                           |
| Network              | none                                                                           | the emulator's synthetic network accepts SMS (`MO SMS … -> CP/RP ACK`) and delivers injected ones (`incoming SMS queued`, S10, S11); no loopback                             |
| Number prompts       | first screen only (plan 14 D11)                                                | digits right-aligned in the large face, `Search` → `OK` after a digit, counter `30` counting down (S10); centre/voice mailbox save notes (`tree/_with-content/02-messages/`) |
| Glyphs               | small 105, large 72, digits 12, thin 78 (no `Z j / @ &`, accents, …)           | the editor shows any of ≈120 typeable characters in `small`; text-input prompts in `large`; the header needs `A B C a b c /` in `digits` (S6)                                |
| Standby              | kernel notice `{ text, softkey }`, no indicators                               | `1 / message / received` with an envelope icon and `Read`; Read opens the Inbox list as a standby application (indicator `1`, C back to standby, S11)                        |

## Planning investigation (2026-10-14)

Scratch probes in `$REF/captures/scratch-plan18/` (virgin image + `v639-setup.inc`; scripts
`tools/p1.py`…`p7.py`, outputs `out-p1/`…`out-p7/`). The scratch harness copy adds two commands over
the emulator's own API: `sms <from> <text>` (`dct3_web_incoming_sms`) and `callin <number>`. Times
are emulated. These are planning evidence; Task 0 recaptures everything canonically.

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Evidence                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| S1  | **T9 exists and is on by default** in Write messages: header pen with three bars (x 0..17) and `Abc`, counter `459/1`; `2` → `A`, `2 2` → `Cc`, then `Cab`, `Cabb`, `Cabba?` with soft key `Spell`; `1` → `.`. Options › Dictionary lists `Dictionary off`, `English`, `Русский`, `Български` and opens on English.                                                                                                                                                                                                                                                                                                   | `out-p1/`, `out-p2/0*`              |
| S2  | Dictionary off shows `T9 / dictionary / deactivated` (large, tick icon, 647/247/497 ms), then the editor with the plain pen (x 1..9) and `Abc`. (The menu-tree spec calls it a static note.)                                                                                                                                                                                                                                                                                                                                                                                                                          | `out-p2/04-off-note`                |
| S3  | Multi-tap cycles (upper case shown): `1` `. , ' ? ! - & 1 @ \ /` (then repeats); `2` `A B C 2 Ä À Á Â Ã Æ …`; `3` `D E F 3 È É Ë Ê …`; `4` `G H I 4 Î Ï Ì Í …`; `5` `J K L 5 £` (repeats); `6` `M N O 6 Ö Ô Ò Ó …`; `7` `P Q R S 7 $` (repeats); `8` `T U V 8 Ü Ù Û Ú …`; `9` `W X Y Z 9` (repeats); `0` space, `0`. `…` = the probe stopped before the cycle repeated. The counter drops once per character, not per press.                                                                                                                                                                                          | `out-p2/k*`                         |
| S4  | A cycling character is drawn without the cursor; ≈1.45 s after the key's redraw it commits and the cursor appears and blinks every ≈480 ms. The same key ≥ ≈1.4 s later starts a new character.                                                                                                                                                                                                                                                                                                                                                                                                                       | `out-p2/t-single`, `gap-*`          |
| S5  | `Abc` is sentence case (`A`, then `a`). `#` cycles the case (`ABC`, `abc`, …; the header text changes). Holding `#` gives `123`. Holding a digit inserts it in any mode. `*` (tapped or held) opens the symbol table: three rows of 11 cells, 7 px apart from x 2, tops 7/17/27 in the thin face, the selected cell inverted, ▲/▼ move, `Use` inserts.                                                                                                                                                                                                                                                                | `out-p2/case-*`, `hold-*`, `sym-*`  |
| S6  | Editor layout: header icon at y 0..5, mode text in the 6-row face from x 14 (multi-tap) or 21 (T9), counter right-aligned (`459/1`); text in the small face from x 1 at tops 8/18/28; words wrap at spaces; the view scrolls to the cursor's line; the cursor is a 1x10 bar (y 7..16); `Options` soft key.                                                                                                                                                                                                                                                                                                            | `out-p6/t*`                         |
| S7  | ▲ moves the cursor right (from the end it wraps to the start); ▼ moves it left. The user guide (spec §6) says the opposite; Task 0 confirms.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `out-p6/u*`, `d*`                   |
| S8  | C deletes left of the cursor. Held C deletes one character, then clears the text ≈530 ms after the press. C on an empty editor returns to the Write messages page.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `out-p6/hold-c`, `c-on-empty`       |
| S9  | Options of an empty T9 editor: Send, Send to many, Template, Insert smiley, Insert word, Insert number, Insert symbol, Dictionary, Send by set, Save, Erase, Exit (12, indicator = the option number); a T9 word adds Matches after Insert smiley. The multi-tap list starts Send, Send to many, Template (the rest is Task 0's).                                                                                                                                                                                                                                                                                     | `out-p7/b*`, `out-p3/02-options`    |
| S10 | Send: `Phone number:` (counter `30`, soft key `Search`, `OK` once a digit is typed; digits large, right-aligned). OK → `Sending message` (small, the hatched bar at ≈271 ms steps) for 2714 ms → `Message sent` (large, an envelope flying off in 6 frames, ≈1.40 s) → the editor with the text kept. The emulator logs `MO SMS to 0412345678 text="Hi" -> CP/RP ACK`; nothing loops back. Outbox stays empty after a send (`No messages in outbox`).                                                                                                                                                                 | `out-p3/05-send`, `out-p4/b-outbox` |
| S11 | Incoming (`sms 0400000001 Hello from the network` at standby): 2472 ms later standby shows an envelope, `1` / `message` / `received` (small, tops 7/16/25) and `Read`. Read → `Opening` (34 ms) → the Inbox list (envelope icon, the sender in small, inverted row, `Read`, indicator `1`) → the text in small from top 0 at 9-row pitch with `Options`; ▼ steps through the text, `Sender:`/number and `Sent:`/`14-Oct-2026`/`14:21:43`, then wraps. Options: Erase, Reply, Chat, Edit, Use number, Forward, Details. From Read, C goes to the list, then standby. Through Menu 2 2 the list's indicator is `2-2-1`. | `out-p4/a-*`, `out-p7/a*`           |
| S12 | Chat: `Phone number:` → `Chat name:` → a T9 editor with counter `140/1` → Options (Send, Template, Insert smiley, Insert word, …); an SMS arriving during Chat shows `>Hey back` with `OK`.                                                                                                                                                                                                                                                                                                                                                                                                                           | `out-p4/c-*`                        |
| S13 | The v6.39 image with the used v5.79 phone's EEPROM (plan 15 probe G): Smileys lists entries drawn as U+E000 boxes (one reads `;oD`); Templates and Picture messages still do nothing; Inbox and Outbox are empty.                                                                                                                                                                                                                                                                                                                                                                                                     | `out-p5/`                           |
| S14 | The emulator SIM has 15 `EF_SMS` records (`third_party/swsim/gsm.json`, 176 bytes each). Firmware strings (cross-check only, `extracted/6.39/text/english.txt`): `Message\nsent` 0x3e1, `Message\nsending\nfailed` 0x480, `Message\nnot sent\nthis time` 0x49a, `Message\nmemory\nfull` 0x2d7, `1\nmessage\nreceived` 0x45c, `Message\nsaved` 0x48d, `Centre\nnumber\nsaved` 0x47f, `Sender:\n%U` 0x484, `Sent:\n%U` 0x4a2.                                                                                                                                                                                           | emulator source, strings            |

## Scope and non-goals

In scope: the Goal items; two opt-in phone-core seams (D11); a public nokia-os contract change
(D9); captures, goldens, glyphs and sprites; documentation.

Out of scope (owner in brackets): T9 prediction and its dictionary (18b); Chat, Picture messages,
Templates, Smileys, Info service topics, Service command editor, Screen saver › Screen saver (18c);
the Phone book name search behind `Search` and Send to many with names (19); dialling a number
from Use number and standby number entry (22); the message alert tone (16 provides it, D15); profile
switching (17); Cyrillic input (26); concatenated-SMS transport details beyond what the counter and
the network port show; delivery reports, Messages sent as Fax/Paging/E-mail and Message validity
behaviour beyond storing the choice (plan 14 already stores them); any website change.

## Decisions

Each decision states what changes relative to the brief and to plans 13-15/23.

**D1 - Split in three; this plan is multi-tap SMS (new).** See "Scope split". Placeholders owned by
`18` are re-owned in both `PLACEHOLDER_OWNERS` tables: Chat, Picture messages, Templates, Smileys,
Topics, Service command editor and Screen saver › Screen saver → `18c`; Dictionary › English,
Русский, Български → `18b`. No golden or placeholder names plan 18 when this plan is done.

**D2 - nokia-os gets its own text-entry engine; phone-core's `multitap.ts` stays the website's
(as plan 23 D1 did for Snake).** The captured rules differ from phone-core's in every part (S3-S8:
character tables, commit timeout, case model, number mode, ▲/▼ direction, held C). phone-core's
module is generic only in name; changing it would change the website. The engine is pure
TypeScript in `packages/nokia-os/src/text/` (no time source: callers pass elapsed time, as the
Snake engine does) and owns: the per-key cycles (`MULTITAP_KEYS`, a hand table whose every row
cites its golden), the case and number modes, the pending character and its commit deadline, the
cursor, deletion, the counter and the layout (wrap and scroll). When the website adopts nokia-os,
phone-core's `multitap.ts`/`EditorApplication` can be deleted (recorded in follow-ups).

**D3 - The virgin Dictionary value is overridden to `Dictionary off` until plan 18b (deviation,
Open question 2).** The captured virgin state opens Write messages in T9 (S1). Without the
dictionary, a T9 editor would produce wrong words, which is worse than a different first screen.
So plan 18 makes `messages/dictionary` a stored choice whose initial value is `Dictionary off`
(`VIRGIN_OVERRIDES` in `bindings.ts`, citing this decision); the Dictionary list opens on it; its
`English`, `Русский` and `Български` entries open a placeholder owned by `18b`, as plan 15 did for
the Cyrillic languages. Plan 18 multi-tap editor goldens use Options › Dictionary › Dictionary off.
The captured `T9 dictionary deactivated` flow is asserted; T9 insertion probes are 18b evidence. `tree/02-messages/2-1.leaf` (the T9
first screen) becomes `pending:18b`. Plan 18b removes the override.

**D4 - Widgets: one editor, one text-input prompt, one number entry, one symbol table (extends plan
14 D11).** All are flow widgets painting `custom` frames:

- `editor(spec)`: the full-screen editor (S6) for Write messages, Welcome note, Reply/Edit/Forward
  and later Chat. Reply starts empty; Edit/Forward keep the original text. `spec` fixes the header
  icon, counter style (`459/1` for SMS, `36` for Welcome), limit, soft key and Options flow.
  Welcome uses adaptive large/small layout.
- `textInput(layout)`: plan 14's text prompt (`Name:`, `Routing address:`, `Chat name:`) made
  editable: the same multi-tap engine drawing into the prompt's box in the large face. Plan 18 binds
  it only where it owns the node (Send by set › Set 1 › Alphanumeric); plans 17, 19, 21 and 27 bind
  it for Rename, Add name, Remind about and Tone name.
- `numberEntry(layout)`: plan 14's number prompt made editable: digits right-aligned in the large
  face, `*` cycling the dial characters (Task 0 records the cycle), `#`, C/held C/C on empty, the
  counter, `Search` while empty and `OK` after a digit. Search on an empty entry opens what Task 0
  records (virgin phone book: a note), owned by plan 19 if it is the name list.
- `symbolTable()`: the S5 grid; `Use` returns the symbol to the widget below it.

The symbol grid has 31 cells (11/11/9). Multi-tap Options has nine entries and excludes
Insert word, Insert number and Insert symbol; the insertion probes are T9 evidence for 18b.

Each prompt layout already measured in `PROMPT_LAYOUTS` keeps its pixels; plan 18 adds the entry
behaviour and the counter.

**D5 - Timings come from the goldens; holds are timed by the widget (plan 15 D7's pattern).**
The commit timeout, the cursor blink, the held-C clear, the held-`#`/held-digit thresholds and the
`*` hold are measured by Task 0 and generated into `src/resources/generated/text.ts`
(`TEXT_TIMINGS`). Widgets act on key-down where the firmware does (Task 0 says which keys) and time
holds themselves with `onKeyDown` + `tick`, as `codeEntry` does; the kernel's 800 ms long press is
not used. Key-to-redraw latency is not reproduced (plan 14 D8): timings are measured from the
key's first redraw.

Task 0 measured commit at 1452.2 ms from the pending character's first redraw, nominal
480 ms blink and held-C clear 478.1 ms after the first deletion redraw. Held-digit eligibility
is bracketed by 1450/1475 ms holds; visible replacement follows at the next blink, about
1.93 s after the first letter redraw. These are distinct events. Held `#` enters number mode;
tap `#` there stays numeric. Case cycling depends on sentence position; ▲ moves right and
▼ left, wrapping. Empty Welcome Save erases, as does Erase.

**D6 - Characters are a closed set; every typeable character must render (extends plan 13 D10).**
Task 0 verifies 149 distinct typeable characters, the union of the case-dependent multi-tap
cycles and the 31-symbol grid, in small and large glyph manifests. Lower key 1 and key 7 differ
from upper. Thin supplies symbol-table art. The five digits-manifest shots are whole bold
six-row header/counter specimens, not independently OCR-verified glyphs; Task 3 crops mode
and counter sprites, including `/`, from those captures. A blinking cursor can obscure a
neighbouring glyph in `text.json`; OCR-truncated runs are not complete stored-text assertions.
`resources.test.ts` checks every typeable character in small and large. Network text outside
this set uses available glyphs and reports missing ones through the helper, without throwing.
Complete 160-character/Unicode reception and alphanumeric senders remain UNVERIFIED (D9).

**D7 - SMS use a provisional per-SIM `messages` EEPROM record (plan 15 D2).**
The proposed v1 record holds inbox entries (number, text, timestamp, read flag) and saved
Outbox texts (optional number), keyed by `StockPhoneConfig.sim`. Task 0 verifies 15 shared
slots: ten incoming and five saved messages survive cold reboot within one process and
Restore. Extra arrival shows `No space for new messages`; Save shows `Message memory full`.
The record has no `factory`, so Restore keeps it. Per-SIM ownership is a host-storage policy,
not a measured fact: a new emulator process loses messages even with the same SIM fixture,
because saveflash does not persist its SIM overlay. The second-SIM comparison is inconclusive
and does not establish phone-wide storage either. Other SIM capacities remain UNVERIFIED.

**D8 - Sent messages are not stored; saved ones are (Task 0).** Send returns to the editor with
its text after `Message sent`; Outbox remains empty. Save, including empty text, shows `Saving
message`, then `Message saved` and retains the text in Outbox. Reply starts empty and prefills
the sender at Send; Edit and Forward keep the original text. Erase clears the editor immediately.

**D9 - A public host network port (contract change).** `StockPhoneConfig.network?:
StockNetworkPort`. The phone calls `send(sms)` for every outgoing SMS and shows `Sending message`
until the outcome is settled (sync or a promise, applied at the next `tick()`); it calls
`subscribe(deliver)` once and shows each delivered SMS as an arrival. Times are the kernel's: the
port has no clock. The default is `createSyntheticNetwork()`, exported, which reproduces the
emulator's network: it accepts every SMS and never loops one back, and its `deliver()` injects an
incoming SMS. A host that backs the port with something else (the website's LLM contacts, later)
changes no screen. The port carries no protocol detail (no SMSC, no PDU): recipient numbers/addresses and text only,
plus the SMSC timestamp of an incoming message as plain fields. Send by set Alphanumeric uses
the captured Routing address text input, so outgoing `number` must preserve that address too.
Incoming alphanumeric senders, complete 160-character reception and faithful Unicode delivery
remain unverified: the ordinary helper caps input at 120 septets, packs ASCII, and substitutes
`12345` for sender `Nokia`. The host text contract is broader than that capture helper.

**D10 - Reproduce measured synthetic-cell link times; the host owns additional latency.**
Five sends give median `SEND_LINK_MS = 2662.4`, range 2574.3-2790.4 ms. Five arrivals give
median `RECEIVE_LINK_MS = 2324.3`, range 2141.3-2464.4 ms. The service settles Send at
`max(SEND_LINK_MS, host settle time)` and arrival at `RECEIVE_LINK_MS` after delivery.
These are measured end-to-end synthetic-cell delays, not isolated proof of a firmware-only
radio timer. They remain UNVERIFIED on a live network. Preserve each recording's durations;
cross-recording link jitter exceeds ±2 ms and requires an explicit tolerance.

**D11 - Two opt-in phone-core seams for standby (new; generic).**

1. `PhoneConfig.standbyIndicators?: () => StandbyIndicators | undefined`, re-read on every tick
   like `clock`, emitted on the standby model (`indicators`, which `ScreenModel` already has) only
   when a field is true. nokia-os sets `message` while the inbox holds unread messages.
2. `Phone.setNotice({ text, softkey, open })`: `open?: PhoneApplication` (exclusive with `path`)
   runs that application when Navi is pressed on the notice, as a **standby application**: empty
   stack, the path stays `standby`, `menuIndicator()` returns no segments, `exit()` returns to
   standby and `levels`/`select`/`row` throw (plan 15's boot-gate rules). This is how Read opens the
   Inbox list with indicator `1` and C back to standby (S11). The website sets neither.

Task 0 shows no interruption of menu, editor, moving game or Sending message.
No general interruption interface is needed; notice-key routing remains unresolved below. Invalid shortcut
finishes before the received notice appears.

**D12 - Arrival notices and unread indicators follow Task 0.** Standby notices count 1/2/3.
Read opens Inbox with indicator `1`; Menu 2 2 opens with `2-2-1`. C dismisses the notice while
keeping the unread envelope; a menu round trip does not restore it. On the received notice,
▲ opens last dialled numbers, ▼ Phone book, digits/`#` number entry, Navi Read. These notice
key routes are stock policy; preserve existing normal-standby key config. Arrivals elsewhere
do not interrupt; returning to standby shows the envelope without a deferred received notice.
Reading clears the message's unread flag. The current kernel notice contract exposes only Navi/C actions, while normal standby handles
▲/▼ via fixed config and ignores digits. Notice-specific routing is an unresolved owner contract
prerequisite before Tasks 4/11; do not silently add a kernel interface or substitute normal routes.

**D13 - Message reading turns whole pages (Task 0).** Text uses small, up to four lines per page
at 9 px pitch, followed by Sender and Sent pages; ▲/▼ turn pages and wrap. The soft key is
`Options`. Details pages are Sender, Message centre and Time. `Sent:` formats the port's local
timestamp as `14-Oct-2026` / `14:11:17`, still 24-hour after selecting 12-hour Time format.

**D14 - Failed-send UI remains a composition, UNVERIFIED.** No failure note was reached.
Empty centre OK invokes Search and cannot save an empty centre; Set 2 asks for a centre.
The boot/input sequence cannot send within 1 s of standby and ordinary setup already waits
for registration. These attempts do not prove failing sends or successful empty-centre sends.
The host contract still permits `"failed"` and maps rejected promises to it. The proposed
`Message\nsending\nfailed` note (firmware string 0x480, planning cross-check only), error-note
class and ≈2.9 s duration are an explicitly unverified composition in `COMPOSED_FLOWS`, not
captured behaviour. Task 2 must not import or assert a failure golden that does not exist.

**D15 - The message alert is plan 16's (dependency, conditional).** An arrival calls
`StockSounder.messageAlert(profile)` if plan 16 has landed when Task 11 starts (`src/sound/sounder.ts`
exists). Otherwise Task 11 adds an internal `onArrival` hook (default no-op) on the messages
service, and plan 16's follow-up wires it. Either way this plan adds no sound code.

**D16 - The website does not change.** phone-core's seams are opt-in; the website sets none.
`website/src/messages/**`, `website/src/phone/applications/{sms,chat,editor}.ts` and `/api/sms`
stay as they are; they are the portfolio's LLM messaging and a later integration may back
`StockNetworkPort` with them (Follow-ups). `git diff --stat <commit before Task 1> -- website/` is
empty at the end.

## Ground truth and artefacts

| Source (`$REF/captures/6.39/`)             | Contents                                                                  | Use                                                |
| ------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------- |
| plan 14 goldens for 2-x, 6-2-3 (committed) | first screens, notes, prompts                                             | `pending:18` → asserted or re-owned (D1, D3)       |
| `tree/_with-content/02-messages/`          | Outbox with a saved message, its Options, centre/voice mailbox save notes | reference for Task 0's sections                    |
| `plan15/welcome/`                          | welcome editor, Save/Erase notes                                          | imported by Task 2 (was `NOT_IMPORTED`, "plan 18") |
| `../scratch-plan18/` (planning)            | S1-S14                                                                    | evidence for the decisions; never imported         |
| `plan18/<section>/` (Task 0)               | canonical recaptures                                                      | goldens                                            |
| `plan18/glyphs/` (Task 0)                  | one shot per typeable character per face, with `manifest.json`            | glyph harvest (D6)                                 |
| `plan18/text.json` (Task 0)                | OCR runs (plan 14 format)                                                 | generated text runs, label checks                  |

New artefacts (spec §10 table, Task 1):

| Artefact                                                     | Cause                                                    | Handling                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Every send accepted, nothing looped back                     | the emulator's synthetic network                         | the default synthetic network (D9); hosts decide                         |
| `Sent:` timestamp from the host's wall clock (`14-Oct-2026`) | the emulator stamps SMS-DELIVER from the host            | the network port supplies the timestamp; captured values are test inputs |
| Link medians 2662.4 ms send / 2324.3 ms arrival              | synthetic cell timing                                    | reproduced as phone link time (D10); UNVERIFIED on a live network        |
| 15 SMS slots                                                 | the emulator SIM's `EF_SMS`                              | 15 shared slots verified; per-SIM ownership provisional (D7)             |
| Write messages opens in T9                                   | virgin EEPROM, firmware default                          | overridden to Dictionary off until 18b (D3)                              |
| Template/Insert smiley do not respond in captured state      | observed no-response; other content states belong to 18c | 18c                                                                      |

## Package boundaries

Unchanged from plans 13-15/23. `nokia-os` → `phone-core` (runtime) and `phone-screen` (runtime LCD
toolkit). phone-core's two seams (D11) are generic: no Nokia labels, timings or message concepts.
nokia-os never imports the website's messaging, `@anthropic-ai/sdk` or any network API: the host
port is the only way in or out.

## Contract changes

Task 1 writes these into `VISION.md`.

### `@hellotimber/phone-core` (additive, opt-in)

```ts
export interface PhoneConfig<Metadata = unknown> {
  // ...plan 13-23 fields unchanged...
  /**
   * Plan 18: standby indicators (message, voicemail), re-read on every tick like `clock`; a
   * change emits one snapshot. Emitted on the standby model only when a field is true. Default: none.
   */
  standbyIndicators?: () => StandbyIndicators | undefined;
}

export interface Phone {
  // ...unchanged...
  /**
   * Standby-scoped notice ("1 message received"): standby renders it; C clears it. Navi navigates
   * to `path` (default: clears), or (plan 18) runs `open` as a standby application: empty stack,
   * path stays `standby`, `menuIndicator()` has no segments, `exit()` returns to standby
   * (`levels`/`select`/`row` throw). `path` and `open` together throw. null clears.
   */
  setNotice(
    n: { text: string; softkey: string; path?: string; open?: PhoneApplication } | null,
  ): void;
}
```

### `@hellotimber/nokia-os` (additive)

```ts
/** Plan 18: one SMS as the phone sees it: a typed recipient number/address and text. */
export interface StockSms {
  readonly number: string;
  readonly text: string;
}

/** Plan 18: the service centre's time stamp of an incoming SMS (local time, as the phone shows it). */
export interface StockTimestamp {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

export interface StockIncomingSms extends StockSms {
  readonly sentAt: StockTimestamp;
}

export type StockSendOutcome = "sent" | "failed";

/** Plan 18: the phone's network for SMS. The host owns delivery and outcomes; times are the phone's. */
export interface StockNetworkPort {
  /** An outgoing SMS. The phone shows `Sending message` until this settles (and its link time). */
  send(sms: StockSms): StockSendOutcome | Promise<StockSendOutcome>;
  /** Called once by `createStockPhone`; the host calls `deliver` for each incoming SMS. */
  subscribe(deliver: (sms: StockIncomingSms) => void): () => void;
}

export interface StockPhoneConfig {
  // ...plan 13/15/16 fields unchanged...
  /** Plan 18: where SMS go and come from. Default: `createSyntheticNetwork()`. */
  network?: StockNetworkPort;
}

/**
 * Plan 18: the emulator's network: every send is "sent", nothing loops back. `deliver` injects
 * an incoming SMS into every subscribed phone; `sent` lists what phones sent, in order.
 */
export function createSyntheticNetwork(): StockNetworkPort & {
  deliver(sms: StockIncomingSms): void;
  readonly sent: readonly StockSms[];
};
```

Rules (Task 9 pins each with a test): `send` is called once per Send, Reply, Forward or Send by set
confirmation, with the number as typed and the text as stored; a promise that rejects counts as
`"failed"`; an outcome settled after power-off or after the phone left the sending screen by power
is ignored; `deliver` while the phone is off queues the SMS until the next power-on reaches standby
(UNVERIFIED: the emulator cannot deliver to a phone that is off; a real network retries); a
malformed SMS (non-string number or text, a timestamp out of range) throws from `deliver`, naming
the field.

## Internal API for later plans

Plans 17, 18b, 18c, 19, 21, 22 and 27 consume these. Signatures are fixed by Tasks 5-10; a change is
a Deviation recorded here.

```ts
// src/text/multitap.ts (pure)
export type TextMode = "Abc" | "ABC" | "abc" | "123";
export interface TextState {
  readonly text: string;
  readonly cursor: number; // 0..text.length
  readonly mode: TextMode;
  readonly pending: {
    readonly key: PhoneKey;
    readonly index: number;
    readonly sinceMs: number;
  } | null;
}
export function textKey(state: TextState, key: PhoneKey, nowMs: number, limit: number): TextState;
export function textHold(state: TextState, key: PhoneKey, nowMs: number, limit: number): TextState;
export function textTick(state: TextState, nowMs: number): TextState; // commits a due pending char
export function textDelete(state: TextState): TextState;
export function textClear(state: TextState): TextState;
export function textMove(state: TextState, key: "up" | "down"): TextState;
export function textInsert(state: TextState, chars: string, limit: number): TextState;
export const TYPEABLE: ReadonlySet<string>; // MULTITAP_KEYS ∪ SYMBOLS (D6)

// src/text/layout.ts (pure)
export function wrapText(text: string, font: StockFontName, width: number): readonly TextLine[];
export function viewTop(
  lines: readonly TextLine[],
  cursor: number,
  rows: number,
  previousTop?: number,
): number;

// src/widgets/editor.ts, text-input.ts, number-entry.ts, symbol-table.ts
export function editor(spec: EditorSpec): Widget;
export function textInput(options: TextInputOptions): Widget; // a PromptLayout + entry + done(text, flow)
export function numberEntry(options: NumberEntryOptions): Widget; // a PromptLayout + done(number, flow)
export function symbolTable(insert: (symbol: string) => void): Widget;

// src/messages/store.ts, service.ts
export const MESSAGES_RECORD: EepromRecord<MessagesState>;
export class StockMessages {
  constructor(eeprom: StockEeprom, sim: string);
  inbox(): readonly InboxMessage[];
  outbox(): readonly SavedMessage[];
  receive(sms: StockIncomingSms): "stored" | "full";
  save(text: string, number?: string): "saved" | "full";
  markRead(index: number): void;
  erase(list: "inbox" | "outbox", index: number): void;
  unread(): number;
}
export class StockMessaging {
  // per phone: the network port, link times, sending and arrivals
  send(sms: StockSms, settled: (outcome: StockSendOutcome) => void): void;
  tick(nowMs: number): void;
}
```

Setting keys added: `messages/dictionary` (a choice: Dictionary off, English, Русский, Български;
initial Dictionary off, D3), `settings/phone-settings/welcome-note` (plan 15's text, now written).
The centre and voice mailbox numbers keep plan 14's text keys (now writable; `setText`).

## Golden pipeline additions

A new explicit table `scripts/messages-capture-set.ts` (like `game-capture-set.ts`), appended by the
importer. Ids `text/<name>`, `sms/<name>`, `welcome/<name>`, `glyphs/<face>-<n>`; `status:
asserted` unless noted. Every scenario is hand-written in `tests/support/messages.ts`.

| Fixture id(s)                                | Source (`$REF/captures/6.39/`)         | Kind               | Asserts                                                                               |
| -------------------------------------------- | -------------------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| `text/dictionary-off`                        | `plan18/text/dictionary-off`           | timeline           | the Dictionary list, `T9 dictionary deactivated`, the multi-tap editor                |
| `text/key-<k>` (k = 0-9)                     | `plan18/text/keys/<k>`                 | stills             | each press of the key through two full cycles (S3)                                    |
| `text/commit`, `text/commit-gap-<ms>`        | `plan18/text/commit*`                  | timeline / stills  | pending without cursor, the commit, the blink; same-key gaps                          |
| `text/case-*`, `text/number-mode`            | `plan18/text/case*`, `number*`         | stills / timelines | the `#` cycle from each state, sentence case, held `#`, held digits                   |
| `text/symbols`, `text/symbols-*`             | `plan18/text/symbols*`                 | stills             | the grid, every move (▲/▼ wrap), `Use`, C                                             |
| `text/cursor-*`, `text/delete-*`             | `plan18/text/cursor*`, `delete*`       | stills / timelines | ▲/▼ at start, middle and end; C; held C; C on empty                                   |
| `text/wrap-*`, `text/counter-*`              | `plan18/text/wrap*`, `counter*`        | stills             | wrap, scroll, long words, the counter at 160/161, 306/307, 459 and full               |
| `text/input-*`, `text/number-*`              | `plan18/text/input*`, `number*`        | stills / timelines | the text-input and number-entry prompts (Routing address, Phone number)               |
| `welcome/*`                                  | `plan15/welcome/*`, `plan18/welcome/*` | timelines          | editor, Save, Erase, the page after                                                   |
| `sms/send*`, `sms/save*`, `sms/send-by-set*` | `plan18/sms/send*` …                   | timelines          | Sending, Message sent, Saved (failure has no capture, D14), Send by set, Send to many |
| `sms/arrive*`, `sms/inbox*`, `sms/read*`     | `plan18/sms/arrive*` …                 | timelines / stills | notice, indicator, Read, list, view, Details, Options flows                           |
| `sms/outbox*`                                | `plan18/sms/outbox*`                   | timelines / stills | saved messages: list, view, Options                                                   |
| `sms/centre*`, `sms/voice-mailbox*`          | `plan18/sms/centre*`, `voice-mailbox*` | timelines          | editing and saving the numbers                                                        |
| `sms/full*`, `sms/persist*`, `sms/sim*`      | `plan18/sms/full*`, `persist*`, `sim*` | stills / timelines | capacity, reboot persistence, the second SIM (D7)                                     |
| `glyphs/small-<n>`, `glyphs/large-<n>`, …    | `plan18/glyphs/<face>/*`               | stills             | glyph sheets for the harvester (not scenarios; integrity only)                        |

Glyph sheets are harvest input only: `goldens-integrity.test.ts` checks them, and the coverage
guard treats `glyphs/*` as resources, not scenarios (as `text-runs.ts` inputs are). Their text runs
are generated from Task 0's `manifest.json` (the character typed per shot), checked against
`plan18/text.json`, into `scripts/generated/messages-text-runs.ts`.

## Stock display observations (measured by Task 3 on the goldens)

| Element        | Measured layout                                                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor header  | multi-tap pen = `prompt/pen` (x 1..9, y 0..5); T9 pen with bars x 0..17 (`editor/t9-pen`, 18b); mode text art at x 14..30 (`prompt/abc`, `prompt/abc-lower`, `editor/mode-upper`, `editor/mode-123`); counter in digits, ending at x 83 (`459/1` from x 56) |
| Editor text    | small cells from x 1 at tops 8/18/28; cursor 1x10 at y 7..16; blink 480 ms; commit 1452 ms after the pending character's first redraw; `Options` small at top 40                                                                                            |
| Symbol table   | header pen + `editor/mode-symbols` (x 14..30); 31 cells in rows of 11/11/9; cell k's 8x8 box at x 1 + 7 × column, y 7 + 10 × row, its thin glyph from x 2 + 7 × column at top 7 + 10 × row; the selected cell's box inverted; soft key `Use`                |
| Number prompt  | `Phone number:` small at top 7 from x 0; counter digits top right (`30` from x 72); up to ten digits large at top 23, right-aligned (one digit from x 75); more digits in small rows from x 5, right-aligned, at tops 28, 19, 10; `Search`/`OK`             |
| Sending        | the Requesting bar (`progress-1`..`-10`, x 0..83, y 7..14) at 260-272 ms steps; `Sending` / `message` small at tops 18/29; no soft key; 2662 ms (median)                                                                                                    |
| Message sent   | `Message` / `sent` large at tops 3/18; the envelope in seven frames within x 63..83, y 0..24 (`message-sent-1`..`-7`, 1403 ms)                                                                                                                              |
| Saving, Erased | `Saving message`: the bar's first frame for 88 ms, then `Message saved` (tick note); `Erasing message`: the bar, then `Erased` with a waste bin lifting its lid (`erased-1`..`-6`, x 64..83, y 2..22)                                                       |
| Standby notice | envelope x 7..18, y 0..5 (`message/envelope`, also the unread indicator); `1` / `message` / `received` small at tops 7/16/25; `Read`; the operator line is not drawn                                                                                        |
| Inbox list     | rows at tops 8/18/28; unread icon x 0..5 one row below the top (`message/unread`), read and saved icon x 1..6 (`message/read`); sender small from x 10; the selected row inverted from x 8                                                                  |
| Message view   | small face from x 0, top 0, pitch 9 (up to four text lines per page); `Options`                                                                                                                                                                             |

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` and the named test commands. A task that touches
  `phone-core` also runs `mise exec -- vp run -r test` and `mise exec -- vp run website#build`.
- Commit rule: run `mise exec -- vp check --fix` yourself, stage files by explicit path, then
  `git commit --no-verify -m "<message>"`. Never `git add -A`/`git add .`. Never stage `TODOS.md`
  (Lachlan's untracked notes). Never touch plan 16's files (`docs/plans/16-*`, `src/sound/**`).
- Never hand-edit `goldens/**`, `src/resources/generated/**`, `src/firmware/generated/**` or
  `scripts/generated/**`; change the generator or its tables and regenerate. Each generator runs
  twice with no diff before its commit.
- Tests never read `$REF`. Generators that read `$REF` fail clearly when it is missing.
- No new dependencies.
- When reality differs from this plan, follow the captures and append a `Deviation:` paragraph
  under the task. If a deviation breaks a contract in VISION.md, stop and report.
- Parallelism (max 3 concurrent agents): Task 0 gates everything, then Task 1. Then lanes A (2 → 3),
  B (4) and C (5 → 9). Tasks 6 and 7 need 3 and 5 (they may run together). Task 8 needs 6 and 7;
  Task 10 needs 6, 7 and 9; Task 11 needs 4 and 10; then 12 → 13.

## Tasks

### Task 0 - Canonical REF captures (no repository changes)

**Files (all under `$REF`, gitignored):** `captures/scripts/gen_v639_plan18.py`,
`captures/scripts/v639-plan18-<section>.cap` (command logs), `captures/6.39/plan18/**`, a "Plan 18
supplementary captures" section in `captures/README.md`, `firmware/work/v639-plan18-*.fls`, and the
harness helpers below.

- [x] Read `$REF/captures/README.md` (harness commands, `fork`/`exit` through
      `tools/menutree/emu.py`), `captures/scratch-plan18/NOTES.md` and its `tools/*.py`. Do not modify
      existing captures or scripts.
- [x] Harness: add `sms <from> <text...>` and `callin <number>` to `tools/harness/dct3cap.c`
      exactly as `captures/scratch-plan18/harness/dct3cap.c` does (calls into the emulator's own
      `dct3_web_incoming_sms`/`dct3_web_incoming_call`; the emulator's sources stay untouched).
      Plan 16's Task 0 may be editing the harness: if `build.sh` or `dct3cap.c` changed since this
      plan was written, merge by hand and rebuild (`build.sh` swaps the binary atomically). Record
      the commands in the README's command table.
- [x] Write `gen_v639_plan18.py` (`run -j 3`, `--only`, `ocr`, `check`), driving `emu.py` like plan
      23's generator. Every section: `include v639-setup.inc`, `key c`, `run 2s`, then
      `fork`…`exit`. Sections that type text first set Options › Dictionary › Dictionary off and
      record that flow once (`text/dictionary-off`). Clock 10:10 on 13.10.2026 throughout.
- [x] **T text entry** (`plan18/text/`): every key 0-9 pressed until its cycle repeats twice (shots
      per press) in `Abc`, `abc` and `ABC`; the commit (`record` from before a press for 3 s) and
      same-key gaps of 1300-1600 ms in 50 ms steps (shots); `#` from every state, with and without
      text, at a sentence start (after `.` and space) and mid-word; held `#` (record: the threshold)
      and `#` in `123`; held digits and held `0`/`1`/`*` (record); `*` tapped and held; the symbol
      table: every cell reached with ▼ and ▲ (wrap at both ends), `Use` on first, middle and last
      cells, C in the table; ▲/▼ cursor at start, middle and end of one and of three lines (shots),
      typing in the middle; C, held C (record), C on empty; a text of 459+ characters typed fast
      with alternating keys (shots at 155-165, 300-310, 455-460 and at the limit: what happens on
      the 460th?); a word longer than a line; spaces at a line end; the cursor blink (record 5 s).
- [x] **G glyph sheets** (`plan18/glyphs/<face>/NNN.png` + `manifest.json` `{ file, face, char }`):
      every character of the typeable set (T's cycles ∪ the symbol table) once in the editor
      (`small`; type it, shot, C) and once in a large text-input prompt (`large`; Phone book › Add
      name, type, shot, C; mark the plan 19 node as only a vehicle), plus the header mode texts and
      the counter with `/` (`digits`). Check: every manifest char is read back by `ocr.py`.
- [x] **W welcome note** (`plan18/welcome/`): reuse plan 15's `welcome/` if it already holds the
      editor, Save and Erase records; add: the editor's Options list, C/held C, 36 characters and a
      37th key, Save on an empty note (what happens?), Erase on an empty note.
- [x] **N number entry** (`plan18/text/number*`): Write messages › Options › Send's prompt: each
      digit, `*` pressed repeatedly (the dial-character cycle), `#`, held keys, ▲/▼, C, held C, C on
      empty, 30 digits and a 31st, Search on empty (record: the virgin phone book's answer), OK.
      Also Insert number (its prompt and what OK inserts) and Send by set › Set 1 › Alphanumeric's
      `Routing address:` text input (typing, OK).
- [x] **S send** (`plan18/sms/`): Send to a 10-digit number (record from OK to the settled editor,
      `ROM6_LOG=1` and the log kept), three more sends for the link-time median; Send by set (Set 1
      Numeric, Alphanumeric, Set 2); Send to many (virgin note); Template and Insert smiley (virgin,
      record 4 s); Save (record) and Save on an empty text; Erase; Exit. Failure (D14): send with the
      message centre number cleared (2-7-1-1, C held, OK), with Set 2 (no centre), and within 1 s of
      a reboot's standby; record each and report which, if any, shows a failure note.
- [x] **O outbox** (`plan18/sms/outbox*`): three saved messages (one with a number), the list, each
      message read (▼ through it), Options (each entry: Erase with its query and note, Edit, Use
      number with and without a number in the text, Forward), the last erase (`No more messages in
outbox`).
- [x] **I incoming** (`plan18/sms/arrive*`, `inbox*`): `sms` at standby (record 6 s from the command,
      five times, for the link-time median); C, Menu, ▼ and a digit on the notice (records); the
      indicator after C (shot); a second and a third arrival before reading (the notice text); an
      arrival in the menus, in the editor, during a note, in a Snake II game and during `Sending
message` (records: what interrupts?); a 160-character SMS, one with characters outside the
      typeable set (é, ü, ~), one from an alphanumeric sender if the emulator accepts it; Read, the
      list, the view (▼/▲ through every line), Details, every Option (Erase query and notes, Reply
      → editor → Send, Edit, Use number, Forward), read/unread icons; the same list through Menu 2 2;
      Time format 12-hour then a message's `Sent:` page.
- [x] **M numbers** (`plan18/sms/centre*`, `voice-mailbox*`): 2-7-1-1 and 2-7-2-1 (edit, clear, OK,
      `Centre number saved`, the page after), 2-9 (edit, OK, `Saved`).
- [x] **F full / persistence / SIM**: fill the SIM to 15 messages (arrivals and saves), then one more
      arrival and one more Save (records); `saveflash`, `reboot` from it (the inbox survives?);
      reboot with `SWSIM_FS=captures/5.79/plan15/sim2-gsm.json` (plan 15's second SIM: are the
      messages gone? D7); Restore factory settings with the re-provisioned image
      (`firmware/work/v639-plan15-seccode.fls`): messages kept?
- [x] OCR every new image into `plan18/text.json` (plan 14's format and command).
- [x] `check`: every recording starts on its parent; every manifest char is read back; the arrival
      recordings each contain the notice.
- [x] Append "Plan 18 supplementary captures" to `$REF/captures/README.md`.
- [x] No commit. Record the outcome under this task: the key cycles (complete), commit and hold
      thresholds, the case cycle, ▲/▼, held C, the counter at every boundary and at the limit, the
      symbol grid, the number-entry `*` cycle and Search, link-time medians and spread, the failure
      result, arrival behaviour everywhere, Options flows, capacity, persistence and the SIM result.

**Task 0 outcome (2026-10-14; resumed and verified):** retained the existing canonical runs;
completed the missing `welcome-face` probe, extended held-digit/case probes and receive-limit
attempts, and corrected the centre-cleared probe to disable Dictionary before typing. Added
full-capacity reboot verification and a level-1 Snake arrival probe (13 gameplay frames at
about 635 ms/tick; the ROM6 log confirms the incoming SMS ACK while play continues). No runtime
code or commits. `captures/scripts/gen_v639_plan18.py` has 44 sections and 44 replayable
`v639-plan18-*.cap` command logs. `captures/6.39/plan18/` contains **4,754 LCD images** plus
4,754 previews, **194 recordings** with `timings.csv` and `keys.csv`, `text.json` covering every
LCD image, `recordings.json`, `summary.json`, and protocol logs in `logs/`. The small and large
glyph sheets each have 181 shots (149 distinct characters); digits has five header/counter shots.
`firmware/work/v639-plan18-{multitap,persist,full}.fls` are the saved images. Plan 15's existing
Welcome Save/Erase and boot captures remain reference inputs, untouched.

The main harness already contained the scratch `sms`/`callin` port and plan 16's volume columns
at resumption. Its optional `CAP_EPOCH` pins SMS timestamps to 13-Oct-2026 plus emulated time;
unset, the wall clock is unchanged. The existing plan-13 clock-script rerun in
`/tmp/p18-p13check` matches **all 44 PNG files byte for byte** against the original corpus.
No emulator sources changed. The generator's PNG reader now reuses plan 14's decoder (Pillow was
absent). Final `check`: **194 recordings, 0 problems, 2 notes** (Template and Insert smiley do
nothing). Additional validation checked OCR coverage, both glyph manifests against the entire
149-character set, and the pixels of every key's two repeated cycles. Nothing was copied from
`REF/extracted`; neither `REF/t9` nor `REF/captures/plan18b` was used.

**Complete multi-tap cycles**, in press order (`␠` means space). `sentence` at an empty editor
matches `upper`; the three mode directories avoid the case-insensitive filesystem collision.
Pixel-identical glyphs are resolved by the two faces and the captured case, with raw OCR retained
in the manifests.

| Key | Upper / sentence-start  | Lower                   |
| --- | ----------------------- | ----------------------- |
| 1   | `. , ' ? ! - & 1 @ \ /` | `. , ' ? ! - & 1`       |
| 2   | `A B C 2 Ä À Á Â Ã Æ Ç` | `a b c 2 ä à á â ã æ ç` |
| 3   | `D E F 3 È É Ë Ê`       | `d e f 3 è é ë ê`       |
| 4   | `G H I 4 Î Ï Ì Í İ Ğ`   | `g h i 4 î ï ì í ı ğ`   |
| 5   | `J K L 5 £`             | `j k l 5 £`             |
| 6   | `M N O 6 Ö Ô Ò Ó Ø Ñ`   | `m n o 6 ö ô ò ó ø ñ`   |
| 7   | `P Q R S 7 $`           | `p q r s 7 $ ß`         |
| 8   | `T U V 8 Ü Ù Û Ú`       | `t u v 8 ü ù û ú`       |
| 9   | `W X Y Z 9`             | `w x y z 9`             |
| 0   | `␠ 0`                   | `␠ 0`                   |

**Entry and layout:** `text/commit` has a pending A at 47.0 ms, commit at 1499.2 ms:
**1452.2 ms from the first redraw**. Blink intervals are 479.1–481.1 ms (nominal 480).
The same-key gap shots bracket commit (short gaps cycle, long gaps insert); the raw key gap also
contains scan/redraw latency. Held C deletes once (51.0 ms) then clears (529.1 ms), **478.1 ms
after that first deletion redraw**; C on empty returns to the parent. Held `#` enters `123` at
1010.1 ms from key-down; tap `#` in `123` stays numeric, and another held `#` returns to letters
(`ABC` retained; lower returns to sentence-start `Abc` in the empty probe). A held digit first
shows its letter, commits, then redraws as the digit at the next blink (about 1.93 s after its
first letter redraw). The dedicated 25 ms hold sweep brackets the input hold threshold:
1450 ms leaves A, 1475 ms gives 2; all digits and all four modes have recordings. Numeric mode
inserts the digit once, without held-key repetition. Tapped/held `*` opens the symbol table.

`#` cycles `Abc → ABC → abc → Abc` while empty or after `. `, `? `, `! `; mid-word and after
an ordinary space it alternates `abc ↔ ABC`. The earlier interleaved type/delete probe alone
cannot establish this: `text/case-cycle/` records uninterrupted hash presses. **▲ moves right,
▼ left**, wrapping at either end; mid-text insertion/deletion and three-line movement are
captured. SMS text uses small at x 1, tops 8/18/28; words wrap at spaces, long words break, and
the visible window follows the cursor. Welcome uses large at tops 8/22 while two lines fit,
then small at tops 8/17/26 (the probe switches at character 24; this is a width constraint,
not a fixed character-count rule).

The symbol grid has **31 cells**, rows of 11/11/9:

```text
. , ? ! : ; - + # * (
) \ ' " _ @ & $ £ % /
< > ¿ ¡ § = ¤ € ¥
```

▲ advances and ▼ retreats, wrapping; Use first/middle/last and C are recorded. Counter values
at 155–165 are `304/1` … `299/1`, then `298/2` … `294/2`; at 300–310 they are `159/2` …
`153/2`, then `152/3` … `149/3`; at 455–459 they are `4/3` … `0/3`. Further keys never increase
the length beyond 459. While the last character is pending it can still change; the separate
`holds-extended/full-committed-key` recording leaves the committed text unchanged. Welcome's
limit is 36; a 37th key is ignored. Saving an empty Welcome note and Erasing an empty one both
show `Welcome note erased`; Save Hi reopens the stored note.

**Number entry:** `* → + → p → w → *`, committing between cycles after a pause; `+` does not
consume the 30-digit counter. `#` inserts itself, ▲/▼ move right/left and wrap, C/held C delete/
clear, and C on empty returns. The 30th digit reaches zero and further digits do not extend the
value. Search on empty shows `No phone numbers` and returns to the prompt. Routing address is
large text input; OK sends using it. Centre 1/2 saves show `Centre number saved`; voice mailbox
shows `Saved` (the virgin value is prefilled, so the probe appends to it). Empty centre OK is
Search, not a way to persist an empty centre.

**SMS:** five sends give Sending durations **2646.4, 2790.4, 2662.4, 2574.3, 2754.4 ms**:
median **2662.4 ms**, range **2574.3–2790.4**. Message sent lasts **1400.2–1420.2 ms**. ROM6 logs
show CP/RP ACK, no loopback; the editor keeps the text and Outbox is empty after sends. The
stall-phase sweep also settles every send. Send by set offers Numeric/Alphanumeric for both
sets; Set 2 asks for a message centre before sending. Send to many shows `No phone numbers`;
Template and Insert smiley do not respond. Save (including empty) shows `Saving message`,
`Message saved`, then the editor; Erase clears immediately; Exit returns to standby.

Five standby arrival latencies are **2425.4, 2281.3, 2141.3, 2464.4, 2324.3 ms**: median
**2324.3 ms**, range **2141.3–2464.4**. Notices count 1/2/3, Read opens the Inbox with indicator
`1`; via Menu 2 2 it is `2-2-1`. C dismisses the notice but keeps the envelope; a menu round trip
after dismissal does not restore the notice. ▲ opens last dialled numbers, ▼ Phone book, digits/
`#` number entry; Navi is Read. Arrivals do not interrupt a menu, editor, game or Sending message;
returning to standby shows the envelope without a deferred received notice. During Invalid
shortcut the note finishes before the received notice appears. The emulator substitutes sender
`12345` for the alphanumeric `Nokia` input. The requested 160-character attempt is truncated to
120 by its GSM packer; raw UTF-8 é/ü/~ input is not faithfully encoded (ASCII septets are used).
Both attempts and their views are retained in `sms/receive-limits/`.

Inbox Options: **Erase, Reply, Chat, Edit, Use number, Forward, Details**. Reply opens an **empty**
editor, with sender prefilled at Send; Edit/Forward keep the original text. Details pages are
Sender, Message centre, Time. Message reading advances by whole text pages (up to four lines,
9 px pitch), then Sender and Sent, and wraps; it does not scroll one line per key. Sent remains
24-hour (`14:11:17`) after the phone is set to 12-hour. Outbox has three saved messages, rows
labelled `Message`, Options **Erase, Edit, Use number, Forward**; text with/without a number is
captured. Erase asks `Erase message?`, shows `Erasing message`, then `Erased` or `No more messages
in inbox/outbox` on the last entry.

Ten incoming plus five saved messages fill the **15 shared slots**. The separate
`sms/full-persist/` probe confirms all ten Inbox and five Outbox list rows survive a cold reboot
within the process, with zero pixel differences before/after. Its first fixed-wait attempt
delivered only six of ten queued SMS; the corrected probe waits for each received notice before
continuing, rather than assuming a 5 s injection wait proves delivery. An extra arrival shows
`No space for new messages` with OK; another Save shows `Message memory full`. Inbox and Outbox
survive `saveflash`/cold reboot **within one process** and Restore with the 12345 image. They are
both empty after a **new process with the same SIM fixture**, as well as with SIM 2: saveflash
saves phone flash, not the emulator's in-memory SIM overlay. Thus the second-SIM probe is
inconclusive for message ownership/persisted SIM storage; it does not prove phone-wide storage.

Deviation: **Tasks 2, 7, 10, 12 / plan 18b:** multi-tap Options has nine entries, excluding Insert
word, Insert number and Insert symbol. Insert number/symbol were captured in the virgin T9 UI
(`text/insert-number-t9`, `text/insert-symbol-t9`), solely as 18b evidence; they must not become
multi-tap options. This probe does not read any 18b dirty-room data.

Deviation: **Tasks 3, 5, 6, 8:** Welcome requires adaptive large/small text layout, not the SMS
small-only painter. Case behaviour depends on sentence position; lower key 1 and key 7 have
different cycles from upper. Empty Welcome Save erases. Held digit eligibility and its visible
replacement happen at different times; preserve both rather than substituting the kernel's
800 ms long press.

Deviation: **Tasks 3, 6 / D6:** stock `ocr.py` has no font matching the bold six-row SMS mode/
counter header. The five digits-manifest entries label whole header specimens, not independently
OCR-verified characters. Task 3 must harvest/crop those header sprites from captures (its existing
"mode texts if they are not glyph runs" path), including `/`, rather than claim ordinary OCR
coverage. Small/large characters are verified, allowing pixel-identical glyph classes. A blinking
cursor also obscures adjacent glyphs in general `text.json`; do not treat an OCR-truncated run as
the editor's complete stored text (Tasks 3, 12).

Deviation: **Tasks 1, 3, 9–12 / D10:** use the measured medians and explicit spread above, replacing
the planning single samples 2714/2472 ms. Across recordings link-time jitter exceeds ±2 ms;
within each captured timeline preserve its actual durations.

Deviation: **Tasks 1, 9–12 / D14:** no failure note was reached. Empty centre OK invokes Search
and cannot save an empty centre; Set 2 asks for a centre instead of sending. The boot attempt's
menu/input sequence cannot send within 1 s of standby, and the standard setup already waits for
registration. These are attempted/unavailable conditions, not three proven failing sends. Keep
the composed failure note explicitly UNVERIFIED. Do not call a successful send proof that an
empty centre works.

Deviation: **Tasks 1, 9, 11, 12 / D7, D9:** the ordinary helper's 120-septet cap and ASCII packing
prevent a faithful 160-character/Unicode receive golden. The long 115-character view and the
160-byte truncation attempt are evidence, not verification of complete 160-character delivery.
Alphanumeric sender support is likewise unverified. Same-SIM new-process loss makes the SIM
ownership comparison inconclusive; preserve the provisional per-SIM record decision only with
this qualification. Restore retention and the 15-slot mixed limit are verified.

Deviation: **Task 2:** exclude `sms/elsewhere/snake` (one frame at the invalid virgin level 175)
from live-play acceptance. `sms/elsewhere/snake-level-1` replaces it as proof of arrivals during
a moving game; the old capture is retained with an artefact note, not silently overwritten.

Deviation: **Tasks 1, 6, 11, 12 / D8, D13:** Reply starts empty, and the reader turns pages rather
than scrolling one line. Apply these before implementing the message view and its scenarios.

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `docs/specs/nokia-3310.md`, `docs/specs/nokia-3310-menu-tree.md`,
`docs/plans/README.md`, this plan.

- [x] Apply Task 0's outcome to D3-D14 and the contracts (Deviation lines where it changes them). If
      Task 0 shows arrivals interrupting non-standby screens, add the kernel seam they need to
      "Contract changes" now (D11).
- [x] VISION: the phone-core seams and the nokia-os network contract exactly as in "Contract
      changes"; a kernel-policy sentence for plan 18 (standby indicators re-read per tick; a notice
      may open a standby application); the nokia-os row: SMS through a host network port. Narrow the
      non-goal "Simulating telephony (calls/SMS over a network) … T9 dictionaries" to the website
      (nokia-os simulates nothing: the host owns the network) and leave the T9 sentence for 18b to
      settle (Open question 3).
- [x] Spec §6: mark "Text entry" manual-sourced and point to §10. Spec §10: add "Text entry and SMS
      (plan 18)" (S-findings as verified by Task 0, artefacts above, everything "(plan 18, in
      progress)").
- [x] Menu-tree spec: correct `Dictionary off` (a tick note, then the editor), and "Needs incoming
      traffic" (the harness can now inject SMS; Inbox verified by plan 18).
- [x] Plans README: row 18 `in progress`; rows 18b and 18c exist (`not started`).
- [x] No runtime code. `mise exec -- vp check --fix`.
- [x] Commit: `docs: define text entry, SMS and network port contracts (plan 18)`.

Deviation: **Task 1 (documentation path):** firmware facts live in `docs/specs/stock/text-entry-and-sms.md`,
linked from Nokia spec §10, following AGENTS.md's stock-spec-per-area convention. Captures
remain evidence until Task 2 imports fixtures; documented contracts are planned, not runtime exports.

Task 1 applies all eight Task 0 deviations to the decisions above and the stock spec. The
Task 2 importer must classify the T9 insertion probes as 18b evidence, retain the invalid-level
`sms/elsewhere/snake` artefact, and use `sms/elsewhere/snake-level-1` for live-play coverage.
Header specimens require cropping; cursor-obscured OCR requires independent stored-text checks.
Later task bullets that still describe inserted multi-tap options, Reply text, line scrolling,
Set 2's old item view or definite SIM ownership are superseded by Task 0 and D3-D14.

**Unresolved owner prerequisites (read only; reconcile before Task 2).** This plan's later task
paths predate the feature split. AGENTS.md requires `scripts/capture-sets/18-<slug>.ts`, one
registration in its index, `goldens/index/18.json`, and
`tests/acceptance/18-<slug>.test.ts` calling `acceptancePlan` once. Runtime contributions belong
in `src/firmware/features/`, not broad changes to `bindings.ts`/`leaves.ts`. Resolve exact paths
and placeholder groups before Task 2; preserve other plans' golden indexes and registrations.

`awaitsPlan18Scenario` has no current acceptance API. `AcceptancePlan` accepts only plan,
scenarios, knownGaps and timeoutsMs; an asserted golden without a scenario throws. Task 2's
proposed todo bridge needs an acceptance-owner decision before import; `knownGaps` cannot
supply a missing scenario. Plan 20's findings independently report this gap and the shared
fixed `PROBE_TIMELINES` resource table. Resource registration is an owner prerequisite for
Task 3, not permission to repair Calculator or Space Impact here.

Plan 18c (068bbb6) requires one-line editor-option registrations with live editor insertion
state, delivery-kind registration, session subscriptions with cleanup, and Chat consumption
before normal Inbox handling. Plan 18's current `StockMessaging` sketch exposes only send/tick
and its public port is SMS-only. Those extension contracts are unresolved prerequisites for
18c, not additions authorized by Task 1. Reconcile with the messaging owner before Tasks 9-11;
do not silently widen the public port or implement a second transport. The shared resource
pipeline and cross-plan acceptance driver registrations also need their owners. Plan 16's
`StockSounder.messageAlert` now exists; Task 11 can use it under D15, without changing sound code.

### Task 2 - Goldens and re-owned placeholders (TDD)

**Files:** `scripts/messages-capture-set.ts` (new), `scripts/import-captures.ts`,
`scripts/capture-set.ts` (`NOT_IMPORTED`: drop the welcome-editor reason),
`scripts/tree-capture-set.ts` and `src/firmware/bindings.ts` (`PLACEHOLDER_OWNERS` only),
`tests/messages-capture-set.test.ts` (new), `tests/goldens-integrity.test.ts`,
`tests/acceptance.test.ts` (todo shim only), `goldens/**`.

- [x] TDD `messages-capture-set.ts` on synthetic recordings (injected loader, as
      `game-capture-set.test.ts`): ids, kinds, cut points, `trigger-frame` on the first changed frame
      (plan 14 D8), glyph-sheet stills with a `manifest` note.
- [x] Re-own (D1): `2-4`, `2-5`, `2-6`, `2-8-4-*-**`, `2-10`, `3`, `5-9-4`, `12-*-2-9-4` → `18c`;
      `2-1` and `6-2-3` leave the tables (bound in Tasks 8/10); the Dictionary T9 choices are not
      tree nodes (the editor's Options are bindings), so `18b` owns them in `EDITOR_OPTIONS` (Task
      10). `tree/02-messages/2-1.leaf` → `pending:18b` (D3); `menu/03-chat.sub`, the Topics goldens
      and `2-4.leaf`/`2-10.leaf` → `pending:18c`; `tree/06-settings/6-2-3.leaf` → asserted.
- [x] Integrity: no golden is `pending:18`; the owner tables are equal; `glyphs/*` stills have a
      manifest note whose characters match the image count.
- [x] `tests/acceptance.test.ts`: list the new asserted goldens without a scenario as todos
      (`awaitsPlan18Scenario`; Task 12 deletes it).
- [x] Run `import-captures` twice; the second run changes nothing. Record fixture counts, images and
      bytes in a completion note (budget guide: ≤ 2 MB of new text grids; glyph sheets dominate, so
      crop nothing but keep one image per character).
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): import text entry and SMS goldens (plan 18)`.

Deviation: **Task 2 (paths, plan 29 conventions):** the table is `scripts/messages-capture-set.ts`
(tested by `tests/messages-capture-set.test.ts` with an injected `MessagesCaptureIo`), registered
by `scripts/capture-sets/18-messages-and-chat.ts` and one line in `scripts/capture-sets/index.ts`;
its goldens are indexed in `goldens/index/18.json` and run by
`tests/acceptance/18-messages-and-chat.test.ts`. `CaptureIo` gains a generic `json(path)` reader
(`capture-set.ts`, `import-captures.ts`) for the glyph manifests. `NOT_IMPORTED` now lives in
plan 15's capture set: its Welcome entry is narrowed to `plan15/boot/welcome-erased`. The Chat
level list's status is set in plan 13's capture set (`pending:18c`). Placeholder owners change
in `scripts/tree-capture-set.ts` and the features (`messages`, `chat`, `tones`, `profiles`).

Deviation: **Task 2 (status, plan 29 pending workflow):** every new golden is `pending:18`, not
asserted, and no `awaitsPlan18Scenario` shim exists: the harness lists pending goldens as todos
and the acceptance file has no scenarios yet. Later tasks promote each golden in
`messages-capture-set.ts` when its scenario exists. `2-1` and `6-2-3` stay owned by `18` until
Tasks 10 and 8 bind them, so `tree/06-settings/6-2-3.leaf`, `tree/02-messages/2-1.leaf` and
their sound notes stay `pending:18`; Task 10 needs a status override to make `2-1.leaf`
`pending:18b` once `2-1` is bound (D3). The integrity check "no golden is `pending:18`" moves to
Task 12; Task 2 checks instead that plan 18 is pending elsewhere only on those two leaves.

Deviation: **Task 2 (ids and selection):** key goldens are `text/key-<k>-upper` and
`text/key-<k>-lower` with the first cycle only. The repeat matches the first cycle pixel for
pixel, and Abc matches ABC below the header (both verified). Glyph sheets are one still per face
(`glyphs/large`, `glyphs/small`, `glyphs/digits`) whose note ends `manifest [<JSON chars>]`, one
per image. `glyphs/large` keeps the first shot of each of the 149 characters. `glyphs/small`
keeps the 19 characters only the symbol table types: the 130 multi-tap small shots are
byte-identical to the `text/key-*` stills (verified), which the harvester reads instead.
Sweeps, repeated samples and helper artefacts are listed in `MESSAGES_NOT_IMPORTED` with
reasons (T9 probes for 18b, `sms/fail/`, `sms/receive-limits/`, `sms/elsewhere/snake`, extra
link-time samples). `sms/send` is the median send recording (`send/3`, 2662.4 ms).

**Task 2 completion note:** 196 plan 18 fixtures (85 stills, 111 timelines; 1,290 images;
5,410,431 bytes of text grids), all `pending:18`. The corpus now has 1,038 fixtures (775
asserted, 263 pending). Re-owned to `18c`: `menu/03-chat.sub`, nine tree goldens (`2-4.leaf`
and its shared nodes, `2-10.leaf`, the Topics lists and choices) and ten sound notes. The import
is over the 2 MB guide: the plan's golden table needs about 1,300 distinct images even after
deduplication (the small glyph sheet, second key cycles, sentence-mode keys, mirrored symbol
shots and identical before/after lists are excluded). A second `import-captures` run changes
nothing (identical tree hash).

### Task 3 - Glyphs, sprites and timings (TDD)

**Files:** `scripts/messages-text-runs.ts` (new: manifest + OCR → runs), `scripts/generated/messages-text-runs.ts`
(generated), `scripts/harvest-glyphs.ts`, `scripts/glyph-overrides.ts`, `scripts/widget-sprites.ts`,
`scripts/extract-resources.ts`, `src/resources/generated/{fonts,widgets,text}.ts` (generated),
`src/resources/index.ts`, `tests/harvest.test.ts`, `tests/resources.test.ts`, this plan's display
table.

- [x] Generate text runs for every `glyphs/*` image from Task 0's manifest (the typed character, its
      face, its bounds), and for the new `text/*`/`sms/*`/`welcome/*` images from `plan18/text.json`
      (plan 14 Task 3's mapping). Feed both to the harvester; resolve reports with overrides that
      name their golden.
- [x] Crop table additions: the multi-tap and T9 header icons (the T9 one for 18b), the mode texts if
      they are not glyph runs, the envelope icons (standby notice, standby indicator, inbox read and
      unread), the `Message sent` animation frames, the symbol-table selection if it is not a plain
      inversion. Check the `Sending message` bar against the `Requesting` sprites (reuse if equal).
- [x] Timings into `text.ts` (`TEXT_TIMINGS`): commit timeout, blink, held-C, held-`#`, held digit,
      held `*`; and widget timelines: `T9 dictionary deactivated`, `Sending message` (bar loop),
      `Message sent`, `Message saved`, `Centre number saved`, `Saved`, `Welcome note saved/erased`,
      the erase notes, `Opening`, the failure note if captured. `SEND_LINK_MS` and `RECEIVE_LINK_MS`
      (D10) as medians with the spread in a comment.
- [x] TDD: freshness; every typeable character renders in `small` and `large` (D6) and every symbol
      in `thin`; `digits` holds `/`, `A`, `B`, `C`, `a`, `b`, `c`; every new sprite is binary and
      inside its golden's ink.
- [x] Correct "Stock display observations" with the measured layout.
- [x] Run `extract-resources` twice; no diff.
- [x] Commit: `feat(nokia-os): harvest text entry glyphs, message sprites and timings`.

Deviation: **Task 3 (paths, plan 29):** plan 18's evidence is `PlanCaptureSet.resources` in
`scripts/resource-inputs/18-messages-and-chat.ts` (text runs, glyph overrides, sprite batch 180,
timeline batch 180, kinds `message-sent` and `erased`); `scripts/glyph-overrides.ts` and
`scripts/widget-sprites.ts` no longer exist. The REF-reading run generator is
`scripts/messages-text-runs.ts` (package script `messages-text-runs`, like `import-tree`), writing
`scripts/generated/messages-text-runs.ts`. Timings come from `scripts/messages-resources.ts` into
`src/resources/generated/text.ts` (`TEXT_DATA`), one call and one file in `extract-resources.ts`.

Deviation: **Task 3 (fonts):** the harvester gains two override kinds: `span` (a glyph with blank
columns in its ink, `"`) and `spacing` (advance = bearing + ink + one blank column, for
characters the goldens only show alone). Every measured glyph of every font follows that rule
except `1` (a padded digit cell) and large `.` and `R` (`tests/resources.test.ts`). The header's
mode texts are art, not digits glyphs: `123`'s digits conflict with the menu indicator's, so
`digits` gains `/` (the counter) but not `A B C a b c`; the four mode texts are sprites, Abc and
abc being plan 14's `prompt/abc` and `prompt/abc-lower`. `"` needs `span`; large `+` a bearing of 1.
`digitHoldMs` is 1475, the upper end of the captured 1450/1475 bracket.

Deviation: **Task 3 (timelines):** Sending message is plan 14's Requesting bar (the same sprites
in order, verified), not a new timeline; it lasts `SEND_LINK_MS` (2662) at least. `Erased` has an
animated bin (`message-erased`); `Opening` is plan 14's 2-2 timeline. No failure note exists
(D14). Named notes: `t9-dictionary-deactivated`, `message-saved`, `centre-number-saved`,
`voice-mailbox-saved`, `welcome-note-saved`, `welcome-note-erased`, `no-more-messages-inbox`,
`no-more-messages-outbox`, `no-phone-numbers`, `message-memory-full`, `message-sent`. Other
plans' tests that used now-typeable characters as missing ones use `~` and `{` instead.

**Task 3 completion note:** fonts small 178, large 162, digits 13, thin 101 glyphs (every
typeable character in small and large, every symbol in thin). `TEXT_TIMINGS` = commit 1452,
blink 480, held-C clear 478, held # 1010, held digit 1475 ms from key-down (Task 6 measures it
from the first redraw: 1428 ms); `SEND_LINK_MS` 2662,
`RECEIVE_LINK_MS` 2324, `SAVING_MS` 88. `regenerate` and `messages-text-runs` each run twice
with no diff.

### Task 4 - phone-core: standby indicators and notice applications (TDD)

**Files:** `packages/phone-core/src/{types.ts,machine.ts,index.ts}`, README; tests
`standby-indicators.test.ts` (new), `notice-open.test.ts` (new).

- [x] TDD `standbyIndicators`: absent → models unchanged; a reader returning `{ message: true }`
      emits `indicators` on standby only; a change between ticks emits exactly one snapshot; an
      unchanged value emits none; `{}`/`{ message: false }` emit no field.
- [x] TDD `setNotice({ open })`: Navi runs the application with the path `standby`, an empty stack
      and `menuIndicator()` without segments; its `exit()` returns to standby; `levels`/`select`/`row`
      throw; C on the notice clears it; `path` with `open` throws; power-off deactivates once;
      `navigate()` while it runs deactivates it (`navigate`); an exception in `createSession` shows the
      `App error` reader as for any application.
- [x] Existing tests pass unchanged; configs without the seams produce identical models.
- [x] `mise exec -- vp run @hellotimber/phone-core#test`, `vp run -r test`, `vp run website#build`,
      `vp check --fix`.
- [x] Commit: `feat(phone-core): standby indicators and notices that open an application`.

Deviation: **Task 4:** `src/index.ts` needs no change (`StandbyIndicators` was already exported).
Two consequences of the standby path are pinned by tests: `navigate("standby")` leaves a notice's
application although its path is already `standby`, and C on its `App error` reader returns to
standby (its stack is empty). Its invalid `exit` options name "a notice's application".

### Task 5 - Multi-tap engine (pure, TDD)

**Files:** `src/text/{keys.ts,multitap.ts,layout.ts,index.ts}` (new), `tests/text-multitap.test.ts`
(new), `tests/text-layout.test.ts` (new).

- [x] `keys.ts`: `MULTITAP_KEYS` (per key, the upper- and lower-case cycles as Task 0 recorded; each
      row's comment names its golden), `SYMBOLS` (the grid in order), `TYPEABLE`.
- [x] TDD `multitap.ts` with synthetic times: cycles and their wrap; a different key commits the
      pending character; the commit deadline (`TEXT_TIMINGS`); sentence case (after `.`/`?`/`!` and a
      space, at the start, per Task 0); the `#` cycle from each mode; held `#` ↔ `123`; held digits;
      `0` (space, `0`); `1` punctuation; the limit (a key at the limit does what Task 0 shows); ▲/▼
      per S7 as corrected by Task 0; delete and clear; insertion mid-text; `textInsert` for symbols
      and numbers.
- [x] TDD `layout.ts`: `wrapText` with the stock `small`/`large` advances (word wrap at spaces, a word
      wider than a line breaks where Task 0 shows), `viewTop` per Task 0's scroll captures.
- [x] Trace test: replay every `text/key-*`, `text/case-*`, `text/cursor-*`, `text/delete-*` and
      `text/wrap-*` golden's key sequence through the engine and compare the text, cursor and mode
      with the golden's OCR-derived text (`tests/support/messages.ts` reads the generated runs).
- [x] Commit: `feat(nokia-os): stock multi-tap text entry engine`.

Deviation: **Task 5 (API):** `TextState` gains `letters` (the letter mode a held # returns to from
123). `multitap.ts` adds `emptyText`, `shownMode` (sentence case shows Abc or abc by position) and
`pendingCycle`; `textHold` on a digit replaces the pending letter with the digit and commits it,
and the widget calls it at the commit when the key was held `digitHoldMs` (the captured digit
appears at the commit, not at the threshold). `wrapText` takes an optional `PendingSlot` (below);
`layout.ts` adds `pendingSlot`, `cursorLine`, `textWidth`, `advance` and `EDITOR_LINE_WIDTH`.

Deviation: **Task 5 (rules beyond Task 0's words):** a line's cells run x 1..83; a word moves
unless it ends two columns short of that, a longer word breaks at the line's end (Task 6 refined
this on `welcome/face` 13); a pending character takes its key's widest advance in either case
(the only rule that fits `text/wrap-words` 15 and 27 together), and the text re-wraps when it
commits; spaces hang at a line end, and an end past x 83 puts the cursor on a new empty line
(`text/wrap-spaces` 06); the cursor stands on the blank column after the previous character. A sentence starts when the text before the slot is blank or ends
with `.`, `?` or `!` and spaces (a letter straight after the mark is unverified); # steps
sentence case → ABC → abc, skipping a mode that shows the same as the current one.

Deviation: **Task 5 (trace test):** the trace replays Task 0's command logs (transcribed in
`tests/support/messages.ts`) and compares pixels, not OCR text: each line drawn with the stock
small font, the cursor's place when it is lit, and the header's mode sprite, for every image of
`text/key-*`, `text/case-cycle-*`, `text/case-after`, `text/cursor-*`, `text/delete`,
`text/wrap-*` and `text/counter` (in `tests/text-layout.test.ts`). OCR runs are cursor-obscured
(Task 0 Deviation); pixels are not.

### Task 6 - Editor widget and painter (TDD against goldens)

**Files:** `src/widgets/editor.ts` (new), `src/display/widgets/{editor.ts,index.ts}`,
`tests/widgets-editor.test.ts` (new).

- [x] `EditorSpec`: header icon, counter style (`sms`: `<left>/<parts>`; `count`: characters left),
      limit, soft key, `options(flow, text)` (the Options flow), `onEmptyC` (`back`), and an initial
      text and cursor (Reply/Edit/Forward).
- [x] TDD: the painter from literal models equals every editor image of `text/*`, `welcome/*` and
      `sms/*` (header, counter, wrapped lines, scrolled view, pending character without a cursor,
      the cursor's position and blink state).
- [x] TDD the widget in a flow (`tests/support/flow-rig.ts`): keys through the engine, holds timed
      by `onKeyDown` + `tick`, the commit and the blink as `TEXT_TIMINGS`, C on empty, Options.
      Timeline goldens (`text/commit`, `text/delete-hold`, blink) pass within ±2 ms after alignment.
- [x] Commit: `feat(nokia-os): stock text editor widget`.

Deviation: **Task 6 (spec and tests):** `EditorSpec` is `counter` (`sms` | `count`), `limit`,
`layout` (`sms` | `welcome`), `softkey`, `text`/`cursor`/`mode`, `options(flow, editor)` with an
`EditorControl` (`text`, `clear`, `insert`), `symbols` (Task 7) and `onEmptyC`; the header is
always the pen and the mode sprite. The painter is tested on models built from replayed engine
states (`editorModel`, exported for that), full frame against every image of the traced
`text/*` stills, `welcome/face` and `welcome/editor`; the `sms/*` editors are Tasks 10-11's flows.

Deviation: **Task 6 (measured behaviour):** the cursor blinks on a free-running 480 ms timer
from the editor's start; no key or commit restarts it (`text/commit` and `text/hold-digit` show
opposite phases after a commit, predicted by their phase before the key). `digitHoldMs` is now
measured from the letter's first redraw (1428 ms; regenerated `text.ts`): the widget decides a
held digit at the commit, from the hold until then or the release. `welcome/face` 13 showed a
long word filling 82 large columns, so lines break at 83 columns and words wrap two short of it.

### Task 7 - Symbol table, text-input and number-entry widgets (TDD against goldens)

**Files:** `src/widgets/{symbol-table.ts,text-input.ts,number-entry.ts}` (new),
`src/display/widgets/{symbols.ts,prompt.ts,index.ts}`, `src/widgets/prompt.ts` (subtract: an
editable prompt replaces the static one where a node is bound), `tests/widgets-entry.test.ts` (new).

- [x] TDD the symbol table: painter against `text/symbols*`; ▲/▼ moves and wraps; `Use` inserts into
      the widget below and pops; C pops without inserting.
- [x] TDD the number entry: painter against `text/number*` and the Send prompt goldens; digits, the
      `*` cycle, `#`, ▲/▼ as captured, C/held C/C on empty, the counter, `Search` while empty
      (opens what Task 0 recorded: a note, or plan 19's placeholder), `OK` → `done(number, flow)`.
- [x] TDD the text input: painter against `text/input*`; the engine with the prompt's limit and
      counter; OK → `done(text, flow)`; C on empty → back.
- [x] The plan 14 prompt goldens that stay first-screen-only (PIN, barring, the prompts other plans
      own) still pass unchanged.
- [x] Commit: `feat(nokia-os): stock symbol table, text input and number entry`.

Deviation: **Task 7 (structure):** the editor's key handling moved into `src/widgets/text-entry.ts`
(`TextEntry`: keys, holds, blink, `EditorControl`), shared by `editor` and `textInput`. The
editor's `*` opens `symbolTable` by default (`openSymbols`). `PromptEntry` gains `text` (an
editable text, large from x 2 with a 15-row cursor) and `number` (large right-aligned while it
fits in 80 columns, else small rows of up to 78 columns filled from its end at tops 28/19/10,
the label hidden and the box raised to y 7 at three rows). `src/widgets/prompt.ts` is
unchanged: no node is bound yet, so nothing it draws is replaced (Tasks 8 and 10 bind them).

Deviation: **Task 7 (measured behaviour):** the selected symbol's box is solid with its symbol
clear, covering the column it shares with the previous box (`text/symbols-down` 01: €'s last
column); the thin symbol runs were narrowed to six columns so € no longer harvests that column.
Number entry types digits and # at key-down; `*` cycles `* + p w` pending for the commit time;
the counter skips `+`; `sms/send-prompt` 1-prompt is the empty prompt. Routing address opens in
ABC (`textInput`'s `mode`); a text input's long text does not wrap (unverified).

### Task 8 - Welcome note, centre and voice mailbox numbers (TDD)

**Files:** `src/firmware/leaves.ts`, `src/firmware/bindings.ts` (`WELCOME_EDITOR`, `NUMBER_SAVES`),
`tests/welcome-editor.test.ts` (new), `tests/settings-flows.test.ts`.

- [ ] 6-2-3: the editor (count style, 36, multi-tap only, Options Save/Erase as captured). Save →
      `setText(WELCOME_NOTE_KEY, text)` and `Welcome note saved` → the page; Erase → `setText(…,
undefined)` and `Welcome note erased`; the empty cases per Task 0 W. The editor opens on the
      stored note.
- [ ] TDD through keys: type `Hi`, Save, power off and on: plan 15's welcome-note gate shows `Hi`
      (its goldens still pass); Erase, power on: the hands play.
- [ ] 2-7-1-1, 2-7-2-1, 2-9: number entry on the stored text; OK writes it and plays its note, then
      the page (Task 0 M); the virgin values stay as plan 14 captured.
- [ ] Remove `6-2-3` from both placeholder tables (if Task 2 has not).
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): Welcome note editor and editable centre and voice mailbox numbers`.

### Task 9 - Messages record, network port and synthetic network (TDD)

**Files:** `src/messages/{store.ts,network.ts,service.ts,timestamp.ts}` (new),
`src/firmware/records.ts`, `src/firmware/phone.ts`, `src/index.ts`, `tests/messages-store.test.ts`
(new), `tests/messages-network.test.ts` (new).

- [ ] TDD `MESSAGES_RECORD` (plan 15 D2): per-SIM inbox/outbox (D7, or phone-wide per Task 0 F);
      capacity 15 shared; `full` per Task 0; decode drops malformed entries; no `factory` (Restore
      keeps it; a test runs `restoreFactory()`); the stored JSON shape pinned by a snapshot.
- [ ] TDD `createSyntheticNetwork`: `send` returns `"sent"` and records `sent`; `deliver` reaches every
      subscriber; validation errors name the field.
- [ ] TDD `StockMessaging` with the kernel clock: `send` settles after `max(SEND_LINK_MS, settle)`
      (sync, resolved and rejected promises, a promise settled after power-off ignored); arrivals
      appear `RECEIVE_LINK_MS` after `deliver`; deliveries while off wait for standby (D9 rule).
- [ ] `timestamp.ts`: the `Sent:` date and time format (Task 0, both time formats).
- [ ] `createStockPhone`: builds the store over the phone's EEPROM and SIM, subscribes the network
      (default synthetic), unsubscribes nothing (the phone lives as long as the host keeps it;
      document it). Export `createSyntheticNetwork` and the types from `src/index.ts`.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): messages record and host network port`.

### Task 10 - Write messages and its Options (TDD)

**Files:** `src/messages/write.ts` (new), `src/messages/bindings.ts` (new: `EDITOR_OPTIONS`,
`COMPOSED_FLOWS`, `VIRGIN_OVERRIDES`), `src/firmware/leaves.ts`, `src/firmware/settings.ts`
(the dictionary choice), `tests/messages-write.test.ts` (new).

- [ ] 2-1: the editor (sms counter, 459 limit or as Task 0 shows), the multi-tap Options list as
      Task 0 recorded (S9 has the T9 list), the indicator showing the option number. Bind: Send (number entry → `Sending message`
      → `Message sent` → the editor, or the failure note, D14), Send to many (the virgin note; with
      phone book names: plan 19's placeholder), Template and Insert smiley (the captured no-response;
      18c), Insert number (number entry → inserted at the cursor), Insert symbol (the table), Dictionary
      (Dictionary off with its note; English/Русский/Български → placeholder owned by `18b`), Send by
      set (Set 1 option list → number entry or `Routing address:` text input; Set 2's item view),
      Save (store → `Message saved`, or `Message memory full`), Erase (as captured), Exit (standby).
- [ ] `messages/dictionary` setting with `VIRGIN_OVERRIDES` (D3); the settings record's pinned key
      snapshot (plan 15 D3) gains it (version bump only if Task 5 of plan 15's rule requires it).
- [ ] TDD through keys against `sms/send*`, `sms/save*`, `sms/send-by-set*`, `text/dictionary-off`
      (pixels exact, timelines ±2 ms; link-time rows with the stated tolerance if Task 0's spread
      exceeds it, plan 14 closeout decision 2).
- [ ] Remove `2-1` from both placeholder tables (if Task 2 has not).
- [ ] Commit: `feat(nokia-os): Write messages with send, save and the stock Options`.

### Task 11 - Inbox, Outbox, reading and arrivals (TDD)

**Files:** `src/messages/{inbox.ts,outbox.ts,view.ts}` (new), `src/display/widgets/message.ts` (new),
`src/firmware/leaves.ts`, `src/firmware/phone.ts` (indicators, notice), `src/display/standby.ts`
(notice and indicator painting), `tests/messages-read.test.ts` (new), `tests/paint-standby.test.ts`.

- [ ] 2-2/2-3: `Opening`, then the empty note (plan 14's goldens still pass) or the list (envelope
      icons, `Read`, the rows window); Read → the view (D13; ▼/▲ wrap); Options per Task 0 (Inbox: Erase,
      Reply, Chat → placeholder `18c`, Edit, Use number → plan 22's placeholder or the captured
      `No number found on this screen`, Forward, Details; Outbox: Erase, Edit, Use number, Forward);
      Erase's query and notes (`No more messages in inbox/outbox`); Reply sends to the sender.
- [ ] Arrivals (D11, D12): the store's `receive`; `setNotice({ text, softkey: "Read", open: inbox })`
      with the captured texts; `standbyIndicators` from `unread()`; what Task 0 I recorded for keys
      on the notice and arrivals elsewhere; the message alert (D15).
- [ ] Standby painter: the stock notice layout and the envelope indicator against `sms/arrive*`;
      plan 13's standby goldens unchanged.
- [ ] TDD through keys against `sms/arrive*`, `sms/inbox*`, `sms/read*`, `sms/outbox*`, `sms/full*`,
      `sms/persist*` (two phones over one storage) and `sms/sim*` (the `sim` config).
- [ ] Commit: `feat(nokia-os): Inbox, Outbox, message reading and arrivals`.

### Task 12 - Acceptance and the coverage guard

**Files:** `tests/support/messages.ts` (new), `tests/support/rig.ts` (`network` option and a
`deliver(sms, atMs)` helper), `tests/acceptance.test.ts`.

- [ ] A hand-written scenario for every `text/*`, `welcome/*` and `sms/*` golden (navigate as the
      capture did, Dictionary off first, keys on the ticks their redraws start, deliveries at the
      capture's injection time); `glyphs/*` are excluded from scenarios (resources).
- [ ] Coverage guard: no node is covered only by a `pending:18` golden; the nodes plan 18 binds
      (2-1, 2-2, 2-3, 2-7-1-1, 2-7-2-1, 2-9, 6-2-3) are covered by asserted goldens; the editor
      Options entries in `EDITOR_OPTIONS` each have an asserted golden or a named owner (`18b`, `18c`,
      `19`, `22`). Delete `awaitsPlan18Scenario`.
- [ ] Every asserted golden passes (pixels exact; timelines ±2 ms, or the stated tolerance where a
      scenario replays another recording's timing). New `KNOWN_GAPS` need a reason.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp check --fix`. Report the
      suite's run time (keep it under ≈25 s).
- [ ] Commit: `test(nokia-os): drive text entry and SMS against their goldens`.

### Task 13 - Demo, README, verification gate and closeout

**Files:** `packages/nokia-os/{README.md,demo/{index.html,main.ts,style.css}}`,
`docs/specs/nokia-3310.md`, `docs/plans/README.md`, this plan.

- [ ] Demo: `network: createSyntheticNetwork()`; a "Receive SMS" form (number, text; the timestamp
      from the browser's clock) calling `deliver`; a list of sent SMS; the golden overlay lists the
      new goldens. Verify with `mise exec -- vp run @hellotimber/nokia-os#demo` and `agent-browser`
      (headless: drive through the `[role=status]` line, Skip boot): Dictionary off, type `Hi` with
      multi-tap, Send to a number (`Sending message`, `Message sent`), Save, Outbox; receive an SMS
      (notice, Read, the view, Details); Welcome note Save, power cycle, the note at boot.
- [ ] README: text entry, the network port (a sketch of a host port backed by an HTTP endpoint, no
      LLM code), the messages record, what 18b and 18c add.
- [ ] `mise exec -- vp check --fix`, `vp run -r test`, `vp run website#build`;
      `git diff --stat <commit before Task 1> -- website/` is empty.
- [ ] Spec §10: replace "(plan 18, in progress)" with verified facts; list what stays UNVERIFIED.
- [ ] Plans README: row 18 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete text entry and SMS (plan 18)`.

## Follow-up plan adjustments

- **18b - T9:** removes `VIRGIN_OVERRIDES`' dictionary entry; adds the T9 engine behind the editor
  (the `TextState` gains the word in progress), Matches, Insert word, `Spell`, `*` word cycling,
  the underline, Dictionary › English/Русский/Български, and asserts `tree/02-messages/2-1.leaf`.
  Its Task 0 harvests the dictionary through the UI (Open question 3).
- **18c - Chat and content:** Chat over `StockMessaging` (number, `Chat name:`, the history screen
  with `<`/`>` lines, arrivals during Chat), Templates, Smileys, Picture messages (incoming picture
  SMS through a binary extension of `StockNetworkPort`: a contract change in 18c), Info service ›
  Topics (and Restore's `Add topic`), Service command editor, Screen saver › Screen saver.
- **16 - Tones:** if plan 16 lands after Task 11, its follow-up wires `messageAlert` to the messages
  service's `onArrival` hook (D15).
- **17, 19, 21, 27:** bind `textInput` for Rename, Add name/Edit, Remind about and Tone name; 19 binds
  `numberEntry` for numbers and the Search behind it; 19 adds Send to many with names.
- **22 - Calls:** Use number with a number found (dialling), standby number entry reusing
  `numberEntry`'s dial-character rules, incoming calls through a sibling of the network port.
- **Portfolio integration (not sequenced):** a website `StockNetworkPort` backed by `/api/sms`
  (LLM contacts) replaces `website/src/phone/applications/{sms,chat}.ts`; phone-core's
  `multitap.ts`/`EditorApplication` can then be deleted.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Split (D1):** 18 (multi-tap SMS), 18b (T9), 18c (Chat and content). Reverse by folding 18b/18c
   back in after Task 11 (each roughly doubles the plan).
2. **Dictionary default (D3):** `Dictionary off` until 18b, although the virgin phone starts in T9.
   Reverse: keep the captured `English` and show the firmware's no-match path (`?`, `Spell`) for
   every word until 18b (authentic screens, useless typing).
3. **T9 dictionary source (18b):** harvest the word list through the emulator's UI (typing key
   sequences, reading the matches from pixels), committed as a generated asset like the fonts. It is
   Tegic/Nokia data reproduced from captures, at a size not yet known (a few thousand to tens of
   thousands of words). Reverse: no T9 at all (Dictionary off permanently, the T9 entries owned by
   nobody), or a public word list (not the firmware's, so not a reproduction).
4. **Default network (D9):** the synthetic network (accept everything, no loopback), so the demo
   and tests behave like the captures. Reverse: no default network, every send fails.
5. **Link times (D10):** reproduced as synthetic-cell medians (2662.4 ms send, 2324.3 ms arrival) even when the
   host answers instantly. Reverse: settle only on the host.
6. **SMS on the SIM (D7):** provisional per-SIM policy; 15 shared slots verified, ownership inconclusive.
   Reverse: phone-wide storage.
7. **Failure note (D14):** composed from the firmware string if the emulator cannot fail a send.
   Reverse: `"failed"` shows nothing and returns to the editor.
8. **▲/▼ in text (S7):** Task 0 confirms ▲ right, ▼ left, wrapping, against the manual summary.

## Conflicts found while planning

- Spec §6 (manual-sourced): "▲ moves the cursor left, ▼ right", "press-and-hold `0` toggles
  letter/number mode", "`#` switches upper/lower case": the captures show ▲ moving right (S7, to be
  confirmed), held `#` giving `123` and held `0` inserting `0` (S5), and `#` cycling three case modes.
- The menu-tree spec calls `Dictionary off` a static note "then back to the editor"; it is a tick
  note of ≈1.39 s, then the editor (S2). It says Inbox "only showed its empty note, because the
  emulator cannot inject an SMS"; the emulator can (S11).
- VISION's non-goals exclude "Simulating telephony (calls/SMS over a network)" and "T9 dictionaries
  beyond what the UI bit needs" (website-era). Plan 18 adds a host network port (the host simulates)
  and 18b proposes the firmware's dictionary (Open question 3). Task 1 narrows the first non-goal to
  the website; the second waits for Lachlan.
- Plans 14 and 15 assign Chat, Templates, Smileys, Picture messages, Topics, the Service command
  editor and Screen saver › Screen saver to plan 18; D1 re-owns them to 18c and the T9 choices to
  18b.
- Plan 16 D11 gives plan 18 `StockSounder.messageAlert(profile)`, but plan 16 is in progress;
  D15 makes the call conditional.
- The website's `website/src/messages/store.ts` keeps "about me" SMS in localStorage with an LLM
  reply endpoint; nokia-os's messages are firmware data in its EEPROM. They meet only through
  `StockNetworkPort` at integration time.

## Done means

- Multi-tap entry, the symbol table, text input and number entry reproduce every Task 0 golden
  (pixels exact; timelines within ±2 ms after alignment, or a stated tolerance).
- Welcome note writes the note plan 15 boots with; the centre and voice mailbox numbers save.
- Write messages sends through `StockNetworkPort` (default synthetic) with the captured screens,
  saves to the Outbox, and the Options flows match their goldens; Inbox and Outbox list, read,
  scroll, show Details and run their Options; arrivals show the notice and indicator.
- Messages persist in the `messages` record, per SIM if Task 0 confirms; Restore keeps them.
- Every typeable character renders in `small` and `large`; generated data is fresh and idempotent.
- No golden or placeholder names plan 18; the coverage guard accounts for every tree node.
- phone-core is still Nokia-agnostic; the website is unchanged; `vp check`, `vp run -r test` and
  `vp run website#build` pass; VISION, the specs and the plans README match what shipped.
