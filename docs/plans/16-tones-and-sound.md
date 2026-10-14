# Plan 16 - Tones and sound

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 13, 14, 15 and 23 complete. Plan 15 Tasks 8-10 touch
`src/firmware/phone.ts`, `tests/support/rig.ts`, `tests/support/probes.ts`, the demo and the
README, which this plan edits too: do not start Task 1 before plan 15 is `done`.
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only). Read
`$REF/captures/README.md` (sections "Output format", "Plan 15 supplementary captures" and "Plan
23 supplementary captures"), plans 13, 14, 15 and 23 in full before starting. Task 0 writes this
plan's captures to `$REF/captures/6.39/plan16/`. The planning probes in
`$REF/captures/scratch-plan16/` are evidence for this plan only and are never imported.
**Status:** done.

## Goal

Give `@hellotimber/nokia-os` the stock v6.39 sound and vibration, as strictly as the captures
allow:

- a sound and vibration sequencer driven by the kernel clock, and a public host port that
  receives buzzer, tone-generator and vibrator state changes stamped with kernel time (the demo
  plays them through WebAudio and shows a vibration indicator; tests assert event timelines);
- keypad tones and their levels;
- warning tones on notes, and the game sounds and vibration that plan 23 emits as cues;
- the previews of Tones › Ringing tone (all 35 built-in tones), Ringing volume (its five levels),
  Incoming call alert (as far as it changes a preview) and Message alert tone, in Tones and in
  every profile's Personalise;
- the Vibrating alert as previews and game shakes use it;
- the programs later plans need to ring, alert and beep (incoming call, message arrival, alarm,
  reminders, the other games, the Composer), exposed internally.

The Composer moves to its own plan (D14). The website does not change.

## Why this plan exists (measured gap)

| Area                       | nokia-os after plans 13-15, 23                                    | Evidence (planning probes, `$REF/captures/scratch-plan16/`)                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sound output               | none; phone-core emits an id-only `sound` event on every key-down | the firmware drives a buzzer (13 MHz / divider, a volume register), a DSP tone generator (earpiece path) and a vibrator                                                                       |
| Keypad tones               | stored, silent                                                    | a 900 Hz DSP tone on every key-down, 120-150 ms; Off is silent; the three levels differ only in a DSP register (S2)                                                                           |
| Ringing tone list          | an option list, silent (plan 14: "previews are silent")           | silent only in the virgin EEPROM; in the factory state ▲/▼ previews the highlighted tone ≈950 ms after the key, looping, with the vibrator when Vibrating alert is On (S3, S9)                |
| Ringing volume, alert type | stored, silent                                                    | the volume list previews the ringing tone at the highlighted level; Ascending ramps the volume register; Beep once and Off silence ringing previews (S4, S5)                                  |
| Message alert tone         | stored, silent                                                    | previews play: Special is 2683.7 Hz pulses with the vibrator, Beep once a 1750 Hz DSP tone plus three vibrator pulses (S6)                                                                    |
| Notes                      | silent                                                            | with Warning tones On, `Invalid shortcut` sounds a 1750 Hz DSP tone and `Code error` a 1000 Hz buzzer tone, ≈290 ms each; `Done` confirmations are silent (S7)                                |
| Snake II                   | cues to a no-op sink (`NO_CUES`, plan 23 D8)                      | with Warning tones On a meal sounds 2637 Hz, the crash three 440 Hz beeps; the vibrator runs 480 ms with Shakes On (plan 23 Task 0 C10, `tests/fixtures/snake-cues.json`)                     |
| Composer (5-4-1…7)         | placeholders owned by 16                                          | a text editor with Options (Play, Save, Tempo, Send, Clear screen, Exit), a `Tone name:` text entry and 16 tempos (`docs/specs/nokia-3310-menu-tree.md` "Tones › Composer"); D14 moves it out |

## Sound investigation (planning, 2026-10-14)

Scratch scripts `probe-a.cap` … `probe-e.cap` (outputs `out-a` … `out-e`, logs `probe-*.log`) ran
on the virgin image (A, E) and on plan 15's factory-restored image
`firmware/work/v639-plan15-restored.fls` (B, C, D: Nokia tune, Level 4, Ringing, Standard,
Keypad tones Level 2, Warning tones On, Vibrating alert On). Probe B's sections B3-B5 and B8
navigated wrongly (they ran from a page, not standby) and are disregarded; probe D repeats them.

| #   | Source                                                                                                                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | the harness (`tools/harness/dct3cap.c` `audio_pump`) and the emulator (`src/web/main.c`, `src/mad2/emu_audio.c`, `mad2_bus.c`) | `audio <name>` writes `<name>.wav` and `<name>.events.csv`. The WAV (16-bit mono 48 kHz) is the emulator's own synthesis: the buzzer as a square through two one-pole low-passes, DSP tones as sines, a ≈3.4 ms attack and release, and **both volume registers ignored**. The events file (`t_ms,dsp_tone1_hz,dsp_tone2_hz,buzzer_on,buzzer_hz,vibra`) gets a row whenever one of them changes, polled after every 1 ms grain. Buzzer Hz = 13 MHz / the 16-bit divider (MAD2 PUP 0x1C/0x1D), on = PUP 0x15 bit 5, vibrator = bit 4; DSP Hz = oscillator register / 4, gated by the amplitude word at 0x100B6. **Not logged:** the buzzer volume (PUP 0x1E; RAM-backed, `peek 0x2001E`) and the DSP level. |
| S2  | keypad (`out-a/a1`, `out-b/b1`, `out-d/d4`)                                                                                    | Every key-down (held or tapped) sounds the DSP tone at 900 Hz, 25-43 ms after the edge. Durations fall in two groups: 120-124 ms (82 of 185 beeps, mostly ▲/▼ in Tones option lists) and 140-150 ms. Keypad tones Off: no tone. Levels 1, 2 and 3 log identical events; the DSP word at 0x100A8 reads 0x9108, 0x9104 and 0x9100 (Off: 0x900F).                                                                                                                                                                                                                                                                                                                                                             |
| S3  | Ringing tone list, factory (`out-b/b2`, `out-c/c2`…`c4`, `out-d/d1`)                                                           | ▲/▼ previews the highlighted tone on the buzzer 945-968 ms after the key's beep starts, and loops until the list is left (Croak repeats every 3763 ms, Nokia tune every 6016-6017 ms, gap included). Nokia tune: 1319, 1175, 740, 831, 1109, 988, 587, 659, 988, 880, 554, 659, 880 Hz, 115-116 or 240 ms per note, edges within ±1 ms from loop to loop. With Vibrating alert On the vibrator runs ≈712 ms on/off while the tone plays. `peek 0x2001E` during previews reads values that change within one tone and with the level.                                                                                                                                                                       |
| S4  | Ringing volume list (`out-d/d1`)                                                                                               | ▲/▼ previews the stored ringing tone at the highlighted level (peeks 0x0B, 0x07, 0x04, 0x10 for Levels 3, 2, 1, 5). Level 5 previews when highlighted, before its confirm query.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| S5  | Incoming call alert (`out-c/c4`…`c6`, `out-d/d2`)                                                                              | The list itself previews nothing. With Ascending the ringing tone preview's volume register rises across loops (peeks 0x05, 0x03, 0x03, 0x05, 0x06 over 15 s). With Beep once or Off, Ringing tone previews are silent and the vibrator stays off.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| S6  | Message alert tone (`out-c/c7`)                                                                                                | ▲/▼ previews: Special is 2683.7 Hz (13 MHz / 4844) pulses of 93 ms in three groups, with the vibrator; Beep once is the DSP tone at 1750 Hz for 286 ms, then three 480 ms vibrator pulses. OK on a choice plays nothing (its `Done` is silent).                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| S7  | notes with Warning tones On (`out-b/b7`, `out-e`)                                                                              | `Invalid shortcut`: DSP 1750 Hz ≈290 ms, starting ≈39 ms before the note is drawn. `Code error` (in a menu): buzzer 1000 Hz, 285-294 ms. `Done` after choosing Warning tones, Ringing volume, Incoming call alert or Vibrating alert: silent. With Warning tones Off (`out-d/d5`) both error notes are silent.                                                                                                                                                                                                                                                                                                                                                                                             |
| S8  | Vibrating alert list (`out-d/d3`)                                                                                              | Choosing On or Off pulses nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| S9  | virgin (`out-a`, `out-e`)                                                                                                      | Every preview is silent while Ringing volume and Incoming call alert are unset (the virgin EEPROM). After choosing Level 3 and Ringing, the Ringing tone list previews; in that run the first ▼ out of the unset list started no preview and the second did. Warning tones On then sounds `Invalid shortcut` too.                                                                                                                                                                                                                                                                                                                                                                                          |
| S10 | `6.39/boot-clean/power-on.events.csv` (plan 15)                                                                                | a 900 Hz beep 2417 ms into the gate-free power-on (the power key still held, or a boot tone; Task 0 decides).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Conclusions:

1. **What is evidence.** The events file is a register-level trace of the three outputs at 1 ms
   resolution: exact frequencies (from the divider), exact on/off edges, and the vibrator. The
   WAV is a rendering by the emulator's synthesiser and carries nothing the events lack, except
   that it ignores volume. Volume exists only as registers the harness does not log yet; Task 0
   adds two columns (D2).
2. **The virgin EEPROM is nearly silent.** Ringing tone, Ringing volume, Incoming call alert,
   Keypad tones, Warning tones and Vibrating alert are unset there (plan 14 D10), which silences
   previews, warning tones and the vibrator. The factory state (plan 15 D5) is the state with
   sound, so the sound captures run on plan 15's factory-restored image (D7).
3. **Previews are a firmware behaviour of three option lists,** with a delay, a loop and gating
   by alert type and volume; the incoming call, the message arrival and the alarm that ring the
   same tones belong to plans 22, 18 and 21 (D11).

## Scope and non-goals

In scope: the Goal items; the harness change and captures of Task 0; the sound golden pipeline;
generated sound programs; the sequencer and the host port; the demo's WebAudio player and
vibration indicator; documentation.

Deliberately left to later plans (each recorded in "Follow-up plan adjustments"):

- **Composer** (5-4-1…7) → a new plan 27 (D14).
- **Ringing for an incoming call** (alert types in full: `Ring once`, `Beep once` and `Ascending`
  as they ring) → plan 22, which owns calls; plan 16 measures and exposes the programs.
- **Message arrival alert** → plan 18; **alarm clock and reminder alarms** → plan 21; **profile
  switching** (Silent muting through the alias) → plan 17; **Space impact, Bantumi and Pairs II
  sounds** → plan 24; **DTMF** while dialling → plan 22.
- **Acoustic loudness.** The emulator renders neither volume register; how loud a register value
  is on the hardware is not captured (Open question 2).

## Decisions

Each decision states what changes relative to the brief and to plans 13-15 and 23.

**D1 - Sound is verified as event timelines, never as audio waveforms (new).** A sound golden is
the captured sequence of output changes: buzzer on/off, frequency and volume register; the tone
generator's frequency and level; the vibrator. Waveforms are not asserted and the WAV is never
imported: it is the emulator's synthesis (S1), not firmware output, and it ignores volume. The
`.wav` files stay in REF as a listening reference.

**D2 - The harness logs both volume registers (new; harness-only change in Task 0).** The events
file gains `buzzer_vol` (MAD2 PUP 0x1E, read with the emulator's existing `dct3_web_buzzer_vol`)
and `dsp_level` (the DSP word that S2 found at 0x100A8, read by a helper appended in
`tools/harness/build.sh` as plan 15 appended `peek`), and a change of either writes a row. The
emulator's sources are not modified. Task 0 first confirms that 0x100A8 is the tone generator's
level (the keypad levels, the message `Beep once`, `Invalid shortcut`); if another register is,
log that one and record a Deviation.

_After Task 0 (D2 confirmed):_ 0x100A8 is the tone generator's level word, so `dsp_level` logs
it; `buzzer_vol` is decimal and `dsp_level` hex in the events file, and the sound goldens keep
those notations.

**D3 - Sound assets are reproductions derived from captured events (the brief's question).** The
policy of plans 13-23 applies unchanged: an importer turns REF captures into committed text
fixtures (`goldens/sound/**/*.sound.txt`, D6), and `extract-resources` derives the sound programs
from those fixtures (`src/resources/generated/sounds.ts`). Ringing tones are reconstructed from
their own captured buzzer events: each tone's notes (frequency and duration), volume register
steps, rests, vibrator track and loop come from a recording of its preview, never from the
extracted tone tables. `$REF/extracted/6.39/tones` (35 ringing tones, 61 system sounds) is read
only to cross-check counts and note frequencies, and its RE opcode reading (for example a
per-phrase volume change) only shapes captures and hypotheses, exactly as plan 23 D3 used the RE
notes. Justification: the extraction guessed the tempo unit and six control codes; the events are
the firmware's own register writes, and a golden checked against them cannot inherit a decoding
error. Nothing in `website/src/phone/{audio,composer,tones}.ts` is reused (its notation and
frequencies are hand-written approximations).

**D4 - A public host sound port; nokia-os never touches audio APIs (new; contract change).**
`StockPhoneConfig.sound?: StockSoundPort` receives every change of the three outputs as a
`StockSoundEvent` stamped with the kernel time it happens at. Events are emitted from the phone's
`tick()` once kernel time reaches them (a coarse tick emits several, each with its own `atMs`), so
the output is identical at any tick rate and a host can schedule each event at
`audioNow + (atMs - phoneNow) + latency`. phone-core's id-only `PhoneEventMap.sound` stays the
website's contract and nokia-os does not use it (Conflicts: plan 23 D8 said the sink would be
wired to it). phone-core does not change.

**D5 - One sequencer per phone, three outputs, programs as data (new).** `SoundSequencer` (pure)
plays `SoundProgram`s: lists of steps that set the buzzer, the tone generator and the vibrator for
a duration, with an optional loop span. Each output plays one program at a time; a new program on
an output replaces the old one there (a keypad beep does not stop a ringing preview: they use the
tone generator and the buzzer). `StockSounder` (internal, per phone) wraps it with the settings:
it plays keypad beeps, previews, note tones and game cues, applies volume and gating, and stops
everything at power-off (the vibrator included). Widgets reach it through `LeafBinder`, as they
reach the settings and the security code.

**D6 - Sound goldens: one text format, aligned on the trigger key (new; extends plan 13 D7).**
`sound-golden 1` (see "Golden pipeline additions") lists output changes as rows `t_ms output
state`, with integer milliseconds relative to the recording's first key-down. The key-downs come
from the recording's `keys.csv` and appear in the header. Harness artefacts are normalised by the
importer and counted under `omitted`: a 1 ms `buzzer_on=1, hz=0` row while the firmware rewrites
the divider, and a 1 ms row with the old frequency when a note change and a vibrator edge land in
the same grain.

_After Task 0 (Deviation D6):_ normalisation drops every output state held for one 1 ms grain
or less (a two-step register write), each counted under `omitted` by reason: `divider rewrite`
(buzzer on at 0 Hz), `stale frequency` (a new volume or frequency before the other), `buzzer gap`,
`tone gap`, `level rewrite` (the tone's mute word written a grain before it stops) and `vibrator
glitch`. Held keys carry their hold in `keys` (`4241:c+1500`, keys held over 200 ms), and the tone
generator's state may name its second oscillator (`1209+697 v=0x9104`, DTMF at standby). `@loop
<start> <period>` marks the tone's cycle: the rows from `start` repeat with `period`, and the last
pass may stop early (previews end at a cycle mark, they do not loop); edges of a later pass may
drift by 25 ms plus 1.2 % of their offset (Task 0: a median 11 ms, ≤ 48 ms between passes). ±2 ms
holds within a recording's own pass only, which is what a program rebuilt from that pass replays.

**D7 - Sound goldens record the factory state; the virgin state is asserted silent (new; refines
plan 15 D4).** Empty storage stays the virgin EEPROM (plan 15 D4), but the sound captures run on
plan 15's factory-restored image, and their scenarios seed storage with the factory state
(`seededStorage({ factory: true })`, which runs `restoreFactory()`; the security code and welcome
note are irrelevant to sound). A few virgin recordings are asserted too: silent previews, the
keypad beep at the unset level, `Invalid shortcut` after Warning tones On. Every golden header
names its `state`.

_After Task 0 (D7 confirmed, refined):_ the virgin state is silent for ringing previews
(Incoming call alert unset), plays message previews at Level 1 without the vibrator, beeps keys at
the DSP word 0x9100 (Level 3's) and sounds warning tones once Warning tones is On. An unset Ringing
volume plays Level 1's table.

**D8 - Keypad tones are the tone generator on key-down (corrects spec §8).** Every key-down while
the phone is on sounds 900 Hz at the level of `tones/keypad-tones` (Off: nothing), for the
duration Task 0 measures; Task 0 also explains the two duration groups of S2 (provisionally: a
▲/▼ that arms a preview cuts its beep to ≈124 ms) and the virgin unset level. The firmware's
25-43 ms key-scan latency is not reproduced, as plan 14 D8 and plan 23 D6 decided for screens:
nokia-os beeps at the key-down. Game keys beep too (plan 23: "900 Hz beeps on every key").

_After Task 0 (Deviation D8):_ the two duration groups are the DSP's power state, not the
lists: a beep lasts ≈143 ms (140-150) while the DSP is awake and ≈124 ms (123-139) when the key
wakes it; the DSP powers down ≈2966 ms after the last tone generator output ends. A key-down while a
beep sounds extends it to that key's end. Held ▲/▼ beep again at each auto-repeat and a held C at
its long press. In the Keypad tones list, ▲/▼'s own beep plays at the highlighted level (Off:
silent). An error note's tone replaces its key's beep (D12). Digits, `*` and `#` at standby play
DTMF pairs while held: number entry is plan 22's, so plan 16 beeps 900 Hz everywhere nokia-os has
screens today and records DTMF in `sound/keypad/keys` (pending:22). The capture's key-to-beep
latency (awake median 28 ms, woken median 51 ms) is not reproduced.

**D9 - Previews are a property of three option lists (new).** Ringing tone, Ringing volume and
Message alert tone lists, in Tones and in each profile's Personalise, preview the highlighted
entry when ▲/▼ moves the selection, after `PREVIEW_DELAY_MS` (provisionally 950 ms after the
key-down; Task 0 fixes it). A ringing preview loops until the selection moves again, the list is
left (C, OK, Quit) or the phone powers off; a message preview plays once (Task 0 confirms). The
preview reads the settings of the profile the list belongs to (Tones = General through
`settingAlias`): ringing previews need an alert type that rings (Ringing, Ascending, Ring once:
Task 0) and a set volume; the vibrator runs with that profile's Vibrating alert On. Incoming call
alert, Keypad tones, Warning tones and Vibrating alert lists preview nothing (S5, S8). Opening a
list previews nothing. The S9 first-▼ quirk is reproduced only if Task 0 confirms it.

_After Task 0 (Deviation D9):_ `PREVIEW_DELAY_MS` = 991 (985-1014 from the key-down; message
tones ≈1006, 1002-1010). Previews do not loop: the Ringing tone list plays the tone up to its second
cycle mark (two passes for 21 tones, a cut second pass for 9, inside the first pass for 14, 15, 23,
24, 33); the Ringing volume list plays the stored tone to its first mark; message tones play once.
A preview's alert type and volume come from the profile whose list it is, its vibrator from the
active profile's Vibrating alert. The S9 quirk is real: the first ▼ out of an unset list arms no
preview. Opening a list, the Incoming call alert list and choosing a value preview nothing.

**D10 - Volume levels and Ascending are a rule fitted to captures (new; plan 23 D4's
standard).** Each ringing tone's program stores its own volume steps at one level (Level 4, the
factory value). A rule maps a level to the register (provisionally a base per level plus each
step's offset). The rule is accepted only if it reproduces every Task 0 recording at every level
(35 tones × 5 levels, checked by `gen_v639_plan16.py check` in REF, and by the committed level
goldens); otherwise each level is its own captured program (Deviation, larger fixtures). Ascending
is fitted the same way from its recordings (its start level, its step per loop, its cap).

_After Task 0 (Deviation D10):_ the register is a table per level and note frequency (45
frequencies; Levels 1-4 reproduce every recording of all 35 tones, the last note aside where the
preview's stop races it). Level 5 plays Level 4's table, then jumps once to a fifth table at a
tone-specific time; Ascending starts at Level 1 and steps one level about every 4 s at
tone-specific times, capped at the stored level. Neither point follows a rule visible in the
captures, so both are stored per tone: the importer commits the Level 5 and the Ascending previews
of all 35 tones, Levels 1-3 of eight tones that cover every frequency (`check` verifies the rest in
REF), and `VOLUME_RULE` is the five tables plus the per-tone jump and step times.

**D11 - Alert types "as far as previews go" (the brief's scope).** Plan 16 reproduces what the
alert type does to previews (S5) and stores the programs and rules an incoming call needs
(ringing tone, level, Ascending ramp, vibrator, and `Ring once`/`Beep once` as captured from their
previews, if any). The incoming-call screen, its ringing and its alert-type behaviour are plan
22's; the message arrival alert is plan 18's. `StockSounder` exposes `ring(profile)` and
`messageAlert(profile)` for them, tested only as programs and gating.

_After Task 0 (D11 refined):_ Ring once previews like Ringing; Beep once and Off silence
ringing previews. The message `Beep once` is the tone generator at a DSP word set by Ringing volume
(Level 1 0x9107, Level 4 0x9104, Level 5 0x9100; Levels 2 and 3 not captured).

**D12 - Warning tones belong to notes, by note text (new).** With `tones/warning-tones` On, a
timed note sounds the program captured for its text (`NOTE_SOUNDS`, generated from the note
goldens: `Code error` → buzzer 1000 Hz, `Invalid shortcut` → tone 1750 Hz, and whatever Task 0
records for every other note). A note with no captured sound is silent; confirmations (`Done`,
`... saved`, `... selected`) are silent unless Task 0 shows otherwise. The sound starts with the
note's first frame: the firmware's lead of the tone over its redraw (≈39 ms, S7) is not
reproduced, because nokia-os draws at the key (plan 14 D8). The power-on security gate's `Code
error` follows the same rule with the active profile's Warning tones.

_After Task 0 (Deviation D12):_ with Warning tones On, `Invalid shortcut`, `No phone numbers`,
`No voice tags saved` and `Screen saver missing` sound 1750 Hz on the tone generator (0x9105,
≈290 ms), and `Code error`, `Not allowed` and `Set PIN code request on` the buzzer at 1000 Hz (v=22,
≈285 ms); every other note is silent. The tone replaces the triggering key's beep, a key pressed on
the note sounds it again, and with Warning tones Off the triggering key is silent.

**D13 - Game cues become sounds (completes plan 23 D8).** `StockCue`s from the Snake II session
go to the phone's sounder instead of `NO_CUES`: `eat` and `crash` play their captured programs
when Warning tones is On and Games › Settings › Sounds allows it, `vibrate` runs the vibrator for
its `ms` when Shakes and Vibrating alert allow it (Task 0 decides the matrix), and `top-score`
plays what Task 0 captures (it was UNVERIFIED). The cue edges keep plan 23's tolerance
(`GAME_TICK_TOLERANCE_MS`). `tests/fixtures/snake-cues.json` and `scripts/snake-cues.ts` are
superseded by sound goldens and deleted (subtract).

_After Task 0 (D13 decided):_ sound needs Warning tones On and Games › Settings › Sounds On; the
vibrator needs Shakes On and Vibrating alert On. Meal: 2636.9 Hz for 6-7 ms (v=6); crash: three
15 ms 440 Hz pulses (v=3) with ≈480 ms of vibrator; top score: the fireworks tune (587/880 Hz, v=3)
≈2 s after the crash, emitted where plan 23's `top-score` cue fires. The factory Games settings are
On (plan 15's factory table read Off). The power-on tone (900 Hz, 0x9105, 124 ms at 2425 ms) is a
boot tone, not the power key (S10); the power key's long press plays the same tone and stops
previews.

**D14 - The Composer is deferred to its own plan 27 (the brief's alternative, justified).** The
Composer is an editor (note entry with eight key roles and a held-key dot, cursor movement, the
notation drawn in stock fonts that lack `#` today), an Options menu of six entries, a 16-entry
Tempo list, `Tone name:` text entry (plan 18's widget), a Send flow (plan 18's messaging), and
saved tones joining the Ringing tone list's seven `(empty)` slots; each needs its own captures and
goldens, about as many as this plan. Its sound is one more program for plan 16's sequencer (notes
from pitch, duration and tempo), so plan 27 needs nothing from plan 16 beyond
`StockSounder.play`. Plan 16 re-owns the `5-4-*` placeholders to `27` (as plan 15 D12 re-owned
6-2-3), so no golden stays `pending:16`. Task 1 adds row 27 to the plans README (Composer; depends
on 16 and 18). Reverse by folding plan 27's tasks in after Task 9.

**D15 - The website does not change.** `git diff --stat <commit before Task 1> -- website/` is
empty at the end. `website/src/phone/audio.ts` keeps its 1800 Hz square key beep; the contrast is
recorded in the spec, not fixed.

## Ground truth and artefacts

| Source (`$REF/captures/`)                                  | Contents                                                                                               | Use                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `scratch-plan16/` (planning)                               | probes A-E (S1-S10)                                                                                    | evidence for the decisions; never imported                |
| `6.39/plan16/` (Task 0)                                    | every sound recording below, with `.events.csv` (v2 columns), `keys.csv`, `.wav` and LCD `record` dirs | `sound/*` goldens                                         |
| `6.39/plan23/sound/` (existing)                            | Snake II with Warning tones On, Sounds Off, Shakes Off/On (v1 events: no volume columns)               | superseded by Task 0's G section (re-recorded with v2)    |
| `6.39/boot-clean/power-on.events.csv` (existing)           | the gate-free power-on with a 900 Hz beep at 2417 ms                                                   | superseded by Task 0's B section                          |
| `firmware/work/v639-plan15-restored.fls` (plan 15 Task 0c) | the factory-restored v6.39 image (re-provisioned security code)                                        | the image of every factory-state section                  |
| `extracted/6.39/tones/` (index, 35 tones, 61 sounds)       | RE-decoded tone tables and renders                                                                     | cross-check only (counts, frequencies); never copied (D3) |
| `tools/nokia-dct3-emulator/` (read only)                   | the emulator: register semantics of S1                                                                 | documentation of the event columns                        |

Artefacts (added to the spec §10 artefact table in Task 1):

| Artefact                                                        | Cause                                                      | Handling                                                                |
| --------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| WAV timbre (low-passed square, sine tones, 3.4 ms envelope)     | the emulator's synthesiser, not the phone                  | never asserted or imported (D1)                                         |
| 1 ms `buzzer_on=1, hz=0` rows; 1 ms stale-frequency rows        | the firmware writes the divider in two bytes; 1 ms polling | normalised by the importer, counted under `omitted` (D6)                |
| Key-to-beep latency 25-43 ms                                    | firmware key scan                                          | not reproduced (D8)                                                     |
| Tone lead over the note's redraw (≈39 ms)                       | firmware draw latency                                      | not reproduced (D12)                                                    |
| Silent previews, warning tones and vibrator in the virgin state | unset tone settings in the virgin EEPROM                   | the virgin initial state (plan 14 D10); asserted by virgin goldens (D7) |
| Timer unit ≈7.745 ms (plan 23)                                  | emulator timebase                                          | note durations reproduced as captured; UNVERIFIED on hardware           |

## Package boundaries

Unchanged from plans 13-15 and 23. nokia-os gains no dependency and touches no audio API: the
demo (dev-only) owns WebAudio and the vibration indicator. phone-core does not change. Scripts
keep plan 13's conventions (Node type stripping, `node:*` and sibling imports only).

## Contract changes

Task 1 writes these into `VISION.md`. Field names are provisional until Task 0 identifies the
DSP level register; Task 1 fixes them and a change is a Deviation here.

### `@hellotimber/nokia-os` (additive)

```ts
/**
 * Plan 16: one change of the phone's sound outputs at kernel time `atMs`. `volume` is the
 * firmware's level register as captured: buzzer, MAD2 PUP 0x1E (0-194 seen; higher is louder);
 * tone, the DSP tone-level word at 0x100A8 (e.g. 0x9108/0x9104/0x9100 for Keypad tones Level
 * 1/2/3; a lower low nibble is louder). Hosts map it to gain (loudness is not captured).
 */
export type StockSoundEvent =
  | {
      readonly output: "buzzer" | "tone";
      readonly atMs: number;
      readonly hz: number; // > 0: sounding at this frequency (buzzer: 13 MHz / divider)
      readonly volume: number;
    }
  | { readonly output: "buzzer" | "tone"; readonly atMs: number; readonly hz: null } // silent
  | { readonly output: "vibrator"; readonly atMs: number; readonly on: boolean };

/** Plan 16: where the phone's sound goes. Events arrive in `atMs` order from `tick()`. */
export interface StockSoundPort {
  change(event: StockSoundEvent): void;
}

export interface StockPhoneConfig {
  // ...plan 13/15 fields unchanged...
  /** Plan 16: the phone's buzzer, tone generator and vibrator. Default: nowhere. */
  sound?: StockSoundPort;
}
```

_After Task 0:_ the field names stand; `volume` is defined per output as above (Task 1). DTMF
(the tone generator's second oscillator, digits at standby) needs a second frequency: plan 22
extends the event then.

Rules (Task 5 pins each with a test): every event has `atMs` ≤ the kernel time of the `tick()`
that emits it and ≥ the previous event's; an output's consecutive events always differ (no
duplicate state); power-off emits `hz: null` for both outputs and `on: false` for the vibrator if
they were active; a host that passes no port gets the same phone behaviour. `stockMenu`,
`paintStockScreen`, `missingStockGlyphs` and the storage API are unchanged.

## Sound API for later plans (internal)

Plans 17, 18, 21, 22, 24 and 27 consume these from `src/sound/`. Signatures are fixed by Tasks
4-5; a change is a Deviation recorded here.

```ts
// src/sound/program.ts
export interface SoundStep {
  readonly ms: number; // positive integer
  readonly buzzer?: { readonly hz: number; readonly volume: number } | null; // undefined = unchanged
  readonly tone?: { readonly hz: number; readonly volume: number } | null;
  readonly vibrator?: boolean;
}
export interface SoundProgram {
  readonly id: string;
  readonly steps: readonly SoundStep[];
  readonly loopFrom?: number; // step index the program repeats from; absent = plays once
}

// src/sound/sequencer.ts (pure)
export type SoundOutput = "buzzer" | "tone" | "vibrator";
export interface SoundVolume {
  readonly changesAtMs: readonly number[]; // where a sounding note re-reads its volume
  of(output: "buzzer" | "tone", hz: number, stored: number, offsetMs: number): number;
}
export class SoundSequencer {
  constructor(emit: (event: StockSoundEvent) => void);
  /** Starts `program` at `atMs` on the outputs it uses, replacing what played there. */
  play(
    program: SoundProgram,
    atMs: number,
    options?: { volume?: SoundVolume; endStep?: number },
  ): SoundPlay;
  stop(outputs: readonly SoundOutput[], atMs: number): void;
  cancel(play: SoundPlay, atMs: number): void; // a play not started by atMs never sounds
  playing(play: SoundPlay): boolean;
  last(output: SoundOutput): StockSoundEvent | undefined;
  advance(nowMs: number): void; // emits every change due up to nowMs
}

// src/sound/sounder.ts (per phone; settings-aware). `prefix` is a profile's settings prefix:
// `tones` (the active profile, through `settingAlias`) or `profiles/<profile>/personalise`.
export class StockSounder implements StockCueSink {
  constructor(sequencer: SoundSequencer, settings: StockSettings, now: () => number);
  keyDown(key: PhoneKey, options?: { beeps?: boolean; holdBeeps?: boolean }): void; // D8
  keyUp(key: PhoneKey): void;
  keyBeepLevel(option: number | null): void; // the Keypad tones list's highlighted level
  tick(): void; // held-key beeps due by now
  powerOn(options: { boot: boolean }): void;
  powerOff(): void;
  preview(list: PreviewList, index: number, prefix: string): void; // D9
  stopPreview(): void;
  note(lines: readonly string[]): void; // D12
  cue(cue: StockCue, atMs: number): void; // D13 (Task 8)
  play(program: SoundProgram): SoundPlay; // plan 27 (Composer)
  ring(prefix: string): SoundPlay | undefined; // D11, for plan 22
  messageAlert(prefix: string): SoundPlay | undefined; // D11, for plan 18
}
```

_After Tasks 4-7 (Deviation):_ the signatures above are the shipped ones (see the Task 4-6
deviations for why `volume` is a `SoundVolume`, why plays have handles and why the sounder takes
keys, ticks and power).

Setting keys read (all through `settingAlias`, so plan 17's active profile needs no change here):
`tones/keypad-tones`, `tones/warning-tones`, `tones/vibrating-alert`, and for a list at
`<prefix>/<setting>` its siblings `<prefix>/ringing-tone`, `<prefix>/ringing-volume`,
`<prefix>/incoming-call-alert`, `<prefix>/message-alert-tone`, `<prefix>/vibrating-alert`
(`<prefix>` = `tones` or `profiles/<profile>/personalise`); `games/settings/sounds`,
`games/settings/shakes`. Plan 16 adds no settings key and no EEPROM record.

## Golden pipeline additions

### Sound golden format (`scripts/sound-format.ts`, new; `*.sound.txt`)

```text
sound-golden 1
id: sound/ringing-tone/13-nokia-tune
status: asserted
source: captures/6.39/plan16/ringing-tone/13
source-sha256: …   (sha256 over events.csv then keys.csv)
state: factory
keys: 0:down
note: Tones › Ringing tone opened on Croak; ▼ to Nokia tune; two passes of its preview.
omitted: 2 (divider rewrite), 1 (stale frequency)

@events
# t_ms output   state
0      tone     900 v=0x9104
124    tone     off
946    buzzer   1319 v=14
946    vibrator on
1061   buzzer   1175 v=14
…
@loop 946 6016
```

Rules, enforced with `file:line` errors as for LCD goldens:

- Header keys in this order: `id`, `status`, `source`, `source-sha256`, `state` (`virgin` |
  `factory` | a REF image name), optional `keys` (space-separated `<t_ms>:<key>` key-downs, phone
  key names, ascending), optional `note`, `omitted` (`none` or `<count> (<reason>)` items).
- `t_ms` is an integer, non-decreasing; time 0 is the first key-down, or the recording's start
  when `keys` is absent (times may then not be negative).
- `output` is `buzzer`, `tone` or `vibrator`. State: `off`, `on` (vibrator only), or
  `<hz> v=<volume>` where `<hz>` has at most one decimal (13 MHz / divider, rounded) and `<volume>`
  is the logged register as captured (decimal or `0x` hex as its column gives it). Within one
  output, consecutive rows differ.
- Optional `@loop <start_ms> <period_ms>`: the rows from `start_ms` repeat with that period at
  least twice in the recording (the importer checks, D10).
- A golden with no `@events` rows is a silent golden (its scenario asserts silence).

### Capture set (`scripts/sound-capture-set.ts`, new)

An explicit table, executed by `import-captures` (which writes `goldens/sound/**` and index entries
of kind `sound`). Ids, sources under `$REF/captures/6.39/plan16/`, all `asserted` unless noted:

| Fixture id(s)                                                     | Source                      | Asserts                                                               |
| ----------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------- |
| `sound/keypad/level-{off,1,2,3}`, `sound/keypad/virgin`           | `keypad/levels/*`           | the beep per level; Off silent; the virgin unset level                |
| `sound/keypad/keys`, `sound/keypad/hold`, `sound/keypad/list`     | `keypad/keys`, …            | every key at standby, held keys, ▲/▼ in a Tones list (the short beep) |
| `sound/ringing-tone/<nn>-<slug>` (×35)                            | `ringing-tone/<nn>`         | each tone's preview at Level 4, vibrator On, ≥ 2 passes (`@loop`)     |
| `sound/ringing-tone/empty`                                        | `ringing-tone/36`           | an `(empty)` slot previews nothing                                    |
| `sound/ringing-volume/level-<n>` (×5)                             | `ringing-volume/<n>`        | Nokia tune at each level from the Ringing volume list (D10)           |
| `sound/ringing-tone/level-{1,5}-<slug>` (×2 tones)                | `levels/<n>/<nn>`           | the level rule on two more tones                                      |
| `sound/alert/{ascending-l1,ascending-l4,ring-once,beep-once,off}` | `alert/*`                   | what each alert type does to the preview (D9, D10, D11)               |
| `sound/vibrator/{off,choose}`                                     | `vibrator/*`                | Nokia tune with Vibrating alert Off; choosing On/Off pulses nothing   |
| `sound/message-tone/{standard,special,beep-once,ascending}`       | `message-tone/*`            | each message alert preview (Level 4), and `special-l1`                |
| `sound/profile/<profile>/{ringing-tone,message-tone}`             | `profile/*`                 | previews in Silent, Discreet and Loud (D9)                            |
| `sound/preview/{virgin,first-down,stop-key,stop-c,ok,rapid}`      | `preview/*`                 | gating, the S9 quirk, what stops a preview, a fast ▼▼▼▼               |
| `sound/note/<number>` and `sound/note/<name>`                     | `notes/<number>`, `notes/*` | every timed note's sound with Warning tones On, silent ones included  |
| `sound/note/warning-off`                                          | `notes/warning-off`         | Warning tones Off silences error notes                                |
| `sound/game/snake-{meal,crash,top-score,sounds-off,shakes-*}`     | `game/*`                    | Snake II cues (D13)                                                   |
| `sound/boot/{power-on,power-off}`                                 | `boot/*`                    | the power key's beep during boot (S10); power-off silences a preview  |

_After Task 0 (Deviation, the table Task 2 implements):_ ids are `sound/<recording path>` with
`<nn>-<slug>` for tones. Ringing tones carry `@loop` where a second pass starts (30 of 35).
`sound/ringing-tone/level-<1,2,3>/<nn>-<slug>` for the eight tones that cover all 45 frequencies (8,
11, 14, 15, 16, 24, 27, 35) and `level-5/<nn>-<slug>` for all 35 (D10); `sound/alert/ascending/<nn>-
<slug>` for all 35 (`alert/ascending-tones/`); `sound/ringing-volume/tone/<nn>-<slug>` for all 35
(the volume list's first-mark preview of each stored tone); `ringing-tone/37`-`42` equal 36 and are
not imported. Added recordings keep their path as id: `keypad/{pair,levels-list,virgin-list}`,
`alert/ascending-l5`, `alert/list`, `message-tone/{standard-l5,vib-off-*,alert-off-special,beep-once-*}`,
`profile/general/*`, `profile/active/*`, `preview/{stop-up,rapid-500,delay-sweep,long,volume-stop-c,open,first-down-back,virgin-*}`,
`notes/{invalid-shortcut-key,invalid-shortcut-keypad-l3,gate-code-error}`, `game/{top-score-page,keys,warning-off}`,
`boot/{power-on-keypad-off,power-key}`. Status: `keypad/keys` and `keypad/hold` are pending:22 (DTMF at
standby), `boot/power-key` pending:17 (the power-key profile list), a note of a placeholder leaf
pending on its owner; the rest asserted.

Every Task 0 recording becomes one golden, except `levels/<n>/<nn>` beyond the two committed tones
(REF-side rule check only, listed in `NOT_IMPORTED` with the reason). Notes whose recordings are
equal (same rows within ±2 ms after alignment) share one golden whose `note:` lists the node
numbers, as plan 14 S4 shared LCD goldens.

### Scenarios and the coverage guard

`tests/support/sound.ts` (new) provides `recordSound(rig, durationMs, trigger?)`, which collects
the port's events while the rig runs, and `expectSoundTimeline(recorded, golden, context)`, which
prints one row per golden row with the actual time, Δ and state, marks failures, and reports extra
events (the `Timeline mismatch` style of plan 13). Comparison (D6, D8, D12):

- the rig presses the golden's first key at time 0, later keys at their `keys` times (D8: the
  firmware's beep onsets are its key times, and nokia-os beeps at the key);
- an event that starts a program (a preview, a note tone, a cue) matches within
  `SOUND_ONSET_TOLERANCE_MS` (provisionally 25 ms, as plan 14's `PROBE_TOLERANCE_MS`; Task 0
  fixes it from the spread of preview delays and note leads);
- the events after it within the same program match within ±2 ms of the program's own start;
  frequencies and volumes match exactly;
- the keypad beep's end matches within the spread Task 0 measures for its duration group;
- game cues use `GAME_TICK_TOLERANCE_MS` (plan 23 D6).

_After Task 0 (measured):_ preview onsets fall 985-1014 ms after the key-down, so
`SOUND_ONSET_TOLERANCE_MS` = 25 around 991 holds; note tones start 25-45 ms after their key in the
captures (the lead over the redraw included) and keypad beeps 12-103 ms after it, a latency
nokia-os does not reproduce, so beep and note onsets are compared against the key-down with that
window. Edges of a program's captured pass replay exactly; a later pass of the same recording
matches within 25 ms plus 1.2 % of its offset (D6 deviation).

`tests/acceptance.test.ts` reads `index.json` entries of kind `sound` and requires a scenario for
each asserted one (`SOUND_SCENARIOS`), as for LCD goldens.

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` and the named test commands.
- Commit rule: run `mise exec -- vp check --fix` yourself, stage files by explicit path, then
  `git commit --no-verify -m "<message>"`. Never `git add -A`/`git add .`. Never stage
  `TODOS.md` (Lachlan's untracked notes).
- Never hand-edit `goldens/**`, `src/resources/generated/**`, `src/firmware/generated/**` or
  `scripts/generated/**`; change the generator or its tables and regenerate. Each generator runs
  twice with no diff before its commit.
- Tests never read `$REF`. Generators that read `$REF` fail clearly when it is missing.
- No new dependencies.
- When reality differs from this plan, follow the captures and append a `Deviation:` paragraph
  under the task. If a deviation breaks a contract in VISION.md, stop and report.
- Parallelism (max 3 concurrent agents): Task 0 gates everything, then Task 1. Then lanes A
  (2 → 3) and B (4). Task 5 needs 3 and 4. Then lanes C (6 → 7: both edit `leaves.ts` and
  `bindings.ts`), D (8) and E (10). Task 9 needs 6, 7 and 8; Task 11 needs 9 and 10.

## Tasks

### Task 0 - Harness volume columns and REF sound captures (no repository changes)

**Files (all under `$REF`, gitignored):** `tools/harness/dct3cap.c` and `tools/harness/build.sh`
(the two event columns, D2), `captures/scripts/gen_v639_plan16.py`,
`captures/scripts/v639-factory-setup.inc`, `captures/scripts/v639-plan16-<section>.cap` (one log
per section), `captures/6.39/plan16/**`, a "Plan 16 supplementary captures" section in
`captures/README.md` (and its "Output format" row for `*.events.csv`).

Concurrent sessions may use the harness: write only these paths. The build already swaps the
binary atomically (plan 15). Scripts use `reboot <absolute image path>` and `record <name> start`
… `record stop`; every sound section wraps its recording in `audio <same name>` … `audio off` and
writes `keys.csv` (`key,down_ms,up_ms`, relative to the audio start) from the commands it issued
(the harness log prints each command's emulated time).

- [x] **H harness:** add `buzzer_vol` and `dsp_level` to `audio_pump`'s change detection and
      columns (after `vibra`, so readers of the first six columns keep working). Read
      `dsp_level` through a helper appended in `build.sh` (`cap_dsp_level()`, the word the probe
      found at 0x100A8). Verify on a keypad beep at each level and a ringing preview: the keypad
      levels differ in `dsp_level`, preview notes carry `buzzer_vol`. If 0x100A8 is not the tone
      level, find the register (the DSP mailbox writes around 0x100A0-0x100C0, `src/mad2/dsp/`)
      and log that one. Update the README's "Output format" row.
- [x] **Setup:** `v639-factory-setup.inc`: `reboot …/firmware/work/v639-plan15-restored.fls`,
      `run 12s`, `key 1 0 1 0 menu`, `run 4s`, `key 1 3 1 0 2 0 2 6 menu`, `run 20s`,
      `hold c 1500ms`, `run 1s` (plan 15's factory setup). Every factory section starts from it;
      virgin sections from `v639-setup.inc`. Every section returns to standby with
      `hold c 1500ms` before the next (probe B's lesson).
- [x] **K keypad:** at standby, in a pages list and in a Tones option list: every key tapped,
      held 1 s, and two keys in quick succession, at Keypad tones Off, Level 1, 2 and 3 (factory)
      and unset (virgin). Decide what makes a beep 120-124 ms rather than 140-150 ms (S2), and
      what the virgin unset level sounds like. Record LCD frames too so beeps can be related to
      redraws.
- [x] **R ringing tones:** factory: for each of the 42 Ringing tone entries (35 tones, 7
      `(empty)`), highlight it with one ▼ from the entry above (▲ from below for the first),
      record ≥ 2 passes of its preview (or 25 s), then C. Name `ringing-tone/<nn>`. Repeat the 35
      tones at Level 1, 2, 3 and 5 (`levels/<n>/<nn>`, set through Ringing volume) for D10's rule
      check.
- [x] **V volume:** from the Ringing volume list, each level highlighted with the stored tone
      Nokia tune (`ringing-volume/<n>`), ≥ 2 passes each; Level 5 including its confirm query
      and OK (does the query or OK stop the preview?).
- [x] **A alert types:** with Incoming call alert Ascending (Level 1 and Level 4), Ring once,
      Beep once and Off: the Nokia tune preview for 30 s each (`alert/*`); and scrolling the
      Incoming call alert list itself (`alert/list`: S5 says silent).
- [x] **Vb vibrator:** Nokia tune preview with Vibrating alert Off (`vibrator/off`); choosing On
      and Off (`vibrator/choose`: S8 says no pulse).
- [x] **M message tones:** each Message alert tone highlighted (Standard, Special, Beep once,
      Ascending, No tone), 10 s each, at Level 4 and (Special only) Level 1; with Vibrating alert
      Off once; and OK on a choice.
- [x] **P profiles:** in Profiles › Silent, Discreet and Loud › Personalise: Ringing tone ▼ and
      Message alert tone ▼ previews (does the preview follow the edited profile's alert type,
      volume and vibrator, or the active profile's?).
- [x] **X preview mechanics:** virgin: Ringing tone ▼ with everything unset; then with only the
      volume set, then only the alert type (`preview/virgin*`); the first ▼ out of an unset list
      after both are set (`preview/first-down`, S9). Factory: ▼ while a note of the preview
      sounds (`stop-key`), C during a preview (`stop-c`), OK during a preview (`ok`), ▼▼▼▼ fast
      (`rapid`), and a preview left to run 60 s (does it stop by itself?).
- [x] **N notes:** factory (Warning tones On): replay plan 14's `open/` and `choose` sections
      (`gen_v639_plan14.py`'s C2 navigation) with audio into `notes/<number>`, covering every
      timed note, static note, progress note and confirm query the tree reaches; plus
      `Invalid shortcut`, in-menu `Code error` (`00000`), the power-on gate's `Code error`
      (`firmware/work/v639-plan15-factory-security-on.fls`), `Request not confirmed` and the
      Top score note. Then Warning tones Off and the error notes again (`notes/warning-off`).
- [x] **G games:** factory with Warning tones On, Snake II at level 1 (plan 23's level routine):
      a meal and a crash (`game/meal`, `game/crash`); a new top score's fireworks
      (`game/top-score`, plan 23 C6's Maze 1 route); Games › Settings › Sounds Off then a meal
      (`game/sounds-off`); Shakes On/Off × Vibrating alert On/Off, one meal each
      (`game/shakes-*`); keys during play (beeps).
- [x] **B boot:** factory power-on with audio from the power key's press (`boot/power-on`: is
      S10's beep the held power key?), and a power-off during a preview (`boot/power-off`).
- [x] `gen_v639_plan16.py check`: every recording has its events (v2) and `keys.csv`; every
      ringing tone shows ≥ 2 passes and the same rows each pass within ±2 ms (the loop); every
      `levels/` recording equals its Level 4 recording under the fitted volume rule (report the
      rule, or the tones it fails); no factory recording shows an unexpected silence.
- [x] Append "Plan 16 supplementary captures" to `$REF/captures/README.md`: commands, the S1-S10
      table, the volume rule and the outcome below.
- [x] No commit. Record the outcome under this task: the event columns and the DSP register, the
      keypad durations and their rule, the preview delay and its spread, loop periods, the volume
      and Ascending rules, the alert-type matrix, message tone shapes, profile behaviour, the
      note-sound table (which notes sound, which are silent), the game matrix, the boot beep, and
      any section that failed.

**Outcome (Task 0, 2026-10-14).** 631 recordings in `$REF/captures/6.39/plan16/`, written by
`gen_v639_plan16.py` (sections run through `tools/menutree/emu.py` with `fork`, as plan 23's;
each section's command stream is `scripts/v639-plan16-<section>.cap`). `check` passes. Layout,
commands and the findings in prose: `$REF/captures/README.md` "Plan 16 supplementary captures".

- **Event columns.** `buzzer_vol` (PUP 0x1E, decimal) and `dsp_level` (the word at 0x100A8, hex)
  follow `vibra`; the plan 13 clock script gives byte-identical LCD output before and after the
  harness change. 0x100A8 is the tone generator's level (D2 confirmed): keypad Level 1/2/3 write
  0x9108/0x9104/0x9100 while the beep sounds; warning tones 0x9105 at every keypad level; the
  message `Beep once` follows Ringing volume (Level 1 0x9107, Level 4 0x9104, Level 5 0x9100). The
  idle word 0x910F mutes the generator, 0x900F powers the DSP down, 0x840A wakes it.
- **Keypad tones.** 900 Hz, 140-150 ms (median 143, n = 740) while the DSP is awake; the DSP
  powers down ≈2966 ms after the last tone ends and the next key wakes it for a 123-139 ms beep
  (median 124, n = 32). That, not the ▲/▼ of a Tones list, decides the two groups of S2 (the lists
  were pressed after previews had let the DSP sleep). A key that lands ≈70 ms before the
  power-down gets a ≈77 ms beep (one capture). Onset after the key-down: awake 12-93 ms (median
  28), woken 37-103 (median 51). A key-down while a beep sounds extends it (no new onset). Held
  ▲/▼ beep again at each auto-repeat (≈775 ms, then every ≈480 ms) and a held C at its long press
  (≈500 ms). In the Keypad tones list, ▲/▼'s own beep plays at the highlighted level (Off:
  silent); C restores the stored level. The unset (virgin) level writes 0x9100. Digits, `*` and
  `#` at standby (number entry, plan 22) play DTMF pairs (1209-1477 Hz + 697-941 Hz) for as long as
  they are held; the security-code prompts and menus beep 900 Hz. A short power-key press beeps;
  game keys beep.
- **Previews.** Start ≈991 ms after the key-down (985-1014, n = 249; message tones 1002-1010).
  They do not loop. The Ringing tone list plays the tone until its second cycle mark: two whole
  passes for 21 tones, a cut second pass for 9 (4, 6, 16-20, 26, 28), and for 14, 15, 23, 24 and
  33 the preview ends inside the first pass. The Ringing volume list plays the stored
  tone to its first mark (`ringing-volume/tones/<nn>`: a prefix of the tone-list preview). Message
  previews play once. Between passes edges jitter by a median 11 ms (≤ 48), and the second pass
  runs up to ≈1 % slower (after the DSP powered down), so the ±2 ms pass-to-pass match of the
  plan does not hold. ▲/▼ stop a preview at the key (the next one starts ≈991 ms later), as do C,
  OK and the power key's long press (≈1046 ms). Opening a list previews nothing. S9 confirmed: the
  first ▼ out of an unset list previews nothing; ▲ back onto the same entry does. `(empty)` slots
  are silent. Level 5 previews when highlighted; its query and OK sound only their key beeps.
- **Volume rule.** `buzzer_vol` is a function of the level and the note's frequency alone: five
  tables of 45 frequencies (e.g. 1319 Hz: 4, 7, 10, 16 | 61) reproduce every Level 1-4 recording
  of all 35 tones exactly (the last note may differ: the preview's stop races the next note).
  Level 5 plays at Level 4's table and jumps once to the fifth table at a tone-specific time
  (3.1-7.2 s in; Nokia tune at its second pass). Ascending starts at Level 1's table and steps one
  level at a time about every 4 s, at tone-specific times (first step 3.1-7.2 s), capped at the
  stored level (`ascending-l1` stays at Level 1). Neither point follows from time, passes or the
  vibrator in the captures, so both are stored per tone (D10 Deviation).
- **Alert types.** Ringing and Ring once preview identically; Beep once and Off silence ringing
  previews and the vibrator; Ascending as above; the Incoming call alert list previews nothing
  (S5). Unset (virgin): silent ringing previews; an unset volume plays Level 1's table; message
  previews play (no alert-type gate) without the vibrator.
- **Vibrator.** Each tone carries its own vibrator track (Nokia tune ≈712 ms on/off; Ring ring
  with its bursts); Vibrating alert Off removes it; choosing On or Off pulses nothing (S8).
- **Message tones.** No tone: silent. Standard: 1499.9 Hz, two 193 ms pulses twice, vibrator.
  Special: 2683.7 Hz in three groups of 93/286 ms pulses, vibrator, ≈6.3 s. Beep once: 1750 Hz on
  the tone generator for ≈285-340 ms, then three 480 ms vibrator pulses. Ascending: the Special
  pattern, stepping Level 1 → 4 once per pass, ≈33 s (recaptured for 60 s in Task 3). Volumes follow the ringing tables
  (Standard at Level 5 plays the fifth table at once). Incoming call alert Off does not gate them.
- **Profiles.** A Personalise list previews with that profile's Incoming call alert and Ringing
  volume (Silent: Off, Discreet: Beep once → silent; Loud: Level 5) and the active profile's
  Vibrating alert (`profile/active/*`).
- **Notes** (Warning tones On; 287 tree leaves and options of plan 14's `open/` replayed, 19 not
  reachable in the factory tree). 1750 Hz tone (0x9105, ≈290 ms): `Invalid shortcut`, `No phone
numbers`, `No voice tags saved`, `Screen saver missing`. 1000 Hz buzzer (v=22, ≈285 ms): `Code
error` (menus and the boot gate), `Not allowed`, `Set PIN code request on`. Every other note,
  confirmation, query and progress note (incl. `Request not confirmed`) is silent. The tone
  replaces the triggering key's beep, and a key pressed on the note sounds it again; with Warning
  tones Off the triggering key is silent.
- **Games** (Snake II, level 1). Meal: 2636.9 Hz for one timer unit (6-7 ms, v=6); crash: three
  440 Hz pulses of 15 ms (v=3); top score: the fireworks tune (587/880 Hz, v=3, twice) ≈2 s after
  the crash. Sound needs Warning tones On and Sounds On; the vibrator (≈480 ms per meal and at the
  crash) needs Shakes On and Vibrating alert On. The factory Games settings are On (plan 15's
  factory table mislabelled them Off). The Top score page is silent.
- **Boot.** The power-on plays 900 Hz (0x9105) for 124 ms, 2425 ms in, also with Keypad tones Off:
  a power-on tone, not the power key (S10). The power key's long press plays the same tone.
- **Failures.** None left. The harness cannot advance a powered-off emulator, so `boot/power-off`
  ends at the power-off; a forked `reboot` kills dct3cap, so the boot section runs unforked.
  Plan 15's factory Games values and the S2 duration cause were wrong (above).

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `docs/specs/nokia-3310.md`, `docs/specs/nokia-3310-menu-tree.md`,
`docs/plans/README.md`, this plan.

- [x] Apply Task 0's outcome to D2 and D7-D13 (Deviation lines where it changes them) and fix the
      contract's field names (`volume` semantics per output).
- [x] VISION: the `StockSoundEvent`, `StockSoundPort` and `StockPhoneConfig.sound` contract and
      its rules; a sentence that nokia-os's sound goes through the port, not phone-core's
      `sound` event; the nokia-os row of the package table mentions sound.
- [x] Spec §8: mark the manual-sourced bullets as history where §10 corrects them (keypad tones
      are a 900 Hz tone-generator beep of ≈140 ms, not a square-wave buzzer blip; 35 tones plus 7
      `(empty)` slots; `Warning tones` wording). Spec §10: a "Tones and sound (plan 16)"
      subsection with the S1-S10 facts and Task 0's outcome, marked "(plan 16, in progress)";
      the artefacts above. Correct plan 14's "previews are silent" (virgin only).
- [x] Menu-tree spec "Tones": a note that previews play in the factory state (link to §10).
- [x] Plans README: row 16 `in progress`; add row 27 (Composer: editor, playback, saved tones;
      depends on 16, 18; not started).
- [x] No runtime code. `mise exec -- vp check --fix`.
- [x] Commit: `docs: define the stock sound port and tone contracts (plan 16)`.

### Task 2 - Sound goldens, importer and re-owned Composer placeholders (TDD)

**Files:** `scripts/sound-format.ts` (new), `scripts/sound-capture-set.ts` (new),
`scripts/import-captures.ts`, `scripts/tree-capture-set.ts` (`PLACEHOLDER_OWNERS`),
`src/firmware/bindings.ts` (`PLACEHOLDER_OWNERS` only), `tests/sound-format.test.ts` (new),
`tests/sound-capture-set.test.ts` (new), `tests/goldens-integrity.test.ts`,
`tests/acceptance.test.ts` (todo shim only), `goldens/**`.

- [x] TDD `sound-format.ts`: parse/serialize round trip; header order; `keys` ascending with known
      key names; integer, non-decreasing times; output names; states (`off`, `on` for the
      vibrator only, `<hz> v=<volume>`); consecutive equal states rejected; `@loop` well-formed;
      silent goldens; every error names `file:line`.
- [x] TDD `sound-capture-set.ts` on synthetic events/keys (injected loader, no REF): the v2
      columns → rows per output; normalisation (D6) with `omitted` counts; alignment on the first
      key-down; loop detection (two passes equal within ±2 ms, else throw naming the recording);
      equal note recordings share a golden; a missing column, file or key throws naming the
      recording.
- [x] Wire `import-captures`: `soundCaptureSet` beside the existing sets; `index.json` entries
      `kind: "sound"` with `events` counts; `NOT_IMPORTED` reasons for `levels/` (rule check only)
      and the plan 23 v1 sound recordings (superseded).
- [x] Re-own the Composer (D14): `"5-4-*": "27"` in both `PLACEHOLDER_OWNERS` tables; the pending
      goldens become `pending:27`; no golden is `pending:16`.
- [x] Integrity tests: every sound golden parses; ids unique; `state` known; no `pending:16`; the
      two owner tables equal (plan 14's test).
- [x] `tests/acceptance.test.ts`: asserted sound goldens without a scenario are todos
      (`awaitsPlan16Scenario`; Task 9 deletes it).
- [x] Run `import-captures` twice; the second run changes nothing. Record counts and bytes in a
      completion note.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): import sound captures as event-timeline goldens (plan 16)`.

**Completion note (Task 2).** `import-captures` writes 331 sound goldens (1.4 MB, 18 249 event
rows; 299 asserted, 32 pending on plans 17, 18, 20, 21, 22, 24, 26 and 27) beside the 511 LCD
fixtures (842 in `index.json`); a second run changes nothing. The 287 tree note recordings share 74
goldens (`sound/note/<first number>`), plus 7 named notes. Ringing previews carry `@loop` for the 30
tones with a second pass. The four `tree/05-tones/5-4-*.leaf` goldens are `pending:27`; no golden
names plan 16. Deviations: the format takes `<t>:<key>+<hold_ms>` for held keys and `<hz>+<hz2>` for
DTMF tone states (D6 deviation); loop detection uses the measured jitter tolerance (25 ms + 1.2 %),
not ±2 ms; `tests/firmware-menu.test.ts` and `tests/tree-capture-set.test.ts` change their Composer
owner expectation to 27 (the D14 re-own); the acceptance guard skips sound goldens that await their
scenario (`awaitsPlan16Scenario`) until Task 9.

### Task 3 - Sound programs and rules from the goldens (TDD)

**Files:** `scripts/sound-programs.ts` (new, pure), `scripts/extract-resources.ts`,
`src/resources/generated/sounds.ts` (generated), `src/resources/index.ts`,
`tests/sound-programs.test.ts` (new), `tests/resources.test.ts`.

- [x] TDD `sound-programs.ts` on synthetic goldens: a golden's rows from its program's first edge
      to its loop (or its end) become a `SoundProgram` (steps with buzzer/tone/vibrator states and
      durations; `loopFrom` from `@loop`); rendering the program over the golden's span reproduces
      its rows exactly (the round trip that keeps the derivation honest).
- [x] Derive and emit: `RINGING_TONES` (35 programs in list order, by slug, Level 4 volumes),
      `MESSAGE_TONES`, `NOTE_SOUNDS` (note text → program, D12), `KEYPAD_BEEP` (frequency, the
      level → `dsp_level` table, the duration per group), `GAME_CUES` (`eat`, `crash`,
      `top-score`; the vibrator duration), `PREVIEW_DELAY_MS`, `VOLUME_RULE` and
      `ASCENDING_RULE` (D10, fitted by the generator and checked against every level golden),
      each with a comment naming its goldens.
      _After Task 0:_ `RINGING_TONES` are the Ringing tone list previews (to the second cycle mark, as
      captured) with each tone's `firstMark` (the step the Ringing volume list stops at, from
      `sound/ringing-volume/tone/*`) and `cycle` (`@loop`, absent for the five one-pass tones);
      `VOLUME_RULE` is the five frequency tables plus each tone's Level 5 jump step; `ASCENDING_RULE`
      each tone's step times (Level 1 first, capped at the stored level); `KEYPAD_BEEP` adds the woken
      duration and the DSP's power-down delay (≈2966 ms); `MESSAGE_TONES` include the `Beep once` DSP
      words per level; `NOTE_SOUNDS` read the note text from each sounding note golden's `note:` (quoted
      first); `BOOT_TONE` is the power-on and power-off tone.

- [x] TDD freshness (in-process extraction equals the committed file); every ringing program
      re-renders its golden's two passes; the volume rule reproduces `sound/ringing-volume/*`
      and the `level-*` goldens exactly; Ascending reproduces its goldens; frequencies are
      positive with at most one decimal.
- [x] Cross-check only (report in the completion note, import nothing): the 35 tone names and
      order against `$REF/extracted/6.39/tones/index.json`, and note frequencies against its
      `notes`.
- [x] Run `extract-resources` twice; no diff.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): derive tone programs and volume rules from sound goldens`.

**Completion note (Task 3).** `extract-resources` writes `src/resources/generated/sounds.ts`
(`SOUND_DATA`, 426 KB) and `src/resources/index.ts` exports `RINGING_TONES`, `PREVIEW_DELAY_MS`
(991), `MESSAGE_PREVIEW_DELAY_MS` (1004), `VOLUME_RULE`, `ASCENDING_RULE`, `MESSAGE_TONES`,
`BEEP_ONCE_LEVELS`, `KEYPAD_BEEP` (0x9108/0x9104/0x9100, unset 0x9100; 145 ms awake, 124 ms woken,
sleep after 2966 ms), `NOTE_SOUNDS` (7 texts), `GAME_CUES` and `BOOT_TONE`; a second run changes
nothing. Every tone program re-renders its preview golden exactly; the frequency tables (Levels
1-5: 45, 45, 45, 46, 46 frequencies, 1499.9 Hz from Standard) reproduce every committed level and
Ringing volume golden; Level 5 (`level5AtMs`) and Ascending (`ascendingAtMs`) reproduce theirs.
Deviations: Level 5's jump and Ascending's steps are times, not notes: Toreador's Ascending raises
the volume inside a note, so a sounding note changes at once (`renderAtLevels`); a note's volume
written ahead of its divider is dropped however long it lasts (Hurdy-gurdy: 14 ms; importer
rule `staleFrequency`, golden `ringing-volume/tone/27-hurdy-gurdy` re-imported); the message
Ascending recording was cut at 20 s and was recaptured for 60 s (it ends at ≈33 s). The importer
keeps `NOTE_SOUNDS` texts in the golden notes' quoted prefix. Cross-check (nothing imported): the
35 names and their order equal `extracted/6.39/tones/index.json`; 247 of the 260 captured tone
frequencies lie within 0.07 % of the extraction's notes; Mosquito, Bee and Rocket glide over
2515-2910 Hz where the extraction decoded 77.8/82.4 Hz notes (its control codes misread there).

### Task 4 - The sequencer (pure, TDD)

**Files:** `src/sound/program.ts` (new), `src/sound/sequencer.ts` (new),
`src/sound/port.ts` (new: `StockSoundEvent`, `StockSoundPort`), `tests/sequencer.test.ts` (new).

- [x] TDD with synthetic programs: steps emit changes at their exact times; unchanged states emit
      nothing; a loop repeats from `loopFrom` indefinitely; a program that ends silences what it
      set; `stop(outputs, atMs)` silences at `atMs` (mid-step) and drops later steps; `play` on a
      busy output replaces its program at `atMs`, emitting one change (no `off` between two
      frequencies, nothing when the state is the same); programs on different outputs are
      independent.
- [x] TDD tick independence: advancing 1 ms at a time and in one 10 s jump emit the same events
      with the same `atMs`; `atMs` never exceeds the `advance` time; events come in time order
      across outputs (ties: buzzer, tone, vibrator).
- [x] TDD the `volume` option: a function of step, pass and stored register (D10's rule plugs in
      here) changes only `volume` fields.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): tick-driven sound sequencer`.

Deviation (Task 4): the `volume` option is a `SoundVolume` (`changesAtMs` plus `of(output, hz,
stored, offsetMs)`), not `(step, pass, stored)`: Level 5's jump and Ascending's steps are times
that can change a sounding note (Task 3), so the sequencer re-reads the volume at each step's
start and at each change time, as `renderAtLevels` does. `play` returns a `SoundPlay` handle;
`cancel(play, atMs)` ends one program (one scheduled for later never sounds: a preview armed by
▲/▼ and cancelled by the next key), `playing(play)` and `last(output)` let the sounder model the
DSP's power state; `endStep` plays a prefix once (the Ringing volume list's first mark). A program
asked for in the past starts at the time already reached. `src/sound/port.ts` holds the contract
types (exported from the package in Task 5).

### Task 5 - The port, keypad tones and the phone's sounder (TDD)

**Files:** `src/sound/sounder.ts` (new), `src/firmware/phone.ts`, `src/firmware/menu.ts`
(`LeafBinder` construction only), `src/firmware/leaves.ts` (constructor only),
`src/firmware/cues.ts` (the default sink becomes the sounder; `NO_CUES` stays for tests),
`src/index.ts`, `tests/sounder.test.ts` (new), `tests/support/rig.ts` (sound recorder,
`seededStorage({ factory })`), `tests/support/sound.ts` (new), `tests/firmware-phone.test.ts`.

- [x] TDD `tests/support/sound.ts` itself: `expectSoundTimeline`'s failure text for an early edge,
      a wrong frequency, a missing and an extra event (as plan 13 Task 2 tested `expectTimeline`).
- [x] TDD `StockSounder.keyDown` against `sound/keypad/*`: 900 Hz at each level's `dsp_level`;
      Off silent; the virgin unset level per Task 0; the duration group rule; held keys.
- [x] `createStockPhoneWith`: one `SoundSequencer` emitting to `config.sound` (default: nowhere),
      advanced in the wrapper's `tick()`; key-downs from `send`/`pressKey` reach `keyDown` while
      powered on (the wrapper knows the kernel time); power-off calls `powerOff()`; `LeafBinder`
      and `StockGames` get the sounder (`games.cues` = the sounder unless `internals.cues` is
      given).
- [x] TDD the contract rules (Contract changes): ordering, no duplicates, power-off silence, no
      port = same screens (every existing acceptance scenario still passes).
- [x] `sound/boot/*`: the boot beep as Task 0 found it (a key-down of the power key, or a boot
      program at its offset); power-off silence.
- [x] Export `StockSoundEvent` and `StockSoundPort` from `src/index.ts`.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): sound port, keypad tones and the vibrator`.

Deviation (Task 5): `StockSounder` also has `keyUp(key)`, `tick()` (held-key beeps due by now:
▲/▼ at each auto-repeat, `LEVEL_REPEAT`, and C at its long press, `C_HOLD_BEEP_MS` = 480: the
captured 505-511 ms less the median 28 ms key latency), `powerOn({ boot })` and
`keyBeepLevel(option)`; `keyDown(key, options)` takes whether the key beeps and has held beeps
there, which the wrapper decides from the screen: the power key beeps at standby only (it beeps
there in `boot/power-key` and `keypad/keys`, not in the Ringing tone list in `boot/power-off`),
and C in the menu carousel has no long-press beep (`keypad/level-*`: it leaves the menu at its
key-down). The wrapper calls `keyDown` after the kernel handled the key-down, so the Keypad
tones list (an `OptionListOptions.keyDown` hook, bound in `leaves.ts`) sets the beep of its ▲/▼
to the highlighted option (`keypad/levels-list`, `keypad/virgin-list`). The DSP's power state is
read from the sequencer's last tone change. With `boot: "skip"` there is no power-on tone (the
boot is skipped); power-off cancels a pending power-on tone. The power-off tone plays at the
kernel's power-off (its 800 ms long press; the firmware's ≈1046 ms is not reproduced). Scenarios
live in `tests/support/sound-scenarios.ts` (`SOUND_SCENARIOS`, registered in the acceptance
test, so these goldens leave `awaitsPlan16Scenario`), and `sound/keypad/pair` is a known gap: its
▲ 70 ms before the DSP powers down beeps 77 ms in the capture. `sound/boot/power-off` needs a
preview and is driven in Task 6. Comparison (`tests/support/sound.ts`): a key-started or
key-stopped edge may lag its key by up to `KEY_LATENCY_MAX_MS` (103); a key-started tone's end is
within `KEY_TONE_TOLERANCE_MS` (10) of its length; a program's first edge after a key within
`SOUND_ONSET_TOLERANCE_MS` (25); its later edges ±2 ms of it, or within `PASS_DRIFT` past one
cycle. The factory Games Sounds and Shakes were already On in code (no `FACTORY_DEFAULTS` entry;
the virgin opening); a settings test now pins them.

### Task 6 - Ringing and message tone previews (TDD against sound goldens)

**Files:** `src/widgets/option-list.ts` (a `highlight(index, flow)` hook), `src/widgets/flow.ts`
(`Widget.close?()` on pop, replace and deactivation), `src/sound/sounder.ts` (`preview`,
`stopPreview`, `ring`, `messageAlert`), `src/firmware/bindings.ts` (`PREVIEW_LISTS`: the
Ringing tone, Ringing volume and Message alert tone lists in Tones and every Personalise, by
slug), `src/firmware/leaves.ts`, `tests/flow.test.ts`, `tests/widgets-lists.test.ts`,
`tests/sound-previews.test.ts` (new).

- [x] TDD flow `close()`: called once for a widget leaving the stack by `back`, `replace` or the
      session's deactivation (C, C held, power-off, navigate); not for one that stays below a
      push.
- [x] TDD option-list `highlight`: called after ▲/▼ moves the selection (unset → first included,
      per Task 0's S9 finding), never on opening.
- [x] TDD previews against `sound/ringing-tone/*`, `sound/ringing-volume/*`, `sound/alert/*`,
      `sound/vibrator/*`, `sound/message-tone/*`, `sound/profile/*` and `sound/preview/*`: the
      delay, the loop, the level, Ascending, the alert-type gate, the vibrator, the edited
      profile's settings, what stops a preview, the `(empty)` slots and the virgin silence.
- [x] `ring(profile)` and `messageAlert(profile)` (D11): programs and gating only, one test each.
- [x] Plan 14's option-list goldens still pass (previews change no pixel).
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): ringing and message tone previews`.

Deviation (Task 6): `highlight(index, previous)` gets the previous selection, and the S9 quirk
is the binding's (`previous === null`: no preview); `OptionListOptions.close` stops the preview
when the list leaves the flow. `preview(list, index, prefix)` and `ring(prefix)` /
`messageAlert(prefix)` take the profile's settings prefix (`tones` or
`profiles/<profile>/personalise`); `PREVIEW_LISTS` and `profileSetting(key)` are in
`bindings.ts`. A preview starts `PREVIEW_DELAY_MS` (message tones `MESSAGE_PREVIEW_DELAY_MS`)
after the key-down that armed it. Two generator changes (Task 3's files, regenerated twice with no
diff): Level 5's jump and Ascending's steps are stored as note positions (`level5At`,
`ascendingAt`: a note of the tone and a time into it) instead of times from the preview's start,
because recordings of one tone drift from the Level 4 recording the program comes from, so a
time landed on the neighbouring note (Croak, Hopping down); and `unsetMessageVolumes` (from
`sound/preview/virgin-message`): with Ringing volume unset, message tones play their captured
registers (3), not Level 1's table (6) as D7's refinement said (ringing tones do play Level 1's).
UNVERIFIED and documented in `sounder.ts`: Standard at Levels 1-3 (1499.9 Hz is captured at
Levels 4-5 only: the nearest frequency's register), the message Beep once word at Levels 2-3
(stepped between Level 1's and Level 4's) and unset (Level 1's), the message Ascending at levels
other than 4 (plays as captured), and `ring()` for the five tones without a captured second pass
(repeats what was captured). `ring` loops one cycle (`cycleMs`; not `firstMarkStep`, which is the
Ringing volume list's earlier stop for 9 tones). Comparison of another recording of a program
than the one it was built from (`drift`): every edge after its onset within `PASS_DRIFT`, and a
final pulse of up to `STOP_RACE_MS` (3) at a preview's end may be in either recording (the stop
races the next note or vibrator pulse); `endMs` marks where a capture stopped recording. Known
gaps: `alert/ascending-l5` (its Level 2 → 3 step races the last note), Badinerie's
`level-3`/`ascending` recordings (the program's recording rests 8 ms between two notes where
they do not) and `ringing-tone/level-5/33-mangrove` (one 7 ms chirp missing). `sound/preview/rapid`
compares the buzzer and vibrator only (keys 150 ms apart: the capture's ≈30 ms beep latency
makes the second key run the first beep on).

### Task 7 - Warning tones on notes (TDD against sound goldens)

**Files:** `src/widgets/note.ts` (a `sound` option played when the note starts),
`src/widgets/code-entry.ts` (`Code error` through the note sound), `src/firmware/leaves.ts`,
`src/firmware/boot.ts` (the gate's `Code error`), `src/sound/sounder.ts` (`note`),
`tests/sound-notes.test.ts` (new).

- [x] TDD the note sound: with Warning tones On a note whose text has a `NOTE_SOUNDS` program
      plays it from its first frame; Off (or no program) is silent; a key that ends the note early
      stops its sound if Task 0 shows that (else the sound runs out).
- [x] Bind every note leaf, result and named note (`Invalid shortcut`, `Request not confirmed`,
      the code entry's `Code error`, the boot gate's) to its sound by text, so the sound follows
      the text wherever the note opens.
- [x] Drive every `sound/note/*` golden's path (plan 14's `goto`/`open` keys) and compare
      (`SOUND_ONSET_TOLERANCE_MS` for the onset, D12).
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): warning tones on notes`.

Deviation (Task 7): `NoteOptions.sound` is a callback by the note's lines (`NoteSound`), called
when the note opens and again on each key-down on it (Task 0: a key on the note sounds the tone
again, in place of its beep); `codeEntry`/`codeError` take it, `stockBootGates` and
`invalidShortcut(sounder)` too. `StockSounder.note(lines)` looks the joined lines up in
`NOTE_SOUNDS`; a note with a tone silences the beep of the key that opened it (same kernel
millisecond) and plays the tone with Warning tones On (unset counts as Off). A key that ends the
note does not stop its tone (it runs out). Scenarios drive each asserted tree note golden's first
node from the factory state (an option of a single-choice list from the list's stored choice,
which `goto`'s virgin openings do not know) after a 500 ms settle (the capture's `idle`).
`sound/note/code-error` and `warning-off` open 6-4 by its menu path and compare from the first 0:
the capture types the code 1960 ms after Menu 6 4's 4, which phone-core's 2948 ms shortcut
window still takes as a shortcut digit (`Invalid shortcut`). Known gap: `sound/note/1-2` (the
capture shows `No phone numbers` ≈150 ms after OK, so OK's beep sounds first). In the Keypad
tones list OK also beeps at the highlighted option (`sound/note/5-6-*`: OK on Off is silent).

### Task 8 - Snake II's sounds and vibration (TDD against sound goldens)

**Files:** `src/sound/sounder.ts` (`cue`), `src/firmware/cues.ts` (the `top-score` comment),
`tests/snake-game.test.ts`, `tests/sound-games.test.ts` (new), `scripts/snake-cues.ts` (deleted),
`tests/fixtures/snake-cues.json` (deleted), `package.json` (the `snake-cues` script removed).

- [x] TDD `cue`: `eat`, `crash` and `top-score` play `GAME_CUES` with Warning tones On and Games ›
      Settings › Sounds as Task 0 found; `vibrate` runs the vibrator for its `ms` per the Shakes ×
      Vibrating alert matrix.
- [x] Migrate plan 23's cue-time checks from `snake-cues.json` to the `sound/game/*` goldens
      (subtract the script, fixture and package script). Cue edges within
      `GAME_TICK_TOLERANCE_MS`; the meal's redraw delay with Warning tones On stays unmodelled
      (plan 23 Task 10).
- [x] `top-score` is emitted at the time Task 0 shows (it was UNVERIFIED); update the cue comment
      and the spec's UNVERIFIED list.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): play Snake II's sound and vibration cues`.

Deviation (Task 8): the fireworks tune starts 2045 ms after the crash in `sound/game/snake-top-score`,
21 ms before the death steps end where plan 23 cued it, beyond `GAME_TICK_TOLERANCE_MS`; the
generator emits `GAME_CUES.topScoreAfterCrashMs` (2045, Task 3's files regenerated twice with no
diff) and the session cues `top-score` at that point of the death, derived from the death's
progress so a suspended death cues it once. Keys on the game-over screens make no beep (`game/keys`:
a 3 on the note), a new `silent-key` cue the game-over screen sends for every key (Navi and C there
UNVERIFIED); `StockSounder` handles it as a note's tone silences its key. The captured cues lag the
session's by 47-54 ms (the capture's New game redraw latency, 56-83 ms, less the cue's lead over its
tick's redraw; plan 23 D6 does not reproduce it), so the `sound/game/*` scenarios compare the key
beeps as keys and align the buzzer and vibrator on the golden's first cue (that lag within
`KEY_LATENCY_MAX_MS`), each later cue's onset within `GAME_TICK_TOLERANCE_MS` and its edges ±2 ms
(`SoundTolerance.cueOnsetMs`). `sound/game/snake-crash` compares beeps from its 4: its 8 comes 150 ms
after Navi, whose late beep the capture runs on (as `sound/preview/rapid`). The game sound goldens
replay at level 1 with the captures' seed (44530, `game/meal`'s first food at (14, 8)) and top score
0, as the factory captures had.

### Task 9 - Acceptance and the coverage guard

**Files:** `tests/acceptance.test.ts`, `tests/support/sound.ts`, `tests/support/probes.ts`.

- [x] `SOUND_SCENARIOS`: one per asserted sound golden (most reuse Tasks 5-8's drivers); delete
      `awaitsPlan16Scenario`; the guard fails for an asserted sound golden without a scenario.
- [x] Every asserted LCD golden still passes (sound changes no pixel); known gaps unchanged.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp run -r test`,
      `mise exec -- vp check --fix`. Report the suite's run time (keep it under ≈25 s; previews
      compare two passes, not more).
- [x] Commit: `test(nokia-os): drive every sound golden`.

**Completion note (Task 9).** `awaitsPlan16Scenario` is gone: all 299 asserted sound goldens have
scenarios (the last 10 were Task 8's `sound/game/*`), and the coverage guard fails for any asserted
golden without one. 842 goldens: 775 asserted (476 LCD, 299 sound), 67 pending (35 LCD, 32 sound).
Known gaps unchanged: 15 expected failures (plan 14's 6, `game/snake/keys-c-hold`,
`probe/accept-6-3-5-on`, `boot/security-lockout-4`, and Tasks 5-7's 6 sound gaps). The nokia-os
suite runs in ≈15.7 s (was ≈34 s; target ≈25 s).

Deviation (Task 9, run time): two changes beyond the listed files. A CPU profile of the slow Snake II
scenarios showed half the time in `FlowSession.render` serialising the game board to JSON on every
1 ms tick: `src/widgets/flow.ts` now skips the comparison when a widget returns the model it
returned before, and `src/widgets/snake.ts` returns one model per state (pixels unchanged; Snake
scenarios ≈2.4× faster). The rest of the per-tick cost is phone-core's menu numbering, which this
plan does not change. And `tests/acceptance.test.ts` was one 22 s file, the suite's critical path:
the scenarios, known gaps and `describeGoldens` move to `tests/support/acceptance.ts`, and three
slice files (`acceptance-games`, `acceptance-sound-tones`, `acceptance-sound`) run their goldens in
parallel with the main file, which keeps the rest and the coverage guard. Only `game/snake/periods`
(166 levels on one phone, ≈1.6 s, ≈5× any other scenario) gets an explicit timeout (20 s).

### Task 10 - Demo: WebAudio and the vibration indicator

**Files:** `packages/nokia-os/demo/{index.html,main.ts,style.css}`, `packages/nokia-os/README.md`.

- [x] A `StockSoundPort` in the demo: one `AudioContext` created on the first user gesture; the
      buzzer as a square `OscillatorNode`, the tone generator as a sine (the emulator renders it
      so; the earpiece path is quieter, Open question 2), each through a `GainNode` set from
      `volume` by a documented table; events scheduled at
      `ctx.currentTime + (atMs - phoneNow) / 1000 + 0.03`; a mute toggle. The vibrator drives a
      `VIBRA` lamp and a CSS shake of the LCD frame (`prefers-reduced-motion`: lamp only).
- [x] A "Factory settings" button that restarts the phone over storage seeded with the factory
      state (the demo boots virgin by default, plan 15 D4, and the virgin phone is nearly
      silent; Open question 3).
- [x] An event log under the status line (the last 8 events, `atMs output state`) so headless runs
      can check sound without hearing it.
- [x] Verify with `mise exec -- vp run @hellotimber/nokia-os#demo` and `agent-browser`: Factory
      settings; a keypad beep in the log; Tones › Ringing tone ▼ (Nokia tune's first notes ≈950
      ms later, the lamp on); C stops it; Menu 1 9 logs `Invalid shortcut`'s tone. Screenshots
      in the completion note.
- [x] README: the sound port (a WebAudio example), what is evidence (D1), the asset policy for
      sound (D3), virgin vs factory sound, and what later plans add.
- [x] Commit: `feat(nokia-os): WebAudio and vibration in the demo`.

**Completion note (Task 10).** The demo's port (`WebAudioSound` in `demo/main.ts`) makes its
`AudioContext` on the first key or click, keeps a square buzzer and a sine tone generator running
behind gains set at each event's scheduled time, and maps `volume` by two documented tables
(buzzer: register 0/4/16/61/194 → gain 0/0.05/0.10/0.18/0.25, linear between; tone: the level
word's low nibble, 0x0 → 0.06 down to 0xE → 0.004, 0xF muted). A Mute box, the `VIBRA` lamp with a
CSS shake (lamp only under `prefers-reduced-motion`), **Factory settings** (erases the records,
writes the factory state, restarts) and an eight-line event log. Verified headless with
`agent-browser` (dev server on 5174; 5173 was taken): Factory settings and power-on logged the
power-on tone (`tone 900 v=0x9105`, 124 ms); Menu logged a 124 ms keypad beep at `0x9104`; in
Tones › Ringing tone, ▲ then ▼ onto Nokia tune logged `buzzer 1319 v=16` and `vibrator on` 991 ms
after the ▼, then 1175, 740, 831, 1109 … Hz with the lamp lit, and C stopped it (`buzzer off`);
Menu 1 9 logged `tone 1750 v=0x9105` for 289 ms; a Snake II meal (factory level 175, score 175)
logged `buzzer 2636.9 v=6` for 6 ms and the vibrator for 480 ms. Screenshots:
`/tmp/nokia-os-p16-{keypad-beep,ringing-list,ringing-preview,vibra,invalid-shortcut,snake-start,snake-meal}.png`.
Observed, not changed: with the demo's 60 ms key holds, Menu 1 9's beep sounds 67 ms before
`Invalid shortcut`'s tone replaces it, since the kernel opens the note at the 9's release.

### Task 11 - Verification gate and closeout

**Files:** this plan, `docs/plans/README.md`, `docs/specs/nokia-3310.md`.

- [x] `mise exec -- vp check --fix`, `mise exec -- vp run -r test`,
      `mise exec -- vp run website#build`; `git diff --stat <commit before Task 1> -- website/` is
      empty.
- [x] Spec §10: replace "(plan 16, in progress)" with verified facts; list what stays
      UNVERIFIED (loudness, the earpiece timbre, anything Task 0 could not capture).
- [x] Plans README row 16 `done`. Completion notes; status `done`.
- [x] Commit: `docs: complete tones and sound (plan 16)`.

**Completion note (Task 11).** `vp check`, `vp run -r test` (nokia-os: 2967 passed, 15 expected
failures, 67 todos in ≈15.4 s) and `vp run website#build` pass; `git diff --stat 65d9a52 -- website/`
is empty, and phone-core is unchanged. Spec §10 "Tones and sound (plan 16)" states the verified
facts and what stays UNVERIFIED: loudness and the earpiece's timbre; Standard at Ringing volume
Levels 1-3; the message `Beep once` word at Levels 2-3 and unset; the message Ascending at levels
other than 4; `ring()` for the five tones with no captured second pass, and Ring once and Beep once
as they ring; Navi and C on the game-over screens; the power-off tone's timing. Plan 22 owns the
dialling tones: digits at standby beep 900 Hz until number entry exists, and DTMF needs the
`StockSoundEvent` extension for the tone generator's second oscillator (`sound/keypad/keys` and
`hold` stay pending:22).

## Follow-up plan adjustments

- **17 - Profiles:** switching the active profile changes `settingAlias`; keypad tones, warning
  tones and the vibrator follow with no plan 16 change. Silent's Keypad tones Off and alert Off
  make it silent through the same settings.
- **18 - Messages and Chat:** a received message calls `StockSounder.messageAlert(profile)`.
- **21 - Clock and Reminders:** the alarm and reminder alarms need their own captures and
  programs on the sequencer.
- **22 - Call register and Call divert:** an incoming call calls `ring(profile)`; `Ring once` and
  `Beep once` as they ring; DTMF on the tone generator's second oscillator (`dsp_tone2_hz`; a
  contract extension then).
- **24 - Games II:** their cues through `StockCueSink`, as Snake II's.
- **27 - Composer (new row, D14):** the editor, Options, Tempo, Play/Stop through
  `StockSounder.play`, saved tones in the Ringing tone list's `(empty)` slots (a Composer EEPROM
  record).
- **Portfolio integration (not sequenced):** the website keeps its own audio until it adopts
  nokia-os; then `website/src/phone/{audio,composer,tones}.ts` are replaced by a port like the
  demo's.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Composer (D14):** its own plan 27 after plan 18. Reverse by adding its tasks here after
   Task 9.
2. **Volume and timbre (D4, Task 10):** the port carries the firmware's registers; the demo's gain
   table and the tone generator as a quiet sine are choices, since loudness and the earpiece's
   sound are not captured. Reverse by measuring a real phone, or by flattening every level to one
   gain.
3. **Demo state (D7, Task 10):** the demo still boots the virgin EEPROM (plan 15 D4) and offers a
   Factory settings button. Reverse by seeding the factory state on first boot.
4. **Latency (D8, D12):** the 25-43 ms key-to-beep latency and the tone's lead over a note's
   redraw are not reproduced, as screens do not reproduce theirs.
5. **Factory-state goldens (D7):** sound goldens assert the factory image's behaviour while LCD
   goldens assert the virgin one. Reverse (virgin-only sound) and almost everything is silent.
6. **Programs from one level (D10):** each tone is stored once and levels come from a fitted
   rule. Reverse by storing all 175 level recordings as programs (≈5× the sound fixtures).
7. **Previews of other profiles (D9):** follow the edited profile if Task 0 shows it; otherwise
   the active profile.
8. **The S9 quirk (D9):** reproduced only if Task 0 confirms that the first ▼ out of an unset list
   is silent.
9. **WAV files (D1):** never committed. Reverse only if waveforms become evidence (they are the
   emulator's synthesis today).

## Conflicts found while planning

- Spec §8 says key beeps are "short square-wave" beeps; the capture shows the DSP tone generator
  (earpiece path) at 900 Hz for ≈140 ms. The website's 1800 Hz, 30 ms square beep stays (D15).
- Plan 14's scope says Ringing tone previews are silent; that holds only for the virgin EEPROM.
- Plan 23 D8 says plan 16 wires the cue sink to `PhoneEventMap.sound`; that event is the
  website's id-only contract, so nokia-os uses its own port (D4).
- The plans README and plan 13's follow-up list put the Composer in plan 16; D14 moves it to a new
  plan 27 (the README row is added by Task 1).
- Spec §8 calls 5-7 `Warning and game tones`; v6.39 shows `Warning tones` (the menu-tree spec
  already notes it).
- Plan 23's spec text says a meal sounds 2637 Hz "for one or two timer units"; its fixture shows 6
  and 20 ms. Task 0's game section decides.
- The brief asks for "incoming-call alert types as far as previews go": the Incoming call alert
  list previews nothing itself (S5); its types act through the Ringing tone and volume previews.

## Done means

- A host passing `sound` receives every buzzer, tone-generator and vibrator change with its
  kernel time; nokia-os uses no audio API; the demo plays them and shows the vibrator.
- Keypad tones, ringing and message tone previews (all 35 tones), volume levels, Ascending, alert
  types as previews use them, the Vibrating alert, warning tones on notes and Snake II's cues
  match their sound goldens (frequencies and volume registers exact; edges ±2 ms within a
  program; onsets within `SOUND_ONSET_TOLERANCE_MS`; game cues within `GAME_TICK_TOLERANCE_MS`).
- Every sound program is generated from committed sound goldens imported from captures; nothing
  from `$REF/extracted` is in the repo.
- No golden or placeholder names plan 16; the Composer is plan 27's.
- phone-core and the website are unchanged; `vp check`, `vp run -r test` and
  `vp run website#build` pass; VISION, the specs and the plans README match what shipped.
