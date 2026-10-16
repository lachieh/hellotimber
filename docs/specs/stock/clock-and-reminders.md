# Stock v6.39 clock, alarm, timers and Reminders

This reference describes the measured Clock (menu 11) and Reminders (menu 10) behaviour that
nokia-os implements over the host's real-time clock, and that plan 21's goldens assert. See
[plan 21](../../plans/21-clock-and-reminders.md) for the decisions and tasks.

## Evidence and authority

The canonical source is the v6.39 PPM E emulator corpus, `$REF/captures/6.39/plan21/`
(`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310`, gitignored), written by
`$REF/captures/scripts/gen_v639_plan21.py` (37 sections, one `v639-plan21-<section>.cap` each) on
the plan 21 harness copy `$REF/tools/harness-p21/` (`settime`, `setdate`, `tominute`, `rtc`) and,
for the ringing alarm, Task 0c's build `$REF/captures/scratch-plan21/harness/build-0c/`. Planning
probes P1-P16 (`$REF/captures/scratch-plan21/`) are evidence for the plan only. Tests never read
`$REF`; plan 21's goldens are text grids imported through `scripts/capture-sets/21-*.ts`.
Firmware strings quoted for composed screens come from `$REF/extracted/6.39/text/english.txt` by
id (cross-check only, nothing imported).

## The emulator's clock (artefacts)

The firmware keeps the time of day in software (RAM `0x1117B4`, seconds, big-endian) and the date
at `0x10D40C` (`{year BE16, month, day}`, twice). It advances the time only while it trusts the
CCONT RTC, which the emulator never reports as running, so the time of day never moves; standby
redraws and due reminders fire on the RTC-minute interrupt (every 60 s from the emulator's
power-on). Captures move the clock with `settime` and run to the next edge with `tominute`.

| Artefact                                                  | Cause                                                                 | Handling                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| The time of day never advances                            | the emulated CCONT never reports its RTC running (P7)                 | captures move it with `settime`; nokia-os uses the host clock   |
| Minute edges every 60 s from the emulator's start         | the emulated RTC-minute interrupt is free-running                     | captures align on the edge; nokia-os fires at the host's minute |
| The alarm clock never rings (stock harness)               | the CCONT RTC alarm is dormant (P7, P8)                               | Task 0c's build rings it (two env-gated patches, `RTCALARM=1`)  |
| A powered-off emulator cannot advance                     | harness/emulator (P15)                                                | the wake flow is composed (UNVERIFIED)                          |
| Countdown 58.1 s per minute                               | the emulator's ≈7.745 ms timer unit (plan 23)                         | nominal durations; goldens aligned on the expiry                |
| Stopwatch redraws every ≈93 ms, hundredths jumping        | the same timer unit; the display resyncs with the RTC every ≈1.4 s    | nominal 100 ms redraws; digits compared with a tolerance        |
| The time and the alarm are lost at every power cycle      | the emulator's RTC restarts at power-on (the clock wizard asks again) | nokia-os keeps the host clock; the alarm record survives        |
| The virgin junk reminder `0000000000` and its first alert | virgin EEPROM                                                         | a dormant entry (D8); its alert not reproduced                  |
| Network time = the harness clock (`CAP_EPOCH`)            | the emulator's synthetic network                                      | Auto update maps it to the host clock (D13)                     |

## Alerts wait for standby

No alert interrupts anything (plan21 `*/expire-elsewhere-*`, `*/alert-elsewhere-*`,
`alarm/ring-elsewhere-*`): a reminder, the countdown's expiry and the ringing alarm that fall due
on a menu page, a list, a note, an option list, the editor, Snake II or the running stopwatch
appear when the phone next shows standby (C held: standby without its operator line for ≈91
ms, then the alert; standby itself is not drawn). A key that ends an alert leaves the same frame
for ≈90 ms before standby.
Snake II pauses to its menu (Continue on top) ≈85 ms after the event. Alerts keep the standby layout: ladders, clock and indicators; the
operator line is replaced.

