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
**Status:** Task 0 partially attempted; incomplete. Documentation reconciled on 2026-10-14;
Tasks 1-6 remain unstarted. See the Task 0 evidence and outcome below.

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
hypotheses (H1-H22). A rule enters the engine only with a test that checks it against goldens. All
data is derived from goldens by committed generators: sprites, HUD glyphs, terrain tiles and
tilemaps, the per-level spawn scripts, movement paths, object templates (hit points, shots, fire
chance) and boss behaviour. The reconstruction (Task 5) tracks every object through the level
goldens and fits the RE notes' structures (spawn entry, pattern, template) to what it sees. A
value no golden shows is not guessed: it is reported, and Task 0 recaptures until every object
the game can spawn has been seen. Nothing from `$REF/extracted`, the flash image or the RE notes'
tables is committed.

**D4 - Every level is captured from unmodified play by a look-ahead bot (new).** Pokes break the
HUD (investigation item 9), so god mode is planning-only. Task 0's bot plays by tick: before each
tick it `fork`s, tries candidate inputs a few ticks ahead, `exit`s from the ones that lose a life
and replays the best for real. All candidate scoring, phase and level tracking, key release,
continue/stop decisions and recording boundaries come from LCD observations and their history.
RAM reads cross-check those observations only (Task 0 capture-driver proof). The recorded run
is a real game with real keys (`keys.csv` by tick) and its frames are pixel-faithful. One full run
plays levels 0-7 to the end of the game; variety
runs cover what one run misses (every bonus kind, the wall and the beam, a death and a continue in
each level, the repeat-fire cap).

**D5 - One game generator for every game, seeded at New game from the clock; Snake II's seed
fallback is replaced if Task 0's fit holds (new; revises plan 23 D4).** `game_rand16`
(`seed = (seed × 0x625f + 0x3623) mod 0xfff1`) moves from `src/games/snake/rng.ts` to
`src/games/random.ts` (Snake II keeps its placement helpers and imports the generator). The seed
state is the u32 the firmware writes at New game: its first step runs in 32-bit wrapping
arithmetic, later steps stay below 0xfff1. Task 0 S7 reads the u32 (peek) at New game for the
plan 23 C9 clocks and dates and fits `u32 = f(date, time)`. If one function reproduces the
complete LCD random-event sequences of every Snake II seed golden (including all C9 clocks/dates
and overflow cases) and this plan's informative S7 datasets,
`src/games/seed.ts` replaces plan 23's minutes-of-the-day fallback for all games. Otherwise the
fallback stays, as UNVERIFIED, and tests inject recovered seeds where identifiable. RAM peeks
are cross-checks, never the sole proof of the fit. Noninformative traces use a clock seed proved
independently by informative LCD datasets; they do not claim seed recovery (Task 6). Space impact
draws for enemy fire, bonus kinds and explosion frames from one chain per game (no reseed between
levels or on Continue; investigation item 5). The splash draws its 30 stars from the same clock
seed (H18).

