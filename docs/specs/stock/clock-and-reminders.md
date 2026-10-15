# Stock v6.39 clock, alarm, timers and Reminders (plan 21, in progress)

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
appear when the phone next shows standby (C held: standby is drawn ≈85 ms, then the alert).
Snake II pauses at the event. Alerts keep the standby layout: ladders, clock and indicators; the
operator line is replaced.

- **Reminder** (`reminders/alert-*`): its text where the operator is, the reminder icon at the
  right, `Snooze`; static; no automatic end; the buzzer's 2683.7 Hz pulses (factory: with the
  vibrator) until a key. Snooze: `Alarm postponed for 10 min` (≈1490 ms, the clock top right, no
  ladders), standby; it alerts again at its minute + 10. Any other key ends it. Two due in one
  minute: the later-added first. Reminders due while the phone was off alert at the first minute
  edge after power-on. A reminder fires at the first minute edge at or past its time, also after
  a jump over it; never before.
- **Countdown** (`countdown/expire-*`): `Countdown` / `time up`, five bell pictures stepping every
  ≈232 ms, `OK`; lights toggling every ≈465 ms; the buzzer's pulses for ≈29 s, louder over time,
  then silence; the screen stays until a key; any key ends it; the page then reads `Off`.
- **Alarm** (`alarm/ring-*`, Task 0c): `Alarm!` and the current time blinking, the bells row,
  `Snooze`, lights flashing; untouched ≈58 s (one minute of firmware time), then an automatic
  snooze. Snooze: a `Snooze active` standby screen with `Stop` (Stop: `Snooze off`, standby); it
  rings again 5 minutes later rounded up to a whole minute. Any other key stops it. Once it has
  rung, the alarm is Off (a one-shot).

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
  Menu 1 1 1 1 and 1 1 1 2 reach them), On → the prompt on the stored time, Off → `Alarm off`.
- Countdown: `Set timer:` `hh:mm` → Start → `Timer running` (tick) → the page shows the time left
  rounded up to a minute; `00:00` → `Timer stopped`. While running: `Change time` / `Stop timer`
  (`11-5-1`, `11-5-2`). The timer icon sits left of the alarm icon. The countdown is RAM.
- Stopwatch: `0:00:00.00` `Start` → running `Stop` (redrawn every 100 ms of firmware time, the
  display keeping real time) → stopped `Options`: Start (resume), Reset, Exit (standby, the time
  kept). C and C held while running return to the Stopwatch page; it keeps running; standby
  blinks its indicator every ≈480 ms. No split or lap timing.

## Reminders

Add new: `Remind about:` (35 characters) → `Alarm on` / `Alarm off` → (Alarm on) `Reminder date:`
(today) → `Reminder time:` (`hh:mm`; the cursor's blink carries on) → `Reminder set` → the level;
C goes back one step. View all: one per screen, `n hh:mm dd.mm` in the digits face, an icon and
the text, `Options` (`Erase`, `Edit`, `Send` (18c)); listed by alarm time, without alarm last.
Erase › One by one (`Erase? <text>`, `Reminder erased`, the next) and All (`Are you sure?`,
`Reminder memory empty`; the level then shows Add new only). Capacity 10: `Memory full. Replace
old reminder?`. Persistence: reminders, Hide clock and Time format survive a power cycle;
Restore factory settings keeps the alarm, the time, the countdown and the reminders and resets
Time format and Hide clock.

## Composed flows (UNVERIFIED)

The emulator cannot advance while powered off (P15), so the alarm that switches the phone on is
composed from the captured ringing screen and the firmware's `Activate\nphone\nfor calls?`
(0x0e6): Stop → that query, Yes → the normal power-on, No → off (`COMPOSED_FLOWS`).
