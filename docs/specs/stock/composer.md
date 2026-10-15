# Stock v6.39 Composer (plan 27, in progress)

Part of the stock firmware's ground truth ([index](../nokia-3310.md#10-firmware-ground-truth-v639-captures)):
the goldens under `packages/nokia-os/goldens/` are authoritative; where this file and a golden
disagree, fix this file. Source: plan 27 Task 0 (`$REF/captures/6.39/plan27/`, 418 still cases and
253 recordings from `gen_v639_plan27.py`; the planning probes K1-K13 in
[plan 27](../../plans/27-composer.md)). Paths below are under `plan27/`.

## Slots and editor

- Tones › Composer (5-4) is a rows list of seven slots, `(empty)` or the saved tone's name
  (`slots/*`), indicator `5-4-k`, soft key `Select`, opening on slot 1 every time.
- The editor: a three-note icon top left, the tokens left (`50` … `0`) top right, the notation in the
  small face from x 0 on lines with tops 8, 18 and 28, soft key `Back` while empty, else `Options`.
  Back or C on an empty editor, and Options › Exit, return to the Tones page `Composer`; unsaved
  edits are lost. A saved slot opens on its tone with the cursor at the end.

## Keys (on key-down; no key on the editor beeps)

| Key                        | Effect                                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-7                        | insert c … b after the cursor, with the value and octave of the nearest note before the cursor (rests skipped; none: 4, octave 1); never its dot or sharp |
| 1-7 held                   | ≈771 ms after the key-down (aligned on its redraw) the inserted note becomes dotted and sounds again (750 ms: plain, 800 ms: dotted)                      |
| 0                          | insert a rest with the nearest note's value (no dot); held: once                                                                                          |
| 8 / 9                      | the token before the cursor: 4 → 8 → 16 → 32 → 1 → 2 → 4 (8), the other way (9); notes and rests; dots kept                                               |
| `*`                        | the note before the cursor: octave 1 → 2 → 3 → 1 (rests: nothing)                                                                                         |
| `#`                        | the note before the cursor: sharp on/off for c, d, f, g, a (also dotted); nothing on e, b, rests                                                          |
| ▲ / ▼                      | cursor one token right / left over tokens + 1 positions, wrapping; held: repeats at ≈778 ms, then every ≈196 ms                                           |
| C                          | delete the token before the cursor (nothing at the start); held: clear all ≈465 ms after the deletion                                                     |
| C while a note key is held | no deletion: the held note is entered again at C's down and up (key rollover)                                                                             |

At 50 tokens, notes, rests and held notes are ignored silently; 8, 9, `*`, `#`, the cursor and C
still work. Notation: `[value][.][#]<note><octave>` (`16.#f2`) or `[value]-` (`8-`).

## Layout and blink

A token joins a line while the line (small-face advances, one space between tokens) is at most
83 px wide; tokens never split (`layout/edge-83` fits, `layout/edge-84` wraps). Three lines show;
the view scrolls as little as the cursor needs. The cursor is a 1 px bar (the line's rows 7-16)
right after the token before it, on that token's line. Leaving Options (C, Tempo, Save, Play)
puts the cursor at the end. The blink runs free while an editor shows (Play included): 478 ms,
then every 480.1 ms. It starts shown the first time an editor shows after power-on and after
Save's `Tone saved`, hidden at every other showing (a reopened slot, the return from Options or
Tempo). Five showings after a Save break this rule (`open/saved-save`, `leave/saved-cleared-reopen`,
`leave/saved-exit-edited`, `save/keys/prefilled-edit`, `restore/slot-1`): the rule behind them is
UNVERIFIED (neither a phase kept while covered nor one inverted at each showing fits every still).

## Options, Tempo, Play

- Options: `Play Save Tempo Send Clear screen Exit` (rows, indicator `1`-`6`, `OK`, opening on Play;
  C returns to the editor). Its keys beep as plan 16's lists.
- Tempo: `40 45 50 56 63 70 80 90 100 112 125 140 160 180 200 225 BPM` (rows, no indicator,
  `Select`), opening on the tone's tempo on the top row; OK → `Done` → Options on Tempo; C → Options.
- A new tone's tempo is the one last set (Tempo, saved or not) or saved since power-on; 112 after a
  cold boot; Restore factory settings keeps it (`newtempo/*`, `persist/new-tempo`,
  `restore/new-tempo`).
