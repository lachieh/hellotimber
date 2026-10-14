# Plan 23 - Games I: Snake II

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 13 and 14 complete (`@hellotimber/nokia-os` with the whole v6.39 tree, the
Snake II splash, menu and widgets, the in-memory settings store). Plan 15 (storage port) is **not**
required: this plan writes scores to the in-memory store, and plan 15 makes the store persistent
(see D9).
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only): the
plan 14 goldens already committed for 8-1, the original `$REF/captures/6.39/game/` recording, the
exploratory runs in `$REF/captures/scratch-plan23/` (planning evidence, never imported), and the
canonical recaptures that Task 0 writes to `$REF/captures/6.39/plan23/`. Read
`$REF/captures/README.md`, plan 13 and plan 14 in full before starting.
**Status:** in progress (Tasks 0-3 done).

## Goal

Make Snake II (`Games › Snake II › New game`, node 8-1-1) playable in `@hellotimber/nokia-os`,
pixel- and timing-faithful to the v6.39 captures:

- gameplay: the 20x9 board, the stock sprites, wrap-around, the seven mazes' walls (No maze, Maze
  1-5), every key the firmware reads, food, growth, the bonus creatures and their countdown,
  scoring, the one-tick grace before a crash, the death blink, and the game-over screens (the plain
  `Game over!` note and the new-top-score fireworks);
- the per-level speed for every level the Level page can store, including the virgin EEPROM's
  out-of-range value (D2);
- the game's random numbers, reproduced so that recorded games replay exactly (D4);
- the scores the game writes: the top score (and what the firmware shows after it), with the Level
  page made stateful and the Top score note reading the stored value;
- suspend and resume: Navi during a game, the `Continue` entry it adds to the game menu, and
  resuming;
- sound and vibration as timed **cues** that plan 16 plays (D8);
- goldens for all of it, replayed by key-driven acceptance scenarios.

The website and `packages/snake` do not change (D1, D12). How the portfolio uses the stock OS is
decided later.

## Why this plan exists (measured gap)

| Area             | nokia-os after plan 14                                    | v6.39 captures                                                                                                                                                                                                                                 |
| ---------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New game (8-1-1) | placeholder (`ownerPlan` 23); golden `pending:23`         | `tree/08-games/8-1-1.leaf`: 4-digit score at x 0/4/8/12, double rule at y 6/8, frame x 0..83 y 8..47, a seven-segment snake on row 4 heading right, a 3x3 diamond food; one cell per ≈7.7 ms                                                   |
| Level (8-1-2)    | static sprite `level/8-1` (nine bars); ▲/▼ "inert" (P12)  | ▲/▼ are **not** inert: the virgin level is 175, drawn as nine bars; ▼ lowers it by one per press (Scratch evidence)                                                                                                                            |
| Top score        | note reads the virgin text `45`                           | the firmware writes a new top score at game over and shows fireworks and `TOP SCORE:` (RE notes, cross-check; Task 0 captures)                                                                                                                 |
| Suspend          | none                                                      | Navi during a game shows `Continue / New game / Level` with `8-1-1` on Continue and `8-1-2` on New game; C goes to the Games list; entering Snake II again opens on Continue (`scratch-plan23/out-pause/p/01`, `p/09-after-c`, `p/10-reenter`) |
| Speed            | "Snake II speed: emulator/EEPROM, out of scope" (plan 13) | explained: an EEPROM value, not an emulator fault (D2)                                                                                                                                                                                         |
| Engine           | `packages/snake` (website): 21x10 grid, mulberry32, …     | every rule differs from the firmware (D1 table)                                                                                                                                                                                                |

## Snake speed investigation (planning, 2026-10-14)

The REF README records "the snake moves one cell about every 8 ms; the Level screen shows all 9
bars and up/down do not change it; cause: a garbage level in the virgin EEPROM or emulator timing".
Exploratory runs in `$REF/captures/scratch-plan23/` (scripts `*.cap` beside their `out-*/`
results; nothing else in REF was written) settle it: **it is the virgin EEPROM's level value**, not
emulator timing and not the capture script.

1. **The game uses level 175.** `steer-12.cap` starts a virgin game and turns the snake (key 8,
   pressed 52 ms after Select) into the first food at cell (14, 8): the score goes `0000` → `0175`
   in one meal (`out-steer-12/g/008.png`). Points per food equal the level (RE notes, cross-check),
   so the game runs at level 175.
2. **The Level page clamps only its drawing.** `level-to-1.cap` presses ▼ on the virgin Level page
   185 times with a shot after each press from the 160th: the page shows nine bars up to press 166,
   eight bars at press 167, one bar at press 174, and stays at one bar after that. Ten ▲ presses
   then step the bars 2…9 and stay at nine. So the stored value is 175, ▼ lowers it by one per
   press, a value of 9 or more draws nine bars, and from 1..9 the keys clamp to 1..9.
   `level-down.cap` (30 ▼) and `level-down60.cap` (60 ▼) changed nothing visible, which is what
   plan 14's P12 probe (one ▲, one ▼) saw and misread as "inert".
3. **The timer is faithful.** After OK at level 1, a game ticks every 634-635 ms (the first tick
   615 ms after the start frame; one 649/629 ms pair where a late tick shifts the schedule by one
   timer unit; `out-to-1/lvl/timings.csv`). That is 82 timer units of ≈7.745 ms, the same 635 ms
   the RE notes measured in MAME at level 1. The splash (250 ms steps), the Top score animation
   (≈193 ms) and the notes run at their documented rates in the same emulator.
4. **Why 175 runs at one cell per timer unit (cross-check only).** The firmware reads the period
   from a nine-entry table indexed by `level - 1`; level 175 reads past the table, and the byte it
   finds in the v6.39 image is 0, so the tick fires on every timer unit (≈7.7 ms, the 6-10 ms
   frame spacing of `8-1-1.leaf`). Reading the image (not copied) shows that the levels 10..174 the
   Level page can store on the way down from 175 read other bytes: periods from 0 to 2550 ms.
5. **The capture script is innocent.** `v639-all.cap` never touched the level; its keys 8 6 2 4
   landed on a snake already running at level 175.

Two more planning findings shape the decisions:

- **Food placement depends on the clock.** The first food of a game is at (14, 8) with the clock
  set to 10:10, at (5, 8) with 19:48 and at (15, 3) with 07:59 (`seed-1948.cap`,
  `seed-0759.cap`); with the clock frozen (emulator issue #1) every game at one clock setting
  starts identically. This matches the RE notes (the game RNG is reseeded from the clock), and the
  RE notes' generator `seed = (seed * 0x625f + 0x3623) mod 0xfff1` fits the two captured 10:10
  placements with four candidate seeds (15581, 44530, 45562, 50188); minutes, seconds, BCD and
  `hh*256+mm` of the clock do not. Task 0 collects enough placements to decide (D4).
- **The pause menu renumbers.** Navi during a game shows `Continue` as `8-1-1` and New game as
  `8-1-2`; numbers are positions, so the kernel needs a seam (D10).

## Scope and non-goals

In scope: the Goal items; one opt-in phone-core seam (D10); nokia-os internals; resources and
goldens derived from captures; documentation.

Out of scope: playing sounds and vibration (plan 16 plays the cues), persistence across power
cycles and factory defaults (plan 15), backlight and the `Lights` setting's effect (plan 25), the
standby number entry that digits start (plan 22), Club Nokia score IDs beyond what Task 0 shows
(Open question 4), the other games (plan 24), and any website or `packages/snake` change.

## Decisions

Each decision states what changes relative to the brief and to plans 13/14.

**D1 - nokia-os gets its own Snake II engine; `packages/snake` stays as the website's engine and
is not reused (brief option "replace", scoped to the stock OS).** The firmware's rules (RE notes,
cross-checked against the captures above) differ from `packages/snake` in every part:

| Rule       | `packages/snake` (plan 04 + polish)                   | v6.39 firmware (captures; RE notes)                                                                    |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Board      | 21x10 cells from (0, 8)                               | 20x9 cells from (2, 10); frame x 0..83, y 8..47; rule y 6                                              |
| Start      | 3 cells at (4..6, 5)                                  | 7 cells, head on the right, from the maze's start cell (No maze: cells 5..11 of row 4)                 |
| Speed      | `600 - 55 * level` ms                                 | a per-level table (≈635 ms at level 1), and 175 in the virgin EEPROM                                   |
| Randomness | mulberry32, seed option                               | a 16-bit generator reseeded from the clock at the splash, New game and Continue                        |
| Growth     | on the eating tick                                    | one tick after eating (the tail stays once); a "fat" segment travels down the body                     |
| Bonus      | every 5 foods, TTL 20, `level * 5` decreasing, 1 cell | creature counter +4 per food, spawn at 20, six 2x1 kinds with a HUD icon and countdown, `5L + 5 + 2t`  |
| Death      | 2 ticks of flashing, `GAME OVER` screen               | a 100 ms grace tick, then a ≈2.1 s blink at ≈250 ms, then `Game over!` over the board or the fireworks |
| Keys       | up/down/left/right                                    | 2/4/6/8, diagonals 1/3/7/9 relative to the heading, `#`/`*` and the scroll keys rotate, 5/0 ignored    |
| Mazes      | "plausible approximations" on 21x10                   | wall segments drawn as 2-px lines through cell centres                                                 |
| Pixels     | own 3x5 digits and sprites                            | 4x5 HUD digits, mouth-open heads, fat segments, tail pictures (goldens)                                |

Refactoring `packages/snake` into the firmware engine would change the website's Snake (the brief
keeps the website unchanged) or carry two rule sets in one package; nokia-os may not depend on
`snake` (plan 13 boundaries), and the engine's data (mazes, sprites, periods) are derived from
nokia-os goldens. So the engine lives in `packages/nokia-os/src/games/snake/` as pure TypeScript
(no time, no DOM; the session drives it), and `packages/snake` is left alone. When the website
adopts the stock OS, `packages/snake` and its website app are deleted (recorded in "Follow-ups";
not sequenced).

