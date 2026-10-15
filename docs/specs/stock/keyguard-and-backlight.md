# Keyguard and lights (plan 25)

Part of the stock firmware's ground truth ([index](../nokia-3310.md#10-firmware-ground-truth-v639-captures)): the goldens under `packages/nokia-os/goldens/` are authoritative; where this file and a golden disagree, fix this file.

Source: plan 25's planning probes (`$REF/captures/scratch-plan25/`, K1-K8 and L1-L9 in
`docs/plans/25-keyguard-and-backlight.md`) and its Task 0 captures (`$REF/captures/6.39/plan25/`,
211 recordings). The capture harness copy `tools/harness-p25` logs both LED lines (`emu_led_lcd`,
`emu_led_kbd`: the `leds` bits 0 and 1) every 1 ms in `<recording>.lights.csv`, with the time
since the power-on; LCD recordings sample `leds` only at redraws. Times below are from the
key-down unless stated.

## Lights

- **Two lines, one switch.** The display LEDs (LCD backlight) and the keypad LEDs always switch
  together in v6.39: on in the same 1 ms grain, off at most one grain apart. `leds` is only 0 or
  3 in every recording.
- **On.** A light activity lights both 14-33 ms after its key-down (mostly 17-19 ms; not
  reproduced: nokia-os lights at the key-down).
- **The light tick.** Every timeout off edge (122 edges, ticks 12-94) lies within 2.9 ms of
  power-on + 2 ms + k × **1982.61 ms**. The tick is anchored at the power-on (the emulator's
  cycle 0), not at the boot's end. (The planning probes' 1982.60 ms over 13 edges agrees.)
- **Off.** At the **first tick at least D after the last light activity**, D ∈ (13619.6, 13627.6]
  ms (nokia-os: 13624 ms). The dark therefore comes 13.62-15.61 s after a key. Taps 8 ms apart
  straddle D (`lights/timeout/factory/fine-*`), so "the n-th tick after the key" is not the rule.
- **Holds and releases.** A key held 0.2-16 s goes dark with the same edge as a tap: only the
  key-down counts. A key while lit restarts D.
- **Activity** (lights on, D restarted): a key-down at an unlocked phone (every key, the power
  key's short press included: at standby it also opens the profile list, elsewhere it changes no
  pixel); the power key's short press on a locked phone; the self-test's first boot frame (245-272
  ms after power-on) and the boot's clock prompt (the LEDs time out from the prompt: factory dark
  at 23.79 s, virgin with the security code 31.72 s); an SMS arriving at an unlocked phone (with
  its `1 message received` notice); an incoming call, locked or not, whose ringing holds the LEDs
  on (75 s seen, no timeout); Unlock then `*`; the emergency display; Snake II's pause, Continue,
  the death's end and the top score's `Game over!` screen.
- **Not activity:** a key-up; a hold's duration; keys on a locked phone (the hint, Unlock alone, a
  second Unlock, a digit or C after Unlock); the `*` that locks (the LEDs time out from the Menu
  key-down); an SMS arriving at a locked phone; a timed screen ending (the lock note, the hint,
  the emergency display); Screen saver On (no screen saver can show: no picture is stored in the
  virgin or factory image).
