# Foundation: menu, standby and boot (plan 13)

Source: pixel-exact LCD captures of the real v6.39 firmware (PPM E, English) running in the
djr-747 DCT3 emulator (`nokia-3310/captures/6.39` in the main checkout, gitignored), reproduced
in-repo as golden text grids under `packages/nokia-os/goldens/`. The goldens are authoritative;
where this file and a golden disagree, fix this file ([index](../nokia-3310.md#10-firmware-ground-truth-v639-captures)). Plan 13 has the full tables.

**Main menu (12 entries, carousel order):** Phone book, Messages, Chat, Call register, Tones,
Settings, Call divert, Games, Calculator, Reminders, Clock, Profiles. Each carousel slot has an
animated icon. Verified (Task 0 probes, asserted in `packages/nokia-os/tests/acceptance/13-foundation.test.ts`):

- Every icon animation **settles**; none loops. Each recording ends on a frame held ≥ 3.5 s. All
  icons except Settings end on their first frame; Settings plays its 8 frames once and holds the
  last. Distinct frames: Phone book 4, Messages 14, Chat 12, Call register 12 (one held only
  15 ms), Tones 17, Settings 8, Call divert 11, Games 4, Calculator 13, Reminders 14, Clock 8,
  Profiles 4 (sequence 1-2-3-4-1-4-3-2-1).
- The icon **restarts** from its first frame whenever its slot becomes visible: Menu, ▲/▼, and C
  back from a submenu. Path navigation that lands on the carousel counts as entering it.
- Timings are reproduced as captured, jitter included (for example 208/179 ms around a ~194 ms
  period). The Clock icon's timeline depends on how its slot was revealed. Frame starts after
  the key: ▼ 1400, 1619, 1850, 2083, 2315, 2547, 2780, 3012 ms; ▲ 1385, 1617, 1849, …, 3011 ms;
  C (return) 1386, 1628, 1858, …, 3020 ms. No single timeline fits all three within ±2 ms, so
  the Clock graphic carries one timeline per reveal; every other icon has one timeline.

**Level-1 labels (v6.39 wording, checked against the goldens; `/` = firmware line break):**

| #   | Entry         | Presentation | Level-1 items                                                                                                                                         |
| --- | ------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Phone book    | rows         | Search, Service Nos., Add name, Erase, Edit, Assign tone, Send b'card, Options, Speed dials, Voice tags                                               |
| 2   | Messages      | pages        | Write/messages, Inbox, Outbox, Picture/messages, Templates, Smileys, Message/settings, Info/service, Voice/mailbox/number, Service/command/editor     |
| 3   | Chat          | application  | (chat flow)                                                                                                                                           |
| 4   | Call register | pages        | Missed/calls, Received/calls, Dialled/numbers, Erase recent/call lists, Show call/duration, Show call/costs, Call cost/settings, Prepaid credit       |
| 5   | Tones         | pages        | Ringing/tone, Ringing/volume, Incoming/call alert, Composer, Message/alert tone, Keypad/tones, Warning tones, Vibrating/alert, Screen saver           |
| 6   | Settings      | pages        | Call/settings, Phone/settings, Security/settings, Restore/factory/settings                                                                            |
| 7   | Call divert   | pages        | Divert all/voice calls/without ringing, Divert/when busy, Divert if not/answered, Divert when/phone off/or no coverage, Cancel all/diverts (number 6) |
| 8   | Games         | rows         | Snake II, Space impact, Bantumi, Pairs II, Settings (number 6)                                                                                        |
| 9   | Calculator    | application  | (calculator)                                                                                                                                          |
| 10  | Reminders     | rows         | Add new, View all, Erase                                                                                                                              |
| 11  | Clock         | pages        | Alarm/clock, Clock/settings, Date setting, Stopwatch, Countdown/timer, Auto update of/date and time                                                   |
| 12  | Profiles      | rows         | General, Silent, Discreet, Loud, (empty), slot 6 (two U+E000 boxes: uninitialised name; see artefacts)                                                |

There is no auto-wrap: firmware text carries explicit breaks (`Show call` / `duration`).

**Hidden entries keep their menu numbers.** Call divert and Games each skip number 5: their last
entries show `7-6` and `8-6` in the indicator, `Menu 7 6` opens Cancel all diverts and `Menu 7 5`
does nothing, yet the rail places them 5th of 5 (it uses the visible position and count).

**Two submenu presentations.**

- _Rows_ (Phone book and application lists: Games, Reminders, Profiles): three rows; the selected
  row is an inverted band x 0..77, y `7+10r`..`16+10r`; text at x 2, top y `8+10r`. The window
  of three rows is circular and stateful (see "Rows window" below): ▼ from the first item moves
  the selection to the bottom row and then scrolls; ▲ above the window puts the selection on the
  top row, and ▲ from the first item wraps to the last item drawn on top of the first two
  (`Voice tags / Search / Service Nos.`); ▼ from the last item continues circularly with the
  selection on the bottom row (`Speed dials / Voice tags / Search`, then `Voice tags / Search /
Service Nos.`).
- _Pages_ (native menus: Messages, Call register, Tones, Settings, Call divert, Clock): one item per
  screen; label lines from x 0 at tops y 7/16/25 (a line must end before x 80); the current value
  (e.g. `Off`, `Level 1`, the time) in the thin font, top y 29, its last cell ending at x 78 (ink
  ends at x 76).

**Rail:** x 81, y 7..36. Bump top `b = 7 + floor(i*23/(n-1))`: pixels (81..82, b), (83, b+1..b+5),
(81..82, b+6); x 81 is absent at b+1..b+5. With one item the bump sits at the top.

**Indicator:** `digits` font (6 rows, 6-column digit cells; `1` sits one column into its cell);
the last digit cell ends at x 84, so the ink's right edge is x 81 (`1`) / 82 (`2`). Levels are
joined by a 2-px `-` (`1-1`, `11-1`). While the first shortcut digit is awaited the indicator is
three 1-px dots at y 5, x 78/80/82.

**Menu timing (measured, aligned on the Menu press):** Menu from standby first shows standby with
the signal and battery ladders and icons erased for **39 ms**, then the carousel with the dots. A
key that moves the carousel opens it at once. The dots become the menu number **2948 ms** after
the Menu press (2985 ms into the capture minus the 37 ms trigger); the shortcut window is timed
from the Menu press and after each digit. What follows a typed digit is described in
[menu-depth.md](menu-depth.md).

**Fonts:** four faces, harvested from the goldens: `small` (labels, operator, softkeys, prompts'
labels; 2-px stems, 7-row capitals plus descenders, 8-row cells), `large` (carousel title, notes,
entry values; 11-row capitals, 13-row cells), `digits` (indicator and standby clock, 6 rows),
`thin` (page values and game instructions; 7-row capitals plus a descender row, 8-row cells, 1-px
stems, 5-column digit cells). The whole v6.39 menu tree uses only these four (plan 14 Task 0).
In every face a glyph's cell is its ink plus one blank column, except the `1` in every face and
the large `:`, which sit one column into their cells, and the large `R`, whose leg touches a
following `e`. Digits are tabular in each face (small 6, large 8, digits 6, thin 5 columns).
`digits` and `thin` hold every digit (Task 11 captured the clock at 19:48 and 07:59); the
firmware keeps the hour's leading zero (`07:59`).

**Standby:** signal bars at x 0, rows 0-6 (w4), 8-14 (w3), 16-22 (w2), 24-29 (w2); antenna icon at
(0,31); battery mirrored, icon 4×6 at (80,31); operator centred at `floor((84 - width) / 2)`, top
y 8; clock in `digits`, its last cell ending at x 78 (ink to x 76), top y 0; `Menu` centred the
same way, top y 40 (descenders reach y 47). Standby does not blink or change over 10 s. Signal
and battery levels below full are UNVERIFIED (the emulator always shows full).

**Carousel:** title in `large`, centred in x 0..77 at `floor((78 - width) / 2)`, top y 7; icon
within x 10..63, y 23..36; rail; indicator top-right; `Select` centred at y 40.

**Boot:** LCD self-test (blank with the LED off 268 ms, all-on 970 ms, blank 1172 ms, battery
ladder 1684 ms), a 132 ms blank, then the 7-frame connecting-hands animation at irregular steps
(360, 302, 292, 367, 287, 320 ms), the last frame held 3951 ms, then standby: 10105 ms in all.
This is the gate-free boot captured after Restore factory settings (`boot-clean/power-on`, plan 15
Task 0c), asserted by `boot/power-on`; it replaced plan 13's self-test + hands composition. The
hands' steps vary by up to ≈40 ms between gate-free boots; nokia-os plays this capture's. The
clock wizard that follows on the emulator is a virgin-EEPROM effect (RTC) and is cut. Boot starts
when the kernel's 800 ms power long press fires (the firmware's power-key threshold is not
captured). The security-code gate and the welcome note are in
[storage-and-settings.md](storage-and-settings.md).
