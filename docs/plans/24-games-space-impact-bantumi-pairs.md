# Plan 24 - Games II: Space Impact and the Games II seams

> **Fidelity standard (2026-10-15):** `AGENTS.md` "Fidelity standard" supersedes this plan's tolerance text.

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 13, 14, 15, 16 and 23 `done`, and the per-plan module refactor landed
(acceptance slices in `tests/acceptance/<NN>-<slug>.test.ts`, behaviour in
`src/firmware/features/<feature>.ts`, capture sets in `scripts/capture-sets/<NN>-<slug>.ts` with
`goldens/index/<NN>.json`, spec facts in `docs/specs/stock/<feature>.md`). Shared files take
one-line registrations only, except where Task 2 says otherwise. Plan 28 (game SDK) does not
depend on this plan, but both edit the Games level and the Level page (`levelPage`). Whichever
lands second rebases onto the other and keeps both plans' tests green.
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only). Read
`$REF/captures/README.md` ("Output format", "Plan 23 supplementary captures", "Plan 16
supplementary captures") and plans 13, 14, 16, 23 and 28 in full before starting. The planning
probes in `$REF/captures/scratch-plan24/{space-impact,bantumi,pairs2}/` are evidence for this plan
only and are never imported. Task 0 writes this plan's captures to `$REF/captures/6.39/plan24/`.
**Status (2026-10-29):** Task 0 is closed under Lachlan's accepted criterion changes below.
The eight full-level recordings, exits, ending and LCD-only control proof are validated;
implementation must replay their pixels under AGENTS.md's fidelity standard. The four accepted
defaults and behavior absent from the recordings remain UNVERIFIED. Tasks 1 and 2 are complete,
including the inherited Games II seams. Task 3 is complete: 168 fixtures are imported; 20 are asserted and 148 remain pending
gameplay/session replay. Task 4 is complete under the accepted revised criterion below.
Task 5 is split into level 0 (5a) and levels 1–7 (5b) under the accepted sequencing change
below. The level-0 decoder checkpoint reads 855 of 856 settled images exactly; full level-0
reconstruction remains open. Tasks 7/8/10 have an initial engine/painter slice, and Tasks 11/13 now have the
Games binding, initial session and 20 passing acceptance scenarios. Tasks 6 and 9/12/14 remain
open; none of those partial slices completes its task. The 2026-10-29 checkpoint below records its exact proof and limits.

## Goal

Make Space impact (`Games › Space impact › New game`, node 8-2-1) playable in
`@hellotimber/nokia-os`, pixel- and timing-faithful to the v6.39 captures:

- gameplay: the ship, every key the firmware reads, shots, the three special weapons, bonus
  pickups, the shield, lives, the scrolling terrain, all eight levels with their enemy waves and
  bosses, the level exits, the final boss, the continue screen and the end of the game;
- the game's two random number generators, reproduced so that recorded games replay exactly
  (D5, D6), and the title's star field, which comes from the same seed;
- the score and the top score it writes, with the stock game-over screens;
- suspend and Continue;
- its sounds and vibration through plan 16's sounder;
- goldens for all of it, replayed by key-driven acceptance scenarios.

It also builds the **Games II seams** that Bantumi (plan 24b) and Pairs II (plan 24c) need: one
shared game random generator and clock seed, per-game suspended state with Continue on every game
level, game-over endings beyond `Your score:`, game sounds as data, Level pages with any number of
bars, and game capture tooling that is not Snake-shaped (D1, D10-D13).

The website, phone-core and `packages/snake` do not change.

## Split (scope decision)

The brief allowed a split per game. The planning probes show that each game is a plan-23-sized
job, so this file is **plan 24 (Space impact, plus the shared seams)**, written in full.
**24b (Bantumi)** and **24c (Pairs II)** are listed at the end ("Plans 24b and 24c") with their
planning findings, decisions to carry, Task 0 sections and task outlines. Their files are written
when they are scheduled. Both depend only on this plan's Tasks 1-3, not on Space impact's
gameplay.

## Why this plan exists (measured gap)

| Area                | nokia-os after plans 14-23                            | v6.39 captures (planning probes, `$REF/captures/scratch-plan24/`)                                                                                                                                                       |
| ------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New game (8-2-1)    | placeholder owned by 24; golden `pending:24`          | a side-scrolling shooter: a 93 ms tick (12 timer units), an inverted level 0, a HUD of lives, a special weapon and its count, and a 5-digit score (`space-impact/out-A-nokeys`)                                         |
| Keys                | none                                                  | 8 up, 0 down, `*` back, `#` forward, 1/3 fire, 4/6 special; the stock Instructions say the same (`plan14/probe/games/instructions-8-2-4`)                                                                               |
| Levels              | none                                                  | levels last 50-60 s each; the scroll stops at a boss; a boss kill flies the ship off (≈3.4 s) into the next level (`space-impact/out-levels`, god mode, planning only)                                                  |
| Random numbers      | Snake II's generator, inside `src/games/snake/rng.ts` | the same `game_rand16`, seeded at New game by Snake II's clock rule; one chain for the whole game; a second, phone-wide ANSI `rand` for random spawn rows (D5, D6)                                                      |
| Splash              | a fixed timeline cut from the 10:10 capture (plan 14) | its 30 stars are drawn from the clock seed, so the picture differs per clock (H18)                                                                                                                                      |
| Pause               | Snake II only: `games.snake` and `SNAKE_LEVEL`        | Space impact pauses to `Continue / New game / Top score / Score IDs / Instructions` (`8-2-1`..`8-2-5`); canonical S2 retains Snake II and Space impact Continue together; Pairs II cross-mode scope is UNVERIFIED (D10) |
| Top score           | the note reads the virgin text `45` (`VIRGIN_TEXTS`)  | a new top score plays the fireworks and `TOP SCORE:`; the Top score page then shows it (`space-impact/out-after`: 70)                                                                                                   |
| Sound and vibration | Snake II cues only (`eat`, `crash`, `top-score`)      | shot, death, missile/wall, beam and bonus sounds with Warning tones On; the vibrator ≈480 ms per death and per boss kill                                                                                                |

## Planning investigation (2026-10-14)

Three exploratory sessions ran in `$REF/captures/scratch-plan24/` (scripts beside their `out-*`
results; nothing else in REF was written). Conclusions marked (peek) rest on RAM reads, which are
planning evidence only: Task 0 confirms each from the LCD or the audio before code relies on it.

### Space impact (`scratch-plan24/space-impact/`)

1. **Entry.** The splash runs 12 frames ≈200 ms apart (frame 4 a 16 ms transient, the last held
   874 ms); the menu appears 2578 ms after Select. Any key during the splash (Navi, C, 1, 5, ▲, 8)
   opens the **menu** ≈120 ms later, not a new game as the RE notes say (`out-A-splash`).
2. **Tick.** 93.3 ms mean over 36 intervals (12 units of ≈7.745 ms); LCD write times run
   93/93/93/107/78, so a 107/78 pair is redraw jitter. The New game frame comes ≈79 ms after
   Select and the first tick ≈158 ms after that frame. The shield ends at tick 32 (≈3.06 s).
3. **Keys** (tick-locked, against a no-key baseline, `out-keys`): 8 up and 0 down by 1 px, `*`
   back and `#` forward; 1 and 3 fire (the shot is drawn on the key event and moves 2 px per
   tick); 4 and 6 fire a missile (count 3 → 2); 2, 5, 7, 9, ▲ and ▼ do nothing. Moves show at the
   next tick. A held direction moves 1 px, then 2 px per tick. A held 1 or 4 gave one shot; the
   repeat-fire cap of the RE notes was not reached.
4. **Determinism.** The same keys at the same clock after two boots give byte-identical frames,
   timings and audio (`out-rng-a`, `out-rng-b`). Two games in one power cycle are identical **when
   keys are placed by tick** (`out-sync-a`); keys at fixed milliseconds diverge after 13 s because
   the tick phase against Select varies by ±15 ms. Inputs must be recorded by tick (D9).
5. **Seed** (peek, then LCD). `0x10da5c` holds a u32 written at every New game: `0xd4538d78` at
   10:10, `0xd45414f0` at 19:48 (13.10.2026). They differ by exactly the seconds between the
   clocks. With 32-bit wrapping arithmetic its first draw equals the first draw after Snake II's
   seed for that clock (44530, 13689), so the effective seed is Snake II's
   `(seconds of the day + 7930) mod 65521` on that date. No reseed happens between levels: a
   three-level run is one chain of 1381 draws from 44530. Level 0 makes no draws until scroll
   ≈431 (≈41 s); then 1-2 every 3 ticks. On the LCD, 10:10 and 19:48 runs are frame-identical
   for 902 frames and diverge at 64.2 s, when the same bonus orb gives an extra life at 10:10 and
   the wall at 19:48 (`out-syncgod-*`, `sheets/bonus.png`). The splash makes 60 draws (30 stars).
6. **ANSI rand** (peek). `0x111bf0` reads `0x7fffffff` at boot, is **not** reset per game (the
   state carries over), steps once at game over and six times in level 1 (the random-row
   spawns). Menu visits did not move it.
7. **Lives and game over** (no keys, `out-A-nokeys`): deaths at 8.7, 15.5 and 27.7 s, a respawn
   ≈0.4 s after each explosion, then the continue screen (`ooo` icons, `05` held 1545 ms, then
   one step per 775 ms ≈ 100 units) to `00`, then 12 fireworks frames of ≈220 ms (70 beats the
   virgin 45) and `Game over!` / `TOP SCORE:` / `70` for 2947 ms, then the menu. Top score then
   shows 70 (`out-after`).
8. **Pause** (`out-pause`): Navi or C opens `Continue / New game / Top score / Score IDs /
Instructions` (`8-2-1`..`8-2-5`) ≈70 ms after the key; C again goes to the Games list;
   re-entry from standby plays the whole splash, then opens on Continue. Continue's board stands
   until a key (still after 4 s); the first tick comes ≈57 ms after the key; Continue does not
   reseed.
9. **Levels** (god mode by `poke`, planning only): level 0's scroll stalls at the boss at ≈67 s,
   the boss dies at 72.6 s, level 1 starts at 76 s; level 1 runs 76-121 s, level 2 124-184 s.
   **The HUD does not redraw poked lives**, so god-mode frames are not faithful: the goldens need
   a bot that plays the unmodified game (D4). All eight levels take ≈8-9 min of emulated time.
10. **Sound** (Warning tones On): shot 440/466/494/523 Hz ≈39 ms each; death 880×15 ms, then
    4186×47, 932×15, 4186×47, 988×15, 4186×47; missile or wall 4186 ≈60 ms then 3951 down to
    2637 Hz at ≈15.5 ms each; bonus 2637 Hz, cutting the current sound off; the fireworks tune
    (587/880 Hz) at the fireworks and again on the note. The beam was not heard. The vibrator
    runs 478-508 ms per death and per boss kill (one ran 91 ms during key presses, unexplained).

### Facts shared by the four games

- **Seed.** Pairs II's boards (all nine Time trial boards chain from 44530 at 10:10; Puzzle at
  19:48 from 13689) and Space impact's draws use Snake II's New-game seed. The u32 at `0x10da5c`
  explains plan 23's unexplained seeds: a seed above 2^32 / 0x625f overflows in the first step,
  which is the 10160 shift plan 23 Task 5 found at 23:59 and on 14.10.2026 (D5).
- **Timer units.** Measured periods in units are the nominal milliseconds of the RE notes times
  32/255, rounded down: Space impact 100 ms → 12, 800 → 100; Pairs II 300, 267, 233, 200, 167,
  133, 100 → 37, 33, 29, 25, 20, 16, 12; Snake II 660, 380, 230, 90 → 82, 47, 28, 11. The engine
  still takes each period from goldens (plan 23 D2); the rule is a cross-check test (H1).
- **Continue.** In every game the board stands until a key, and that key then reaches the game
  (Pairs II: a 6 moved the cursor; Bantumi: the key releases a paused search, sowing or countdown
  and does nothing else because keys are ignored there).
- **Suspend slot.** Starting Puzzle while Time trial was suspended removed Time trial's Continue,
  and suspending Puzzle then opening the Time trial menu removed Puzzle's (`pairs2/out-e6`).
  This is planning evidence about Pairs II modes only, not a phone-wide slot. Canonical S2
  shows independent Snake II and Space impact suspension (D10); Pairs II cross-mode scope remains
  UNVERIFIED pending 24c captures.

## Scope and non-goals

In scope: the Goal items; the seams of D1 and D10-D13 with Snake II migrated onto them; nokia-os
internals; resources and goldens derived from captures; documentation.

Out of scope: Bantumi and Pairs II gameplay (24b, 24c), `Lights` during play (plan 25), the
standby number entry that digits start outside a game (plan 22), Club Nokia score IDs (plan 23
Open question 4), porting any stock game onto the plan 28 SDK (plan 28 D16), and any change to the
website, phone-core, phone-screen or `packages/snake`.

## Decisions

**D1 - Plan 24 is Space impact plus the Games II seams; 24b and 24c follow it (new).** See
"Split". The seams land first (Task 2) with Snake II migrated onto them, so 24b and 24c can start
after Task 3 while Space impact's engine is built.

**D2 - Space impact is stock-native: a pure engine and a feature module (plan 28 D16).** The engine
lives in `src/games/space-impact/` (pure TypeScript: no time, no DOM; immutable state, functions
like plan 23's `stepSnake`). The session that ticks it, runs its one-shot timer, suspends,
continues and ends the game lives in `src/firmware/features/space-impact.ts`; its painter in
`src/display/widgets/space-impact.ts`. The fixed-step SDK of plan 28 cannot express the pending
return code (H16), the one-shot timer, the continue screen's period or the phone-wide ANSI chain
without growing Space-impact-shaped options.

**D3 - The captures are ground truth; the RE notes are hypotheses; level data is reconstructed
from goldens (extends plan 23 D3).** `$REF/tools/lukesau-nokia-dct3-re/docs/
games_applications_3310.md` describes the game from a decompile. This plan states its rules as
hypotheses (H1-H22). A rule enters the engine with a test against goldens, or as an explicitly accepted UNVERIFIED
default. All
data is derived from goldens by committed generators: sprites, HUD glyphs, terrain tiles and
tilemaps, the per-level spawn scripts, movement paths, object templates (hit points, shots, fire
chance) and boss behaviour. The reconstruction (Task 5) tracks every object through the level
goldens and fits the RE notes' structures (spawn entry, pattern, template) to what it sees. A
value no golden shows stays UNVERIFIED in the spec; no exhaustive per-type census gates the
validated full-level recordings. The four defaults accepted on 2026-10-27 retain that label
beside code and spec behavior. Other missing implementation decisions are reported rather than
guessed. Nothing from `$REF/extracted`, the flash image or the RE notes'
tables is committed.

**D4 - Every level is captured from unmodified play by a look-ahead bot (new).** Pokes break the
HUD (investigation item 9), so god mode is planning-only. Task 0's bot plays by tick: before each
tick it `fork`s, tries candidate inputs a few ticks ahead, `exit`s from the ones that lose a life
and replays the best for real. All candidate scoring, phase and level tracking, key release,
continue/stop decisions and recording boundaries come from LCD observations and their history.
RAM reads cross-check those observations only (Task 0 capture-driver proof). The recorded run
is a real game with real keys (`keys.csv` by tick) and its frames are pixel-faithful. One full run
plays levels 0-7 to the end of the game; variety
runs supply the reviewed bonus, special, death/Continue and held-fire evidence. The accepted
2026-10-27 scope verifies the spawns, kills and shots contained in the eight full-level goldens;
behavior never exercised by them stays UNVERIFIED and does not gate Task 0.

**D5 - One shared game generator; retain the minutes-of-the-day fallback (accepted 2026-10-27).**
`game_rand16` (`seed = (seed × 0x625f + 0x3623) mod 0xfff1`) moves from
`src/games/snake/rng.ts` to `src/games/random.ts`. A u32 seed's first step wraps at 32 bits;
later states stay below 0xfff1. Candidate u32s reproduce the nine Snake II seed goldens' LCD
placement sequences, including overflow, but do not establish the actual clock function.
**UNVERIFIED accepted default:** `src/games/seed.ts` keeps the existing minutes-of-the-day
fallback (0 without a clock). Midnight route controls reject the clock/date-only fit. Do not
add an hour-zero formula from RAM. A gameplay replay may inject a seed only when an informative
LCD trace uniquely recovers it. No-draw and ambiguous gameplay traces remain noninformative;
they cannot borrow a splash or peek seed as gameplay proof. The six splash seeds are uniquely
recovered from LCD stars separately. Space impact uses one game RNG chain across levels and
Continue; exact consumer ordering remains to be checked by full-level replay (H14).

**D6 - The ANSI `rand` is a phone-wide generator (new).** Random spawn rows (`y = 0x3f`) draw from
a second generator whose state survives games and is set only at power-on (investigation item 6).
Its formula and boot value are fitted in Task 0 S8 (peek series) and accepted only if they
reproduce every random-row spawn in the goldens. It lives in the shared games holder (D10), is
reset at power-on and advanced by Space impact's random rows and by whatever else S8 shows
(the Task 0 ending controls below correct the unconditional game-over hypothesis). Goldens
that depend on it record the chain's position in their note (the games played since power-on),
and their rigs replay that history.

**Task 0 correction (2026-10-27):** captured Space impact new-top-score endings consume one
ANSI draw. Ordinary and tied-score endings consume none, including the first game after reboot
with its earned top score retained. See `analysis/ansi-game-over-resolution.json` and the
continuous LCD/audio recordings below. All twelve original level-1 LCD random rows now fit the ANSI LCG from `0x7fffffff`:
`state = state * 1103515245 + 12345 mod 2^32`, `rand15 = (state >>> 16) & 32767`,
`y = min(27, 6 + (rand15 & 31))` for that wave. Other wave bounds remain UNVERIFIED.
**UNVERIFIED accepted default:** other games and Games Settings leave ANSI unchanged;
24b/24c revisit their consumers. Preserve the chain across games and reset only at power-on;
do not implement an unconditional game-over advance.

**D7 - Timing: periods from goldens, per-interval tolerance, no latency model (plan 23 D6).** The
session ticks the engine at `SPACE_IMPACT_TICK_MS` (Task 0: ≈93 ms), the first tick
`SPACE_IMPACT_FIRST_TICK_MS` after the New game frame, the one-shot (shield) after
`SPACE_IMPACT_SHIELD_MS` (≈1500 ms after a resume, H1), the continue screen's steps at the
captured `05` hold and step period, and the level exit's steps as captured. Tick intervals follow AGENTS.md's shared game-rhythm rule (`periodToleranceMs`), never a
per-test tolerance. One-off and sequence edges use the shared timing helpers, and redraws
shorter than 34 ms follow its partial-redraw rule. Key-to-game latency is not
reproduced; `input:` places keys by tick (plan 23 D6).

**D8 - The pending return code is reproduced (new; H16).** When a tick leaves a sound pending
(a collision), the next event only returns it: a key is lost and a tick makes no step. The engine
models it as state (`pending`), and the session feeds it every event in order. A trace test shows
it in a golden (a collision sound followed by a skipped step) before it is kept; if no golden
shows it, it is UNVERIFIED and still modelled, since every replay depends on step counts.

**D9 - Keys act on key-down and are recorded by tick; held keys repeat (plan 23 D7, new rules).**
The feature declares `onKeyDown` and `onKey` (release). A held key repeats every
`SPACE_IMPACT_REPEAT_MS` (Task 0: 12 units, H2) while held: movement repeats move 2 px, fire
repeats fire up to the captured cap. Goldens carry `input:` by tick as plan 23's, with an added
release form (`<tick>:<key>^`) for held keys (Golden pipeline additions).

**D10 - Games II seam: per-game suspended state and Continue on every game level (new; revises
plan 23 D10 and Task 10).** Select the existing per-game alternative:
`StockGames.suspended: Partial<Record<StockGameId, unknown>>`. Canonical S2 LCD probes retain
Continue for Snake II and Space impact simultaneously, in both suspend orderings
(`plan24/slot/{snake-suspended,si-suspended}/after-other-suspended/{snake,si}-menu.png`).
Opening the other game's menu, Bantumi's menu, Pairs II's mode list or standby preserves the
suspended game in these probes. Suspending one game must not overwrite another game's state.
New game clears that game's suspended state; retain Snake II's existing Level-store clearing
behaviour and power-off clearing. Require captured evidence before adding further clearing rules.

A table of game levels (`GAME_LEVELS`: level number, New game number, game id, Continue factory)
replaces `SNAKE_LEVEL`. Continue's `shown`, `opening()`, Top score and Level returns (`NOTE_ENDS`,
`onStore`) read the relevant game's state. Continue's board stands until a key, which then
reaches the game. Snake II's existing goldens pass unchanged; add both-order scenarios proving
that suspending Space impact preserves Snake II's Continue and vice versa, with each board
resuming its own state. Pairs II's Time trial and Puzzle identifiers are provisional: the
scratch cross-mode clearing observation does not establish whether modes share storage or have
an explicit invalidation rule. Resolve that in 24c before implementing their suspension scope.

**D11 - Game-over endings are data (new; extends plan 23 D13).** `gameOver()` takes an ending:
`score` (`Game over!` / `Your score:` / N), `top-score` (fireworks, then `TOP SCORE:` / N), and
the endings 24b needs, `won` (fireworks, `YOU WON!`), `draw` (`Game over!` only) and `lost`
(`You lost, sorry!`). Each ending's lines, fonts and timeline are a resource from goldens; Task 2
adds `score` and `top-score` from plan 23's goldens and the type for the rest, whose resources 24b
adds. Snake II's game-over goldens pass unchanged.

