# Stock SIM content and SIM services (v6.39)

Facts recorded by plan 30's Task 0 on the v6.39 emulator with SIM fixtures and a scripted SIM
Toolkit applet (`$REF/captures/6.39/plan30/`, `$REF/tools/harness-p30/`). Goldens: `sim/*`,
`sound/stk/*` (`goldens/index/30.json`). Facts not yet asserted by a golden are marked "(plan 30,
in progress)". Timings are ms after the key-down of the recorded key.

## SIM messages (`EF_SMS`)

- v6.39 reads every `EF_SMS` record at power-on and lists the received ones as the Inbox. The SIM
  holds as many messages as it has records (10, 15 and 30 tested; no cap reached): the last free
  record takes one arrival (`1 message received`); the next shows `No space for new messages` (OK)
  and `EF_SMSS` is written `04 FE` (memory full).
- **Order:** unread messages first, then read ones, each in SIM record (slot) order; time stamps
  play no part (`sms/order`). An arrival takes the first free record. The order is taken when the
  Inbox opens: reading a message and returning to the open list moves nothing (plan 18's
  `sms/inbox/list-one-read`); leaving and reopening the Inbox sorts again (`sms/erase`).
- **Power-on** with unread SIM messages shows only the standby envelope: no notice and no tone,
  virgin or factory (`sms/boot/*`). Read-only messages show no envelope.
- **Persistence:** reading writes the record's status byte `03` → `01`; Erase (`Erase message?`,
  OK) writes status `00`. Both survive a cold power-on with the same SIM (`sms/erase/reboot-*`):
  the state lives on the SIM. Restore factory settings keeps every SIM message. nokia-os keeps them
  in the `messages` EEPROM record under the SIM's identity once it first writes them (plan 19's
  rule); until then the host's `StockSimCard.messages` are the SIM's contents.