- **Games › Settings › Lights** (Off in the captures' factory image `v639-plan15-restored.fls`;
  plan 15's in-session Restore scroll `plan15/factory/scroll/8-6-2` shows On, and so does
  nokia-os's factory state). While Snake II is playing, Off holds both LEDs off
  (38 ms after New game; play keys and the power key change nothing) and On holds them on (30 s
  of play, no timeout). The pause (Navi or C) and the death's end release the hold with activity;
  Continue is activity and the hold returns (Off: dark again 20 ms later). Outside play the
  timeout applies (On: the pause and game-over screens time out). nokia-os ends the hold at the
  game-over screen, the crash plus the death steps (2066 ms; a top score's fireworks 45 ms later)
  and counts the fireworks' `Game over!` title 2872 ms later as activity again.
- **Power-off.** The power key held at a lit standby: the profile list, then the LCD blanks and
  the LEDs go off together 1017 ms into the hold.

## Keyguard

- **Lock.** Menu at standby, then `*` within (2920, 2930] ms of the Menu key-down (nokia-os:
  2925 ms; plan 14's carousel dots turn 2948 ms after Menu, a redraw later). ▼, a digit or C
  before the `*` cancels it; a later `*` reaches standby number entry (`*`, `Call`; plan 22).
  `Keypad locked` (large, two lines) with a keypad icon crossed out over four steps,
  442/232/240/1971 ms, then a 9 ms partial draw and the locked standby. The lock plays the
  1750 Hz warning tone (0x9105, 293 ms) in place of the `*`'s beep.
- **Locked standby.** The key icon at the top left (before the envelope when a message waits),
  ladders, operator, clock, soft key `Unlock`.
- **Hint.** Every key on a locked phone (0-9, `*`, `#`, ▲, ▼, C, held keys, the power key) shows
  standby without ladders, then `Press` / `Unlock` / `and then *` (large, three lines) with a
  keypad and a pressing finger over eight steps, 564/595/179/202/194/195/579/401 ms, a 8-23 ms
  partial draw, the locked standby. After C, ▲, ▼ and the power key (`hint/up`, `hint/pwr`) the
  lead is 25 ms, the first step 8 ms longer and the last 23 ms shorter, closed by the same partial
  image held 23 ms; another recording of the power key (`power-key-held`) times as the digits'
  (UNVERIFIED: likely the timer's phase, not the key). The lead shows only when the key leaves a
  screen with ladders (the locked standby, `Now press *`, the emergency display, each without its
  ladders); a key during the hint restarts it from its first step at once. Keys
  are silent; the LEDs do not change (except the power key's, which lights them). Holding the
  power key 10 s does not switch a locked phone off.
- **Unlock.** Unlock (Navi) shows `Now` / `press *` (bold small face) in place of the operator and
  the soft key for 1448 ms; a second Unlock restarts it. `*` within it (≤ 1440 ms of the Unlock
  key-down unlocks, ≥ 1450 ms does not) shows `Keypad active` with `Done`'s dotted box and tick
  (683/232/521 ms, partial draws of 21 and 9 ms), then the normal standby; the `*` beeps and lights
  the LEDs. A digit or C during `Now press *` shows the hint.
- **Emergency.** Digits typed on a locked phone are buffered (each shows the hint). When the
  buffer ends in `112` (`112`, `2112`, `0112`; not `911`, `999`, `000`, `08`, `110`, `113`, `1122`)
  the phone shows `112` in the large digits, right-aligned, with `Call`, the key icon, ladders and
  clock, for 3878.6 ms, and lights the LEDs. C ends it at once; another digit shows the hint;
  Call (Navi) shows `Attempting emergency call` / `End` (plan 22).
- **Arrivals.** An SMS lights an unlocked phone at its arrival (`lights/arrival/sms`). On a locked
  phone it shows its notice with the key icon and `Unlock` and stays dark; a waiting message's
  envelope sits right of the key icon, from x 23 (x 7 unlocked). An
  incoming call on a locked phone rings as on an unlocked one (`0412345678`, `calling` blinking
  every ≈480 ms, `Answer`); Navi answers, Navi (`End`) or C ends it; then `Keypad locked` again
  (446/232/232/1979 ms) and the locked standby.
- **Key-down.** The lock note, the hint, `Now press *` and the emergency display all draw while
  their key is still held.
- **Power cycle.** A cold power-on (the emulator's battery pull) comes up unlocked.

## Screens (measured, plan 25 Task 6)

Every position below paints its golden pixel for pixel (`tests/keyguard-paint.test.ts`).

| Screen            | Layout                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Locked standby    | standby (ladders, operator, clock) with the key icon at x 7-19, y 0-5, and `Unlock` (small, centred, top 40) in place of `Menu`; before the hint it shows without ladders for 27 ms (25 ms for C, ▲, ▼ and the power key) |
| `Keypad locked`   | large lines from x 0 at tops 3 and 18; the keypad icon in x 62-83, y 0-25, crossed out over four steps; a 9 ms partial draw (`edges` 5-78) before the locked standby                                                      |
| Hint              | large lines at tops 3, 18 and 33; the keypad and finger in x 62-83, y 0-25 (seven images over eight steps, the first repeated last); an 8 ms partial draw (23 ms after C, ▲, ▼ and the power key)                         |
| `Now press *`     | the locked standby without the operator line: the small face from x 6 at tops 7 and 16; `Unlock` kept. As `*` unlocks, the same without ladders for 21 ms                                                                 |
| `Keypad active`   | large lines at tops 3 and 18 with `Done`'s dotted box and tick (plan 14's `note/tick-box`, `note/tick-half`, `note/tick`)                                                                                                 |
| Emergency display | the locked standby's icons and clock, no operator; the number in the large face at top 24, its last cell ending at x 76; `Call` (small, centred, top 40)                                                                  |

## Artefacts and UNVERIFIED

| Item                                                                   | Handling                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------ |
| `leds` in `timings.csv` sampled only at LCD redraws                    | the 1 ms `.lights.csv` logs (plan 25's harness copy)   |
| 14-33 ms from a key-down to the LEDs; 25-69 ms keyguard redraw latency | not reproduced (plan 25 D2, D11)                       |
| 6-23 ms partial frames at the end of keyguard screens                  | partial draws, as plan 14's                            |
| No screen saver picture in the virgin or factory image                 | the screen saver and the lights stay independent (D15) |
| No CCONT power cut reported after the power key's hold                 | the blank LCD and dark LEDs mark the power-off         |
| Operator `Orange F`, caller `0412345678`, clock 10:10                  | test inputs                                            |

UNVERIFIED: the LED rise and fall times (the captures are binary); charging (no charger model);
the car kit's `Lights` (no PPH-1); the screen saver with a picture (plan 18c); the alarm's LED
blink (plan 21); emergency numbers other than those tried; whether a call in progress holds the
LEDs on; Unlock during the hint (nokia-os: unlocks as at the locked standby); a key during
`Keypad active` (ends it) or `Keypad locked` (the hint, no lead); the digits typed while locked
being forgotten when the locked standby returns; keys other than C, Unlock and digits during the
emergency display (the hint); Continue on a game whose death had begun (nokia-os: no hold); the
death's end lighting 27 ms before the game-over redraw in `lights/game/off/over` (nokia-os
lights at the screen); which image is the factory state for Games › Settings › Lights.

## What nokia-os reproduces

Every plan 25 golden not pending on plan 22 is asserted (193 of 210): the keyguard's LCD
timelines and stills pixel for pixel, their `leds` per row, the lights goldens' edges within
5 ms after power-on alignment, and the keyguard's sounds. The four message arrivals (asserted with
plan 18's merge) are aligned on the arrival: the captures do not log the delivery and the link
time spreads 2141-2464 ms, so they pin what an arrival lights and paints, not its latency. Known gaps (expected failures, causes in
`tests/acceptance/25-keyguard-and-backlight.test.ts`): a restarted hint closing with two partial
draws (`hint-during`, `emergency/{000,110,113,911,999}`), `Keypad locked` timer spreads of
15-29 ms (`lock-gap/{2500,2900,2910,2920}`), `*` during the carousel's shortcut entry
(`lock-cancel/digit`, plan 14's kernel), the light tick's ±3 ms (`timeout/virgin/tap-02`), the
power key's long press (`boot/power-off`, plan 17) and Snake II deaths the captured bot's keys do
not reproduce (`game/{off,on}/{over,top-score}`).

## The website's backlight

The website keeps its own backlight (`settings.backlight`, its idle screen saver in
`website/src/phone/phone.ts`), unrelated to the stock firmware's light tick. It is replaced when
the website adopts nokia-os and drives phone-3d's `backlightOn` and `keypadLightOn` from the
lights port (portfolio integration, not sequenced).
