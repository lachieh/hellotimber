# Plan 27 - Composer

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 13, 14, 15 and 16 complete (the whole tree, stock widgets, EEPROM
records, the sound port, sequencer, sounder, `VOLUME_RULE` and ringing previews). Task 9 also
needs plan 18 Tasks 5-7 (the multi-tap engine, `textInput`, `numberEntry`); the slot labels need
plan 17 Task 4's `SubmenuOptions.label` seam, which Task 6 adds if plan 17 has not. The per-plan file split
(feature modules, per-plan capture sets and acceptance files, see "Conventions") must have landed
before Task 2; if it has not, stop and report.
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only). Read
`$REF/captures/README.md` ("Script format", "Output format", "Plan 15 supplementary captures",
"Plan 16 supplementary captures") and plans 13-16 and 18 before starting. Task 0 writes this plan's
captures to `$REF/captures/6.39/plan27/`. The planning probes in `$REF/captures/scratch-plan27/`
(`NOTES.md` lists them) are evidence for this plan only and are never imported.
**Status:** in progress (Tasks 0-7 done).

## Goal

Replace the Composer placeholders (Tones › Composer, 5-4-1…7) of `@hellotimber/nokia-os` with the
stock v6.39 Composer, pixel- and timing-faithful to the captures:

- the seven slots, named by their saved tones, `(empty)` otherwise;
- the note editor: keys 1-7 (notes), 8 and 9 (shorter, longer), 0 (rest), `*` (octave), `#`
  (sharp), a held note key (dotted), ▲/▼ (cursor), C and held C, the 50-note limit, the notation
  drawn as the firmware draws it, with the counter, cursor and scrolling;
- Options: Play (with Stop), Save (`Tone name:`), Tempo (16 tempi), Send (`Tone name:`, `Phone
number:`), Clear screen and Exit;
- the sound: each edited note sounding as it is entered, Play, all at the Ringing volume's level;
- saved tones as entries 36-42 of every Ringing tone list (Tones and each Personalise): their
  names, the page value, their previews and the ringing that plan 22 will play;
- persistence in the phone's EEPROM, and Restore factory settings emptying the slots.

Sending a tone by SMS stops at the number entry: the transmission is a binary (Smart Messaging)
SMS, which plan 18's network port does not carry (D11). The website does not change (D14).

## Why this plan exists (measured gap)

| Area                 | nokia-os after plans 13-16                                         | Evidence (planning probes, `$REF/captures/scratch-plan27/`)                                                                        |
| -------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Composer (5-4-1…7)   | placeholders owned by 27 (4 LCD + 2 sound goldens `pending:27`)    | an editor with a three-note icon, a `50` counter, notation in the small face, Options of six entries (K1-K7)                       |
| Composer sound       | `StockSounder.play(program)` exists, nothing calls it              | notes sound on the buzzer as they are entered and on Play, at the Ringing volume's register tables, never the keypad beep (K8, K9) |
| Ringing tone 36-42   | `(empty)`, silent previews (`RINGING_TONES[index]` is undefined)   | a saved tone's name in Tones and every Personalise list, the page value, a one-pass preview with the vibrator (K12)                |
| Composer EEPROM data | none                                                               | slots, names, tempi and notes survive a reboot; Restore factory settings empties every slot and resets the ringing tone (K13)      |
| Glyphs               | small face lacks `#` (plan 14 Task 6)                              | the notation needs `#`, `.` and `-` in the small face; the editor icon, the `Tone name:` prompt (plan 18), `Tone saved` (large)    |
| Website              | `website/src/phone/composer.ts`: equal temperament, exact BPM math | captured frequencies and per-tempo durations differ from BPM arithmetic (112 BPM quarter: 519 ms period, not 536 ms) (K10, D3)     |

## Composer investigation (planning, 2026-10-14)

Probes A-G in `$REF/captures/scratch-plan27/` ran on plan 15's factory-restored image
(`firmware/work/v639-plan15-restored.fls`, `scripts/v639-factory-setup.inc`; Ringing volume Level 4,
Incoming call alert Ringing, Keypad tones Level 2, Warning tones and Vibrating alert On), driven by
`tools/harness/cap` (A) and `tools/menutree/emu.py` with `fork`/`exit` (B-G). Taps are the
harness's 42 ms presses ≈615 ms apart unless a probe says otherwise. Probe E derailed after its
first lines (navigation) and B's first run timed its tempo plays wrongly (`out-b-run1/`); both are
disregarded where `NOTES.md` says so. The crawl's `tree/_with-content/05-tones/` (a tone `A` =
`4c1 4d1 4e1` saved in slot 1) and plan 14's `open/5-4-*` (virgin empty editors) agree.