- Reading: text pages of four lines (`Options`), then `Sender:` (the name line and the number line,
  or the number alone), then `Sent:` (`13-Oct-2026` / `08:05:00`); ▼ wraps from `Sent:` to the
  first page. Options and Details are plan 18's; Details' `Message centre:` is the record's
  service-centre address (the fixtures': `+123456789`). A 160-septet text reads in full.
- **Characters:** the extension table counts two septets. Its `[ ] { } ~ | ^` draw as `?`; `€` and
  `\` draw (`sms/read/2`).

## Sender names

- v6.39 names a sender who is in the phone book in the Inbox list, on `Sender:` (name, then
  number) and in Details (`Sender:` name and number). The arrival notice names nobody
  (`4 messages received` counts every unread message) and Chat opens `Chat name:` empty.
- **Match rule** (`names/digits`): two numbers match when their last 9 digits are equal, or all
  digits of the shorter one when it has fewer than 9; `+` and leading digits beyond those are
  ignored. `61412345678`, `5412345678`, `0061412345678`, `412345678` and `2345678` all name Ann
  `0412345678`; `0312345678` and `0412345679` do not; `23456` names Sam `123456`.
- **Gap:** with two entries sharing their last 9 digits (Bob `0412345678`, Intl `+61412345678`) the
  SIM message from `+61412345678` names Intl, network arrivals `5412345678`, `412345678` and
  `61412345678` name nobody and `44412345678` names Bob. nokia-os names the exact match, else the
  first matching entry in SIM order (a known gap for the arrivals that name nobody).

## Last numbers dialled (`EF_LND`)

v6.39 never reads or writes `EF_LND`: with three numbers in it standby ▲ shows `No last dialled
numbers` and Dialled numbers `No numbers`; a call adds to the phone's own list only. There is no
SIM-borne call data.

## SIM Toolkit (SIM services)

- **Terminal profile** `4F 67 FF 7F 11`, sent only to a phase 2+ SIM (`EF_PHASE` 03; with the
  emulator SIM, phase 2, there is none). Proactive commands: DISPLAY TEXT, GET INKEY, GET INPUT,
  MORE TIME, PLAY TONE, POLL INTERVAL, POLLING OFF, REFRESH, SELECT ITEM, SEND SMS, SEND SS, SEND
  USSD, SET UP CALL, SET UP MENU, PROVIDE LOCAL INFORMATION (not NMR). Download: profile, SMS-PP,
  CB, menu selection. Events: SET UP EVENT LIST and location status only. No timers, no LAUNCH
  BROWSER, no idle-mode text. nokia-os plays three commands: SET UP MENU, DISPLAY TEXT, SELECT
  ITEM, and composes SET UP CALL's confirm.
- **Carousel:** the entry is **Menu 14** (counter `14`), the 13th slot of 13: ▲ from Phone book
  wraps to it, ▼ from it wraps to Phone book; there is no 13 (`Menu 1 3`: `Invalid shortcut` at
  430 ms for ≈2.9 s, then standby). `Menu 1 4` opens the level. The label is the SET UP MENU alpha
  identifier in the large face, as many words as fit the line (`Portfolio menu` shows
  `Portfolio`). Icon: a SIM card and a hand, 11 frames (held 1377 ms, then steps of ≈232-449 ms),
  settling at 3769 ms; it restarts on every reveal.
- **Level:** a three-row rows list with the rail, soft key `OK`, no title and no menu number,
  opening on item 1 (≈91 ms after Select); ▼ wraps. A label wider than its row is cut to the
  characters that fit before ` ...` (`Sixteen char ...`, `Twenty-four ...`); 10 characters fit. C
  returns to the carousel (66 ms, the icon restarting), held C to standby (≈530-615 ms).
- **Every SIM screen** opens with `Wait` on the hatched bar while the phone fetches the command:
  ≈20-45 ms for short commands, 241 ms for a 160-character text, 311 ms for 240 characters
  (nokia-os: 22 ms + 1.2 ms per character of the command's text).
- **DISPLAY TEXT:** the small face, four lines a page, soft key `OK`, no rail; ▼ pages (160
  characters: 3 pages, 240: 4); keys on a one-page text change nothing. OK (result 00) returns to
  the level at once with the item still selected; C (result 11) shows `Wait` ≈40 ms, then the
  level; held C goes to standby. A wait-for-user text times out after ≈54 s to the level; a
  clear-after-delay text clears after ≈3.58 s. Two texts: OK on the first shows the second.
- **SELECT ITEM:** the level's rows list with `OK`; the alpha identifier (title) is not drawn;
  nesting works; OK opens the chosen item's next screen; C returns to the parent list (or the
  level); held C goes to standby.
- **SET UP CALL:** not captured: the phone fetches it, sends one STATUS and freezes on a blank
  screen with `OK`. nokia-os composes the confirm (UNVERIFIED): a confirm query with the step's
  alpha identifier or `Allow SIM card to call?`, OK dials through plan 22 (its placeholder until
  plan 22 lands), C ends the session.
- Confirm SIM service actions (6-2-6) opens on `Not asked` in the virgin image; `Asked` shows
  `Done`. It changed nothing Task 0 could see.
- During a call the in-call Options have no Menu entry: SIM services cannot be reached in a call.
- **Sound:** no toolkit screen plays a tone; only the key beeps (`sound/stk/*`).

## IMEI

The emulator's provisioning writes the 3310 model's IMEI `490154203310018`; `*#06#` then shows
`Serial No.` over `4901542033` / `10018` (the virgin EEPROM shows `?` glyphs). The goldens
(`sim/imei-*`) are plan 22's screen (`pending:22`) until its `*#06#` lands (plan 30, in progress).

## Artefacts and UNVERIFIED

- The scripted applet answers at once; real SIMs take their own time (the `Wait` durations are the
  emulator's).
- Network originators lose their `+` in the harness (`sms` takes digits only): the international
  form of a sender is covered by SIM messages only.
- Composed: SET UP CALL's confirm and what follows it; `Message centre:` of a SIM message without a
  centre (a blank line).
