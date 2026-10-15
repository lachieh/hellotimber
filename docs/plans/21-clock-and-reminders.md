# Plan 21 - Clock, alarm, timers and Reminders

> **Fidelity standard (2026-10-15):** `AGENTS.md` "Fidelity standard" supersedes this plan's tolerance text.

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 13, 14, 15 and 16 done; plan 18 Tasks 5 and 7 (the multi-tap engine and
`textInput`) before Task 11; plan 17 Task 4 (the `SubmenuOptions.label` seam) before Task 7, or
Task 4 here adds that seam exactly as plan 17 specifies it. AGENTS.md "Parallel plan conventions"
applies throughout (per-plan capture set, golden index, acceptance file, feature modules, demo
panel, spec file; one-line registrations in shared files).
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only). Read
`$REF/captures/README.md` (command table, "Output format", plans 15, 16 and 23 sections), plans
13-16 and 18 in full, and `docs/specs/nokia-3310-menu-tree.md` ("Clock", "Reminders", "With
content"). The planning probes in `$REF/captures/scratch-plan21/` (scripts `probe-*.cap`,
`tools/probe_*.py`, outputs `out/`, logs `*.log`) are evidence for this plan only and are never
imported. Task 0 writes this plan's captures to `$REF/captures/6.39/plan21/`.
**Status:** not started.

## Goal

Give `@hellotimber/nokia-os` the stock v6.39 Clock (menu 11) and Reminders (menu 10), pixel- and
timing-faithful to the captures, with the host clock as the time base:

- **Clock settings** (11-2): Hide clock / Show clock on standby, Set the time, Time format (24-hour
  and 12-hour on standby and on the page); **Date setting** (11-3); **Auto update of date and
  time** (11-6) with its boot-time update and `Confirm first` query;
- **Alarm clock** (11-1): set, the On/Off level once set, the standby alarm icon, the ringing
  screen with its tone and lights, Snooze and Stop, the snooze period, the one-minute auto-snooze,
  and the alarm that switches a powered-off phone on;
- **Stopwatch** (11-4): Start, Stop, Options (Start, Reset, Exit), the display cadence, running
  while the phone is elsewhere, and its standby indicator;
- **Countdown timer** (11-5): entry, `Timer running`, the page value, Change time and Stop timer
  while it runs, the standby icon, and the `Countdown time up` alert with its tone, lights and
  automatic stop;
- **Reminders** (10): Add new (text, `Alarm on`/`Alarm off`, date, time), View all and its Options,
  Erase (One by one, All), the levels that hide when the memory is empty, the reminder alert with
  Snooze, reminders that came due while the phone was off, and the memory limit;
- the generic, opt-in kernel seams that let an alert interrupt any screen and wake a powered-off
  phone; two EEPROM records; goldens for all of it.

The website does not change (D17). Portfolio integration stays unsequenced.

## Why this plan exists (measured gap)

| Area                | nokia-os after plans 13-16, 23                                                   | v6.39 evidence (`$REF/captures/scratch-plan21/out/`)                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Time base           | `clock()`/`date()` host strings drawn as given; no seconds, no date arithmetic   | the firmware keeps the time of day in software (RAM 0x1117B4, seconds of the day) and redraws standby on the RTC minute interrupt (P5, P6)                                           |
| Clock settings      | `Clock hidden` and `12-hour clock selected` notes; standby unchanged             | the clock disappears from standby and the entry becomes `Show clock` (firmware strings 0x37d/0x384); Set the time shows `Time is set` with an alarm-clock icon (P4, P9)              |
| Alarm clock         | the `Set alarm time:` prompt's first screen (plan 14 D11)                        | typed time → `Alarm on` (tick, 685/232/542 ms) → page `10:11`; an alarm-clock icon left of the standby clock; with an alarm set, 11-1 opens an `On`/`Off` level (P2, menu-tree spec) |
| Stopwatch           | placeholder (`pending:21`)                                                       | `0:00:00.00` in the large face, `Start` → `Stop` with redraws every ≈93 ms → `Options`: `Start`, `Reset`, `Exit` (P12)                                                               |
| Countdown timer     | the `Set timer:` prompt's first screen                                           | `Start` → `Timer running` (tick) → page `00:01`; a timer icon on standby; at expiry `Countdown time up`, animated bells, `OK`, the lights flashing, 2683.7 Hz buzzer pulses (P13)    |
| Reminders           | Add new's first screen; View all returns to the carousel; Erase › All's note     | `Remind about:` → `Alarm on`/`Alarm off` (`10-1-1`) → `Reminder date:` → `Reminder time:` → `Reminder set` (tick); the alert shows the text, a reminder icon and `Snooze` (P10, P11) |
| Auto update         | an option list that stores                                                       | with `On`, the network's time arrives during the next boot: `Date and time updated` (P14)                                                                                            |
| Virgin first prompt | not imported (plan 13 artefact "First standby `Snooze` prompt and `0000000000`") | it is the virgin EEPROM's junk reminder (text `0000000000`) firing once the clock is set; Snooze shows `Alarm postponed for 10 min` (P3)                                             |

## Planning investigation (2026-10-14)

Scratch probes in `$REF/captures/scratch-plan21/` (virgin image + `v639-setup.inc` unless noted;
`.cap` files through `tools/harness/cap`, `tools/probe_*.py` through `tools/menutree/emu.py` with
`fork`). Times are emulated. Evidence only; Task 0 recaptures everything canonically.