**D2 - Speed: every storable level runs at its captured period, including the virgin 175 (new;
closes plan 13's "Snake II speed" artefact).** The virgin level 175 is a virgin-EEPROM value and is
reproduced as captured (plan 14 D10). The Level page can store every value from 1 to 175 (▼ from
175 passes 174..10), so Task 0 measures the tick period of **each** level 1..175 and the engine
reads a generated period table (`SNAKE_PERIODS`, from goldens). The table is a reproduction of
recorded timing; no firmware byte is copied (plan 13 D8). Expected values, to be confirmed: levels
1-9 ≈ 635, 465, 364, 287, 217, 170, 132, 101, 85 ms (RE unit counts x 7.745 ms); 175 ≈ one unit.

Task 0 outcome: confirmed. Levels 1-9 tick every 635, 465, 364, 286, 217, 170, 132, 101 and
85 ms. Levels 10-175 tick every 8 ms (one unit, 84 levels) to 2478 ms, and 175 every 8 ms. The
first tick comes about 20 ms less than a period after the New game frame (616 ms at level 1),
and some fast levels differ (6 ms at 22 and 175). `SNAKE_FIRST_TICK` is therefore per level,
as planned. Deviation: the Level page's ▲ does nothing at 9 or above, so 175 can only go down.

**D3 - The captures are ground truth; the RE notes and the flash image are cross-checks and
hypotheses (extends plan 13 D8 and plan 14 D13).** `$REF/tools/lukesau-nokia-dct3-re/docs/
games_snake2_3310.md` and `games_applications_3310.md` describe the game from a decompile. This plan
uses them to design captures and to state rules as **hypotheses** (H1-H16 in "Rules to verify").
A rule enters the engine only with a test that checks it against a capture (a golden, or a value
derived from goldens). Maze walls, sprites, digits, fireworks, periods and timings are derived
from goldens by generators; nothing from `$REF/extracted` or the flash image is committed.

**D4 - Random numbers: the RE generator, accepted only if it reproduces every captured placement;
the seed comes from the host clock (new).** The engine's generator is the hypothesis H12
(`seed = (seed * 0x625f + 0x3623) mod 0xfff1`; food x = next mod 20, then y = next mod 9; creature
choices as H9). Task 5 recovers the seed of every gameplay golden by exhaustive search (65,521
seeds) and requires one seed to reproduce **all** of that golden's placements (dozens per bot game:
a false generator survives that with negligible probability). The seed is a function of the clock
at reseed time; Task 5 fits it from Task 0's clock series (C9). If no function of the host
`clock()`/`date()` ports fits, the stock phone seeds from the minutes of the day (UNVERIFIED) and
tests inject the recovered seed through an internal seam (Open question 2). Provenance: the
constants come from the RE notes; the plan records this, and the tests are the evidence.

Task 0 outcome: confirmed. In every bot game one seed reproduces every food and creature
placement (`seeds.json`); `long` has 36 placements, including a large creature. The 2x2 large
creature draws `r mod 50 == 0`, then x = r mod 19 and y = r mod 8, and makes no kind draw. The
10:10 / 13.10.2026 seed is 44530; the other C9 settings are in the Task 0 outcome. Deviation:
Continue does not reseed (`pause/bot`), so H12's reseed points are the splash (unobservable)
and New game.

**D5 - Verification: engine unit tests, key-replayed golden sequences, and decoded traces (new).**

1. _Engine unit tests (TDD, synthetic):_ every rule with hand-built states.
2. _Key-replayed goldens (pixel-exact):_ Task 0 records deterministic games (a closed-loop bot at
   levels 1-2, scripted probes). A golden carries the keys as `input:` (the tick after which each
   key was pressed, derived from the frames, D6), and the acceptance scenario presses them on those
   ticks. Short sequences (start, deaths, game over, fireworks, pause) are timelines; long bot games
   are **tick stills**: images named `t<tick>` for chosen ticks (every meal and the ticks around it,
   creature spawn/eat/expiry, every 25th tick, the last 12 ticks), so a 400-tick game costs ≈60
   images, not 400.
3. _Decoded traces:_ a test-support decoder (`tests/support/snake-decode.ts`) reads a golden image
   back into cells (head, body, food, creature, score); it is checked against the engine's own
   painter on synthetic states. RNG tests (Task 5) and period tests use it over every gameplay
   golden.

Timing uses a separate tick fixture (D6) because periods are timing-only facts.

**D6 - Timing: per-level period and first tick from captures; per-interval tolerance; no
key-latency model (refines plan 13 D9 and plan 14 D8 for gameplay).** The session ticks the engine
at `SNAKE_PERIODS[level]`, the first tick `SNAKE_FIRST_TICK[level]` after the start frame. The
firmware re-arms its timer after handling a tick, so a late tick shifts the rest by a unit
(`649/629` at level 1); that load-dependent slip is not modelled. Gameplay timelines are compared
frame by frame for pixels and **interval by interval** for timing: each tick's start minus the
previous tick's start within `GAME_TICK_TOLERANCE_MS` (provisionally 16 ms, two units; Task 1 fixes
it from Task 0's interval spread), never cumulatively; non-tick timings (grace tick, death period,
blink, notes, fireworks) are aligned and compared as in plan 13 (±2 ms) when Task 0 shows them
stable, else with the game tolerance and a stated reason. The key-to-game latency (≈30-45 ms in
the scratch runs; Navi to the pause menu ≈100 ms) is not reproduced, as plan 14 D8 decided for
menus: `input:` places keys by tick.

Task 0 outcome: `GAME_TICK_TOLERANCE_MS` = 16 (two units). Intervals spread ±5 ms at level 1 and
±15 ms at levels 3-9. Some tick redraws come in two bursts 13-15 ms apart; the first burst is a
partial frame, which the importer keeps and does not number. The grace tick (≈93 ms), the blink
(≈237-243 ms), the death period (≈2.07 s), the fireworks (217-241 ms per picture) and the notes
(≈2.94 s) are steady within a few ms. They are compared as plan 13 does.

**D7 - Game keys act on key-down (new).** The flow host delivers keys on release (plan 14). The game
widget declares `onKeyDown`, and the flow host forwards `down` events to widgets that have it.
Task 0 C7 confirms with a held key (press, run 2 ticks, release). Key repeat is ignored (H5).

Task 0 outcome: confirmed. A 2 or # held for three ticks turns at the first tick after the
press, once. The Level page does repeat a held ▲ (≈780 ms, then ≈490 ms); that is a Level-widget
fact for Task 9, not a game key.

**D8 - Sound and vibration are cues now and sound later (new; plan 16 dependency).** The engine
returns cues with each step (`eat`, `crash`, `vibrate`, …) and the session stamps them with the
kernel time into an internal `StockCueSink` (nokia-os internal, default no-op; not exported, no
VISION change). Tests assert the cue times against Task 0's `.events.csv` (buzzer and vibra edges)
within the game tolerance, when `Sounds`/`Shakes` allow them. Plan 16 maps cues to its tone
sequences (it measures their notes from the same `.wav`/`.events.csv`) and wires the sink to
`PhoneEventMap.sound`. Keypad tones during play (the 900 Hz beeps in the captures) are plan 16's
keypad-tone policy, not cues.

Task 0 outcome: a game makes sound only with Tones › Warning tones On, which the virgin EEPROM
leaves unset, so every virgin-state capture is silent apart from keypad beeps. With Warning tones
On (`sound/warning-on/`) a meal sounds 2637 Hz (one or two units) and the crash sounds three 440
Hz beeps of ≈15 ms. The vibrator runs ≈480 ms per meal and from the crash, only with Shakes On.
Deviation: the cues are `eat` (food or creature), `crash` (the second blocked tick) and
`vibrate` (480 ms), with the times the captures show. `top-score` stays in the union as
UNVERIFIED: its sound (RE `0x23`) was not captured with Warning tones On. The engine emits every
cue; the stock settings decide what plays (Shakes gates `vibrate`; Sounds and Warning tones gate
the rest, plan 16).

**D9 - Scores and levels live in the in-memory settings store; plan 15 persists them (new;
dependency).** The store gains numeric values (`number(key)`, `setNumber(key, value)`, snapshot
`numbers`): `games/snake/level` (virgin 175), `games/snake/top-score` (virgin 45, replacing its
`VIRGIN_TEXTS` entry). The maze is already the single-choice `games/snake/mazes`. Game over writes
the top score when beaten (H14) and whatever Task 0 shows for Score IDs (Open question 4). If plan
15 has landed when Task 9 starts and its store API differs, Task 9 uses plan 15's typed setting API
and records a Deviation; otherwise plan 15 persists `numbers` like every other key. The virgin
values stay the initial state (plan 14 D10); plan 15 decides factory defaults.

**D10 - Continue is a kernel menu entry shown only while a game is suspended; such a level numbers
by position (new phone-core seam, opt-in).** Evidence (scratch `out-pause`): Navi during play shows
`Continue / New game / Level` with Continue selected on the top row and indicator `8-1-1`; ▼ gives
`8-1-2` on New game; C from it goes to the Games list (`8-1`); Select on Snake II opens on Continue.
`SubmenuOptions.shown?(child)` (re-read whenever the level's list is built and on each tick, like
`detail`) hides children for display, ▲/▼, the rail, shortcuts and paths that land on them; a level
with `shown` numbers its shown children by position, so New game is `8-1-1` without Continue and
`8-1-2` with it. nokia-os gives Snake II's level the orders Continue 1, New game 2, … Instructions 7
(slugs unchanged: paths stay `menu/games/snake/new-game`), `shown` = "Continue only while
suspended", and `opening()` = Continue while suspended. The website sets none of it. Task 0 C8
fills the rest (splash on re-entry while suspended, Continue's frozen board until a key, C during
play); a contradiction becomes a Deviation in Task 3 before code.

Task 0 outcome: confirmed. The pause list is `Continue / New game / Level / Mazes / Top score /
Score IDs / Instructions` (`8-1-1`..`8-1-7`), with Continue on the top row. Entering Snake II
again while suspended plays the splash, then opens on Continue (the intro rule is unchanged).
Continue's board stands until a key. C during play suspends like Navi. More facts for Task 10:
Top score while suspended returns to Continue on the bottom row (the return selects the first
entry, so `NOTE_ENDS` selects `continue` while suspended), and OK on the Level page while
suspended discards the game (Continue disappears; the selection stays on the third row, now
Mazes). Navi or C during the death blink suspends the dying game. The suspended game survives
standby.

**D11 - The Level page becomes stateful (corrects plan 14 P12 / D12).** Level reads
`games/snake/level`, draws `min(level, 9)` filled bars (bar sprites per count from Task 0's nine
captured pages), ▲ raises and ▼ lowers by one with the clamps Task 0 C1 measures (from 1..9: 1..9;
from above 9: ▼ by one, ▲ per C1), OK stores and returns, C returns without storing (C1). Bantumi's
and Pairs II's Level pages keep plan 14's static widget until plan 24 measures them (Task 9 leaves a
note in `LEVEL_BARS`). The spec's and the code's "▲/▼ inert" statements are corrected.

Task 0 outcome (C1): ▼ lowers the level by one down to 1. ▲ raises it by one only below 9: one ▲
from 175 leaves 175, and 90 ▲ from 175 stay at nine bars. OK stores and C discards; both return
to the game menu with Level selected. A held ▲ repeats. `1`, `5` and `#` leave for standby
number entry (plan 22).

**D12 - Public API and website unchanged.** `createStockPhone`, `StockPhoneConfig`,
`paintStockScreen`, `stockMenu` and `missingStockGlyphs` keep their signatures; `stockMenu` gains
the Continue entry (hidden). `packages/snake`, its VISION contract and the website do not change.

**D13 - Game-over screens are shared games widgets (new; for plan 24).** The plain game-over note
and the fireworks + `TOP SCORE:` sequence are framework screens shared with Space impact, Pairs II
and Bantumi (RE notes). They are built as generic widgets in `src/widgets/game-over.ts` with
their own sprites and timelines, parameterised by score text, so plan 24 reuses them.