**D6 - The ANSI `rand` is a phone-wide generator (new).** Random spawn rows (`y = 0x3f`) draw from
a second generator whose state survives games and is set only at power-on (investigation item 6).
Its formula and boot value are fitted in Task 0 S8 (peek series) and accepted only if they
reproduce every random-row spawn in the goldens. It lives in the shared games holder (D10), is
reset at power-on and advanced by Space impact's random rows and by whatever else S8 shows
(Space impact's game over steps it once). Goldens that depend on it record the chain's position
in their note (the games played since power-on), and their rigs replay that history.

**D7 - Timing: periods from goldens, per-interval tolerance, no latency model (plan 23 D6).** The
session ticks the engine at `SPACE_IMPACT_TICK_MS` (Task 0: ≈93 ms), the first tick
`SPACE_IMPACT_FIRST_TICK_MS` after the New game frame, the one-shot (shield) after
`SPACE_IMPACT_SHIELD_MS` (≈1500 ms after a resume, H1), the continue screen's steps at the
captured `05` hold and step period, and the level exit's steps as captured. Tick intervals are
compared within `GAME_TICK_TOLERANCE_MS` (16 ms), never cumulatively. Key-to-game latency is not
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
  readonly ansi: AnsiRandom; // phone-wide (D6)
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

### Task 0 - Canonical REF captures (no repository changes)

**Files (all under `$REF`, gitignored):** `captures/scripts/gen_v639_plan24.py`,
`captures/scripts/v639-plan24-<section>.cap`, `captures/6.39/plan24/**`, a new section in
`captures/README.md`. Repair the existing plan24 generator in place. Preserve existing captures
and audit interrupted artifacts before rerunning their sections; write repair probes to new
plan24 evidence directories. Do not modify other plans' scripts/captures or `scratch-plan24/`.

- [ ] Read `$REF/captures/README.md`, `captures/scripts/gen_v639_plan23.py` (its `Drive`, `Bot`,
      seed search and section runner are the model) and the scratch scripts in
      `captures/scratch-plan24/space-impact/` (`si.py` has a tick-locked driver, `Sync`, and a
      RAM tracer).
- [ ] Repair and complete `gen_v639_plan24.py` with subcommands `run` (`-j 2` workers,
      `--only <section>`), `bot`, `ocr`, `check`, `seeds` and `list`. Every section starts with `include v639-setup.inc`,
      `key c`, `run 2s` (clock 10:10 unless S7), records audio around every gameplay recording,
      and writes `keys.csv` (`tick,key,press_ms,release_ms`, tick = the last tick frame before the
      edge). Keys in recordings are raw edges placed by tick (investigation item 4). Navigation:
      Menu, ▼×7, Select (Games), ▼, Select (splash), Navi (skip), `idle`.
- [ ] **S1 splash:** no key, at 10:10, 19:48, 07:59 and 23:59 (a record each, through the menu);
      Navi, C, 1 and ▼ at 300 ms (records). Peek the seed after the splash (planning).
- [ ] **S2 pause and the suspend slot:** Navi during play (record), ▼ through the pause list
      (shots), C (shot), re-entry from standby (record: splash, then Continue), Continue (record
      4 s: the board stands), then each of 8, 1 and Navi as the first key (records: is the key
      delivered?), Top score and New game while suspended. **The slot:** suspend Space impact,
      then (a) open Snake II's menu, (b) start and suspend a Snake II game, (c) open Pairs II's
      mode list, (d) go to standby and back; after each, shot Space impact's menu (Continue?) and
      Snake II's. Repeat with Snake II suspended first; include Bantumi menu visits. Confirm
      simultaneous Continue and independent resumed boards per D10; preserve Pairs II cross-mode
      uncertainty for 24c.
- [ ] **S3 no keys:** a virgin game with no keys to the menu after game over (≈45 s), audio.
- [ ] **S4 keys:** tick-locked, each key tapped on tick 40 (after the shield) and held for 20 ticks:
      0-9, `*`, `#`, ▲, ▼; two direction keys between ticks; 1 held 40 ticks (the repeat-fire cap);
      4 and 6 until the specials run out. On the continue screen (from S3's state by `fork`): 1, 3,
      4, 6, 5, 8, Navi, C at `03`.
- [ ] **S5 the full run:** the look-ahead bot of D4 (`bot`): fork per tick, candidate inputs
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
- [ ] **Capture-driver proof before S5:** replay stored LCD sequences for play, death, continue,
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
- [ ] **Canonical-level gate:** before any imports, resource generation, level reconstruction or
      engine implementation, finish and validate S5's complete unmodified levels 0-7, exits and
      final ending, plus the required S6 variety evidence. Each cut has LCD-derived boundaries,
      continuous tick/key/audio provenance and a replayable command stream; adjacent cuts chain
      without gaps. Scratch progress and interrupted streams are not complete level captures.
      `check` must fail when a level, exit, ending, required variety observation or control proof
      is missing. Report actual elapsed time, evaluation counts and coverage at interruptions;
      keep Task 0 incomplete until every required section passes.
- [ ] **S6 variety:** four bot runs from S5's level starts (`fork` at each level's first frame in
      the S5 process, so later levels need no replay): `bonus` (take every orb: all four kinds,
      the life re-roll at 5 lives if reachable), `specials` (use the wall and the beam on enemies
      and a boss), `deaths` (lose every life in levels 0 and 3, take the continue with 1, refuse
      the last one), `cap` (hold fire through a wave). Each logs which objects it has seen; extend
      the runs until every object type the levels spawn has been seen killed and, where it fires,
      firing.
- [ ] **S7 seed:** reboot with the clock at 10:10, 19:48, 07:59, 23:59, 00:00 and 10:10 on
      14.10.2026 (`setup_lines` of plan 23); a no-key game to the first random event the LCD
      shows (enemy fire in level 0 after ≈41 s, or the 64 s bonus orb). Peek `0x10da5c` (u32)
      after New game at each, and at the plan 23 C9 clocks (12:00, 00:01, 10:11) for the fit.
      A first random event is only a starting point: extend recorded unmodified play until each
      designated seed-recovery dataset uniquely identifies its effective seed. Track no-draw and
      ambiguous traces separately with independent clock proof references (Task 6). The clock/date
      fit is not accepted until every existing Snake II seed golden is reproduced from the LCD.
- [ ] **S8 ANSI chain:** peek `0x111bf0` at power-on, then after each of: a Space impact game over,
      a Snake II game over, a Pairs II game, a Bantumi game, the Games › Settings pages, a level-1
      random-row spawn. Two Space impact games in one power cycle through level 1 (S5's keys
      replayed), recorded: do their random-row spawns differ as the chain predicts?
- [ ] **S9 sound:** Tones › Warning tones On (plan 23 `c10_warning`): replay S5/S6 keys around a shot,
      a death, a missile, a wall, a beam, each bonus kind, a boss kill and game over, with audio;
      then Games › Settings › Sounds Off and Shakes Off, a death each. Vibrating alert as the
      profile has it (plan 16's rule).
- [ ] **S10 after:** Top score after a beaten and a not-beaten game (records), Score IDs pages; Navi,
      C and ▼ at 1.5 s and 4 s into the fireworks and into `Your score:` (records).
- [ ] OCR every new image into `plan24/text.json` (plan 14 format). `check`: every recording starts
      on its parent screen; every gameplay recording has `keys.csv` and audio; S5's level files
      chain (each level's first frame follows the previous exit).
- [ ] Append "Plan 24 supplementary captures" to `$REF/captures/README.md`.
- [ ] No commit. Record the outcome under this task: H1-H22 confirmed or corrected, the D10 slot
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

### Task 1 - Contracts and documentation

**Files:** `docs/specs/stock/space-impact.md` (new), `docs/specs/stock/snake.md` (the seed and
Continue corrections, if the refactor created it; else the Snake II section of
`docs/specs/nokia-3310.md`), `docs/plans/README.md`, this plan.

- [ ] Apply Task 0's outcome to D4-D13 and H1-H22 (`Deviation:` lines where it changes them).
- [ ] `docs/specs/stock/space-impact.md`: entry, keys, the rules as verified, levels, pause and
      Continue, scoring, game over, sound, artefacts; everything not yet asserted marked
      "(plan 24, in progress)". Correct spec §7's "Space Impact: `2`/`8` move up/down, `5` fires".
- [ ] The shared facts: the seed (D5), the suspend slot (D10), Continue's key, the timer-unit rule.
- [ ] Plans README: row 24 `in progress`.
- [ ] No runtime code. `mise exec -- vp check --fix`.
- [ ] Commit: `docs: define Space impact gameplay and the shared game facts (plan 24)`.

### Task 2 - Games II seams, with Snake II migrated (TDD)

**Files:** `src/games/random.ts` (new, from `src/games/snake/rng.ts`), `src/games/seed.ts` (new,
from `src/games/snake/seed.ts`), `src/games/snake/{rng,engine}.ts`, the shared games holder and
`GAME_LEVELS` (in the refactor's shared games feature module; before the refactor:
`src/widgets/snake.ts` and `src/firmware/{menu,leaves,bindings,phone}.ts`), Snake II's feature
module, `src/widgets/game-over.ts`, `src/widgets/level-bar.ts`, `src/firmware/cues.ts`,
`src/sound/sounder.ts`, `src/firmware/bindings.ts` (`VIRGIN_NUMBERS`, `RESTORE_KEEPS`), tests
`tests/game-random.test.ts` (new), `tests/game-seams.test.ts` (new), `tests/snake-rng.test.ts`,
`tests/settings.test.ts`, `tests/sounder.test.ts`.

- [ ] TDD `random.ts`: Snake II's generator unchanged for seeds below 0xfff1; a u32 seed's first
      step in 32-bit arithmetic (the investigation's two u32s give 44530's and 13689's first
      draws); `snake-rng.test.ts`'s recovered seeds still reproduce every placement.
- [ ] TDD `seed.ts`: the Task 0 fit (D5) against every informative S7 dataset and every Snake II
      seed golden (all placements and C9 clocks/dates, including overflow), or the fallback with
      the evidence in the test names. Snake II's New game uses it.
- [ ] TDD the holder (D10, the rule Task 0 S2 chose): suspend and Continue for a fake game id; per-game
      isolation in both Snake II/Space impact suspend orderings; captured clearing rules; power-off
      clears all suspended states; `GAME_LEVELS` gives each listed level its Continue
      entry (`shown`, `opening()`, positional numbers), Top score and Level returns. Snake II's
      goldens and `snake-game.test.ts` pass unchanged; add scenarios for independent suspension.
- [ ] TDD `gameOver(ending)` (D11): `score` and `top-score` reproduce Snake II's game-over goldens;
      `won`/`draw`/`lost` throw "resource missing (plan 24b)" until 24b adds them.
- [ ] TDD `levelPage` (D14): Snake II's Level goldens pass with `max: 9`; a `max: 5` page clamps at
      1 and 5 (synthetic bars).
- [ ] TDD the `game-sound` cue (D13): gated like `eat`; a second sound cancels the first; an
      unknown id throws.
- [ ] `VIRGIN_NUMBERS`: Space impact's and Pairs II's top scores (45, 0, 0) from their notes;
      `RESTORE_KEEPS` adds them.
- [ ] Remove `src/games/snake/seed.ts` and the generator from `rng.ts` (no re-exports; plan 23's
      callers import the new modules).
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp run website#build`,
      `vp check --fix`.
- [ ] Commit: `feat(nokia-os): shared game random, suspend slot, endings and level pages`.

### Task 3 - Golden pipeline: releases, generic game capture and the capture set (TDD)

**Files:** `scripts/golden-format.ts`, `scripts/game-capture.ts` (new),
`scripts/game-capture-set.ts`, `scripts/capture-sets/24-space-impact.ts` (new),
`scripts/capture-sets/index.ts` (one line), `scripts/tree-capture-set.ts` (one `ASSERTED_EARLY`
entry), `tests/golden-format.test.ts`,
`tests/game-capture.test.ts` (new), `tests/goldens-integrity.test.ts`, `goldens/game/space-impact/**`,
`goldens/sound/game/space-impact/**`, `goldens/index/24.json`.

- [ ] TDD `input` releases (order, a release only after its press, round trip); existing goldens
      parse unchanged.
- [ ] Split the generic machinery into `game-capture.ts` (frame predicate, period, selection rule);
      Snake II's goldens re-import byte-identical.
- [ ] TDD Space impact's frame predicate (HUD rows and the play field), tick numbering at the
      12-unit period, the level cut at the exit frame, and the level-still selection (spawn,
      death, fire, picture change, every 16th, last 12) on synthetic recordings.
- [ ] The capture set (table above), its `notImported` reasons (S2's slot probes after Task 2
      encodes them, `scratch-plan24/`, peek logs), and the sound goldens through plan 16's
      sound capture machinery. `tree/08-games/8-2-1.leaf` becomes asserted through plan 23's
      `ASSERTED_EARLY` table (`scripts/tree-capture-set.ts`, one entry; its index entry stays in
      `goldens/index/14.json`), and the acceptance slice lists it as a todo until Task 13.
- [ ] Integrity: `game/space-impact/*` timelines have a numeric `trigger-frame`; tick stills are
      ascending `t<tick>`; every `input` tick exists in its golden.
- [ ] Before importing anything, require Task 0's canonical-level gate and control proof to pass.
      Run the importer twice; no diff. Record counts and bytes (D3 budget guide).
- [ ] Commit: `feat(nokia-os): import Space impact gameplay captures as goldens`.

### Task 4 - Space impact resources from goldens (TDD)

**Files:** `scripts/space-impact-resources.ts` (new), shared resource registration (one line
through the pipeline delivered by plan 29),
`src/resources/generated/space-impact.ts` (generated), `src/resources/index.ts` (one export
block), `tests/space-impact-resources.test.ts` (new).

- [ ] Confirm Task 0's canonical-level gate and plan 29's verified registration repair before
      generating resources. Inspect the landed registration contract; use one owned registration
      line without redesigning shared extraction here.
- [ ] Crop table (golden, image, rectangle, sprite id) for the ship, shield, shot, missile, wall
      frames, beam, explosion frames, every enemy and boss frame, bonus orbs, enemy bullets and boss
      projectiles, the HUD heart, special icons (missile, wall, beam), HUD digits, continue-screen
      icons and digits, and the splash's pictures (logo halves, ship pictures, the fill). Each in
      both polarities where the levels show both. Missing pictures fail the task (recapture with a
      targeted S6 run, Deviation).
- [ ] Terrain: from each level's tick stills, the 32x8 tiles and the 2x16 tilemap (ground or
      ceiling), checked by re-rendering every terrain row of every still at its scroll position.
- [ ] Timing: `SPACE_IMPACT_TICK_MS`, `…_FIRST_TICK_MS`, `…_SHIELD_MS` (new game, respawn,
      resume), `…_REPEAT_MS`, the continue screen's hold and step, the respawn delay, the level
      exit's step times, from the timelines (medians).
- [ ] TDD: freshness (in-process extraction equals the committed file); every sprite inside its
      golden's ink; tilemaps reproduce every still's terrain; the timer-unit rule (H1) holds for
      every period as a cross-check.
- [ ] Run `extract-resources` twice; no diff.
- [ ] Commit: `feat(nokia-os): derive Space impact sprites, terrain and timings from goldens`.

### Task 5 - Level reconstruction (TDD)

**Files:** `scripts/space-impact-levels.ts` (new: the object tracker and the fitter),
`src/resources/generated/space-impact-levels.ts` (generated), `src/resources/index.ts` (one export
block), `tests/support/space-impact-decode.ts` (new), `tests/space-impact-levels.test.ts` (new).

- [ ] Confirm the canonical-level gate and the verified plan 29 pipeline before reconstruction.
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

### Task 11 - The Space impact feature: session, splash, suspend and game over (TDD)

**Files:** `src/firmware/features/space-impact.ts` (new), the features index and `GAME_LEVELS`
(one line each), `src/firmware/bindings.ts` (`PLACEHOLDER_OWNERS`: one line removed), `src/widgets/splash.ts` (a generated-frame splash), `tests/space-impact-game.test.ts`
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