- **Reminder** (`reminders/alert-*`): its text where the operator is, the reminder icon at the
  right, `Snooze`; static; no automatic end; the buzzer's 2683.7 Hz pulses (factory: with the
  vibrator) until a key. Snooze: `Alarm postponed for 10 min` (≈1490 ms, the clock top right, no
  ladders), standby; it alerts again at its minute + 10. Any other key ends it. Two due in one
  minute: the later-added first. Reminders due while the phone was off alert at the first minute
  edge after power-on. A reminder fires at the first minute edge at or past its time, also after
  a jump over it; never before. A second alert due in the same minute shows right after the first
  is answered (its exit frame, ≈67 ms, then the alert). A reminder falling due during the
  countdown's alert replaces it on screen, and the countdown's alert comes back after the
  reminder's Snooze (`reminders/alert-over-countdown`; not reproduced: nokia-os queues it).
- **Countdown** (`countdown/expire-*`): `Countdown` / `time up`, five bell pictures stepping every
  ≈232 ms, `OK`; lights toggling every ≈465 ms; the buzzer's pulses for ≈29 s, louder over time,
  then silence; the screen stays until a key; any key ends it; the page then reads `Off`.
- **Alarm** (`alarm/ring-*`, Task 0c): `Alarm!` and the current time blinking, the bells row,
  `Snooze`, lights flashing; untouched ≈58 s (one minute of firmware time), then an automatic
  snooze. Snooze: a `Snooze active` standby screen with `Stop` (Stop: the ladders cleared, 20 ms,
  then `Snooze off`, standby); it rings again 5 minutes later rounded up to a whole minute. Any
  other key stops it, as the key goes down. Once it has rung, the alarm is Off (a one-shot). The
  bells step at 224 ms and with the text's first showing (464 ms), then every ≈233 ms; the text
  goes off at ≈925 ms and toggles every ≈481 ms. A ring shown on the return to standby has no
  bells and shows its text at once. Its sound: two-pulse bursts of 2683.7 Hz every 2345 ms (factory:
  with the vibrator), at Level 1 rising to the Ringing volume on the first notes ≈4.8 s, then
  every ≈4 s (countdown ≈3.7 s, reminder ≈2.9 s; one ≈3973 ms timer, the first rise per alert).

## Clock settings, Date setting, Auto update

- Hide clock → `Clock hidden` (tick) → the Clock settings page; standby loses the clock (its
  indicators stay); the entry reads `Show clock`, which shows `Clock displayed` (alarm-clock
  icon, 1443 ms). Set the time → `Time is set` (alarm-clock icon, 1455 ms) → the page.
- Time format 12-hour → `12-hour clock selected` → the page `10:10 am` (`12:05 am`, `01:07 pm`);
  standby draws `hh:mm` and an am/pm dot after it.
- Date setting → `Date is set` (tick) → the page.
- Without a time (the wizard skipped: `Time not set`): no standby clock; pages `--:--`,
  `--.--.----`; Alarm clock, Date setting and Reminders › Add new show `Clock needs to be set
first` (2920 ms) then the `Time:` prompt (`hh:mm`).
- Auto update (`On`/`Confirm first`/`Off`, virgin Off, `Done`): On updates during the boot after
  `Code accepted` (`Date and time updated`, tick) and skips the clock wizard; Confirm first asks
  `Update date and time of the phone?` at standby after the wizard; Off asks nothing.

## Time and date entry