**D12 - Scores: Space impact's top score is a number (plan 23 D9).** `games/space-impact/top-score`
moves from `VIRGIN_TEXTS` to `VIRGIN_NUMBERS` (virgin 45, `8-2-2`'s second line); Pairs II's two top
scores move the same way (virgin 0) for 24c. Game over writes a beaten top score (fireworks).
Restore keeps it (`RESTORE_KEEPS`, as Snake II's: v5.79 Restore kept the top scores). The score
shows as 5 digits and stops below 31500 (H8). Score IDs keep their stored text (plan 23 Open
question 4).

**D13 - Game sounds are data: one cue kind, programs from sound goldens (extends plan 16 D13).**
`StockCue` gains `{ kind: "game-sound"; id: string }`. The sounder plays `GAME_SOUNDS[id]` under
plan 16's gating (Warning tones On and Games › Settings › Sounds On), and a new sound replaces the
one playing (H19). Each game's programs are derived from its sound goldens by plan 16's program
extractor (`scripts/sound-programs.ts`) into `GAME_SOUNDS`, keyed `<game>/<sound>`. Snake II's
`eat`/`crash`/`top-score` cues stay as they are. Vibration stays `{ kind: "vibrate"; ms }`.

**D14 - Level pages with any number of bars (new; shared with plan 28 Task 7).** Snake II's Level
widget becomes `levelPage({ settings, key, max, bars, softkey, onStore })`, with Snake II's
behaviour as the `max: 9` case (its clamps from 175 included). Space impact has no Level page; 24b
(5 bars) and 24c (7 bars) need it. Plan 28 Task 7 plans the same function: whichever plan lands
first writes it and the other reuses it.

**D15 - Public API, phone-core and the website unchanged (plan 23 D12).** `createStockPhone`,
`StockPhoneConfig` and the exports keep their signatures. Internal additions only.

## Rules to verify (hypotheses; each needs a golden)

From the RE notes (cross-check) and the planning probes. Task 0 confirms or corrects each.

| #   | Hypothesis                                                                                                                                                                                                                       | Task 0 section |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| H1  | Tick 12 units (≈93 ms) at every level; the shield one-shot 3000 ms (376 units) after New game and a respawn, 1500 ms after a resume; continue steps 800 ms (100 units); key repeats every 12 units; units = floor(ms × 32 / 255) | S3, S4         |
| H2  | 8 up, 0 down, `*` back (x ≥ 1), `#` forward (x ≤ 73), 1/3 fire, 4/6 special; repeats move 2 px; a held fire key repeats at most 5 times; other keys ignored; keys act on key-down                                                | S4             |
| H3  | Ship 10x7 from (5, 20); y limits 6..41 with ground terrain, 1..35 with ceiling terrain (levels 4, 5)                                                                                                                             | S5             |
| H4  | Terrain: 2 rows of 16 tiles of 32x8 (512 px, wrapping); 1 px per tick while the script runs; stops for the boss; level 0 has none; levels 4 and 5 on the ceiling                                                                 | S5             |
| H5  | A per-level spawn script: group size, type, x spacing, pattern, pattern argument, ticks to the next entry, y or a random row, fire chance, shots, hit points; members at x = 84 + n × spacing                                    | S5, S6         |
| H6  | Movement patterns: paths by x (sine, rise, fall), descend/climb, track the ship, dive, straight, slopes, homing missile, boss behaviour per level                                                                                | S5, S6         |
| H7  | Ship against terrain and objects by pixels (objects by box first; bullets by box only); shots against enemies by box, bosses by pixels; shield pushes 2 px off terrain                                                           | S5, S6         |
| H8  | +5 per hit that does not kill, +10 per kill, +100 per boss; boss projectiles score nothing; the score stops below 31500                                                                                                          | S5             |
| H9  | Bonus orb: `rand16 & 3` → extra life (re-rolled at 5 lives), missiles, wall, beam; the same weapon adds 3 (beam 1), another replaces it with 3 (beam 1); a second pickup (type 0x21) adds 3 specials                             | S6             |
| H10 | Missile homes on the enemy with the most hit points, 2 px per tick; wall: a 7-frame burst on the ship, 4 hit points per hit; beam: a full-height sweep at 2 px per tick, killing within 3 px, 2 hit points from a boss           | S6             |
| H11 | A death: explosion, a life less, respawn with the shield; at 0 lives with continues left the continue screen counts 5..0, keys 1/3/4/6 restart the level from its start with 3 lives and 3 missiles; otherwise the game ends     | S3, S6         |
| H12 | A boss kill: explosions, +100, the ship lines up and flies off (≈3.4 s), the next level loads; after level 7 the game ends as at game over                                                                                       | S5             |
| H13 | Level 7's final boss (38x38) and its two parts appear at scroll 0x7a, 0x13a and 0x1ba                                                                                                                                            | S5             |
| H14 | Enemy fire (1 in N per object), bonus kinds and explosion frames draw from one game generator per game (D5); level 0 draws nothing before scroll ≈431                                                                            | S5, S7         |
| H15 | Random spawn rows draw from the phone-wide ANSI generator (D6)                                                                                                                                                                   | S8             |
| H16 | A sound left pending by a tick makes the next event return it and do nothing else (D8)                                                                                                                                           | S5             |
| H17 | Levels 0, 4 and 5 draw on a full black fill with objects flipped out of it; the others on white; the HUD always flips                                                                                                            | S5             |
| H18 | The splash: a black fill, 30 one-pixel stars at (draw mod 84, draw mod 48) from the clock seed, the logo halves sliding in and the ship flying across, then the menu; any key opens the menu                                     | S1             |
| H19 | Sounds: shot, death, missile or wall, beam, bonus; a new sound replaces the playing one; the fireworks tune at the fireworks and on the note; all gated by Warning tones and Games › Settings › Sounds                           | S9             |
| H20 | The vibrator runs 62 units (≈480 ms) at a death and a boss kill, restarted by each, gated by Shakes and Vibrating alert                                                                                                          | S9             |
| H21 | Navi or C suspends; Continue's board stands until a key, which reaches the game; the shield after a resume lasts 1500 ms; Continue does not reseed                                                                               | S2             |
| H22 | Game over: a beaten top score plays the fireworks and `TOP SCORE:`, else `Your score:`; both ≈2.94 s; then the menu on New game; Navi or C skip                                                                                  | S3, S10        |

## Ground truth and artefacts

| Source (`$REF/captures/6.39/`)      | Contents                                                      | Use                                                |
| ----------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| plan 14 goldens for 8-2 (committed) | splash, menu, Top score, Score IDs, Instructions              | unchanged except the splash (H18, Task 11)         |
| `plan14/open/8-2-1` (committed)     | the first 60 frames of a virgin New game                      | `pending:24` → asserted (Task 3)                   |
| `scratch-plan24/space-impact/`      | the runs cited above                                          | evidence for D4-D10; never imported                |
| `plan24/splash/<clock>/` (S1)       | the splash at four clocks, no key and with keys               | splash timelines; star-field seed check            |
| `plan24/pause/` (S2)                | Navi, C, the pause list, Continue, re-entry, the suspend slot | `game/space-impact/pause-*`; D10                   |
| `plan24/nokeys/` (S3)               | a no-key game to the menu, with audio                         | tick, shield, deaths, continue screen, game over   |
| `plan24/keys/` (S4)                 | every key single and held; continue-screen keys               | `keys-*`                                           |
| `plan24/bot/full/` (S5)             | the look-ahead bot through levels 0-7 and the end             | tick stills per level, level exits, the final boss |
| `plan24/bot/<variety>/` (S6)        | variety runs (bonus kinds, specials, deaths and continues)    | tick stills; the reconstruction's coverage         |
| `plan24/seed/<clock>/` (S7)         | games at five clocks and dates                                | the seed fit (D5)                                  |
| `plan24/ansi/` (S8)                 | the ANSI chain across games and other games' game overs       | D6                                                 |
| `plan24/sound/` (S9)                | every sound and the vibrator; Sounds Off, Shakes Off          | sound goldens (D13)                                |
| `plan24/after/` (S10)               | Top score and Score IDs after games; keys on the end screens  | `after-*`, `gameover-*`                            |
| `plan24/text.json`                  | OCR runs for the new images                                   | text runs for the harvester (plan 14 D13)          |

Artefacts (added to `docs/specs/stock/space-impact.md` in Task 1):

| Artefact                                                       | Cause                                                     | Handling                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| Identical random events in every game at one clock setting     | emulator RTC frozen (issue #1); the seed is clock-derived | behaviour is "seed from the clock" (D5); the frozen clock is a test input |
| Top score `45`, Score IDs `ç` / `ÆG`                           | uninitialised game EEPROM (plan 14)                       | virgin initial state                                                      |
| ANSI generator at its boot value in every capture's first game | each section starts from power-on                         | reproduced (D6): a phone's first game after power-on starts there         |
| Tick-phase jitter of ±15 ms against Select                     | the timer's phase at the key                              | not reproduced; inputs by tick (D9)                                       |
| Timer unit ≈7.745 ms                                           | emulator timebase (plan 23)                               | reproduced as captured; UNVERIFIED against hardware                       |

## Package boundaries

Unchanged from plans 13-23. `nokia-os` → `phone-core` (runtime) and `phone-screen` (LCD toolkit);
never `snake`, `phone-3d`, the plan 28 SDK packages, `@tanstack/*` or `website/`. No phone-core
seam is needed: Continue uses plan 23's `shown`, `opening()` and `exit({ select, row })`.

## Contract changes

No public change (D15); VISION.md is not edited. Internal additions (not exported):

```ts
// src/games/random.ts (moved from src/games/snake/rng.ts; D5)
export const GAME_RANDOM_MODULUS = 0xfff1;
export interface GameRandom {
  next(): number; // the next draw, 0..0xfff0
  readonly state: number; // a u32 before the first draw, then the last draw
}
export function createGameRandom(seedU32: number): GameRandom; // first step in u32 arithmetic
export interface AnsiRandom {
  next(): number;
  readonly state: number;
} // D6, formula from Task 0 S8

// src/games/seed.ts (D5): the u32 New game writes; undefined without a clock
export function gameSeed(clock: string | undefined, date: string | undefined): number | undefined;

// the shared games holder (D10; file per the refactor, e.g. src/firmware/features/games.ts)
export type StockGameId =
  | "snake"
  | "space-impact"
  | "bantumi"
  | "pairs-time-trial"
  | "pairs-puzzle";
export interface StockGames {
  suspended: Partial<Record<StockGameId, unknown>>; // D10; Pairs II mode scope unresolved
  seed(): number; // the u32 for New game
  ansi: AnsiRandom; // phone-wide (D6); holder replaces it only at power-on
  readonly cues: StockCueSink;
  now(): number;
}

// src/firmware/cues.ts (D13): one more member
//   | { readonly kind: "game-sound"; readonly id: string }

// src/widgets/game-over.ts (D11)
export type GameEnding =
  | { readonly kind: "score" | "top-score"; readonly score: string }
  | { readonly kind: "won" | "draw" | "lost" };
```

## Golden pipeline additions

**Plan 29 dependency:** the pipeline29 worker owns the shared resource-registration repair.
Tasks 4-5 wait for that verified change, then inspect and use its actual registration contract.
Do not assume a future API, edit the shared repair here or treat a planned interface as landed.
Task 0's LCD capture repair can proceed independently. Imported/generated assets still wait
for the canonical-level gate below; no hand edits to goldens or generated files.

### `input` with releases (`scripts/golden-format.ts`)

Plan 23's `input: <tick>:<key> …` gains a release form `<tick>:<key>^`: the key goes up after the
frame of tick `<tick>`. A key without a release is a tap (released before the next tick, as
plan 23's). Releases are ascending with the presses and only follow a press of the same key.

### Generic game capture (`scripts/game-capture.ts`, split from `scripts/game-capture-set.ts`)

Plan 23's tick numbering, `keys.csv` → `input`, tick-still selection and timeline cutting move
into a generic module parameterised by a frame predicate (`isGameFrame`), a period and a still
selection rule. Snake II's table stays in `game-capture-set.ts` and imports it; its goldens are
byte-identical after the split.

### Capture set (`scripts/capture-sets/24-space-impact.ts`; `goldens/index/24.json`)

Ids `game/space-impact/<name>` and `sound/game/space-impact/<name>`; `asserted` unless noted.

| Fixture id(s)                         | Source              | Kind                                    | Asserts                                              |
| ------------------------------------- | ------------------- | --------------------------------------- | ---------------------------------------------------- |
| `splash-<clock>`, `splash-key-<key>`  | `plan24/splash/*`   | timelines                               | H18: the stars per clock; any key opens the menu     |
| `pause-*`                             | `plan24/pause/*`    | stills / timelines (+ `input`)          | H21, D10                                             |
| `nokeys`, `nokeys.death-<n>`, `.over` | `plan24/nokeys`     | tick stills + timelines                 | tick, shield, deaths, the continue screen, game over |
| `keys-*`                              | `plan24/keys/*`     | tick stills + `input`                   | H2                                                   |
| `level-<l>` (l = 0..7)                | `plan24/bot/full`   | tick stills + `input` (the level's cut) | every level's waves, terrain and boss                |
| `level-<l>.exit`                      | `plan24/bot/full`   | timeline                                | H12; the final boss and the end after level 7        |
| `variety-<name>`                      | `plan24/bot/<name>` | tick stills + `input`                   | bonus kinds, specials, deaths and continues          |
| `seed-<clock>`                        | `plan24/seed/*`     | tick stills of the random events        | D5                                                   |
| `ansi-*`                              | `plan24/ansi/*`     | tick stills                             | D6                                                   |
| `after-*`, `gameover-*`               | `plan24/after/*`    | stills / timelines                      | H22, the top score written                           |
| `sound/game/space-impact/*`           | `plan24/sound/*`    | sound goldens (plan 16 format)          | H19, H20                                             |
| `tree/08-games/8-2-1.leaf`            | plan 14 (existing)  | `pending:24` → asserted                 | the virgin New game                                  |

A level golden holds the tick stills the reconstruction and the replays need: every tick on which
an object spawns, dies, fires or changes picture, every 16th tick otherwise, and the last 12. The
importer reports counts and bytes; the budget guide is ≤ 6 MB of new text grids (plan 23 added
3.17 MB for one smaller game). If the selection exceeds it, the importer thins the "every 16th"
stills first (Deviation in Task 3).

## Stock display observations (planning; Task 4 confirms from goldens)

| Element    | Observation                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| HUD        | rows 0-4: hearts (lives) from the left, then the special icon and a 2-digit count, then a 5-digit score on the right |
| Level 0    | inverted: a black field, the ship and enemies white; level 1 normal                                                  |
| Ship       | box (5, 20)-(14, 26) at the start                                                                                    |
| Continue   | `ooo` (continues left) and a digit counting 05 → 00                                                                  |
| Pause menu | rows list `Continue / New game / Top score`, Continue on the top row, rail of 5                                      |

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` and `mise exec -- vp run @hellotimber/nokia-os#test`
  (every golden must still pass). Tasks 2, 11 and 14 also run `mise exec -- vp run -r test` and
  `mise exec -- vp run website#build`.
- Commit rule: run `mise exec -- vp check --fix` yourself, stage files by explicit path, then
  `git commit --no-verify -m "<message>"`. Never `git add -A`/`git add .`. Never stage `TODOS.md`.
- Shared files take one-line registrations (a capture-set export, a widget model, a feature, a
  record, an acceptance slice). Task 2 is the exception: it migrates Snake II's game wiring onto
  the seams and says which files it edits.
- Never hand-edit `goldens/**`, `src/resources/generated/**`, `src/firmware/generated/**` or
  `scripts/generated/**`: change the generator or its input tables and regenerate. Each generator
  runs twice with no diff before its commit.
- Tests never read `$REF`. Generators that read `$REF` fail clearly when it is missing.
- No new dependencies.
- When reality differs from this plan, follow the captures, then append a `Deviation:` paragraph
  under the task. If a deviation breaks a contract in VISION.md, stop and report instead. If the
  refactor named a module differently from this plan, use its name and say so in the task's
  completion note.
- Parallelism (max 3 concurrent agents): Task 0 gates everything, then Task 1. Then lanes A (2),
  B (3 → 4 → 5) and C (6, after 3). Task 7 needs 4 and 6; 8 needs 5 and 7; 9 needs 8; 10 needs 4
  and 7; 11 needs 2, 9 and 10; then 12 → 13 → 14. Plans 24b and 24c may start after Task 3.

## Tasks

### Task 0 - Canonical REF captures (closed under the accepted 2026-10-27 decision)

**Closure:** accepted defaults replace the four unresolved branches; validated full-level
recordings replace the exhaustive census. The historical checklist below is closed under those
criterion changes, not a claim that the omitted branches were observed.

**Files (all under `$REF`, gitignored):** `captures/scripts/gen_v639_plan24.py`,
`captures/scripts/v639-plan24-<section>.cap`, `captures/6.39/plan24/**`, a new section in
`captures/README.md`. Repair the existing plan24 generator in place. Preserve existing captures
and audit interrupted artifacts before rerunning their sections; write repair probes to new
plan24 evidence directories. Do not modify other plans' scripts/captures or `scratch-plan24/`.

- [x] Read `$REF/captures/README.md`, `captures/scripts/gen_v639_plan23.py` (its `Drive`, `Bot`,
      seed search and section runner are the model) and the scratch scripts in
      `captures/scratch-plan24/space-impact/` (`si.py` has a tick-locked driver, `Sync`, and a
      RAM tracer).
- [x] Repair and complete `gen_v639_plan24.py` with subcommands `run` (`-j 2` workers,
      `--only <section>`), `bot`, `ocr`, `check`, `seeds` and `list`. Every section starts with `include v639-setup.inc`,
      `key c`, `run 2s` (clock 10:10 unless S7), records audio around every gameplay recording,
      and writes `keys.csv` (`tick,key,press_ms,release_ms`, tick = the last tick frame before the
      edge). Keys in recordings are raw edges placed by tick (investigation item 4). Navigation:
      Menu, ▼×7, Select (Games), ▼, Select (splash), Navi (skip), `idle`.
- [x] **S1 splash:** no key, at 10:10, 19:48, 07:59 and 23:59 (a record each, through the menu);
      Navi, C, 1 and ▼ at 300 ms (records). Peek the seed after the splash (planning).
- [x] **S2 pause and the suspend slot:** Navi during play (record), ▼ through the pause list
      (shots), C (shot), re-entry from standby (record: splash, then Continue), Continue (record
      4 s: the board stands), then each of 8, 1 and Navi as the first key (records: is the key
      delivered?), Top score and New game while suspended. **The slot:** suspend Space impact,
      then (a) open Snake II's menu, (b) start and suspend a Snake II game, (c) open Pairs II's
      mode list, (d) go to standby and back; after each, shot Space impact's menu (Continue?) and
      Snake II's. Repeat with Snake II suspended first; include Bantumi menu visits. Confirm
      simultaneous Continue and independent resumed boards per D10; preserve Pairs II cross-mode
      uncertainty for 24c.
- [x] **S3 no keys:** a virgin game with no keys to the menu after game over (≈45 s), audio.
- [x] **S4 keys:** tick-locked, each key tapped on tick 40 (after the shield) and held for 20 ticks:
      0-9, `*`, `#`, ▲, ▼; two direction keys between ticks; 1 held 40 ticks (the repeat-fire cap);
      4 and 6 until the specials run out. On the continue screen (from S3's state by `fork`): 1, 3,
      4, 6, 5, 8, Navi, C at `03`.
- [x] **S5 the full run:** the look-ahead bot of D4 (`bot`): fork per tick, candidate inputs
      (stay, up, down, back, forward, fire, special) over a horizon of 8-16 ticks, scored by lives
      lost then by score; `exit` back and play the best. It reads lives, score and phase from the
      LCD (HUD digits and icons learned from canonical S3). Derive phase, level transitions,
      play/release/continue/stop decisions and recording splits from LCD frames and their history,
      including exits, deaths, continue countdown, fireworks and menu. Track level identity from
      an observed New game and counted LCD-confirmed exits; reset only on an observed restart.
      Unknown or ambiguous LCD states fail with frames and a diagnostic, never a RAM fallback.
      Peek only cross-checks the decoded observation after control decisions are made; its values
      cannot enter candidate scoring, phase/level tracking, stop predicates or recording cuts.
      Play levels 0-7 to the end of the game, then the game-over screens and the menu.
      Record the whole run (one recording per level, split at the level-exit frame, plus `end`).
      Budget ≈8-9 min emulated for the game; the search may take hours of wall time (one worker).
- [x] **Capture-driver proof before S5:** replay stored LCD sequences for play, death, continue,
      exit, next-level entry and ending through the controller with RAM diagnostics disabled,
      truthful and deliberately conflicting. All produce identical key edges, candidate choices,
      phase/level decisions, stop reasons and recording boundaries. Collect the controller decisions
      before evaluating diagnostic assertions; conflicting diagnostics must be reported as failed
      cross-checks without substituting RAM values. Only diagnostic outcomes differ.
      Add negative checks for ambiguous LCDs and a source/data-flow audit proving no peek return
      reaches control or split logic (including helpers, variety stop predicates and replay cuts).
      Run a short unmodified live fork/search probe with diagnostics disabled and repeat with
      diagnostics enabled: keys, LCD hashes and boundaries agree. Save commands, results and
      per-decision LCD evidence under REF. No emulator RAM writes, pokes or firmware calls.
- [x] **Canonical-level gate:** before any imports, resource generation, level reconstruction or
      engine implementation, finish and validate S5's complete unmodified levels 0-7, exits and
      final ending, plus the required S6 variety evidence. Each cut has LCD-derived boundaries,
      continuous tick/key/audio provenance and a replayable command stream; adjacent cuts chain
      without gaps. Scratch progress and interrupted streams are not complete level captures.
      `check` must fail when a level, exit, ending, required variety observation or control proof
      is missing. Report actual elapsed time, evaluation counts and coverage at interruptions;
      keep Task 0 incomplete until every required section passes.
- [x] **S6 variety:** four bot runs from S5's level starts (`fork` at each level's first frame in
      the S5 process, so later levels need no replay): `bonus` (take every orb: all four kinds,
      the life re-roll at 5 lives if reachable), `specials` (use the wall and the beam on enemies
      and a boss), `deaths` (lose every life in levels 0 and 3, take the continue with 1, refuse
      the last one), `cap` (hold fire through a wave). Each logs which objects it has seen; extend
      the runs until every object type the levels spawn has been seen killed and, where it fires,
      firing.
- [x] **S7 seed:** reboot with the clock at 10:10, 19:48, 07:59, 23:59, 00:00 and 10:10 on
      14.10.2026 (`setup_lines` of plan 23); a no-key game to the first random event the LCD
      shows (enemy fire in level 0 after ≈41 s, or the 64 s bonus orb). Peek `0x10da5c` (u32)
      after New game at each, and at the plan 23 C9 clocks (12:00, 00:01, 10:11) for the fit.
      A first random event is only a starting point: extend recorded unmodified play until each
      designated seed-recovery dataset uniquely identifies its effective seed. Track no-draw and
      ambiguous traces separately with independent clock proof references (Task 6). The clock/date
      fit is not accepted until every existing Snake II seed golden is reproduced from the LCD.
- [x] **S8 ANSI chain:** peek `0x111bf0` at power-on, then after each of: a Space impact game over,
      a Snake II game over, a Pairs II game, a Bantumi game, the Games › Settings pages, a level-1
      random-row spawn. Two Space impact games in one power cycle through level 1 (S5's keys
      replayed), recorded: do their random-row spawns differ as the chain predicts?
- [x] **S9 sound:** Tones › Warning tones On (plan 23 `c10_warning`): replay S5/S6 keys around a shot,
      a death, a missile, a wall, a beam, each bonus kind, a boss kill and game over, with audio;
      then Games › Settings › Sounds Off and Shakes Off, a death each. Vibrating alert as the
      profile has it (plan 16's rule).
- [x] **S10 after:** Top score after a beaten and a not-beaten game (records), Score IDs pages; Navi,
      C and ▼ at 1.5 s and 4 s into the fireworks and into `Your score:` (records).
- [x] OCR every new image into `plan24/text.json` (plan 14 format). `check`: every recording starts
      on its parent screen; every gameplay recording has `keys.csv` and audio; S5's level files
      chain (each level's first frame follows the previous exit).
- [x] Append "Plan 24 supplementary captures" to `$REF/captures/README.md`.
- [x] No commit. Record the outcome under this task: H1-H22 confirmed or corrected, the D10 slot
      rule, the seed fit (D5), the ANSI formula and its advancers (D6), the tick, shield, respawn,
      continue and exit timings, the interval spread, the bot's wall time, the objects seen per
      level, and any section that failed.

### Task 0 evidence and outcome (partial attempt, 2026-10-14)

Source: `$REF/captures/6.39/plan24/resume-handoff.json`, `identifiability/result.json`,
`slot/text.json`, the corresponding raw PNGs and `captures/scripts/gen_v639_plan24.py`.
This reconciliation changes documentation only; it neither completes Task 0 nor starts Tasks 1-6.

- **Seed identifiability:** 10:10 starts and ends at u32 `0xd4538d78`; 19:48 starts and ends at
  `0xd45414f0`. The tap-5 traces through tick 52 have the same 53 tick-frame hashes (initial
  gameplay frame plus 52 ticks), with no RNG draws. A byte comparison also finds all 54 raw
  recording PNG files identical, including the parent/menu frame. Distinct seeds producing
  the same observation prove unique seed recovery from that recording is impossible. This is
  a noninformative trace, not evidence that the two seeds are equal or that H14 is wrong.
- **Suspension:** `slot/text.json` has 28 OCR images. All four
  `{snake-suspended,si-suspended}/after-other-suspended/{snake,si}-menu.png` images show Continue;
  the raw LCDs confirm it. Other-game menu, Bantumi menu, Pairs II mode-list and standby visits
  preserve the suspended game. D10 selects per-game state. Pairs II cross-mode scope remains
  UNVERIFIED; the scratch observation is retained for 24c to investigate.
- **Capture-driver discrepancy:** `Bot.play` takes the returned RAM assertion state and uses
  `st["phase"]` and `st["level"]` to update control state, release keys and split recordings.
  Its inherited assertions-only claim is false. Repair all control paths to use LCD observations
  and prove RAM independence before continuing the bot. RAM remains diagnostic evidence only.
- **Actual bot evidence:** the prior scratch attempt used 491.5 s wall time and reached level 2;
  it is planning evidence only. The resumed attempt used 272 s (0.0756 h). The handoff reports
  **zero canonical complete-level recordings**, zero imports and no repository changes/commits.
  Neither run proves the planned levels 0-7 corpus exists. The hours-scale budget remains a
  forecast, not measured completion.
- **Partial inventory:** the handoff lists completed sections `splash-1010`, `splash-1948`,
  `splash-0759`, `splash-2359`, `pause`, `nokeys`, `seed-1200`, `seed-1011`, `slot`; these are
  section-run reports, not acceptance of all S1-S10 requirements. `full`, `sound` and `keys`
  were interrupted. Some `after` recordings exist. Preserve and audit them before retrying;
  do not overwrite valid evidence or infer missing coverage from a section name.
- **Residual gates:** no complete u32 clock/date fit, no proof against all Snake II seed goldens,
  no fitted ANSI chain or settled advancers, no complete S5/S6 corpus, and incomplete keys/sound
  coverage. Snake II's fallback remains unchanged. Plan 29's shared resource registration must
  be verified before Tasks 4-5 use it. H1-H22 remain hypotheses except facts explicitly supported
  here; timings, object coverage and full sound/variety outcomes still need the Task 0 report.

The former Task 6 uniqueness requirement is reconciled, not satisfied: informative datasets
still require uniqueness; noninformative replay requires independent clock-seed proof. Resume
Task 0 at the LCD capture-driver repair and RAM-independence checks, then finish canonical
captures and report the remaining gates. All Task 0 checkboxes remain unchecked.

### Refresh audit (2026-10-27)

The assignment for that refresh made `$REF` read-only. The follow-up assignment below
authorizes Task 0 writes there and supersedes that restriction.
The 2026-10-14 handoff above is historical, not the current corpus inventory.

**Branch preservation and rebase.** Created `t3/p24-space-impact-backup-2026-10-27` at
`66efe97`, then committed all 38 WIP files as `3f5e839` before rebasing onto main `72cb29e`.
The rebase dropped `4c031b2` because its patch was already upstream. The plan-29 / `t3/e37f068c`
merge content is already in main; no merge-only replay was needed. The preserved WIP replayed
as `1b4177d`. No golden or generated-resource conflicts occurred.

**Adaptations to main.** Keep main's phone lifecycle, alarm/call interruption, keyguard, lights,
SIM and Composer paths. Move the game-event callback with `StockGames` to the shared holder;
power-off clears every suspended game. The lights bridge reads `suspended.snake` from that
holder, retaining plan 25's existing Snake rules. The sounder accepts game programs alongside
its existing `userTones` option, preserving the current sound contract. Settings tests retain
Dictionary restore and dynamic phone-book memory facts.

**Deviation (Task 3 registration).** Main's plan-29 guard requires every file in
`scripts/capture-sets/` to be registered, and each registered plan needs an index and acceptance
slice. The inherited unregistered `24-space-impact.ts` cannot enter that live registry before
the canonical-level gate. Preserve it as `scripts/space-impact-capture-set.ts`, with its
synthetic tests, until Task 3 moves it back and adds the one-line registration. No registry
exception, empty index or premature import is introduced. Generic capture/release support
remains usable by Snake II. Plan 29's actual resource contract is `PlanCaptureSet.resources`;
Tasks 4-5 must use it when their gates pass.

**Task 0 audit.** Ran the existing `gen_v639_plan24.py check` with Python bytecode writes
disabled. It exits 1 and reports:

- an empty archived recording at
  `driver-proof/attempt5-partial/after/fireworks-key-c-1500`;
- a stale or failed LCD control proof;
- absent `task0-coverage.json`, including variety, seed identifiability and ANSI coverage.

All eight `bot/full/level-<n>` recordings and their exits now have `timings.csv`, `keys.csv`,
audio and sound-event files. The checker reports 1,024 / 684 / 1,001 / 1,314 / 1,368 / 1,184 /
898 / 1,735 frames for levels 0-7. File presence does not validate their complete chained
provenance. `bot/full/bot.json` reports 10,282 ticks, 11,777 evaluations, 1,864 searches,
2,083.1 s for its latest segment and 16,799.9 s total wall time across seven resumes. Its
original split list labels the final section as level 6; `boundaries.json` supplies corrected
LCD-derived level-6/7 boundaries. These corrections still need the complete S5/S6 audit.

`driver-proof/complete.json` is sealed for generator SHA-256
`dbf911f60e82749e57055f2d1ac23991631e75703a4f3f43745ff7f6b1ca01a7`, whereas the current
generator is `cca9ffd8025c0494b890ef2b306dca7352c284ed204f3e245859ceb14daaa5b8`.
The proof's reported pass therefore does not satisfy the current-generator gate. The top-level
`plan24/text.json` OCR file is absent. `seeds.json` rejects its clock/date fit, and its 00:00
peek (`0xd452fed7`) differs from the inherited test table's LCD-equivalent candidate
(`0xd452fec1`). The test now names these as candidates, not verified New-game seed observations.
The migrated `gameSeed` retains plan 23's minutes-of-the-day fallback (UNVERIFIED). Do not infer
a fitted ANSI generator or complete variety/sound coverage from the directory names.

`analysis/ansi-fit.json` supplies only RAM hypotheses: six random-row steps in each of two
level-1 runs, one extra step after the first game's ending and none after the second. D6's
unconditional game-over advance is therefore not established; reproduce LCD spawn rows and
resolve those different ending histories before implementing the ANSI holder.

**Inherited implementation status.** Task 1 has a draft spec only. Task 2 has the shared u32
random generator, unchanged seed fallback, per-game suspension, Snake migration, generalized
score endings and Level pages, numeric top scores, and injectable game-sound programs with
unit coverage. Its ANSI holder/generator and capture-dependent conclusions remain absent.
Task 3 has releases, generic game capture and a tested draft Space impact table, but no imports,
registration, index or acceptance slice. Tasks 1-3 remain incomplete; 24b/24c are not unblocked.
No engine, level reconstruction, sprites or Space impact session is implemented.

**Deviation (fidelity).** Main's current AGENTS.md fidelity standard supersedes D7's fixed
16 ms game tolerance and Task 12's ±2 ms sound-edge text. Use shared `periodToleranceMs`,
`timingToleranceMs`, `timelineTolerance` and partial-redraw rules for all future replays.
Do not introduce per-test tolerances to preserve the older wording.

**Verification environment.** `vp install` succeeds. A host PATH hook puts Homebrew Node
26.12.0 ahead of mise's Node 22 for child processes, causing 22 unrelated website tests to fail
because `localStorage` is unavailable. Prepending the directory of mise's
`process.execPath` to the child PATH restores Node 22.22.3; all 180 website tests and the
production build pass without website changes. This installed CLI reports `Command 'env' not
found` for the instructed `vp env doctor`; `vp --version` reports 0.1.24.

**Refresh verification.** `vp check --fix` and `vp check` pass. The complete
`vp run -r --no-cache test` passes with mise Node 22, `VITEST_MAX_WORKERS=2` and
`VP_RUN_CONCURRENCY_LIMIT=1`: 255 test files, 10,663 passed, 121 expected failures and 50 TODOs.
The nokia-os portion is 163 files, 9,821 passed, 121 expected failures and 50 TODOs (2,406.73 s).
The other packages contribute phone-core 450, snake 62, phone-3d 49, phone-screen 101 and
website 180 passing tests. The production `website#build` passes. A prior overlapping run
hit the resource extraction test's existing 30 s timeout; the final single run passes without
changing test cases or timeout budgets. No files changed in website, phone-core, phone-screen,
packages/snake, committed goldens or generated resources.

**Golden status.** No fixture, golden index or generated resource changed during the refresh.
Space impact's `tree/08-games/8-2-1.leaf` and `sound/note/8-2-1` remain `pending:24`, as do the
three Bantumi/Pairs II leaf and sound-note pairs owned by the later Games plans. There is no
`goldens/index/24.json`. No known-gap table or timing tolerance was widened.

**Next gate.** Repair/revalidate the current LCD control proof, audit corrected S5 boundaries
and all S6 observations, complete S7-S10/OCR, and make the canonical checker pass before Task 1
completion or any Task 3 import. This refresh does not waive that gate.

### Task 0 capture repair (2026-10-27, follow-up)

The follow-up assignment permits writes to Task 0's REF paths. Work stays on
`t3/p24-space-impact`, starting at `639bb87`. Task 0 is still incomplete. Tasks 1+ have not
advanced. No goldens were imported and no resources were generated.
Evidence paths below are relative to `$REF/captures/6.39/plan24/`.

**Driver proof: passed.** `driver-proof/complete.json` now seals generator SHA-256
`3b557dd135811130fcda48e3d7a6610aab1a6fde28812dd169492e741f06517e`.
`seal.py` ran the stored controller and actual Bot tests, ambiguity negatives, source audit,
three live diagnostic modes and a hash-checked recording replay. Each live mode ran 25 ticks
and 41 candidate evaluations. Controls, choices, LCD hashes, phases, boundaries and streams
were identical with diagnostics disabled, truthful and conflicting. Proof wall time was 479.6 s.
The previous proof and generator are preserved in `archive/20261027-before-refresh/`.

**S5: existing recordings validated and reused.** `analysis/validate_full.py` observes the
stored LCD history with the current controller, checks the corrected boundaries and replays
the unmodified command stream once. `validation-20261027/result.json` reports 210,434 checked
LCD reads and 18 byte-identical cuts (levels 0-7, eight exits, the level-7 restart and the ending).
All 13,215 compared native PNG, timing, key and audio files match the preserved recordings.
There are no gaps or replay mismatches. Validation took 1,057.9 s wall time and performed no
new bot search. The original game retains its measured 10,282 ticks, 11,777 evaluations,
1,864 searches and 16,799.9 s total bot wall time. `bot/full/boundaries.json` remains the
corrected split source. The S5/S6 canonical-level gate stays closed until S6 passes.

**Empty archived fireworks recording: resolved.** The empty
`driver-proof/attempt5-partial/after/fireworks-key-c-1500` belongs to an interrupted attempt.
The canonical `after/fireworks-key-c-1500` has nine frames and the C edge at
2,100.3-2,140.3 ms. The interrupted directory stays intact, with an archive manifest pointing
to its replacement. `analysis/archive-inventory-result.json` verifies that canonical
inventory includes the replacement and excludes `archive/` and historical `driver-proof/attempt*`.
`record_run` now archives superseded recordings instead of deleting them.

**Midnight conflict: resolved as different capture histories.**
`analysis/midnight-resolution.json`, `midnight-20261027/result.json` and
`midnight-20261027/exact/result.json` retain the commands, LCD captures, audio and diagnostic
cross-checks. The short route reproduces `0xd452fec1`. A 6 s delay gives `0xd452fec7` while
standby still shows `00:00`. The exact S7 route reproduces `0xd452fed7` and all 11 original
splash PNGs byte for byte. At 10:10 the same added delay leaves `0xd4538d78` unchanged.
A 00:01 short-route control also gives `0xd452fec1`. Neither original observation is replaced.
These observations reject a clock/date-only fit. The minutes-of-the-day fallback stays
UNVERIFIED as D5 permits. No clock seed function is accepted from RAM peeks.

**Seed identifiability: incomplete.** `analysis/seed_stars.py` exhaustively checks 65,521
effective seeds against star pixels exposed across all nine canonical title frames.
`analysis/seed-stars.json` identifies single candidates at 10:10 (44530), 19:48 (13689),
23:59 (38909), 00:00 (8013 for the splash) and 10:10 on 14.10.2026 (10048).
07:59 retains two candidates, 36670 and 60943. The observed star pixels do not distinguish
them. The midnight splash and New game also occur at different times:
the splash's recovered draw does not match the later New-game u32's first draw.
The existing tick-52 no-draw trace remains noninformative. Gameplay random events and
independent clock proof still need reconciliation before S7 can pass.
`analysis/snake-seed-lcd-verification.json` completes the comparison against all nine existing
Snake C9 LCD seed goldens. The captured candidate u32s produce matching first draws and hence
the same later chains. The focused `game-random.test.ts` run records 17 passed tests in
`analysis/snake-lcd-tests.json`. This verifies the existing placement sequences and records
D5's retained fallback. It does not accept a clock/date seed function or complete Space impact
identifiability.

**Coverage audit: incomplete.** `analysis/coverage.py` now writes `task0-coverage.json`
without accepting a rejected seed fit, RAM-only ANSI evidence, HUD occlusions or a 50-percent
object-kill threshold as proof. `analysis/coverage-audit.json` lists the remaining observations.
The inherited `bonus` run was interrupted and no completed `specials` bot document exists.
The census is exploratory: component disappearance on a score increase does not prove every
spawn type was killed or, where applicable, fired. Five lives or an evidence-backed
unreachability argument is still required for the life reroll. Wall and beam use against both
enemies and a boss, and special/bonus sound coverage remain open.

**S6 death/Continue subcriterion: passed.** The inherited level-0 run already takes Continue
with 1 and reaches level 1. `analysis/deaths_key1.py` adds `bot/deaths-3-key1/` from S5's
LCD-derived level-3 anchor: three countdowns, two Continues with 1, then final refusal and the
ending/menu. It uses the sealed LCD controller, makes no search decisions and reads RAM only
through the existing diagnostic sink after observations. The run has 1,319 ticks, zero
look-ahead evaluations and four hash-checked recording cuts with keys and audio.
`analysis/deaths-key1-result.json` records 353.9 s total wall time, including the initial
S5 replay and recording replay. `analysis/s6-reviewed-deaths.json` checks both levels' actual
LCD countdown entries, Continue key events, recordings and final states. The original
level-3 recording with keys 3 and 4 stays intact.

**D6 ending advance: corrected from continuous LCD/audio captures.**
`analysis/ansi-game-over-resolution.json` and `analysis/ansi-notes-reviewed.json` cover:

- `ansi-nokeys-20261027/game1`: `TOP SCORE: 70`, one ANSI step.
- `ansi-nokeys-20261027/game2`: `Your score: 70`, no ANSI step.
- `ansi-top-score-20261027/first-after-reboot`: `Your score: 70`, no ANSI step,
  with the earned top score preserved and ANSI back at `0x7fffffff` on cold boot.
- `ansi-20261027/game1`: six gameplay steps, then one ending step, `TOP SCORE: 1335`.
- `ansi-20261027/game2`: no observed ANSI step, `Your score: 930`. This retry did not
  reproduce the original S8 second game's six-step random-row wave; retain both histories.

The records include every LCD frame, key edges, WAV audio and sound events through the menu.
The ending step occurs at the end of the continue countdown, before the top-score sequence.
The reboot control separates first-game history from the top-score condition. D6's unconditional
advance is rejected. The complete ANSI gate remains open: the LCG hypotheses and all random-row
coordinates must still be reproduced from LCD observations before an ANSI holder is implemented.
An earlier probe rejected ambiguous ship matches and is preserved under
`archive/20261027-ansi-ambiguous/`; the successful retry uses a fixed 60 s tail with no
classifier-dependent gameplay or stopping decisions.

**OCR: passed.** Top-level `text.json` now covers the exact inventory of 54,396 native
images (23,524 distinct pixel states), including the new death/Continue capture.
`analysis/ocr-result.json` records the inventory check and text SHA-256.
`analysis/ocr_cached.py` reuses the existing matcher by exact LCD band, saves recognized pixel
states atomically and versions the recognizer inputs. Baseline imports require both unchanged
recognizer inputs and a PNG unchanged since the original run started. The original recognizer
completed 32,487 images (21,339 distinct states); reconciliation compared 32,452 unchanged
entries and reused the remaining exact-pixel cache. `analysis/ocr-cache-proof.json` verifies
17 representative original/cached outputs and isolation from caller mutation. The initial
snapshot is preserved in `archive/20261027-ocr-initial/`. No font data or extracted content
is copied into the repository.

**Canonical checker: incomplete.** `analysis/task0-refresh-result.json` and
`analysis/check-20261027.log` record 11 accepted coverage criteria and 14 open criteria.
The remaining failures are bonus kinds, life reroll or reachability, wall/beam effects,
all eight levels' complete object kill/fire coverage, Space impact seed identifiability,
ANSI spawn-row reproduction and special/bonus sound coverage. The checker reports no empty
canonical recording, stale proof, missing key file or OCR failure. These are capture and
verification gaps, not new acceptance known-gap entries or relaxed fidelity tolerances.

**Repository verification:** `vp install`, `vp check --fix`, `vp check`, the complete
`vp run -r --no-cache test` and `vp run website#build` pass. Commands ran from the assigned
worktree through mise, with Node 22.22.3 first on the child PATH, `VITEST_MAX_WORKERS=2` and
`VP_RUN_CONCURRENCY_LIMIT=1`. The suite has 255 passing files, 10,663 passed tests,
121 expected failures and 50 TODOs. nokia-os contributes 163 files, 9,821 passed tests,
121 expected failures and 50 TODOs (1,713.50 s). The other packages contribute phone-core 450,
snake 62, phone-3d 49, phone-screen 101 and website 180 passing tests.

**Delivery scope:** only this plan report changes in the repository. REF repairs and new
captures remain gitignored. No fixture, golden index, generated resource, acceptance scenario,
runtime file, dependency or other plan changes. Space impact's existing leaf and sound-note
goldens remain `pending:24`; there is no `goldens/index/24.json`. Tasks 1-3 remain incomplete,
and Tasks 4-14 have not started. Next: finish S6's required variety and object coverage,
reconcile S7's informative and ambiguous datasets and D5 fallback, reproduce S8's LCD spawn
rows, finish special/bonus sound coverage and pass the canonical checker before Task 1.

### Second main refresh and Task 0 evidence review (2026-10-27)

**Rebase.** Created `t3/p24-space-impact-backup-2026-10-27b` at `5ae31b2`, then
rebased the four branch commits onto main `ce8167f` without conflicts. The replayed head
before this report is `4c5cb00`. No golden index or generated resource conflicted, so neither
an import nor regeneration was needed. Main's calls/phone-book integration, plan 25 call
captures, IMEI path and note-dismissal changes remain intact. Every command ran from the
assigned `p24-space-impact` worktree through mise. No other checkout was edited.

**Verification after rebase:** `vp install`, `vp check --fix`, the uncached workspace
suite and `vp run website#build` pass. Node 22.22.3 was explicitly first on the child PATH,
with `VITEST_MAX_WORKERS=2` and `VP_RUN_CONCURRENCY_LIMIT=1`. All 255 files pass:
10,693 passed tests, 120 expected failures and 25 TODOs. nokia-os contributes 163 files,
9,851 passed tests, 120 expected failures and 25 TODOs (1,006.04 s); the other packages
contribute phone-core 450, snake 62, phone-3d 49, phone-screen 101 and website 180.
An earlier run whose child PATH selected system Node was stopped and is not the verification
result. The installed Vite+ has no `env doctor` subcommand; the attempted diagnostic exited 2.
No runtime adaptation, dependency change, import or generated-file edit was needed.

### Task 0 LCD/audio review after the second rebase (2026-10-27)

Evidence paths below are relative to `$REF/captures/6.39/plan24/`.

**S6 bonus outcomes: passed from reused LCD/audio.**
`analysis/review_hud.py` finds exact, persistent HUD transitions for review;
`analysis/review_bonus.py` checks the selected native recordings against their stored LCD
histories and audio events. `analysis/s6-reviewed-bonus.json` records the pixel hashes,
before/contact/after frames, keys, WAVs and sound-event windows for all four outcomes:

| Outcome    | Canonical contact frame                             | Observed HUD change   |
| ---------- | --------------------------------------------------- | --------------------- |
| Wall       | `bot/full/level-2/274.png`, 19,691.2 ms             | missiles 06 → wall 03 |
| Missiles   | `bot/full/level-1/153.png`, 11,551.3 ms             | missiles 03 → 06      |
| Extra life | `bot/cap/level-1/150.png`, 11,622.3 ms              | three hearts → four   |
| Beam       | `bot/deaths-0/level-0.restart/880.png`, 65,134.0 ms | missiles 03 → beam 01 |

Each reviewed sequence shows the dotted pickup contacting the ship and disappearing, with
13 exact successive HUD observations (1,120.1–1,176.1 ms), no death/restart or intervening
phase change, and a 2636.9 Hz pickup cue at volume register 6. The cue lasts 4 ms in these
recordings; the shared fidelity rule makes such short events optional, without changing the
coverage evidence. These observations establish the four outcomes, not H9's RNG draw mapping,
five-life reroll, weapon damage or complete sound programs. The previous audit is preserved
in `archive/20261027b-before-coverage-review/`; `coverage.py` includes the reviewed evidence
file when accepting `S6-bonus-four-kinds`.

**S7 splash ambiguity: resolved; gameplay remains open.**
`analysis/seed_stars_background.py` exhaustively searches all 65,521 effective seeds, adding
negative evidence from the independently reviewed clear background band at rows 45–47.
That band is identical across all nine title frames. The old two-candidate 07:59 result
included 60943, which predicts a star at `(37,46)`; the actual pixel is blank in every frame.
`analysis/seed-stars-background-verified.json` therefore identifies one splash candidate per
clock: 07:59 36670; 10:10 44530; 19:48 13689; 23:59 38909; 00:00 8013; 10:10 on 14.10.2026 10048. The original positive-pixel-only result is retained. No blank title/ship pixel is used
as negative evidence. This closes the splash ambiguity only. Gameplay traces still need an
independent, informative uniqueness proof. The midnight splash seed is not a New-game seed:
the existing exact route's later diagnostic u32 gives effective candidate 8017. The different
capture histories remain resolved as documented above; no clock/date-only function is accepted,
and Snake II's permitted fallback remains unchanged.

**S8 spawn-row reproduction: partial, from reused LCD/audio.**
`analysis/verify_ansi_rows.py` tracks the level-1 sprite from the actual LCD, including clipped
entries, and checks all twelve row coordinates in the original two S8 games.
`analysis/ansi-spawn-rows-verified.json` records native frame hashes, neighbouring frames,
keys and audio. The fitted hypothesis uses `state = state * 1103515245 + 12345 mod 2^32`,
`rand15 = (state >> 16) & 32767`, and observed level-1 row
`min(27, 6 + (rand15 & 31))`. The six rows are 27,27,12,27,15,8 at chain positions 1–6 and
27,6,27,19,27,27 at positions 8–13. The fifth first-game sprite is destroyed while clipped
to four columns; its row is unambiguous. This is a fit for this wave's bounds, not other levels.
The independent continuous ending controls explain the intervening top-score draw.
The full criterion stays open: the original later Pairs II and Bantumi screenshots show
Continue (suspension), not demonstrated endings, and no subsequent LCD wave establishes the
chain position after those visits. The original S8 ending tails are unrecorded; the continuous
refresh controls do not reproduce its second wave. RAM peeks are still diagnostic hypotheses.

**Special effects: partial, from new paired unmodified captures.**
`analysis/capture_specials.py` and `analysis/capture_wall_enemy.py` replay the existing
hash-checked streams to LCD anchors, then fork identical states for fixed controls with and
without special-key taps. `special-evidence-20261027b/result.json` reports 64,532 checked
LCD reads and 175.00 s wall time; `special-enemy-targeted-20261027b/result.json` reports
34,732 reads and 85.75 s. There is no bot search, RAM read, poke or firmware call in these
successful probes (`analysis/special-capture-command-audit.json`). Ten recordings retain
365 native frames, exact raw key edges, WAVs and sound events. `analysis/special-keys-reticked.json`
uses the existing reticker to derive tick labels without changing millisecond edges.

The initial two attempts stopped before recording: the stored tick timestamp marks the
first changed LCD write, while its saved picture is the later settled frame. The successful
procedure checks the saved frame itself, observed 2–4 ms later, before forking. The failed
attempts remain in `archive/20261027b-special-anchor-before-wait/` and
`archive/20261027b-special-anchor-before-settle/`. This is capture-boundary handling, with no
firmware change or new fidelity tolerance.

`analysis/s6-special-effects-reviewed-partial.json` and
`analysis/special-observations-20261027b.json` preserve the reviewed sequences and controls:

| Probe               | Initial score | Control final | Special final | Outcome                                                          |
| ------------------- | ------------- | ------------- | ------------- | ---------------------------------------------------------------- |
| Beam / enemies      | 410           | 410           | 460           | sweep contacts and kills enemies                                 |
| Beam / boss         | 485           | 515           | 555           | sweep contacts and damages boss                                  |
| Wall / boss         | 1885          | 1900          | 2040          | wall contacts and destroys boss                                  |
| Wall / early pickup | 1455          | 1455          | 1455          | no target hit; retained unsuccessful probe                       |
| Wall / enemy wave   | 1465          | 1515          | 1515          | prior bullets account for the same hits; no isolated wall effect |

The wall/beam criterion remains open for an ordinary-enemy wall hit isolated from pre-existing
player bullets. A consumed counter or an overlapping line is not accepted as damage proof.
The HUD-only review intentionally does not call the ship classifier: one later terrain frame
matches two ship shapes, which is irrelevant to the exact HUD observations and fixed controls.

**S9 sounds and vibration: passed.** `analysis/review_sounds.py` writes
`analysis/s9-reviewed-specials-sound.json`: the exact frequency, volume-register and edge
sequences for shot, death, missile, wall, beam and all four bonus outcomes, linked to LCD
frames and raw audio. The new wall and beam programs are isolated by the paired controls;
existing validated recordings supply the other cues. All three recorded no-key deaths vibrate
with Warning tones On; Sounds Off removes the buzzer while retaining vibration; Shakes Off
removes vibration while retaining the death program. The validated boss exit supplies boss
vibration across adjacent cuts, and the ending supplies the fireworks tune. This completes
recording coverage; runtime sound programs remain Task 12. Short events continue to follow the
shared 34 ms rule, with no per-test tolerance or new known gap.

**OCR: extended and checked.** `analysis/ocr-extension-20261027b.json` verifies exact native
image inventory: 54,761 images, including all 365 new probe frames, and 23,853 distinct pixel
states. All 54,396 prior OCR entries are unchanged. The existing memoized recognizer's 17
original/cached equivalence checks pass; recognizing the additional states takes 68.80 s.
The prior text and OCR reports are preserved in `archive/20261027b-before-ocr-extension/`.

**Gate and scope.** `analysis/check-20261027b-final.log` reports 13 accepted criteria and
12 open, with no stale control proof, missing recording, key file or OCR failure. Of the
original 14 open criteria, bonus outcomes and sound/vibration now pass. The remaining outcomes
are explicit; no criterion has been dropped, relabelled as unobtainable or proposed for removal:

| Original criterion              | Outcome and evidence                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bonus four kinds                | passed: `analysis/s6-reviewed-bonus.json`                                                                                                             |
| Five-life reroll / reachability | open: `analysis/s6-reroll.json` reaches four, which proves neither reroll nor unreachability                                                          |
| Wall/beam on enemies and boss   | partial: `analysis/s6-special-effects-reviewed-partial.json`; isolated wall/ordinary-enemy hit remains                                                |
| Gameplay seed identifiability   | open: `analysis/seed-stars-background-verified.json` completes all splash seeds only; `analysis/midnight-resolution.json` rejects clock/date-only fit |
| ANSI rows and advancers         | partial: `analysis/ansi-spawn-rows-verified.json`; all twelve rows fit, other-game history proof remains                                              |
| Special/bonus sounds            | passed: `analysis/s9-reviewed-specials-sound.json`                                                                                                    |
| Level 0 object kills/fire       | open: `analysis/census-level-0.json`; 12 component shapes, 12 possible kills, no complete semantic fire inventory                                     |
| Level 1 object kills/fire       | open: `analysis/census-level-1.json`; 27 shapes, 20 possible kills                                                                                    |
| Level 2 object kills/fire       | open: `analysis/census-level-2.json`; 21 shapes, 18 possible kills                                                                                    |
| Level 3 object kills/fire       | open: `analysis/census-level-3.json`; 12 shapes, 7 possible kills                                                                                     |
| Level 4 object kills/fire       | open: `analysis/census-level-4.json`; 25 shapes, 19 possible kills                                                                                    |
| Level 5 object kills/fire       | open: `analysis/census-level-5.json`; 26 shapes, 21 possible kills                                                                                    |
| Level 6 object kills/fire       | open: `analysis/census-level-6.json`; 12 shapes, 10 possible kills                                                                                    |
| Level 7 object kills/fire       | open: `analysis/census-level-7.json`; 40 shapes, 12 possible kills                                                                                    |

Component counts are exploratory; animation fragments, terrain and HUD overdraw are not
semantic object types, and score-associated disappearance is not a complete kill/fire proof.
No per-level criterion is accepted from those counts. The prior midnight-history resolution
stands; a gameplay seed/clock fit remains unaccepted and the existing Snake fallback stays.
No criterion change is proposed. Tasks 1+ have not advanced. No plan 24 golden has been imported
or asserted, no resources regenerated and no known gaps or tolerances changed. The existing
Space impact leaf and sound-note goldens stay `pending:24`; no `goldens/index/24.json` exists.
Only this report changes in the repository; the scripts, recordings and evidence remain in REF.
The rebase verification above applies to the unchanged runtime tree. Final `vp check` passes.

### Task 0 deterministic census (partial delivery, 2026-10-27)

This follow-up starts at `a13a4e9` in `t3/p24-space-impact`. All paths below are relative
to `$REF/captures/6.39/plan24/`, unless they start with `captures/scripts/`.
The preceding report remains historical. None of the twelve open criteria is accepted by
this delivery. Tasks 1+ remain gated. No runtime code, goldens or generated resources change.

**Tool and evidence.** `captures/scripts/census_v639_plan24.py` reads every native PNG in
the eight validated `bot/full/level-<n>` recordings and their `.exit` cuts. A continuous
ledger index crosses each cut while `recording` and `capture_frame` preserve native PNG
identity. Track time uses the recorded cut durations and frame timestamps. It reads no RAM,
extracted assets or RE object tables. Its sprite references cite LCD frame rectangles and image hashes. Rectangular
matching retains disconnected sprite pixels and checks blank pixels. Reviewed animation
variants share a visual family. The tracker records frame/time/position histories, clipped
entry candidates, edge-exit candidates, explosion/score kill candidates and projectile
origin/trail candidates. Equal-cost assignments and identity loss after overlaps remain
unresolved. A track birth is not automatically a spawn.

Each level has `analysis/census-level-<n>.json`, `.frames.jsonl`, `.tracks.json` and
`.sources.json`. The summary includes per-family track counts, entry candidates, reviewed kill
and fire frames, candidate events, and flags for missing reviewed kills and fire. `spawn_count`
is deliberately null while overlaps prevent a complete count. The frame ledger retains all
unclassified foreground, including boundary-connected ink that could contain enemies or boss
parts. It examines short partial redraws too; it adds no fidelity tolerance. The source manifest
hashes every native PNG, timings, keys, audio, sound events, command stream, boundaries, full-run
validation and local review input. Superseded outputs are archived by content hash.

**Hand validation.** `analysis/census-hand-review.json` records three local checks against
native level-0 LCD sequences:

- Frames 55-63: the first `round-wide-left` enemy is hit, the HUD rises from 0 to 10 in frame
  58, and the explosion appears at frame 59. The following two enemies remain. The HUD's partial
  redraw precedes the explosion; requiring the score to rise after the last sprite frame misses
  this kill. The surrounding settled pictures establish the event.
- Frames 583-591: a 2x1 shot appears left of `round-small-left` at `(67,29)` in frame 586,
  then moves through x 64, 61, 58 and 55 while its source moves left by 1 px per tick. Player
  shots in the same sequence move right. The tracker attributes this shot to one source.
- Frames 254-262: a `round-wide-left` track moves through x 8, 6, 4, 2 and 0, then disappears
  at frame 261 without an explosion or score change (100 throughout). Its identity before an
  earlier overlap is still unresolved. This is a reviewed local exit, not a proved full spawn.

The enlarged inspection sheets are `analysis/census-hand-{kill,fire,exit}-20261027c.png`.
`captures/scripts/test_census_v639_plan24.py` checks exact sprite backgrounds, disconnected
pixels, clipping, separate simultaneous objects, ambiguous identity, occlusions, player versus
enemy shots, multiple possible firing sources, partial score redraws, stale/ambiguous review
inputs and output archival. These checks validate the tool's local behavior; they do not certify
the eight levels' inventories.

**Per-level result.** All eight remain **incomplete**. These counts describe tracked visual
families and fragments, not firmware object types or proved spawn totals. The boss contributes
at most one visual family when its reference matches; level 7's multipart boss remains in the
unclassified foreground and is absent from the family count.

| Level | Native frames (gameplay + exit) | Object/boss visual families | Object tracks | Kill candidates | Fire candidates | Census evidence                |
| ----- | ------------------------------- | --------------------------- | ------------- | --------------- | --------------- | ------------------------------ |
| 0     | 1,060 (1,024 + 36)              | 5                           | 49            | 36              | 3               | `analysis/census-level-0.json` |
| 1     | 721 (684 + 37)                  | 5                           | 54            | 46              | 9               | `analysis/census-level-1.json` |
| 2     | 1,034 (1,001 + 33)              | 8                           | 49            | 31              | 11              | `analysis/census-level-2.json` |
| 3     | 1,353 (1,314 + 39)              | 5                           | 47            | 72              | 1               | `analysis/census-level-3.json` |
| 4     | 1,395 (1,368 + 27)              | 7                           | 128           | 24              | 23              | `analysis/census-level-4.json` |
| 5     | 1,204 (1,184 + 20)              | 7                           | 129           | 40              | 7               | `analysis/census-level-5.json` |
| 6     | 935 (898 + 37)                  | 5                           | 122           | 78              | 3               | `analysis/census-level-6.json` |
| 7     | 1,769 (1,735 + 34)              | 3                           | 67            | 90              | 3               | `analysis/census-level-7.json` |

There is one reviewed kill, one reviewed shot and one reviewed exit, all in level 0. The other
entries remain candidates. No type is declared incapable of firing. More templates and identity
work are needed, especially where sprites touch terrain, bullets or one another, and for the
final boss. Consequently this tool does **not** yet fulfill the requested exhaustive semantic
spawn/kill/fire census. It replaces the old shape summary with a rerunnable, inspectable partial
tracker and makes its remaining work explicit.

**Checker.** `analysis/coverage.py --check` verifies the census source/artifact hashes, updates
`task0-coverage.json` and runs the existing canonical checker. Artifact integrity and criterion
coverage are separate outcomes. A stale census, unexplained foreground, unreviewed event or a
sample-only review cannot pass a per-level criterion. The capture generator and its LCD driver
seal are unchanged; no new capture control proof is needed for this offline tool. Existing
recordings and the old census/checker are preserved under
`archive/20261027c-before-tracked-census/`.

**Offline verification:** 16 focused checks pass. Two complete scans of all 9,471 gameplay
and exit frames produce 33 byte-identical artifacts. All eight provenance checks pass.
`analysis/census-final-validation-20261027c.json` records the final tool hash, test count and
per-level results; `analysis/census-determinism-20261027c.json` lists the artifact hashes.
The canonical checker exits 1 as required, with 13 accepted criteria and 12 open. Its final
log is `analysis/check-final-20261027c.log`. No open criterion is suppressed by a proposal.

**Recapture decision.** No recapture is made. The current failures are incomplete tracking and
attribution in already validated recordings. They do not establish a genuinely missing type.
A targeted capture cannot be specified reliably until the existing LCD inventory is resolved.
The next worker should extend the sprite families and multipart boss tracker, review the
remaining candidate events, then name a missing type and LCD anchor before spending emulator
replay time. No hypothesis is turned into an unreachable-type assertion.

**Repository verification:** `vp check --fix` and `vp check` pass. The uncached workspace
suite passes: 255 files, 10,693 passed tests, 120 expected failures and 25 todos. The website
production build passes. Tests and build use mise's Node 22.22.3 first on child PATH. The first
Python-launched attempt selected global Node 26 and failed website `localStorage` checks; its
log is retained, and the complete Node 22 rerun passes without source changes.
`analysis/quality-20261027c.json` links the successful suite and build logs. No plan 24 golden
is imported or asserted; the existing leaf and sound-note fixtures remain `pending:24`.

### Accepted Task 0 criterion changes (Lachlan, 2026-10-27)

**Accepted decision, replacing the former proposals-only status.** Lachlan accepts all four
defaults below: the five-life cap and reroll from the same game RNG; H10's four HP per registered
ordinary-enemy wall hit; the existing minutes-of-the-day seed fallback (the clock/date-only fit
is rejected); and zero ANSI advances for other games and Settings (24b/24c revisit). Code comments
and specs must carry the literal `UNVERIFIED` label beside each behavior. Acceptance of a default
is not LCD verification of it.

The eight `S6-level-<n>-object-kills-and-fire` criteria are **replaced** by the eight validated
full-level recordings becoming plan 24 goldens. Their pixel-exact replay under the fidelity
standard verifies every spawn, kill and shot they contain. Behavior the recordings never
exercise is `UNVERIFIED` in the spec and is not a gate. The census remains an exploratory aid,
not a gate. Task 0 is closed; the canonical coverage checker records this accepted scope and
still requires recording integrity, the level chain, ending and control proof. Import and replay
remain Tasks 3-13; this decision does not assert a golden in advance.

The original evidence and fidelity risks below are retained. No pixel, rhythm, sound or timing
tolerance changes.

**S6-life-reroll-or-unreachable.**

- **Original:** observe the extra-life reroll at five lives, or establish from the LCD that
  five lives cannot be reached.
- **Established:** all four bonus outcomes are reviewed (`analysis/s6-reviewed-bonus.json`).
  `analysis/s6-reroll.json` reaches four hearts. Neither proves five-life reachability,
  unreachability or which RNG draws the reroll consumes.
- **Accepted replacement/default:** record the five-life branch as **UNVERIFIED**. Keep H9's
  provisional five-life cap and redraw a life result from the same game RNG until a non-life
  bonus is selected. Do not award a sixth life or substitute a fixed weapon. This preserves the
  existing, partially corroborated bonus model and its stated reroll hypothesis while making the
  unsupported branch visible. It is not a demonstrated LCD rule.
- **Fidelity risk:** an incorrect cap or reroll changes survival, the awarded weapon and every
  later RNG-dependent event. Those outcomes are human-perceivable and require recapture before
  this branch can be called faithful.

**S6-wall-beam-enemies-boss: isolated wall damage to an ordinary enemy.**

- **Original:** observe wall and beam effects against ordinary enemies and a boss. For wall
  damage, separate its effect from pre-existing player bullets.
- **Established:** paired controls show beam/enemy kills, beam/boss damage and a wall/boss kill
  (`analysis/s6-special-effects-reviewed-partial.json`). The ordinary-enemy wall probe reaches
  the same score with and without the wall, so it establishes no isolated damage.
- **Accepted replacement/default:** retain the reviewed effects and record ordinary-enemy wall
  damage as **UNVERIFIED**. Use H10's provisional four hit points per registered wall hit,
  through the same enemy collision/damage path. Do not infer a tick-by-tick damage cadence or
  instant universal kill from the boss result. H10 is the existing specific hypothesis, and a
  damaging wall is consistent with the observed boss control; its ordinary-enemy damage is
  still a default, not a fitted number.
- **Fidelity risk:** wrong damage or repeated-hit handling changes kills, scores and the value
  of a limited weapon. These are visible gameplay differences. No acceptance claim follows
  from consuming the HUD counter or drawing an overlapping wall.

**S7-identifiability: gameplay seed and midnight clock/date fit.**

- **Original:** each designated informative gameplay trace uniquely identifies its effective
  seed; accept a clock/date seed function only if it reproduces every relevant Snake II and
  Space impact LCD sequence. Separate noninformative traces with independent clock proof.
- **Established:** the six splash seeds are unique
  (`analysis/seed-stars-background-verified.json`), and candidate u32s reproduce the nine Snake
  C9 LCD sequences (`analysis/snake-seed-lcd-verification.json`). Gameplay uniqueness is
  incomplete. `analysis/midnight-resolution.json` reproduces both midnight histories and shows
  a six-second route delay changing the midnight diagnostic seed while the LCD still says
  `00:00`. The splash seed is not the later New-game seed at midnight. These observations
  reject the proposed clock/date-only fit.
- **Accepted replacement/default:** retain the existing minutes-of-the-day seed fallback as
  **UNVERIFIED**, as D5 already permits. Keep the proved generator and splash observations
  separate from the unproved clock function. A replay may inject a seed only where an
  informative LCD trace recovers it uniquely; no-draw or ambiguous gameplay traces remain
  labelled noninformative and cannot borrow a splash or peek seed as gameplay proof. Do not add
  an hour-zero formula from RAM readings. Retaining the existing fallback avoids replacing it
  with a function the controls have disproved.
- **Fidelity risk:** random fire, bonuses and subsequent RNG consumers can differ, especially
  around midnight or after different menu histories. Correct generator arithmetic does not
  prove correct gameplay outcomes from a clock setting.

**S8-ansi-formula-advancers: other games' advancers.**

- **Original:** fit the ANSI chain and boot value, reproduce random-row spawns on the LCD, then
  establish chain advances after completed Snake II, Pairs II and Bantumi games and Games
  Settings visits with a subsequent verifying LCD wave.
- **Established:** all twelve original level-1 spawn rows fit the proposed LCG and bounds
  (`analysis/ansi-spawn-rows-verified.json`). Continuous ending controls separate Space impact's
  one-draw new-top-score endings from ordinary/tied endings with no draw
  (`analysis/ansi-game-over-resolution.json`). Other-game peeks remain hypotheses; the Pairs II
  and Bantumi screenshots show suspension, and no subsequent wave proves their chain position.
- **Accepted replacement/default:** record other games' ANSI consumers as **UNVERIFIED**. Advance
  the shared chain only for proved Space impact random-row spawns and its new-top-score ending;
  provisionally leave it unchanged for the unproved other-game histories and Settings visits.
  Preserve the state across games and reset only at power-on. This follows the existing
  zero-advance diagnostic hypothesis without inventing consumers or generalizing the Space
  impact ending rule to unrelated games. Plans 24b/24c must revisit it.
- **Fidelity risk:** an omitted advance changes the next random-row wave after another game is
  played. Positions, collisions and survival can change, even if each game's first run matches.
  The original unrecorded ending tails remain a provenance limit; independent controls do not
  become a recording of those tails.

**S6-level-0 through S6-level-7: remaining census work.**

- **Original (each level):** every spawned object type is observed killed and, where it fires,
  firing; a non-firing exception needs LCD evidence that firing is impossible.
- **Established:** all 9,471 native gameplay and exit frames are inventoried by the partial
  tracker. The per-level table and hash-sealed ledgers identify visual families, tracks, candidate events
  and unresolved foreground. Only the three local level-0 events above are reviewed. No
  complete spawn count, full type inventory or firing-impossibility exception is established.
- **Accepted replacement:** replace all eight exhaustive census criteria with the eight
  validated full-level recordings as plan 24 goldens. Pixel-exact replay verifies their observed
  spawns, kills and shots. Unexercised behavior remains `UNVERIFIED` in the spec and does not gate
  implementation. The partial census is exploratory; its unresolved tracks are not failures of
  this replacement criterion. No unsupported firing rate or RNG consumption is established by
  accepting this scope.
- **Fidelity risk:** missed types or shots change whole waves, score, difficulty, RNG history
  and boss outcomes. This is a material fidelity gap across all eight levels. It cannot be
  excused by the shared timing rule or by a percentage-of-types threshold.

### Task 0 closure verification (2026-10-27)

`analysis/coverage.py --check` passes: **25 accepted criteria, zero open criteria**, under the
accepted scope above. The canonical checker now requires `S6-level-<n>-recording` for all eight
levels in place of the exhaustive census. Each names its native timing/key/audio evidence,
exit, complete replay validation and `analysis/accepted-criteria-20261027.json`. The four
accepted defaults are recorded as UNVERIFIED rather than newly verified observations. The
exploratory census no longer gates closure. Earlier incomplete outcomes in this plan are
historical and are superseded by this accepted decision.

Only the canonical checker's criterion list changed in the capture generator; no capture,
controller or gameplay code changed. Its source hash is
`4b871ce58fc310b53bbf8f5a39145160f29c28b1eaeef86159df15c7b83ec401`.
`driver-proof/seal.py` passed all stored, static, live three-mode fork/search and recorded replay
checks and resealed `driver-proof/complete.json` in 274.6 s. The prior proof and checker are
preserved in `archive/20261027d-before-accepted-criteria/`. Four negative-control tests in
`analysis/test_accepted_criteria.py` pass, including all eight missing-level cases, missing
chain/ending and stale control proof. Full checker output is
`analysis/check-accepted-20261027d.log`. REF artifacts remain gitignored and uncommitted.

Task 0 is **done**. Imports remain pending until Task 3; no golden has been asserted by closing
this capture gate. Verification: `mise exec -- vp check --fix` passes.

### Task 1 - Contracts and documentation

**Files:** `docs/specs/stock/space-impact.md` (new), `docs/specs/stock/snake.md` (the seed and
Continue corrections, if the refactor created it; else the Snake II section of
`docs/specs/nokia-3310.md`), `docs/plans/README.md`, this plan.

- [x] Apply Task 0's outcome to D4-D13 and H1-H22 (`Deviation:` lines where it changes them).
- [x] `docs/specs/stock/space-impact.md`: entry, keys, the rules as verified, levels, pause and
      Continue, scoring, game over, sound, artefacts; everything not yet asserted marked
      "(plan 24, in progress)". Correct spec §7's "Space Impact: `2`/`8` move up/down, `5` fires".
- [x] The shared facts: the seed (D5), the suspend slot (D10), Continue's key, the timer-unit rule.
- [x] Plans README: row 24 `in progress`.
- [x] No runtime code. `mise exec -- vp check --fix`.
- [x] Commit: `docs: define Space impact gameplay and the shared game facts (plan 24)`.

**Completion (2026-10-27).** Updated the stock Space impact spec and §7/index, corrected the
shared Snake II seed and independent Continue facts, and retained row 24 as `in progress`.
No runtime code changed. The observed control/key/timing facts and all four accepted defaults
are separated from unasserted implementation claims. `vp check --fix` and the nokia-os suite
pass (the suite's current expected failures and TODOs are retained).

**Deviation (D3-D13, H1-H22).** The accepted Task 0 decision supersedes exhaustive capture and
clock-fit requirements. The status of the hypotheses is:

| Hypotheses | Task 0 outcome; implementation replay remains pending                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1         | 12-unit tick and captured interval/transition evidence; exact shield/repeat/continue timings are derived in Task 4. Shared fidelity helpers supersede fixed tolerances.                |
| H2, H3     | Canonical key matrix and LCD ship observations exist; global clamps, held-fire cap and collision limits still need replay/fitting.                                                     |
| H4-H8      | Full levels, terrain, enemies, collisions and score changes are captured. Exact tables and rules are reconstructed and checked in Tasks 4-10; unexercised branches stay UNVERIFIED.    |
| H9         | All four bonus outcomes reviewed. Five-life cap and same-game-RNG life reroll are the accepted UNVERIFIED default; draw mapping/stacking still need replay.                            |
| H10        | Beam/enemy and beam/boss effects plus wall/boss kill reviewed with controls. Ordinary-enemy wall damage is the accepted UNVERIFIED four HP per registered hit; no cadence is inferred. |
| H11, H12   | Death, Continue/restart/refusal, all level exits and ending recorded; exact step behavior awaits replay.                                                                               |
| H13        | Final level and restart are validated LCD recordings; multipart boss rules remain reconstruction work.                                                                                 |
| H14        | Shared u32 generator supported by Snake LCD sequences; retained minutes seed is UNVERIFIED. Gameplay seed recovery/consumer ordering remains Task 6.                                   |
| H15        | Twelve level-1 random-row coordinates fit ANSI. Other games/Settings zero advance is UNVERIFIED; top-score-only Space impact ending advance replaces unconditional game-over advance.  |
| H16        | Pending-return/lost-event mechanism remains UNVERIFIED until a trace test demonstrates it. No gap/tolerance may conceal a wrong step count.                                            |
| H17        | Captured polarities and bottom HUD in levels 4/5; exact pixels remain replay work.                                                                                                     |
| H18        | Six unique LCD splash seeds and key-to-menu captures; New-game seed is separate at midnight.                                                                                           |
| H19, H20   | Sound/vibration coverage reviewed, including special controls and gating; programs and runtime comparison remain Task 12.                                                              |
| H21        | Per-game Snake II/Space impact suspension in both orders confirmed. Pairs II cross-mode scope stays UNVERIFIED for 24c.                                                                |
| H22        | Ordinary, tied and top-score endings reviewed; only Space impact's new-top-score ending advances ANSI. Runtime endings remain Task 11.                                                 |

### Task 2 - Games II seams, with Snake II migrated (TDD)

**Files:** `src/games/random.ts` (new, from `src/games/snake/rng.ts`), `src/games/seed.ts` (new,
from `src/games/snake/seed.ts`), `src/games/snake/{rng,engine}.ts`, the shared games holder and
`GAME_LEVELS` (in the refactor's shared games feature module; before the refactor:
`src/widgets/snake.ts` and `src/firmware/{menu,leaves,bindings,phone}.ts`), Snake II's feature
module, `src/widgets/game-over.ts`, `src/widgets/level-bar.ts`, `src/firmware/cues.ts`,
`src/sound/sounder.ts`, `src/firmware/bindings.ts` (`VIRGIN_NUMBERS`, `RESTORE_KEEPS`), tests
`tests/game-random.test.ts` (new), `tests/game-seams.test.ts` (new), `tests/snake-rng.test.ts`,
`tests/settings.test.ts`, `tests/sounder.test.ts`.

- [x] TDD `random.ts`: Snake II's generator unchanged for seeds below 0xfff1; a u32 seed's first
      step in 32-bit arithmetic (the investigation's two u32s give 44530's and 13689's first
      draws); `snake-rng.test.ts`'s recovered seeds still reproduce every placement.
- [x] TDD `seed.ts`: the Task 0 fit (D5) against every informative S7 dataset and every Snake II
      seed golden (all placements and C9 clocks/dates, including overflow), or the fallback with
      the evidence in the test names. Snake II's New game uses it.
- [x] TDD the holder (D10, the rule Task 0 S2 chose): suspend and Continue for a fake game id; per-game
      isolation in both Snake II/Space impact suspend orderings; captured clearing rules; power-off
      clears all suspended states; `GAME_LEVELS` gives each listed level its Continue
      entry (`shown`, `opening()`, positional numbers), Top score and Level returns. Snake II's
      goldens and `snake-game.test.ts` pass unchanged; add scenarios for independent suspension.
- [x] TDD `gameOver(ending)` (D11): `score` and `top-score` reproduce Snake II's game-over goldens;
      `won`/`draw`/`lost` throw "resource missing (plan 24b)" until 24b adds them.
- [x] TDD `levelPage` (D14): Snake II's Level goldens pass with `max: 9`; a `max: 5` page clamps at
      1 and 5 (synthetic bars).
- [x] TDD the `game-sound` cue (D13): gated like `eat`; a second sound cancels the first; an
      unknown id throws.
- [x] `VIRGIN_NUMBERS`: Space impact's and Pairs II's top scores (45, 0, 0) from their notes;
      `RESTORE_KEEPS` adds them.
- [x] Remove `src/games/snake/seed.ts` and the generator from `rng.ts` (no re-exports; plan 23's
      callers import the new modules).
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp run website#build`,
      `vp check --fix`.
- [x] Commit: `feat(nokia-os): shared game random, suspend slot, endings and level pages`.

**Completion (2026-10-27).** Finished the inherited generator/seed, per-game suspension,
Snake II migration, ending, Level-page, numeric-score and data-driven sound seams. Added the
missing ANSI generator and phone-owned power-on reset: its arithmetic reproduces all twelve
LCD spawn rows, preserves its state across games and suspension, and resets only at power-on.
The accepted zero-advance default for other games/Settings and minutes-of-the-day seed remain
UNVERIFIED beside the code. No Space impact session or speculative consumer was added.

TDD: the new ANSI/lifetime checks failed before implementation (six failures including existing
Snake suspension assertions), then all 166 focused random/seam/Snake/settings/sounder checks
passed. Candidate u32 checks now replay every decoded Snake seed placement, not just the first
draw. Test services use the real service constructor instead of a partial type cast.
`vp check --fix` passes. The uncached workspace suite passes: **255 files, 10,696 passed,
120 expected failures, 25 TODOs** (nokia-os: 163 files, 9,854 passed). `website#build` passes.
Logs: `/private/tmp/plan24-task2-{tests,build}.log`. Mise's Node 22.22.3 directory is prepended
to child PATH through a temporary launcher, avoiding the documented host Node 26 hook.

**Deviation:** the refactored settings/score tables already live in `features/games.ts` and
`features/snake.ts`; they are retained there rather than duplicated in `bindings.ts`.
`GAME_LEVELS` registers each game when its feature exists (Space impact: Task 11); fake-game
seam tests cover independent entries now. The holder's `ansi` reference is internally mutable
so its owner can replace it at power-on; callers consume its read-only state. Task 6 still
verifies the Space impact consumers against decoded goldens.

### Task 3 - Golden pipeline: releases, generic game capture and the capture set (TDD)

**Files:** `scripts/golden-format.ts`, `scripts/game-capture.ts` (new),
`scripts/game-capture-set.ts`, `scripts/capture-sets/24-space-impact.ts` (new),
`scripts/capture-sets/index.ts` (one line), `tests/golden-format.test.ts`,
`tests/game-capture.test.ts` (new), `tests/goldens-integrity.test.ts`, `goldens/game/space-impact/**`,
`goldens/sound/game/space-impact/**`, `goldens/index/24.json`.

- [x] TDD `input` releases (order, a release only after its press, round trip); existing goldens
      parse unchanged.
- [x] Split the generic machinery into `game-capture.ts` (frame predicate, period, selection rule);
      Snake II's goldens re-import byte-identical.
- [x] TDD Space impact's frame predicate (HUD rows and the play field), tick numbering at the
      12-unit period, the level cut at the exit frame, and probe still selection (HUD changes,
      input, every 16th, last 12) on synthetic recordings. Full levels retain every native frame
      rather than depending on the incomplete object census for event selection.
- [x] The capture set (table above), its `notImported` reasons (S2's slot probes after Task 2
      encodes them, `scratch-plan24/`, peek logs), and the sound goldens through plan 16's
      sound capture machinery. Per the 2026-10-27 assignment, all imports and the existing
      `tree/08-games/8-2-1.leaf` stay pending until their scenarios pass (Deviation below).
      Add the plan-24 acceptance slice now; its pending fixtures are TODOs.
- [x] Integrity: `game/space-impact/*` timelines have a numeric `trigger-frame`; tick stills are
      ascending `t<tick>`; every `input` tick exists in its golden.
- [x] Before importing anything, require Task 0's canonical-level gate and control proof to pass.
      Run the importer twice; no diff. Record counts and bytes (D3 budget guide).
- [x] Commit: `feat(nokia-os): import Space impact gameplay captures as goldens`.

**Implementation and import (2026-10-27).** Preserved and finished the inherited Task 3 work.
The release format and generic capture split already existed in the branch; focused tests cover
round trips, releases, Space impact's HUD/polarities, tick numbering, selection and level cuts.
Two additional regressions failed before their fixes: a zero-duration shot at a tick boundary
could emit its release before its resolved press, and input on a silent tick had no still.
Such a tap now has no held release; an explicitly selected silent input tick uses the actual
recorded LCD displayed at that time. Snake II's existing selection policy is preserved.

`analysis/coverage.py --check` passes all 25 accepted criteria before the final import.
The registered capture set rejects absent, failed or stale proof/audit evidence, missing level
criteria and unaccepted scope changes. It imports **166 fixtures: 88 timelines, 56 tick-still
sets and 22 sounds**, with **22,065 images, 23,064 LCD rows/stills and 11,197 sound events**.
Fixture bytes total **91,463,703**; `goldens/index/24.json` adds **34,807** bytes.
The eight full levels, eight exits, level-7 restart and final ending retain their native frames.
The final repeat import changes no SHA-256 among all 3,319 fixture/index files. All 3,152
pre-existing fixture/index files, including every Snake II golden, remain byte-identical.
No REF file or generated resource is committed.

**Deviation (pending assertions).** The 2026-10-27 implementation assignment requires every
fixture to stay `pending:24` until its scenario passes. This supersedes Task 3's older
`ASSERTED_EARLY` instruction and the capture table's default asserted status. The existing
`tree/08-games/8-2-1.leaf` and `sound/note/8-2-1` stay pending in their original indices;
no `ASSERTED_EARLY` registration or acceptance gap disguises the missing session. The plan-24
acceptance slice contains 166 TODOs, no scenarios and no known gaps. Assertion waits for the
ordered gameplay, painter, session and sound tasks. The six Bantumi/Pairs II fixtures owned by
later Games plans also remain pending, unchanged.

**Parent decision (Lachlan, 2026-10-28): size accepted.** Keep the roughly 87 MiB
(91,463,703 bytes) of lossless recordings as imported; they compress approximately 15× in git.
The parent accepts this size. Do not thin the recordings or change their format.

**Deviation (size and selection).** Full-level lossless timelines replace the earlier proposed
sparse object-event selection. The accepted recording scope verifies every captured spawn,
kill and shot, while the exploratory census cannot yet identify every event to thin safely.
The 6 MB figure is a budget guide, not a fidelity allowance. Periodic thinning of the remaining
stills cannot bring the complete recordings under it. The actual 91.5 MB is recorded here;
no native full-level evidence is removed to meet the guide. Other probes keep HUD/input stills
or their full transition recordings. No fidelity tolerance or known-gap table changes.

**Focused verification:** 8 passing files, 3,391 passed tests, plus the plan-24 slice's
166 expected TODOs. Includes the capture/resource registry and acceptance-contract guards.
`vp check --fix`, final `vp check` and `website#build` pass. The complete uncached workspace
suite passes: **256 passing files, one pending-only slice, 11,018 passed tests,
120 expected failures and 191 TODOs** (25 existing, 166 plan 24). Nokia-os contributes
164 passing files, one pending-only slice, 10,176 passed tests, 120 expected failures and
191 TODOs, in 931.78 s. The other packages contribute phone-core 450, snake 62, phone-3d 49,
phone-screen 101 and website 180 passing tests. Logs: `/private/tmp/plan24-task3-{validation,check-fix,build}.log` and
`/private/tmp/plan24-task3-tests-node22.log`.

**Verification environment correction.** An initial workspace run used Homebrew Node 26:
the host PATH hook overrode the `node` resolved through `mise exec -- env ...`. That run was
stopped and is not accepted verification. The replacement invokes mise's installed Node 22
by absolute path, then prepends its directory for child processes in the temporary launcher.
The uncached website tests pass (24 files, 180 tests) with this correction; no website file or
host toolchain configuration changes.

**Task 4 discrepancy — stop before implementation (2026-10-27).** The landed plan-29
`PlanCaptureSet.resources` contract (`scripts/resource-declarations.ts`, `ResourceDeclarations`)
registers text, crops, menu icons and widget timelines. It has no extractor/output registration
for a dedicated generated module or structured terrain/timing data. `ExtractedResources`,
`extractResources` and `generatedFiles` in `scripts/extract-resources.ts` explicitly enumerate
all outputs; Snake II's `snake.ts` is hard-coded there. A plan-owned crop/timeline declaration
would only enter shared `widgets.ts`, not Task 4's required `space-impact.ts` (or Task 5's
`space-impact-levels.ts`). Task 4 requires an owned one-line registration through the shared
pipeline and explicitly forbids redesigning it here. AGENTS.md requires stopping on plan/API
drift. No Task 4 file, resource, dependency or speculative workaround is added.

**Parent decision (Lachlan, 2026-10-28): shared extension approved.** Extend
`PlanCaptureSet.resources` / `ResourceDeclarations` so a plan declares an extractor and its
generated module paths under `src/resources/generated/`. The shared extractor iterates those
declarations; migrate Snake II's hard-coded output to the same contract. Keep one export block
per module in `src/resources/index.ts`. Update AGENTS.md and plan 29's contract. This is an
authorized exception to Task 4's earlier prohibition on shared pipeline edits, committed as
its own verified unit: `feat(nokia-os): plans register their own generated resource modules`.
All existing generated modules must remain byte-identical, including Snake II; regenerate
twice with no diff. Task 4 then uses one owned registration line. No new gameplay/product
default is authorized; the four accepted defaults remain labelled UNVERIFIED.

**Shared pipeline delivery (2026-10-28).** `generatedModules: [{ file, extract }]` now
registers a deterministic module extractor through the existing capture registry. Readers accept
indexed committed LCD, tick and sound fixtures, including pending evidence; the shared writer
rejects duplicate/escaping output paths and conflicts with shared modules before writing.
Snake II registers `snakeResourceModule` through plan 23's existing resource input; no Snake
output/data case remains in shared extraction. The shared serializers iterate descriptors.
Eight new regressions failed before implementation; the completed focused gate passes
**5 files, 175 tests**, including four additional reader/migration checks. Both regenerate
runs report `extract-resources: up to date`; **all ten existing generated files remain
byte-identical**. Snake SHA-256: `9c7f946de4c616d5ef360169e19e96e6c77773e7be92e3516c73ebb11ced5572`.
`vp check --fix` passes. No generated file or golden changes.

### Task 4 - Space impact resources from goldens (TDD)

**Accepted criterion change (Lachlan, 2026-10-28).** Task 4's every-still terrain
re-render proof and complete-sprite-inventory prerequisite for Task 5 are replaced by the
acceptance tests. Task 4 derives terrain tiles and per-level tilemaps, including scroll
alignment, from clean frames and verifies those frames exactly. It commits the sprite table
available now; later tasks add pictures when a level replay needs them, with two exact LCD
specimens per added picture. Every settled frame of every full-level golden is then proven
pixel-exactly by acceptance replay, including terrain and sprites, following the accepted
level-coverage decision. A wrong tile or sprite fails at the frame containing it: fix the
mismatch there or record a known gap with its reason. Terrain columns and sprites absent
from the recordings remain labelled `UNVERIFIED` in the spec. No relaxed or majority-vote
comparison is permitted. This supersedes the earlier Task 4 checkpoint's inventory and
every-still blockers; the timing and freshness/TDD requirements remain.

**Files:** `scripts/space-impact-resources.ts` (new), shared resource registration (one line
through the pipeline delivered by plan 29),
`src/resources/generated/space-impact.ts` (generated), `src/resources/index.ts` (one export
block), `tests/space-impact-resources.test.ts` (new).

- [x] Confirm Task 0's canonical-level gate and plan 29's verified registration repair before
      generating resources. Inspect the landed registration contract; use one owned registration
      line without redesigning shared extraction here.
- [x] Commit the current crop table (golden, image, rectangle, sprite id); add further pictures
      during later level replay with two exact LCD specimens, including both polarities where
      clean specimens show both. Complete inventory is proved by acceptance replay.
- [x] Terrain: derive 32x8 tiles and each level's 2x16 tilemap (ground or ceiling), including
      scroll alignment, from clean frames; re-render those clean frames exactly. Label unseen
      columns `UNVERIFIED` in the spec. Full-level acceptance replay proves every settled frame.
- [x] Timing: `SPACE_IMPACT_TICK_MS`, `…_FIRST_TICK_MS`, `…_SHIELD_MS` (new game, respawn,
      resume), `…_REPEAT_MS`, the continue screen's hold and step, the respawn delay, the level
      exit's step times, from the timelines (medians).
- [x] TDD: freshness (in-process extraction equals the committed file); every sprite inside its
      golden's ink; tilemaps reproduce their clean reference frames exactly; the timer-unit rule
      (H1) holds for every period as a cross-check.
- [x] Run `extract-resources` twice; no diff.
- [x] Commit: `feat(nokia-os): derive Space impact sprites, terrain and timings from goldens`.

**Task 4 checkpoint (2026-10-28; incomplete).** The parent permits partial progress with
every commit green. This checkpoint keeps Task 4 open and does not begin Task 5.
`analysis/coverage.py --check` passes all 25 accepted criteria immediately before extraction.
The shared registration repair above is verified. The one owned `resources` registration in
plan 24's capture set declares `space-impact.ts`; `src/resources/index.ts` adds one export block.

`space-impact-resources.ts` derives **14 sprites from 27 explicit golden/image/rectangle
specimens**: the ship, HUD heart, missile icon, ten digits and continue icon. Thirteen sprites
have independent normal/inverted specimens; conflicting specimens, absent images, invalid
rectangles and ink-free crops fail. Nothing is copied from extracted firmware or the exploratory
census. The crop geometry and expected art are read from committed LCD frames.

Three independent complete no-key recordings (`nokeys`, `ansi-nokeys-game1`,
`ansi-nokeys-game2`) yield median timings: tick **93 ms**, first tick **173 ms**, initial
continue hold **1548 ms**, countdown step **775 ms**, final zero **856 ms**. These are empirical
medians, not exact per-recording edge requirements. The 12-unit tick and 100-unit countdown
independently cross-check; no tolerance changes. An incomplete countdown fails extraction.

TDD first failed because the resource module was absent, then because its generated output
was absent. The focused checkpoint gate passes **3 files, 88 tests**. The generated output
comes only from `regenerate`; existing ten generated modules retain their baseline bytes.

**Still required for Task 4:** the shield, player shot/missile/wall/beam/explosions, complete
enemy and boss animation/projectile inventory (including the multipart final boss), pickup
sprites, wall/beam HUD icons, splash pictures, terrain tiles/maps and full terrain re-render
proof, new-game/respawn/resume shield, repeat, respawn and level-exit timing. The current
module is an incomplete resource checkpoint, not a complete sprite inventory or gameplay
implementation. All Task 4 completion boxes above remain open except its entry gate; the
planned full-resource commit still waits for those proofs. No fixture is asserted, no known
gap is added, and the four accepted defaults remain UNVERIFIED. No product decision is needed
for this checkpoint.

**Checkpoint closeout verification (2026-10-28).** Commits: `e1ccbb7` (shared pipeline)
and `9b682aa` (Task 4 HUD/ship/timing checkpoint). The final uncached
`mise exec -- vp run -r --no-cache test` passes all six packages with **257 passing files,
one pending-only slice, 11,037 passed tests, 120 expected failures and 191 TODOs**. Nokia-os:
165 passing files, one pending-only slice, 10,195 passed tests, 120 expected failures and
191 TODOs (931.63 s). Other packages: phone-core 450, snake 62, phone-3d 49, phone-screen 101,
website 180 passed tests. Zero cache hits. Final `vp check` and `website#build` pass.
Every gate used mise's Node **22.22.3** by absolute executable, with its directory prepended
for children via `/private/tmp/plan24-run-node22.cjs`; the workspace suite used
`VITEST_MAX_WORKERS=2` and `VP_RUN_CONCURRENCY_LIMIT=1`. Logs:
`/private/tmp/plan24-final-{workspace-tests,check,build}.log`.

The first two pipeline regenerations report up to date and match the baseline SHA-256 for
all ten existing files. The Task 4 checkpoint adds only the 1,817-byte `space-impact.ts`;
two subsequent regenerations report up to date, and all ten existing files still match.
No tracked golden or index changes. Plan 24 has **zero asserted, 166 pending fixtures and
zero known gaps**. Its inherited Space impact leaf and sound note remain pending in their
original indices; the six later-games fixtures remain unchanged. No tolerance changes.
Website, phone-core, phone-screen, phone-3d and packages/snake have no diff from the assigned
starting head. Both parent decisions are recorded above; the full recordings are retained.
No new product decision is needed. Resume at the remaining Task 4 inventory/terrain/timing
proofs, then continue Tasks 5-14 in order.

### Task 4 continuation checkpoint (2026-10-28; incomplete)

Resumed at `7026975` in `t3/p24-space-impact`. This is further Task 4 resource work;
Task 4 remains open and Tasks 5-14 have not begun. The accepted Task 0 checker
`analysis/coverage.py --check` passes again. No new product decision or accepted default.

The owned crop table now contains **57 sprites from 113 explicit specimens** (the earlier
checkpoint had 14 from 27). The additional 43 pictures are:

- 12 boss pictures: two for each of levels 0-5, with the same complete rectangle matched at
  two different positions. These are observed pictures, not a claim that every boss phase,
  hit picture or animation variant is complete.
- Two shielded-ship pictures (14x11, including the ship), a missile (5x3), the beam's play-field
  column (1x42), and one wall burst picture. The beam specimens deliberately avoid XOR holes
  from overlapping shots or enemies.
- 17 enemy pictures in ten visual families: round-wide, round-small, triangle, long-left,
  round-tail, zigzag, lander, jet, diamond and long-right. The names are visual labels, not
  recovered firmware type numbers.
- The player shot, wall/beam HUD icons, two dotted-orb pickup pictures, two projectile pictures
  and two explosion pictures.

Every additional picture has at least two golden/image specimens, including opposite LCD
polarities for the 23 new pictures for which clean shared specimens have been selected.
Tests hold independently inspected expected pixels and compare all declared specimens exactly.
The exploratory census was used only to locate candidate LCD frames: its eye/orb/pellet
candidates included adjacent boss ink or incomplete rectangles. They were not copied into
resources. The real dotted pickup is independently located in the reviewed level-2 approach
(`jl`) and the normal/inverted specimens in the crop table. Resource extraction reads only
indexed committed goldens, never REF or exploratory census outputs.

Three more visible timing medians come from the three complete no-key timelines:
`newGameShieldMs: 2992`, `respawnShieldMs: 3002`, `respawnMs: 471`. The six respawns supply
both the death-to-ship delay and shield durations. Explicit image landmarks validate the ship
and its surrounding shield/clear pixels, ignoring the gun row and the shield's central ship
rectangle where shots redraw. Missing landmarks, wrong ship phases and reversed event times
fail extraction. The shared timing tolerance cross-checks the observed 376/62-unit intervals;
no fidelity tolerance changes. These are visible LCD-edge medians, not proof of a
millisecond-exact underlying timer or game-engine behavior.

TDD: the first added sprite batch failed for its missing pictures; the boss and shield/weapon
batches each failed before their crops were added; the timing expectation failed before its
extractor was added. The focused gate passes **3 files, 109 tests** (56 in the Space impact
resource file). Freshness compares in-process extraction byte-for-byte with the generated
module. Two subsequent regenerations report `up to date`; the ten other generated modules
retain their baseline bytes. Formatting is stable; `vp check --fix` passes.

**Remaining Task 4 work:** complete the sprite/animation/projectile inventory, including the
level-6 and multipart final boss, further enemy/bonus/explosion pictures, the seven wall frames,
and splash pictures; reconstruct the terrain tiles/tilemaps and prove every still's terrain;
measure resume shield, held repeat and level-exit steps. An exploratory terrain-alignment
probe did not reproduce every terrain row because of partial redraws, sprite overlap and
unresolved scroll alignment; no terrain data or permissive comparison was committed. The
remaining crop list and all Task 4 completion boxes stay open. Task 5 still depends on this.

No gameplay golden is promoted by resource extraction. Plan 24 remains **0 asserted,
166 pending fixtures, 0 known gaps**; inherited pending Space impact fixtures remain in their
original indices. No runtime game implementation, capture fixture, tolerance or other package
changes in this checkpoint. The four previously accepted defaults remain UNVERIFIED.

**Continuation closeout verification.** `vp check --fix`, stable formatting and final
`vp check` pass. The uncached `vp run -r --no-cache test` passes all six packages:
**257 passing files, one pending-only slice, 11,086 passed tests, 120 expected failures,
191 TODOs**, zero cache hits. Nokia-os: 165 passing files, one pending-only slice,
10,244 passed tests (937.90 s). Other package totals remain phone-core 450, snake 62,
phone-3d 49, phone-screen 101 and website 180. `website#build` passes. All successful gates
run through mise's absolute Node **22.22.3** executable with its directory pinned for children
by `/private/tmp/plan24-run-node22.cjs`; the workspace run sets `VITEST_MAX_WORKERS=2` and
`VP_RUN_CONCURRENCY_LIMIT=1`. An initial `env ... node` launch selected host Node 26 and was
rejected by that guard before tests; it is not counted as verification. Logs:
`/private/tmp/plan24-resource-{workspace-tests,check,build,focused}.log` and
`/private/tmp/plan24-resource-canonical-coverage.log`.

Plan 24's 166 fixtures plus the two inherited Space impact leaf/sound fixtures remain pending;
the six inherited later-games fixtures are unchanged. The generated Space impact module is
14,005 bytes. Website, phone-core, phone-screen, phone-3d and packages/snake have no diff from
`7026975`. No fixture or index changes. Resume at Task 4's remaining proofs above, then
continue Tasks 5-14 in order.

### Task 4 terrain/timing checkpoint (2026-10-28; incomplete)

Continued from `edacd86` in `t3/p24-space-impact`. Task 4 remains open; Tasks 5-14 have
not begun. The canonical `analysis/coverage.py --check` passes all 25 accepted criteria.
No new accepted default or product decision.

Terrain was investigated first. The previous adjacent-frame fit was rerun with short redraws
excluded, exact known-sprite rectangles masked, and time-constrained scroll candidates. Raw
and terrain-subtracted sprite matches, including clipped edges, still leave conflicting
terrain pixels: bosses and shots overlap the band, and the inventory does not yet identify
all of them. Identifying a boss by its clean rows outside the terrain band reduces conflicts
but does not remove them. **No fitted map, majority-voted pixel, relaxed comparison or full
terrain proof is accepted by this checkpoint.** Scroll alignment and complete 2x16 maps remain
unproved; the apparent unobserved columns in levels 1 and 7 are an investigative result,
not a claim that a tile choice is established or impossible to observe. The failed probes,
results, tile inspection sheet and their limitations are retained in
`$REF/captures/6.39/plan24/analysis/task4-terrain-20261028/` (see its README and manifest).

The crop table adds **27 nonempty 32x8 terrain pictures**, each checked against two clean,
independent LCD images at different screen x positions. The pictures cover the outline hills,
mountains, buildings, ceiling patterns and the last two levels' ground. Numeric ids are crop
identities, not recovered firmware tile numbers or a complete inventory. Their inspected
expected rows live in the resource test. Extraction reads only those committed LCD crops;
exploratory fitted pixels never enter generated output. Terrain tile extraction is useful
input to reconstruction, not a substitute for re-rendering every remaining terrain pixel.

A third shielded-ship picture is proved by the two independent resume recordings and a
normal-polarity level-1 specimen. The module now holds **58 sprite pictures plus 27 terrain
pictures (85 entries)**. The shield landmark classifier accepts the ship's ink under its
shield, verifies the shield perimeter, and excludes the gun row redrawn by shots. A bare
ship still requires its clear pixels. It supports the one-row move of the resume-8 case.

Remaining timing measurements now include `resumeShieldMs: 1512` (visible edges 1512 and
1481 ms after the wake-key redraw), `repeatMs: 94` (the two-pixel moves under held 0 and 8),
and `levelExitStepMs: 92` (ship movement across all eight exits). These are LCD medians;
the timer-unit cross-checks use the shared fidelity rule. Level 5 starts on its exit row
already and contributes fly-off steps without inventing an alignment phase. Missing resume
edges, missing repeats or an exit without its fly-off fail extraction.

**Deviation:** the original held-key fixtures retained selected tick stills and therefore
could not measure repeat intervals. Two additional resource timelines,
`keys-hold-{0,8}.timeline`, retain the existing canonical recordings losslessly. The importer
creates them and their two plan-24 index entries; the original key fixtures remain intact.
No recapture, fixture hand edit, status promotion or tolerance change. Plan 24 now has
**0 asserted, 168 pending fixtures, 0 known gaps**; the inherited Space impact leaf and sound
note stay pending in their original indices. The six later-games fixtures are unchanged.

**Still required:** the complete animation/projectile/bonus/explosion inventory (including
level-6 and multipart final bosses, seven wall frames and splash pictures), terrain scroll
alignment and complete maps, and the exact re-render proof across all settled level stills.
Task 4's timing box is complete; its inventory, terrain, combined verification and commit
boxes remain open. The four accepted defaults retain their UNVERIFIED
labels. Do not start Task 5 from this checkpoint.

**Checkpoint closeout verification.** The focused resource, capture-set and registration
suite passes **3 files, 128 tests**. The new resource/timing checks fail before their
implementation, then pass after extraction and regeneration. All 27 terrain pictures have
two exact specimens; the new shield picture has three specimens including both polarities.
The crop table has **170 explicit specimens** including the mapped digits. Freshness compares
the complete in-process module byte for byte with the generated file.

The uncached `vp run -r --no-cache test` passes all six packages: **257 passing files,
one pending-only slice, 11,126 passed tests, 120 expected failures, 193 TODOs**, zero cache
hits. Nokia-os: 165 passing files, one pending-only slice, 10,284 passed tests
(959.59 s). Other package totals: phone-core 450, snake 62, phone-3d 49,
phone-screen 101, website 180. `vp check --fix`, stable formatting, final `vp check` and
`website#build` pass. All gates use mise's absolute Node **22.22.3** executable and the
child-PATH guard `/private/tmp/plan24-run-node22.cjs`; the workspace run uses
`VITEST_MAX_WORKERS=2` and `VP_RUN_CONCURRENCY_LIMIT=1`. Logs:
`/private/tmp/plan24-terrain-{focused-final,workspace-tests,check,build}.log`.

Two subsequent resource regenerations report `up to date`; a second import changes nothing.
All ten other generated modules and every existing golden retain their baseline bytes.
All 166 pre-existing plan-24 index entries are unchanged; only the two pending timing
entries are added. The generated Space impact module is 24,233 bytes. Website, phone-core,
phone-screen, phone-3d and packages/snake have no diff from `edacd86`. Task 4 remains open;
no gameplay replay or full terrain proof is claimed, and Tasks 5-14 remain unstarted.

### Task 4 revised-criterion delivery (2026-10-28)

Continued from `09e6be9`, only in `t3/p24-space-impact`. The accepted criterion change
under Task 4 supersedes the historical checkpoints' complete-inventory/every-still blockers.
The canonical `analysis/coverage.py --check` passes all 25 criteria again. Plan 29's existing
owned module registration remains unchanged.

The resource extractor now derives eight 2×16 terrain maps from **229 explicit clean LCD
specimens**, including four level-6 leading-tile variants and two independent specimens of
each fragment where objects obscure a complete tile. It verifies **215 complete clean terrain
bands**, every pixel exactly at its declared scroll alignment. The maps contain **236 observed
or terrain-free cells**; level 0 has no terrain. The current **58 sprite pictures plus 27
terrain pictures** are retained unchanged. No missing sprite inventory is claimed complete:
Tasks 5–13 add needed pictures with two exact specimens and prove full settled frames in replay.

Level 1's upper column 5 is established by two clean 16-column views per half. Level 7's
column 6 is established by two clean eight-column views per fragment in the separate committed
restart recording. Exact adjacent lower-terrain strips identify the restart's scroll stopping
at 166; no majority vote or tolerated pixel is used. The exploratory first-recording offsets
are used only to locate references; committed extraction reads and validates committed LCD
rectangles and full clean bands, never exploratory fitted pixels or REF.

**UNVERIFIED:** level 1 column 15 and level 7 columns 7–15 lack complete clean coverage.
Their map cells remain `null`, the spec names them, and the reference renderer fails explicitly
if a requested rectangle needs them. Partial right-edge observations do not prove hidden
pixels. Every observed placement, including those edges, remains an obligation of full-level
acceptance replay. Level 6's leading variants preserve the two-pixel difference at screen x=0
in columns 0/4/9/12; the underlying blitter mechanism remains UNVERIFIED. An exact probe matches
all 432 clean level-6 bands; the committed proof set retains boundary, intermediate and wrap
landmarks. No tile is altered to hide the difference.

TDD first fails for the absent terrain exports, then for unsupported map cells, then for
stale generated bytes; the completed focused gate passes **3 files, 577 tests**. Independent
checks cover the level-2 tile order, a one-pixel scroll, 512-pixel wrapping, exact source
rectangles and complete clean frames, viewport-leading variants, refusal of unknown cells,
and deliberate one-pixel source corruption. Existing timing/H1 cross-checks remain green.
The generated module comes only from `regenerate`; two consecutive subsequent runs report
`up to date`. The other ten generated modules retain their bytes from `09e6be9`.

**Closeout verification.** The complete uncached `vp run -r --no-cache test` passes all six
packages: **257 passing files, one pending-only slice, 11,575 passed tests, 120 expected
failures and 193 TODOs**, zero cache hits. Nokia-os: 165 passing files, one pending-only
slice, 10,733 passed tests (944.32 s). Other package totals remain phone-core 450, snake 62,
phone-3d 49, phone-screen 101 and website 180. `vp check --fix`, final `vp check` and
`website#build` pass. Gates use mise's absolute Node **22.22.3** with the child-PATH guard
`/private/tmp/plan24-run-node22.cjs`; the workspace run uses `VITEST_MAX_WORKERS=2` and
`VP_RUN_CONCURRENCY_LIMIT=1`. Logs:
`/private/tmp/plan24-map-{focused-final,workspace-tests,check-fix,check,build}.log`.
No golden is promoted by resource extraction: **0 asserted, 168 pending, 0 known gaps** in
plan 24; the two inherited Space impact fixtures remain pending in their original indices.
No tolerance or four accepted UNVERIFIED gameplay default changes. No new product decision.
Task 4 is complete under the revised criterion. This delivery stops at its green commit;
Tasks 5–14 remain unimplemented. Resume with Task 5's strict decoder, then object tracking,
spawn/y-path/boss fitting and seed/fire-event reconstruction. Missing pictures are added as
replays need them, not used to reopen the superseded inventory gate. No complete gameplay,
terrain edge not observed cleanly, or spawn/firing rule is asserted by this resource delivery.

### Accepted sequencing change (Lachlan, 2026-10-28): level 0 vertical slice first

Task 5 is split into **5a (level 0)** and **5b (levels 1–7)**. Task 5a commits
level 0's observed spawn script, paths, boss, HP and fire data through the existing
`resources.generatedModules` extension. The existing decoder/tracker's observed per-level
data is acceptable; a general fitted rule is not a prerequisite. This supersedes the
historical checkpoints' requirement to finish every level before emitting runtime data.

After 5a, execute Tasks 6 onwards against level 0 until its complete full-level golden
and related fixtures replay pixel-exact in `tests/acceptance/24-space-impact.test.ts`
and become asserted. Drive splash, menu, HUD, continue and game-over fixtures as soon as
supported. Then execute 5b and extend levels 1–7 one at a time, using replay failures to
identify missing data or engine behavior. Tasks remain incomplete outside their proven
slice; this is an accepted sequencing change, not a reduction of the final plan scope.

Pixel-exact replay remains the proof. Keep the shared fidelity rules, record real
mismatches with reasons, preserve the four accepted UNVERIFIED defaults, use TDD and
commit coherent green units. Run focused tests during development and the full uncached
workspace suite for each finished unit. The target of this round is level 0 end-to-end.

### Accepted level-0-first refinement (Lachlan, 2026-10-29)

The decoder is sufficient to leave the critical path: it exactly reads 855 of 856 settled
level-0 images, retaining ambiguity in 398. Do no further general decoder work this round;
only an engine replay that specifically demands a decoder correction justifies one.

Commit Task 5a's observed level-0 data through `resources.generatedModules`, keeping explicit
alternatives where the LCD is ambiguous. Proceed immediately with Tasks 6 onwards: engine,
painter, session, flow, sounds and Games integration, then level-0 acceptance scenarios. The
engine's rendered frames choose between observed alternatives. Each settled frame must match
its golden pixel-exact; fix engine/data mismatches, or record a genuinely unresolved difference
as a reasoned known gap. The mixed boss redraw `ala` is a candidate gap only after replay
confirms it. Assert the full level-0 recording and related splash, menu, HUD, Continue and
game-over fixtures as their real scenarios pass. The four accepted defaults retain their
literal UNVERIFIED labels. TDD, coherent green commits, focused development checks, and one
full uncached workspace suite per finished unit remain required. This refines the accepted
2026-10-28 sequencing change without reducing the final scope.

### Task 5 - Level reconstruction (TDD)

**Files:** `scripts/space-impact-levels.ts` (new: the object tracker and the fitter),
`src/resources/generated/space-impact-levels.ts` (generated), `src/resources/index.ts` (one export
block), `tests/support/space-impact-decode.ts` (new), `tests/space-impact-levels.test.ts` (new).

- [x] Confirm the canonical-level gate and the verified plan 29 pipeline before reconstruction.
- [ ] TDD the decoder on synthetic frames painted from Task 4's sprites: HUD values, the ship,
      every object (type by picture, frame, box), terrain scroll; it rejects frames it cannot read.
- [ ] The tracker follows each object across a level golden's stills (positions per tick by
      interpolation only where the motion rule is linear between stills; otherwise the selection
      keeps every tick). The fitter turns tracks into per-level spawn scripts (entry time, group
      size, spacing, type, pattern and argument, y or "random row", shots, hit points from the hits
      and kills in the score), y-path tables (y by x) and boss behaviour per level (H5, H6, H12,
      H13).
- [ ] Fire chances: each firing object type's N is fitted with Task 6's generator over the
      uniquely recovered or independently proved clock seed (Task 6): the smallest N consistent
      with every captured fire event and every non-event. Ambiguous N are reported (Open question 2).
- [ ] TDD: freshness; every level's script re-spawns every tracked object at its captured tick
      and place; every y-path reproduces its tracks.
- [ ] Commit: `feat(nokia-os): reconstruct Space impact levels from goldens`.

**Parent execution guidance (Lachlan, 2026-10-28).** Where exhaustive rule fitting is slow,
Task 5 may retain the per-level data observed by the tracker (spawn times, positions, paths,
and HP from kills) before deriving a general rule. Get level 0 through the engine and replay
early, then extend the remaining levels. The full-level pixel-exact replay remains the proof;
this permits neither guessed data nor a relaxed comparison. Fire/RNG rule fitting still needs
Task 6's informative LCD evidence.

**Task 5 decoder checkpoint (2026-10-28; incomplete).** Continued from `e1dbdd7`, only
in `t3/p24-space-impact`. The canonical `analysis/coverage.py --check` again passes all
25 criteria. The landed `resources.generatedModules` contract is confirmed; no shared
pipeline or generated output changes in this checkpoint.

The test-first decoder reads literal HUD values, the ship and shield pictures, known enemy,
boss, bonus, projectile, explosion and special pictures, including identifiable horizontal
clipping. Picture ids retain their captured animation-frame identity and the observations
include full bounding boxes. It requires an exact decomposition of the remaining LCD ink,
rejects competing decompositions and unread pixels, and never mutates its source. It reads
complete clean terrain bands against Task 4's maps, preserves matching scroll candidates and
UNVERIFIED-map candidates separately, refuses a supplied scroll through unknown cells, and
reports level 0's scroll as unobservable. This does not impose a gameplay life cap or seed.

Synthetic regressions cover every existing object picture, HUD digits and weapon icons, both
polarities and HUD placements, terrain wrapping, repeated enemies, clipped boxes, ambiguous
pictures, corrupt pixels and invalid inputs. Independent committed LCD checks cover startup
ships and three enemies (including the clipped rightmost enemy) in `keys-tap-5 t0040`.
Two exact LCD specimens (`level-0 d/h`) establish a shot XOR across the ship's gun row; the
decoder composes the existing ship/shot pictures for that case rather than ignoring gun pixels
or cropping an overlapping shot into a new ship sprite. No new sprite or crop is required
by the implemented cases. All **87 decoder tests** pass; the focused resource/registry gate
passes **3 files, 660 tests**.

**Remaining decoder work.** It presently requires clean terrain bands and known pictures.
The strict full-level probe first stops at `level-0 ac` (ambiguous decomposition after 27
readable images), `level-1 c`, `level-2 e`, `level-3 c`, `level-4 e`, `level-5 e`, `level-6 c`
and `level-7 c` (unread object pixels). The white-background gun-row composite is not proved
by the level-0 XOR specimens. Extend the observed layering/pictures with exact evidence;
keep ambiguity explicit for the temporal tracker. Add any needed new sprite with two exact
LCD specimens. These are unfinished reconstruction cases, not asserted acceptance or newly
registered known gaps. No complete level replay, tracker, spawn script, y-path, hit-point,
shot/fire fit or boss reconstruction is claimed. The decoder completion box stays open;
Tasks 6–14 have not begun. No product decision is needed for this checkpoint and the four
accepted UNVERIFIED defaults are unchanged.

**Checkpoint verification.** The complete uncached `vp run -r --no-cache test` passes all
six packages with **258 passing files, one pending-only slice, 11,662 passed tests,
120 expected failures and 193 TODOs**, zero cache hits. Nokia-os contributes 166 passing
files, one pending-only slice and 10,820 passed tests (961.53 s); other package totals are
phone-core 450, snake 62, phone-3d 49, phone-screen 101 and website 180. `vp check --fix`,
final `vp check` and `website#build` pass, using mise Node 22.22.3 and
`/private/tmp/plan24-run-node22.cjs` (workspace: `VITEST_MAX_WORKERS=2`,
`VP_RUN_CONCURRENCY_LIMIT=1`). Logs: `/private/tmp/plan24-levels-{focused-final,workspace-tests,check-fix,check,build}.log`.
No golden or generated file changes: **0 asserted, 168 pending, 0 known gaps** in plan 24.
The inherited Space impact fixtures remain pending in their original indices. Website,
phone-core, phone-screen and packages/snake are unchanged from `e1dbdd7`.

### Task 5 layered-decoder and linear-tracker checkpoint (2026-10-28; incomplete)

Continued from `12d5c08`, only in `t3/p24-space-impact`. The canonical
`analysis/coverage.py --check` passes all 25 accepted criteria. Task 5 stays open;
Tasks 6–14 have not begun. No product decision, golden promotion or generated level data
is claimed by this checkpoint.

**Exact layering and ambiguity.** `decodeSpaceImpactCandidates` returns every supported
visible decomposition instead of stopping after two solutions; `decodeSpaceImpact` still
refuses an unresolved choice. Independent LCD specimens establish shot XOR on black
(`level-0 d/h`) and ink union on white (`level-1 c`, `level-2 e`, `level-3 c`,
`level-6 c`, `level-7 c`). In the white specimens, a shot at x=11 or x=12 gives the same
pixels across the shield's gun row. Both remain candidates. No invisible shot is inferred.
`level-4 e` and `level-5 e` independently establish a shot at (13,22) while the shielded
ship has moved to (3,16); shot overlaps are no longer limited to its current gun row.
Existing resource pictures suffice; no crop or sprite is added.

Each consumed picture rectangle is reserved during decomposition. Otherwise a shot
could cancel the ship's top-row ink, then a duplicate shot could "restore" it in the
already consumed blank rectangle: an invalid decomposition introduced by unrestricted
layer enumeration. The independent `keys-tap-5 t0040` regression forbids that artifact.
Only the explicitly composed ship/shot layer may overlap here; other overlaps remain
unread rather than silently discarding pixels. All 87 previous decoder tests remain
unchanged in their assertions and pass.

**Tracker and fitting.** `scripts/space-impact-levels.ts` now associates exact positions
across animation-picture changes, keeping a graph of alternative observations and links.
Later observations prune candidates backwards, including predecessor-index remapping.
The first supported segment type requires an independently established integral constant
motion per picture family and permits horizontal viewport entries/exits. Unknown motion,
interior births/disappearances, corrupt observations and one-pixel motion mismatches fail
explicitly; no nearest-neighbour choice, kill or HP inference is made. It preserves unresolved
animation pictures at entry. A linear fitter checks every supplied position and rejects
curvature, mixed families, nonintegral motion and underdetermined fits. A line through sparse
samples alone is not proof of the missing ticks; those require independent motion evidence.

The independent `keys-tap-5` LCD sequence at ticks 40,41,42 tracks all three enemies through
both animation frames, including the initially clipped enemy. Their fitted starts are
x=42,60,78, y=8, with dx=-2, dy=0. A separate test uses the real ambiguous white LCD frame
and a later established shot position to show temporal pruning to x=11; it is a synthetic
motion constraint, not a claim of full captured shot replay. TDD fails first on the absent
candidate API/off-gun-row overlap, then on the absent tracker module. The focused gate passes
**3 files, 689 tests**, including **116 decoder/tracker tests** (29 additional).

**Continuation points.** The exact candidate probe (all native images after the initial
menu, no timing or pixel tolerance) now first stops at:

| Level | Readable images | Ambiguous images | First unread image | Unfinished case                                           |
| ----- | --------------: | ---------------: | ------------------ | --------------------------------------------------------- |
| 0     |              61 |               13 | `bk`               | object/layer decomposition                                |
| 1     |              18 |                1 | `t`                | object over terrain; at scroll 19, residual pixel (83,36) |
| 2     |              64 |               31 | `bn`               | object/layer decomposition                                |
| 3     |               4 |                1 | `f`                | more than one shot crosses the ship rectangle             |
| 4     |               5 |                0 | `g`                | more than one shot crosses the ship rectangle             |
| 5     |               4 |                0 | `f`                | ship/shot intersects ceiling terrain                      |
| 6     |              26 |                7 | `ab`               | object over terrain                                       |
| 7     |              25 |                6 | `aa`               | object over terrain                                       |

These are investigative stops, not registered known gaps. Extend exact supported layering
and add needed sprites with two LCD specimens, then track complete levels (including
nonlinear paths and collision/score evidence). Full spawn/group/spacing/y-path/boss/HP/fire
fitting and seed recovery remain unimplemented. Register `space-impact-levels.ts` output
through the existing `resources.generatedModules` contract only when those fitted data have
committed evidence and freshness tests; do not emit guessed or partial runtime level tables.
Keep the accepted full-level pixel-exact replay gate and all four UNVERIFIED defaults.

**Checkpoint closeout verification.** The complete uncached `vp run -r --no-cache test`
passes all six packages: **258 passing files, one pending-only slice, 11,691 passed tests,
120 expected failures and 193 TODOs**, zero cache hits. Nokia-os contributes 166 passing
files, one pending-only slice and 10,849 passed tests (1003.86 s); the other totals remain
phone-core 450, snake 62, phone-3d 49, phone-screen 101 and website 180. `vp check --fix`,
final `vp check` and `website#build` pass, using mise's absolute Node 22 and
`/private/tmp/plan24-run-node22.cjs` (workspace: `VITEST_MAX_WORKERS=2`,
`VP_RUN_CONCURRENCY_LIMIT=1`). Logs:
`/private/tmp/plan24-layer-{focused,workspace-tests,check-fix,check,build}.log`;
failing-before evidence: `/private/tmp/plan24-{layer,tracker}-red.log`.
The four-file checkpoint changes only the assigned plan, the decoder, its tests and the new
linear tracker/fitter. No fixture, generated resource, excluded package, tolerance or accepted
UNVERIFIED default changes. Plan 24 remains **0 asserted, 168 pending, 0 known gaps**;
the inherited Space impact fixtures remain pending in their original indices. Task 5 remains
incomplete; Tasks 6–14 are unstarted.

### Task 5 multiple-shot and terrain-layer checkpoint (2026-10-28; incomplete)

Continued from `bd293ec` in the existing `t3/p24-space-impact` worktree. The canonical
`analysis/coverage.py --check` passes all 25 accepted criteria. Task 5 remains incomplete;
Tasks 6–14 remain unstarted. No new product decision or accepted UNVERIFIED default.

**Exact layers.** The decoder now solves crossing shots by row instead of pre-enumerating
single-shot ship pictures. Multiple nonoverlapping shots may cross one ship rectangle, on
the same or different rows. LCD specimens `level-3 f` and `level-4 g` establish the two cases;
`level-5 f` establishes the shield crossing the ceiling terrain. The reserved rectangles still
prevent another decomposition from restoring already consumed pixels with duplicate shots.
Every supported white-background shot alternative remains explicit, including the identical
one-shot and two-adjacent-shot interpretations hidden by the shield. The strict entry point
refuses ambiguous decompositions; it never chooses the smaller shot count as a gameplay fact.

Terrain is composed with foreground objects instead of requiring a clean 16-row band. Known
scroll candidates are tested against the complete frame: XOR on inverted levels, ink union on
white levels. Unknown terrain cells are still UNVERIFIED and an explicitly requested unknown
scroll still fails. Independent regressions repaint every returned candidate pixel-for-pixel
for `level-0 bk`, `level-1 t/bh`, `level-2 bn`, `level-3 f`, `level-4 g`, `level-5 f`,
`level-6 ab` and `level-7 aa`. No damaged pixel, partial-draw rule or timing comparison is
ignored to make these decompositions pass.

The missing `explosion/spark/0` picture (`#.# / .#. / #.#`) comes from independent clean
3×3 LCD specimens in `level-0 dz` and `level-1 bh`. It is registered in the existing resource
extractor and regenerated through `generatedModules`, bringing the inventory to **86 pictures**.
`level-0 bk` proves a shot crossing this explosion's edge. Tiny standalone pictures can also
have exact explosion/shot decompositions: the synthetic picture tests now require the original
picture to be present among candidates, independently repaint **every** candidate exactly,
and require the strict decoder to reject an unresolved choice. This strengthens the pixel
proof without pretending that a single image establishes invisible object identity.

**Remaining reconstruction.** The native-image probe (including transients, no pixel tolerance)
now reaches these first unread images. Counts exclude the initial menu and count distinct
images, not engine ticks or accepted gameplay frames:

| Level | Readable images | Ambiguous images | First unread image |
| ----- | --------------: | ---------------: | ------------------ |
| 0     |             195 |               86 | `go`               |
| 1     |             134 |               57 | `ef`               |
| 2     |             123 |               69 | `du`               |
| 3     |             142 |               59 | `en`               |
| 4     |              32 |                5 | `ah`               |
| 5     |              68 |               14 | `br`               |
| 6     |              83 |               32 | `cg`               |
| 7     |              69 |               27 | `bs`               |

Level 0 `go` has an orb crossing the rightmost enemy's bounding rectangle; its separated ink
is identifiable in the adjacent `gr` frame. The current solver reserves whole object
rectangles, so inter-object layers other than crossing shots remain unfinished. Level 4 `ah`
contains an unknown clipped foreground picture; later probes require additional object and
layer evidence too. These stops are investigative findings, not newly registered known gaps.
No complete level tracker, lifecycle/kill attribution, spawn script, path/boss/HP/fire fitting,
seed recovery or runtime level module is claimed. Continue with the remaining exact layers,
then complete level-0 tracking and fit observed per-level data under the parent guidance.
Do not emit guessed or partial runtime tables to close Task 5.

**Verification.** Focused checks pass **3 files, 704 tests**, including **130 decoder/tracker
tests**. Red-before evidence is in `/private/tmp/plan24-{multi,spark,explosion}-red.log`.
The generator alone writes `src/resources/generated/space-impact.ts`; no golden, status,
comparison tolerance or excluded package is edited.

**Closeout.** The complete uncached workspace suite passes all six packages: **258 passing
files, one pending-only slice, 11,706 passed tests, 120 expected failures and 193 TODOs**,
zero cache hits. Nokia-os contributes 166 passing files, one pending-only slice and
10,864 passing tests in 991.65 s; the other totals are phone-core 450, snake 62, phone-3d 49,
phone-screen 101 and website 180. `vp check --fix`, final `vp check` and `website#build`
pass. The full suite uses mise's absolute Node 22.22.3 with
`/private/tmp/plan24-run-node22.cjs`, `VITEST_MAX_WORKERS=2` and
`VP_RUN_CONCURRENCY_LIMIT=1`. An initial `mise exec -- env ... node` invocation was rejected
by that guard before executing any tests because the host hook resolved Node 26; its
replacement above is the accepted verification.

Logs: `/private/tmp/plan24-multilayer-{focused,registrations,workspace-tests,check-fix,check,build}.log`.
The independent native-image probes are `/private/tmp/plan24-probe-{fast,other}.log`.
Website, phone-core, phone-screen and packages/snake have no diff from `e1dbdd7`. The six
changed paths are this plan, the decoder, its tests, the sprite extractor, its tests and its
generated output. Plan 24's index remains **0 asserted, 168 pending, 0 known gaps**; the two
inherited Space impact fixtures remain pending in indices 14 and 16. Tasks 5–14 remain open.

### Task 5a level-0 overlap checkpoint (2026-10-29; incomplete)

Continued from `258bd86` in the existing `t3/p24-space-impact` worktree. The accepted
2026-10-28 sequencing change above is recorded before code changes. Task 5a remains open;
no generated level module, complete spawn/HP/fire table, runtime engine or acceptance replay
is claimed. Task 5b waits until level 0 replays end-to-end. The canonical capture check again
passes all 25 accepted criteria.

**Exact observations.** Level-0 `go/gp/gq/gr` establish a bonus orb following a round-wide
enemy at the same row, with intersecting bounding rectangles. The decoder composes their
existing original pictures, retains both object identities, and requires visible ink from
both parts; it never infers an invisible orb beyond the viewport. The composite's coverage
is the union of its original rectangles, not a larger filled bounding box. `ih/ii/ij`
establish the orb crossing blank cells of the ship's rectangle. Only that supported blank
intersection is admitted; other consumed rectangles remain reserved so cancelling shots
cannot manufacture a second decomposition. All previous tests, including strict clipped
enemy identification and the duplicate-shot regression, retain their assertions.

`aet/aeu/aev` prove an enemy at y=5, crossing the one-row gap below the HUD. Row 5 is now
read by the object solver rather than rejected as HUD corruption; an isolated corrupt gap
pixel still fails. `ahx/ahy` independently prove a player shot at (61,16) crossing the boss
at (58,12). The existing exact shot compositor now supports this level-0 boss case. No new
sprite, crop, generated resource, golden, tolerance or UNVERIFIED default is introduced.

`afo` proves the ship and orb's actual ink crossing just before pickup; the composed
ship/orb retains a separate ship observation and orb observation. Every returned candidate
repaints the complete frame exactly.

A local, consecutive-frame tracker regression (`gn` through `gr`) follows the enemy and orb
as separate objects at dx=-2, dy=0, recognizes the orb's clipped viewport entry, and fits its
observed path. It does not claim a complete level track or global spawn/RNG ordering.
The additional cases were test-first (`/private/tmp/plan24-slice-{overlap,gap,boss,pickup}-red.log`).
The final focused gate passes **3 files, 718 tests**, including **144 decoder/tracker tests**.

**Complete settled-image audit.** An independent temporary audit reads all level-0 images
shown for at least 34 ms (and the endpoints), using the shared fidelity standard without
altering any comparison helper. Of **856 settled gameplay images**, **855** have supported
exact decompositions, **398** remain ambiguous, and every one of **8,055** returned candidates
repaints all 4,032 pixels exactly. This is decoder evidence, not gameplay acceptance. Native image `rw` still needs a partial-draw decomposition, but
lasts 15 ms and is optional under the existing fidelity rule. The remaining settled failure
is not eligible for a 34-ms exception:

- `ala` (frame 1019, 76,783 ms, held 93 ms): in the boss region x=56..75, rows 23..31 are
  pixel-identical to the preceding `akz` image shifted up one row, while rows 32..46 remain
  pixel-identical to `akz` at their old coordinates. The next `alb` image redraws the complete
  boss. This mixed redraw lasts longer than 34 ms and cannot be dropped or disguised as a
  normal boss picture. Its redraw mechanism remains unimplemented.

This is a documented reconstruction failure, not an asserted known-gap scenario: the whole
fixture is still pending and the coverage guard requires known gaps to have an asserted
scenario. Finish this case and temporal/lifecycle reconstruction, emit observed level-0
data through `resources.generatedModules`, then proceed with the engine/painter/session and
pixel-exact acceptance. No product decision is requested; no missing gameplay default is
invented. All four accepted UNVERIFIED defaults remain labelled and unchanged.

**Closeout verification.** The full uncached workspace suite passes all six packages:
**258 passing files, one pending-only slice, 11,720 passed tests, 120 expected failures
and 193 TODOs**, zero cache hits. Nokia-os contributes 166 passing files, one pending-only
slice and 10,878 passing tests in 960.64 s; the other totals are phone-core 450, snake 62,
phone-3d 49, phone-screen 101 and website 180. `vp check --fix`, final `vp check` and
`website#build` pass. Formatting is stable after two `vp fmt` runs. Verification uses mise's
absolute Node 22 and `/private/tmp/plan24-run-node22.cjs`, `VITEST_MAX_WORKERS=2`,
`VP_RUN_CONCURRENCY_LIMIT=1`. An earlier full-suite attempt was stopped before completion
when the final pickup regression was added; only this final uncached run is accepted.
Logs: `/private/tmp/plan24-slice-{focused-final,workspace-tests,check-fix,check,build,audit-final,redraw,coverage}.log`.
Plan 24 remains **0 asserted, 168 pending, 0 registered known gaps**; the two inherited
Space impact fixtures remain pending in indices 14 and 16. Only this plan and the two
plan-24 decoder/test files change. No excluded package changes.

### Task 5a / engine foundation checkpoint (2026-10-29; incomplete)

The accepted 2026-10-29 refinement above is recorded. No general decoder work was done.
`space-impact-levels.ts` now registers two deterministic generated modules through the plan's
existing capture-set extension: the complete settled level-0 observation table and the opening
wave. The table retains 879 timeline rows / 856 unique settled images, with 855 decoded images,
398 ambiguous images and all 8,055 exact alternatives. Repeated object placements are interned
without dropping alternatives. `ala` remains an explicit unresolved observation, accepted only
when its boss rows still have the established mixed-redraw relationship to `akz`; corrupted
`ala` evidence fails. It is not yet a registered acceptance known gap. Task 5a remains incomplete
for the later spawn/HP/fire/boss reconstruction; Task 5b remains deferred.

The first pure runtime slice (`src/games/space-impact/{model,keys,engine}.ts`) implements queued
one-pixel moves, two-pixel repeats, observed level-0 bounds, gun-position shots, two-pixel shot
motion, two-tick cooldown, viewport retirement, shield expiry and alternation, pending-return
handling, scroll and the generated opening enemy wave. The painter handles the stock HUD,
sprite compositing, clipping, polarity and terrain resources, refusing unobserved terrain.
It remains unregistered until the gameplay/session slice is complete.

TDD first failed on the missing observation function, then missing engine/painter modules,
then opening-wave pixels. The focused gate passes **3 files, 188 tests**: 14 settled opening
frames and all 36 tick stills in 12 independent tap-key fixtures match engine pixels exactly;
the painter separately reproduces all 8,055 retained observation alternatives. This last check
does not drive the engine and is not acceptance. No seed is injected or recovered; no full-level
replay, collision, score, random fire, bonus, boss, death, Continue, sound or Games integration
is claimed. Tasks 6–14 keep their original completion boxes open.

**UNVERIFIED calls:** retain H2's five held-fire attempts including the initial press, and H16's
pending return consuming the next event. Synthetic tests establish these implementation
contracts only. The four previously accepted UNVERIFIED defaults remain labelled and unchanged.
No comparator or tolerance changes. The observation table does not choose a candidate for the
engine or use pixels as runtime game state.

**Regeneration cost correction.** Re-solving every image during extraction made the first full
suite fail the existing 30-second resource freshness timeout (about 180 seconds per extraction).
That failed run was stopped. `scripts/space-impact-level-zero.ts` now holds the decoder's exact
alternatives as compact, typed capture declarations, emitted from the checked observation table.
This is the one additional plan-owned data input file needed by Task 5a. Regeneration validates
every retained alternative against every source pixel, using the stock sprites; it no longer
reruns a combinatorial solver. The original decoder stays unchanged. Source hash and freshness
checks, unread/corrupted image rejection, and the independent production-painter checks stay in
place. No resource test timeout, golden comparator or fidelity rule was changed.

**Task 11 plan/file discrepancy:** the task requires removing `8-2-1` from
`src/firmware/bindings.ts`'s `PLACEHOLDER_OWNERS`, but that file is absent at the supplied head.
The actual firmware placeholder is `features/games.ts`; the capture owner is
`scripts/tree-capture-set.ts`. Per AGENTS.md's stop-and-report rule, this checkpoint leaves
Games wiring and ownership unchanged rather than improvising the missing-file step. It also
leaves acceptance statuses untouched: **0 asserted, 168 pending, 0 registered known gaps**,
plus the two inherited pending Space impact fixtures in indices 14 and 16.

**Checkpoint closeout verification.** The final full uncached workspace run passes all six
packages with **260 passing files, one pending-only slice, 11,764 passed tests, 120 expected
failures and 193 TODOs**, zero cache hits. Nokia-os contributes 168 passing files, one
pending-only slice and 10,922 passed tests in 1006.13 seconds; the other totals are phone-core
450, snake 62, phone-3d 49, phone-screen 101 and website 180. The focused resource/engine/painter
check passes 4 files / 237 tests. `vp check --fix`, final `vp check`, and `website#build` pass
under mise Node 22 with the guard. The guard rejected a host-Node-26 attempt before tests ran;
the accepted full run uses mise's absolute Node 22, `VITEST_MAX_WORKERS=2` and
`VP_RUN_CONCURRENCY_LIMIT=1`. An earlier timeout failure and superseded pre-final-fix runs
are not accepted verification. The final source includes test-first Navi/C key-down-only
suspend handling. Generated outputs are up to date; excluded packages and the lockfile are
unchanged. This is one coherent partial engine/data/painter unit, not Task 5a or plan completion.

### Session and first replay mismatch checkpoint (2026-10-29; incomplete)

The parent Task 11 wiring decision is recorded below and implemented in `features/games.ts`:
`8-2-1` is a screen, its `GAME_LEVELS` entry adds Continue and routes Top score returns, and
`scripts/tree-capture-set.ts` no longer owns its placeholder. `features/space-impact.ts` owns
the session and its score settings; the single feature-index export satisfies the repository's
one-feature-per-file guard. No missing `bindings.ts` workaround or phone-core change was made.

**Full recording attempt.** A diagnostic drove all **631** committed level-0 input taps and
**831** engine steps through the recording's end. Before the fix, its first unmatched settled
image was `af` (frame 31, 2305 ms): a movement preceding a shot was absent from that shot's
redraw, and the shot originated on the old gun row. The engine now flushes ordered queued moves
before firing and clears them so the next tick does not move twice. Two regression tests fail
against the supplied engine and pass with the change; the painter compares `af` and the next
settled image `ag` pixel-exact against their committed frames.

The complete-recording diagnostic now matches its first **25 of 879 settled timeline rows**;
the next unmatched image is **`ah` (frame 33, 2534 ms, held 82 ms)**. The engine then puts the
ship one pixel above its capture. The source `keys.csv` includes zero-duration movement taps
(e.g. 2438.2 ms) and a 4 ms fire pulse (2840.3–2844.3 ms), all currently represented as ordinary
taps by `input:`. An exploratory duration filter moved the failure later but did not resolve
it; that filter was rejected and no input, capture, comparator or tolerance was changed. Do
not treat the source pulse durations as an established causal model or add an arbitrary tap
threshold. The diagnostic ran the entire input through the engine despite this first mismatch;
its final score remains 0 because collisions and scoring are still absent. This is neither
full-level acceptance nor seed recovery. Diagnostic source and output are retained locally as
`/private/tmp/p24-full-level-diagnostic.test.ts` and `/private/tmp/p24-full-level-diagnostic.log`.

**Session and exact passing slice.** The session takes `games.seed()` once into the game's
`randomState` (no random consumer is claimed), ticks at the generated first offset and period,
runs the shield one-shot and repeat timers, forwards key down/up and cues, suspends per game,
and keeps Continue's board still until a key. New game clears only Space impact's slot. The
painter is registered in the stock widget union; the accessibility description and its exhaustive
sample are updated. The session tests verify the board, timer start, release stopping repeats,
seed preservation, independent Snake state, New game and first-key delivery after Continue.

The tree acceptance replay first failed on an extra redraw when the shield expired. The timer
now changes the internal shield without drawing; the next tick or shot redraw reveals it. After
placeholder removal the importer exposes all **60** original tree frames instead of the former
40-frame placeholder cut. The later frames required one additional observed enemy entry:
`(tick 55, x 82, y 17)`, with its animation opposite the first group. Its generated declaration
is fitted from tree images `ao` and `ap` (ticks 57/58); no later group member is invented.
Continue's waiting board uses the separately captured `ship/shielded/2` picture. No general
decoder change was made.

The following **20 plan-24 fixtures** replay through the real phone's Games menu and are asserted:
the twelve `keys-tap-{8,0,star,hash,2,5,7,9,up,down,1,3}` still sets, plus `pause-nav`,
`pause-list`, `pause-c`, `pause-reenter`, `pause-from-standby`, `pause-continue`,
`pause-continue-navi` and `pause-top-score`. `tree/08-games/8-2-1.leaf` is asserted in index 14;
its 60 frames pass without a special comparator. The old inherited pending sound note for
`8-2-1` joins the existing equal silent `sound/note/5-6-1` group when the placeholder owner is
removed; the importer makes that shared generated change. No gameplay sound fixture is asserted. The required first shot program is now generated through
plan 24's resource extension from the first five buzzer edges in `sound/game/space-impact/level-0`:
440/466/494/523 Hz at volume 3, with captured edge times 0/34/73/112/150 ms. The initial real
Games binding exposed the absent program; a focused sounder regression fails with "No game sound"
before generation and passes afterward, including Warning tones Off and Games Sounds Off gating.
No death/special/bonus program, sound replay or timing exception is claimed. Task 12's partial
program extraction lives in the new plan-owned `scripts/space-impact-sounds.ts`, reusing
`sound-programs.ts`'s `programFromRows`, and registers `space-impact-sounds.ts` through
`resources.generatedModules`. This follows AGENTS.md's shared-output convention without adding
a Space-impact-specific case to the shared generator. Pixel scenarios use the normal clock seed
fallback; none injects Snake's recovered seed into a noninformative Space impact opening.
Plan 24 is **20 asserted, 148 pending, 0 registered known gaps**. The coverage guard requires
asserted New game and Continue scenarios. No `ala` gap has been registered.

**Calls and remaining limits.** The four accepted defaults remain explicitly UNVERIFIED.
Further provisional calls for this partial session are:

- **UNVERIFIED:** simultaneous session deadlines run shield, then game tick, then held-key
  repeats in insertion order. No recorded simultaneous edge establishes a different priority.
- **UNVERIFIED:** alerts and calls suspend to Continue like Navi, following the existing Snake
  convention; Space impact's interrupted-state ordering is not independently replayed here.
- **UNVERIFIED:** C suspends with New game selected using the existing top-row return. The
  `pause-c-during-play` capture's final image equals `pause-list/02` (New game on the middle row),
  contradicting its provisional note "like Navi" and Task 11's blanket `select: "continue"`.
  Navi's top-row Continue and C's New-game selection are observed; C's window placement remains
  pending. The current Flow/kernel return contract offers top/bottom, so no shared API or custom
  menu implementation was added just to manufacture its middle-row layout.

The full level-0 golden, moving/firing Continue traces, held-key/special traces, splash seed
variants, collision/bonus/RNG ordering, bosses, death/restart/game-over and sounds remain pending.
The fixed existing splash still plays; seeded splash generation is not implemented. Tasks 5a,
6–14 remain incomplete outside the slice above. Continue work at `ah`, preserving every raw key
and settled frame; do not claim this checkpoint completes level 0 or the game.

**Verification:** the focused pre-closeout run passes 8 files, **704 tests**, 4 expected failures
and 155 TODOs. This includes the actual plan-24 acceptance scenarios and complete tree/menu
slice, the engine/painter tests, the coverage guard, feature composition and accessibility.
The final focused wiring/sound check passes 4 files / 85 tests; the resource/engine/session/
acceptance check passes 8 files / 256 tests and 148 expected TODOs. An initial uncached run
found the old one-Continue path count; the next found the Games seam's one-game table and
positional assumption. Both runs were stopped, and their workers were cleaned up. The table
now keeps Snake first, then Space impact, with explicit tests for both entries and the added
Continue path. The broader non-acceptance-only attempt was superseded by the required final
uncached workspace run; only a fully completed final run counts. Final totals, check and build
are recorded at closeout below when complete.

**Checkpoint closeout verification.** The completed final `vp run -r --no-cache test` passes
all six packages with **262 passing files, 11,817 passed tests, 120 expected failures and
171 TODOs**, and **0/6 cache hits**. Nokia-os contributes **170 files / 10,975 passed tests**
in **973.22 s**; phone-core 450, snake 62, phone-3d 49, phone-screen 101 and website 180.
The final source uses mise's guarded Node 22 with `VITEST_MAX_WORKERS=2` and
`VP_RUN_CONCURRENCY_LIMIT=1`. `vp check --fix`, final `vp check` and `website#build` pass.
Logs: `/private/tmp/p24-full-suite-final.log`, `/private/tmp/p24-final-check.log`,
`/private/tmp/p24-build-final.log`. Earlier stopped runs are not accepted verification.
No excluded package, website file or lockfile changed. This is one coherent partial session,
Games wiring, shot and acceptance unit; the full level-0 golden remains pending at `ah`.

### Task 6 - Random numbers: seeds and the ANSI chain (TDD)

**Files:** `scripts/space-impact-seeds.ts` (new), `src/games/space-impact/random.ts` (new: which
events draw, in which order), `tests/space-impact-rng.test.ts` (new).

- [ ] TDD the draw order per tick (H14) on synthetic object lists: fire rolls in object order,
      explosion frames, bonus kinds; the bonus re-roll at 5 lives.
- [ ] `space-impact-seeds.ts` searches the 65,521 effective seeds for each golden's decoded random
      events and reports candidate count and the observations used. Classify datasets before
      accepting recovery: an informative seed-recovery dataset must reduce the effective seeds
      to exactly one. Its first draw and subsequent chain must match those of the clock-derived
      u32 seed, with the u32 seed's wrapping first step (D5). Keep the recovered effective seed
      distinct from the u32 clock seed; effective recovery alone cannot identify the original u32.
      Multiple candidates require more informative LCD observations; do not select an arbitrary
      candidate or weaken uniqueness.
      A noninformative trace (no draws, or insufficient observable random outcomes) may replay
      using a clock seed independently proved by informative datasets for that clock/date; record
      the proof dataset and unresolved candidate set in its note. If no such proof exists, seed
      acceptance stays blocked. If no candidate fits, stop and report the draw-order/model mismatch.
- [ ] Regression: the two identifiability traces through tick 52 have 53 identical LCD frames
      at distinct unchanged seeds. Both replay exactly without claiming unique recovery; a
      deliberately ambiguous informative dataset fails recovery, and a uniquely identifying
      dataset succeeds. Validate the clock function against every Snake II seed golden before
      replacing its fallback, regardless of success on Space impact. A passing noninformative
      replay is no evidence for that replacement.
- [ ] The ANSI generator (D6): the Task 0 S8 formula reproduces every random-row spawn of every
      golden with the chain position its note gives.
- [ ] Commit: `feat(nokia-os): Space impact random numbers reproduced from captured games`.

### Task 7 - Engine I: ship, keys, shots, terrain and scoring (TDD)

**Files:** `src/games/space-impact/{model,engine,keys}.ts` (new),
`tests/space-impact-engine.test.ts` (new).

- [ ] `model.ts`: the state (ship, shield, lives, specials, score, objects, scroll, level, phase,
      pending code, fire cooldown, repeat counts, continues) and the render model (HUD values,
      sprites with positions and polarity, terrain offset); pure, no time.
- [ ] TDD H2, H3, H4, H7 (ship and terrain), H8, H16, H17 with synthetic states: every key and its
      repeat, bounds, the shot's spawn and speed, the cooldown, the repeat-fire cap, scrolling and
      wrapping terrain, the terrain collision, the shield push, the score cap, the pending code
      eating a tick.
- [ ] `step()` and `key()` return `{ state, cues, events }` (cues per D13).
- [ ] Commit: `feat(nokia-os): Space impact engine: ship, keys, shots and terrain`.

### Task 8 - Engine II: waves, patterns, fire, bonuses and specials (TDD)

**Files:** `src/games/space-impact/{engine,objects,patterns}.ts`, `tests/space-impact-engine.test.ts`,
`tests/support/game.ts` (Space impact replay helpers).

- [ ] TDD H5, H6, H7 (objects), H9, H10, H14 with synthetic states from Task 5's data.
- [ ] Trace test: for every level golden of levels 0-3 and the variety goldens there, drive the
      engine from the uniquely recovered or independently proved clock seed (Task 6), the ANSI
      position and `input` (one step per tick) and compare
      the decoded state of every tick still (HUD, ship, objects, terrain).
- [ ] Commit: `feat(nokia-os): Space impact waves, enemy fire, bonuses and specials`.

### Task 9 - Engine III: bosses, deaths, continues and the end (TDD)

**Files:** `src/games/space-impact/{engine,bosses}.ts`, `tests/space-impact-engine.test.ts`.

- [ ] TDD H11, H12, H13: the boss per level, the explosion and respawn, the continue screen and its
      keys, the level restart, the level exit, the final boss and its parts, the end after level 7.
- [ ] Trace test over every gameplay golden (all levels, `nokeys`, `keys-*`, `seed-*`, `ansi-*`).
- [ ] Commit: `feat(nokia-os): Space impact bosses, continues and the end of the game`.

### Task 10 - Space impact painter (TDD against goldens)

**Files:** `src/display/widgets/space-impact.ts` (new), `src/display/widgets/index.ts` (one model
line), `tests/paint-space-impact.test.ts` (new).

- [ ] TDD: painting the engine's render model equals every tick still of every gameplay golden
      (engine driven by seed, ANSI position and `input`), the continue screen and the level exits;
      both polarities; the HUD at every value the goldens show.
- [ ] Commit: `feat(nokia-os): paint Space impact from the stock sprites`.

### Parent decision (2026-10-29): Task 11 wiring

`src/firmware/bindings.ts` does not exist. Extend `src/firmware/features/games.ts`, which
owns Games placeholders, replacing Space impact's placeholder with its `screens` binding.
This follows AGENTS.md's Firmware convention. The capture-side ownership line lives in
`scripts/tree-capture-set.ts` and is removed when its real tree scenario passes. This
supersedes the earlier checkpoint's stop on the missing bindings file.

### Task 11 - The Space impact feature: session, splash, suspend and game over (TDD)

**Files:** `src/firmware/features/space-impact.ts` (new), the features index and `GAME_LEVELS`
(one line each), `src/firmware/features/games.ts` (replace `8-2-1` in `placeholders` with `screens`),
`scripts/tree-capture-set.ts` (`PLACEHOLDER_OWNERS`: one line removed), `src/widgets/splash.ts` (a generated-frame splash), `tests/space-impact-game.test.ts`
(new).

- [ ] TDD the session: New game seeds from `games.seed()` (D5); ticks at the captured period after
      the first-tick offset; the one-shot shield; key-down and release with repeats (D9); every
      event fed to the engine in order (D8); the continue screen's period; the level exit's steps.
- [ ] Game over (H22): the engine's end → `gameOver({ kind: "top-score" | "score" })`, writing a
      beaten `games/space-impact/top-score`; the menu returns on New game, top row.
- [ ] Suspend (H21, D10): Navi or C stores the state in the holder and exits with
      `select: "continue"`; Continue waits for a key, delivers it, resumes with the 1500 ms shield;
      New game discards the suspended game.
- [ ] The splash (H18): its stars drawn from `games.seed()` at Select over the captured pictures;
      plan 14's `probe/games-splash-8-2` and `tree/08-games/8-2.sub` goldens pass at 10:10 and the
      S1 goldens at their clocks.
- [ ] Remove `8-2-1` from `PLACEHOLDER_OWNERS`; the widget tests replay `nokeys` (to the menu), the
      pause goldens and `tree/08-games/8-2-1.leaf`.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp run website#build`.
- [ ] Commit: `feat(nokia-os): playable Space impact with game over, top score and Continue`.

### Task 12 - Sounds and vibration (TDD against sound goldens)

**Files:** `scripts/sound-programs.ts` (one table entry per sound), `src/resources/generated/sounds.ts`
(generated), the feature module, `tests/sound-games.test.ts`.

- [ ] Programs `space-impact/{shot,death,special,beam,bonus}` from the S9 goldens (D13); the
      fireworks tune reuses `top-score`.
- [ ] TDD: every `sound/game/space-impact/*` golden replays (edges ±2 ms after alignment, or the
      game tolerance with a reason); Sounds Off and Shakes Off silence theirs; the vibrator at
      deaths and boss kills (H20).
- [ ] Commit: `feat(nokia-os): play Space impact's sounds and vibration`.

### Task 13 - Acceptance and the coverage guard

**Files:** `tests/acceptance/24-space-impact.test.ts` (new), `tests/support/game.ts`,
`tests/support/acceptance.ts` (one slice line).

- [ ] Scenarios for every `game/space-impact/*` golden: navigate as the capture did, replay the
      ANSI history the note names, press and release `input` on their ticks, compare pixels exactly
      and timing per D7; tick stills after each listed tick; `tree/08-games/8-2-1.leaf` with the
      game tolerance.
- [ ] Coverage guard: Space impact's Continue is covered by an asserted `pause-*` golden; 8-2-1 by
      asserted goldens; no new `KNOWN_GAPS` without a reason.
- [ ] Report the slice's run time; long replays use `it.concurrent` or thinner stills if the suite
      grows past ≈30 s (Deviation).
- [ ] Commit: `test(nokia-os): drive Space impact against its goldens`.

### Task 14 - Demo, README, verification gate and closeout

**Files:** `packages/nokia-os/{README.md,demo/main.ts}`, `docs/specs/stock/space-impact.md`,
`docs/plans/README.md`, this plan.

- [ ] Demo: digits, `*` and `#` reach the game; verify with `mise exec -- vp run
@hellotimber/nokia-os#demo` and `agent-browser` (headless: drive via the `[role=status]` line,
      Skip boot): Games › Space impact, New game, fire, move, Navi, Continue, die to game over, Top
      score.
- [ ] README: the engine (D2), level reconstruction (D3, D4), seeds (D5, D6), the seams (D10-D14).
- [ ] `mise exec -- vp check --fix`, `vp run -r test`, `vp run website#build`;
      `git diff --stat <commit before Task 1> -- website/ packages/snake/ packages/phone-core/`
      is empty.
- [ ] Spec: replace "(plan 24, in progress)" with verified facts; list what stays UNVERIFIED.
- [ ] Plans README: row 24 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete Space impact (plan 24)`.

## Plans 24b and 24c

Both are written as their own files when scheduled, in this plan's format, and depend on plan 24
Tasks 1-3 only (the seams, the generic capture pipeline). Their planning evidence is in
`$REF/captures/scratch-plan24/bantumi/` and `pairs2/` (paths below are relative to those).

### 24b - Games III: Bantumi (8-3)

**Findings.**

- **No randomness.** Four level-1 games (two boots, two games each, one with 777 ms more before
  every move) were identical. The RE notes' search (depth-limited negamax with alpha-beta, 100
  iterations per tick, a first-move heuristic, the computer's capture quirk that reads the live
  board and credits pit 6) predicts every computer move: the opening reply after pit 0 picks pits
  9, 9, 12, 9, 12 in 1, 2, 14, 94 and 242 ticks at levels 1-5 (120, 240, 1740, 11801, 30303 ms),
  and all 23 searches of a level-5 game match (`out-b`, `out-e`).
- **Ticks are not one period.** Sowing 116.25 ms (15 units), the intro 118-120 ms, a search tick
  ≈125 ms (think time ≈125 × ticks − 8 ms, within 75 ms): the search's CPU time delays the re-armed
  timer. The first player turn runs at period 0 (a first-turn hint took 20 ticks in 1.04 s).
- **Virgin level 1** (the record byte is 0; the RE notes' level 5 came from a used PMM). The Level
  page has 5 bars: ▲/▼ clamp at 5 and 1, OK stores with no note and returns on Level, C discards, a
  held key repeats (≈776 ms, then ≈481 ms). The menu is New game / Level / Instructions (no Top
  score, no Score IDs); the crawl's `..……` New game note is OCR of the board's dotted line.
- **Keys:** 6 and ▲ move the cursor right, 4 and ▼ left (clamped 0..5); 5 and 0 sow on key-down;
  `*` hints at level 1 only; others ignored; keys during animation or thinking are dropped.
- **Animation:** a seed takes 8 ticks (wait 2, move 3, arrive 2, act 1), a pick-up 6; captures make
  two more hand trips; the intro slides the box to x 40, 32, 24, 16, 8, then frames 2, 1, 0 every
  two ticks (the board 1457 ms after New game).
- **Endings:** win: the player's store flips every tick for 40 ticks, fireworks (≈3.2 s, tune 523
  Hz 114 ms then 784 Hz 434 ms, twice), `Game over!` / `YOU WON!`; draw: 4.8 s static, `Game
over!`; loss: the computer's store blinks (480 ms phases), `Game over!` / `You lost, sorry!`;
  each note ≈2.94 s; then the menu on New game. Navi or C during the countdown suspends; during
  the note they skip. No top score is written.
- **Continue** during thinking, sowing or the countdown stands until a key, which releases it and
  does nothing else (the shared Continue rule); a search resumes where it stopped.
- **Sound:** one cue per seed sown (1047 Hz ≈22 ms, 523 Hz ≈47 ms), none for captured seeds, no
  vibration. No 2-player mode (`1 player` under Shakes is a label oddity).

**Decisions to carry.** The search as a pure, iteration-counted engine (`src/games/bantumi/`), its
pick and tick count asserted against every recorded search; think time from the measured search
tick (`BANTUMI_SEARCH_TICK_MS`, from goldens), the first-turn period-0 rate measured; the endings
`won`/`draw`/`lost` (D11 resources from 24b's goldens); `levelPage({ max: 5 })` over
`games/bantumi/level` (virgin 1); the board, hand, digit and thinking sprites from goldens.

**Task 0 sections.** Menus and Level page; intro; key matrix (drops during animation and thinking,
empty pit); one sow per pit, an extra move, both capture kinds, the computer's capture; the opening
reply at each level with the thinking frames; full games at levels 1, 3 and 5 (LCD digits decoded
against the model); hints at the first turn, later, and at level 2; win/draw/loss reached by
recorded play (a search over the player's moves with `fork`, no pokes); pause in each state and
re-entry; sounds with Warning tones On and Off and Sounds Off.

**Task outline.** 0 captures → 1 docs (`docs/specs/stock/bantumi.md`) → 2 capture set
`scripts/capture-sets/24b-bantumi.ts` → 3 resources → 4 rules engine (sowing, captures, extra
moves, the end) → 5 search engine (iteration-exact) → 6 painter → 7 feature
(`src/firmware/features/bantumi.ts`: ticks, intro, think timing, endings, Continue, Level) → 8
sounds → 9 acceptance `tests/acceptance/24b-bantumi.test.ts` → 10 closeout.

### 24c - Games IV: Pairs II (8-4, Time trial and Puzzle)

**Findings.**

- **Boards from one seed per game.** The RE shuffle holds (pictures 0..n/2−1 twice, then each card
  i swapped with card `rand16 mod n`). Time trial's nine boards chain from 44530 at 10:10 with no
  draws between boards; Puzzle levels 1-7 at 10:10 each match 44530; at 19:48 both modes match 13689. A second New game, also from the pause menu, deals the same board (`out-e1`, `out-e2b`,
  `out-e3`; peek, cross-checked by a bot that made 116 correct pairs in a row).
- **Layouts:** Time trial cards at (12 + 7c, 1 + 9r), counts 4, 8, 14, 22, 24, 30, 40, 40, 50, times
  50-1600 ticks, all nine shapes decoded from the LCD; Puzzle grids per level 2x2 … 12x5 with their
  first-card positions. Virgin levels 1 for both modes.
- **Timing:** 25 units outside play; play periods 37, 33, 29, 25, 20, 16, 12 units for levels 1-7;
  the deal (largest distance + 1 ticks), the door (≈1936 ms), the 8-tick wipe, the fuse step
  (time / 25), between boards ≈1.75-2.1 s, the time-out explosion (375 + 232 ms).
- **Keys:** 4/6 step ±1 with wrap, 2/8 walk the column order, 5 opens and moves on as 6; a miss
  stays open until the next 5 or cursor key; no repeat; other keys ignored.
- **Scores:** +level+4 per pair, −1 per miss (not below 0), time bonus = time left / 2 between Time
  trial boards (none after board 8); a full level-1 Time trial scored 3443. New top score: the
  fireworks and `TOP SCORE:`; else `Your score:`; the menu then opens on New game.
- **Level page:** 7 bars, ▲ clamps at 7, ▼ at 1, OK stores per mode with no note, C discards.
- **Pause:** `Continue / New game / Level / Top score / Score IDs / Instructions` (six entries,
  numbered by position); Continue waits for a key, which reaches the game; Continue during the deal
  skips to play; a suspended game survives standby. **Cross-mode scope UNVERIFIED:**
  scratch probes show clearing across modes, but canonical S2 establishes independent Snake II/Space
  impact state only (D10). 24c must capture
  both mode orderings and distinguish menu-entry invalidation from shared storage.
  Re-entering Pairs II opens the mode list on the last mode used.
- **Sound:** pair found 740/1480/880 Hz (10/10/21 units), miss 523, 740, 494, 698, 466 (7 units
  each) and 659 (14); the fireworks tune; no vibration.

**Decisions to carry.** Boards dealt from `createGameRandom(games.seed())` (D5) with the shuffle as
H, verified by seed search over every recorded board's revealed pictures; layouts and board times
from goldens; two numeric top scores and two levels (`games/pairs-ii/{time-trial,puzzle}/{level,
top-score}`); the mode list's last-used opening (a new `opening()` from a stored choice); the
saloon, door, wipe, fuse, flame, explosion, card back, cursor, the 30 pictures and the removal
frames from goldens (the bot reveals all 30).

**Task 0 sections.** Menus, Level pages, Top score, Score IDs, Instructions (both modes); a full
Time trial game at level 1 driven by a bot that knows the board from the seed (no RAM reads); the
time-out at levels 1 and 7; play periods for levels 1-7; Puzzle deals at levels 1-7 and full games
at 1 and 7; the key matrix with a miss; pause and Continue in each phase (deal, door, wipe, play,
between boards, Puzzle's last removal); the mode list's opening; a second clock; sounds with
Warning tones On and Off; a game over without a new top score.

**Task outline.** 0 captures → 1 docs (`docs/specs/stock/pairs-ii.md`) → 2 capture set
`scripts/capture-sets/24c-pairs-ii.ts` → 3 resources (pictures, boards) → 4 engine (deal, shuffle,
cursor, opening, scoring, Time trial phases, Puzzle removal) with the seed search → 5 painter → 6
feature (`src/firmware/features/pairs-ii.ts`: two modes, mode list opening, Level pages, top
scores, Continue) → 7 sounds → 8 acceptance `tests/acceptance/24c-pairs-ii.test.ts` → 9 closeout.

## Follow-ups

- **24b, 24c:** as above, after Tasks 1-3.
- **Plan 25:** `Lights` during play for every game.
- **Plan 28:** reuse `levelPage`, `gameOver(ending)` and the suspend slot for SDK games; whichever
  plan lands second rebases (D14).
- **Snake II:** Task 2 replaces plan 23's seed fallback only after every Snake II seed golden passes
  D5's clock-fit proof. D10 requires independent Snake II and Space impact Continue entries.
- **Portfolio integration (not sequenced):** unchanged.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Split (D1):** Space impact plus the shared seams in 24; Bantumi 24b; Pairs II 24c. Reverse by
   folding 24b and 24c in as later tasks of this plan (same dependencies).
2. **Level data from captures (D3):** every value is fitted to goldens. A fire chance that the
   captures leave ambiguous takes the smallest consistent N, recorded as ambiguous; more variety
   runs resolve it. Reverse only by permitting values read from the flash image, which this
   project has ruled out.
3. **The look-ahead bot (D4):** hours of wall time in Task 0 for faithful frames. Reverse by
   accepting god-mode frames with the HUD masked, which weakens the HUD assertions.
4. **ANSI chain (D6):** reproduced phone-wide, so a second game in a power cycle differs from the
   first where the captures do. Reverse by resetting it per game (simpler; wrong for second games).
5. **Seed function (D5):** replaces Snake II's minutes-of-the-day fallback if Task 0's u32 fit
   reproduces every Snake II seed golden's LCD placements and every informative S7 dataset
   (including overflow). Noninformative replays do not prove the fit. Otherwise keep the fallback
   and inject independently established seeds for tests.
6. **Per-game suspension (D10):** canonical S2 selects independent state for Snake II and Space
   impact. Opening another game does not clear Continue. Pairs II cross-mode scope remains
   unresolved; do not extrapolate its scratch observation to all games.
7. **Splash stars (H18):** generated from the clock seed, so the title differs per clock as on the
   phone. Reverse by keeping plan 14's fixed 10:10 frames.
8. **Score IDs:** not reproduced (plan 23 Open question 4).
9. **Key latency (D7):** not reproduced; inputs by tick.

## Conflicts found while planning

- The RE notes say a key during Space impact's title starts a new game; the captures open the
  menu (plan 14 P12 holds).
- `docs/specs/nokia-3310.md` §7: "Space Impact: `2`/`8` move up/down, `5` fires (UNVERIFIED keys)";
  the firmware's Instructions and the captures say 8/0, `*`/`#`, 1/3 and 4/6 (Task 1 corrects it).
- Plan 14 committed Space impact's splash as fixed frames; its stars depend on the clock (H18).
- Plan 23 D10 and Task 10 keep a Snake-only slot (`games.snake`) and `SNAKE_LEVEL`; D10 replaces
  them. Plan 23 D4's seed fallback may be replaced (D5).
- The RE Bantumi notes give level 5 and no Continue freeze; the virgin image has level 1, and
  Continue waits for a key as in every game (24b).
- The RE Pairs II notes list five pause entries; the captures show six (Score IDs included) (24c).
- Plan 28 Task 7 also introduces `levelPage`; D14 coordinates.

## Done means

- New game plays Space impact from the virgin state through all eight levels, with every key,
  weapon, bonus, wave, boss, death, continue and ending checked against goldens (pixels exact; tick
  intervals within `GAME_TICK_TOLERANCE_MS`; other timings per D7).
- Random events of every recorded game are reproduced from one seed per game and the phone-wide
  ANSI chain; the splash's stars follow the clock.
- The top score is written and shown; Continue appears per the slot rule and resumes.
- Sounds and vibration match their sound goldens.
- The Games II seams (random, seed, slot, endings, level pages, game sounds, generic capture) carry
  Snake II unchanged and are ready for 24b and 24c.
- phone-core, the website and `packages/snake` are unchanged; `vp check`, `vp run -r test` and
  `vp run website#build` pass; the spec and the plans README match what shipped.