| #   | Probe                                                                                                       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | `probe-a`: standby for 121 s after the setup (RTCLOG)                                                       | standby stays `10:10`. The firmware writes CCONT reg 0x07 once at boot and reg 0x0A (days) = 0 every ≈480 ms; it never writes the minute or hour registers. The emulated CCONT RTC runs (base + elapsed), from 00:00:00 at power-on                                                                                                                                                                                                                                                                                                               |
| P2  | `probe-b`: Alarm clock 10:11 (Menu 1 1 1, `1011`, OK), 150 s at standby (RTCALARM, CCLOG)                   | prompt `Set alarm time:` with `00:00` and the cursor before it (pen icon); typing replaces it; OK → `Alarm on` tick (70 ms lead, 685/232/542 ms) → the Alarm clock page `10:11`; standby gains an alarm-clock icon left of the clock. The alarm never rings; no CCONT alarm register is written; the RTC-minute interrupt (INT5) is acknowledged every 60 s                                                                                                                                                                                       |
| P3  | `probe_g` G0: the virgin first standby before C                                                             | `0000000000` in the small face on the operator line, a reminder icon (pen on paper) at its right, clock and ladders, soft key `Snooze`, lights off, silent. Snooze → a 30 ms and a 15 ms partial frame, `Alarm postponed for 10 min` (small, 1475 ms, clock top right, no ladders), a 74 ms partial frame, standby. Plan 13's "first standby prompt" is a reminder alert                                                                                                                                                                          |
| P4  | `probe_g` G1-G3, `probe-c`: alarm 10:11, then Set the time 10:11 / alarm = now / time past it; 130 s wait   | none rings. `Time is set` (large, an alarm-clock icon, one step 1452 ms, 66 ms lead) then the Clock settings page with the new time. After 130 s the Clock settings page still reads `10:10`: the time of day itself is frozen, not only the standby redraw                                                                                                                                                                                                                                                                                       |
| P5  | `probe-e`: RAM 0x100000-0x11FFFF dumped at 10:10 and after Set the time 19:48                               | one word changes accordingly: **0x1117B4 = seconds of the day, big-endian 32-bit** (36600 → 71280). It does not advance with time. 0x1117B8 holds the alarm (108000 = off; 36660 after setting 10:11). `disfw --struct 0x1117B0` lists their readers and writers                                                                                                                                                                                                                                                                                  |
| P6  | `probe-f`: alarm 10:11, `poke 0x1117B4 00008F34` (10:11:00), wait through the next INT5                     | at the next RTC-minute interrupt standby redraws `10:11`. **The alarm does not ring.** The word still does not advance                                                                                                                                                                                                                                                                                                                                                                                                                            |
| P7  | `disfw` around 0x29193C (the alarm's reader) and 0x2EAAEA                                                   | the alarm is armed in the CCONT RTC alarm registers (logical 0x0D/0x0E = CCONT regs 0x0B/0x0C, through the descriptor table at PPM+0x100) only after the seconds register's bit 7 reads set (descriptor 0x8980); the emulator returns plain seconds (bit 7 clear), so the firmware treats its RTC as stopped and never arms the alarm. The emulator's RTC-alarm interrupt (INT7) is passive unless `RTCALARM` is set, and its comment says asserting it wedges the CPU                                                                            |
| P8  | `probe-k`: a scratch harness build whose copy of `mad2_ccont.c` sets bit 7 on seconds reads (env `RTC_RUN`) | the half-second day-register rewrite stops and the alarm registers are written once at boot (0x0B = 00, 0x0C = 80), but the time of day still does not advance and the alarm does not ring. Not pursued further during planning (Task 0c)                                                                                                                                                                                                                                                                                                         |
| P9  | `probe_g` G1, `probe_i` I1: Set the time                                                                    | prompt `Time:` with the current time and the cursor before it; `Time is set` (above) → Clock settings page. Digits typed in a submenu level outside the shortcut window start standby number entry (plan 22's)                                                                                                                                                                                                                                                                                                                                    |
| P10 | `probe_i` I1: Reminders › Add new `A`                                                                       | `Remind about:` (pen, `Abc`, counter `35` → `34`, entry box) → OK → rows list `Alarm on` / `Alarm off` (indicator `10-1-1`, `OK`) → `Reminder date:` prefilled `13.10.2026` (cursor before it) → `Reminder time:` `hh:mm` → `10:11` → `Reminder set` tick (75 ms lead, 684/232/527 ms) → the Reminders list                                                                                                                                                                                                                                       |
| P11 | `probe_i` I2: reminder at 10:11, then `poke 0x1117B4` 10:11:00, wait                                        | **at the next INT5 the reminder fires**: standby layout with the clock `10:11`, the text `A` on the operator line, the reminder icon, `Snooze` (virgin: silent, lights steady). Reminders are checked in software on the minute interrupt; the alarm clock is not                                                                                                                                                                                                                                                                                 |
| P12 | `probe_l` L1: Stopwatch (Menu 1 1 4)                                                                        | `0:00:00.00` large, centred, soft key `Start`; Start → `Stop`, redrawn every 89-108 ms (median 93 ms; hundredths step by ≈10 per redraw); Stop → `Options`; Options → rows `Start`/`Reset`/`Exit` (`11-4-1`); C → the stopped time; C → the Stopwatch page. No split or lap timing exists on v6.39                                                                                                                                                                                                                                                |
| P13 | `probe_l` L2: Countdown timer `00:01`, Start, C held to standby, 74 s                                       | `Set timer:` `hh:mm` (cursor before the mask) → `Timer running` tick (60 ms lead, 681/232/540 ms) → page `00:01` → standby with a timer icon left of the clock. **Expiry works natively**, 58.1 s after Start (one minute of firmware timer units: the emulator's ≈7.745 ms unit against the firmware's ≈7.97 ms, plan 23's artefact): standby layout, `Countdown` / `time up` (small), a row of five bell pictures cycling every ≈232 ms, `OK`; the lights toggle every ≈465 ms; buzzer 2683.7 Hz in 93 ms pulses (v=6) even in the virgin state |
| P14 | `probe_l` L3: Auto update `On`, `saveflash`, `reboot` with `CAP_EPOCH` = 13.10.2026 10:11 UTC               | Auto update's list is `On` / `Confirm first` / `Off` (virgin `Off`); `Done` (tick). During the next boot, on the security prompt, `Date and time updated` (large, tick box) appears: the emulator's network sends MM information with the harness clock (`CAP_EPOCH`, plan 18's harness change). The saved virgin image then rejects `12345` (plan 15's stale code record): Task 0 uses plan 15's re-provisioned images                                                                                                                           |
| P15 | `probe_i` I3: power-off with the alarm set, then `run 60s`                                                  | the power key shows plan 17's profile list, the long press switches off; `run` on a powered-off emulator never returns (as plan 16 found): a powered-off phone cannot be advanced, so the alarm that switches the phone on cannot be captured                                                                                                                                                                                                                                                                                                     |
| P16 | firmware strings (`$REF/extracted/6.39/text/english.txt`, cross-check only)                                 | `\u0001Alarm!\n%U` 0x0e3, `Activate\nphone\nfor calls?` 0x0e6, `Snooze\nactive` 0x0e7, `Snooze\noff` 0x0e8, `Alarm\npostponed\nfor %N min` 0x133, `Clock\nneeds to\nbe set first` 0x383, `Show clock` 0x384, `Clock\ndisplayed` 0x385, `Update date and time of the phone?` 0x2fd, `Countdown\ntime up` 0x1e8, `Change time` 0x1ec, `Stop timer` 0x1ed, `Timer\nstopped` 0x1ee, `1\nreminder received` 0x092, `%U\nreminders received` 0x093, `Memory full. Replace old reminder?` 0x099, `Invalid\ntime` 0x14c, `Invalid\ndate` 0x14b            |

Conclusions:

1. **The RTC workaround.** The emulator's clock does not run because the firmware's time of day is a
   software word (0x1117B4) that the firmware advances only when it trusts the CCONT RTC, which the
   emulator never reports as running (P7). Poking that word **does** move the phone's clock, and the
   next RTC-minute interrupt (every 60 s of emulated time from the emulator's start) redraws standby
   and fires due reminders (P6, P11). Task 0 turns this into two harness commands, `settime` (poke
   the word) and `tominute` (run to just past the next minute interrupt), so every minute-driven
   behaviour except the alarm clock is captured against the emulator's own time base. Timers that
   run on firmware timer units (stopwatch, countdown, snooze lengths measured in timer time, alert
   durations) work natively (P12, P13).
2. **The alarm clock is the hard part.** It is armed in the CCONT RTC alarm, which the emulator
   leaves dormant (P7, P8). Task 0c is a time-boxed attempt (as plan 15's 0c was) to make it ring;
   if it fails, the ringing screen, its tone and the power-on alarm are composed (D12), listed in
   `COMPOSED_FLOWS` and UNVERIFIED in the spec. The powered-off alarm is uncapturable either way
   (P15).
3. **Reminders and the countdown show the alert layout.** Both draw over a standby frame (clock
   and ladders kept, the operator line replaced), so the alarm's screen is most likely the same
   family; Task 0 records the countdown's and the reminder's alerts in full (factory state, with
   sound and lights), which is the evidence the composition rests on.

## Scope and non-goals

In scope: the Goal items; two opt-in phone-core seams (D3, D4); harness helpers and captures
(Task 0); goldens, glyphs, sprites, timelines and sound programs; two EEPROM records; the demo's
clock controls; documentation.

Out of scope (owner in brackets): reminder **Send** and reminders received by SMS (18c, Smart
Messaging); standby number entry that digits outside a shortcut window start (22); the power key's
profile list (17); incoming calls interrupting or being interrupted by an alert (22 reuses D3);
keyguard during an alert (25); backlight and keypad-light timing beyond the alert's own flashing
(25: the flashing is captured here as the `leds` column and exposed with plan 25's signal);
calendar features whose strings exist in the firmware (`Calendar`, `Birthday`, `Meeting`) but
which v6.39's menu does not reach; any website change.

## Decisions

Each decision states what changes relative to the brief and to plans 13-18 and 23.

**D1 - The host clock stays authoritative; the phone's time is the host's plus a stored offset
(the brief's product decision, made concrete).** `StockPhoneConfig.clock` (`HH:MM`, 24-hour) and
`date` (`DD.MM.YYYY`) keep their contract and remain the phone's real-time clock: nokia-os reads
them on every tick (the kernel already does). Their formats become a validated contract (VISION):
a value that does not parse counts as "no time" (the clock is hidden, alarms and reminders stay
dormant, Clock settings and Date setting show nothing) and never throws. The phone's time is the
host time plus a signed minute offset stored in the clock record: Set the time and Date setting
change the offset, not the host; Auto update `On` clears it at the next boot (D13). With no
offset the phone shows exactly the host's strings, so every existing golden is unchanged. The
phone's ports (`StockPorts.clock`/`date`) that the menu, the games' seed and the standby clock read
become these phone-time readers (one line in `phone.ts`). Reverse: drop the offset and make Set the
time and Date setting store nothing (a phone that cannot be set), or add a host write port.

**D2 - Minute edges fire alarms and reminders, observed on kernel ticks (new).** The firmware
evaluates the time on its RTC-minute interrupt (P6, P11). nokia-os does the same on the first tick
whose phone time (D1) is a different minute from the previous tick's: the clock service then
evaluates the alarm (it fires when the new minute equals the alarm time, or a snooze's due time)
and the reminders (each one whose date and time are at or before the new minute and that has not
alerted fires, oldest first, one alert at a time). Setting the time, the date or the alarm never
fires anything by itself (P4: Set the time onto or past the alarm, an alarm set to the current
minute); Task 0 confirms each rule against reminders with `settime`/`tominute` and records what a
jump over a reminder does (P4 suggests nothing for the alarm; the virgin reminder fired once the
clock was set, P3). A backwards jump re-fires nothing. The alert's kernel time is the tick's: its
sound `atMs` and its screen start there, so the host's tick rate bounds the jitter (as plan 16's
contract allows). The kernel never reads a wall clock.

**D3 - Alerts interrupt any screen through a generic kernel seam (new; phone-core, opt-in).**
`PhoneConfig.interruption?: () => PhoneApplication | undefined` is polled on every tick while the
phone is on and not booting. An application it returns runs as an **interruption activation**
above whatever was showing: the interrupted mode (standby, a menu level, an application with its
session) is held untouched, keys and ticks go to the interruption, the path does not change, and
`navigate()` is recorded and applied after it. Its `exit()` restores the held mode (the held
session gets no ticks meanwhile, Task 0 decides whether its clock catches up); `exit({ to:
"standby" })` deactivates the held mode (reason `navigate`) and shows standby. Which of the two
each alert uses after Stop, Snooze or OK, and whether an alert waits for standby or interrupts a
menu, a note, a game, an editor or `Sending message`, come from Task 0 (the countdown expiry and the
reminder alert, both capturable, sections T and R). The website sets no interruption. Plan 22's
incoming call reuses the seam.

**D4 - The alarm switches a powered-off phone on through a second seam (new; phone-core,
opt-in).** `PhoneConfig.wake?: () => PhoneApplication | undefined` is polled on ticks while the
phone is off. An application it returns powers the phone on **without the boot** into a **wake
activation** (empty stack, path `standby`); its `exit()` powers the phone off again, and `exit({
to: "standby" })` runs the normal power-on (boot timeline and gates). nokia-os wakes for the alarm
clock only (reminders that came due while off show at the next power-on, user guide); the wake
flow is the alarm screen, then `Activate phone for calls?` (firmware string 0x0e6) after Stop, `Yes`
→ the normal power-on, `No` → off. P15 shows this cannot be captured: every wake screen is
composed (D12) and UNVERIFIED.

**D5 - Timers run on kernel time with nominal durations; the emulator's timer unit is an artefact
(extends plan 23's artefact).** The countdown expires exactly `hh × 3600 + mm × 60` seconds of
kernel time after Start, not the captured 58.1 s per minute (P13: the emulator's ≈7.745 ms timer
unit runs ≈2.9 % fast against the firmware's 7.97 ms; on hardware the firmware's timers are
nominal). Countdown expiry goldens are aligned on the expiry, never on Start. The stopwatch's
displayed time is the kernel's elapsed time, redrawn at the captured cadence (≈93 ms; Task 0 fits
the cadence and the display rule over a 60 s run). If the captured digits only fit a scaled count
(the firmware showing timer units × 7.97 ms over emulated time), the display follows the nominal
rule and the stopwatch goldens compare digits with a stated tolerance (a Deviation, as plan 16 D6
did for pass drift). Snooze periods counted in minutes use the minute edges of D2.

**D6 - Time and date entry is a widget of this plan; text uses plan 18's (new).** `Set alarm time:`,
`Time:`, `Date:`, `Reminder date:`, `Reminder time:` and `Set timer:` are one widget, `timeEntry`:
plan 14's first screens (pen icon, label, entry box, value right-aligned in the large face, the
cursor before the value, the ≈480 ms blink) plus entry: digits fill the mask from the left as Task 0
records (`hh:mm`, `dd.mm.yyyy`, or the current value replaced), C deletes, C on an empty entry goes
back, OK validates (`Invalid time`, `Invalid date`, `Time for alarm too late`, `Date for alarm too
late` as Task 0 shows them) and calls `done(value, flow)`. `Remind about:` is plan 18's `textInput`
(35 characters). Plan 18's `numberEntry` (right-aligned digits, `*` dial characters) is not reused:
the masks and the cursor differ (P9, P10, P13).

**D7 - Two records (plan 15 D2).** `clock` (v1): the alarm (`{ hour, minute } | null`), its snooze
(`{ dueMinute } | null`), the time offset (D1), and the countdown (`{ endsAt } | null`, as phone
time, only if Task 0 shows it survives a power cycle; else RAM). `reminders` (v1): an ordered list
of `{ text, alarm: { date, time } | null, alerted, snoozedTo? }`, capacity from Task 0 (`Memory
full. Replace old reminder?`, P16). Hide clock and Time format stay plan 14's settings keys.
Restore factory settings: whatever Task 0 F shows (plan 15's factory image already carries a first
standby alert, so reminders very likely survive Restore; the alarm's fate is open). Stopwatch state
is RAM (lost at power-off unless Task 0 shows otherwise).

**D8 - The virgin reminder is reproduced as a dormant entry (refines plan 13's artefact).** The
virgin EEPROM holds one junk reminder (`0000000000`, P3): it keeps View all and Erase listed in the
virgin Reminders level (`menu/10-reminders.sub`), View all returns to the carousel with it alone
(`tree/10-reminders/10-2.leaf`), and Erase › All clears it, after which the level shows only `Add
new` (`probe/confirm-10-3-2-yes`, pending:21 → asserted). Its alert (the virgin first standby
prompt) stays an unreproduced artefact: the virgin record marks it `alerted`, so empty storage
boots to the same standby every golden asserts. Task 0 records what View all, Erase › One by one
and the record do with it (P3 showed only its alert).

**D9 - State-dependent levels use existing seams (plans 14, 17, 23).** Reminders shows View all and
Erase only while the memory holds a reminder (plan 23's `SubmenuOptions.shown`). Hide clock reads
`Show clock` while the clock is hidden (plan 17's `SubmenuOptions.label`). Alarm clock (11-1) stays
an application entry: with no alarm it opens `timeEntry`; with one it opens a rows widget `On` /
`Off` numbered `11-1-1`/`11-1-2` (the with-content crawl), `On` → `timeEntry` on the stored time,
`Off` → `Alarm off` (tick). Shortcuts into that inner list (Menu 1 1 1 2) are not reproduced unless
Task 0 shows the firmware takes them (then a Deviation adds a kernel model). Countdown timer (11-5)
likewise opens `timeEntry` when idle and the captured `Change time` / `Stop timer` list while it
runs. View all lists the reminders as Task 0 records (the with-content crawl shows one reminder's
text full screen with `Options`: Erase, Edit, Send).

**D10 - Standby shows the clock as the phone has it, and three indicators (new).** The kernel's
`clock` reader becomes nokia-os's: phone time (D1), undefined while Clock settings › Hide clock
holds, and the 12-hour form when Time format is 12-hour (Task 0 records standby's 12-hour form;
the page's `10:10 am` is plan 14's). The alarm icon (alarm set), the countdown icon (running) and
the stopwatch indicator (running, flashing per the user guide) are `StandbyIndicators` flags
(`alarm`, `timer`, `stopwatch`) on plan 18 D11's `standbyIndicators` reader, drawn by the stock
standby painter where Task 0 measures them (left of the clock, P2, P13). If plan 18 Task 4 has not
landed, Task 4 here adds the reader exactly as plan 18 specifies it.

**D11 - Alert sounds are captured programs on plan 16's sequencer (completes plan 16's follow-up
for 21).** The countdown's, the reminder's and (if Task 0c succeeds) the alarm's sounds and
vibrator are imported as sound goldens in the factory state and the virgin state, programs are
derived from them (`ALERT_PROGRAMS`), and the clock feature plays them through
`StockSounder.play` with the volume rule plan 16 fitted (Ringing volume; the countdown sounded at
v=6 even in the virgin state, P13, so Task 0 decides which settings gate which alert). The lights'
flashing is the goldens' `leds` column and is asserted by plan 25 (its backlight signal); plan 21
records it and emits nothing for it.

**D12 - Composed flows where the emulator cannot show the firmware (plan 15 D8's policy).** Screens
no capture can show are composed from captured widgets of the same family (the reminder and
countdown alert layouts, notes, confirm queries), with v6.39's own strings transcribed by hand from
the firmware string table (cited by id; nothing imported), each listed in `COMPOSED_FLOWS` with its
evidence and UNVERIFIED in the spec: the alarm's ringing screen, its tone, Snooze/Stop and
auto-snooze if Task 0c fails; the wake flow (D4) in every case. If Lachlan rejects compositions
(Open question 3), the alarm stores and shows its icon but never rings.

**D13 - Auto update maps the network's time to the host's (new).** The emulator's network sends its
time at registration (P14). nokia-os has no network time, and the host clock is the RTC (D1), so
at the end of each power-on: `On` clears the offset and, when that changed the phone's time, shows
`Date and time updated` (Task 0 records whether an unchanged time shows it); `Confirm first` asks
`Update date and time of the phone?` and clears it on Yes; `Off` does nothing. Reverse: Auto update
stores only.

**D14 - Reminder Send and received reminders belong to 18c (re-own).** View all › Options › Send
opens a placeholder owned by `18c` (Smart Messaging: business cards, tones and reminders are sent
the same way); the menu-tree crawl's `Phone number:` screen is its first screen.

**D15 - Brief items that v6.39 does not have (the brief's list, corrected).** The stopwatch has no
split timing, lap timing, `Show last` or `Delete times` on v6.39 (P12: Start, Stop, Options ›
Start, Reset, Exit; the user guide agrees). Those items are dropped, not stubbed.

**D16 - Ownership and registrations (the refactor's convention).** Behaviour lives in
`src/firmware/features/clock.ts` and `features/reminders.ts` (both exist with plan 14's tables; this
plan extends them), plus feature-private modules under `src/firmware/features/clock/` and
`src/widgets/` (new widgets); spec facts in `docs/specs/stock/clock-and-reminders.md`; acceptance
in `tests/acceptance/21-clock-and-reminders.test.ts`; captures in
`scripts/capture-sets/21-clock-and-reminders.ts`. Shared files get only the edits in "Shared-file
edits".

**D17 - The website does not change.** The seams are opt-in; the website sets none.
`git diff --stat <commit before Task 1> -- website/` is empty at the end.

## Ground truth and artefacts

| Source (`$REF/captures/`)                                          | Contents                                                                           | Use                                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `scratch-plan21/` (planning)                                       | P1-P16                                                                             | evidence for the decisions; never imported                |
| `6.39/plan21/` (Task 0)                                            | canonical recaptures (LCD records with `leds`, `.events.csv`, `keys.csv`)          | `clock/*`, `reminders/*`, `sound/clock/*` goldens         |
| `6.39/plan14/` (existing)                                          | Clock and Reminders first screens, probes                                          | plan 14's goldens; three `pending:21` become asserted     |
| `6.39/tree/_with-content/10-reminders/`, `11-clock/`               | a seeded reminder and alarm (the crawl's second pass)                              | reference for Task 0's sections                           |
| `6.39/setup/`, `6.39/standby/00-first-standby-prompt.png`          | the virgin clock wizard (`Time is set`, `Date is set`) and the junk reminder alert | reference; Task 0 recaptures them                         |
| `firmware/work/v639-plan15-restored.fls`, `-seccode.fls` (plan 15) | the factory image; the re-provisioned code                                         | factory-state sections; reboots that ask for the code     |
| `extracted/6.39/text/english.txt`                                  | firmware strings (P16)                                                             | cross-check and composed screens only (D12), never copied |

New artefacts (spec table, Task 1):

| Artefact                                                          | Cause                                                 | Handling                                                             |
| ----------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| The time of day never advances                                    | the emulated CCONT never reports its RTC running (P7) | captures move it with `settime`; nokia-os uses the host clock (D1)   |
| Minute edges every 60 s from the emulator's start                 | the emulated RTC-minute interrupt is free-running     | captures align on the edge; nokia-os fires at the host's minute (D2) |
| The alarm clock never rings                                       | the CCONT RTC alarm is dormant (P7, P8)               | Task 0c, else composed (D12)                                         |
| A powered-off emulator cannot advance                             | harness/emulator (P15)                                | the wake flow is composed (D4, D12)                                  |
| Countdown 58.1 s per minute; stopwatch counting fast              | the emulator's ≈7.745 ms timer unit (plan 23)         | nominal durations (D5); goldens aligned on the expiry                |
| The virgin junk reminder `0000000000` and its first-standby alert | virgin EEPROM                                         | a dormant entry (D8); its alert not reproduced                       |
| Network time = the harness clock (`CAP_EPOCH`)                    | the emulator's synthetic network                      | Auto update maps it to the host clock (D13)                          |

## Package boundaries

Unchanged from plans 13-18. phone-core gains two generic, opt-in seams (D3, D4) with no Nokia
labels, timings or clock concepts (they poll host functions, as `bootGates` and `standbyLine` do).
nokia-os gains no dependency and reads no wall clock: time comes only from the host's `clock`/`date`
ports and the kernel's `tick(nowMs)`. Scripts keep plan 13's conventions.

## Contract changes

Task 1 writes these into `VISION.md`; Task 4 implements phone-core's.

### `@hellotimber/phone-core` (additive, opt-in)

```ts
export interface StandbyIndicators {
  voicemail?: boolean;
  message?: boolean; // plan 18
  silent?: boolean; // plan 17
  /** Plan 21: an alarm is set. */
  alarm?: boolean;
  /** Plan 21: a countdown runs. */
  timer?: boolean;
  /** Plan 21: the stopwatch runs. */
  stopwatch?: boolean;
}

export interface PhoneConfig<Metadata = unknown> {
  // ...plan 13-18 fields unchanged...
  /**
   * Plan 21: polled on every tick while the phone is on and not booting. An application it
   * returns interrupts whatever is shown: the interrupted mode is held (no keys, no ticks), the
   * path is unchanged, navigate() is recorded and applied after it. Its exit() restores the held
   * mode; exit({ to: "standby" }) deactivates the held mode (reason `navigate`) and shows standby;
   * levels/select/row throw. Default: none.
   */
  interruption?: () => PhoneApplication | undefined;
  /**
   * Plan 21: polled on every tick while the phone is off. An application it returns powers the
   * phone on without the boot (empty stack, path `standby`); its exit() powers the phone off
   * again; exit({ to: "standby" }) runs the normal power-on (boot and gates). Default: none.
   */
  wake?: () => PhoneApplication | undefined;
}
```

Rules (Task 4 pins each with a test): an interruption is polled after the tick's timers, at most
one at a time (an interruption application's own `interruption` poll is suspended); a held
application is deactivated at most once (`navigate` by `exit({ to: "standby" })`, `power-off` by
the power long press during the interruption); exceptions from the poll or `createSession` are
contained (the poll's skip that tick, as `bootGates.open()`'s skip the gate); while a boot gate,
the boot or a wake activation runs, `interruption` is not polled; `wake` is not polled while on;
configs without the seams produce identical models and snapshots.

### `@hellotimber/nokia-os`

```ts
export interface StockPhoneConfig {
  /**
   * The phone's real-time clock: "HH:MM", 24-hour, re-read on every tick (plan 21: validated;
   * any other value counts as no time). The phone shows this plus its own offset (Clock settings,
   * Date setting) and fires alarms and reminders on its minute changes.
   */
  clock?: () => string | undefined;
  /** The RTC's date: "DD.MM.YYYY" (plan 21: validated like `clock`). */
  date?: () => string | undefined;
  // ...other fields unchanged...
}
```

No new exports. The clock record and the reminders record are internal (plan 15's records list).

## Clock and reminders API (internal)

Plans 22 and 25 consume these. Signatures are fixed by Tasks 5-11; a change is a Deviation here.

```ts
// src/firmware/features/clock/time.ts (pure)
export interface PhoneTime {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}
export function parseHostTime(
  clock: string | undefined,
  date: string | undefined,
): PhoneTime | undefined;
export function addMinutes(time: PhoneTime, minutes: number): PhoneTime;
export function minuteIndex(time: PhoneTime): number; // minutes since 1.1.2000, for ordering
export function formatClock(time: PhoneTime, twelveHour: boolean): string; // standby/page forms
export function formatDate(time: PhoneTime): string; // "13.10.2026"

// src/firmware/features/clock/service.ts (per phone)
export class StockClock {
  constructor(deps: {
    ports: StockPorts;
    settings: StockSettings;
    eeprom: StockEeprom;
    sounder: StockSounder;
    now: () => number;
  });
  now(): PhoneTime | undefined; // host + offset (D1)
  readonly ports: StockPorts; // phone-time `clock`/`date` readers (D1, D10)
  setTime(hour: number, minute: number): void;
  setDate(day: number, month: number, year: number): void;
  alarm(): { hour: number; minute: number } | null;
  setAlarm(time: { hour: number; minute: number } | null): void;
  countdown(): { remainingMs: number } | null; // kernel time (D5)
  startCountdown(ms: number): void;
  stopCountdown(): void;
  readonly stopwatch: StockStopwatch; // start, stop, reset, elapsedMs, running
  tick(): void; // minute edges (D2), timer expiry
  interruption(): PhoneApplication | undefined; // D3: the next due alert
  wake(): PhoneApplication | undefined; // D4: the alarm while off
  powerOn(): void; // D13 and overdue reminders
  indicators(): StandbyIndicators; // D10
}

// src/firmware/features/reminders/store.ts
export const REMINDERS_RECORD: EepromRecord<RemindersState>;
export class StockReminders {
  constructor(eeprom: StockEeprom);
  list(): readonly Reminder[];
  add(reminder: Reminder): "saved" | "full";
  replace(index: number, reminder: Reminder): void;
  erase(index: number): void;
  eraseAll(): void;
  due(at: PhoneTime): readonly number[]; // indexes not yet alerted, oldest first (D2)
  markAlerted(index: number): void;
  snooze(index: number, until: PhoneTime): void;
}

// src/widgets/time-entry.ts
export function timeEntry(options: {
  readonly layout: PromptLayout; // plan 14's measured first screen
  readonly mask: "hh:mm" | "dd.mm.yyyy";
  readonly initial?: string; // the stored value the prompt shows (cursor before it)
  readonly validate?: (value: string) => readonly string[] | undefined; // the error note's lines
  readonly done: (value: string, flow: Flow) => void;
}): Widget;
```

## Shared-file edits

One-line registrations unless stated. Everything else is new files or the two feature modules this
plan owns.

| File                                                                   | Edit                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/firmware/features/index.ts`                                       | none (clock and reminders are registered)                                                                                                                                                                                  |
| `src/firmware/features/clock.ts`, `features/reminders.ts`              | owned by this plan (extended, not registrations)                                                                                                                                                                           |
| `src/firmware/phone.ts`                                                | build `StockClock` (≈3 lines); pass `clock.ports` instead of the host ports and spread `{ interruption, wake, standbyIndicators }` into `createPhone` (one spread); `clock.powerOn()` in the power subscription (one line) |
| `src/display/standby.ts`                                               | one call: `paintClockIndicators(fb, screen)` (painter in `src/display/clock-indicators.ts`)                                                                                                                                |
| `src/display/widgets/index.ts`                                         | one union member and one case each for `time-entry` and `stopwatch`                                                                                                                                                        |
| `scripts/capture-sets/index.ts`                                        | one export line (`clockAndReminders`)                                                                                                                                                                                      |
| `scripts/tree-capture-set.ts`                                          | delete plan 21's group from `PLACEHOLDER_OWNERS` (`"11-4": "21"`: flips `tree/11-clock/11-4.leaf` and the note sound `sound/note/11-4`)                                                                                    |
| `scripts/capture-sets/14-menu-depth.ts`                                | `probe/confirm-10-3-2-yes`: `status: "pending:21"` → asserted (one line; it stays in plan 14's index)                                                                                                                      |
| `scripts/extract-resources.ts`                                         | one call: `clockResources(goldens)` from `scripts/clock-resources.ts` (writes `src/resources/generated/clock.ts`)                                                                                                          |
| `scripts/widget-sprites.ts`                                            | crop-table rows for the new sprites and named timelines (rows only)                                                                                                                                                        |
| `src/resources/index.ts`                                               | one export line for `generated/clock.ts`'s accessors                                                                                                                                                                       |
| `scripts/text-runs.ts` / `scripts/glyph-overrides.ts`                  | rows for new text images and harvester reports (rows only), if Task 3 needs them                                                                                                                                           |
| `docs/specs/nokia-3310.md`                                             | one row in §10's index (`stock/clock-and-reminders.md`, plan 21)                                                                                                                                                           |
| `demo/panels/index.ts`                                                 | one export line (`clockPanel`, `demo/panels/clock.ts`)                                                                                                                                                                     |
| `packages/phone-core/src/{types,machine,application,index}.ts`, README | the two seams (Task 4), plus plan 17's `label` / plan 18's `standbyIndicators` if absent (D9, D10)                                                                                                                         |

## Golden pipeline additions

`scripts/capture-sets/21-clock-and-reminders.ts` (explicit table, like `game-capture-set.ts`) writes
`goldens/clock/**`, `goldens/reminders/**`, `goldens/sound/clock/**` and `goldens/index/21.json`.
Ids `clock/<section>/<name>`, `reminders/<name>`, `sound/clock/<name>`; asserted unless noted; every
scenario hand-written in the acceptance file (`tests/support/clock.ts` drives them). Sound goldens
use plan 16's `sound-golden 1` format; LCD goldens plan 13's, with `trigger-frame` on the first
changed frame (plan 14 D8). Alert goldens recorded with `tominute` set `trigger-frame` to the
alert's first frame and note the minute edge.

| Fixture id(s)                                                     | Source (`$REF/captures/6.39/plan21/`) | Kind               | Asserts                                                                     |
| ----------------------------------------------------------------- | ------------------------------------- | ------------------ | --------------------------------------------------------------------------- |
| `clock/settings/{hide,show,standby-hidden}`                       | `settings/hide*`                      | timelines / stills | `Clock hidden`, `Show clock`, `Clock displayed`, standby without the clock  |
| `clock/settings/set-time-*`                                       | `settings/set-time*`                  | timelines          | entry, `Time is set`, invalid entries, the page after                       |
| `clock/settings/format-{12,24}-standby-<hhmm>`                    | `settings/format/*`                   | stills             | standby and page in both formats at 00:05, 09:41, 12:00, 13:07, 23:59       |
| `clock/date/*`                                                    | `date/*`                              | timelines          | entry, `Date is set`, invalid dates, the page after                         |
| `clock/no-time/*`                                                 | `no-time/*`                           | timelines          | the wizard skipped: standby without a clock, `Clock needs to be set first`  |
| `clock/alarm/{set,page,standby-icon,on-off,off,change}`           | `alarm/*`                             | timelines / stills | P2 and the On/Off level (D9)                                                |
| `clock/alarm/ring-*`, `sound/clock/alarm-*`                       | `alarm/ring*` (Task 0c only)          | timelines / sound  | the ringing screen, lights, Snooze, Stop, auto-snooze, re-ring              |
| `clock/countdown/{prompt,start,page,standby-icon,change,stop}`    | `countdown/*`                         | timelines          | entry, `Timer running`, the running list, `Timer stopped`                   |
| `clock/countdown/expire-<where>`, `sound/clock/countdown-<state>` | `countdown/expire*`                   | timelines / sound  | the alert at standby and over each interrupted screen; keys; the 30 s stop  |
| `clock/stopwatch/*`                                               | `stopwatch/*`                         | timelines          | Start, the run cadence, Stop, Options, Reset, Exit, re-entry, the indicator |
| `clock/auto-update/*`                                             | `auto-update/*`                       | timelines          | the list, the boot's `Date and time updated`, `Confirm first`'s query       |
| `reminders/add-*`                                                 | `reminders/add*`                      | timelines          | P10 with and without an alarm, invalid and too-late entries, memory full    |
| `reminders/view-*`, `reminders/erase-*`                           | `reminders/view*`, `erase*`           | timelines / stills | View all with 1-3 reminders, Options › Erase/Edit, One by one, All          |
| `reminders/alert-<where>`, `sound/clock/reminder-<state>`         | `reminders/alert*`                    | timelines / sound  | the alert at standby and over each screen; Snooze; other keys; re-alert     |
| `reminders/power-on-*`                                            | `reminders/power-on*`                 | timelines          | reminders due while off: the notice at the next power-on                    |
| `reminders/virgin-*`                                              | `reminders/virgin*`                   | timelines / stills | the junk reminder's View all, One by one and Erase (D8)                     |
| `clock/persist-*`, `clock/restore-*`                              | `persist*`, `restore*`                | stills             | alarm, offset and reminders after a reboot and after Restore (D7)           |

Plan 14's `tree/11-clock/11-4.leaf`, plan 14's `probe/confirm-10-3-2-yes` and plan 16's
`sound/note/11-4` move from `pending:21` to asserted (their scenarios exist in plans 14 and 16).

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` and the named test commands. A task that touches
  `phone-core` also runs `mise exec -- vp run -r test` and `mise exec -- vp run website#build`.
- Commit rule: run `mise exec -- vp check --fix` yourself (repeat `mise exec -- vp fmt` until
  stable), then `git commit --no-verify -m "<message>" -- <paths>` with only this plan's files.
  Never `git add -A`/`git add .`, never `git stash`. Never stage `TODOS.md` (Lachlan's untracked
  notes). Other agents may share the worktree.
- Never hand-edit `goldens/**`, `src/resources/generated/**`, `src/firmware/generated/**` or
  `scripts/generated/**`; change the generator or its tables and run
  `mise exec -- vp run @hellotimber/nokia-os#regenerate` (twice, no diff the second time) before
  the commit. On a merge conflict in a generated file, take either side and regenerate.
- Tests never read `$REF`. Generators that read `$REF` fail clearly when it is missing.
- No new dependencies.
- When reality differs from this plan, follow the captures and append a `Deviation:` paragraph
  under the task. If a deviation breaks a contract in VISION.md, stop and report.
- Parallelism (max 3 concurrent agents): Task 0 gates everything, then Task 1. Then lanes A
  (2 → 3), B (4) and C (5 → 6). Task 7 needs 3, 5 and 6; Tasks 8 and 9 need 4 and 7 (they may run
  together); Task 10 needs 3 and 4; Task 11 needs 4, 7 and plan 18 Task 7. Task 12 needs 8-11; then
  13 → 14.

## Tasks

### Task 0 - Harness clock commands and canonical REF captures (no repository changes)

**Files (all under `$REF`, gitignored):** `tools/harness/dct3cap.c` (the commands below; plans 16 and
18 changed it too: merge by hand, `build.sh` swaps the binary atomically),
`captures/scripts/gen_v639_plan21.py`, `captures/scripts/v639-plan21-<section>.cap` (command logs),
`captures/6.39/plan21/**`, `firmware/work/v639-plan21-*.fls`, a "Plan 21 supplementary captures"
section in `captures/README.md` (and its command table). Task 0c only: a separate harness build
directory (below). Other agents run the harness concurrently: write only these paths.

- [ ] **H harness commands.** `settime <hh:mm[:ss]>`: poke the software clock (0x1117B4, seconds of
      the day, big-endian 32-bit; P5) and print the word read back. `tominute [margin]`: run until
      `margin` (default 50 ms) past the next RTC-minute interrupt (emulated time a multiple of
      60 000 ms from the process start; confirm the edge against `ROM6_LOG`/`CCLOG`'s `ACK reg0E
&= ~20`). Find the software date the same way as P5 (dump RAM around a Date setting change
      `13.10.2026` → `14.10.2026`) and add `setdate <dd.mm.yyyy>` if it is a plain word; else
      record that reminders on other dates are set through Date setting only. Document all three.
- [ ] **Setup.** Virgin sections: `v639-setup.inc`, `key c`, `run 2s`. Factory sections:
      `v639-factory-setup.inc` (plan 16). Reboots that need the code use
      `firmware/work/v639-plan15-seccode.fls`-derived images (P14). `CAP_EPOCH=1791886200`
      (13.10.2026 10:10 UTC) on every run, so network time is reproducible. Run every section
      through `emu.py` with `fork`, as plans 14, 16 and 23 did (`gen_v639_plan21.py run -j 3`,
      `--only`, `ocr`, `check`); record LCD (`leds` column) and `audio` together.
- [ ] **S settings** (`settings/`): Hide clock (record), standby (shot), the entry now `Show clock`
      (scroll), Show clock (record); Set the time: the prompt, each digit typed one by one (shots),
      C, C on empty, invalid values (`2500`, `1260`, `0`, three digits then OK), `0959` OK (record
      through the page); Time format both ways with standby and the Clock settings page at
      `settime` 00:05, 09:41, 12:00, 13:07, 23:59 (shots, `tominute` before each so standby redraws).
- [ ] **D date** (`date/`): Date setting's prompt, digits one by one, invalid dates (`31022026`,
      `00002026`, `0110200`), `14102026` OK (record), the page.
- [ ] **N no time** (`no-time/`): a virgin boot with C at the clock wizard's `Time:` and `Date:`
      (records): standby, the Clock pages, Alarm clock (`Clock needs to be set first`?), Countdown,
      Reminders › Add new's date and time prompts.
- [ ] **A alarm** (`alarm/`): set from Off (record, P2), the page, standby with the icon (shot),
      Alarm clock again (the On/Off level, scroll), On → the prompt on the stored time → a new time
      (record), Off (record, `Alarm off`), the page and standby after it; Menu 1 1 1 1 and Menu 1 1 1
      2 with the alarm set (do shortcuts reach the inner list? D9); power-off with the alarm set
      (the power key's screens; record up to the switch-off).
- [ ] **R reminders** (`reminders/`, virgin and factory): Add new with `Alarm on` (P10) and with
      `Alarm off` (record each); `Remind about:` typed text of 1, 20 and 35 characters; the date
      and time prompts' digits one by one, invalid values and past values (`Time for alarm too
late`?), C at each step (where does it go?); View all with one, two and three reminders
      (▼/▲, Options › Erase, Edit, Send's first screen), Erase › One by one (each step) and All;
      reminders added until `Memory full. Replace old reminder?` (count them; Replace and Discard).
      **Alerts** with `settime` then `tominute` (factory, with sound and lights): at standby, in a
      menu list, on a page, during a timed note, during an option list, in Snake II, in an editor
      (Write messages), during `Sending message`, during the countdown's own alert; for each, the
      keys on the alert: Snooze, C, ▲, a digit, nothing for 120 s (does it stop, auto-snooze or
      stay?); after Snooze, `settime` to +9, +10 and +11 minutes with `tominute` (the exact
      re-alert minute); two reminders due in the same minute; a reminder 10 minutes overdue when
      the time is set past it (D2's jump rule); a reminder whose minute arrives while powered off
      (`saveflash`, `reboot` from it with the clock wizard set past it, or `CAP_EPOCH` and Auto
      update On: `1 reminder received` / `%U reminders received`?). Virgin: the junk reminder's View
      all, One by one and its record after Erase › All (D8).
- [ ] **T countdown** (`countdown/`, virgin and factory): the prompt's digits, invalid values, Start
      (P13), the page value as it runs (shots every 30 s: does `00:01` count down?), standby's icon,
      Countdown timer while running (the `Change time` / `Stop timer` list, each), expiry (60 s run
      for `00:01`, then 40 s more) at standby, in a menu, on a note, in Snake II, in an editor, in
      Stopwatch while running; keys on the alert (OK, C, a digit, nothing: the 30 s stop?); the
      lights; a countdown running across a power cycle (`saveflash`/`reboot`: still running?).
- [ ] **W stopwatch** (`stopwatch/`): open (record), Start and 60 s (record, every redraw: the
      cadence and the digits for D5), Stop, Options (scroll), Start (resumes from the stop), Reset,
      Exit and re-entry (still running?), C while running, C held while running (standby's
      indicator: flashing?), re-entry from standby, running past a minute and an hour (`run`
      3700 s in one fork, shots each minute), power-off while running.
- [ ] **U auto update** (`auto-update/`, on a re-provisioned image): each choice's note; `On` then a
      reboot with `CAP_EPOCH` equal to the phone's time and 1 hour away (does an unchanged time show
      the note?); `Confirm first` then a reboot (the query, Yes and No); `Off` then a reboot.
- [ ] **F persistence and Restore** (`persist/`, `restore/`): alarm, Set the time, a running
      countdown and two reminders, `saveflash`, `reboot` (what survives); the same then Restore
      factory settings (`12345`) on the re-provisioned image (what Restore keeps, D7).
- [ ] **0c - time-boxed (3 hours): make the alarm ring.** In a separate build directory
      (`captures/scratch-plan21/harness/`, never `tools/harness/build`), try in order and stop at
      the first that rings: (1) the planning patch (P8) plus a harness helper that sets the
      emulated RTC's base to the software clock and `RTCALARM=1` (does the firmware now program the
      alarm registers at set time, and does INT7 ring it, or wedge as the emulator warns?); (2) the
      IRQ2 handler's RTC-alarm branch (xref the reg 0x0E bit-7 test, `disfw`) called in context
      with `call` after `settime`; (3) the firmware routine that shows `Alarm!` (xref string id
      0x0e3) called with `call`. If one works, record the alarm sections into `plan21/alarm/ring*`:
      the screen at standby and over the screens of R, Snooze (`Snooze active`? the postponed
      note), Stop, any key, 60 s untouched (auto-snooze), the re-ring after the snooze, in factory
      and virgin states. Record what was tried, either way, in the README section.
- [ ] `gen_v639_plan21.py check`: every recording starts on its parent; every alert recording
      contains its alert; every sound section has `keys.csv` and v2 events.
- [ ] OCR every new image into `plan21/text.json` (plan 14's format).
- [ ] Append "Plan 21 supplementary captures" to `$REF/captures/README.md`: the commands, the P1-P16
      table, 0c's outcome.
- [ ] No commit. Record the outcome under this task: the clock and date RAM words, the minute-edge
      rules (alarm, reminders, jumps, overdue at power-on), each alert's layout, sound, lights,
      keys, duration and where it returns (D3), the snooze periods, the stopwatch cadence and
      display rule (D5), the countdown's running page and list, the entry widgets' rules and
      errors (D6), the reminders' capacity and View all's layout, Auto update's behaviour (D13),
      persistence and Restore (D7), 0c's result.

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `docs/specs/stock/clock-and-reminders.md` (new), `docs/specs/nokia-3310.md`
(one row in §10's index), `docs/specs/stock/foundation.md` (one line: the first standby prompt is a
reminder alert, P3), `docs/specs/nokia-3310-menu-tree.md` (two notes), `docs/plans/README.md` (row
21), this plan.

- [ ] Apply Task 0's outcome to D2-D13 (Deviation lines where it changes them) and fix the seams'
      rules.
- [ ] VISION: the phone-core seams and the `StandbyIndicators` flags exactly as in "Contract
      changes"; a plan 21 kernel-policy paragraph (interruptions, wake); `StockPhoneConfig.clock`/
      `date` as the validated real-time clock with the phone's own offset; the nokia-os row
      mentions the clock and alerts.
- [ ] `docs/specs/stock/clock-and-reminders.md`: the facts of P1-P16 and Task 0 (layouts, timings,
      rules, sounds, lights), the artefact table, the composed flows, everything "(plan 21, in
      progress)".
- [ ] Menu-tree spec: the virgin first standby prompt is the junk reminder's alert; the stopwatch's
      Options; `Show clock`.
- [ ] Plans README: row 21 `in progress`.
- [ ] No runtime code. `mise exec -- vp check --fix`.
- [ ] Commit: `docs: define clock, alert and wake contracts (plan 21)`.

### Task 2 - Goldens and re-owned placeholders (TDD)

**Files:** `scripts/capture-sets/21-clock-and-reminders.ts` (new), `scripts/capture-sets/index.ts`
(one line), `tests/clock-capture-set.test.ts` (new), `tests/acceptance/21-clock-and-reminders.test.ts` (new:
`acceptancePlan({ plan: "21", scenarios: {} })`; asserted goldens without a scenario fail, so the
capture set marks each golden `pending:21` until its task adds the scenario, and Task 12 asserts
the last), `goldens/**`.

- [ ] TDD the capture set on synthetic recordings (injected loader, as `game-capture-set.test.ts`):
      ids, kinds, cut points, `trigger-frame` on the first changed frame, sound goldens through plan
      16's importer functions, alert recordings trimmed to the minute edge.
- [ ] The three goldens other plans hold as `pending:21` stay pending here: Task 10 deletes plan
      21's `PLACEHOLDER_OWNERS` group (`11-4`, in `scripts/tree-capture-set.ts` and the clock
      feature's `placeholders`), which asserts `tree/11-clock/11-4.leaf` and `sound/note/11-4`;
      Task 11 flips `probe/confirm-10-3-2-yes` in `scripts/capture-sets/14-menu-depth.ts`. Each
      reruns `import-captures` twice.
- [ ] Integrity: `goldens/index/21.json` lists every new golden; ids unique; every sound golden
      parses.
- [ ] Run `import-captures` twice; the second run changes nothing. Record counts and bytes in a
      completion note.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(nokia-os): import clock and reminder goldens (plan 21)`.

### Task 3 - Glyphs, sprites, timelines and alert programs (TDD)

**Files:** `scripts/clock-resources.ts` (new, pure), `scripts/extract-resources.ts` (one call),
`scripts/widget-sprites.ts` (rows), `scripts/text-runs.ts`/`glyph-overrides.ts` (rows, if needed),
`src/resources/generated/clock.ts` (generated), `src/resources/generated/{fonts,widgets}.ts`
(regenerated), `src/resources/index.ts` (one line), `tests/clock-resources.test.ts` (new),
`tests/resources.test.ts`.

- [ ] Crop rows: the standby alarm, timer and stopwatch indicators; the reminder icon; the
      alarm-clock note icon (`Time is set`); the countdown's bell pictures; the alarm screen's art
      if 0c captured it.
- [ ] Named timelines: `Alarm on`, `Alarm off`, `Time is set`, `Date is set`, `Clock hidden`, `Clock
displayed`, `Timer running`, `Timer stopped`, `Reminder set`, `Reminder erased`, `Alarm
postponed for 10 min` (its partial leading and trailing frames as `cut`/`edges` steps, plan 14
      Task 7), `Date and time updated`, the bells' loop, the error notes Task 0 found.
- [ ] `clock-resources.ts`: `ALERT_PROGRAMS` (countdown, reminder, alarm if captured) from the
      `sound/clock/*` goldens with plan 16's `sound-programs.ts` functions (round trip: the program
      re-renders its golden), `STOPWATCH_CADENCE` (D5's fitted redraw steps), `SNOOZE_MINUTES`,
      `ALERT_LIMITS` (auto-stop and auto-snooze times), each with a comment naming its goldens.
- [ ] TDD: freshness; every new sprite binary and inside its golden's ink; every string the clock
      and reminder screens draw renders in its face (`0:00:00.00`'s digits in `large`, the 12-hour
      forms in `digits`).
- [ ] Run `mise exec -- vp run @hellotimber/nokia-os#regenerate` twice; no diff.
- [ ] Commit: `feat(nokia-os): derive clock and reminder sprites, timelines and alert programs`.

### Task 4 - phone-core: interruptions, wake and the indicator flags (TDD)

**Files:** `packages/phone-core/src/{types.ts,machine.ts,application.ts,index.ts}`, README; tests
`interruption.test.ts` (new), `wake.test.ts` (new).

- [ ] TDD `interruption`: polled each tick while on (never during boot, a gate or a wake
      activation); the held mode keeps its path, frames, rows window and session; keys and ticks
      reach only the interruption; `exit()` restores the held screen exactly (same model);
      `exit({ to: "standby" })` deactivates the held session once (`navigate`); `navigate()` during
      it is applied after; the power long press deactivates both once (`power-off`); one
      interruption at a time; poll and `createSession` exceptions contained; snapshots only on
      visible changes.
- [ ] TDD `wake`: polled each tick while off; the application powers the phone on without the boot,
      path `standby`; `exit()` powers off; `exit({ to: "standby" })` runs the boot with its gates;
      the power key during it; exceptions contained.
- [ ] `StandbyIndicators` gains `alarm`, `timer`, `stopwatch` (emitted only when true, plan 18 D11's
      rule); if plan 18 Task 4 or plan 17 Task 4 has not landed, add `standbyIndicators` and
      `SubmenuOptions.label` exactly as those plans specify.
- [ ] Existing tests pass unchanged; configs without the seams produce identical models.
- [ ] `mise exec -- vp run @hellotimber/phone-core#test`, `vp run -r test`, `vp run website#build`,
      `vp check --fix`.
- [ ] Commit: `feat(phone-core): interruptions and wake applications`.

### Task 5 - Phone time, the clock record and minute edges (pure, TDD)

**Files:** `src/firmware/features/clock/time.ts` (new), `src/firmware/features/clock/record.ts`
(new: `CLOCK_RECORD`), `src/firmware/features/clock/service.ts` (new: `StockClock` without its
alerts), `src/firmware/features/clock.ts` (`records`), `tests/clock-time.test.ts` (new),
`tests/clock-service.test.ts` (new).

- [ ] TDD `time.ts`: parse valid and invalid host strings (`24:00`, `9:5`, `31.02.2026`, empty);
      `addMinutes` across midnight, month ends, leap years; `formatClock` in both formats as Task 0
      recorded (leading zeros, `am`/`pm` spellings, standby vs page forms); `formatDate`.
- [ ] TDD `CLOCK_RECORD`: virgin value (no alarm, offset 0, nothing running); round trip; malformed
      fields dropped; `factory` per Task 0 F.
- [ ] TDD `StockClock` over a scripted host clock and kernel time: `now()` = host + offset;
      `setTime`/`setDate` keep the other half and persist; `ports` return the phone's strings and
      `undefined` while hidden or unparsable; minute edges detected once per minute change at any
      tick rate (1 ms ticks and one 10 min jump agree on how many edges fire: one); a backwards
      jump fires none.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): phone time over the host clock, with a stored offset`.

### Task 6 - The time and date entry widget (TDD against goldens)

**Files:** `src/widgets/time-entry.ts` (new), `src/display/widgets/time-entry.ts` (new; one line in
`src/display/widgets/index.ts`'s union), `tests/widgets-time-entry.test.ts` (new).

- [ ] TDD the painter from literal models against every entry image of `clock/settings/set-time-*`,
      `clock/date/*`, `clock/alarm/*`, `clock/countdown/prompt` and `reminders/add-*` (mask, typed
      digits, cursor position and blink).
- [ ] TDD the widget in a flow (`tests/support/flow-rig.ts`): digits per Task 0, C, C on empty, OK
      with a valid value (`done`) and with each invalid one (its note, then back to the entry as
      captured); the blink timeline (plan 14's cursor timelines) within ±2 ms.
- [ ] The plan 14 prompt goldens of 11-1, 11-2-2, 11-3 and 11-5 still pass.
- [ ] Commit: `feat(nokia-os): stock time and date entry`.

### Task 7 - Clock settings, Date setting, Auto update and the standby clock (TDD against goldens)

**Files:** `src/firmware/features/clock.ts`, `src/display/clock-indicators.ts` (new),
`src/display/standby.ts` (one call), `src/firmware/phone.ts` (the registrations in "Shared-file
edits"), `tests/clock-settings.test.ts` (new), `tests/paint-standby.test.ts`.

- [ ] Hide clock / Show clock: the label reader (D9), the notes, standby without the clock; Set the
      time and Date setting through `timeEntry` → `setTime`/`setDate`, their notes and the page;
      Time format on standby (D10) and on the page (plan 14's `twelveHourClock` replaced by
      `formatClock`, subtract).
- [ ] Auto update (D13) at the end of power-on (`StockClock.powerOn`): the note, the query and its
      answers, with `Done` on choosing as before.
- [ ] `phone.ts`: the phone-time ports, `standbyIndicators` (plus plan 18's and plan 17's flags if
      they exist: merge, do not replace), `clock.powerOn()`.
- [ ] Standby painter: the indicators at Task 0's positions; plan 13's standby goldens unchanged.
- [ ] TDD through keys against `clock/settings/*`, `clock/date/*`, `clock/no-time/*` and
      `clock/auto-update/*`; the plan 14 Clock goldens still pass.
- [ ] Commit: `feat(nokia-os): Clock settings, Date setting and Auto update over the host clock`.

### Task 8 - Alarm clock (TDD against goldens)

**Files:** `src/firmware/features/clock.ts`, `src/firmware/features/clock/alarm.ts` (new: the
level, the ringing flow, the wake flow), `src/firmware/features/clock/service.ts` (alerts),
`tests/clock-alarm.test.ts` (new).

- [ ] 11-1 per D9: `timeEntry` when off; the On/Off rows widget when set; `Alarm on`/`Alarm off`;
      the page value (the time, or `Off`); the standby icon.
- [ ] Ringing (D2, D3): the minute edge of the alarm time interrupts with the ringing flow (Task 0c's
      goldens, or the D12 composition from the reminder and countdown alerts with `\u0001Alarm!\n%U`
      0x0e3 transcribed, listed in `COMPOSED_FLOWS`); Snooze, Stop, any key, the one-minute
      auto-snooze, the re-ring after `SNOOZE_MINUTES`; the sound (D11) stops with the screen.
- [ ] Wake (D4, D12): while off, the alarm minute wakes the phone into the ringing flow; Stop →
      `Activate phone for calls?` (0x0e6) Yes → the normal power-on, No → off; Snooze → off until
      the snooze (UNVERIFIED, composed).
- [ ] TDD through keys against `clock/alarm/*` (and `ring-*` if captured) and `sound/clock/alarm-*`;
      composed screens unit-tested only (no golden asserts them).
- [ ] Commit: `feat(nokia-os): the alarm clock, its alert and snooze`.

### Task 9 - Countdown timer (TDD against goldens)

**Files:** `src/firmware/features/clock.ts`, `src/firmware/features/clock/countdown.ts` (new),
`tests/clock-countdown.test.ts` (new).

- [ ] 11-5: `timeEntry` → `Timer running` → the page (counting as Task 0 shows); while running, the
      `Change time` / `Stop timer` list (`Timer stopped`); the standby icon.
- [ ] Expiry at kernel time (D5) → the `Countdown time up` alert (bells loop, `OK`) over whatever is
      shown (D3, per Task 0's where-it-returns table); its sound (D11); keys; the automatic stop.
- [ ] TDD through keys against `clock/countdown/*` (expiry goldens aligned on the expiry) and
      `sound/clock/countdown-*`.
- [ ] Commit: `feat(nokia-os): the countdown timer and its alert`.

### Task 10 - Stopwatch (TDD against goldens)

**Files:** `src/firmware/features/clock.ts` (screen binding; the `11-4` placeholder gone),
`scripts/tree-capture-set.ts` (plan 21's `PLACEHOLDER_OWNERS` group deleted), `goldens/**`
(re-imported), `src/firmware/features/clock/stopwatch.ts` (new: state on kernel time),
`src/widgets/stopwatch.ts` (new), `src/display/widgets/stopwatch.ts` (new; one line in the union),
`tests/clock-stopwatch.test.ts` (new).

- [ ] The screen (`0:00:00.00`, large, centred), Start/Stop/Options, the Options rows (Start, Reset,
      Exit), C and C held per Task 0, running while the phone is elsewhere, re-entry, the standby
      indicator, power-off.
- [ ] The display rule and cadence (D5, `STOPWATCH_CADENCE`): redraws at the captured steps,
      digits from kernel elapsed time; the 10-hour limit per Task 0 (user guide).
- [ ] Delete plan 21's `PLACEHOLDER_OWNERS` group; rerun `import-captures` twice;
      `tree/11-clock/11-4.leaf` (plan 14's generic `leaf` scenario) and `sound/note/11-4` (plan 16's
      scenario) pass as asserted.
- [ ] TDD through keys against `clock/stopwatch/*`.
- [ ] Commit: `feat(nokia-os): the stopwatch`.

### Task 11 - Reminders (TDD against goldens; needs plan 18 Task 7)

**Files:** `src/firmware/features/reminders.ts`, `src/firmware/features/reminders/store.ts` (new:
`REMINDERS_RECORD`, `StockReminders`), `src/firmware/features/reminders/flows.ts` (new: Add new,
View all, Erase, the alert), `src/firmware/features/clock/service.ts` (reminder alerts),
`scripts/capture-sets/14-menu-depth.ts` (`probe/confirm-10-3-2-yes` asserted, one line),
`goldens/**` (re-imported),
`tests/reminders-store.test.ts` (new), `tests/reminders-flows.test.ts` (new).

- [ ] TDD `REMINDERS_RECORD`: the virgin junk entry (D8: dormant, alerted); capacity; order; `due`;
      malformed entries dropped; `factory` per Task 0 F; the stored JSON shape pinned by a snapshot.
- [ ] Add new: `textInput` (35), `Alarm on`/`Alarm off`, `timeEntry` for the date (prefilled with
      the phone's date) and the time, the notes and errors, memory full (`Replace old reminder?`).
- [ ] View all (D9) and its Options (Erase, Edit; Send → placeholder `18c`, D14); Erase › One by
      one and All; the level's `shown` children (Add new only when empty).
- [ ] Alerts (D2, D3): due reminders at minute edges, one at a time; Snooze (`Alarm postponed for
10 min`, the re-alert minute), the other keys, the automatic end per Task 0; overdue
      reminders at power-on (`1 reminder received` / `%U reminders received` if Task 0 shows them);
      the sound (D11).
- [ ] TDD through keys against `reminders/*` and `sound/clock/reminder-*`; `probe/confirm-10-3-2-yes`
      passes.
- [ ] Commit: `feat(nokia-os): Reminders with alarms, snooze and the reminder memory`.

### Task 12 - Acceptance and the coverage guard

**Files:** `tests/acceptance/21-clock-and-reminders.test.ts`, `tests/support/clock.ts` (new: rig
helpers for a scripted host clock, `minuteEdge(rig, hhmm)` and the Task 0 section drivers).

- [ ] A scenario for every asserted plan 21 golden; the host clock is scripted to cross the minute
      the capture's `tominute` crossed, on the tick the golden's trigger needs.
- [ ] Every asserted golden passes (pixels exact; timelines ±2 ms after alignment; probes and
      alerts that replay another recording's timing within `PROBE_TOLERANCE_MS`; sound within plan
      16's tolerances). New `knownGaps` need a reason. No golden is `pending:21`.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp check --fix`. Report the
      suite's run time.
- [ ] Commit: `test(nokia-os): drive the clock and reminders against their goldens`.

### Task 13 - Demo and README

**Files:** `packages/nokia-os/demo/panels/clock.ts` (new `DemoPanel`), `demo/panels/index.ts` (one
line), `packages/nokia-os/README.md`.

- [ ] Demo panel: the host clock follows the browser's local time (as today) plus a "host clock" control
      (+1 min, +10 min, +1 h, reset) so alarms and reminders can be tried without waiting; an alert
      log in the status line.
- [ ] Verify with `mise exec -- vp run @hellotimber/nokia-os#demo` and `agent-browser` (headless:
      drive through the `[role=status]` line, Skip boot): set an alarm a minute ahead, +1 min, the
      alarm screen, Snooze; a reminder; a 1-minute countdown; the stopwatch; Hide clock; 12-hour.
- [ ] README: the clock contract (D1), alerts and wake (D2-D4), timers (D5), what is composed (D12).
- [ ] Commit: `feat(nokia-os): clock controls in the demo`.

### Task 14 - Verification gate and closeout

**Files:** this plan, `docs/plans/README.md`, `docs/specs/stock/clock-and-reminders.md`.

- [ ] `mise exec -- vp check --fix`, `mise exec -- vp run -r test`, `mise exec -- vp run
website#build`; `git diff --stat <commit before Task 1> -- website/` is empty.
- [ ] Spec: replace "(plan 21, in progress)" with verified facts; list what stays UNVERIFIED (the
      composed flows, jump rules Task 0 could not settle, the stopwatch beyond what was recorded).
- [ ] Plans README row 21 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete clock and reminders (plan 21)`.

## Follow-up plan adjustments

- **17 - Profiles:** the alarm and reminder tones follow the active profile's Ringing volume and
  Vibrating alert as Task 0 shows; Silent's effect on alerts comes from the same settings.
- **18c - Chat and content:** reminder Send (D14) and reminders received by Smart Messaging.
- **22 - Calls:** the incoming call is an interruption (D3); an alert during a call and a call
  during an alert need plan 22's captures; Clear timers and call durations read `StockClock` for
  the date and time of each call.
- **25 - Keyguard and backlight:** the alerts' light flashing (the goldens' `leds` column) and
  keyguard during an alert.
- **Portfolio integration (not sequenced):** the website's `/menu/clock` page may show Lachlan's
  local time; nokia-os needs only the host clock strings.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Set the time against a host clock (D1):** the phone keeps an offset over the host clock, so the
   user can set it as on a real phone while the host stays the time base. Reverse: Set the time and
   Date setting store nothing, or a host write port.
2. **Firing rules (D2):** the alarm fires only when a minute change lands on it; reminders fire when
   a minute change finds them due, overdue ones included. Task 0 confirms with reminders; the
   alarm's rule is the firmware's design (P4, P7), UNVERIFIED in the emulator.
3. **Composed alarm screens (D12):** if Task 0c fails, the ringing alarm is composed from the
   reminder and countdown alerts and the firmware's `Alarm!` string; the wake flow is composed in
   any case. Reverse: the alarm never rings (it stores and shows its icon only).
4. **Countdown and stopwatch durations (D5):** nominal, not the emulator's 2.9 %-fast timer unit.
   Reverse: reproduce the captured durations (as plan 23 did for Snake II's ticks).
5. **The virgin reminder (D8):** a dormant junk entry so the virgin goldens hold, its alert not
   reproduced. Reverse: an empty reminder memory (then `menu/10-reminders.sub` and
   `tree/10-reminders/10-2.leaf` become captures of an unreachable state).
6. **Auto update (D13):** network time is the host clock, applied at the end of each power-on.
   Reverse: Auto update stores its choice only.
7. **Reminder Send (D14):** 18c's. Reverse: plan 21 binds it on plan 18's network port.

## Conflicts found while planning

- The brief lists split timing, lap timing and `Show last` for the stopwatch; v6.39 has Start, Stop
  and Options › Start, Reset, Exit (P12; D15).
- The brief says the RTC freezes "after setting" (plan 13 issue): the time of day never runs at all
  in the emulator; the software clock word only moves when poked or set (P1, P4, P5).
- Plan 13's artefact table calls the first standby `Snooze` prompt a "virgin EEPROM alarm state":
  it is the junk reminder's alert (P3).
- Plan 14 D11 calls Alarm clock, Set the time, Date and Set timer "number prompts"; their entry is a
  mask with the cursor before the value, not plan 18's right-aligned number entry (D6).
- The user guide (helpdoc "Alarm clock") says the alarm stops "by pressing any key" and gives no
  `Stop` soft key; the reminder alert's soft key is `Snooze` (P3). Task 0 (and 0c) decide.
- The user guide's countdown alert "stops automatically after 30 seconds"; P13 recorded 16 s of it
  only; Task 0 measures.
- Plan 18 D11's `StandbyIndicators` and plan 17's `silent` flag are extended here with three flags;
  plans 17 and 18 have not landed, so whichever plan lands first adds the reader.

## Done means

- The phone's time is the host clock plus its own offset; standby, the Clock pages, Hide clock and
  both time formats match their goldens; Set the time, Date setting and Auto update work.
- The alarm sets, shows its icon, rings at its minute (captured, or composed and listed), snoozes
  and stops; a powered-off phone wakes for it (composed, UNVERIFIED).
- The countdown and the stopwatch match their goldens on kernel time; the countdown's alert
  interrupts as captured.
- Reminders add, list, erase, alert at their minute, snooze and survive as the captures show; the
  Reminders level hides View all and Erase when empty.
- Every alert's sound matches its sound golden; every asserted golden passes; no golden or
  placeholder names plan 21.
- phone-core's seams are opt-in and Nokia-agnostic; the website is unchanged; `vp check`,
  `vp run -r test` and `vp run website#build` pass; VISION, the specs and the plans README match
  what shipped.
