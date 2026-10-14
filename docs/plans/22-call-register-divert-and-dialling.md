# Plan 22 - Calls I: standby number entry, dialling, calls and the call register

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, the spec or the code, STOP and report.

**Prerequisites:** plans 13, 14, 15, 16 and 23 done. Plan 18 through its Task 9 (standby
applications and `setNotice({ open })`, `numberEntry`, the editor, `StockNetworkPort`) and plan 19
through its Task 7 (`standbyKeys` applications, `StockPhoneBook`) are used where they exist; each
use is conditional and names its fallback (D14). Plan 21's `interruption` seam and `StockClock` are
reused the same way, and plan 17's power-key list during calls if it has landed. The per-plan file
split (AGENTS.md "Parallel plan conventions") has landed.
**Structural convention:** acceptance tests in
`packages/nokia-os/tests/acceptance/22-call-register-divert-and-dialling.test.ts`; behaviour in
`packages/nokia-os/src/firmware/features/{dialling,call-register}.ts` (plan 22b extends
`call-divert.ts`) plus pure modules under `src/calls/`; the capture set in
`packages/nokia-os/scripts/capture-sets/22-calls.ts` (goldens indexed in `goldens/index/22.json`);
spec facts in `docs/specs/stock/calls.md`. Shared files change by one-line registrations except
the edits listed under "Shared-file edits", each with its reason.
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only): the
plan 14 goldens already committed for Call register, the crawl's
`captures/6.39/tree/_with-content/04-call-register/` (one dialled call), the planning probes in
`$REF/captures/scratch-plan22/` (evidence only, never imported; `NOTES.md` there lists them and the
scratch harness), and the canonical captures Task 0 writes to `$REF/captures/6.39/plan22/`. Read
`$REF/captures/README.md` and plans 13, 14, 15, 16, 18, 19 and 23 in full before starting.
**Status:** not started.

## Goal

Give `@hellotimber/nokia-os` the stock v6.39 telephone, pixel- and timing-faithful to the
captures, with the network simulated by the host:

- **standby number entry**: digits, `*` (`*`, `+`, `p`, `w`), `#`, the two layouts as the number
  grows, the 60-character entry, C and held C, ▲/▼ cycling the soft key (`Call`, `Save`,
  `Convert`), held `1` (voice mailbox) and held 2-9 (speed dials), `N#` location recall, the codes
  the firmware answers at once (`*#06#`, `*#0000#`), and the screens that hand a digit over to it
  (notes, lists without a shortcut window, the carousel, Snake II's Level page);
- **DTMF** on the tone generator's two oscillators while a key is held at standby and in a call;
- **dialling** (`Calling` with its dots, the ringback, the connected `Call 1` screen, End, a call
  the network ends), emergency `112`, and the notes that refuse a number;
- **incoming calls** over whatever is on screen: the ringing screen, the ringing tone per Incoming
  call alert, the vibrator, Answer, reject, the missed-call notice;
- **keys in a call**: earpiece Volume, DTMF digits, the in-call Options;
- the **call register**: Missed, Received and Dialled lists with their Options (Time of call, Edit
  number, Save, Erase, Call, Send SMS), standby ▲, Erase recent call lists, Show call duration and
  Clear timers;
- the **call** half of the host network port, with a default synthetic network that behaves like
  the emulator's (D5);
- a **call register EEPROM record**, and goldens for all of it.

The website does not change (D16). Portfolio integration stays unsequenced.

## Scope split (decision)

The brief's plan 22 (dialling, calls, register, durations and costs, divert) is split in two. This
file is the first; 22b is listed in the plans README and written when scheduled.

| Plan    | Builds                                                                                                                                                                                                                                                                                                                                                                           | Why it is separate                                                                                                                                                                                                                                                                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **22**  | standby number entry and DTMF, dialling, incoming calls, in-call keys and Options, missed calls, the call register lists (4-1…4-4, standby ▲), call durations (4-5) and Clear timers' erase, the call half of the network port, the `calls` record                                                                                                                               | the base: every other call feature needs entry, a call and its record                                                                                                                                                                                                                                                                  |
| **22b** | Call divert (7-1…7-6) and its results, the standby divert indicator, Call waiting options (6-1-3) and waiting calls, SS and USSD strings typed at standby (`*21*…#`, `##002#`, `*#21#`, two-digit codes), Automatic redial (6-1-1) and Own number sending (6-1-4) as calls use them, Show call costs, Call cost settings and Prepaid credit (4-6…4-8) as far as the network goes | every one of these is a supplementary service or charging request to the network: they share one port addition (`request`), a harness responder that answers SS requests (S27; the stock emulator never answers them) and their own captures. 22 only needs the network to place and carry calls. Costs change nothing in any capture. |

Order: 22 → 22b. 22's Calling flow opens a placeholder owned by `22b` where the firmware sends a
service request instead of a call (S9).

## Why this plan exists (measured gap)

| Area              | nokia-os after plans 13-16, 23                                                                     | v6.39 evidence (`$REF/captures/scratch-plan22/`)                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Digits at standby | ignored; 4 goldens `pending:22` (P5 shortcut probes, Snake II's Level `1`), 2 sound goldens (DTMF) | a number entry with its own layout, soft keys and holds; DTMF pairs while a key is held (S1-S8)                                                                                                      |
| Calls             | none                                                                                               | `Calling` with dots, a ringback, `Call 1`/End, in-call Volume, DTMF and Options; an incoming screen that interrupts any screen, ringing per alert type, Answer, reject, missed-call notice (S10-S22) |
| Call register     | `No numbers` notes; Erase choices store nothing; duration pages read `00:00:00`                    | lists of 10/10/20 numbers with entry views, six Options, `Time of call`, `Erased`; durations count connected time (S23-S26)                                                                          |
| Standby ▲         | opens 4-3 (`No numbers`)                                                                           | the dialled list as a standby application (`Dialled 1:`, `Call`), or `No last dialled numbers` (S25; plan 19 S1)                                                                                     |
| Network           | none (plan 18 adds SMS)                                                                            | the emulator's synthetic cell places and receives calls; with a traffic channel the firmware really connects (S28)                                                                                   |
| Sound             | 900 Hz beeps everywhere; `ring(prefix)` unused                                                     | DTMF, a 425 Hz ringback, three 1000 Hz beeps when the network ends a call, ringing per alert type, a 3000 Hz `Beep once` (S6, S12, S15, S19)                                                         |

## Planning investigation (2026-10-14)

Scratch probes in `$REF/captures/scratch-plan22/` (see its `NOTES.md`). The scratch harness adds
`callin`, `answer`, `hangup [cause]`, `callstate` and three switches over a patched copy of the
emulator's network model (`SCRATCH_MO_HOLD`, `SCRATCH_TCH`, `SCRATCH_SS`; the emulator's sources
are untouched). Factory image (plan 15's `v639-plan15-restored.fls` + `v639-factory-setup.inc`)
unless noted; the virgin image matched it on every screen checked (S29). Times are emulated, ms
after the triggering key edge. Task 0 recaptures everything canonically.

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Evidence                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| S1  | **Entry layout.** The first digit hides the operator line; the clock and the ladders stay. 1-16 characters: the large face, right-aligned (rightmost cell from x 69), 8 per line, the newest line at top 24, the older at top 9. 17-33: the small face, 11 per line, tops 29/20/11, right-aligned to x ≈77. Past 33 only the last 33 show. Soft key `Call`.                                                                                                                               | `out-a-layout/d01…d47`                                 |
| S2  | **60 characters, first in first out**: the 61st key appends and drops the oldest (it still plays its DTMF); deleting back leaves the newest 60. Call with 33 or more digits: `Invalid phone number` (≈2.9 s), then the entry; 32 dial.                                                                                                                                                                                                                                                    | `out-a-limit3/n61`, `out-a-calls2/len32`, `n33`        |
| S3  | **`*` cycles `*` `+` `p` `w`**; the pending character commits ≈1440 ms after the tap (blanking ≈480 ms, then redrawn); a digit commits it at once; `*` after a commit starts a new one. **`#` does not cycle.** Held `0`, `*`, `#`, `2`, `5`, `9` act as taps (Speed dialling unset).                                                                                                                                                                                                     | `out-a-entry/star-*`, `hash-*`, `hold-*`               |
| S4  | **C** deletes the last character ≈42 ms after the press; C on the last one returns to standby (the operator line is drawn ≈87 ms after the rest). **Held C** deletes one, then clears all at ≈519 ms (threshold 450-500 ms) and returns to standby. No timeout (70 s).                                                                                                                                                                                                                    | `out-a-entry/c-*`, `timeout`                           |
| S5  | **▲/▼ cycle the soft key** `Call` → `Save` → `Convert` → `Call` (both keys the same way, auto-repeat ≈480 ms). `Save`: `Name:` (16) → `Saved` → the entry as a name with `Call`. `Convert`: `In domestic: <n>` / `In foreign: <n>` (the Calculator's rate, plan 20); C → standby. A digit or C on `Save` edits the number. Power: the profile list (plan 17), C back to the entry.                                                                                                        | `out-a-entry/opt-*`, `pwr`                             |
| S6  | **DTMF**: 1209/1336/1477 Hz × 697/770/852/941 Hz on the tone generator (`*` 1209+941, `0` 1336+941, `#` 1477+941) at the Keypad tones word (0x9108/0x9104/0x9100; Off silent, the DSP stays down). A tap sounds ≈120-140 ms whatever its length; a hold sounds until 60-100 ms after the release. Onset 16-20 ms (DSP awake) or 47-55 ms (asleep). C and ▲/▼ in the entry beep 900 Hz.                                                                                                    | `out-a-dtmf/*`, plan 16 `keypad/keys`, `keypad/hold`   |
| S7  | **Held `1`** on an empty entry dials the voice mailbox (`793000333`, the emulator SIM's) after 450-500 ms; `Calling` at 559 ms. Inside an entry it appends `1`. Held 2-9: number entry with Speed dialling off (plan 19 S14); on: the speed dial.                                                                                                                                                                                                                                         | `out-a-limit/hold1-*`, plan 19 `out-p2/h*`             |
| S8  | **`N#`**: digits then `#` look up SIM location N (`1#`, `12#` → `No phone numbers` on the empty SIM; `0#` → `Invalid location`; ≈2.9 s, C dismisses, a digit starts a new entry), then standby. `*#06#` (`Serial No.` and `?` glyphs: the virgin EEPROM has no IMEI) and `*#0000#` (`V 06.39` / `23-12-04` / `NHM-5`) answer ≈16 ms after the last `#` with no Call; Navi leaves.                                                                                                         | `out-a-limit/recall-*`, `out-a-calls/*`                |
| S9  | **What Call does**: 1 digit → `Speed dial number not saved` (≈2.9 s) → standby; 2 digits starting `1` dial (`12`); `04`, `#`, `*123#`, `*21*…#`, `##002#` send a service request (`Requesting`/`Quit`; 22b); `112` → `Attempting emergency call`/End; a `+` leads the number (`+61412345678`); a `+` or `p` later cuts what is dialled there (`0412+345` → `0412`, `0412345678p123` → `0412345678`).                                                                                      | `out-a-calls*/*`, `out-p0/03-*`                        |
| S10 | **Digits elsewhere**: the `Invalid shortcut` note, timed notes (`No phone numbers`, `No numbers`, `No messages in inbox`), lists entered with Navi or whose shortcut window has ended (Phone book, Call register, Tones, an option list, the Snake II menu) and the carousel's first key `0`, `*`, `#` start number entry with that key. While a shortcut window is open a digit is a shortcut; the Calculator, text prompts and the power-key list keep their digits.                    | `out-a-screens*/*`                                     |
| S11 | **Calling**: Navi → 56 ms `Calling.` (small, x 6, top 7) → 153 ms the number (thin, right-aligned to x ≈80, top 29; 14 per line, the overflow at top 20, the last 28 shown) → dots `..`, `...`, none every ≈500 ms → at alerting (2207 ms on the synthetic cell, after a 79 ms blank) a 7×7 call icon at (6, 8) and `Call 1` (thin, x 17, top 8), soft key `End`. A saved name replaces `Call 1`.                                                                                         | `out-b-mo/01-*`, `out-p0b/02-call`, `out-b-pb`         |
| S12 | **Ringback**: the tone generator at 425 Hz, 1022 ms on / 3818 ms off, from 2102 ms; with a traffic channel (S28) it stops at the connect.                                                                                                                                                                                                                                                                                                                                                 | `out-b-mo/*.events.csv`, `out-p1-tch/mo.events.csv`    |
| S13 | **End** (Navi) while calling or connected: `Call 1` for ≈430-570 ms (until the network releases), then standby. No `Call ended` note and no duration summary. C while calling does not end the call: the soft key becomes `Options`.                                                                                                                                                                                                                                                      | `out-b-mo/03-*`, `04-*`, `out-b-conn/20-*`             |
| S14 | **The network ends a call** (any cause: 1, 16, 17, 18, 19, 34 give identical frames and events): a 110 ms blank, then `Call 1` with a checkered icon for 2090 ms, then standby; three 1000 Hz beeps (≈290 ms on, ≈480 ms period) from ≈+731/790 ms.                                                                                                                                                                                                                                       | `out-b-mo/02-cause*`, `out-b-conn/23-*`                |
| S15 | **Keys in a call**: ▲/▼ show `Volume` (small, x 5, top 0) with ten stepped bars for ≈1.9 s after the last press (factory 10/10; ▼ lowers the earpiece word 0x99B5 → 0x99BA; ▲ at the top beeps 1125 Hz, 322 ms). Digits, `*`, `#` sound DTMF and show in the large face at top 24 with `Options` for ≈4.45 s, then `End`. C toggles `End` ↔ `Options`. Navi on `Options`: a rows list `End all calls` / `End active call` / `Send DTMF` (`Select`). Power: the profile list.              | `out-b-conn/1x-*`, `out-b-fix/opt-*`                   |
| S16 | **No in-call timer** is drawn: the connected screen stays `Call 1`/End for the whole call (75 s seen; with a traffic channel, S28).                                                                                                                                                                                                                                                                                                                                                       | `out-b-conn/30-*`, `out-p1-tch/mo`                     |
| S17 | **Incoming**: 1982 ms after `callin` the screen shows the number (thin, right-aligned at top 8; 14 per line from x 8 at tops 8/17; a `+` is dropped) or the name (small, x 6, top 8), `calling` (small, x 6, top 28) blinking 480/480 ms, soft key `Answer`; no clock, the ladders stay.                                                                                                                                                                                                  | `out-b-mt/01-*`, `out-b-more/d*`, `out-b-pb`           |
| S18 | **Answer** → `Call 1` at +131 ms; **C** (reject, also held) → `Call 1` for ≈452 ms, then the screen below; the network logs a DISCONNECT. A rejected call is listed under **Received**, not Missed.                                                                                                                                                                                                                                                                                       | `out-b-mt/02-*`, `out-c-p3/pop-x1-*`                   |
| S19 | **Ringing per Incoming call alert** (factory: Nokia tune, Level 4): Ringing repeats the tone's cycle (bursts of 2859 ms every 6011 ms), the vibrator in three 706/713 ms pulses per cycle; Ascending ramps the volume over the first three bursts; Ring once plays one burst (the vibrator goes on); Beep once is one 3000 Hz buzzer beep of 88 ms (volume 18) and the vibrator 480/968 ms continuously; Off is silent with the vibrator; Vibrating alert Off removes it. Virgin: silent. | `out-b-mt/01-*`, `out-b-alert/*`, `out-b-fix/alertoff` |
| S20 | **Keys while ringing**: ▲/▼ show `Volume` and do not silence the ringer (▲ beeps 1125 Hz and cuts the current note); a digit or `#` beeps 900 Hz and cuts the note; the power key does nothing.                                                                                                                                                                                                                                                                                           | `out-b-mt/06…09c`                                      |
| S21 | **A missed call** (the far end hangs up first): the checkered `Call 1` for 664 ms, then a standby notice: an icon and `1` / `missed` / `call` (`2 missed calls`, …) in the small face, soft key `List`, the clock shown; silent; ≥ 60 s. C clears it (standby unchanged, no lasting icon). `List` → `<n> new numbers` (large, ≈2.9 s) → `Missed 1:`.                                                                                                                                      | `out-b-mt/03…05b`, `out-c-p2-notice`                   |
| S22 | **Interruption**: the ringing screen replaces any screen. Over a menu, reject or the call's end returns to it (Answer too, after the call). Over number entry, the entry returns with `Call`. A timed note under it keeps running and is gone when the call ends. A second incoming call during a call is not signalled by the emulator (call waiting: 22b).                                                                                                                              | `out-b-mt/10*`, `11*`, `13*`, `out-b-fix/note-*`       |
| S23 | **Lists** (4-1, 4-2, 4-3): `Missed 1:` / `Received 1:` / `Dialled 1:` (small, x 0, top 7), the number (large, x 4, top 24) or the name, soft key `Options`; newest first, ▼ 1→2→3 wrapping; a number dialled again moves to the top (no duplicate). Capacity: Missed 10, Received 10, Dialled 20 (the oldest drops; the notice keeps counting: `12 missed calls`). Missed calls opens with `<n> new numbers` or `No new numbers` (large, ≈2.9 s); an empty list `No numbers`.             | `out-c-p2/*`, `out-c-p4/missed-*`, `out-c-p5/cap-*`    |
| S24 | **Options** (rows, `Select`, opens on `Call`): Time of call (`13.10.2026` / `10:10:00`, large, tops 7/21, `Back`), Edit number (`Phone number:` 20 → OK → the standby entry with `Call`), Save (`Name:` → `Phone number:` → `Saved`), Erase (`Erase?` / number, `OK` → `Erased` with the bin animation, 2.98 s → the list renumbered), Call (`Calling`), Send SMS (the editor, `459/1`).                                                                                                  | `out-c-p2/*opt*`, `out-c-p4/save*`, `erase*`           |
| S25 | **Standby ▲** opens the dialled list as a standby screen (`Dialled 1:`, soft key `Call`, ▲/▼, Navi calls, C → standby); with none `No last dialled numbers` (large, info icon, ≈2.87 s). Standby ▼ is the phone book (plan 19).                                                                                                                                                                                                                                                           | `out-c-p2/standby-up*`, plan 19 S1                     |
| S26 | **Erase recent call lists** empties the chosen lists (plan 14's notes). **Show call duration** reads `00:00:00` (thin, x 44, top 29) on every page while calls never connect (S28); with a connected 17.8 s call Last call and All calls' read `00:00:18`. Clear timers (behind the code) shows `Timers cleared`.                                                                                                                                                                         | `out-c-p4/erase-*`, `dur-*`, `out-p1-tch/dur-*`        |
| S27 | **Divert** (22b): `Requesting` ends by itself in `Not done` at ≈15 s with no answer; Quit → `Request not confirmed` → standby. With `SCRATCH_SS=ok` results show (`Active:` / `Voice` / `calls` with `Number`, `Inactive: …`, `Call waiting active`) and standby gains a divert icon.                                                                                                                                                                                                     | `out-c-p6*`, `out-c-p7*`, `out-c-ss-ok`                |
| S28 | **The stock emulator never connects a speech call**: it sends CONNECT on the signalling channel without assigning a traffic channel, so the firmware stays alerting (the ringback runs all call long, durations stay 0). `SCRATCH_TCH=1` assigns a TCH/F in speech mode first: the ringback stops 665 ms after it starts, `Call 1` stays, and the duration counts.                                                                                                                        | `out-b-conn/30-*`, `out-p1-tch/*`, `p1-tch.err`        |
| S29 | **Virgin vs factory**: entry layout, C, `*`, holds, `N#`, the calling and incoming screens, the lists and Options are pixel-identical; the virgin keypad word is 0x9100 and incoming calls ring silently (unset alert, plan 16 D7).                                                                                                                                                                                                                                                       | `out-a-virgin/*`, `out-b-virgin/*`, `out-c-p8-*`       |
| S30 | **Persistence is open**: lists filled, `saveflash`, `reboot` from it: the lists were empty. The firmware may write them at a clean power-off only (Task 0 F).                                                                                                                                                                                                                                                                                                                             | `out-c-boot`                                           |

## Scope and non-goals

In scope: the Goal items; two opt-in phone-core seams (D2), plan 21's `interruption` seam reused
(D4); public nokia-os contract additions (D5, D7); harness additions and captures; goldens,
glyphs, sprites, sound programs; documentation.

Out of scope (owner in brackets): Call divert, Call waiting, SS and USSD requests, Automatic
redial, Own number sending, call costs and Prepaid credit (22b); the phone book screens behind
`Save` and `N#` beyond what plan 19 provides (19); the editor behind Send SMS (18); currency
conversion arithmetic (20: `CalculatorRate.convert`); profile switching during a call (17: its
power-key list); the backlight that blinks with `calling` for Ring once, Beep once and Off (25:
the `leds` column of the goldens); conference and held calls (`End all calls` behaves as `End
active call` with one call; a second call needs call waiting, 22b); fax and data calls; any
website change.

## Decisions

Each decision states what changes relative to the brief and to plans 13-21 and 23.

**D1 - Split in two; this plan is calls and the register (new).** See "Scope split". Placeholders
and pending goldens owned by `22` that concern services move to `22b` (Call divert's are already
asserted widgets; 22b replaces their progress notes). No golden or placeholder names plan 22 when
this plan is done.

**D2 - Standby number entry is a standby application opened by an opt-in kernel seam (new; kernel
seams 1 and 2).** The entry has no menu path and must see the key that started it (DTMF sounds
while it is held, S6). Two generic seams:

1. `PhoneConfig.standbyEntry?: { keys; open(key) }`: at standby, the key-down of a listed key runs
   `open(key)` as a **standby application** (plan 18 D11's activation: empty stack, path `standby`,
   no indicator segments, `exit()` to standby) and forwards that key-down to it; the key's up goes
   to it too. In menu levels (`nav` mode), a listed key that no open shortcut window takes leaves
   the menus as held C does and does the same (S10); at the carousel, the window's first key does
   so when no menu number begins with it (`0`, `*`, `#`; Task 0 sweeps the rest). A notice on
   standby takes the key first (Task 0 checks digits on the missed-call notice).
2. `ApplicationContext.exit({ to: "standby", key })`: an application leaves for standby and hands
   `key`, which is down now, to `standbyEntry` as if it had gone down at standby. Notes, option
   lists and Snake II's Level page use it for the keys S10 lists (nokia-os tables say which widget
   kinds do).

Considered and rejected: `standbyKeys` paths (a path cannot carry the key or the entry's state);
putting entry in the nokia-os wrapper (a second screen owner beside the kernel, and it would not see
menu levels). Plan 19's `standbyKeys` application form is reused for ▲ (D3), not stretched to
digits: its delay and key-up timing differ.

**D3 - Standby ▲ is the dialled list, through plan 19's seam (reuse).** `STOCK_STANDBY_KEYS.up`
becomes the dialled-list application (plan 19 D5's `standbyKeys` application form with
`standbyKeyDelayMs`): `Dialled 1:` with `Call`, or `No last dialled numbers` and standby when the
list is empty (plan 19's `pending:22` golden). If plan 19 Task 4 has not landed, Task 4 here adds
that seam exactly as plan 19 specifies it and plan 19 reuses it.

**D4 - Calls interrupt whatever is on screen through plan 21's seam (reuse).** An incoming call
(and the call it leads to) appears over standby, menus, applications and notes, and when it ends
the screen below is back (S22). Plan 21 D3 defines exactly this:
`PhoneConfig.interruption?: () => PhoneApplication | undefined`, polled each tick, the interrupted
mode held, `exit()` restoring it and `exit({ to: "standby" })` leaving it. nokia-os's poll offers
the telephone's waiting incoming call first, then plan 21's alerts (Task 0 I records which wins
when an alarm or countdown falls due during a call and when a call comes during an alert). Two
facts from this plan's captures feed plan 21's open questions: a timed note under the ringing
screen has ended when the call ends (S22: the held mode's clock catches up on restore, or it kept
ticking; Task 0 I tells them apart with a note longer than the call), and what a Snake II game in
play does (Task 0 I: if the firmware suspends it to its menu, Task 4 adds an optional
`onInterrupted?()` session hook to the seam and records the Deviation in VISION). Outgoing calls
need no interruption: they start from the entry, a list or a name and run in that flow. If plan 21
Task 4 has not landed, Task 4 here adds the seam exactly as plan 21 specifies (whichever lands
first). Considered: a separate `Phone.interrupt` method (a second seam for the same job) and a
nokia-os wrapper overlay (two screen owners, merged snapshots).

**D5 - Telephony goes through the host network port (contract change; extends plan 18 D9).**
`StockNetworkPort` gains two optional members: `dial(number, phone)` for outgoing calls and
`subscribeCalls(ring)` for incoming ones. Each call is a pair of narrow objects: the phone's
`StockCallControl` (the host reports `alerting`, `connected`, `released`) and the host's
`StockCallLink` (the phone reports `answer`, `hangUp`). Every network cause looks the same on the
3310 (S14), so `released()` carries none. The phone applies host events at its next tick and keeps
its own link times (D10). `createSyntheticNetwork()` behaves like the emulator's cell as Task 0
promotes it (D15): every dialled call alerts and connects at once; `ring(number)` places an
incoming call; it records what was dialled. A port without `dial` behaves like the synthetic
network. Times are the phone's.

**D6 - Dial strings are one pure module (new).** `src/calls/dial-string.ts` owns the dial
characters and what a typed string means: the `*` cycle and its commit (S3), the 60-character
first-in-first-out entry (S2), the layout break points (S1), what Call does with it (S9: speed
dial, service request, emergency, call, too long), what an immediate code does (S8) and the number
actually dialled (S9's `+`/`p` cut). Plan 18's `numberEntry` cycles the same `*` characters (its
D4): if plan 18 Task 7 has landed with its own table, Task 6 moves it here (subtract) and plan 18's
widget imports it; otherwise plan 18 imports this module.

**D7 - DTMF on the tone generator's second oscillator (contract change; plan 16's follow-up).**
`StockSoundEvent`'s sounding tone gains `hz2?: number` (absent for single tones, so every plan 16
golden and host is unchanged), as do the sequencer's `SoundNote` and its equality. The sounder
gains a DTMF mode for the next key-down (like `keyBeepLevel`, plan 16 Task 5): the number entry and
the in-call screen set it; it sounds the key's pair at the Keypad tones word (Off: silent, S6) from
the key-down, at least the captured tap length, and until the captured tail after the key-up. The
firmware's key-scan latency is not reproduced (plan 16 D8). The two `pending:22` keypad goldens
become asserted.

**D8 - Call screens and sounds follow the captures; there is no timer and no end note (S11-S16).**
`Calling` with its dots, the alerting/connected `Call 1` (or the caller's name) with End, End's
short `Call 1`, the network end's checkered icon and three beeps, the in-call Volume screen and
Options are reproduced as captured. The ringback plays while the call alerts and stops at the
connect (S28: the stock emulator's endless ringback is an artefact, D15). No screen shows a call
timer or a `Call ended` note, because none does in the captures with a connected call.
`End all calls` and `End active call` both end the one call (no capture has two). `Send DTMF`
follows Task 0 M.

**D9 - Incoming calls ring through plan 16's `ring` with every alert type (completes plan 16
D11).** The ringing screen (S17) runs through the interruption seam (D4);
`StockSounder.ring(prefix)` gains what Task 0 T captures for Ring once, Beep once (a 3000 Hz beep)
and Off (silent), and each type's vibrator pattern (S19); its five tones without a captured second
pass are recaptured whole (plan 16 D11's UNVERIFIED). The active profile's settings choose (plan
17 aliases them). ▲/▼ show Volume, a digit cuts the current note (S20). Answer connects; C rejects
(the call is listed as received, S18); a far-end hangup before Answer is a missed call (S21). The
backlight blink is plan 25's.

**D10 - Link times are the phone's (plan 18 D10's policy).** The synthetic cell answers at once at
protocol level, so the 2207 ms from Call to alerting, the 1982 ms from a network ring to the
ringing screen and End's ≈430-570 ms until the release are the phone's radio signalling. The phone
waits `max(link time, the host's event)` for each (`CALL_SETUP_LINK_MS`, `RING_LINK_MS`,
`RELEASE_LINK_MS`: Task 0 medians with their spread recorded); UNVERIFIED on a live network.

**D11 - Calls are stamped with the phone's time (reuses plan 21's `StockClock`).** Time of call
shows the date and the time to the second (S24). The date, hour and minute are plan 21's phone
time (`StockClock.now()`: the host's `clock()`/`date()` plus the stored offset); plan 21 keeps no
seconds (its `PhoneTime`), and the firmware keeps them in software (plan 21 P5), so plan 22 counts
them: the whole seconds of kernel time since the phone time last changed minute, `00` until the
first change (the captures' frozen RTC shows `10:10:00`). No host port is added. If plan 21 has
not landed, the stamp parses `clock()`/`date()` as plan 21's `parseHostTime` specifies. Whether the
12-hour Time format changes Time of call comes from Task 0 R.

**D12 - Durations count connected time (S26, S28).** A call's duration runs from `connected` (or
Answer) to its end, in kernel time; Show call duration's pages show the last call, all calls,
received and dialled calls as `hh:mm:ss` with the rounding Task 0 X fits (17.8 s showed `00:00:18`).
Clear timers (plan 15's accepted flow) zeroes them.

**D13 - The call register is an EEPROM record (new; plan 15 D2).** `calls` (v1) holds the three
lists (number, name at the time if any, time stamp; Missed 10, Received 10, Dialled 20, newest
first, a repeated number moved to the top, S23), the unread missed count behind the notice and
`<n> new numbers`, and the four duration totals and the last call's. It has no `factory` (Restore
keeps the register, user guide), and Erase recent call lists and Clear timers write it. Task 0 F
decides persistence across a clean power-off (S30); if the lists are lost there, power-off clears
them and this is a Deviation. Changing Phone security erasing the lists (plan 15's follow-up, user
guide) is checked by Task 0 F too.

**D14 - Dependencies are conditional, each with its fallback.**

| Needs                                                                        | From                                  | If it has not landed                                                                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| standby-application activation, `setNotice({ open })`                        | plan 18 Task 4 (or plan 17/19 Task 4) | Task 4 adds them exactly as plan 18 specifies (whichever plan lands first)                                             |
| `StockNetworkPort`, `createSyntheticNetwork`                                 | plan 18 Task 9                        | Task 6 creates the port in plan 18's module path with the call members only; plan 18 adds its SMS members              |
| `numberEntry` (Edit number, Save's number), `textInput` (`Name:`), editor    | plan 18 Tasks 6-7                     | those Options entries open placeholders owned by `18`                                                                  |
| `standbyKeys` applications and `standbyKeyDelayMs` (▲)                       | plan 19 Task 4                        | Task 4 adds them as plan 19 specifies                                                                                  |
| `StockPhoneBook` (`byNumber`, `speedDial`, `add`, a location's entry), names | plan 19 Tasks 5-7                     | numbers only (`Call 1`, no `N#` names: `No phone numbers`, held 2-9 as taps), `Save` opens a placeholder owned by `19` |
| `interruption` (D4), `StockClock.now()` (D11)                                | plan 21 Tasks 4-5                     | Task 4 adds `interruption` as plan 21 specifies; stamps parse `clock()`/`date()` (D11)                                 |
| the power-key profile list during calls and entry                            | plan 17 Task 4-6                      | the power key does nothing there (UNVERIFIED gap, recorded)                                                            |
| `CalculatorRate.convert` (`Convert`)                                         | plan 20 Task 4                        | `Convert` opens a placeholder owned by `20`                                                                            |

Plan 19's `Call` soft keys (name list, Service Nos.) and held 2-9/1 (`pending:22` placeholders and
goldens) are bound here when plan 19 has landed; otherwise plan 19 binds them to this plan's
`dial(number)` when it lands.

**D15 - Captures and goldens (extends plans 14 D5, 16 D7).** Task 0 promotes the scratch harness's
call commands and `SCRATCH_TCH` into `tools/harness` (as a patch `build.sh` applies to a build
copy of the network model; the emulator's sources stay untouched), so connected calls are
captured with a traffic channel. LCD goldens are recorded on the virgin image (their asserted
state, plan 14 D10); sound goldens on the factory image (plan 16 D7); calls and list contents are
created by the harness and, in scenarios, by the synthetic network. Artefacts never reproduced as
behaviour: the endless ringback without a traffic channel, `Orange F` and the frozen `10:10:00`
(test inputs only). Reproduced as captured: the emulator SIM's voice mailbox `793000333` (a virgin
text, plan 14 D10). Not an artefact: every network cause looking the same (the emulator sends the
cause; the firmware shows them alike).

**D16 - The website does not change.** phone-core's seams are opt-in; the website sets none.
`git diff --stat <commit before Task 1> -- website/` is empty at the end.

## Ground truth and artefacts

| Source (`$REF/captures/`)                                       | Contents                                                                   | Use                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| plan 14 goldens `tree/04-call-register/*` (committed)           | empty-register notes, Erase choices, duration and cost pages, Clear timers | stay asserted (a virgin, empty register)   |
| plan 14 probes `shortcut-m1-8-1*`, `-m1-9-c` (`pending:22`)     | digits and C after `Invalid shortcut`                                      | asserted by this plan (D2)                 |
| plan 16 `keypad/keys`, `keypad/hold` (`pending:22`)             | DTMF at standby                                                            | asserted (D7)                              |
| plan 23 `levels/key-1` (`pending:22`)                           | `1` on Snake II's Level page                                               | asserted (D2)                              |
| plan 19 `standby-up` and its `Call`/hold goldens (`pending:22`) | standby ▲, `Call` from names, held 2-9 and 1                               | asserted (D3, D14)                         |
| `6.39/tree/_with-content/04-call-register/`                     | one dialled call: entry view, Options                                      | reference for Task 0                       |
| `scratch-plan22/` (planning)                                    | S1-S30                                                                     | evidence for the decisions; never imported |
| `6.39/plan22/<section>/` (Task 0)                               | canonical captures, LCD and audio                                          | goldens                                    |
| `6.39/plan22/text.json` (Task 0)                                | OCR runs (plan 14 format)                                                  | generated text runs, label checks          |

New artefacts (spec, Task 1):

| Artefact                                                  | Cause                                                   | Handling                                                          |
| --------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| Ringback for the whole call, durations `00:00:00`         | the stock emulator assigns no traffic channel to speech | not reproduced; captures use the promoted traffic channel (D15)   |
| Link times 2207 / 1982 / ≈500 ms                          | synthetic cell signalling                               | phone link time (D10); UNVERIFIED on a live network               |
| `10:10:00` in Time of call                                | the emulator RTC is frozen                              | the phone's time (D11); captured values are test inputs           |
| `793000333` on held `1`                                   | the emulator SIM's voice mailbox                        | the virgin text plan 14 imports (Messages › Voice mailbox number) |
| `Serial No.` with `?` glyphs (`*#06#`)                    | the virgin EEPROM has no IMEI                           | the virgin state, reproduced as captured (plan 14 D10)            |
| A second incoming call is paged only after the first ends | the emulator queues services                            | not reproduced; call waiting is 22b's                             |
| `000` dials as `00` in the harness log                    | the harness's digit parsing                             | none (only the log)                                               |

## Package boundaries

Unchanged from plans 13-21. phone-core gains two generic, opt-in seams (D2's `standbyEntry` and
`exit({ key })`) and reuses plan 18's standby applications, plan 19's `standbyKeys` applications and
plan 21's `interruption`, with no Nokia labels, timings or telephony concepts. nokia-os
gains no dependency, touches no network or audio API, and reaches the network only through
`StockNetworkPort`.

## Contract changes

Task 1 writes these into `VISION.md`.

### `@hellotimber/phone-core` (additive, opt-in)

```ts
export interface PhoneConfig<Metadata = unknown> {
  // ...plans 13-19 unchanged...
  /**
   * Plan 22: keys that start a standby application with themselves. At standby the key-down of a
   * listed key runs `open(key)` as a standby application (plan 18: empty stack, path `standby`,
   * `menuIndicator()` without segments, `exit()` to standby) and forwards that key-down (and its
   * up) to it. In menu levels a listed key that no open shortcut window takes leaves the menus
   * (as held C) and does the same; at the carousel so does a window's first key that begins no
   * menu number. Default: none.
   */
  standbyEntry?: { keys: readonly PhoneKey[]; open(key: PhoneKey): PhoneApplication };
}

export interface ExitOptions {
  // ...plans 14-15 unchanged...
  /**
   * Plan 22: with `to: "standby"`, the held key `key` then starts `standbyEntry` as if it had
   * gone down at standby. Throws without `to: "standby"`; ignored when `key` is not listed.
   */
  key?: PhoneKey;
}
```

Rules (Task 4 pins each): configs without `standbyEntry` produce identical models;
`standbyEntry.keys` must not hold `navi`, `c` or `power` (throws); an exception in `open()` or
`createSession` shows the `App error` reader as for any application; `standbyEntry` is not
consulted during boot, a boot gate or an interruption (plan 21's). Plan 21's `interruption` is used
as plan 21 specifies it (D4).

### `@hellotimber/nokia-os` (additive)

```ts
/** Plan 22: the host's side of one call; the phone calls these. */
export interface StockCallLink {
  /** Incoming calls only: the user answered. */
  answer(): void;
  /** The user ended the call, or rejected it while it rang (End, C, power-off). Called once. */
  hangUp(): void;
}

/** Plan 22: the phone's side of one call; the host calls these, applied at the phone's next tick. */
export interface StockCallControl {
  /** Outgoing: the far end is ringing (`Call 1`, the ringback). */
  alerting(): void;
  /** Outgoing: the far end answered (the ringback stops, the duration starts). */
  connected(): void;
  /** The far end or the network ended the call; before Answer, an incoming call becomes missed. */
  released(): void;
}

/** Plan 22: an incoming call as the network presents it. */
export interface StockIncomingCall {
  readonly number: string; // as the network sends it: digits, `+` dropped (S17)
}

export interface StockNetworkPort {
  // ...plans 18-19 unchanged...
  /** Plan 22: the phone dials `number` (as S9 cuts it). Absent: the synthetic network's behaviour. */
  dial?(number: string, phone: StockCallControl): StockCallLink;
  /** Plan 22: called once by createStockPhone; the host calls `ring` for each incoming call. */
  subscribeCalls?(
    ring: (call: StockIncomingCall, link: StockCallLink) => StockCallControl,
  ): () => void;
}

// createSyntheticNetwork() gains:
//   ring(number: string): { hangUp(): void; readonly state: "ringing" | "connected" | "ended" };
//   readonly dialled: readonly string[];
// Its dial() alerts and connects at once; its calls end only when the phone or the test ends them.

/** Plan 16's event, extended: a sounding tone may have a second frequency (DTMF). */
export type StockSoundEvent =
  | {
      readonly output: "buzzer" | "tone";
      readonly atMs: number;
      readonly hz: number;
      /** Plan 22: the tone generator's second oscillator (DTMF); absent for single tones. */
      readonly hz2?: number;
      readonly volume: number;
    }
  | { readonly output: "buzzer" | "tone"; readonly atMs: number; readonly hz: null }
  | { readonly output: "vibrator"; readonly atMs: number; readonly on: boolean };
```

Rules (Tasks 5-6 pin each): `hz2` appears only on `tone` events; a host event for a call that has
ended is ignored; `alerting` after `connected` is ignored; a `ring` while the phone is off or
booting is released at once (the network sees no answer; UNVERIFIED: a real network would send it
to a divert, 22b); a `ring` during a call waits until the call ends (S22, call waiting is 22b);
`StockCallLink` methods are called at most once each; power-off hangs every call up.

## Internal API for later plans

Plans 19, 22b, 18c and the portfolio integration consume these. Signatures are fixed by Tasks 6-9;
a change is a Deviation recorded here.

```ts
// src/calls/dial-string.ts (pure)
export const DIAL_LIMIT = 60; // S2
export type DialOutcome =
  | { kind: "call"; number: string } // the number sent (S9's cut applied)
  | { kind: "emergency"; number: string }
  | { kind: "speed-dial"; key: number } // one digit
  | { kind: "service"; text: string } // 22b: SS and USSD
  | { kind: "invalid" }; // too long
export function dialOutcome(entry: string): DialOutcome;
export function immediateCode(entry: string): "imei" | "version" | { recall: number } | undefined;
export function starCycle(previous: string | undefined): string; // `*` → `+` → `p` → `w` → `*`

// src/calls/log.ts
export const CALLS_RECORD: EepromRecord<CallsState>;
export type CallList = "missed" | "received" | "dialled";
export interface CallEntry {
  readonly number: string;
  readonly at: PhoneTime & { readonly second: number }; // plan 21's PhoneTime (D11)
}
export class StockCallLog {
  constructor(eeprom: StockEeprom);
  entries(list: CallList): readonly CallEntry[]; // newest first
  add(list: CallList, entry: CallEntry): void; // capacity, de-duplication (D13)
  erase(list: CallList | "all", index?: number): void;
  unreadMissed(): number;
  markMissedRead(): void;
  durations(): CallDurations; // seconds: last, all, received, dialled
  addDuration(direction: "received" | "dialled", ms: number): void;
  clearDurations(): void;
}

// src/calls/telephone.ts (per phone)
export class StockTelephone {
  dial(number: string, flow: Flow): void; // the Calling flow (from entry, lists, names)
  readonly active: boolean;
  tick(nowMs: number): void;
}
```

## Shared-file edits

One-line registrations unless stated.

| File                                                                                                                                       | Edit                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/firmware/features/index.ts`                                                                                                           | one line: `diallingFeature` (`callRegisterFeature` exists)                                                                                                                                                                                      |
| `src/firmware/records.ts`                                                                                                                  | one line: `CALLS_RECORD`                                                                                                                                                                                                                        |
| `scripts/capture-sets/index.ts`                                                                                                            | one line: `calls`                                                                                                                                                                                                                               |
| the capture-set sources of plans 14, 16, 19, 23 (`tree-capture-set.ts`, `sound-capture-set.ts`, `game-capture-set.ts`, `19-phone-book.ts`) | flip `pending:22` → `asserted`, one line per golden: `probe/shortcut-m1-8-1`, `-m1-8-1-2`, `-m1-9-c`; `sound/keypad/keys`, `sound/keypad/hold`; `game/snake/level-keys-digit-1`; plan 19's `phone-book/standby-up`, `hold-*` and `Call` goldens |
| `tests/acceptance/{14,16,19,23}-*.test.ts`                                                                                                 | one spread line each: plan 22's scenarios for the goldens flipped in that plan's index (`tests/support/calls.ts`)                                                                                                                               |
| `src/firmware/phone.ts`                                                                                                                    | ≈10 lines: `standbyEntry`, `STOCK_STANDBY_KEYS.up` → the dialled list, the network's `subscribeCalls`, the telephone's tick, the `interruption` poll composed with plan 21's (telephone first, D4)                                              |
| `src/firmware/leaves.ts`                                                                                                                   | `invalidShortcut`: digits, `*`, `#` exit with `{ to: "standby", key }` (≈3 lines, D2)                                                                                                                                                           |
| `src/widgets/note.ts`, `src/widgets/option-list.ts`, `src/widgets/level-bar.ts`                                                            | the S10 digit hand-over, ≈3 lines each, behind an option the bindings set                                                                                                                                                                       |
| `src/sound/{port,program,sequencer,sounder}.ts` (plan 16's)                                                                                | `hz2` (D7), the DTMF mode, `ring` alert types (D9), the call programs: ≈60 lines in all                                                                                                                                                         |
| `src/display/standby.ts`                                                                                                                   | one call: the missed-call notice's icon (by notice text)                                                                                                                                                                                        |
| `src/widgets/snake.ts`                                                                                                                     | `onInterrupted` suspends the game, only if Task 0 I shows the firmware does (≈3 lines, D4)                                                                                                                                                      |
| `src/index.ts`                                                                                                                             | one line: the call types                                                                                                                                                                                                                        |
| `demo/panels/index.ts`                                                                                                                     | one line: the calls panel                                                                                                                                                                                                                       |
| `packages/phone-core/src/{types,machine,application,index}.ts`                                                                             | `standbyEntry` and `exit({ key })` (Task 4); plans 18, 19 and 21's seams only if those plans have not landed (D14)                                                                                                                              |

## Golden pipeline additions

The capture set is `scripts/capture-sets/22-calls.ts`, an explicit table like plan 19's (LCD,
sound). Ids, `status: asserted` unless noted; every scenario is hand-written in the acceptance
file. Sources are under `$REF/captures/6.39/plan22/`.

| Fixture id(s)                                              | Source                            | Kind               | Asserts                                                                                         |
| ---------------------------------------------------------- | --------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| `calls/entry-length-<n>`                                   | `entry/length/*`                  | stills             | 1-47 characters, every digit and `+ p w * #` in both faces (S1)                                 |
| `calls/entry-{star,hash,commit,limit,c,c-hold}-*`          | `entry/*`                         | timelines / stills | the `*` cycle and commit, `#`, 60 FIFO, C, held C and its threshold (S2-S4)                     |
| `calls/entry-softkey-*`, `entry-save-*`, `entry-convert-*` | `entry/softkey/*`                 | timelines          | ▲/▼ soft keys, Save (`pending:19` without names), Convert (`pending:20` if 20 has not landed)   |
| `calls/entry-hold-*`, `entry-recall-*`, `entry-code-*`     | `entry/hold/*`, …                 | timelines          | held 1/2-9/0/`*`/`#`, `N#`, `*#06#`, `*#0000#` (S7, S8)                                         |
| `calls/handover-*`                                         | `handover/*`                      | timelines          | digits from notes, lists, the carousel, option lists, the Level page (S10)                      |
| `calls/dial-*`                                             | `dial/*`                          | timelines          | Calling, alerting, connected, End, too long, one digit, `112`, `+`, `p` (S9, S11-S13)           |
| `calls/net-end-*`                                          | `dial/net-end/*`                  | timelines          | the network's end while alerting and connected (S14)                                            |
| `calls/in-call-*`                                          | `in-call/*`                       | timelines          | Volume, DTMF digits, C, Options and its entries, power (S15)                                    |
| `calls/ring-*`, `calls/missed-*`                           | `ring/*`                          | timelines          | the ringing screen (number, long number, name), Answer, C, missed, the notice, `List` (S17-S21) |
| `calls/interrupt-*`                                        | `interrupt/*`                     | timelines          | ringing over a menu, the entry, a note, the editor, Snake II (S22, Task 0 I)                    |
| `calls/list-*`, `calls/options-*`                          | `register/*`                      | timelines / stills | lists, ordering, capacity, every Options entry, standby ▲ (S23-S25)                             |
| `calls/erase-*`, `calls/duration-*`                        | `register/erase/*`, `durations/*` | timelines / stills | Erase recent call lists with content, durations after connected calls, Clear timers (S26)       |
| `calls/persist-*`                                          | `persist/*`                       | stills             | the register after a clean power-off and after Restore (D13)                                    |
| `sound/calls/dtmf-*`, `sound/calls/in-call-*`              | `sound/dtmf/*`, …                 | sound              | DTMF per key, tap and hold, per Keypad tones level; in-call DTMF and Volume beeps (D7)          |
| `sound/calls/ringback`, `net-end`, `ring-<alert>-*`        | `sound/*`                         | sound              | the ringback, the end beeps, ringing per alert type and tone (D8, D9)                           |
| `sound/note/<name>`                                        | `notes/*`                         | sound              | warning tones of the new notes (plan 16's format, so `NOTE_SOUNDS` reads them)                  |

## Stock display observations (scratch; Task 3 measures from goldens)

| Element       | Observation                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Number entry  | standby without the operator line; large digits right-aligned (rightmost cell from x 69), 8 per line at tops 24/9; small from 17, tops 29/20/11 |
| Calling       | `Calling` + dots small at (6, 7); the number thin, right-aligned to x ≈80 at top 29 (overflow top 20); `End`                                    |
| Call screen   | a 7×7 call icon at (6, 8) (solid; checkered when the network ended it), `Call 1` thin at (17, 8) or the name; `End`/`Options`                   |
| Volume        | `Volume` small at (5, 0); ten stepped bars below; ≈1.9 s                                                                                        |
| Incoming      | the number thin right-aligned at top 8 (or the name small at (6, 8)), `calling` small at (6, 28) blinking 480/480 ms, `Answer`; no clock        |
| Missed notice | an icon left, `1` / `missed` / `call` small at x 6, tops 7/16/25, the clock, `List`                                                             |
| List entry    | `Missed 1:` small at (0, 7), the number large at (4, 24), `Options`                                                                             |
| Time of call  | `13.10.2026` and `10:10:00` large at tops 7 and 21, `Back`                                                                                      |
| Durations     | `00:00:00` thin at (44, 29) on plan 14's pages                                                                                                  |

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` (repeat `mise exec -- vp fmt` until stable) and
  the named test commands. A task that touches `phone-core` also runs `mise exec -- vp run -r test`
  and `mise exec -- vp run website#build`.
- Commit rule: run `mise exec -- vp check --fix` yourself, then `git commit --no-verify` with only
  your files staged (prefer `git commit --no-verify -m "<message>" -- <paths>`). Never `git add
-A`/`git add .`, never `git stash`. Never stage `TODOS.md` (Lachlan's untracked notes).
- Never hand-edit `goldens/**`, `src/resources/generated/**`, `src/firmware/generated/**` or
  `scripts/generated/**`; change the generator or its tables and regenerate
  (`mise exec -- vp run @hellotimber/nokia-os#regenerate`). Each generator runs twice with no diff
  before its commit.
- Tests never read `$REF`. Generators that read `$REF` fail clearly when it is missing.
- No new dependencies.
- When reality differs from this plan, follow the captures and append a `Deviation:` paragraph
  under the task. If a deviation breaks a contract in VISION.md, stop and report.
- Parallelism (max 3 concurrent agents): Task 0 gates everything, then Task 1. Then lanes A
  (2 → 3), B (4) and C (6). Task 5 needs 3 and 6; Task 7 needs 4, 5 and 6; Task 8 needs 7; Task 9
  needs 6 and 7 (it may run beside 8; both register in `call-register.ts`/`dialling.ts`, commit in
  order); Task 10 needs 8 and 9; then 11.

## Tasks

### Task 0 - Harness call commands and canonical REF captures (no repository changes)

**Files (all under `$REF`, gitignored):** `tools/harness/{build.sh,dct3cap.c,rom6-calls.patch}`,
`captures/scripts/gen_v639_plan22.py`, `captures/scripts/v639-plan22-<section>.cap` (command logs),
`captures/6.39/plan22/**`, `firmware/work/v639-plan22-*.fls`, a "Plan 22 supplementary captures"
section in `captures/README.md` (and its command table).

- [ ] Read `$REF/captures/README.md`, `captures/scratch-plan22/NOTES.md` and its `tools/*.py` and
      `harness/`. Do not modify existing captures or scripts.
- [ ] Harness: promote the scratch commands into `tools/harness` (which already has `callin` and
      `sms`; merge by hand if another plan changed it): `answer`, `hangup [cause]`, `callstate`, and the
      switches `CAP_MO_HOLD=1` and `CAP_TCH=1` (the scratch `SCRATCH_*` names; `CAP_TCH` also
      assigns a traffic channel to MT calls at CALL CONFIRMED, which the scratch copy does not:
      verify that a received call's duration counts). `build.sh` applies `rom6-calls.patch` to a
      build-directory copy of `src/mad2/dsp/dsp_rom6.c` (as it already copies `main.c`); the
      emulator's sources stay untouched; with no switch set, output is byte-identical to the stock
      harness (rerun the plan 13 clock script and compare). Keep `SCRATCH_SS` out (22b promotes it).
- [ ] `gen_v639_plan22.py` (`run -j 3`, `--only`, `ocr`, `check`), driving `tools/menutree/emu.py`
      like plans 16, 19 and 23; LCD sections on the virgin image (`v639-setup.inc`), sound sections
      on the factory image (`v639-factory-setup.inc`), every call with `CAP_TCH=1` except the
      sections named "stock".
- [ ] **E entry** (`plan22/entry/`): every length 1-47 with all of `0-9 + p w * #` appearing in
      both faces; the `*` cycle with commits at 1300-1600 ms in 50 ms steps; `#` taps; 60/61/70
      characters and deleting back; C, held C at 400-550 ms in 25 ms steps; ▲/▼ through the soft
      keys, held; Save (with and without a name typed), Convert (virgin rate), digits and C on each
      soft key; power and C back; 70 s idle.
- [ ] **H holds and codes** (`plan22/entry/hold/`, `recall/`, `code/`): held 0-9, `*`, `#` from 400
      to 1000 ms (thresholds) on an empty entry and inside one, with Speed dialling unset, Off and
      On (with plan 19's fixture SIM if it exists, else the voice mailbox only); the factory held
      `1`'s 1750 Hz tone at ≈507 ms (what note?); `1#`…`50#`, `0#`, `51#`, with the empty SIM and a
      SIM with names; `*#06#`, `*#0000#`, other `*#…#` codes typed (record what each does).
- [ ] **S handover** (`plan22/handover/`): a digit, `*` and `#` on every widget kind (each note
      class, option list, info pages, confirm query, prompts, level bar, text pages, splash,
      progress note), on a list entered by Select and by shortcut (inside and after the window),
      the carousel before and after its window with every first key, the missed-call notice, the
      `Invalid shortcut` note; record which keys start an entry.
- [ ] **D dial** (`plan22/dial/`): Call on 1 digit (with Speed dialling On and a key assigned, if
      a fixture allows), `12`, `04`, a 10/20/28/32/33-digit number, `+61412345678`, `0412+345`,
      `0412345678p123` and `w123` (what happens after the connect: DTMF sent? record 20 s with
      audio), `112`, `911`; End while calling, alerting (`CAP_MO_HOLD`) and connected; C while
      calling and alerting; the network's end (`hangup 16`) while calling, alerting and connected;
      five calls for the link-time medians; the `stock` variant once (no traffic channel) for the
      artefact table.
- [ ] **M in call** (`plan22/in-call/`): ▲/▼ to both ends and held; every digit, `*`, `#` tapped
      and held (audio); C, C held; Options and each entry (Send DTMF's flow to its end; End all
      calls; End active call); power; a 70 s call; a call ended by each of End, C-then-Options, the
      network.
- [ ] **T incoming** (`plan22/ring/`, factory for sound, virgin for LCD): ringing ≥ 2 cycles for
      each alert type (Ringing, Ascending, Ring once, Beep once, Off) with Vibrating alert On and
      Off; the five tones whose preview ends inside its first pass (plan 16 D11) ringing whole; the
      ringing screen for 3-, 10-, 14-, 15-, 20-digit numbers and a name; Answer, C, held C; ▲/▼, a
      digit, `#`, `*`, Navi held, power while ringing; missed (`hangup` before Answer) at standby
      and over a menu; the notice with 1, 2 and 11 missed calls; C, `List`, a digit, ▲/▼ on it.
- [ ] **I interrupt** (`plan22/interrupt/`): a ring over a menu level, an option list, a timed note,
      a progress note, the standby entry, the editor (Write messages), a Snake II game in play (is
      it suspended?), the Calculator, a security-code prompt; for each, Answer + End, C and missed:
      what is on screen afterwards; a timed note longer than the call and one shorter (does the held
      note keep ticking or catch up? plan 21 D3). A ring during a call and during Calling (queued?).
      The countdown timer (plan 21's capturable alert) expiring during a call, and a ring during
      its alert: which wins, and what each shows after.
- [ ] **R register** (`plan22/register/`): fill each list past capacity; every entry view (number,
      long number, name) and Options entry with its result; Time of call with 24- and 12-hour
      Time format; opening Missed calls with unread and read entries; standby ▲ with none, one and
      twenty dialled numbers (▲/▼, Navi, C, held C); Erase recent call lists with content.
- [ ] **X durations** (`plan22/durations/`): connected calls of 0.5, 1.4, 1.6, 59.6, 60.4 and 3600 s
      (dialled and received), each page after each (the rounding rule); Clear timers (re-provisioned
      code image) after them.
- [ ] **F persistence** (`plan22/persist/`): lists and durations after `saveflash` + `reboot`, after
      a clean power-off (power held) before `saveflash`, after Restore factory settings, after
      Phone security On and Off, and with a second SIM.
- [ ] **N notes and sound** (`plan22/sound/`, `notes/`): DTMF per key, tap and 1 s hold, at Keypad
      tones Off/1/2/3 and virgin; the ringback, the network-end beeps, the Volume beep; warning
      tones of `Invalid phone number`, `Speed dial number not saved`, `No last dialled numbers`,
      `Invalid location`, `<n> new numbers`, `No new numbers`, `Erased`, `Attempting emergency
call`.
- [ ] OCR every new image into `plan22/text.json` (plan 14's format and command).
- [ ] `check`: every recording starts on its parent screen; every call section's log shows the
      expected protocol events; LCD frames of `CAP_TCH` and stock calls agree before the connect.
- [ ] Append "Plan 22 supplementary captures" to `$REF/captures/README.md`.
- [ ] No commit. Record the outcome under this task: the harness change, every threshold and link
      time with its spread, the handover table, the interrupt table, the duration rounding,
      persistence, Send DTMF, the alert-type matrix and anything that failed.

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `docs/specs/stock/calls.md` (new), `docs/specs/nokia-3310.md` (§10 one
row; §4, §6, §9 history notes), `docs/specs/nokia-3310-menu-tree.md`, `docs/plans/README.md`, this
plan.

- [ ] Apply Task 0's outcome to D2-D13 and the contracts (Deviation lines where it changes them).
- [ ] VISION: the two phone-core seams and the nokia-os call port and `hz2` exactly as in
      "Contract changes"; a plan 22 kernel-policy paragraph (standby entry, the key hand-over; calls
      use plan 21's interruptions); the nokia-os row mentions calls. If plan 18 has not narrowed the non-goal
      "Simulating telephony", narrow it to the website (nokia-os simulates nothing: the host owns
      the network).
- [ ] `docs/specs/stock/calls.md`: "Number entry, calls and the call register (plan 22)" with the
      S-findings as verified by Task 0, the artefacts above, everything "(plan 22, in progress)";
      §10's index row.
- [ ] Spec §4/§6/§9 (manual-sourced): mark `Call` after a digit, ▼ = redial list, the `*` cycle
      and the in-call scroll keys as history and point to `stock/calls.md`.
- [ ] Menu-tree spec: Dialled numbers › Options › Erase shows `Erased` (not `Dialled numbers
erased`); "Needs incoming traffic": the harness can inject calls; 4-5's values count connected
      calls (the stock emulator never connects speech).
- [ ] Plans README: row 22 `in progress`.
- [ ] No runtime code. `mise exec -- vp check --fix`.
- [ ] Commit: `docs: define number entry, call and register contracts (plan 22)`.

### Task 2 - Goldens and the capture set (TDD)

**Files:** `scripts/capture-sets/22-calls.ts` (new), `scripts/capture-sets/index.ts` (one line),
`tests/capture-sets/22-calls.test.ts` (new), `tests/acceptance/22-call-register-divert-and-dialling.test.ts`
(new: the todo shim only), `goldens/**` (generated), `goldens/index/22.json` (generated).

- [ ] TDD the capture set on synthetic recordings (injected loader, as plan 19's): ids, kinds, cut
      points, `trigger-frame` on the first changed frame (plan 14 D8), sound rows in plan 16's
      format with DTMF pairs as `<hz>+<hz2>` (already in the format), the stock-variant recordings
      listed under `notImported` with the reason (D15).
- [ ] Register the set (one line). The acceptance file lists the new asserted goldens without a
      scenario as todos (`awaitsPlan22Scenario`; Task 10 deletes it).
- [ ] The `pending:22` goldens of plans 14, 16, 19 and 23 stay pending here: each is flipped in the
      task that adds its scenario (Tasks 5, 7, 8, 9), by its status line in the owning capture set
      and one spread line in the owning plan's acceptance file ("Shared-file edits"), then
      `import-captures` rewrites only that plan's index status.
- [ ] Integrity: new ids parse; `22.json` is sorted; once Task 10 is done no golden is `pending:22`.
- [ ] Run `import-captures` twice; the second run changes nothing. Record fixture counts, images
      and bytes (budget guide: ≤ 3 MB of new text grids; stills for entry lengths, timelines only
      where timing matters).
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(nokia-os): import number entry, call and register goldens (plan 22)`.

### Task 3 - Glyphs, sprites, timelines and sound programs (TDD)

**Files:** `scripts/capture-sets/22-calls.ts` (text runs and crop table, or the shared tables'
per-plan files if the split provides them), `scripts/generated/**`, `src/resources/generated/**`
(regenerated), `src/resources/index.ts` (accessors), `tests/resources.test.ts`.

- [ ] Text runs for the new images from `plan22/text.json`; the harvester's reports resolved with
      overrides that name their golden. Glyphs needed: `+ p w * #` in the large and small faces,
      every digit in the small face at the entry's size, the thin digits of long numbers.
- [ ] Sprites: the call icon (solid, checkered), the missed-call notice icon, Volume's bars (each
      step), the `Erased` bin frames (shared with plan 19 if it landed: one sprite set), the
      `Calling` dots if not text.
- [ ] Widget timelines: `Calling` dots, the alerting/blank/connected steps, End's short screen,
      the network end, the incoming blink, Volume's hold, the in-call digits' `Options` hold, every
      new note (`Invalid phone number`, `Speed dial number not saved`, `No last dialled numbers`,
      `Invalid location`, `<n> new numbers`, `No new numbers`, `Erased`, `Attempting emergency
call`). Link times `CALL_SETUP_LINK_MS`, `RING_LINK_MS`, `RELEASE_LINK_MS` (D10) as medians with
      the spread in a comment; the entry's thresholds (`*` commit, held C, held keys) as
      `DIAL_TIMINGS`.
- [ ] Sound programs (plan 16's generator): `DTMF` (pairs, tap length, release tail, onset), the
      ringback, the network-end beeps, the Volume beep, the ringing alert types and their vibrator
      patterns (D9), the new notes' `NOTE_SOUNDS`.
- [ ] TDD freshness; every new sprite is binary and inside its golden's ink; every new string
      renders in its face (`missingStockGlyphs`); every program re-renders its golden.
- [ ] Run `regenerate` twice; no diff.
- [ ] Commit: `feat(nokia-os): harvest call glyphs, sprites, timelines and sound programs`.

### Task 4 - phone-core: standby entry and key hand-over (TDD)

**Files:** `packages/phone-core/src/{types.ts,machine.ts,application.ts,index.ts}`, README; tests
`standby-entry.test.ts` (new). Plan 18's standby-application activation, plan 19's `standbyKeys`
applications and plan 21's `interruption` are reused if they have landed, else added here exactly
as those plans specify (D14), each with that plan's tests.

- [ ] TDD `standbyEntry`: a listed key-down at standby opens `open(key)` as a standby application
      that receives that key-down and its up; unlisted keys behave as today; `navi`/`c`/`power` in
      `keys` throw; a notice takes keys first (Task 0 S); in `nav` mode a listed key with no open
      window leaves the menus (deactivating an application below as held C does) and opens the
      entry; a key a window takes stays a shortcut; at the carousel the window's first key that
      begins no number (per the level's numbers) opens the entry; not consulted during boot, a
      gate or an interruption.
- [ ] TDD `exit({ to: "standby", key })`: from an application and an intro; from a gate it throws;
      the key is still down and its up reaches the entry; `key` without `to` throws.
- [ ] If Task 0 I shows Snake II suspended by a call: the optional `onInterrupted?()` hook on plan
      21's interruption (called once on the held session when an interruption starts), with tests.
- [ ] Existing tests pass unchanged; configs without the seams produce identical models.
- [ ] `mise exec -- vp run @hellotimber/phone-core#test`, `vp run -r test`, `vp run website#build`,
      `vp check --fix`.
- [ ] Commit: `feat(phone-core): standby entry and key hand-over`.

### Task 5 - DTMF, ringing and call sounds (TDD against sound goldens)

**Files:** `src/sound/{port,program,sequencer,sounder}.ts` (plan 16's, "Shared-file edits"),
`src/index.ts` (the event type is re-exported unchanged), `tests/sound-calls.test.ts` (new),
`tests/sequencer.test.ts` (new cases only).

- [ ] TDD `hz2`: the sequencer emits it on tone events only; two states differing only in `hz2`
      differ; every plan 16 sound golden still passes byte for byte.
- [ ] TDD the DTMF mode: `keyDtmf()` before a key-down makes that key sound its pair at the Keypad
      tones word (Off: silent; unset: 0x9100), at least the tap length, until the tail after its
      up; a held key; fast taps (S6); against `sound/keypad/keys`, `keypad/hold`,
      `sound/calls/dtmf-*`.
- [ ] TDD `ring(prefix)` per alert type and Vibrating alert against `sound/calls/ring-*` (D9);
      `stopRing()`; the ringback, the network-end beeps and the Volume beep as `callSound(name)`.
- [ ] `sound/keypad/keys` and `sound/keypad/hold` need the entry to set the DTMF mode at standby, so
      they are flipped in Task 7; here the DTMF mode is tested directly on the sounder.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): DTMF, ringing alert types and call sounds`.

### Task 6 - Dial strings, the call log and the network's call half (pure, TDD)

**Files:** `src/calls/{dial-string.ts,log.ts,network.ts,timestamp.ts}` (new),
`src/firmware/records.ts` (one line), plan 18's network module (the call members, D14), `src/index.ts`
(one line), `tests/dial-string.test.ts`, `tests/call-log.test.ts`, `tests/call-network.test.ts`
(new).

- [ ] TDD `dial-string.ts` from Task 0's tables: the `*` cycle, 60 FIFO, the layout breaks, every
      S9 outcome (one digit, `1x`, other two-digit strings, `#`-ended strings, `112`, too long, `+`,
      `p`, `w`), the immediate codes and `N#` (S8).
- [ ] TDD `CALLS_RECORD` and `StockCallLog` (D13): capacities, newest first, a repeated number moved
      up, rejected → received, unread missed, durations and their rounding (D12), Erase recent call
      lists, Clear timers; decode drops malformed entries; no `factory`; the stored JSON pinned by a
      snapshot; persistence per Task 0 F.
- [ ] TDD the network's call half: `createSyntheticNetwork().dial` alerts and connects;
      `ring(number)` and its `hangUp`; `dialled`; host events applied at the next tick, after the
      link times (D10); events after the end ignored; power-off hangs up; a `ring` while off,
      booting or in a call (D5 rules).
- [ ] `timestamp.ts`: the call stamp (plan 21's phone time plus the counted seconds, or the parsed
      host strings, D11) and Time of call's format (both Time formats per Task 0 R).
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): dial strings, the call log record and the network's calls`.

### Task 7 - Standby number entry and the key hand-over (TDD against goldens)

**Files:** `src/firmware/features/dialling.ts` (new: the feature, the entry application, the
hand-over tables), `src/widgets/dial-entry.ts` and `src/display/widgets/dial-entry.ts` (new), the
features index and widget-model union (one line each), `src/firmware/phone.ts`,
`src/firmware/leaves.ts`, `src/widgets/{note,option-list,level-bar}.ts` ("Shared-file edits"),
`tests/dialling.test.ts` (new).

- [ ] The entry widget: S1 layouts from literal models against `calls/entry-length-*`; keys through
      `dial-string.ts`; the `*` commit and held C timed by the widget (plan 18 D5's pattern); C on
      the last character exits (the operator's late redraw as captured); ▲/▼ soft keys; Save
      (plan 19's add flow, D14), Convert (plan 20, D14); DTMF through `keyDtmf` (Task 5).
- [ ] Holds: `1` (voice mailbox from `messages/voice-mailbox-number`), 2-9 (Speed dialling and plan
      19's `speedDial`), the rest as taps; `N#` (plan 19's location lookup, or `No phone numbers`),
      `*#06#`, `*#0000#`.
- [ ] Call: `dialOutcome` → the Calling flow (Task 8), `Speed dial number not saved`, `Invalid
phone number`, emergency, a service string → a placeholder owned by `22b`.
- [ ] `createStockPhone`: `standbyEntry` with the dial keys; the hand-over (S10) in `invalidShortcut`,
      notes, option lists and the Level page (D2).
- [ ] TDD through keys against `calls/entry-*`, `calls/handover-*`, plan 14's `shortcut-m1-8-1`,
      `-m1-8-1-2`, `-m1-9-c` and plan 23's `level-keys-digit-1` (pixels exact; timelines ±2 ms, or
      plan 14 closeout decision 2's stated tolerance where a scenario replays another recording).
- [ ] Flip those four goldens and plan 16's two keypad goldens (Task 5) to `asserted` (one status
      line each in `tree-capture-set.ts`, `game-capture-set.ts`, `sound-capture-set.ts`), add their
      scenarios to plans 14, 16 and 23's acceptance files by one spread line each, rerun
      `import-captures` (only their index statuses change).
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): standby number entry and DTMF`.

### Task 8 - Calls: dialling, ringing and the in-call screens (TDD against goldens)

**Files:** `src/calls/telephone.ts` (new), `src/firmware/features/dialling.ts`,
`src/widgets/{calling,call,ringing,volume}.ts` and their painters (new), `src/firmware/phone.ts`,
`src/display/standby.ts` (one call), `src/widgets/snake.ts` (if Task 0 I), plan 19's `Call`
placeholders (`features/phone-book.ts`, D14), `tests/calls.test.ts` (new).

- [ ] `StockTelephone` per phone: dials through the port, applies its events and link times, keeps
      the call's state, writes the log (dialled at Call, received at Answer or reject, missed at a
      release before Answer) and the duration (D12).
- [ ] Outgoing flow: Calling → alerting (`Call 1` or the name from plan 19's `byNumber`) with the
      ringback → connected → End/C/Options/the network's end, as S11-S15; `112`.
- [ ] In-call keys: Volume (an earpiece level kept for the session, or stored per Task 0 M), DTMF
      digits and their display, `Options` and its three entries, power (plan 17's list, D14).
- [ ] Incoming: `subscribeCalls` → the telephone offers the ringing flow to the `interruption` poll
      after `RING_LINK_MS` (D4); the screen,
      `ring(prefix)` (D9), Answer, C, keys while ringing (S20); missed → the notice through
      `setNotice({ text, softkey: "List", open })` (plan 18) and its icon; `List` → `<n> new
numbers` → Missed calls.
- [ ] Bind plan 19's `Call` placeholders and held 2-9/1 to `dial` (if plan 19 has landed); flip its
      `pending:22` call and hold goldens (status lines in `19-phone-book.ts`, one spread line in
      plan 19's acceptance file).
- [ ] TDD through keys and the synthetic network against `calls/dial-*`, `net-end-*`, `in-call-*`,
      `ring-*`, `missed-*`, `interrupt-*` and the sound goldens.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): dialling, incoming calls and the in-call screens`.

### Task 9 - The call register (TDD against goldens)

**Files:** `src/firmware/features/call-register.ts` (the lists 4-1…4-3, Erase recent call lists
4-4, the duration pages 4-5-1…4 and Clear timers' erase 4-5-5), `src/widgets/call-entry.ts` and its
painter (new), `src/firmware/phone.ts` (▲: `STOCK_STANDBY_KEYS.up`), `tests/call-register.test.ts`
(new).

- [ ] 4-1…4-3: opening notes (`<n> new numbers`, `No new numbers`, `No numbers`), the entry view,
      ▲/▼ wrapping, Options (opens on Call; Time of call, Edit number → plan 18's `numberEntry` →
      the standby entry with the number, Save → plan 19, Erase → `Erase?` → `Erased`, Call, Send
      SMS → plan 18's editor; placeholders per D14).
- [ ] Standby ▲: the dialled list as plan 19's standby-key application with `Call`, or `No last
dialled numbers` (D3); flip plan 19's `phone-book/standby-up` (as Task 8's flips).
- [ ] 4-4 erases the chosen lists (plan 14's notes keep their goldens); 4-5's pages read the log;
      4-5-5's accepted flow (plan 15) also zeroes the durations.
- [ ] TDD through keys against `calls/list-*`, `options-*`, `erase-*`, `duration-*`, `persist-*` and
      plan 19's `standby-up`; plan 14's empty-register goldens still pass.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): the call register and standby ▲`.

### Task 10 - Acceptance and the coverage guard

**Files:** `tests/acceptance/22-call-register-divert-and-dialling.test.ts` (new),
`tests/support/calls.ts` (new: the scenarios, a `ring(number, atMs)` rig helper over the synthetic
network), `tests/support/rig.ts` (a `network` option, if plans 18/19 did not add it).

- [ ] `acceptancePlan({ plan: "22", scenarios, knownGaps, timeoutsMs })`: a hand-written scenario for
      every golden in `goldens/index/22.json` (navigate as the capture did; keys on the ticks their
      redraws start; network events at the capture's command times); delete `awaitsPlan22Scenario`.
      The flipped goldens of plans 14, 16, 19 and 23 run in their own plan files (Tasks 5, 7-9).
- [ ] Coverage guard: no golden or placeholder names `22`; nodes 4-1…4-5 are covered by asserted
      goldens with content and without.
- [ ] Every asserted golden passes (pixels exact; timelines ±2 ms after alignment, or the stated
      tolerance where a scenario replays another recording's timing). New `KNOWN_GAPS` need a
      reason.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp check --fix`. Report the
      suite's run time.
- [ ] Commit: `test(nokia-os): drive number entry, calls and the register against their goldens`.

### Task 11 - Demo, README, verification gate and closeout

**Files:** `packages/nokia-os/demo/panels/calls.ts` (new), `demo/panels/index.ts` (one line),
`packages/nokia-os/README.md`, `docs/specs/stock/calls.md`, `docs/plans/README.md`, this plan.

- [ ] Demo panel: "Incoming call" (number), "Far end hangs up", the dialled numbers the network saw;
      the phone uses `createSyntheticNetwork()`. Verify with
      `mise exec -- vp run @hellotimber/nokia-os#demo` and `agent-browser` (headless: drive through
      the `[role=status]` line, Skip boot): type a number, ▲/▼ soft keys, Call, End; an incoming call
      over a menu, Answer, End, back to the menu; a missed call, `List`; Call register lists and Time
      of call; standby ▲; DTMF in the event log.
- [ ] README: number entry, the call port (a host sketch with no telephony code), the `calls`
      record, what 22b adds.
- [ ] `mise exec -- vp check --fix`, `vp run -r test`, `vp run website#build`;
      `git diff --stat <commit before Task 1> -- website/` is empty.
- [ ] `docs/specs/stock/calls.md`: replace "(plan 22, in progress)" with verified facts; list what
      stays UNVERIFIED.
- [ ] Plans README: row 22 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete number entry, calls and the call register (plan 22)`.

## Plan 22b (written when scheduled): Calls II, network services and costs

- **Divert** (7-1…7-4, 7-6): Activate (Voice mailbox, Other number through plan 18's
  `numberEntry`), Cancel, Status, Cancel all diverts and Set delay sent as SS requests through a new
  `StockNetworkPort.request?(service)`; the results (`Active:` / `Voice` / `calls` with `Number` →
  `To number`, `Inactive: …`, `All services`), `Not done` after ≈15 s without an answer, Quit's
  `Request not confirmed`; the standby divert icon; a divert record if the phone keeps one.
- **Call waiting options** (6-1-3) and waiting calls in a call (`Call waiting active`; the screens a
  second call shows, `End all calls` with two calls).
- **SS and USSD at standby**: `*21*…#`, `##002#`, `*#21#`, two-digit codes and `#`-ended strings
  (plan 22's `service` outcome), their `Requesting` and results.
- **Automatic redial** (6-1-1) and **Own number sending** (6-1-4) as calls use them.
- **Costs**: Show call costs, Call cost settings and Prepaid credit (4-6…4-8) with advice of charge
  as far as the synthetic network can send it (the emulator sends none; values stay `0`).
- Task 0 promotes `SCRATCH_SS` (`ok`/`error`) into the harness (S27 shows it works).

## Follow-up plan adjustments

- **16 - Tones:** `StockSoundEvent.hz2` and the DTMF mode extend its port and sounder (D7); `ring()`
  gains its alert types (D9). No plan 16 golden changes.
- **17 - Profiles:** the power key during number entry and calls opens its profile list (S5, S15).
- **18 - Messages I:** `StockNetworkPort` gains the call members (D5); its `numberEntry` shares
  `dial-string.ts`'s `*` cycle (D6); Inbox › Use number dials through `StockTelephone.dial`; an SMS
  arrival over a call waits or interrupts per its Task 0 (plan 21's interruption seam, D4).
- **19 - Phone book:** its `Call` keys, held 2-9 and held 1, standby ▲ and Speed dial calls are
  bound here (D14); `StockPhoneBook` needs a location lookup for `N#` (its `entries()` filtered by
  location suffices).
- **20 - Calculator:** `CalculatorRate.convert` serves the entry's `Convert` soft key (D14).
- **21 - Clock and Reminders:** its `interruption` poll is composed with the telephone's (calls
  first, or as Task 0 I shows); S22 and Task 0 I answer its held-mode question (D4); Time of call
  adds a second count beside its `StockClock.now()` (D11).
- **22b:** see above.
- **25 - Keyguard and backlight:** the backlight blinks with `calling` for Ring once, Beep once and
  Off (the goldens' `leds` column); answering under keyguard.
- **Portfolio integration (not sequenced):** a website `StockNetworkPort` with `dial` and
  `subscribeCalls` (the portfolio can "call" Lachlan or ring the visitor); the website's own
  `Call register` content stays as it is.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Split (D1):** 22 (entry, calls, register) and 22b (divert, services, costs). Reverse by folding
   22b in after Task 9 (roughly a third more).
2. **Connected calls from a patched network model (D15):** the stock emulator never connects a
   speech call; Task 0's harness assigns a traffic channel (a patch applied to a build copy, the
   emulator untouched), so connected calls, the ringback's end and durations are captured. Reverse:
   reproduce the stock emulator (the ringback for the whole call, durations always `00:00:00`).
3. **Interruptions (D4):** calls reuse plan 21's `interruption` seam (held mode, polled each tick).
   Reverse: a separate push-style `Phone.interrupt` (a second seam), or a nokia-os wrapper overlay.
4. **Link times (D10):** reproduced as phone time (2207 ms to alerting, 1982 ms to ringing) even if
   the host answers instantly. Reverse: settle only on the host.
5. **Time of call seconds (D11):** counted by the phone from the minute it last saw change (no host
   port). Reverse: a host seconds port, or always `:00`.
6. **Call register persistence (D13):** kept across power cycles in the `calls` record unless Task
   0 F shows the firmware loses it at a clean power-off. Reverse: RAM only.
7. **The default network (D5):** every call alerts and connects at once and lasts until the user or
   a test ends it. Reverse: calls that are never answered (the stock emulator's view).
8. **`*#06#` (S8):** the virgin `?` glyphs as captured. Reverse: a host IMEI (a config field).

## Conflicts found while planning

- Spec §4/§6/§9 and VISION's website table: ▼ at standby is the redial list; v6.39's ▲ is (S25,
  plan 19 S1). `STOCK_STANDBY_KEYS` has them reversed; plans 19 (▼) and 22 (▲) correct it.
- Spec §6: "`*` pressed repeatedly cycles `*`/`+`/`p`/`w`" (UNVERIFIED there): confirmed (S3).
  "Press-and-hold `0` toggles…" in dialling: holding `0` gives nothing more than a tap (S3).
- Spec §6: "during a call [the scroll keys] adjust earpiece volume": confirmed, with a `Volume`
  screen (S15).
- The menu-tree spec says Dialled numbers › Erase shows `Dialled numbers erased`; it shows
  `Erased` (S24). It says Missed and Received calls could not be filled; the harness can (S17-S23).
- Plan 14's spec section says `Requesting` never finishes: without an answer it ends by itself in
  `Not done` at ≈15 s (S27; 22b).
- Plan 15's follow-up says Clear timers' erase is plan 22's: yes (D12); its values only leave zero
  with connected calls (S26, S28).
- Plan 16 D11 left Ring once, Beep once and Off's ringing uncaptured: captured (S19, D9).
- Plan 19 D5's ▲ placeholder `menu/call-register/dialled-numbers` stays until Task 9 replaces it
  with the dialled-list application.
- The brief lists "Call ended + duration note": the firmware shows neither (S13, S16).

## Done means

- Digits, `*` and `#` at standby and from the screens that hand them over start number entry, which
  matches its goldens (layouts, `*` cycle, C, holds, soft keys, codes), with DTMF on the port.
- Calls dial and ring through `StockNetworkPort` (default synthetic): Calling, alerting, connected,
  End, the network's end, in-call Volume, DTMF and Options, ringing per alert type over any screen,
  Answer, reject and the missed-call notice match their goldens (pixels exact; timelines within
  ±2 ms after alignment, or a stated tolerance; sound per plan 16's comparison).
- The call register lists, Options, standby ▲, Erase recent call lists and Show call duration read
  the `calls` record, which persists as Task 0 decided.
- No golden or placeholder names plan 22; 22b owns the services; the coverage guard accounts for
  every node.
- phone-core stays Nokia-agnostic; the website is unchanged; `vp check`, `vp run -r test` and
  `vp run website#build` pass; VISION, the specs and the plans README match what shipped.
