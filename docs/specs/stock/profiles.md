# Profiles (plan 17)

Part of the stock firmware's ground truth ([index](../nokia-3310.md#10-firmware-ground-truth-v639-captures)): the goldens under `packages/nokia-os/goldens/` are authoritative; where this file and a golden disagree, fix this file.

Source: the plan 17 captures (`captures/6.39/plan17/`, the `captures/README.md` section "Plan 17
supplementary captures"), plan 14's virgin `plan14/open/12-n-1` and `12-n-2-10`, plan 15's
`accept/c4-*`, plan 16's `notes/12-n-1` and `boot/power-key`. Factory facts come from plan 15's
restored image. Every fact below is verified against plan 17's asserted goldens
(`goldens/index/17.json`, `tests/acceptance/17-profiles.test.ts`) except the known gaps and the
UNVERIFIED list at the end.

**Slots.** v6.39 has six profiles: General, Silent, Discreet, Loud, `(empty)` and slot 6, which the
virgin EEPROM names with two U+E000 boxes and Restore names `(empty)`. There is no Meeting, Outdoor
or Pager profile and no timed profile (later firmware). Each profile has `Activate` and
`Personalise`; Personalise holds the Tones settings (Ringing tone, Ringing volume, Incoming call
alert, Message alert tone, Keypad tones, Warning tones, Vibrating alert, Screen saver) and, except
General's, `Rename`.

**A profile is its settings plus a name.** The active profile is stored (General on the virgin
EEPROM and after Restore factory settings) and survives a power cycle. Tones (menu 5) are the active
profile's Personalise settings: with Silent active every Tones page shows Silent's value, and Tones ›
Keypad tones → Level 3 writes Silent's (General's stays Level 2). Every audible difference between
profiles comes from those settings: keys beep at the active profile's Keypad tones level (Silent
none, Discreet 0x9108, Loud 0x9100), `Invalid shortcut` sounds only with its Warning tones On, a
Ringing tone preview follows its Incoming call alert. The manual's "Silent mutes all tones" is
history: Silent is its stored values, and Silent with Keypad tones Level 3 beeps.

**Activate.** `Selected` / `profile:` / the name in the large face with the tick (box 678-700 ms,
half 218-240 ms, full 1958-1989 ms), an 8-10 ms partial draw of standby's edges, then standby. The
choice is stored when the note opens; the key that activates beeps at the new profile's level
(Navi on Activate, OK or a digit in the power list, the last digit of `Menu 1 2 n 1`). The power
key's down during the note opens the power list.

**Standby.** For every active profile but General the name is drawn centred in the small face under
the operator (top 18), 1898-1913 ms after standby is drawn at a note's end (1916-1921 ms after other
notes, 1926-1930 ms after the operator's redraw on a key's return). A key's return to standby (C,
C held, a notice's C, the power list's C) first shows the ladders without the operator for
84-95 ms. Menu's 29-39 ms frame with the ladders erased keeps the operator, the clock, the name and
the silent icon. With General active and Incoming call alert Off, Message alert tone No tone,
Keypad tones Off and Warning tones Off, the line shows the firmware's text `Silent` (not Silent's
stored name); any of the four on removes it, and volume and vibrator do not matter. A small icon
at x 7..13, y 0..5 shows while the active profile's Incoming call alert is Off.

**The Profiles level** lists the stored names and opens on the active profile (also after a power
cycle and after visiting another profile's level).

**The power key at standby.** On its key-down standby is shown 29-30 ms with the ladders and the
signal and battery icons erased, then a rows list `Switch off!`, General, Silent, Discreet, Loud,
`(empty)`, slot 6 (the stored names) on `Switch off!`, soft key `OK`, the rail, no indicator, the
circular rows window. ▲/▼ and further power presses move; OK on a profile activates it as Activate
does; OK on `Switch off!` switches the phone off (24-40 ms later) with the power-off tone (900 Hz,
0x9105) instead of the key's beep. Digits choose by position at once: `1` switches off, `2`-`7`
activate that profile, `8` and `9` show `Invalid shortcut` (2886 ms, an 8 ms and a 15 ms partial
draw, standby), `0` shows it after 2.98 s; `*` and `#` do nothing. C shows the ladders without the
operator for 84-88 ms, then standby. Left alone it stays. Held at standby the list shows, then the
phone switches off ≈1033 ms after the down. The list also opens over a standby notice; in the
carousel, a level, an option list, a prompt and a game menu the short press does nothing.

**Rename** (Personalise's last page, the value drawn in the thin face): `New name:` with the name,
the cursor at its end (≈480 ms blink), multi-tap `abc` and the counter 10 − length; at 0 further
keys are ignored. OK writes the name and shows `Done` (tick 687-700 / 218-240 / 534-545 ms), then
the Rename page. C deletes, C held clears (mode `Abc`, counter 10), C on an empty entry returns to
the page with the name unchanged. OK on an empty name restores the factory name (`Silent`,
`Discreet`, `Loud`, `(empty)`, and `(empty)` for slot 6 in both the virgin and the factory state).
The name shows in the Profiles list, the profile's level title, the power list, the note, standby
and the Rename page, and survives a power cycle. Restore factory settings makes General active and
resets every name (slot 6: `(empty)`).

## Artefacts

| Artefact                                                                                           | Cause                                                                                                                                   | Handling                                                 |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Slot 6 named with two U+E000 boxes                                                                 | uninitialised EEPROM name (virgin)                                                                                                      | virgin state; Restore and an empty rename give `(empty)` |
| Discreet's operator line overwritten with garbage 12-15 ms after its name                          | Discreet's Screen saver On with an uninitialised picture (plan 15's restored image); Screen saver Off removes it; not its name or tones | not reproduced                                           |
| Standby without network after an in-process reboot (`persist/boot`): no operator, the name at once | the harness's reboot from a saved image                                                                                                 | evidence only                                            |
| `Hi` welcome note and the clock wizard at power-on in factory runs                                 | plan 15's restored image                                                                                                                | cut from boot recordings                                 |
| Key-to-redraw and Switch off! latency                                                              | firmware key scan                                                                                                                       | not reproduced (plan 14 D8)                              |

## Known gaps in nokia-os

Asserted goldens nokia-os does not match yet, each named in the plan 17 acceptance file:

- A key's return to standby first draws the ladders without the operator (84-95 ms); nokia-os
  draws standby at once (`profiles/standby-carousel-c`).
- The power key held at standby switches off ≈1033 ms after its down; the kernel's long press is
  800 ms (`profiles/power-general-held`).
- In the power list the power key beeps 121-123 ms after its down; nokia-os beeps at the down
  (`sound/profiles/power-general-power-keys`).
- Rename's cursor phase after several multi-tap commits (`rename-limit`, `rename-limit-extra`,
  `rename-limit-ok`, `rename-symbols`) and a stray cursor column in one virgin recording
  (`rename-open-12-3`).

## UNVERIFIED

- The name's delay after notes other than Activate, `Date is set` and the power list's choice.
- Whether the power list's C keeps a standby notice (nokia-os keeps it).
- The power key during other notes that end at standby (only the Activate note is captured).
- Which setting silences Switch off!'s power-off tone: Silent has both Warning tones and Keypad
  tones Off; nokia-os gates it on Warning tones.
- Notices other than the captured ones over the power list, and the power key in a call or with the
  keyguard on (plans 22 and 25).
