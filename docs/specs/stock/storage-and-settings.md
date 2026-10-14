# Security code, boot gates and storage (plan 15)

Part of the stock firmware's ground truth ([index](../nokia-3310.md#10-firmware-ground-truth-v639-captures)): the goldens under `packages/nokia-os/goldens/` are authoritative; where this file and a golden disagree, fix this file.

Source: the plan 15 captures (`captures/6.39/plan15/`, `captures/6.39/boot-clean/`,
`captures/5.79/plan15/`; the `captures/README.md` section "Plan 15 supplementary captures"),
asserted by nokia-os's `boot/security-*`, `boot/welcome-note*`, `probe/code-*`, `probe/accept-*`
and `probe/persist-reboot` goldens. The boot goldens compare within ±25 ms: their self-test
replays `boot/power-on`'s recording, whose first frame (power key to the first draw) other boots
show as 245-270 ms. `boot/security-lockout-4` is a known gap: its `Code accepted` and hands are
26-28 ms off `boot/security-gate`'s.

**Why the emulator rejected the code.** The virgin PMM stores the security-code record
enciphered under another key. The firmware reloads it into RAM when the clock wizard is left, and
from then on no 5-digit code verifies, which is why every in-menu prompt answered `Code error` to
`12345` (plan 13, plan 14) while the power-on prompt accepted it. Calling the firmware's own
set-code routine with `12345` at standby re-provisions the record; on that image every in-menu
prompt accepts `12345`. The same stale record makes the virgin phone ask for the code at every
power-on although Phone security reads `Off`.

**Code entry.** The prompt is plan 14's first screen (`Security code:`, soft key `OK`). Each digit
appends a `*` in the small face from x 0, top 29; the entry holds 10 digits and ignores an 11th.
C deletes the last digit; C held 1 s clears the entry. C on an empty entry returns to the page at
once in a menu and does nothing at the power-on prompt. OK with a wrong code, with fewer than 5
digits or with none shows `Code error` (octagon, 2889-2911 ms; nokia-os plays 2904 ms in menus
and 2889 ms at power-on), then the empty prompt again.
Five consecutive wrong codes lock every code entry, the correct one included, for ≈290 s of
emulated time; each entry during the lockout gets `Code error` and restarts it; no other note is
shown; the lockout survives power-off; an accepted code outside it resets the count. The count is
shared by the power-on prompt and the menus. UNVERIFIED: whether entries shorter than 5 digits
count toward the five (nokia-os counts every rejected OK).

**Post-acceptance flows (v6.39).** No in-menu flow shows `Code accepted`. Phone security (6-3-5):
the `Off`/`On` list opens at once on the stored value; OK shows a `Done` tick, then the page.
Change security code (6-3-6-1): `Enter new security code:`, then `Verify new security code:`; a
mismatch, or a new code that is not exactly 5 digits, shows `Code error` and returns to `Enter
new`; a match shows `Security code changed` (tick, 680/232/537 ms), then the page, and from then
on only the new code is accepted. Restore factory settings (6-4): `Settings restored` (tick,
≈697/217/546 ms), then the page. Clear timers (4-5-5): `Timers cleared` (tick), then the page.

**Boot gates.** With Phone security On, power-on asks for the code when the inserted SIM is not
among the last five used (user guide; confirmed on v5.79 and v6.39 with a second SIM): after the
self-test, a 42 ms blank, the prompt; `Code accepted` (tick, 689/232/582 ms) after the code, then
the hands. The same SIM next time, or any SIM with Phone security Off, gets no prompt. A stored
welcome note replaces the hands: it is drawn in the large face from x 1 at tops 7 and 22, wrapped
at a space (`Welcome to` / `my phone`), then standby. Under the gate the note ends 6357.9 ms after
`Code accepted` appears (`Hi` 4930.7 ms); without the gate it follows the self-test after a 7 ms
partial draw and lasts 5079.5 ms. The gate-free boot (`boot-clean/power-on`, after a Restore) is
the self-test, then the hands at irregular steps (132, 360, 302, 292, 366, 287, 320 ms, the last
held 3951 ms); after the gate the hands keep regular ≈255 ms steps (308, 255, 255, 257, 255,
256 ms, last 4215.6 ms), then standby. With a note under the gate, `Code accepted` runs
689/247/491 ms before the note (the hands' version: 689/232/582 ms). Every power-on that passes
records its SIM. nokia-os's `boot: "skip"` asks for the code at power-on and goes to standby
after `Code accepted`, with no hands and no note. UNVERIFIED: keys during `Code accepted`, the
hands and the note (nokia-os ignores them); a note needing a third line (nokia-os draws it at top 37) or with a word wider than the LCD (nokia-os breaks it where it stops fitting); characters the
large face lacks (nokia-os leaves them out).

**Virgin and factory states.** Empty storage is the virgin EEPROM, the state the plan 13/14/23
goldens assert. Restore factory settings writes the factory state: Ringing tone `Nokia tune`,
Ringing volume `Level 4`, Incoming call alert `Ringing`, Message alert tone `Standard`, Keypad
tones `Level 2`, Warning tones `On`, Vibrating alert `On`, Screen saver Timeout `5 seconds`, each
profile's own values, Own number sending `Set by network`, Set delay `30 seconds`, Phone security
`Off`, the profile names, Info service topics (`Add topic` only) and languages (`All`); every
other list keeps its virgin opening. Restore keeps the welcome note, the security code, the
language and the Top scores. Snake II's top score being kept is v5.79 evidence (`1297` before and
after); Snake II's level returns to virgin, UNVERIFIED (no capture shows it after a Restore).
Info service topics shrinking to `Add topic` is left to plan 18, which owns the topics.

**Capture artefacts (plan 15; see also [menu-depth.md](menu-depth.md)):**

| Artefact                                                       | Cause                                                        | Handling                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| In-menu `Code error` for the correct code (virgin image)       | the virgin PMM's code record is enciphered under another key | never recorded as behaviour; wrong-code goldens use `00000` |
| Security prompt at every virgin power-on, Phone security `Off` | the same stale code record                                   | its pixels are the gate's; it follows Phone security + SIM  |
| Clock wizard after the welcome note and after the hands        | virgin EEPROM, emulator RTC                                  | cut from the boot goldens (omitted frames)                  |
| v5.79 code `62628`                                             | the v5.79 image's code block decrypts to it                  | used only to drive the v5.79 captures                       |
| Lockout length ≈290 s                                          | emulated time                                                | reproduced as captured; UNVERIFIED on hardware              |