## Rules to verify (hypotheses from the RE notes; each needs a capture)

| #   | Hypothesis (RE notes, cross-check)                                                                                                                                                                                                                  | Capture that decides (Task 0) |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| H1  | Board 20x9; cell (x, y) at pixel (2 + 4x, 10 + 4y); edges wrap except where walls are; no maze = only the body kills                                                                                                                                | C2, C4, C5                    |
| H2  | Start: seven segments from the maze's start cell + 1, heading right; start cells (4,4), Maze 2 (0,4), Maze 3 (0,5), Maze 4 (4,7)                                                                                                                    | C4                            |
| H3  | First tick one period after New game; period per level (D2)                                                                                                                                                                                         | C2, C3                        |
| H4  | A key sets the pending direction, judged against the current heading (no reverse); the last key before a tick wins; the tick applies it                                                                                                             | C7                            |
| H5  | 2/4/6/8 absolute; 1/3/7/9 relative (1: left if vertical else up; 3: right/up; 7: left/down; 9: right/down); `#` and one scroll key clockwise, `*` and the other anticlockwise; 5, 0 and repeats ignored                                             | C7                            |
| H6  | Blocked ahead (wall or body; the tail cell is free unless growing): one 100 ms grace tick in which a turn saves the snake; blocked again = death                                                                                                    | C5, C7                        |
| H7  | Eating: score += level; the tail stays on the next tick (growth); the neck behind the head is drawn fat and the fat segment travels down the body                                                                                                   | C5                            |
| H8  | Food: up to 100 tries of (next mod 20, next mod 9) on a free cell sharing no row or column with a creature cell; then the first free cell row-major                                                                                                 | C5, C9                        |
| H9  | Creature counter +4 per meal while none is out; at 20 a 2x1 creature (kind = next mod 6; next mod 50 == 0 tries the large one if allowed); lifetime 20 ticks with a HUD icon and 2-digit countdown at x 75/79                                       | C5                            |
| H10 | Eating a creature: score += 5L + 5 + 2 x ticks left; no growth; a fat neck                                                                                                                                                                          | C5                            |
| H11 | Death: second blocked tick, then the snake blinks every ≈250 ms for ≈2.1 s; a snake whose ring index wrapped (after ≈300 steps) does not blink                                                                                                      | C5, C6                        |
| H12 | Generator `seed = (seed * 0x625f + 0x3623) mod 0xfff1`, reseeded from the clock at the splash, New game and Continue                                                                                                                                | C5, C8, C9                    |
| H13 | Mouth open when the cell ahead holds the food or a creature cell                                                                                                                                                                                    | C5                            |
| H14 | Game over: a new top score plays the six-picture fireworks twice (≈233 ms each), then `Game over!` / `TOP SCORE:` / score ≈2.95 s; otherwise `Game over!` / `Your score:` / score over the board ≈2.95 s; then the game menu with New game selected | C5, C6, C12                   |
| H15 | Navi suspends to the game menu with Continue first; Continue redraws the board, which stands until the first key                                                                                                                                    | C8                            |
| H16 | Score shows the low 16 bits as four digits with leading zeros                                                                                                                                                                                       | C6 (175 per meal)             |

Task 0 outcome: H1, H2, H4, H5, H7-H11, H13 and H16 hold. The bot checked H1, H2, H4, H5, H7-H11
and H16 tick by tick, and the H8/H9/H12 placements come from one seed per game. H13's open mouth
and H7's fat neck are pictures that the tick stills hold; Task 8 asserts them. H16's low-16-bit
wrap is not reached. Deviations:

- H3: the first tick comes about 20 ms less than a period after the New game frame (616 ms at
  level 1), because the frame is drawn ≈20 ms after the timer starts.
- H5: the scroll keys are ▼ clockwise and ▲ anticlockwise.
- H6: the blocked tick makes the blocked direction current, so a saving key must be
  perpendicular to it; the turn back the way the snake came is a reversal and is ignored. The
  grace lasts ≈93 ms (12 units), and the key must come within ≈60 ms of the blocked tick.
- H9: the large creature appears in this EEPROM (the large-creature bit is set).
- H11: the blink has nine frames ≈240 ms apart, and game over comes ≈2.07 s after the crash.
- H12: Continue does not reseed.
- H14: `Game over!` / `Your score:` clears the screen (it is not drawn over the board). The menu
  then shows New game on the top row (`8-1-1`). Navi or C skips the fireworks or the note; ▼
  does nothing.
- H15: Navi or C during the blink suspends a dying game. Top score and the Level page while
  suspended behave as D10's outcome says.

## Ground truth and artefacts

| Source (`$REF/captures/6.39/`)      | Contents                                                                | Use                                                         |
| ----------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| plan 14 goldens for 8-1 (committed) | splash, menu, Level (virgin), Mazes, Top score, Score IDs, Instructions | unchanged; `tree/08-games/8-1-1.leaf` becomes asserted (D2) |
| `game/` (original)                  | 840 frames at level 175 + `.wav`                                        | reference only (superseded by `8-1-1.leaf` and C2/C3)       |
| `scratch-plan23/` (planning)        | the runs cited above                                                    | evidence for D2/D4/D10; never imported                      |
| `plan23/levels/` (C1)               | Level page at every bar count and the key clamps                        | `game/snake/level-*` goldens; Level widget                  |
| `plan23/ticks/<L>/` (C2)            | New game at levels 1-9, 10 s, no keys                                   | timelines (pixels + period)                                 |
| `plan23/periods/<L>/` (C3)          | New game at every level 10..175, 8 s, no keys                           | `game/snake/periods` tick fixture                           |
| `plan23/mazes/<M>/` (C4)            | each maze at level 1 from New game to the menu after death (or 25 s)    | maze stills and death timelines                             |
| `plan23/bot/<name>/` (C5)           | bot-steered games with `keys.csv` and audio                             | tick-still goldens with `input:`, cue checks                |
| `plan23/virgin/` (C6)               | level 175: one meal (+175), fireworks, Top score 175                    | top-score path at the virgin level                          |
| `plan23/keys/` (C7)                 | key probes at level 1                                                   | `game/snake/keys-*`                                         |
| `plan23/pause/` (C8)                | Navi, Continue, re-entry, C during play                                 | `game/snake/pause-*`                                        |
| `plan23/seed/<HHMM>/` (C9)          | first meals at several clock settings                                   | clock → seed fit (Task 5)                                   |
| `plan23/sound/` (C10)               | Sounds Off/On and Shakes probes with audio                              | cue checks                                                  |
| `plan23/after/` (C11, C12)          | Top score, Score IDs and the menu after games                           | score-writing goldens                                       |
| `plan23/text.json`                  | OCR runs for the new images                                             | text runs for the harvester (plan 14 D13)                   |

Artefacts (added to the spec §10 artefact table in Task 1):