- Play: soft key `Stop`, the tone once on the buzzer, then `Options`. C and Stop end it at once (the
  sounding note cut; C deletes nothing); C held then goes to standby. ▲/▼ move the cursor and 0
  inserts a rest while it plays on; a note key, 8, 9, `*` and `#` edit and their note replaces it;
  any key turns the soft key back to `Options`. Clear screen empties the editor at once.

## Sound

- Pitches c1 … b3: 523, 554, 587, 622, 659, 698, 740, 784, 831, 880, 932, 988 Hz, doubled per
  octave (to 3951.4 Hz). Periods are integer timer units of ≈7.745 ms per tempo and value, plain
  and dotted (`sound/tempo/<bpm>`; 112 BPM quarter: 67 units = 519 ms, not 536); a note sounds for
  its period less ≈15.5 ms; a rest is silent for its period. Single notes jitter by ±1 unit and a
  recording can run ≈1 % long, so comparisons use plan 16's drift tolerance.
- Volume: the Ringing volume's `VOLUME_RULE` tables (Levels 1-4), Level 5 Level 4's at first,
  Ascending and an unset volume Level 1's; Incoming call alert, Keypad tones, Warning tones and
  Vibrating alert change nothing; no vibrator. In a long Play, Level 5 jumps to the fifth table and
  Ascending steps up a level at times that follow a free-running timer (≈3.9 s apart, UNVERIFIED
  as a rule).
- Each entry sound (a note key, or 8, 9, `*`, `#` changing a note) plays that note for its duration
  at the tone's tempo, replacing the one before.

## Save and Send

- Save: `Tone name:` (plan 18's prompt: pen, `Abc`, counter 15, `Back` while empty), prefilled with
  a saved tone's name (typing appends); OK → `Tone saved` → Options on Save; C or Back on the empty
  prompt → Options; C held on text clears it; C held on the empty prompt goes back to Options at
  its down and to standby ≈482 ms after it (`save/c-held-empty`). Two slots may share a name. The
  prompt's cursor starts hidden for one blink step; each character key restarts the blink shown (C,
  `#` and `*` do not). A name too wide for the large face is drawn in the small face on two lines
  (`save/keys/fifteen`; nokia-os draws the large face only, plan 18's prompt).
- Send: the same prompt, then `Phone number:` (counter 30, `Search` → `No phone numbers`); C on the
  empty number → the editor, its header still showing the prompt's pen (`send/keys/number-c`); OK → `Sending message` (≈3.2 s) → `Message sent` → the editor. The
  transmission is a binary Smart Messaging SMS (UDH port 5505); nokia-os stops at the number (plan
  18c, D11).

## Saved tones as ringing tones

Slot k is entry 35 + k of Tones › Ringing tone and every Personalise list (`5-1-36` is slot 1),
labelled with its name; OK shows the name as the page value. A preview starts ≈1 s after ▲/▼,
plays the tone once and, with Vibrating alert On, runs the vibrator from its start, toggling every
four quarter-note values of the tone, until its end. Ring once previews, Beep once and Off are
silent. The Ringing volume list plays the stored saved tone for ≈5.3 s. Level 5's jump and
Ascending's steps follow a free-running timer, not the tone (UNVERIFIED as a rule: nokia-os steps
3.9 s from the tone's start). At 225 BPM a preview holds each quarter 33 timer units (255.6 ms)
where Play holds 32 (one tone captured, slot 4: UNVERIFIED as a rule; nokia-os plays Play's
periods). Slots, names and tempi survive a power cycle; Restore factory
settings empties the slots and resets the ringing tone to `Nokia tune`.

## Artefacts

| Artefact                                               | Cause                            | Handling                                |
| ------------------------------------------------------ | -------------------------------- | --------------------------------------- |
| Every Send accepted (`CP/RP ACK`), nothing looped back | the emulator's synthetic network | plan 18c's synthetic network            |
| Durations as multiples of ≈7.745 ms, ±1 unit jitter    | emulator timebase (plan 23)      | the captured table; drift tolerance     |
| Key-to-redraw and key-to-sound latency (≈20-90 ms)     | firmware key scan                | not reproduced (plan 14 D8, plan 16 D8) |
| Loudness of the registers                              | the emulator renders no volume   | the port carries registers (plan 16)    |
| A note key re-entered at another key's down and up     | keyboard scan (key rollover)     | reproduced for C                        |

## The website's composer (contrast, unchanged)

`website/src/phone/composer.ts` plays equal temperament (a1 = 880 Hz), BPM arithmetic durations
(112 BPM quarter 535.7 ms) with no articulation gap, and accepts dotted rests; the firmware plays
the captured pitches and per-tempo periods with a ≈15.5 ms gap and never dots a rest.
