# Tones and sound (plan 16)

Part of the stock firmware's ground truth ([index](../nokia-3310.md#10-firmware-ground-truth-v639-captures)): the goldens under `packages/nokia-os/goldens/` are authoritative; where this file and a golden disagree, fix this file.

Source: plan 16 Task 0 (`$REF/captures/6.39/plan16/`, 631 recordings; the planning probes
S1-S10 in `docs/plans/16-tones-and-sound.md`), imported as 331 sound goldens (299 asserted, each
driven by a scenario and compared by the fidelity standard of `AGENTS.md`; 8 known gaps). The
emulator logs register changes of three outputs every 1 ms: the **buzzer** (13 MHz / a 16-bit divider, enable bit, volume register MAD2
PUP 0x1E), the DSP **tone generator** (earpiece path; oscillator register / 4 Hz, a second
oscillator for DTMF, level word at 0x100A8) and the **vibrator**. Sound goldens assert those
events, never audio (the WAV is the emulator's synthesis and ignores both volume registers).
Plan 14's "tone previews are silent" holds only for the virgin EEPROM: its tone settings are
unset, which silences ringing previews and warning tones; the factory state (plan 15) sounds.

- **Keypad tones:** 900 Hz on the tone generator at every key-down, ≈143 ms (140-150) while the
  DSP is awake, ≈124 ms when the key wakes it (the DSP powers down ≈2966 ms after the last tone);
  a key-down during a beep extends it; held ▲/▼ beep at each auto-repeat, a held C at its long
  press. Level words 0x9108/0x9104/0x9100 for Level 1/2/3, Off silent, unset 0x9100. In the Keypad
  tones list ▲/▼'s beep plays the highlighted level. Digits, `*` and `#` at standby play DTMF
  pairs while held. The firmware's beep comes 12-103 ms after the key (not reproduced).
- **Ringing tone previews:** ▲/▼ in Ringing tone, Ringing volume or Message alert tone (Tones and
  each Personalise) plays the highlighted entry ≈991 ms after the key-down. The Ringing tone list
  plays to the tone's second cycle mark (two passes for most tones, less for the long ones), the
  Ringing volume list the stored tone to its first mark, message tones once; nothing loops. ▲/▼,
  C, OK and the power key stop a preview; opening a list or the first ▼ out of an unset list
  previews nothing; `(empty)` slots are silent.
- **Gating:** Ringing previews need an alert type that rings (Ringing, Ascending, Ring once); Beep
  once, Off and unset are silent. Alert type and volume come from the edited profile, the
  vibrator from the active profile's Vibrating alert. Message previews ignore the alert type.
- **Volume:** the buzzer register is a table per Ringing volume level and note frequency (Levels
  1-4 exactly); Level 5 starts at Level 4's table and jumps to a louder table at a tone-specific
  note; Ascending starts at Level 1 and steps up about every 4 s, capped at the stored level.
- **Message alert tones:** Standard 1499.9 Hz pulses, Special 2683.7 Hz pulse groups, Beep once a
  1750 Hz tone-generator beep (its level word set by Ringing volume) then three 480 ms vibrator
  pulses, Ascending the Special pattern stepping Level 1 → 4.
- **Warning tones** (On): `Invalid shortcut`, `No phone numbers`, `No voice tags saved`, `Screen
saver missing` play 1750 Hz on the tone generator (≈290 ms); `Code error`, `Not allowed`, `Set PIN
code request on` the buzzer at 1000 Hz (≈285 ms). Other notes are silent. The tone replaces the
  key's beep; Off silences that key.
- **Snake II:** meal 2636.9 Hz for one timer unit, crash three 15 ms 440 Hz pulses, a top score
  the fireworks tune (587/880 Hz, twice) 2045 ms after the crash, 21 ms before the death steps
  end; sound needs Warning tones and Sounds On, the ≈480 ms vibrator Shakes and Vibrating alert
  On. Keys on the game-over note make no beep (Navi and C there UNVERIFIED). The captured cues lag
  the session's by 47-54 ms (the New game redraw latency, not reproduced); intervals between cues
  match by the fidelity standard. Factory Games settings are On.
- **Power:** the power-on plays 900 Hz for 124 ms 2425 ms in (also with Keypad tones Off); the power
  key's long press plays it again and stops previews.

| Artefact                                                                       | Cause                                  | Handling                                             |
| ------------------------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------- |
| WAV timbre (low-passed square, sine tones, 3.4 ms envelope)                    | the emulator's synthesiser             | never asserted or imported                           |
| 1 ms states (`buzzer_on=1, hz=0`, stale frequency, mute word, vibrator glitch) | two-step register writes; 1 ms polling | dropped by the importer, counted under `omitted`     |
| key-to-beep latency 12-103 ms; tone lead over a note's redraw                  | firmware key scan and draw latency     | not reproduced                                       |
| edge jitter between passes (median 11 ms, ≤ 48 ms), second pass ≈1 % slower    | emulator timer and DSP power state     | compared by the fidelity standard                    |
| silent previews and warning tones in the virgin state                          | unset tone settings                    | the virgin initial state, asserted by virgin goldens |
| timer unit ≈7.745 ms                                                           | emulator timebase                      | durations as captured; UNVERIFIED on hardware        |
| game cues 47-54 ms after the session's (the New game redraw latency)           | firmware key scan and draw latency     | cues aligned on the first; intervals compared        |

**UNVERIFIED** (not captured; nokia-os makes a documented choice): loudness, since the emulator
renders neither volume register (the port carries the registers; a host maps them to gain); the
earpiece's timbre (the emulator renders the tone generator as a sine); Standard at Ringing volume
Levels 1-3 (1499.9 Hz was captured at Levels 4-5 only: the nearest captured frequency's
register); the message `Beep once` word at Levels 2-3 (stepped between Level 1's 0x9107 and Level
4's 0x9104) and with Ringing volume unset (Level 1's); the message Ascending at levels other than
4 (it plays as captured); an incoming call's ringing (`ring()`, plan 22) for the five tones whose
preview ends inside its first pass (it repeats what was captured), and Ring once and Beep once as
they ring; Navi and C on the game-over screens (silent like the other keys); the power key's
power-off tone at the kernel's 800 ms long press (≈1046 ms in the capture). **Not reproduced:**
the keypad beep of 77 ms when a key lands ≈70 ms before the DSP powers down (one capture), the
key-to-output latencies above, Beep once's beep 23 ms after the vibrator with Keypad tones Off
(1 ms in the other recordings) and one Level 5 recording of Get cool running ≈0.7 % slow (up to
57 ms behind by 8 s). DTMF at standby (`sound/keypad/keys`, `hold`) is plan 22's: digits
there beep 900 Hz until number entry exists, and the dialling tones need the event's second
oscillator (a contract extension then).