| Artefact                                                      | Cause                                                     | Handling                                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Snake II level 175 (nine bars; one cell per timer unit; +175) | virgin EEPROM                                             | reproduced as the virgin state (D2, plan 14 D10); plan 15 decides factory defaults     |
| Identical first food in every game at one clock setting       | emulator RTC frozen (issue #1); the seed is clock-derived | behaviour is "seed from the clock" (D4); the frozen value is a test input like `10:10` |
| Timer unit ≈7.745 ms (the firmware assumes 7.97 ms)           | emulator timebase (MAME measures the same 7.74 ms)        | reproduced as captured (plan 13 D9); UNVERIFIED against hardware                       |
| Key-to-game latency ≈30-45 ms, Navi-to-menu ≈100 ms           | firmware key scan and redraw                              | not reproduced (D6)                                                                    |
| `Top score: 45`, Score IDs `ç` / `ÆG`, Shakes `1 player`      | uninitialised game EEPROM (plan 14)                       | virgin initial state                                                                   |

## Package boundaries

Unchanged from plans 13/14. `nokia-os` → `phone-core` (runtime) and `phone-screen` (runtime LCD
toolkit); never `snake`, `phone-3d`, `@tanstack/*` or `website/`. The phone-core seam (D10) is
generic: no Snake, Nokia or stock vocabulary. `packages/snake` and the website are untouched.

## Contract changes

Task 1 writes these into `VISION.md`.

### `@hellotimber/phone-core` (additive, opt-in)

```ts
export interface SubmenuOptions<Metadata = unknown> {
  // ...plan 13/14 fields unchanged...
  /**
   * Plan 23: whether `child` is shown; re-read when the level's list is built and on every tick.
   * Hidden children are skipped by display, ▲/▼, the rail, shortcuts and `opening()`, and a path
   * that lands on one falls back to the level. A level with `shown` numbers its shown children
   * by position (1..n) instead of by MenuOrder. Default: every child shown, numbered by order.
   */
  shown?(child: MenuEntry<Metadata>): boolean; // method syntax: keeps SubmenuEntry covariant
}
```

Rules: `shown` must leave at least one child shown (throws otherwise, naming the level); a selected
child that becomes hidden moves the selection to the first shown child; `itemOrders` is omitted for
a `shown` level (positions are 1..n). Exiting into a level with `exit({ select })` may select a
child that was hidden when the application started and is shown now (Continue after Navi).

### `@hellotimber/nokia-os`

Public API unchanged (D12). Internal additions (not exported): `src/games/snake/**` (engine, rng,
model), `src/widgets/{snake.ts,game-over.ts}`, `src/display/widgets/{snake.ts,game-over.ts}`,
`src/resources/generated/snake.ts`, `StockSettings.number`/`setNumber`, `StockCueSink`
(`src/firmware/cues.ts`), and the flow `Widget.onKeyDown` (D7).

```ts
// src/firmware/cues.ts (internal until plan 16)
export type StockCue =
  | { readonly kind: "eat" } // a meal (food or creature): 2637 Hz, 1-2 units (Warning tones On)
  | { readonly kind: "crash" } // the second blocked tick: three 440 Hz beeps of ≈15 ms
  | { readonly kind: "top-score" } // UNVERIFIED (RE sound 0x23; not captured with sound on)
  | { readonly kind: "vibrate"; readonly ms: number }; // 480 ms per meal and at the crash
export interface StockCueSink {
  cue(cue: StockCue, atMs: number): void;
}
```

Task 1 (from Task 0 C10): the union above is final. `eat`, `crash` and `vibrate` are captured;
`top-score` is UNVERIFIED and kept for plan 16.

## Golden pipeline additions

### Header key `input` (`scripts/golden-format.ts`)

An optional key after `covers` (or after `omitted` when there is no `scenario`):

```text
input: 0:8 14:6 31:2 31:4
```

Space-separated `<tick>:<key>` pairs, ticks ascending; `<key>` is a phone key name (`2`, `#`,
`up`, `navi`, …). Tick `n` means "after the frame of engine tick `n`, before tick `n + 1`" (tick 0
is the New game frame). Two keys on one tick are pressed in order. The importer derives ticks from
the bot's `keys.csv` and the frames (Task 2).

### Tick stills

A stills golden whose images are named `t<tick>` (4 digits, `t0000`) holds the screens after those
ticks, in tick order. Its scenario replays `input` and compares the screen after each listed tick.

### Tick fixture `goldens/game/snake/periods.ticks.txt` (new format `tick-golden 1`)

```text
tick-golden 1
id: game/snake/periods
status: asserted
source: captures/6.39/plan23/periods
source-sha256: …   (sha256 over each level's timings.csv in level order)
note: New game at each level, No maze, no keys; tick start times after the start frame.

@ticks
# level first_ms intervals_ms…
10    <first> <interval> <interval> …
…
175   <first> <interval> <interval> …
```

Parsed by `scripts/golden-format.ts` (`parseTickGolden`, `file:line` errors as for LCD goldens:
header order, levels ascending and unique, integers, at least two intervals per level). Levels 1-9
come from their C2 timelines, not from this file.

### Capture set (`scripts/game-capture-set.ts`)

An explicit table (like plan 14's `probeCaptureSet`) appended by the importer. Ids are
`game/snake/<name>`; `status: asserted` unless noted.

| Fixture id(s)                          | Source              | Kind                                                 | Scenario                                       |
| -------------------------------------- | ------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `level-<n>` (n = 1..9), `level-keys-*` | `plan23/levels`     | stills / timelines                                   | Level page per count; key clamps (C1)          |
| `ticks-l<L>` (L = 1..9)                | `plan23/ticks/<L>`  | timeline (start + 8 ticks)                           | period, first tick, start pixels               |
| `periods`                              | `plan23/periods`    | tick fixture                                         | levels 10..175                                 |
| `maze-<m>` (m = 0..5)                  | `plan23/mazes/<m>`  | timeline (start + ticks to death + game over + menu) | walls, start cell, death                       |
| `bot-<name>`                           | `plan23/bot/<name>` | tick stills + `input`                                | rules H4-H14                                   |
| `bot-<name>.death`                     | `plan23/bot/<name>` | timeline from the fatal tick to the menu             | blink, ring quirk, game over                   |
| `virgin-meal`                          | `plan23/virgin`     | timeline + `input`                                   | 175 per meal, fireworks, `TOP SCORE:`          |
| `keys-*`                               | `plan23/keys`       | timelines + `input`                                  | H4-H6                                          |
| `pause-*`                              | `plan23/pause`      | stills / timelines                                   | H15, D10                                       |
| `after-*`                              | `plan23/after`      | stills                                               | Top score, Score IDs, menu row after game over |
| `tree/08-games/8-1-1.leaf`             | plan 14 (existing)  | `pending:23` → asserted                              | the virgin New game (40 frames)                |

## Stock display observations (from the scratch runs; Task 4 confirms from goldens)

| Element    | Observation                                                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HUD        | score: four 3x5-ink digits in 4-px cells at x 1..15, y 0..4 (`0000`, `0175`); full-width rules at y 6 and y 8                                                                          |
| Board      | frame column x 0 and x 83 from y 8 to 47, bottom row y 47; cells inside x 2..81, y 10..45                                                                                              |
| Snake      | segments drawn in the middle rows of their cells in a stepped pattern (rows 27-28 for board row 4), the head with an extra pixel above; exact pictures per direction come from goldens |
| Food       | 3x3 diamond in the cell's top-left 3x3 (cell `(14, 8)` lights x 58..60, y 42..44)                                                                                                      |
| Level page | `Level:` small at x 5, top 0; nine bars rising left to right; filled bars are solid, and every bar keeps its 1-px shadow whether filled or not (`scratch-plan23/out-to-1/dn/170.png`)  |
| Pause menu | rows list `Continue / New game / Level`, Continue on the top row, rail of 7, `Select`                                                                                                  |

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` and the named test commands. A task that touches
  `phone-core` also runs `mise exec -- vp run -r test` and `mise exec -- vp run website#build`.
- Commit rule: run `mise exec -- vp check --fix` yourself, stage files by explicit path, then
  `git commit --no-verify -m "<message>"`. Never `git add -A`/`git add .`. Never stage `TODOS.md`.
- Never hand-edit `goldens/**`, `src/resources/generated/**`, `src/firmware/generated/**` or
  `scripts/generated/**`: change the generator or its input tables and regenerate. Each generator
  runs twice with no diff before its commit.
- Tests never read `$REF`. Generators that read `$REF` fail clearly when it is missing.
- No new dependencies.
- When reality differs from this plan, follow the captures, then append a `Deviation:` paragraph
  under the task. If a deviation breaks a contract in VISION.md, stop and report instead.
- Parallelism (max 3 concurrent agents): Task 0 gates everything. Then Task 1. Then lanes A (2 → 4
  → 8), B (3) and C (5 → 6 → 7). Task 9 needs 2 and 4; Task 10 needs 3, 7, 8 and 9; then 11 → 12.

## Tasks

### Task 0 - Canonical REF captures and probes (no repository changes)

**Files (all under `$REF`, gitignored):** `captures/scripts/gen_v639_plan23.py`,
`captures/scripts/v639-plan23*.cap`, `captures/6.39/plan23/**`, a new section in
`captures/README.md`. Do not modify existing captures, scripts or `scratch-plan23/`.

- [x] Read `$REF/captures/README.md` (harness commands; `fork`/`exit` need the interactive driver
      `tools/menutree/emu.py`, as plan 14's `gen_v639_plan14.py run` does), the scratch scripts in
      `captures/scratch-plan23/`, and the RE notes named in D3.
- [x] Write `gen_v639_plan23.py` with subcommands `run` (plays sections through `emu.py`, `-j 3`
      workers, `--only <section>`), `bot`, `ocr` and `check`. Every section starts from
      `include v639-setup.inc`, `key c`, `run 2s` (clock 10:10 unless C9), records audio
      (`audio …`) around every gameplay recording, and navigates to Snake II as the scratch
      scripts do (Menu, ▼×7, Select, splash skip with Navi, `idle`).
- [x] **Setting a level fast:** from the virgin Level page press ▼ 174 times (level 1) then ▲ to
      the target, OK; `fork` at each target level so later sections start there.
- [x] **C1 levels:** virgin page; ▲ once then ▼ until the page shows eight bars, counting presses
      (decides whether ▲ from 175 is ignored, raises to 176 or clamps to 9); ▼ to 1 with a shot at
      every bar count; ▲ to 9 with shots; ▲/▼ beyond the clamps; C after a change then reopen
      (does C discard?); OK then reopen; a digit key (scratch: `1` left for standby with `1`
      typed) - record it.
- [x] **C2 ticks:** levels 1..9: New game, `record plan23/ticks/<L> start` before Select, 10 s, no
      keys.
- [x] **C3 periods:** every level 10..175 (fork after each ▼ from 175): New game, record 8 s
      (`max` 40 frames is enough for the timings; keep `timings.csv` complete).
- [x] **C4 mazes:** level 1, each of No maze and Maze 1-5 chosen in Mazes: New game, record from
      before Select to 3 s after the game menu returns (or 25 s): start cell, walls, the run
      straight right into a wall where there is one, grace tick, blink, `Game over!`, the menu.
- [x] **C5 bot games:** a closed-loop bot in `gen_v639_plan23.py bot` reads the LCD (`hex`) after
      every tick, decodes head, food and creature cells (H1 geometry), and presses keys between
      ticks (`press`/`run`/`release`, timed from the last tick frame; the scratch runs show a
      30-45 ms key latency at the virgin speed, so at level 1-2 any time in the first half of the
      period works). It logs `keys.csv` (`tick,key,press_ms`). Games, all No maze unless named:
  - `long` (level 1): ≥ 30 meals; let the first creature expire, eat the next ones at different
    countdowns; turn in all four directions and both senses, pass the food's row and column with
    the mouth open, run ≥ 320 ticks so the ring index wraps, then die into the body with a score
    above 45 (fireworks, `TOP SCORE:`).
  - `short` (level 2): two meals, then die into the body (score < top score): `Your score:`.
  - `maze2`, `maze3` (level 1): five meals each with the walls in play, then die on a wall.
  - `grace` (level 1): steer straight at the body, turn during the 100 ms grace tick (saved);
    then again without turning (dies).
- [x] **C6 virgin:** level 175 (no level change): the scratch `steer-12.cap` steering (key 8, 52 ms
      after Select's release) eats (14, 8) → `0175`; keep recording until the game menu returns
      after the death (it hits its own body or runs until it dies; record 30 s); then shots of Top
      score (`175`?) and Score IDs.
- [x] **C7 keys** (level 1, one recording each, keys on chosen ticks): every digit 1-9, `*`, `#`,
      ▲, ▼, 0, 5 while heading right and while heading up; the reverse key; two keys in one
      tick (last wins); a key held for three ticks (acts on down?); C and Navi during play.
- [x] **C8 pause** (level 1): Navi during play (record), ▼ through the whole list (shots), C (shot),
      Select on Snake II while suspended (record 6 s: splash or not), Continue (record 4 s:
      frozen board?), then a key (record: resume; next food placement after a meal = reseed?), New
      game while suspended, Top score while suspended, C during play.
- [x] **C9 seed:** setups with the clock at 10:10, 10:11, 00:00, 00:01, 12:00, 19:48, 07:59 and
      23:59 (copy `v639-setup.inc` with the time changed, as the scratch `setup-1948.inc` does), and
      10:10 with the date 14.10.2026: at level 1, the first three meals each (bot), shots of every
      placement. Also two games in a row at 10:10 without a power cycle.
- [x] **C10 sound:** Games › Settings › Sounds Off, then a `short` game; Sounds On again; Shakes
      changed to each option, then a meal; record audio throughout.
- [x] **C11 after:** after the `long` game: Top score (record 7 s), Score IDs (every page); after the
      `short` game the same.
- [x] **C12 game over:** Navi, C and ▼ during the `Your score:` note and during the fireworks
      (records): skip, ignore or move?
- [x] OCR every new image with `tools/menutree/ocr.py` into `plan23/text.json` (plan 14 format).
- [x] `check`: every recording starts on its parent screen; every gameplay recording has a
      `keys.csv` and audio; every level 10..175 has ≥ 3 tick frames; the bot's decoded states
      chain (one cell per tick).
- [x] Append "Plan 23 supplementary captures" to `$REF/captures/README.md` and replace the "Snake
      II speed is wrong" caveat with the D2 explanation.
- [x] No commit. Record the outcome under this task: C1 clamps, periods 1-9 and the 10..175 range,
      first-tick offsets, interval spread (for `GAME_TICK_TOLERANCE_MS`), maze start cells, each
      H1-H16 confirmed or corrected, pause behaviour, sound/vibra edges, Score IDs after a game,
      and any section that failed.

**Task 0 outcome (2026-10-14).** Generator `captures/scripts/gen_v639_plan23.py` (`run`, `bot`,
`ocr`, `check`, plus `seeds`: the D4 check) and one command log per section
(`captures/scripts/v639-plan23-<section>.cap`); details in "Plan 23 supplementary captures" of
`$REF/captures/README.md`, whose speed caveat now carries the D2 explanation. 10,033 images (848
distinct), 127 MB under `plan23/` with the audio. Every section passed `check`; no section is left
failed. Faces in `text.json`: `tiny6`, `plain8`, `bold8`, `large13`.

Deviation: the generator drives `emu.py` from Python instead of emitting one `.cap`: the bot needs
the LCD between ticks, and the per-section logs are the replayable scripts. Sections run in their
own dct3cap process (retried up to three times if it dies). Levels are set by ▼ ×185 at a 100 ms
keygap (the clamp makes extra presses harmless), checked by counting bars. C3 records at most 60
frames per level (`record … start 60`) and no audio: 166 eight-second WAVs would add ≈130 MB for no
cue. C9 reboots from a flash saved after setting level 1 (`saveflash`; the level survives the
reboot) and types the other clock in the setup.

Deviation (C5 `long`): the bot dies at move 297 (31 meals, 5 creatures, score 105), not after
≥ 320 ticks. The ring-wrap quirk needs a death between the head index wrapping (move 288) and the
tail index wrapping (move 294 + growth); a death after that window blinks again. The recorded
death does not blink (H11).

Deviation (C5 `grace`): the turn is tried at nine offsets in forks (`bot/grace/try-*`, recorded),
then the saved game continues in `bot/grace/save`. The bot steers into a side of its body with
the straight cell free and turns straight on, because the blocked tick makes the blocked
direction current (see H6).

Deviation (C6): a level-175 snake cannot be steered into its own body, because taps register at
least ≈50 ms (six cells) apart. `virgin/meal` records the No-maze meal (8 pressed 28 ms after
Select's release; `0175`). The fireworks path runs at the same level 175 on Maze 1 (`virgin/game`):
▲ at once turns the snake up column 14 into the top wall, and ← during the grace tick runs it
along row 1 through the food (12, 1) into the left wall. That gives fireworks, `TOP SCORE: 175`
and Top score 175 (`virgin/after/`).

- **C1 levels:** ▼ lowers the stored level by one per press down to 1 (167 presses from 175 reach
  eight bars). ▲ raises it by one only below 9: one ▲ from 175 leaves 175, and 90 ▲ from 175
  stay at nine bars without wrapping. The page draws `min(level, 9)` filled bars. OK stores and C
  discards (`ok/`: 5 → reopened 5; `c/`: 3 → reopened 5); both return to the game menu with Level
  selected (`8-1-2`). A held ▲ repeats: +1 on press, again after ≈778 ms, then every ≈482-496 ms.
  `1`, `5` and `#` leave for standby number entry (`1` and `Call`; plan 22).
- **Periods (C2, C3):** levels 1-9 tick every 635, 465, 364, 286, 217, 170, 132, 101 and 85 ms
  (medians; RE units × 7.745 ms). The first tick comes 616, 445, 347, 267, 197, 150, 112, 81 and
  65 ms after the New game frame, about 20 ms less than a period: the New game frame is drawn
  ≈20 ms after the timer starts. Levels 10-175 tick every 8 ms (one unit; 84 levels including
  every odd level from 111 up) or every 15, 23, 39, 46, 62, 77, 93, 116, 132, 178, 480, 674, 890,
  1200, 1231-1239, 1820, 1858 or 2215-2478 ms. Their first tick varies (6 ms at levels 22 and
  175, 19 at 21). Interval spread: ±5 ms at level 1 and ±15 ms at levels 3-9 (two units, from a
  late tick or a split redraw), so `GAME_TICK_TOLERANCE_MS` = 16 holds. Some tick redraws come
  in two bursts 13-15 ms apart (a partial frame; levels 6 and 86, and `sound/warning-on`).
- **Mazes (C4):** start cells (head − 7) are (4, 4) for No maze and Mazes 1 and 5, (0, 4) for
  Maze 2, (0, 5) for Maze 3 and (4, 7) for Maze 4 (H2). The first food at 10:10 is (14, 8), except
  on Maze 1 and Maze 4, where (14, 8) is a wall and the retry gives (12, 1). Mazes 1, 3 and 4 run
  straight into the right wall and die (grace, blink, `Game over!`, the menu after ≈10.2 s).
  No maze, Maze 2 and Maze 5 run for 25 s.
- **Death and game over (H11, H14):** the second blocked tick vibrates. The blink then hides and
  shows the snake every ≈237-243 ms, in nine frames. Game over follows ≈2.07 s after the crash
  with the snake hidden. A death after the ring index wrapped does not blink: the long game's
  board stands still for 2.83 s. A new top score shows 12 full-screen fireworks frames (six
  pictures twice, 217-241 ms each, the last 386-423 ms), then `Game over!` / `TOP SCORE:` /
  score for ≈2.94 s. Otherwise `Game over!` / `Your score:` / score shows for ≈2.94 s **on a
  cleared screen**, not over the board (correction). Either way the game menu follows with New
  game on the top row (`8-1-1`). The top score is written (Top score shows 105 after `long` and
  175 after `virgin`) and plays the usual Top score animation.
- **C12:** Navi or C during the blink suspends the dying game: the pause menu with Continue
  appears. Navi or C during the fireworks or the note skips to the game menu (New game). ▼ is
  ignored throughout.
- **Keys (C7, H4, H5, D7):** 2/4/6/8 are absolute and 1/3/7/9 relative, as H5 says. `#` and ▼
  turn clockwise, `*` and ▲ anticlockwise. 0, 5 and the reverse key do nothing. With two keys
  between ticks the last one wins (2 then 8 → down; 2 then 4 → up, since 4 is a reversal). A key
  acts on key-down, and a key held for three ticks turns once (no repeat; `hold-2`,
  `hold-hash`). C during play suspends the game like Navi; holding C then goes to standby.
- **Grace (H6):** the blocked tick makes the blocked direction current. A key judged against it
  saves the snake only if it is perpendicular; the turn back the way the snake came is a
  reversal and is ignored. The saving move comes ≈93 ms (12 units) after the blocked tick and
  needs the key no later than ≈60 ms into the grace (`try-p80` dies). The next tick follows one
  period later. A turn before the blocked tick simply turns (`try-m40`).
- **Creatures (H9, H10):** the counter rule, the countdown from 20 and the HUD icon and digits
  held on every tick of every bot game. Scores match `5L + 5 + 2t` (32 at t = 11, 42 at t = 16).
  The 2x2 large creature appears in this EEPROM (`long`, tick 212, expired), so the large-creature
  bit is set. It was not eaten (not captured).
- **Random numbers (D4, H8, H12):** one seed per game reproduces every food and creature
  placement in every bot game (`seeds.json`). `long` has 36 placements, including the large
  creature (`r mod 50 == 0`, then x = r mod 19, y = r mod 8, no kind draw). The small creatures
  draw a kind per H9. The 10:10 / 13.10.2026 seed is 44530 in every game. That includes Maze 2,
  Maze 3 and the second game of a power cycle, so New game reseeds from the clock. Seeds per C9
  setting: 00:00 → 7995, 00:01 → 7995, 07:59 → 36670 or 60943, 10:10 → 44530, 10:11 → 44590,
  12:00 → 51130, 19:48 → 13689, 23:59 → 38909, 10:10 on 14.10.2026 → 10048.
  `(seconds of the day + 7930) mod 65521` fits 07:59, 10:10, 10:11, 12:00 and 19:48 but not
  00:00, 00:01, 23:59 or the other date; Task 5 fits the function. **Continue does not reseed:**
  `pause/bot` suspends before the first meal and still places (14, 8), (19, 7), (12, 1), (2, 5)
  like an uninterrupted game (H12 corrected). A reseed at the splash cannot be observed, because
  New game reseeds anyway.
- **Pause (C8, H15, D10):** Navi shows `Continue / New game / Level / Mazes / Top score / Score IDs
/ Instructions`, numbered `8-1-1`..`8-1-7`, with Continue on the top row. C goes to the Games
  list. Selecting Snake II again plays the splash and opens on Continue. The suspended game
  survives a trip to standby. Continue redraws the board exactly and stands until a key; the
  first tick comes one period (+≈20 ms) after that key, and the key's turn applies. New game
  while suspended starts a new game. Top score while suspended returns to Continue on the bottom
  row (`Score IDs / Instructions / Continue`): the return selects the first entry. **Level OK while
  suspended removes Continue**, and the selection stays on the third row (`8-1-3`, now Mazes).
- **Sound and vibra (C10, D8):** game sounds need Tones › Warning tones On, which the virgin
  EEPROM leaves unset (`sound/warning-on/`). With the virgin settings no buzzer sounds, whether
  Sounds is On or Off. With Warning tones On, a meal sounds 2637 Hz for 6-20 ms and the crash
  sounds three 440 Hz beeps of ≈15 ms, ≈15 ms apart. The top-score sound was not captured with
  Warning tones On (UNVERIFIED). The vibrator runs ≈480 ms per meal (food or creature) and from
  the crash when Shakes is On. With Shakes Off it does not run, and game over gives no pulse.
  The 900 Hz keypad beeps sound on every key.
- **Score IDs (C11, Open question 4):** after every game Last score ID changes to a nine-character
  code (`92ndekju1` after `short`). Top score ID changes only with a new top score, to the same
  code as Last score ID (`9e0copc02` after `long`, `hcwtip9u1` after `virgin`). Bonus ID stays
  `No ID`.
- **H1-H16:** H1, H2, H4, H5, H7, H8, H9, H10, H11 and H16 are confirmed (H7's fat segment and
  H13's open mouth are pictures that the tick stills hold; Task 8 checks them). Corrected: H3 (the
  first tick is ≈20 ms short of a period after the New game frame), H6 (the saving turn is
  judged against the blocked direction; the grace is ≈93 ms), H12 (Continue does not reseed),
  H14 (the plain note clears the screen) and H15 (Level OK while suspended drops Continue; Top
  score returns to Continue).

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `docs/specs/nokia-3310.md`, `docs/plans/README.md`, this plan.

- [x] Apply Task 0's outcome to D2, D6 (`GAME_TICK_TOLERANCE_MS`), D8 (cue union), D10, D11 and
      H1-H16 (Deviation lines where it changes them).
- [x] VISION: the `SubmenuOptions.shown` seam exactly as in "Contract changes" and a kernel-policy
      sentence (plan 23: shown children, positional numbers). The `@hellotimber/snake` section
      gains one sentence: website-only; the stock OS has its own engine (D1).
- [x] Spec §10: add "Snake II (plan 23)": board, speed and the virgin level 175 (the D2 evidence),
      keys, rules as verified, pause/Continue, game over; correct plan 14's "Level: ▲/▼ inert";
      add the artefacts above; mark everything not yet asserted "(plan 23, in progress)".
- [x] Plans README: row 23 `in progress`.
- [x] No runtime code. `mise exec -- vp check --fix`.
- [x] Commit: `docs: define Snake II gameplay contracts and the level speed finding (plan 23)`.

### Task 2 - Golden pipeline: `input`, tick stills, the tick fixture and the game capture set (TDD)

**Files:** `scripts/golden-format.ts`, `scripts/game-capture-set.ts` (new),
`scripts/import-captures.ts`, `scripts/tree-capture-set.ts` (8-1-1 status),
`tests/golden-format.test.ts`, `tests/game-capture-set.test.ts` (new),
`tests/goldens-integrity.test.ts`, `goldens/**`.

- [x] TDD `golden-format.ts`: `input` (order, ascending ticks, known key names, round trip);
      `parseTickGolden`/`serializeTickGolden` (`tick-golden 1`) with `file:line` errors; existing
      goldens parse unchanged.
- [x] TDD `game-capture-set.ts` on synthetic recordings (injected loader): tick numbering from
      frames (a tick frame starts ≥ half a period after the previous tick frame; non-tick frames
      such as a partial redraw are kept but not numbered), `keys.csv` → `input` (a key belongs to
      the last tick frame before its `press_ms` plus the measured latency window; ambiguous keys
      throw and name the recording), tick-stills selection (meals ±1, creature events, every 25th,
      last 12), timelines cut at the menu's return, `periods` rows (first tick and every interval).
- [x] Wire the importer: `CAPTURE_SET` + `treeCaptureSet` + `probeCaptureSet` + `gameCaptureSet`;
      `index.json` entries gain `input: true` when present. `tree/08-games/8-1-1.leaf` becomes
      `asserted` (keep its 40 frames).
- [x] Integrity test: `game/*` timelines have a numeric `trigger-frame`; tick stills' names are
      ascending `t<tick>`; every `input` tick exists in its golden; the tick fixture covers 10..175.
- [x] Run the importer twice; the second run leaves `goldens/` unchanged. Record fixture counts and
      bytes in the completion notes (budget guide: ≤ 2 MB of new text grids).
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [x] Commit: `feat(nokia-os): import Snake II gameplay captures as goldens`.

Deviation: tick numbering also infers a **blocked tick** with no frame from a gap of a period
plus the ≈93 ms grace (± 16 ms; `numberTicks`). A key pressed during the grace then lands on the
blocked tick, so replaying `input` reaches the grace: `bot-grace` has `60:2`, `virgin-game` has
`7:4`. The two level-175 goldens (`virgin-meal`, `virgin-game`) carry input read from the frames
(the tick before the turn shows), in the table, because at one cell per ≈8 ms every key lies
within a tick of its 30-45 ms latency window. Every other `input` comes from `keys.csv` by the
latency rule, and it equals the bot's own tick labels in every bot game.
Deviation: to bound size, the C7 key probes are tick stills of each key's tick and the two after
it (selection `input`) instead of timelines; Navi, C and C held stay timelines. The C9 seed games
are stills of tick 0, each meal and the last tick (selection `meals`). Bot games use the plan's
rule (`game`). A new capture source `frames` (single frames as named stills) carries tick stills.
Deviation: goldens beyond the plan's table: `seed-<clock>` (C9, for Task 5's seed fit; the clock
is in each note), `pause-bot` (Continue without a reseed), `gameover-*` (C12, cut from the frame
before the key; no `input`, because the keys come after the game; the notes give the key time),
`after-<game>-top-score` and `level-keys-virgin-up`. Not imported: the Score IDs pages after a
game (codes; Open question 4), the grace `try-*` probes, and the sound recordings (Task 10 takes
the cue edges from the Task 0 outcome).
Deviation: `tree/08-games/8-1-1.leaf` is asserted and keeps its 40 frames through a new table,
`ASSERTED_EARLY` (`tree-capture-set.ts`, injectable, tested). `PLACEHOLDER_OWNERS` keeps 8-1-1
until Task 10. `tests/acceptance.test.ts` lists asserted `game/*` goldens and 8-1-1 as todos
(`awaitsPlan23Scenario`; Task 11 deletes it), as plan 14 Task 2 did. The period fixture is an
`index.json` entry of kind `ticks` (`images: 0`, `frames`: its rows).

Completion (Task 2): 473 fixtures (438 asserted, 35 pending). Plan 23 adds 108 `game/snake/*`:
107 asserted and `level-keys-digit-1` pending:22. They are 64 stills, 43 timelines and the period
fixture (166 levels), with 755 images and 3.17 MB of text grids, over the 2 MB guide. The largest
are `bot-long` (121 tick stills), `ticks-l1`..`l9` (90 frames), the 33 key probes (≈3 images
each), the mazes and the deaths. `goldens/` is 10.7 MB. A second importer run leaves `goldens/`
unchanged, and `import-tree` and `extract-resources` produce no diff.

### Task 3 - phone-core: shown children numbered by position (TDD)

**Files:** `packages/phone-core/src/{menu.ts,machine.ts,types.ts,index.ts}`, README; tests
`shown.test.ts` (new).

- [x] TDD `shown`: hidden children are not listed, not reachable by ▲/▼ (wrap included), not
      counted by the rail or the rows window, not shortcut targets; numbers are positions
      (`segments` and the painter's appended number); `itemOrders` omitted; a path landing on a
      hidden child falls back to the level; `opening()` returning a hidden child falls back to the
      first shown; re-read per tick: a child that appears emits one snapshot; all hidden throws.
- [x] TDD `exit({ select })` into a level whose `shown` changed while the application ran (Continue
      appears after Navi) selects it, with `row` as plan 14.
- [x] Shortcut entry (`shortcutEntry`) on a `shown` level matches positions.
- [x] Existing tests pass unchanged; levels without `shown` produce identical models.
- [x] `mise exec -- vp run @hellotimber/phone-core#test`, `vp run -r test`, `vp run website#build`,
      `vp check --fix`.
- [x] Commit: `feat(phone-core): submenu children shown on demand, numbered by position`.

Deviation: `SubmenuEntry` gains `shownChildren()` (throws naming the level when none is shown),
`numberOf(child)` and `numbersByPosition`, the readers the kernel and hosts share. A hidden
child's number is the position it would take among the shown ones, which a running Continue
needs after its game resumes. The machine refits a level frame (selection and window) whenever
its shown children change: on every tick for the shown level, on every key, on entry and on an
exit into it.

### Task 4 - Snake II resources from goldens (TDD)

**Files:** `scripts/snake-resources.ts` (new: crop table, maze and HUD extractors),
`scripts/extract-resources.ts`, `scripts/widget-sprites.ts`, `src/resources/generated/snake.ts`
(generated), `src/resources/index.ts`, `tests/resources.test.ts`, `tests/snake-resources.test.ts`
(new).

- [x] Crop table (golden id, image, rectangle, sprite id) for: heads (closed and open, four
      directions), tails (four), straight and fat straight (four each), corners and fat corners
      (four each), food, the six creatures (board and HUD icon), the large creature if C5 showed
      it, HUD digits 0-9, the six fireworks pictures, the nine Level bar counts (`level/snake-<n>`).
      Report every picture the goldens do not show; missing pictures fail the task (recapture with
      a targeted bot run, Deviation).
- [x] Maze extractor: from each `maze-<m>` start image, the wall cells (2-px runs through cell
      centres per H1) as segments, and the start cell from the snake; emit `SNAKE_MAZES`.
- [x] Timing: `SNAKE_PERIODS` (1..175: levels 1-9 from `ticks-l<L>`, the rest from `periods`, each
      the median interval), `SNAKE_FIRST_TICK`, the grace, death and blink durations from the
      death timelines, and widget timelines for the game-over note and fireworks
      (`WIDGET_TIMELINE_BY_NAME`).
- [x] TDD: freshness (in-process extraction equals the committed file); every sprite is binary and
      inside its golden's ink; every maze leaves its start row free; periods are positive integers
      for every level 1..175; the game-over texts render in their faces (`missingStockGlyphs`).
- [x] Run `extract-resources` twice; no diff.
- [x] Commit: `feat(nokia-os): derive Snake II sprites, mazes and timings from goldens`.

Deviation (missing pictures, recaptured as the task says): the C5 games showed the small
creatures of kinds 3, 4 and 5 only (kind = `rand16 mod 6`, recovered from each game's seed), and
no game-over score with an 8 (the large font had no `8`). Two sections added to
`gen_v639_plan23.py` (`creatures`, `score-8`; `$REF/captures/README.md` "Plan 23 Task 4
recaptures") play seven level-1 games at clocks whose seeds draw the missing kinds for the first
creature (kind 0: 09:14, 09:56; kind 1: 11:07, 12:21; kind 2: 10:07, 10:21, 10:35, chosen with
`(seconds of the day + 7930) mod 65521`), and one game to eight meals that dies (`Your score:
8`). They are imported as `creature-<HHMM>` (tick stills, `meals`), `score-8` and
`score-8.death` (332 KB). Every listed picture is now shown; none is missing.
Deviation (picture set): corners are four pictures named by the cell edges they join (each serves
two turns); the fat straights coincide in pairs (left = up, right = down); the large creature
alternates two pictures (`large/1`, `large/2`) tick by tick and so does its HUD icon; digits are
4x5 cells (ink in the right three columns). The Snake Level bars (`level/snake-<n>`), the six
fireworks pictures and a `game-over/title` marker (the note's `Game over!` line) are widget
sprites in `scripts/widget-sprites.ts`, so the game-over timelines come from the probe-timeline
machinery (new kind `game-over`): `game-over-note` (bot-short.death) and `game-over-fireworks`
(bot-long.death), as captured. The game-over texts needed glyph runs (`scripts/text-runs.ts`, not
listed) and two overrides (large `RE` touch, large `8` advance).
Deviation (timing): periods are each golden's median interval, so levels 4 and 6 read 287 and
171 ms (seven intervals) where Task 0's full-recording medians read 286 and 170. The grace (93 ms)
comes from the one saved grace in a timeline (`virgin-game`); a crash draws its first hidden frame
88-110 ms after the blocked tick (maze-1/3/4). The death steps (medians of nine blink deaths) are
hidden 243, shown 237, 243, 238, 242, 238, 243, 237, then hidden 145 until the game-over screen
(2066 ms from the first hidden frame).

### Task 5 - Random numbers and the seed (TDD)

**Files:** `src/games/snake/rng.ts` (new), `scripts/snake-seeds.ts` (new: seed search),
`src/games/snake/seed.ts` (new: clock → seed), `tests/support/snake-decode.ts` (new),
`tests/snake-rng.test.ts` (new), `tests/snake-decode.test.ts` (new).

- [x] TDD the decoder on synthetic frames painted from known cells (the sprites from Task 4):
      head, body cells, food, creature cells, score digits; it rejects frames it cannot read.
- [x] TDD `rng.ts`: the generator (H12), `next()`, and placement helpers `placeFood` and
      `placeCreature` (H8, H9) on an occupancy grid.
- [x] `snake-seeds.ts` searches the 65,521 seeds for a golden's decoded placement sequence; the
      test runs it over every gameplay golden and requires exactly one seed per golden that
      reproduces every placement (meals' new food, creatures and kinds). If none fits, stop and
      report: H12 is wrong.
- [x] Fit `seed.ts` from the C9 seeds (one per clock setting and date): try the clock's fields
      (hours, minutes, an RTC seconds value of 0, day, month, year) and simple combinations; commit
      the function that fits every setting, with a test per setting. If none fits, use the
      fallback of D4 and say so in the test name.
- [x] Reseed points (H12, C8): the splash, New game and Continue; a test per point from the goldens.
- [x] Commit: `feat(nokia-os): Snake II random numbers reproduced from captured placements`.

Outcome: H12, H8 and H9 hold. `searchSeeds` finds exactly the recording's seed for every
golden with three or more placements (44530 for the 10:10 games: bot-long's 37 placements with
five creatures, the large one included, bot-short, bot-maze2, bot-maze3, bot-grace, pause-bot,
score-8, seed-1010 and its second game), each C9 clock's seed, and each creature recapture's
seed. Two seeds fit seed-0759 (36670, 60943; four placements) and creature-0914 (5371, 41170).
The timelines (ticks-l1..9, maze-0..5, virgin-meal, virgin-game: one or two placements) admit
4-584 seeds each, 44530 among them. The C7 key probes have no tick 0 and are not searched.
Deviation (seed function, D4 fallback): no closed form of the clock and date ports fits every C9
seed. `(seconds of the day + 7930) mod 65521` fits 07:59, 10:10, 10:11, 12:00, 19:48 and the
seven Task 4 recapture clocks (09:14-12:21). 23:59 (38909) and 10:10 on 14.10.2026 (10048) both
differ from it by exactly 10160, the shift a 32-bit seconds count adds when `seed × 0x625f`
overflows 2^32 in the first draw (2^32 mod 65521 = 225; -225 × 0x625f^-1 ≡ 10160), so the
generator is fed a 32-bit timestamp; but 5788 epochs fit those seven settings, none at a
midnight, so the epoch is open. 00:00 and 00:01 give the same seed (7995; the two captures are
identical), which no function of the shown clock gives (perhaps no reseed at those times; the
boot seed 7995 is not on seed 1's orbit). `seed.ts` therefore uses the minutes of the day
(UNVERIFIED), and a test records the evidence. Tests and Task 10's `createStockPhoneWith(config,
{ seed })` inject recovered seeds.
Deviation (reseed points): tests cover New game (seed-1010-second draws seed-1010's placements,
not a continuation of its generator) and Continue (pause-bot's placements continue its game's
sequence: no reseed, Task 0). The splash reseed is not observable (New game reseeds anyway), so
it has no test. The decoder (`tests/support/snake-decode.ts`) also turns a golden into its
placement sequence (`goldenPlacements`), and reads boards without the snake (the blink).

### Task 6 - Engine I: board, movement, keys, collisions and food (TDD)

**Files:** `src/games/snake/{engine.ts,model.ts,keys.ts}` (new), `tests/snake-engine.test.ts`
(new).

- [x] `model.ts`: the state (ring of segments with ring indices, heading, pending heading, food,
      creature, counters, crash state, score, level, maze) and the render model (cells with picture
      ids, food, creature, HUD values, blink visibility); pure, no time.
- [x] TDD H1-H8 and H16 with synthetic states: start per maze; wrap; walls; tail-cell rule; pending
      heading and no reverse; every key of H5 including diagonals and rotation; grace tick (saved by
      a turn, else death); growth one tick after eating; fat neck travelling; mouth open; score
      digits (low 16 bits).
- [x] `step()` returns `{ cues, events }` (cues per D8; events: `ate`, `crashed`, `died`).
- [x] Commit: `feat(nokia-os): Snake II engine movement, keys, collisions and food`.

Deviation: the engine is pure functions over an immutable `SnakeState` (`newSnakeGame`,
`snakeKey`, `stepSnake`, `snakeRender`; `blinkSnake` in Task 7), so suspend can keep a state
as it is. Events: `crashed` is the first blocked step (the grace begins), `died` the second (the
blink begins, cues `crash` and `vibrate`); game over is the session's, after the death steps.
The state keeps the firmware's current and previous headings (`heading`, `previous`): a blocked
step sets only `heading`, so grace keys are judged against the blocked direction and the saving
step's neck is pictured from the last move. `src/firmware/cues.ts` (Task 10's file) is created
now with the `StockCue` union and `StockCueSink` exactly as the contract, because `stepSnake`
returns cues. Vibration is 480 ms (Task 0 C10).

### Task 7 - Engine II: creatures, death and the ring (TDD)

**Files:** `src/games/snake/engine.ts`, `model.ts`, `tests/snake-engine.test.ts`.

- [x] TDD H9-H11: counter, spawn at 20, kinds, row/column exclusion with the food, countdown and
      HUD icon, expiry, eating score `5L + 5 + 2t`, the failed-spawn quirk (cells left in place), the
      large creature only if Task 0 saw it (else UNVERIFIED and unreachable by default), death
      blink schedule (visibility per blink step), the ring-wrap no-blink quirk.
- [x] Trace test: for every bot golden, drive the engine with its recovered seed and `input`
      (one `step()` per tick) and compare the decoded state of every tick still (head, body, food,
      creature, score). This proves the rules before any pixels are painted.
- [x] Commit: `feat(nokia-os): Snake II creatures, death and ring behaviour`.

Outcome: the engine replays 74 gameplay goldens from their seed and `input` (every bot game,
pause-bot, score-8, the C9 seed games, the creature recaptures, the C7 key probes, ticks-l1..9,
maze-0..5, virgin-meal, virgin-game): at every decoded board the score, countdown, food,
creature (kind and cells), snake cells and each segment's picture equal the golden's.
Deviation (H13): a head entering a creature keeps its mouth shut although the creature's next
cell lies ahead (bot-long tick 266): the head step clears the creature's cells beyond the head
before the mouth test. Deviation (timelines at level 175): a meal's redraw runs into the next
tick's, so the frame-numbered ticks of virgin-meal and virgin-game fall one behind the engine
after each meal; the trace catches up by one there (Task 11's replays must too; the `input`
ticks lie before the meals and are unaffected). The large creature's collection bit, a failed
spawn (its last try's cells left in place, hidden, counter 0) and the counter running down over
such cells follow the RE notes' tick order and are UNVERIFIED (never captured).

### Task 8 - Snake II painter (TDD against goldens)

**Files:** `src/display/widgets/snake.ts` (new), `src/display/widgets/index.ts`
(`SnakeModel` in `WidgetModel`), `tests/paint-snake.test.ts` (new).

- [x] TDD: painting the engine's render model equals every `ticks-l<L>` image, every `maze-<m>`
      start image, every tick still of every bot golden (engine driven by seed and `input`), and the
      blink frames of the death timelines; HUD countdown and icon; score `0175`.
- [x] Commit: `feat(nokia-os): paint Snake II from the stock sprites`.

Outcome: every board the 74 replayed goldens show paints pixel-exact (`tests/paint-snake.test.ts`),
and so do the blink frames of maze-1/3/4 and the five bot deaths, and bot-long's unblinking
death. Deviation: one board image is not painted, `ticks-l6` image `c`, the partial first burst
of a two-burst redraw (Task 0); the engine draws whole ticks, and the test lists it. The replay
helpers moved from the engine test to `tests/support/game.ts` (`SNAKE_TRACES`, `replayBoards`,
`snakeReplay`), which Task 11 reuses.

### Task 9 - Settings, the Level page and Top score (TDD)

**Files:** `src/firmware/settings.ts`, `src/firmware/bindings.ts`, `src/widgets/level-bar.ts`,
`src/display/widgets/level-bar.ts`, `src/firmware/leaves.ts`, `tests/settings.test.ts`,
`tests/widgets-info.test.ts`.

- [x] Check whether plan 15 has landed (D9). If not: TDD `number`/`setNumber` and snapshot
      `numbers` (validated integers; separate instances do not share); virgin
      `games/snake/level` = 175 and `games/snake/top-score` = 45 (move the latter out of
      `VIRGIN_TEXTS`).
- [x] TDD the Level widget for Snake II (D11): bars from the stored level, ▲/▼ per C1, OK stores
      and returns, C per C1; the plan 14 goldens (`8-1-2.leaf`, `probe/games-level-keys`,
      `probe/games-level-c`) still pass; every `level-<n>` and `level-keys-*` golden passes.
      Bantumi and Pairs II keep the static widget (comment naming plan 24).
- [x] Top score note reads `games/snake/top-score`; the `8-1-4.leaf` golden still passes.
- [x] Commit: `feat(nokia-os): stateful Snake II level and top score settings`.

Outcome: plan 15 has not landed, so the in-memory store gained `number`/`setNumber` and the
snapshot `numbers` (non-negative integers), with the virgin values in `VIRGIN_NUMBERS`
(`bindings.ts`: level 175; top score read from `8-1-4`'s second line, 45). Snake II's Level page
(`snakeLevel`, bound by `NUMERIC_LEVELS`) passes `8-1-2.leaf`, `level-1`..`9`,
`level-keys-virgin-up`, `-ok`, `-c`, `-hold-up` and both plan 14 probes; Top score reads the
stored number when it opens (`numberLine`) and plays `after-long-top-score` at 105.
Deviation: the flow's `onKeyDown` (D7, listed in Task 10) lands here, because the Level page's
▲/▼ act on key-down and repeat while held (`level-keys-hold-up`: +1 on the press, then after
778 ms, then every 482-496 ms; `LEVEL_REPEAT` = 778/489). Releases still reach `onKey`, which
stops the repeat. The repeat is compared with `GAME_TICK_TOLERANCE_MS` (16, now in
`tests/support/golden.ts`), since its intervals spread 14 ms. `level-keys-digit-1` stays
pending:22.

### Task 10 - Game application, game over and suspend (TDD)

**Files:** `src/widgets/snake.ts` (new), `src/widgets/game-over.ts` (new),
`src/display/widgets/game-over.ts` (new), `src/widgets/flow.ts` (`onKeyDown`),
`src/firmware/cues.ts` (new), `src/firmware/{leaves.ts,menu.ts,bindings.ts,phone.ts}`,
`tests/snake-game.test.ts` (new), `tests/flow.test.ts`, `tests/firmware-menu.test.ts`.

- [x] TDD flow `onKeyDown` (D7): forwarded only to widgets that declare it; release handling
      unchanged for the rest.
- [x] TDD the game widget: seeds from the clock port (Task 5) at New game; ticks at
      `SNAKE_PERIODS[level]` after `SNAKE_FIRST_TICK[level]`; grace/death/blink timings; cues to
      the sink with kernel times; game over → the game-over widget (D13): fireworks + `TOP
SCORE:` when the score beats the stored top score (which it then writes), else `Your
score:`; then `back(…, { select: "new-game", row })` per C11/C12; keys during the
      note per C12.
- [x] Suspend (H15, D10): Navi stores the engine state in the phone's game holder and exits with
      `select: "continue"`; Snake II's level gets the orders of D10, `shown` (Continue while a
      game is suspended), `opening()` (Continue when suspended) and the intro rule from C8;
      Continue reseeds (C8), shows the board and waits for a key; New game discards the suspended
      game. The holder is per `createStockPhone` (like the settings store) and power-off clears it.
- [x] Remove `8-1-1` from `PLACEHOLDER_OWNERS`; `createStockMenu` binds New game and Continue to the
      game; internal `createStockPhoneWith(config, { seed? })` for tests if D4's fallback applies
      (not exported from `src/index.ts`).
- [x] Commit: `feat(nokia-os): playable Snake II with game over, top score and Continue`.

Outcome: `src/widgets/snake.ts` runs the engine at `SNAKE_FIRST_TICK`/`SNAKE_PERIODS`, the grace
and `SNAKE_DEATH_STEPS`, stamps cues with the kernel time (`StockGames.now`, which
`createStockPhoneWith` takes from `tick`), and replaces itself with `src/widgets/game-over.ts`
(fireworks + `TOP SCORE:` when the score beats the stored top score, which it writes; else
`Your score:`), which returns with `select: "new-game", row: "top"`. The widget tests replay
`ticks-l1`..`l9`, `maze-1/3/4` (to the menu), `bot-short.death` and `bot-long.death` (105
written, no blink) pixel for pixel. The Snake II level gets Continue (order 1, the tree's
children 2..7), `shown` and `opening()` from the phone's games holder (`createStockGames`, per
phone; power-off clears it through `subscribe`); the phone tests cover suspend, Continue,
re-entry through the splash, New game discarding, standby keeping and power-off losing the
game, Top score and Level while suspended. `8-1-1` left both `PLACEHOLDER_OWNERS` tables;
`ASSERTED_EARLY` still cuts its golden to 40 frames (a re-import changes nothing of plan 23's).
Deviation: Continue does not reseed (Task 0 C8 and D4 outcome), although this task's text says
it does. Every key of the game screen acts on key-down, Navi and C included (they suspend at
once, as the captures show the menu while C is still held). The kernel swallows the keys held
when an application exits, so a C held through the suspend does not go on to standby
(`keys-c-hold`): a phone-core matter for Task 11 to record. Top score's return selects Continue
while a game is suspended (`NOTE_ENDS` stays `new-game`; the binder swaps it), and OK on the
Level page while suspended discards the game and selects the next entry (Mazes), as captured.
The `top-score` cue is emitted when the fireworks start (UNVERIFIED). Continue on a game
suspended during its blink resumes the blink at the first key (UNVERIFIED: not captured).
Without a clock port New game seeds 0 (the minutes-of-day fallback at 00:00).
Deviation (cue fixture): `scripts/snake-cues.ts` (REF reader; `snake-cues` script) writes
`tests/fixtures/snake-cues.json`: each C10 buzzer and vibrator edge with the tick whose frame
follows it (or the death's first hidden frame) and its lead over that frame. The session emits
a cue with its frame; the captures' edges lead it by 11-14 ms, within the game tolerance, except
with Warning tones On, where a meal's redraw waits 40-55 ms for the buzzer (not modelled, D6;
the test checks only the tick and kind there). Vibration runs 477-480 ms (480 in the cue).
Deviation (timing comparison, `tests/support/game.ts`): ticks are compared interval by interval
(±16 ms); the crash interval holds the blocked tick and the grace, so it allows 32 ms (the first
hidden frame comes 88-110 ms after the blocked tick, the saving move 93 ms); the death steps,
the game-over screens and the return are aligned on the death's first frame with ±16 ms, since
across the nine captured deaths the blink steps run 222-251 ms and the note 2925-2954 ms.

### Task 11 - Acceptance and the coverage guard

**Files:** `tests/support/drive.ts`, `tests/support/probes.ts`, `tests/support/game.ts` (new),
`tests/acceptance.test.ts`.

- [x] Scenarios for every `game/*` golden: navigate as the capture did (rig keys), set the level and
      maze through the menus (Level ▼/▲ presses as C1), press `input` keys on their ticks, record,
      compare pixels exactly and timing per D6 (`GAME_TICK_TOLERANCE_MS` for tick intervals,
      ±2 ms or the stated tolerance for the rest); tick stills compare after each listed tick.
- [x] The tick fixture: for each level 10..175 set through the Level page (fast path: a rig helper
      that writes the store, plus one scenario per decade that presses ▼ for real), start a game
      and compare the first tick and intervals.
- [x] `tree/08-games/8-1-1.leaf`: the generic `leaf` scenario with the game tolerance.
- [x] Coverage guard: Continue (bindings-added, not in `STOCK_TREE`) must be covered by an asserted
      `pause-*` golden; `8-1-1` is covered by asserted goldens; no new `KNOWN_GAPS` without a reason.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp check --fix`. Report the
      suite's run time (bot replays must keep it under ≈20 s; otherwise mark the long replays
      `it.concurrent` or reduce tick stills, Deviation).
- [x] Commit: `test(nokia-os): drive Snake II against its goldens`.

Outcome: `tests/support/game.ts` holds `SNAKE_SCENARIOS`, one per `game/snake/*` golden and
`tree/08-games/8-1-1.leaf`; `awaitsPlan23Scenario` is gone. 482 goldens: 447 asserted, 35
pending; plan 23's 117 are 116 asserted and `level-keys-digit-1` (pending:22). The acceptance
file passes 448 scenarios with 7 known gaps (the six of plan 14 and `game/snake/keys-c-hold`).
The nokia-os suite runs in ≈19 s (the acceptance file ≈17 s; the slowest scenarios are the
period fixture, 2 s, and the bot-long replays, ≈0.7-1.3 s each). Rigs seed New game with
10:10's 44530 (`SEED_1010`) or the trace's recovered seed through `createStockPhoneWith`.
Deviation (`tree/08-games/8-1-1.leaf`): its scenario is the game's, not the generic leaf one:
at level 175 the capture misses redraws (`q` lasts 33 ms and the head jumps three cells; a
meal's redraw runs into the next tick's), so the comparison lets a tick row follow session
frames the capture never showed, as many as its interval holds periods
(`missedTicksPeriodMs`); `virgin-meal` and `virgin-game` use the same rule.
Deviation (timing, `gameRows`): game-over screens compare intervals within PROBE_TOLERANCE_MS
(plan 14 closeout decision 2: they replay bot-short's and bot-long's recordings), the note
aligned on the first game-over frame; the fireworks pictures after the first are compared by
pixels and order only, as `virgin-game`'s steps differ from `bot-long`'s by up to 37 ms (62
summed) though both sequences take 2871-2872 ms. The fixture's levels 118 and 134 (two
intervals 29 ms apart) and 26 (a late tick) allow their own interval spread.
Deviation (top score): a new top score's game-over screen comes 45 ms after the death steps
(`virgin-game`'s last step is 190 ms, not 145; bot-long's fireworks also come ≈36 ms late), so
`extract-resources` derives `SNAKE_TOP_SCORE_MS` (45) and the session writes the top score, then
waits it out before the fireworks. The `top-score` cue comes with the write.
Deviation (death goldens): a `bot-*.death` golden starts on the board when its recording
started, sometimes ticks after the bot's last key (`bot-maze2`, `bot-maze3`), so the scenario
starts at the session's frame with those pixels. `gameover-*` press their key as long after the
session's showing of the golden's first screen as the capture did (the notes' 1500, 4000 and
7000 ms after the last key). `pause-continue*` press the resuming key one period before the
captured first tick (the key time is not in the capture). Known gap `keys-c-hold`: the kernel
swallows the keys held when an application exits, so C held through the suspend does not reach
standby (phone-core). `tests/support/rig.ts` gained the internal options (not in the file list).

### Task 12 - Demo, README, verification gate and closeout

**Files:** `packages/nokia-os/{README.md,demo/main.ts}`, `docs/specs/nokia-3310.md`,
`docs/plans/README.md`, this plan.

- [ ] Demo: arrow keys keep steering ▲/▼, digits steer the game; the golden overlay lists
      `game/*`. Verify with `mise exec -- vp run @hellotimber/nokia-os#demo` and `agent-browser`
      (headless: drive via the `[role=status]` line, Skip boot): set Level 1, New game, steer to a
      meal, die, see `Game over!` and the menu; Navi during play and Continue.
- [ ] README: the engine (D1), the speed finding (D2), seeds (D4), cues (D8), scores (D9).
- [ ] `mise exec -- vp check --fix`, `vp run -r test`, `vp run website#build`;
      `git diff --stat <commit before Task 1> -- website/ packages/snake/` is empty.
- [ ] Spec §10: replace "(plan 23, in progress)" with verified facts; list what stays UNVERIFIED.
- [ ] Plans README: row 23 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete Snake II (plan 23)`.

## Follow-ups

- **Plan 15:** persist `numbers` (Snake level and top score) with the rest of the store; decide the
  Snake record's factory values (the virgin level 175 is the only captured state).
- **Plan 16:** play `StockCue`s (eat, crash, top score, vibration) through the sequencer; measure
  their notes from `plan23/**/*.wav`; keypad tones during play.
- **Plan 24:** reuse the game-over widgets (D13), the flow `onKeyDown`, the `shown` seam if the other
  games add Continue, and the Level-page correction (measure Bantumi's and Pairs II's virgin
  levels before assuming "inert").
- **Plan 25:** the `Lights` setting during play.
- **Portfolio integration (not sequenced):** delete `packages/snake` and the website's Snake app when
  the website adopts nokia-os.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Virgin level 175 (D2):** reproduced, so a virgin New game runs at one cell per ≈7.7 ms and
   scores 175 per meal, exactly as the captured firmware does. Reverse in plan 15 by choosing a
   factory level (for example 1).
2. **Seed source (D4):** the clock, if Task 5 finds the function; otherwise minutes of the day,
   UNVERIFIED, with tests injecting the recovered seed.
3. **RE-note constants (D3, D4):** the generator constants come from the RE notes and are kept only
   because they reproduce every captured placement. Reverse by requiring a capture-only derivation
   (a search over generator families), at a large cost for no behavioural change.
4. **Score IDs:** if Task 0 shows `Last score ID`/`Top score ID` changing after a game, their
   encoding is not derivable from a handful of captures; the pages keep their stored values and the
   difference is a known gap owned by a later "Club Nokia" item. Reverse by capturing many games
   and fitting the encoding.
5. **Out-of-range levels 10..174 (D2):** captured and reproduced (one tick fixture, ≈166 rows).
   Reverse by treating them like 175 if the fixture is not worth keeping.
6. **Key latency (D6):** not reproduced, as for menus (plan 14 Open question 4).
7. **`packages/snake` (D1):** untouched and superseded for the stock OS; deleted at portfolio
   integration.

## Done means

- New game plays Snake II in `stockMenu` from the virgin state, at the stored level's captured
  speed, with every maze, key, food, creature, death and game-over behaviour checked against goldens
  (pixels exact; tick intervals within `GAME_TICK_TOLERANCE_MS`; other timings per D6).
- The Level page stores levels as captured; the top score is written at game over and shown by Top
  score; Continue appears only while a game is suspended and resumes it.
- Random placements of every recorded game are reproduced from one seed per game.
- Cues are emitted at captured times for plan 16.
- phone-core is still Nokia-agnostic; the website and `packages/snake` are unchanged; `vp check`,
  `vp run -r test` and `vp run website#build` pass; VISION, the spec and the plans README match
  what shipped.