One overwrite mask for `Set alarm time:`, `Time:`, `Date:`, `Set timer:`, `Reminder date:` and
`Reminder time:`: the value right-aligned in the large face in the prompt's box, the cursor
(≈480 ms blink, free-running from the prompt; keys do not restart it) before the next digit.
Digits replace the value from its first digit, skipping separators; after the last the cursor
returns to the first. A digit a position cannot take is ignored (hours' tens 0-2, units 0-3
after 2; minutes' tens 0-5; day tens 0-3, units 1-9 after 0 and 0-1 after 3; month tens 0-1,
units 0-2 after 1; the year's first digit 2, 1 UNVERIFIED). C goes back at once. OK on a mask
still holding `h`/`m`/`d`/`y`, or on an impossible date, shows `Invalid time` / `Invalid date`
(≈2940 ms) and returns to the entry. Past dates and times are accepted.

## Alarm clock, countdown, stopwatch

- Alarm clock without an alarm: the prompt (`00:00`) → `Alarm on` (tick) → the page; standby
  gains the alarm icon left of the clock. With an alarm: `On` / `Off` rows (`11-1-1`, `11-1-2`;
  Menu 1 1 1 1 and 1 1 1 2 reach them, not reproduced: 11-1 is an application in nokia-os), On →
  the prompt on the stored time, Off → `Alarm off`.
- Countdown: `Set timer:` `hh:mm` → Start → `Timer running` (tick) → the page shows the time left
  rounded up to a minute; `00:00` → `Timer stopped`. While running: `Change time` (the prompt on
  the time left) / `Stop timer` (`11-5-1`, `11-5-2`). The timer icon sits left of the alarm icon
  and stays until the expiry's alert is answered. The countdown is RAM.
- Stopwatch: `0:00:00.00` `Start` → running `Stop` (redrawn every 100 ms of firmware time, the
  display keeping real time) → stopped `Options`: Start (resume), Reset, Exit (standby, the time
  kept). C and C held while running return to the Stopwatch page; it keeps running; standby
  blinks its indicator every ≈481 ms. Reopened, the screen shows its last time for ≈85 ms before
  the first redraw. Navi and C act as they go down. No split or lap timing.

## Reminders

Add new: `Remind about:` (35 characters) → `Alarm on` / `Alarm off` → (Alarm on) `Reminder date:`
(today) → `Reminder time:` (`hh:mm`; the cursor's blink carries on) → `Reminder set` → the level;
C goes back one step. `Remind about:` opens on plan 14's blink (shown first, 482 ms); a character
key that changes the text restarts the blink, shown (C and a key past the limit keep its phase),
and the prompt's return from the rows restarts it too. A text wider than the large face is drawn in
small rows of up to 78 px from x 2, the last at top 27 and the ones before 9 rows up; with three
rows the box rises to top 7 and the label goes (`reminders/text`); the cursor there is 10 rows
from a row above its row. After `Invalid time`, `Reminder time:` puts its cursor at the start of
the wrong field (`0h:mm` → the hours; `20:0m` → the minutes), where `Set timer:` puts it on the
first placeholder. View all: one per screen, `n hh:mm dd.mm` in the digits face, an icon and
the text, `Options` (`Erase`, `Edit`, `Send`; the indicator shows only the option's number);
listed by alarm time, without alarm last. Send draws `OK` alone ≈120 ms, then `Phone number:`
(`Search` while empty; its cursor's first blink step as Edit's); the transmission after it is
Smart Messaging's (a placeholder in nokia-os). Edit opens the text prompt on the text (on the
hidden blink step in two recordings, the shown one in a third: UNVERIFIED what picks it); its
`Alarm on` / `Alarm off` rows number `2-1`, `2-2`. Erase › One by one (`Erase? <text>` as one
query text broken at spaces, `Reminder erased`, the next) and All (`Are you sure?`, `Reminder
memory empty`; the level then shows Add new only). Capacity 10: Add new then asks `Memory full.` /
`Replace old` / `reminder?` (tops 4, 13, 22); OK lists the reminders with `Erase`, and the one
chosen is replaced by the new reminder; C goes back. Persistence: reminders, Hide clock and Time format survive a power cycle;
Restore factory settings keeps the alarm, the time, the countdown and the reminders and resets
Time format and Hide clock.

## UNVERIFIED

- Texts of more than one query line in `Erase? <text>` and the alert (no capture shows one).
- What picks Edit's opening blink step; the jump rules for the alarm (it rings in hardware when
  its minute arrives, so a jump over it does not ring).
- Where `Date and time updated` shows: the capture shows it during the boot, after `Code
accepted`; nokia-os shows it at standby after power-on, and only when clearing the offset
  changed the time (an unchanged time cannot be captured: the emulator loses it).
- The stopwatch beyond what was recorded (62 minutes): its hours wrap at 10 in nokia-os.

## Composed flows (UNVERIFIED)

The emulator cannot advance while powered off (P15), so the alarm that switches the phone on is
composed from the captured ringing screen and the firmware's `Activate\nphone\nfor calls?`
(0x0e6): Stop → that query, Yes → the normal power-on, No → off (`COMPOSED_FLOWS`).