| #   | Source                                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | A, B, F; crawl                                 | Composer is a rows list of seven slots `(empty)` (indicator `5-4-k`, `Select`, the circular window). A saved slot shows its tone's name (`A`, `B`), also after a reboot. Leaving an editor returns to the Tones page `Composer` (5-4), and the list opens on slot 1 again.                                                                                                                                                                                                                                                                                                                         |
| K2  | A (`a11-empty`), plan 14 `open/5-4-1`          | The empty editor: a three-note icon top left, the counter `50` top right (digits face), a 1 px cursor blinking ≈480 ms at the start of line 1, soft key `Back`. Back and C on an empty editor go to the Tones page (two levels up), discarding nothing saved.                                                                                                                                                                                                                                                                                                                                      |
| K3  | A (`k1`-`k7`, `m1`), C                         | 1-7 insert `c d e f g a b` after the cursor as `4c1` (duration 4, octave 1) and the counter drops by one. A new note copies the duration and octave of the token before the cursor (`1c2` after `1b2 1-`; `4a1` inserted after `4c1`); a rest copies its duration only. With notes the soft key is `Options`.                                                                                                                                                                                                                                                                                      |
| K4  | A (`k8*`, `k9*`, `ks*`, `kh*`), C (`s*`, `r*`) | 8 shortens the token before the cursor through 4, 8, 16, 32, 1, 2 (wrapping); 9 lengthens the other way; both work on rests. `*` cycles a note's octave 1, 2, 3; `#` toggles a sharp on c, d, f, g and a only (e, b and rests unchanged). 0 inserts a rest (`4-`) with the duration but not the dot of the token before. Held `*`, `#` and 8 act once.                                                                                                                                                                                                                                             |
| K5  | A (`kd*`), C (`h-*`), F (`hold-note`)          | A note key held ≥ ≈800 ms (300, 500 and 700 ms: plain; 900 and 1200 ms: dotted) gives a dotted note (`1.d2`, `4.e1`). The note is inserted and sounds at the key-down; ≈770 ms later it sounds again as the dotted note and the dot is drawn (≈820 ms). A held 0 inserts a plain rest.                                                                                                                                                                                                                                                                                                             |
| K6  | A, B (`p*`), C (`u*`, `d*`, `c*`, `l-*`)       | Notation: `[duration][.][#]<note><octave>` or `[duration]-`, tokens separated by one space, drawn in the small face from x 0, three lines, **wrapped by character** at the right edge (`1- 1` / `-`), the view scrolled so the cursor's line shows. ▲ moves the cursor one token right, ▼ one token left, both wrapping (end ↔ start). C deletes the token before the cursor at its key-down; C held clears every token ≈510-530 ms after the key-down. 50 tokens at most: the counter reads `0` and further notes, rests and inserts are ignored silently (8, 9, `*`, `#` still edit).            |
| K7  | B (`o*`, `tempo-*`), C, F, G                   | Options: `Play, Save, Tempo, Send, Clear screen, Exit` (rows, indicator = position `1`-`6`, `OK`, opening on Play; C returns to the editor). Tempo: `40 45 50 56 63 70 80 90 100 112 125 140 160 180 200 225 BPM` (rows, no indicator, soft key `Select`), opening on the tone's tempo with it on the top row; OK shows `Done` (698/232/534 ms), then Options on Tempo; C returns to Options. Clear screen empties the editor at once (no query). Exit returns to the Tones page; unsaved edits are lost.                                                                                          |
| K8  | A (`a-all`), C (`g-*`)                         | In the editor no key beeps (no 900 Hz tone for ▲/▼, C, held C, `*`, `#`, 0 or Navi). A note key, and 8, 9, `*` or `#` when it changes a note, sounds that note on the buzzer for its sounding time at the tone's tempo (quarter at 112 BPM: 503 ms), replacing the note sounding before. Rests are silent.                                                                                                                                                                                                                                                                                         |
| K9  | B (`play-pitch`, `tNN-play`), C (`g-*`, `p-*`) | Play sounds the tone once on the buzzer, soft key `Stop`, then the editor. Volume registers are plan 16's Ringing volume tables (Level 4: 523 Hz → 11; Level 1: → 3). Incoming call alert Off and Beep once, Keypad tones Off, Warning tones Off and Vibrating alert Off change nothing; the vibrator never runs. Ascending plays Level 1's table and Level 5 Level 4's from the start (3-note tones; later steps not yet captured). During Play ▲/▼ move the cursor and the tone plays on; C and Stop end it after the sounding note; a note key inserts its note, whose sound replaces the tone. |
| K10 | B (`play-pitch`, `tNN-play`)                   | Pitches c1 … b3 are 523, 554, 587, 622, 659, 698, 740, 784, 831, 880, 932, 988 Hz, doubled per octave (b3 3951.4 Hz; 13 MHz / divider). Each note sounds for its period less ≈16 ms. Periods at 112 BPM: 1 2091, 2 1038, 4 519, 8 255, 16 124, 32 62 ms; dotted 1 3113, 2 1556, 4 782, 8 387 ms; at 225 BPM 1031, 519, 255, 124, 55, 23 ms; at 40 BPM 5795, 2896, 1448, 720, 356, 170 ms: quantised (≈7.745 ms timer units, plan 23), not BPM arithmetic. Frequencies 3729.2 and 3951.4 Hz are missing from `VOLUME_RULE`.                                                                         |
| K11 | C (`o-save*`, `o-send*`), D, G                 | Save: `Tone name:` (pen, `Abc`, counter 15, `Back` while empty; plan 18's prompt), prefilled with a saved tone's name; OK → `Tone saved` (tick 690/246/517 ms) → Options on Save. Back or C on the empty prompt → Options on Save; C held on the prompt → standby. Send: the same prompt, then `Phone number:` (counter 30, `Search`, then `OK`); C there returns to the editor; OK → `Sending message` (the hatched bar, ≈3.0 s) → the `Message sent` envelope (≈1.6 s) → the editor. The emulator logs `MO SMS to 0412345678 text="…"` with binary content.                                      |
| K12 | D (`rt-*`, `rv-*`, `silent-rt`), crawl         | Slot k is Ringing tone entry 35 + k (`5-1-36` = slot 1) in Tones and in every Personalise list (`12-2-2-1-36`), labelled with its name; choosing it shows the name as the page value. Its preview starts ≈1011 ms after ▲/▼ and plays the tone once, with the vibrator on/off every ≈2071 ms (Vibrating alert On). At Level 5 the register jumps to a louder table at the 8th note (≈3.6 s); Ascending starts at Level 1 and steps at ≈3.6, ≈7.8 and ≈11.9 s (inside a note too). The Ringing volume list plays the stored user tone for ≈5.2 s.                                                   |
| K13 | B (reboot), D (`restore`), F                   | Saved tones, names and each tone's own tempo survive a power cycle; a new tone starts at the last tone's tempo (`225` after `A` at 225), the factory default is 112 BPM. Emptying a saved slot's editor (C or Clear screen) and leaving keeps the saved tone. Restore factory settings empties all seven slots and resets the ringing tone to `Nokia tune`.                                                                                                                                                                                                                                        |

Conclusions:

1. **The Composer is an editor over a list of tokens** with its own key rules (K3-K6), not plan
   18's text editor: its keys are notes, its cursor moves by token, it wraps by character.
2. **Its sound is computed, not recorded per tone.** A tone is notes from a 36-pitch table played
   for per-tempo durations at the Ringing volume's registers (K9, K10). The tables come from
   captures (D3); the program is generated from the tone at play time.
3. **Saved tones are the seven user entries of the Ringing tone lists** (K12), so they reach plan
   16's previews and plan 22's ringing through one resolver in the sounder (D8).

## Scope and non-goals

In scope: the Goal items; Task 0's captures; the composer's LCD and sound goldens, engine,
programs, EEPROM record, widgets, painter and feature module; the sounder hooks of D8 and D10;
documentation in `docs/specs/stock/composer.md`.

Deliberately left to later plans (each in "Follow-up plan adjustments"):

- **Sending a tone** (the binary Smart Messaging SMS behind `Sending message`) and **receiving
  tones by SMS** → plan 18c, which extends `StockNetworkPort` with binary payloads for picture
  messages (D11).
- **Ringing an incoming call with a saved tone** → plan 22 (`ring(prefix)` already resolves user
  tones after D8).
- **The other languages' strings** → plan 26.
- **The website's composer** stays as it is (D14).

## Decisions

Each decision states what changes relative to the brief and to plans 13-18.

**D1 - The Composer is a stock flow per slot; its rules are a pure engine (plan 20 D4 pattern).**
Node 5-4-k opens a `StockFlowApplication` whose root widget is the editor; it pushes the Options
list, the Tempo list, the `Tone name:` prompt, notes and the `Phone number:` entry, as other stock
leaves do. The rules (insert, modify, delete, clear, cursor, limit, the layout's character wrap
and scroll) live in `src/composer/editor.ts` and `src/composer/layout.ts`, pure, with no widget,
timer or storage, so they are tested without a phone. The editor leaves with `flow.back(2)` (K2,
K7: two levels, to the Tones page; as plan 14's `EXIT_LEVELS`).

**D2 - The key rules are the captured ones; spec §8 is corrected in places.** As K3-K6: 8 is
shorter and 9 longer, both cycling; `*` cycles the octave; `#` toggles a sharp on c, d, f, g, a
only; 0 inserts a rest with the token-before's duration; a held note key gives a dotted note; new
tokens copy the duration (and, for notes, the octave) of the token before the cursor; ▲ moves
right and ▼ left by one token, wrapping; C deletes before the cursor, held C clears; 50 tokens.
The spec's "▲/▼ move cursor" (unspecified direction) and "8/9 minor-UNVERIFIED" become verified
facts; its manual example (`16.a2 16d2 16#f2 …`) is the notation K6 draws. Task 0 settles the
remaining cases (inheritance after a rest at the start, `#` on a dotted note, the hold threshold
against the kernel's 800 ms long press, C during the hold) and a Deviation records any change.

Deviation (Task 0): a new note and a rest copy the nearest **note** before the cursor (rests
skipped; none: 4, octave 1), not the token before (`entry/note-after-rest-shorter`: `4c2 8- 4d2`);
the hold threshold is the editor's own ≈771 ms (not the kernel's 800 ms long press); `#` sharpens a
dotted note; C while a note key is held re-enters the held note at C's down and up (key rollover)
and deletes nothing; ▲/▼ held repeat (≈778 ms, then ≈196 ms).

**D3 - Pitches and durations are tables derived from captured events, never BPM arithmetic or
equal temperament (plan 16 D3 applied).** `scripts/composer-programs.ts` (pure) derives from the
composer sound goldens: `PITCHES` (36 frequencies as the buzzer logs them, K10), `TEMPI` (the 16
BPM labels in list order) and `DURATIONS[tempo]` (for each of the six values, plain and dotted:
the sounding ms and the gap ms), plus the rest rule. They are generated into
`src/resources/generated/composer.ts` and checked by a round trip: building each recorded tone's
program and rendering it reproduces its golden (edges ±2 ms within a recording, as plan 16's
programs). If a per-tempo rule in timer units fits every recording exactly, the generator may emit
it instead of the table, with the table kept as its test (plan 16 D10's standard). Nothing from
`$REF/extracted` or `website/src/phone/composer.ts` is used.

Deviation (Task 0): periods are integer timer units per tempo and value (plain and dotted), a
note sounds for its period less 2 units; single notes jitter by ±1 unit and a recording can run
≈1 % long, so the table is the sweep's per-tempo mode and programs are compared with plan 16's
drift tolerance (25 ms + 1.2 % of the offset, a note's own edges within one unit), not ±2 ms.

**D4 - Volume: the Ringing volume's tables, no gate, no vibrator (new; reuses plan 16 D10).**
Play and the entry sounds use the stored Ringing volume's `VOLUME_RULE` table (an unset volume:
Task 0's virgin recording decides, provisionally Level 1's, as plan 16's ringing previews), whatever
Incoming call alert, Keypad tones, Warning tones and Vibrating alert say (K9). Level 5 and
Ascending during a long Play follow what Task 0's long recordings show (provisionally: Level 4's
and Level 1's tables throughout, the 3-note captures). The composer's pitch goldens at Levels 1-5
join plan 16's volume-table fit (one registration in `extract-resources`), so `VOLUME_RULE` gains
the frequencies the ringing tones lack (3729.2 and 3951.4 Hz at least) and every path that reads
it (Play, previews of saved tones, `ring()`) stays exact; a frequency whose register disagrees
with an existing table entry fails the fit, naming both goldens.

Deviation (Task 0): confirmed for short tones (Level 5 plays Level 4's table, Ascending and unset
Level 1's); in a long Play, Level 5 jumps and Ascending steps at free-running-timer times (≈3.9 s
apart); nokia-os uses D9's nearest behaviour for Play too.

**D5 - Keys act on key-down; the editor beeps nothing (plan 23 D7 pattern; plan 16 D8
exception).** The firmware draws and sounds note keys, C and held C at the key-down (K5, K6), so
the editor handles keys in `onKeyDown` and times holds itself (the hold threshold and held C's
clear from Task 0's recordings, generated into `COMPOSER_TIMINGS`). Every key-down on the editor
(during Play too) sends plan 16's `silent-key` cue (K8), and `StockSounder.keyDown` gives a
silenced key no held beeps (a one-line sounder change, D10); the Options and Tempo lists and the
prompts beep as other stock screens do unless Task 0 shows otherwise. The firmware's key-to-redraw latency is not reproduced (plan 14 D8).

Deviation (Task 0): confirmed; the Options key that opens the list is silent too (it is an editor
key-down), the keys inside Options and Tempo beep. During Play every key-down is silent.

**D6 - A tone is a value; the program is built from it (new).** `ComposerTone = { name, tempo,
tokens }`. `toneProgram(tone, level)` builds a `SoundProgram` (buzzer steps from `PITCHES` and
`DURATIONS`, volumes from `VOLUME_RULE` at `level`), `notePreview(token, tempo, level)` the
single-note program of K8. The editor plays them through `StockSounder.play` and stops them
through a new `StockSounder.cancel(play, atMs?)` (D10): C and Stop end Play after the sounding
note, a note key's sound replaces it, ▲/▼ leave it playing (K9; Task 0 confirms with recordings).

Deviation (Task 0): C and Stop end Play at once (the sounding note is cut), not after it; ▲/▼
and 0 leave it playing; a note key, 8, 9, `*` and `#` replace it with their note.

**D7 - The Composer record (new; plan 15 D2).** `COMPOSER_RECORD` (`nokia-os/composer`, version

1. holds `{ slots: (ComposerTone | null)[7], tempo }`: `tempo` is the tempo a new tone starts at
   (the last one set or saved, K13; virgin 112). Tokens are stored as their notation strings and
   decoded with the engine's parser (an invalid token drops the slot, plan 15 D2's stale-content
   rule). The record has a `factory` that empties every slot and resets `tempo` (K13: Restore
   factory settings), and the ringing tone reset to `Nokia tune` is plan 15's `FACTORY_DEFAULTS`
   already. Only Save writes; leaving an editor discards unsaved edits (K1, K7, K13). Registered in
   `STOCK_RECORDS`.

Deviation (Task 0): the new tone's tempo is RAM state (the last set or saved since power-on; 112
after a cold boot; Restore factory settings keeps it), so `COMPOSER_RECORD` holds the slots only and
`StockComposer` keeps the new-tone tempo for the phone's life.

**D8 - Saved tones are Ringing tone entries 36-42 through one resolver (new; needs one sounder
hook).** Slot k (1-7) is option index 34 + k of every ringing-tone setting (`tones/ringing-tone`,
`profiles/<p>/personalise/ringing-tone`). The feature provides `ringingToneLabel(index)` (the slot's
name, else the tree's `(empty)`), read by the Ringing tone lists when they open and by the page
value (shared-file edits in `leaves.ts` and the page detail), and `userRingingTone(index)` (a
`RingingTone`-shaped value: the tone's program at Level 4's registers, its vibrator track, its
preview length and its Level 5 and Ascending positions, D9), which the sounder consults where
`RINGING_TONES[index]` is undefined. So previews, the Ringing volume list and plan 22's `ring()`
need no other change; an empty slot stays silent (plan 16 Task 0).

**D9 - A saved tone's preview follows a rule Task 0 fits (new; plan 16 D10's standard).** K12
shows one pass (not two cycle marks), a ≈2071 ms on/off vibrator, Level 5's jump at the 8th note
(≈3.6 s) and Ascending steps at ≈3.6/7.8/11.9 s, and the Ringing volume list stopping at ≈5.2 s,
for one 30-note tone. Task 0 records saved tones of different lengths and tempi (shorter than one
step, around the jump, longer than 20 s) in every list and alert type and fits each quantity to
time, notes or passes. A rule is accepted only if it reproduces every recording; otherwise the
captured cases are the goldens and other tones are UNVERIFIED in the spec, with the documented
nearest behaviour (as plan 16's message Ascending at other levels).

Deviation (Task 0): the preview plays once; its vibrator starts with it and toggles every four
quarter-note values of the tone until its end; the Ringing volume list stops ≈5.3 s after the start.
Level 5's jump and Ascending's steps fit no rule of the tone (3627-5309 ms; steps ≈3.9-4.3 s apart):
the captured cases are goldens and nokia-os's nearest behaviour (a step every 3.9 s from the tone's
start) is UNVERIFIED; recordings it misses are known gaps.

**D10 - The sounder changes are three small hooks, each pinned (shared-file edits).**
`src/sound/sounder.ts` gains (a) `userTones?: (index: number) => RingingTone | undefined`, consulted
by `#tone` and `preview` for indices `RINGING_TONES` lacks; (b) `cancel(play, atMs = now)`; (c) a
key silenced at its key-down (`silent-key`, a note's tone) schedules no held beeps. Each comes
with a sounder test, and every plan 16 sound golden still passes (none holds a silenced key). If a
hook needs more than this, stop and report: the sounder is plan 16's file.

**D11 - Send stops at the number entry; the transmission is plan 18c's (decision; the brief's
"defer to 18's network port").** Send runs `Tone name:` and `Phone number:` (plan 18's
`textInput` and `numberEntry`) as captured, with C on the number returning to the editor (K11).
OK on the number opens a placeholder owned by `18c`: the firmware sends a binary Smart Messaging
SMS, and plan 18's `StockNetworkPort` carries numbers and text only (plan 18 D9). Task 0 records
the full Send flow and the payload the emulator logs (hex, for 18c), and its goldens are
`pending:18c`. Reverse by adding a binary payload to the port in this plan (a contract change).

After Task 0: the payload is a Smart Messaging ringtone SMS (UDH port 5505); its first 60 CP-DATA
bytes are in `send/ok.log.txt` for plan 18c.

**D12 - Prompts and notes are plan 14 and 18 widgets (dependency).** `Tone name:` is plan 18's
`textInput` (limit 15, the captured layout, prefilled with a saved name; C held on it → standby,
K11), `Phone number:` its `numberEntry`. Options is `OptionListWidget` (numbering by position,
opening on Play); Tempo is `OptionListWidget` with numbering `none` (plan 17 Task 7 adds it; this
plan adds the one line if it has not landed) and soft key `Select`. `Tone saved` and the Tempo
`Done` are timed notes with their own generated timelines. If plan 18 Task 7 has not landed when
Task 9 starts, Task 9 waits; every other task ships.

**D13 - Slot labels from the kernel's label reader (plan 17 D8 seam).** The Composer level's
children show their slot's name through `SubmenuOptions.label`; slugs and paths do not change
(`menu/tones/composer/empty-3`). If plan 17 Task 4 has not landed, Task 6 adds the seam exactly as
plan 17's "Contract changes" specify (VISION updated in Task 1 then), and plan 17 reuses it.

**D14 - The website does not change.** `git diff --stat <commit before Task 1> -- website/` is
empty at the end. `website/src/phone/composer.ts` (equal temperament with a1 = 880 Hz, exact BPM
durations, no articulation gap) is contrasted in the spec, not fixed.

## Ground truth and artefacts

| Source (`$REF/captures/`)                                           | Contents                                                                 | Use                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| `scratch-plan27/` (planning)                                        | probes A-G (K1-K13), `NOTES.md`                                          | evidence for the decisions; never imported          |
| `6.39/plan27/` (Task 0)                                             | every recording below, `cases.json`, `text.json`, events and `keys.csv`  | `composer/*` and `sound/composer/*` goldens         |
| `6.39/plan14/open/5-4-*` (existing)                                 | virgin Select on each empty slot                                         | `tree/05-tones/5-4-*.leaf`: `pending:27` → asserted |
| `6.39/plan16/notes/5-4-*` (existing)                                | the slot's Select beep (factory)                                         | `sound/note/5-4-{1,2}`: `pending:27` → asserted     |
| `6.39/tree/_with-content/05-tones/` (crawl)                         | a saved tone `A` in the slot list, editor, Options and Ringing tone list | reference only (plan 14 D5)                         |
| `firmware/work/v639-plan15-restored.fls`, `v639-plan15-seccode.fls` | factory image; image with a working code                                 | every section; Restore                              |

Artefacts (added to `docs/specs/stock/composer.md` in Task 1):

| Artefact                                               | Cause                            | Handling                                             |
| ------------------------------------------------------ | -------------------------------- | ---------------------------------------------------- |
| Every Send accepted (`CP/RP ACK`), nothing looped back | the emulator's synthetic network | plan 18c's synthetic network                         |
| Durations as multiples of ≈7.745 ms                    | emulator timebase (plan 23)      | reproduced as captured; UNVERIFIED on hardware       |
| Key-to-redraw and key-to-sound latency (≈20-90 ms)     | firmware key scan                | not reproduced (plan 14 D8, plan 16 D8)              |
| Loudness of the registers                              | the emulator renders no volume   | the port carries registers (plan 16 Open question 2) |

## Package boundaries

Unchanged from plans 13-16. nokia-os gains no dependency; phone-core changes only if Task 6 must
add plan 17's label seam (generic, opt-in). Scripts keep plan 13's conventions (Node type
stripping, `node:*` and sibling imports only).

## Contract changes

None to the public API. `createStockPhone`, `StockPhoneConfig`, `stockMenu`, `paintStockScreen`,
`missingStockGlyphs`, the storage and sound API are unchanged; the new storage key
`nokia-os/composer` is under `STOCK_STORAGE_PREFIX`. If Task 6 adds `SubmenuOptions.label`, it is
plan 17's contract, word for word, and Task 1 writes it into VISION.

## Internal API (for plans 18c and 22)

Fixed by Tasks 3-5; a change is a Deviation recorded here.

```ts
// src/composer/notation.ts (pure)
export type NoteValue = 1 | 2 | 4 | 8 | 16 | 32;
export type ComposerToken =
  | {
      readonly kind: "note";
      readonly value: NoteValue;
      readonly dotted: boolean;
      readonly pitch: "c" | "d" | "e" | "f" | "g" | "a" | "b";
      readonly sharp: boolean; // c, d, f, g, a only
      readonly octave: 1 | 2 | 3;
    }
  | { readonly kind: "rest"; readonly value: NoteValue };
export const COMPOSER_LIMIT = 50;
export function formatToken(token: ComposerToken): string; // "16.#f2", "8-"
export function parseTokens(text: string): readonly ComposerToken[]; // throws, naming the token

// src/composer/editor.ts (pure)
export interface ComposerState {
  readonly tokens: readonly ComposerToken[];
  readonly cursor: number; // 0..tokens.length, tokens before the cursor
}
export interface ComposerEdit {
  readonly state: ComposerState;
  readonly sound?: ComposerToken; // the note to sound (K8), if the key changed or added one
}
export function composerKeyDown(state: ComposerState, key: PhoneKey): ComposerEdit;
export function composerHeld(state: ComposerState, key: PhoneKey): ComposerEdit; // dotted note, C clear

// src/composer/layout.ts (pure)
export function composerLines(
  tokens: readonly ComposerToken[],
  cursor: number,
  previousTop?: number,
): {
  readonly lines: readonly string[]; // every wrapped line (character wrap, small face)
  readonly top: number; // first visible line (three shown)
  readonly cursorAt: { readonly line: number; readonly x: number };
};

// src/composer/program.ts
export function toneProgram(tone: ComposerTone, level: number | null): SoundProgram;
export function notePreview(
  token: ComposerToken,
  tempo: number,
  level: number | null,
): SoundProgram | undefined;
export function userRingingTone(tone: ComposerTone): RingingTone; // D8, D9 (plan 16's type)

// src/composer/store.ts
export interface ComposerTone {
  readonly name: string; // 1-15 characters
  readonly tempo: number; // one of TEMPI
  readonly tokens: readonly ComposerToken[]; // 1-50
}
export const COMPOSER_RECORD: EepromRecord<ComposerData>;
export class StockComposer {
  constructor(eeprom: StockEeprom);
  slot(k: number): ComposerTone | null; // 1-7
  save(k: number, tone: ComposerTone): void;
  newTempo(): number; // K13
  setNewTempo(tempo: number): void;
  ringingToneLabel(index: number): string | undefined; // option index 35-41 → name
  userRingingTone(index: number): RingingTone | undefined; // option index 35-41 → D8 tone
}
```

## Shared-file edits

One-line registrations unless stated. If the split provides a feature registry for any of these
(leaf bindings, level options, records, option labels, sounder hooks), register there instead.

| File                                                      | Edit                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/firmware/bindings.ts`, `scripts/tree-capture-set.ts` | drop `"5-4-*": "27"` from both `PLACEHOLDER_OWNERS` (one line each)                           |
| the feature list                                          | `composerFeature` (binds 5-4-1…7, the level's `label`, the option labels, `userTones`)        |
| `src/firmware/records.ts`                                 | `COMPOSER_RECORD`                                                                             |
| `scripts/capture-sets/index.ts`                           | `export { composer } from "./27-composer.ts"`                                                 |
| `scripts/extract-resources.ts`                            | the composer generator; the composer pitch goldens into plan 16's volume-table fit (D4)       |
| `src/resources/index.ts`                                  | the `COMPOSER_*` accessors                                                                    |
| `src/display/widgets/index.ts`                            | model union and paint switch (two lines)                                                      |
| `scripts/widget-sprites.ts`                               | the editor icon crop and the named timelines, only if the split does not route them per plan  |
| `src/firmware/leaves.ts`                                  | ringing-tone option lists read `ringingToneLabel` when they open (≈2 lines, D8)               |
| the page detail (`src/firmware/menu.ts` `pageDetail`)     | a ringing-tone page value reads `ringingToneLabel` (1 line, D8)                               |
| `src/sound/sounder.ts`                                    | D10's three hooks (≈10 lines, each with a sounder test)                                       |
| `src/widgets/option-list.ts`                              | `numbering: "none"` (one line), only if plan 17 Task 7 has not added it                       |
| `packages/phone-core/src/{types,menu,machine,index}.ts`   | `SubmenuOptions.label` per plan 17's contract, only if plan 17 Task 4 has not landed (Task 6) |

## Golden pipeline additions

No format change. Plan 27's capture set (`scripts/capture-sets/27-composer.ts`) holds LCD and sound
rows and exports `COMPOSER_CASES`: per still, the keys pressed from the editor's opening (Task 0's
`cases.json`, transcribed), so stills and their scenarios share one source. Sources are under
`$REF/captures/6.39/plan27/`; `state: factory` for sound unless noted; all `asserted` unless noted.

| Fixture id                                                              | Source                         | Kind     | Asserts                                                                   |
| ----------------------------------------------------------------------- | ------------------------------ | -------- | ------------------------------------------------------------------------- |
| `composer/slots`, `composer/slots-named`                                | `slots/*.png`                  | stills   | seven `(empty)` rows through the wrap; names after saves (K1)             |
| `composer/open`, `composer/open-saved`                                  | `open/*`                       | timeline | Select → empty editor and blink; a saved tone's editor                    |
| `composer/keys`                                                         | `keys/*.png`                   | stills   | 1-7, 8 and 9 through their cycles, `*`, `#` on every note, 0, inheritance |
| `composer/hold-<ms>`                                                    | `hold/<ms>`                    | timeline | the dotted threshold, the second draw (K5)                                |
| `composer/cursor`, `composer/layout`                                    | `cursor/*.png`, `layout/*.png` | stills   | ▲/▼ both ways through the wrap; character wrap; scroll; 50 tokens         |
| `composer/delete`, `composer/clear-held`, `composer/limit`              | `delete/*`, `limit/*`          | mixed    | C, held C's clear time, the 50-token limit (K6)                           |
| `composer/leave-{back,c,exit,clear}`                                    | `leave/*`                      | timeline | Back, C on empty, Exit, Clear screen; the Tones page after (K2, K7)       |
| `composer/options`, `composer/tempo`, `composer/tempo-done`             | `options/*`, `tempo/*`         | mixed    | the six entries through the wrap; 16 tempi, opening, `Done` (K7)          |
| `composer/play`, `composer/play-{c,stop,up,note}`                       | `play/*`                       | timeline | Stop, the return to the editor, keys during Play (K9)                     |
| `composer/save-*`                                                       | `save/*`                       | timeline | prompt empty and prefilled, typing, `Tone saved`, Back, C, C held (K11)   |
| `composer/send-{name,number,c}`                                         | `send/*`                       | timeline | the two prompts, C back to the editor (K11)                               |
| `composer/send-ok`                                                      | `send/ok`                      | timeline | `pending:18c` (D11)                                                       |
| `composer/ringing-tone-{tones,personalise,page}`                        | `ringing/*`                    | mixed    | names at 36-42, the page value (K12)                                      |
| `composer/persist`, `composer/restore`                                  | `persist/*`, `restore/*`       | stills   | after a power cycle; after Restore factory settings (K13)                 |
| `sound/composer/entry-*`                                                | `sound/entry/*`                | sound    | every key kind's sound or silence, no keypad beeps (K8)                   |
| `sound/composer/pitch-level-{1..5}`, `-unset` (virgin)                  | `sound/pitch/*`                | sound    | the 36 pitches at every level (K10, D4)                                   |
| `sound/composer/tempo-<bpm>` (×16)                                      | `sound/tempo/*`                | sound    | every value, dotted and rest at every tempo (K10, D3)                     |
| `sound/composer/play-{alert-off,ascending,level-5,long}`, `play-keys-*` | `sound/play/*`                 | sound    | gating, long Play at Level 5 and Ascending, keys during Play (D4, D6)     |
| `sound/composer/preview-*`, `sound/composer/volume-list-*`              | `sound/preview/*`              | sound    | saved tones' previews per list, level and alert type (D9)                 |

`tree/05-tones/5-4-{1,3,4,5}.leaf` and `sound/note/5-4-{1,2}` become `asserted` when `5-4-*`
leaves the owner tables (Task 2). The new goldens' text runs (OCR, `plan27/text.json`) feed the
glyph harvester through the capture set: the small face gains `#` (and `.`/`-` if no golden has
them yet). Sound recordings follow plan 16's conventions (`keys.csv`, raw key edges, `@loop` never:
nothing loops).

## Stock display observations (from the scratch sheets; Task 7 measures from goldens)

| Element        | Observation                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Editor header  | a three-note icon at x ≈1..16, y 0..5; the counter (`50`…`0`) right-aligned in the digits face                       |
| Notation       | small face from x 0, three lines (tops ≈8/18/28), character-wrapped; the cursor a 1 px bar after the token before it |
| Soft key       | `Back` (empty), `Options`, `Stop` (Play), centred at y 40                                                            |
| Options, Tempo | plan 14 rows lists; Options indicator `1`-`6`; Tempo no indicator, `Select`                                          |
| `Tone name:`   | plan 18's text input: pen, `Abc`/`abc`, counter `15`, box y 16..36, large text, `Back`/`OK`                          |
| `Tone saved`   | large `Tone` / `saved` with the tick icon (plan 14's note class)                                                     |

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- **File ownership (the per-plan split).** This plan writes its own files only: `src/composer/**`,
  `src/firmware/features/composer.ts`, `src/widgets/composer.ts`,
  `src/display/widgets/composer.ts`, `scripts/capture-sets/27-composer.ts`,
  `scripts/composer-programs.ts`, `src/resources/generated/composer.ts` (generated),
  `tests/composer-*.test.ts`, `tests/support/composer.ts`, `tests/acceptance/27-composer.test.ts`,
  `docs/specs/stock/composer.md`, this plan and row 27 of the plans README. Shared files get only
  the edits in "Shared-file edits", each in the task that names it; if one needs more, stop and
  report. `demo/` is not edited.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` and the named test commands. A task that touches
  `phone-core` also runs `mise exec -- vp run -r test` and `mise exec -- vp run website#build`.
- Commit rule: run `mise exec -- vp check --fix` yourself, stage files by explicit path, then
  `git commit --no-verify -m "<message>"`. Never `git add -A`/`git add .`. Never stage `TODOS.md`
  (Lachlan's untracked notes).
- Never hand-edit `goldens/**`, `src/resources/generated/**`, `src/firmware/generated/**` or
  `scripts/generated/**`; change the generator input and regenerate. Each generator runs twice with
  no diff before its commit.
- Tests never read `$REF`. Generators that read `$REF` fail clearly when it is missing.
- No new dependencies.
- When reality differs from this plan, follow the captures and append a `Deviation:` paragraph
  under the task. If a deviation breaks a contract in VISION.md, stop and report.
- Parallelism (max 3 concurrent agents): Task 0 gates everything, then Task 1. Then lanes A (2 →
  4), B (3 → 5) and C (6). Task 7 needs 2 and 3; Task 8 needs 4, 5, 6 and 7; Task 9 needs 8 and
  plan 18 Task 7; Tasks 10 and 11 need 8 (they may run beside 9: their tests seed the store);
  Task 12 needs 9, 10 and 11; then 13.

## Tasks

### Task 0 - REF captures (no repository changes)

**Files (all under `$REF`, gitignored):** `captures/scripts/gen_v639_plan27.py`,
`captures/scripts/v639-plan27-<section>.cap` (each section's command stream, fork/exit included),
`captures/6.39/plan27/**`, a "Plan 27 supplementary captures" section in `captures/README.md`,
`firmware/work/v639-plan27-*.fls`.

Write only these paths (concurrent sessions use the harness). Drive sections as plans 16 and 20
did (`tools/menutree/emu.py` with `fork`, checking the LCD by OCR before each recording; the
scratch drivers `probe_*.py` are a starting point). Factory sections start from
`v639-factory-setup.inc`, virgin ones from `v639-setup.inc`; open the Composer with Menu 5 4 and
wait for the slot list (`5-4-1`). Every recording is `audio` + `record` of one name with
`keys.csv` and raw key edges (plan 16's convention); still sections write one `shot` per case and
append `{ name, keys }` to `plan27/cases.json` (keys from the editor's opening). Avoid the probes'
traps: C held on the `Tone name:` prompt and on lists goes to standby; after Exit the slot list
opens on slot 1; OK on a tempo returns to Options on Tempo, not the editor.

- [x] **S slots and open:** the virgin and factory slot lists through the wrap (stills); Select on
      slots 1, 3 and 7 (record 3 s: the empty editor's blink); after saving tones in slots 1, 2
      and 7, the list (stills) and Select on a saved slot (record).
- [x] **E entry** (stills, factory): every note key; 8 six times and 9 six times from 4; `*` four
      times; `#` twice on each of c-b and on a rest; 0 after a plain and after a dotted note; 8/9
      on a rest; a note after a rest at the start, after a rest mid-tone, after a dotted note;
      insertion at the start, middle and end; every token form in the small face (for glyphs).
- [x] **H holds** (records, raw edges): each note key held 600, 700, 750, 800, 850, 900 and 1500 ms
      (the threshold, the second draw and sound); 0, `*`, `#`, 8, 9, ▲, ▼ and C held 1.5 s; C held
      300-700 ms in 50 ms steps (the clear time); a held note at the limit.
- [x] **U cursor and layout** (stills): a 50-token tone of mixed forms; ▲ ×51 and ▼ ×51 with a
      shot after each (raw taps, a shot 80 ms after the release so the cursor shows); the view's
      scroll each way; tones whose tokens break across lines at every character position of a
      `16.#f2`.
- [x] **L limit:** 50 tokens: a note, 0, a held note, 8, 9, `*`, `#` (stills and sound).
- [x] **X leaving** (records): Back on an empty editor, C on an empty editor, Exit with unsaved
      changes, Clear screen then Back, a saved slot emptied by C then Back, then each slot reopened.
- [x] **O lists:** Options through its wrap (stills), C on it; Tempo through its wrap from each of
      three openings; OK on 40 and on 225 (record `Done` to Options); C on Tempo.
- [x] **P play** (factory, audio + record): a short tone (Stop, the end, the return); C, Stop, ▲,
      ▼, a note key, 0, 8 and `#` pressed 1.5 s into Play (each in a fork); Play with Incoming call
      alert Off, Ring once and Beep once, Keypad tones Off, Warning tones Off, Vibrating alert Off;
      a 40 s tone at Level 5 and at Ascending (does Play step?); Play in the virgin state
      (Ringing volume unset).
- [x] **T tempo sweep** (factory, audio): one tone holding every value plain and dotted and rests
      of every value (≤ 50 tokens, the token order recorded), saved, then played at each of the 16
      tempi (`sound/tempo/<bpm>`); the same at two other levels for two tempi (volume ↔ tempo
      independence).
- [x] **F pitch** (audio): the 36-pitch tone (sixteenths) played at Levels 1-5 and in the virgin
      state; entry sounds of a note at each octave at Level 1 and 5.
- [x] **N names** (records): Save on a new tone (empty prompt, `Abc`), typing a 15-character name
      and a 16th key, a name with symbols, OK, `Tone saved`, Options; Save on a saved tone
      (prefilled), editing the name; Back, C and C held on the empty and the prefilled prompt; two
      slots saved with one name.
- [x] **R ringing tones** (factory, audio): saved tones of 3, 8, 30 and 50 tokens at 40, 112 and
      225 BPM in slots 1, 2, 3 and 7. Tones › Ringing tone: entries 35-42 (stills), each saved
      tone's preview (record 40 s) at Levels 1-5, Ascending, Ring once, Beep once and Off, and with
      Vibrating alert Off; OK on one (the `Done` and page value); the Ringing volume list's
      previews with a saved tone stored (each level); General's and Silent's Personalise lists
      (stills, one preview each); a stored saved tone then overwritten in its slot (the preview
      after); Restore factory settings with a saved tone stored (page value after).
- [x] **M persistence** (`firmware/work/v639-plan27-persist.fls`): three saved tones, one chosen
      as the ringing tone, a new-tone tempo of 63; `saveflash`, `reboot`, the slot list, each
      editor, the Tempo openings (saved and new), the ringing tone page; Restore factory settings
      on `v639-plan15-seccode.fls` with tones saved: the slots, a slot's editor, the new-tone
      tempo, the ringing tone page.
- [x] **Snd send** (`ROM6_LOG=1`): Send's two prompts, C on each, Search on the empty number, OK
      on a number (record to the editor: `Sending message`, `Message sent`); log the MO SMS
      payload in hex (a harness-only helper in `dct3cap.c` if the log is not hex) for plan 18c.
- [x] **G glyphs:** every token form and the counter's digits are in some still (E, U); OCR every
      image (plan 15's command with `OUT='plan27'`) into `plan27/text.json`.
- [x] `gen_v639_plan27.py check`: every case has its image; every recording starts on its parent
      screen; every factory sound recording has events and `keys.csv`; the tempo sweep's tones
      parse and their note count matches their events.
- [x] Append "Plan 27 supplementary captures" to `$REF/captures/README.md` (commands, the K table,
      the outcome below).
- [x] No commit. Record the outcome under this task: the key rules and the cases D2 left open, the
      hold threshold and held C's time, the wrap and scroll rules, the duration table or rule per
      tempo, the gap, the pitch table, the volume at every level and in the virgin state, Play's
      gating and keys, the saved-tone preview rule (D9) or its failure, the new-tone tempo rule,
      persistence and Restore, Send's payload, and any section that failed.

#### Task 0 outcome — 2026-10-14

51 sections of `$REF/captures/scripts/gen_v639_plan27.py` (each `v639-plan27-<section>.cap`);
`check` passes: **418 still cases, 253 recordings, 3724 images (458 distinct) OCRed in
`plan27/text.json`** (faces bold8, large13, plain8, tiny6). `cases.json` holds `{ name, from, state,
slot, setup, keys, setupKeys }` (`from`: `editor`, `slots` or `standby`; every editor still waits
for the cursor's shown phase, the wait being its last `+<ms>` key); `recordings.json` lists the
recordings with their keys. The REF README's "Plan 27 supplementary captures" is appended. Paths
below are under `plan27/`.

- **Keys (D2 confirmed and settled).** 1-7 insert `4c1`…`4b1` after the cursor; a new note copies
  the value and octave, a rest (0) the value, of the **nearest note before the cursor, rests
  skipped** (`4c2 8- 4d2`, `entry/note-after-rest-shorter`; `32.#c3 16- 16- 32-`, `entry/forms-2`),
  never its dot or sharp; with no note before, 4 and octave 1 (`entry/note-after-rest-start`: `8-
4c1`). 8 cycles 4→8→16→32→1→2, 9 the other way, on notes and rests, dots kept (`8.c1`); `*` cycles
  the octave 1→2→3; `#` toggles c, d, f, g, a (dotted too: `4.#c1`); `*` and `#` do nothing on rests
  and e/b. ▲ moves right, ▼ left, both wrapping over tokens+1 positions. C deletes the token before
  the cursor (nothing at the start). Held: 0, `*`, `#`, 8, 9 act once; a note key down ≥ ≈771 ms
  after its key-down redraw dots the note (hold 750 ms plain, 800 ms dotted; the dotted note sounds
  again then); C held clears ≈465 ms after the deletion's redraw (held 450 ms deletes only, 500 ms
  clears); ▲/▼ held repeat at ≈778 ms, then every ≈196 ms. 50 tokens: notes, rests and holds are
  ignored silently (no sound, no beep), 8/9/`*`/`#` still edit (`limit/*`). C pressed while a note
  key is held does not delete: the firmware re-enters the held note at C's down and at its up (key
  rollover, `hold/c-during`, `hold/c-after-dot`); other keys UNVERIFIED.
- **Layout (Deviation from K6).** Lines wrap at **token boundaries** — no token splits in any still
  (`layout/prefix-*`, `rests-*`, the 50-token `cursor/*`): a token joins the line while the line's
  width in the small face (advances, single spaces) is ≤ 83 px (`layout/edge-83` fits, `edge-84`
  wraps). Lines start at x 0, tops 8/18/28, three shown; the cursor (1 px, rows 7-16 of a line) sits
  right after the token before it, on that token's line (x = the line's width up to it); the view
  scrolls as little as the cursor needs (`cursor/up`: start → top 0; `cursor/down`). Leaving Options
  (C, Tempo, Save, Play's end) puts the cursor at the end (`returns/*`); a saved slot opens with the
  cursor at the end.
- **The cursor's blink.** 480 ms per phase; the phase flag is phone state: it starts shown at
  power-on, toggles every 480 ms while an editor shows (Play included) and keeps its value while
  none does; each time an editor appears (Select, the return from Options) its 480 ms timer
  restarts with the flag as it was (`open/slot-1` shown first; `open/saved`, `returns/options-c`
  hidden first).
- **Durations (D3).** Periods are integer timer units of ≈7.745 ms (40 BPM: 1 = 749, 2 = 374, 4 =
  187, 8 = 93, 16 = 46, 32 = 22 units); a note sounds for its period less 2 units (≈15.5 ms);
  dotted periods are separate table entries (40 BPM: 4. = 280 units); a rest is silent for its
  value's period. No BPM formula fits (112 BPM quarter 67 units = 519 ms, not 536). Single notes
  jitter by ±1 unit and a recording can run ≈1 % long (`sound/pitch/level-4`: 125.4 ms per
  sixteenth against 124 at Level 2), so the table is the per-tempo mode of the sweep and programs
  are compared with plan 16's drift tolerance, not ±2 ms (Deviation). At 225 BPM a 32nd after a
  dotted 32nd sounded 1 ms (`sound/tempo/225`, dropped by normalisation).
- **Pitches.** c1 … b3 = 523, 554, 587, 622, 659, 698, 740, 784, 831, 880, 932, 988 Hz, doubled per
  octave to 3951.4 Hz (13 MHz / divider, as logged); 3729.2 and 3951.4 Hz are new to `VOLUME_RULE`
  (Level 1: 19/19, Level 3: 44/42, Level 4: 66/62).
- **Volume and gating (D4 confirmed).** Play and entry sounds use the Ringing volume's tables
  (Levels 1-4 exact), Level 5 Level 4's, Ascending and the virgin (unset) volume Level 1's;
  Incoming call alert, Keypad tones, Warning tones and Vibrating alert change nothing; no
  vibrator. A long Play at Level 5 jumps to the fifth table (≈3.86 s, inside a note) and at
  Ascending steps Level 1→4 (≈3.87, 8.21, 11.59 s); a 4.5 s Play at Level 5 did not jump.
- **Play and its keys (Deviation from K9).** Play starts ≈26 ms after OK (latency, not
  reproduced), soft key `Stop`, the editor with the cursor at the end; at its end `Options`. C and
  Stop end Play **at once** (the sounding note is cut, C deletes nothing); C held during Play then
  goes to standby (≈530 ms); ▲/▼ move the cursor and 0 inserts a rest while the tone plays on; a
  note key, 8, 9, `*` and `#` edit and their note's sound replaces the tone; any key turns the soft
  key back to `Options`.
- **Entry sounds (K8, D5 confirmed).** No key-down on the editor beeps (notes, 8, 9, `*`, `#`, 0,
  ▲/▼, C, held C, Back, and the Options key that opens the list: `sound/entry/*`); keys in Options
  and Tempo beep as plan 16's lists (the C that returns to the editor too). Each entry sound plays
  the note for its duration at the tone's tempo and replaces the one before at once; rests and
  moves are silent.
- **Options, Tempo, notes.** Options `Play Save Tempo Send Clear screen Exit` (rows, `1`-`6`, `OK`,
  opening on Play); Tempo 16 entries, no indicator, `Select`, opening on the tone's tempo on the
  top row; OK → `Done` (≈690/232/556 ms) → Options on Tempo; Save OK → `Tone saved` (same shape) →
  Options on Save. Clear screen empties at once; Exit and Back/C on an empty editor return to the
  Tones page `Composer`.
- **New tone's tempo (Deviation from K13/D7).** A new tone starts at the tempo last set (Tempo,
  saved or not) or saved in this power-on (`newtempo/*`); it is RAM state: 112 after a cold boot
  (`persist/new-tempo`) and kept by Restore factory settings (`restore/new-tempo`: 225). So
  `COMPOSER_RECORD` holds the slots only.
- **Save / Send (K11 confirmed).** `Tone name:` is plan 18's prompt (pen, `abc`/`Abc`, counter 15,
  `Back` while empty, `OK`); a saved tone's name is prefilled (typing appends: `Cd`); C held on
  text clears it; C (or Back) on the empty prompt → Options. Send: the same prompt, then `Phone
number:` (counter 30, `Search` → `No phone numbers` → the prompt); C on the empty number → the
  editor; OK → `Sending message` (≈3.17 s) → the `Message sent` animation (≈1.4 s) → the editor.
  The MO SMS (`send/ok.log.txt`, harness-p27 `smsseg`): CP-DATA `39 01 40 …`, RP-DATA to SC
  `12345678905`, TP-DA `0412345678`, UDH `06 05 04 15 81 15 81` (port 5505: Smart Messaging
  ringtone), data `02 4A 3A 45 04 04 00 13 1A CA E9 22 84 93 42 4A A0 …`; the first 60 bytes of the
  67-byte CP-DATA were seen (the final segment never enters the buffer).
- **Saved tones as ringing tones (K12 confirmed, D9 partly).** Slot k is entry 35+k of Tones' and
  every Personalise's list (`5-1-36` = slot 1, `12-1-2-1-38` = slot 3), labelled with its name;
  OK shows its name as the page value. A preview starts ≈991-1035 ms after ▲/▼ and plays the tone
  once; the vibrator (Vibrating alert On) starts with it and toggles every 4 quarter-note values
  of the tone (a bar: 2071 ms at 112 BPM; 8 eighths at 40), stopping at the tone's end. Ring once
  previews; Beep once and Off silence it; the Ringing volume list plays the stored saved tone and
  stops ≈5.31 s after its start (mid-note). **Level 5's jump (3627, 4329, 5309 ms) and Ascending's
  steps (first 3861-4318, second 7245-8638, third 11110-12240 ms) follow no rule of the tone,
  its tempo or its notes** (the same notes jump at 5309 ms in a preview and 3858 ms in Play): a
  free-running timer's phase. D9's fallback applies: the captured cases are goldens, the nearest
  behaviour is a 3.9 s step from the tone's start, documented UNVERIFIED.
- **Persistence and Restore (K13).** Slots, names and each tone's tempo survive a cold boot;
  Restore factory settings empties the slots and resets the ringing tone to `Nokia tune`.
- **Failures, all resolved.** `restore` first chose the wrong list entry; `ringing-list` left a
  fork open (rerun); the tempo sweep was rerun with a tone that separates dotted periods from rests
  (plain, dotted, plain, rest per value); `layout-edge`, `returns` and `ringing-4` were added after
  the first run raised the questions they answer. The ringing-list section composes its four tones
  in one power-on, so they take the new-tone tempo rule (slot 3 saved at 40 BPM, slot 7 at 80).

### Task 1 - Documentation

**Files:** `docs/specs/stock/composer.md` (new), `docs/specs/nokia-3310.md` (§8: a pointer only),
`docs/plans/README.md` (row 27), this plan; `VISION.md` only if Task 6 will add plan 17's seam.

- [x] Apply Task 0's outcome to D2-D9 and D11 (Deviation lines where it changes them).
- [x] `docs/specs/stock/composer.md`: K1-K13 as verified by Task 0 (slots, editor, keys, notation,
      layout, Options, Tempo, Play, sound tables, saved tones in the Ringing tone lists, Save,
      Send, persistence, Restore), the artefacts table, UNVERIFIED items, and the contrast with the
      website's composer. Marked "(plan 27, in progress)".
- [x] Spec §8: mark the Composer bullet manual-sourced history and point to the stock spec (8 is
      shorter, ▲ moves right, `#` on five notes, a held key dots, 50 tokens, tempi 40-225).
- [x] Plans README row 27 `in progress`.
- [x] No runtime code. `mise exec -- vp check --fix`.
- [x] Commit: `docs: specify the stock Composer (plan 27)`.

### Task 2 - Capture set, goldens and the re-owned placeholders (TDD)

**Files:** `scripts/capture-sets/27-composer.ts` (new), `scripts/capture-sets/index.ts` (one line),
both `PLACEHOLDER_OWNERS` tables (one line each), `tests/composer-capture-set.test.ts` (new),
`goldens/**` (generated).

- [x] TDD the capture set on synthetic sources (injected loader, no REF): every row of "Golden
      pipeline additions"; stills named by `COMPOSER_CASES` in case order; a case with no image, or
      an image with no case, throws naming both; sound rows reuse plan 16's normalisation with
      `state: factory` (`virgin` where noted); `composer/send-ok` is `pending:18c`.
- [ ] Drop `5-4-*` from both owner tables: the four `tree/05-tones/5-4-*.leaf` and
      `sound/note/5-4-{1,2}` goldens become asserted; no golden is `pending:27`.
- [x] Text runs from `plan27/text.json` reach the glyph harvester through the capture set; run
      `extract-resources` twice (no diff): the small face gains `#` and what else the notation needs.
- [x] Run `import-captures` twice; the second run changes nothing. Record counts and bytes in a
      completion note.
- [x] Until Task 12, the composer goldens without a scenario are todos through the split's
      pending-scenario mechanism (one entry in this plan's acceptance file, deleted in Task 12).
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): import Composer captures (plan 27)`.

**Task 2 completion.** `scripts/capture-sets/27-composer.ts` (registered by one line) holds
`COMPOSER_CASES` (Task 0's 418 cases, transcribed with their start, state, slot and setup),
`COMPOSER_SETUPS` (the named setups' keys from standby) and `COMPOSER_RECORDING_KEYS` (the
recordings' keys); `scripts/resource-inputs/27-composer.ts` crops the editor's icon
(`composer/icon`) and names the `Tone saved` and Tempo `Done` notes (`composer-tone-saved`,
`composer-tempo-done`). `import-captures` writes **303 plan 27 goldens** (30 stills holding the 418
cases, 81 timelines, 192 sound goldens; 302 `pending:27`, `composer/send-ok` `pending:18c`;
3 385 759 bytes); a second run leaves every byte unchanged and no other plan's golden or index
changes. `regenerate` twice: the first wrote `widgets.ts` (the icon and the two note timelines,
686/244/525 ms and the Done's), the second was up to date.

Deviation: the importing plan has no pending-scenario mechanism (as plan 20 found), so the
Composer goldens are imported `pending:27` and Task 12 promotes them; `tests/acceptance/
27-composer.test.ts` registers the plan with no scenarios until then.

Deviation: `5-4-*` stays in both owner tables until Task 8 binds the slots: dropping it now would
assert the four `tree/05-tones/5-4-*.leaf` goldens and `sound/note/5-4-{1,2}` against the
placeholder. Task 8 drops it with its drivers.

Deviation: no glyph changes: `#`, `.`, `-` and the digits are already in the small face (plans 14
and 18), so the capture set registers no text run; ids are the recordings' paths
(`composer/hold-note-3-800`, `sound/composer/tempo-112`, `sound/composer/preview-slot-3-level-5`).
Holds of keys other than 3 below 1500 ms are not imported (key 3's and every key's 1500 ms are).

### Task 3 - Notation, editor and layout engine (pure, TDD)

**Files:** `src/composer/{notation,editor,layout}.ts` (new), `tests/composer-notation.test.ts`,
`tests/composer-editor.test.ts`, `tests/composer-layout.test.ts` (new).

- [x] TDD `notation.ts`: `formatToken`/`parseTokens` round trips for every form Task 0 shows
      (`4c1`, `1.d2`, `16#f3`, `32.#a1`, `8-`); invalid tokens (`4#e1`, `3c1`, `4c4`) throw naming
      them.
- [x] TDD `editor.ts` from `COMPOSER_CASES` (expected tokens transcribed from the goldens'
      notation, independent of the code): each key's effect, inheritance, the 8/9 cycles, `*`,
      `#` on the five sharpable notes only, 0, held keys, C and held C, the cursor's wrap, the
      50-token limit and the keys that still edit there, and `sound` for every edit that sounds
      (K8).
- [x] TDD `layout.ts` against every still's notation lines and cursor (the OCR runs): character
      wrap at the small face's widths, three lines, the scroll rule Task 0 found, the cursor's x.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): Composer notation and editor engine`.

**Task 3 completion.** `src/composer/notation.ts` (`formatToken`, `formatTokens`, `parseTokens`,
`COMPOSER_LIMIT`), `editor.ts` (`composerKeyDown`, `composerHeld`, `isNoteKey`, `EMPTY_COMPOSER`)
and `layout.ts` (`composerLines`, `smallWidth`, `COMPOSER_LINE_WIDTH` = 83). 99 tests: 79 entry
and limit cases whose keys are checked against `COMPOSER_CASES` and whose notation and cursor are
transcribed from the images, the 15 lines of the 50-token tone, the 82/83/84 px edges, the cursor's
x and the view's tops through `cursor/up` and `cursor/down`. `tests/support/composer.ts` replays
harness keys through the engine with the measured hold times (Task 4 generates them).

Deviation (Task 0 U): the layout wraps at token boundaries, not by character, so `composerLines`
has no character wrap; the hold times live in the widget (Task 8), the engine only applies a hold.

### Task 4 - Composer sound tables and programs (TDD)

**Files:** `scripts/composer-programs.ts` (new, pure), `scripts/extract-resources.ts` (two lines,
D4), `src/resources/generated/composer.ts` and `sounds.ts` (generated), `src/resources/index.ts`
(export lines), `src/composer/program.ts` (new), `tests/composer-programs.test.ts` (new),
`tests/resources.test.ts` (pinned counts only).

- [x] TDD `composer-programs.ts` on synthetic goldens: pitches from buzzer frequencies; per tempo
      and value the sounding and gap times; the rest rule; a value missing at a tempo throws
      naming the golden.
- [x] Generate `COMPOSER_DATA` (`PITCHES`, `TEMPI`, `DURATIONS`, `COMPOSER_TIMINGS` for the hold
      threshold and held C) with comments naming their goldens; the composer pitch goldens join
      `VOLUME_RULE`'s fit (no existing table entry changes; the new frequencies appear).
- [x] TDD `program.ts`: `toneProgram` re-renders every `sound/composer/tempo-*` and `pitch-*`
      golden exactly (±2 ms within a recording); `notePreview` the entry goldens; levels per D4;
      `userRingingTone` per Task 0's D9 rule against the `preview-*` goldens (or the documented
      approximation, D9).
- [x] Freshness test; run `extract-resources` twice (no diff); plan 16's resources tests unchanged
      except the frequency count.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): Composer pitches, tempi and programs from sound goldens`.

**Task 4 completion.** `scripts/composer-programs.ts` derives `COMPOSER_DATA`
(`src/resources/generated/composer.ts`): the 16 tempi's periods in timer units (7.745 ms) plain
and dotted from the sweep (40 and 225 BPM the median of the Level 1, 3 and 4 sweeps), the gap (2
units), the 36 pitches, the dot (771 ms, `sound/composer/hold-note-3-800`) and C's clear (465 ms,
`composer/hold-c-*`), the saved tones' preview delay (1013 ms), the Ringing volume list's span
(5315 ms), D9's level step (4146 ms) and the unset volume's register (3); `addComposerVolumes`
joins the pitch goldens to `VOLUME_RULE` (3729.2 and 3951.4 Hz added at Levels 1-4, no entry
changed). Two registrations in `extract-resources.ts` (the volume tables, the `composer.ts`
module); `src/resources/index.ts` exports `COMPOSER_TEMPI`, `COMPOSER_PERIODS`,
`COMPOSER_PITCHES`, `COMPOSER_TIMINGS`, `COMPOSER_SOUND`. `src/composer/program.ts`:
`toneProgram`, `notePreview`, `userRingingTone`, `toneMs`, `noteHz`. 12 tests: the generator on
synthetic goldens, and the programs against all 16 sweeps, the Level 1 sweep, the pitch tone at
Levels 1-4 and unset (frequencies and registers exact, onsets within plan 16's drift, lengths
within two units), the entry note, Level 5/Ascending and the ringing tone's shape. `regenerate`
twice: the second up to date; `tests/resources.test.ts` pins `COMPOSER_DATA` in its freshness test.

Deviation: an unset Ringing volume plays every pitch at register 3 (`pitch-virgin`), not Level
1's table; it is `COMPOSER_SOUND.unsetVolume`.

Deviation: the repeat times of held ▲/▼ (778 ms, then 196 ms) are the hand fit of
`composer/hold-up`/`hold-down` recorded in the generator, not a derivation (the cursor's position
per frame needs the layout); Task 8's widget test checks them against those goldens.

Deviation (Internal API): `toneProgram(tone, level, { ascending })` takes the alert type's
Ascending (Play steps up a level per step), and `userRingingTone(tone, slot)` takes the slot (its
slug) and returns plan 16's tone shape plus `previewDelayMs` (1013 ms: the captured onsets spread
991-1035 ms, wider than the built-in tones' 991 ± 25). `sound/composer/pitch-level-5` did not jump
in its 4.5 s while D9's nearest step does at 4146 ms: its last notes differ (a known gap, Task 11).

### Task 5 - Composer record and slots (TDD)

**Files:** `src/composer/store.ts` (new), `src/firmware/records.ts` (one line),
`tests/composer-store.test.ts` (new), `tests/eeprom.test.ts` (pinned record list, if any).

- [x] TDD `COMPOSER_RECORD`: virgin (seven empty slots, tempo 112), encode/decode (tokens as
      notation strings), a slot with an invalid token or name dropped, version, `factory` per
      Task 0 (empty slots, tempo reset); the stored JSON pinned by a snapshot.
- [x] TDD `StockComposer`: `save` writes at once; `slot` reads it back over a second store on the
      same storage; `newTempo` per K13; `ringingToneLabel`/`userRingingTone` map option indices
      35-41 to slots 1-7 and return undefined for empty slots and other indices.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): Composer EEPROM record`.

**Task 5 completion.** `src/composer/store.ts`: `COMPOSER_RECORD` (`nokia-os/composer`, version 1:
seven slots of `{ name, tempo, tokens }`, tokens as notation; a stale name, tempo or token drops its
slot; `factory` empties every slot) and `StockComposer` (`slot`, `save`, `newTempo`, `setNewTempo`,
`ringingToneLabel`, `userRingingTone` for options 35-41). 9 tests, the stored JSON pinned.

Deviation: the record is registered by the new composer feature's `records` (plan 20's
precedent: `src/firmware/records.ts` composes features' records), so `features/composer.ts` and
its line in `features/index.ts` start here; `records.ts` and `tests/eeprom.test.ts` need no line.
Per Task 0 M the record holds no new-tone tempo: `StockComposer` keeps it in RAM (112 at
construction, the last set or saved after).

### Task 6 - The slot labels' kernel seam (conditional on plan 17 Task 4)

**Files:** `packages/phone-core/src/{types.ts,menu.ts,machine.ts,index.ts}`, README, `VISION.md`,
`tests/submenu-label.test.ts` (new, plan 17's name). If plan 17 Task 4 has landed, this task only
checks that `SubmenuOptions.label` exists as plan 17 specifies, records that here and commits
nothing.

- [x] Add `SubmenuOptions.label?(child)` exactly as plan 17's "Contract changes" specify, with
      plan 17 Task 4's `label` tests (list items and the child level's title follow the reader;
      re-read per tick; one snapshot per change; an empty string throws; paths and slugs
      unchanged). Plan 17 Task 4 then finds it and reuses it.
- [x] Existing tests pass unchanged; configs without the seam produce identical models.
- [x] `mise exec -- vp run @hellotimber/phone-core#test`, `vp run -r test`, `vp run website#build`,
      `vp check --fix`.
- [x] Commit: `feat(phone-core): submenu label reader`.

**Task 6 completion.** Plan 17 Task 4 had not landed on this branch, so phone-core gains
`SubmenuOptions.label?(child: MenuEntry<Metadata>): string | undefined` exactly as plan 17's
contract states, plus `SubmenuEntry.labelOf(child): string` (the reader's text, else the child's
label; an empty string throws; a reader's exception is contained). The level's list items, the
child's own level title (submenu, list or reader) and an application's activation title read it;
the tick signature includes the labels, so a change emits one snapshot. Tests:
`packages/phone-core/tests/submenu-label.test.ts` (9). VISION and the phone-core README document
it. Plan 17 Task 4 reuses it (its `label` tests are these).

### Task 7 - Composer painter, icon and glyphs (TDD against goldens)

**Files:** `src/display/widgets/composer.ts` (new), `src/display/widgets/index.ts` (two lines),
the editor icon crop and the composer's named timelines (in this plan's capture set if the split
routes crops and timelines per plan, else one line each in `scripts/widget-sprites.ts`),
`tests/composer-paint.test.ts` (new).

- [x] TDD a `composer` widget model (`tokens` laid out by `composerLines`, `cursor` shown or
      hidden, `counter`, `softkey`) painted against every editor still and every editor frame of
      the timelines: the icon sprite, the counter, the lines, the cursor bar, the soft key. A line
      that does not fit throws in tests (plan 13 D10).
- [x] The cursor blink, `Tone saved`, the Tempo `Done` and the leave timelines are generated from
      their goldens; Options, Tempo, the prompts and the notes reuse plan 14 and 18 painters (one
      still each paints exactly from its model).
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): paint the stock Composer`.

**Task 7 completion.** `src/display/widgets/composer.ts` paints a `composer` model (`lines` shown,
`cursor` line and x or null, `counter`, `softkey`): the `composer/icon` sprite at (1, 0), the
counter in the digits face ending at x 83, the lines in the small face from x 1 at tops 8/18/28,
the cursor a 1 px bar of 10 rows from the row above its line, the soft key at 40;
`src/display/widgets/index.ts` gains the import, the union member and the switch case. All 225
editor stills of `entry`, `limit`, `cursor` and `layout` paint pixel for pixel from their case's keys
through the engine and the layout (`tests/composer-paint.test.ts`). The `Tone saved` and `Done`
timelines were generated in Task 2; the cursor blinks at plan 18's `TEXT_TIMINGS.blinkMs` (480 ms,
Task 0's blink); Options, Tempo, the prompts and the notes are plan 14 and 18 widgets whose
stills Task 8's flow tests paint through the phone.

### Task 8 - The Composer feature: editor, Options, Play, Tempo, Clear screen, Exit (TDD)

**Files:** `src/widgets/composer.ts` (new), `src/firmware/features/composer.ts` (new), the feature
list (one line), `src/sound/sounder.ts` (D10's `cancel` and silenced-held-beeps hooks),
`tests/composer-flow.test.ts` (new), `tests/sounder.test.ts` (the two hooks),
`tests/support/composer.ts` (new: open a slot, replay a case).

- [ ] TDD the editor widget in the flow rig: keys on key-down through the engine, holds timed from
      `COMPOSER_TIMINGS`, the model from `composerLines`, the cursor blink, Back and C on empty →
      `flow.back(2)`, Options pushes the list (C returns), every key silenced (D5).
- [ ] Options: Play (soft key `Stop`, `toneProgram` through `StockSounder.play`, keys during Play
      per Task 0, the editor at the end), Tempo (opening on the tone's tempo, `Done`, Options on
      Tempo; sets the tone's and the new-tone tempo), Clear screen, Exit (`flow.back(2)`,
      unsaved edits lost). Save and Send push placeholders owned by 27 until Task 9 (stop and
      report if a golden needs them earlier).
- [ ] Entry sounds: each `ComposerEdit.sound` plays `notePreview` and replaces the previous one.
- [ ] Node 5-4-k opens the feature's application on slot k; the Composer level's `label` reads
      `StockComposer.slot(k)?.name ?? "(empty)"`; `stockMenu` keeps no placeholder for 5-4-\*.
- [ ] Sounder hooks (D10 b, c) with their tests; every plan 16 sound golden still passes.
- [ ] TDD through keys against the `composer/` goldens `open`, `keys`, `hold-*`, `cursor`,
      `layout`, `delete`, `clear-held`, `limit`, `leave-*`, `options`, `tempo*` and `play*`, and the
      four `tree/05-tones/5-4-*.leaf` goldens.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(nokia-os): the stock Composer editor, Play and Tempo`.

### Task 9 - Save and Send (TDD; needs plan 18 Task 7)

**Files:** `src/firmware/features/composer.ts`, `src/widgets/composer.ts`,
`tests/composer-save.test.ts` (new).

- [ ] Save: `textInput` with the measured `Tone name:` layout, limit 15, prefilled with a saved
      name; OK → `StockComposer.save` → `Tone saved` → Options on Save; Back and C on the empty
      prompt → Options on Save; C held → standby (K11). The slot list shows the name at once.
- [ ] Send: the same prompt, then `numberEntry` (`Phone number:`); C on the number → the editor;
      OK → a placeholder owned by `18c` (D11).
- [ ] TDD through keys against `composer/save-*`, `composer/send-{name,number,c}`,
      `composer/slots-named`, `composer/open-saved`, `composer/persist` (two phones over one
      storage) and `composer/restore` (`restoreFactory()`).
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(nokia-os): save Composer tones and the Send prompts`.

### Task 10 - Saved tones in the Ringing tone lists (TDD against goldens)

**Files:** `src/firmware/features/composer.ts`, `src/firmware/leaves.ts` (≈2 lines),
the page detail (1 line), `src/sound/sounder.ts` (D10 a), `tests/composer-ringing.test.ts` (new),
`tests/sounder.test.ts` (the hook).

- [ ] Ringing tone lists (Tones and every Personalise) label entries 36-42 with `ringingToneLabel`
      when they open; the page value of a stored saved tone is its name.
- [ ] The sounder's `userTones` resolves indices 35-41 through `StockComposer.userRingingTone`;
      previews in both lists, the Ringing volume list and `ring()` (one test, plan 22's call) play
      it with plan 16's delay, gating, volume and vibrator rules and D9's preview rule; empty slots
      stay silent (`sound/ringing-tone/empty` still passes).
- [ ] TDD through keys against `composer/ringing-tone-*`, `sound/composer/preview-*` and
      `volume-list-*`; plan 16's preview goldens unchanged.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(nokia-os): Composer tones in the Ringing tone lists`.

### Task 11 - Composer sounds (TDD against sound goldens)

**Files:** `tests/composer-sound.test.ts` (new), `tests/support/composer.ts`.

- [ ] Drive `sound/composer/{entry,pitch,tempo,play}-*` and `sound/note/5-4-{1,2}` from the
      factory state (`seededStorage({ factory: true })`; virgin rows from empty storage) with plan
      16's `recordSound`/`expectSoundTimeline` and tolerances: note onsets against their key-down
      (`KEY_LATENCY_MAX_MS`), a program's edges ±2 ms, no keypad beep inside the editor, Play's
      gating and levels, keys during Play.
- [ ] If a golden needs sounder behaviour beyond D10, stop and report: the sounder is plan 16's.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(nokia-os): Composer note sounds and Play`.

### Task 12 - Acceptance

**Files:** `tests/acceptance/27-composer.test.ts`, `tests/support/composer.ts`.

- [ ] One scenario per asserted composer golden (LCD and sound), replaying `COMPOSER_CASES` for
      stills and the recordings' keys for timelines; the four tree leaves and two `sound/note`
      goldens included. Delete Task 2's pending-scenario entry; the coverage guard fails for an
      asserted composer golden without a scenario and for nodes 5-4-1…7 if uncovered.
- [ ] Known gaps, if any, are listed with their cause in this file, as plan 16's are.
- [ ] Every other plan's goldens still pass.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp run -r test`,
      `mise exec -- vp check --fix`. Report this file's run time.
- [ ] Commit: `test(nokia-os): drive every Composer golden`.

### Task 13 - Verification gate and closeout

**Files:** this plan, `docs/plans/README.md` (row 27), `docs/specs/stock/composer.md`.

- [ ] `mise exec -- vp check --fix`, `mise exec -- vp run -r test`,
      `mise exec -- vp run website#build`; `git diff --stat <commit before Task 1> -- website/` is
      empty.
- [ ] Demo check (no demo edit): `mise exec -- vp run @hellotimber/nokia-os#demo` with
      `agent-browser` (Factory settings, Skip boot): Menu 5 4, Select, `1 2 3`, Options › Play (the
      event log shows 523/587/659 Hz), Save as `A`; Tones › Ringing tone ▼ to entry 36 shows `A`
      and previews it. Screenshots in the completion note.
- [ ] Spec: replace "(plan 27, in progress)" with verified facts; list what stays UNVERIFIED.
- [ ] Plans README row 27 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete the stock Composer (plan 27)`.

## Follow-up plan adjustments

- **18c - Chat and content:** Send's transmission: a binary Smart Messaging ringtone payload on
  `StockNetworkPort` (with picture messages), replacing the `18c` placeholder after `Phone
number:`; the `composer/send-ok` golden becomes asserted; receiving a tone by SMS saves it to a
  Composer slot (its captures belong to 18c).
- **22 - Calls:** an incoming call with a saved ringing tone plays it through `ring(prefix)`
  (D8 resolves it); Ring once and Beep once as they ring.
- **17 - Profiles:** the label seam (Task 6 adds it if 17 has not); Personalise lists already show
  saved tones (D8).
- **26 - Languages:** the Composer's strings (Options, `Tone name:`, `Tone saved`) in the other
  languages.
- **Portfolio integration (not sequenced):** the website's composer is replaced when the website
  adopts nokia-os.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Send (D11):** the prompts are built; OK on the number opens a placeholder owned by 18c,
   because the payload is a binary SMS. Reverse: extend `StockNetworkPort` with binary payloads in
   this plan (a public contract change).
2. **Tables, not BPM arithmetic (D3):** durations and pitches are captured tables (or a rule that
   reproduces every capture). Reverse only if a hardware capture disagrees.
3. **Volume (D4):** Play follows Ringing volume and ignores the alert type, as captured; Level 5
   and Ascending during a long Play as Task 0 shows.
4. **Saved-tone previews (D9):** a fitted rule if one reproduces every recording, else the captured
   cases plus a documented approximation (UNVERIFIED).
5. **Keys on key-down (D5):** as captured; the 800 ms kernel long press is not used for the dot.
6. **Restore (D7):** empties every slot (K13). Reverse by dropping the record's `factory`.
7. **Label seam (D13):** taken from plan 17 if landed, else added here exactly as plan 17 defines
   it.

## Conflicts found while planning

- Spec §8 lists Composer options `Play, Save, Tempo, Clear screen, Exit`; v6.39 also has `Send`
  (K7), and Tempo's values are 40-225 BPM (16).
- Spec §8 says `#` is a sharp (any note) and a held note key is dotted: `#` works on c, d, f, g, a
  only, and the hold needs ≈800 ms (K4, K5).
- Spec §8 says a saved tone is "appended to end of ringing-tone list": each slot has its fixed
  entry (36-42) whether earlier slots are empty or not (K12; Task 0 confirms with slot 7).
- Plan 16 D14 called the Composer "a text editor with Options … and 16 tempos" and said plan 27
  needs nothing from plan 16 beyond `StockSounder.play`; saved tones in the Ringing tone lists, the
  silenced keys and stopping Play need D10's three small hooks.
- Plan 18's planning note says plan 27 needs 18c's Smart Messaging send for Send; D11 builds the
  prompts and leaves only the transmission to 18c.
- The menu-tree spec's content crawl records Play as a "timed-note … then back to the list"; Play
  is the editor with soft key `Stop`, then the editor again (K9).
- The website's `composer.ts` derives 112 BPM's quarter as 535.7 ms; the firmware plays a 519 ms
  period with a ≈16 ms gap (K10).

## Done means

- Tones › Composer opens the stock Composer: slots, the editor, every key, Options, Play, Tempo,
  Clear screen, Exit, Save and Send's prompts match their goldens pixel for pixel and within ±2 ms
  after alignment; its sounds match their sound goldens with plan 16's tolerances.
- Saved tones persist in `nokia-os/composer`, appear as Ringing tone entries 36-42 everywhere,
  preview and ring through plan 16's sounder; Restore factory settings empties the slots.
- No golden or placeholder names plan 27 (Send's transmission is `pending:18c`); every asserted
  composer golden has a scenario.
- phone-core changes only by plan 17's seam if Task 6 added it; the website is unchanged;
  `vp check`, `vp run -r test` and `vp run website#build` pass; the spec and the plans README match
  what shipped.
