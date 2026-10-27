# Space impact (plan 24, in progress)

**Capture gate closed (Lachlan, 2026-10-27).** Task 0's accepted scope is the eight validated
full-level recordings, their exits and ending, plus the reviewed key, pause, bonus, special,
seed, ANSI and sound evidence. No plan 24 gameplay golden has yet passed an implementation
replay. Gameplay observations below remain **(plan 24, in progress)** until that replay passes.
The four accepted defaults are labelled `UNVERIFIED` beside the affected behavior; acceptance
of them does not establish fidelity for branches the recordings never exercise. The exploratory
census is not a coverage gate.

Part of the stock firmware's ground truth ([index](../nokia-3310.md#10-firmware-ground-truth-v639-captures)): the goldens under `packages/nokia-os/goldens/` are authoritative; where this file and a golden disagree, fix this file.

Source: the plan 24 Task 0 captures (`captures/6.39/plan24/`, generator
`captures/scripts/gen_v639_plan24.py`). The draft records LCD, audio and vibrator observations;
timing comparisons follow AGENTS.md's fidelity standard. RAM observations are marked (peek) and do not replace LCD replay proof.
Statements marked "(plan 24, in progress)" are not yet asserted by a golden and its replay. The
RE notes (`games_applications_3310.md`) are cross-checks only.

**Entry and splash.** Select on Space impact plays the splash: a black fill with 30 one-pixel
stars, the logo halves and two ships (frames at 91, 303, 490, 692, 893, 1095, 1310, 1496 and
1692 ms after Select, the last held ≈895 ms), then the game menu at 2587 ms with New game on the
top row. The stars are `(draw mod 84, draw mod 48)` for 30 pairs of draws from the clock's game
seed (below); the pictures cover some of them, so the title differs per clock (S1 at 07:59,
10:10, 19:48 and 23:59). Any key during the splash (Navi, C, 1, ▼) opens the menu ≈90 ms later.

**Screen.** HUD on rows 0-4 above the play field (rows 6-47): hearts (lives, 5x4 each, at x 0, 6,
12, …), the special weapon's icon at x 36 and its 2-digit count at x 43/47, and a 5-digit score
at x 57/61/65/69/73 (3x5 digits). Under the ceiling terrain of levels 4 and 5 the HUD moves to
rows 43-47 and the play field to rows 0-41, and sprites draw over the HUD. Levels 0, 4 and 5 draw
on a full black fill with everything white; the others on white. The ship is 10x7 and starts at
(5, 20).

**Ticks.** The game steps every ≈93 ms (12 timer units of ≈7.745 ms; median interval 93 ms,
redraw jitter 69-120 ms in pairs). The New game frame comes ≈66 ms after Select and the first
tick 173 ms after it.

**Keys.** Keys act on key-down. 8 moves up and 0 down, `*` back and `#` forward: 1 px on the
press, then, held, 2 px per tick. The ship stays within x 2..46 and y 7..41 under a top HUD. 1 and
3 fire a shot (drawn at the key; a held 1 or 3 fires again while held). 4 and 6 fire the special
weapon (count 3 → 2 → 1 → 0; nothing at 0). 2, 5, 7, 9, ▲ and ▼ do nothing. Two moves between
ticks both apply (8, 8: 2 px; 8, 0: none). Navi or C suspend (below).

**Lives and deaths.** Three lives. A death removes the ship (explosion frames for ≈477 ms) and the
vibrator runs ≈480-513 ms; then a heart goes and the ship reappears at (5, 20). In the no-key
game the deaths come at 8.7, 15.5 and 27.7 s.

**Continue screen and game over.** After the last life: the continues left as `o` icons
(three) and a countdown `05` held 1547 ms, then one step every ≈774 ms (100 timer units) to
`00`, held ≈870 ms. 1 restarts the level (a frame ≈113 ms after the key); 5 is ignored. Then, a
beaten top score: 12 fireworks frames ≈220 ms apart (≈2.24 s) and `Game over!` / `TOP SCORE:` /
the score for ≈2.94 s; else `Game over!` / `Your score:` / the score for ≈2.95 s (≈810 ms after
`00`). The game menu follows with New game on the top row. The Top score page then shows the new
score (70 after the no-key game, beating the virgin 45).

**Suspend and Continue.** Navi or C during play opens `Continue / New game / Top score / Score
IDs / Instructions` (`8-2-1`..`8-2-5`) ≈70 ms after the key, Continue on the top row. C there goes
to the Games list; Space impact then plays its splash and opens on Continue. Continue redraws the
board ≈80 ms after Select; it stands until a key, which reaches the game (1 fires at once), and
the ticks restart ≈140 ms after that key. Snake II and Space impact keep their suspended games
independently (both show Continue, in either order of suspending, after visiting the other game,
Bantumi, Pairs II's mode list or standby). Whether Pairs II's two modes share one state is plan
24c's question.

**Random numbers (plan 24, in progress).** New game writes a u32 game seed from the clock (peek
`0x10da5c`); the game draws from `seed = (seed × 0x625f + 0x3623) mod 0xfff1`, the first step in
32-bit wrapping arithmetic, one chain per game (no reseed between levels or at Continue). The
splash takes 60 draws from its own clock seed. Exhaustive LCD star searches identify effective
splash seeds 36670 (07:59), 44530 (10:10), 13689 (19:48), 38909 (23:59), 8013 (00:00) and
10048 (10:10 on 14.10.2026). They do not establish a later New-game seed: at midnight, different
menu histories change it while the displayed minute stays the same.

**UNVERIFIED accepted seed default:** `gameSeed` retains the existing minutes-of-the-day
fallback (0 without a clock). The clock/date-only fit is rejected. Tests may inject a gameplay
seed only when an informative LCD trace uniquely recovers it. No-draw or ambiguous traces are
noninformative; splash or RAM seeds cannot be presented as recovered gameplay seeds. Candidate
u32s reproducing all nine Snake II seed sequences prove generator equivalence, not the clock
function. Evidence: `analysis/seed-stars-background-verified.json`,
`analysis/midnight-resolution.json`, `analysis/snake-seed-lcd-verification.json` under plan24.

**Phone-wide ANSI chain (plan 24, in progress).** The fitted generator starts at `0x7fffffff`,
steps `state = (state × 1103515245 + 12345) mod 2^32`, and returns `(state >>> 16) & 32767`.
All twelve captured level-1 random rows fit `min(27, 6 + (rand15 & 31))`: 27,27,12,27,15,8 at
positions 1–6, then 27,6,27,19,27,27 at positions 8–13. Bounds for other waves remain
UNVERIFIED until fitted. Space impact's new-top-score ending consumes one draw; ordinary and
tied-score endings consume none. The chain survives New game and resets at power-on.
**UNVERIFIED accepted ANSI default:** other games and Games Settings leave this chain unchanged;
24b/24c must revisit their consumers. The original S8 ending tails were not recorded; the
independent continuous ending controls do not fill those tails. Evidence:
`analysis/ansi-spawn-rows-verified.json`, `analysis/ansi-game-over-resolution.json`.

**Levels and enemies (plan 24, in progress).** The unmodified full game covers levels 0–7,
each level's exit, a final-level restart after Continue, and the ending. The HUD moves below
ceiling terrain in levels 4 and 5. The scroll pauses at a boss; a kill lines up the ship and
flies it off before the next level. The canonical stream took 10,282 ticks and 962 s of emulated
time (including the final boss and restart), with 11,777 look-ahead evaluations. Its 18 cuts
replayed identically at native pixels, key edges, timing and audio. These are capture integrity
facts, not proof that the implementation replays them. Tasks 4–10 fit sprites, terrain,
spawn/movement/fire rules, collision, scoring and bosses from those goldens.

Each full-level golden's pixel-exact replay under the shared fidelity standard will verify
every spawn, kill and shot it contains. **UNVERIFIED:** any spawn, kill, shot, firing rate,
collision or RNG-consumption branch never exercised by those recordings; the recordings do not
prove that an unseen event is impossible. Exhaustive per-type kill/fire coverage is not a gate.
The partial census remains an exploratory aid for reconstruction.

**Bonuses and specials (plan 24, in progress).** Reviewed LCD/audio pickups establish all four
outcomes: missiles 03 → 06 (level 1), missiles 06 → wall 03 (level 2), three hearts → four
(cap run), and missiles 03 → beam 01 (level-0 restart). Their contact/disappearance, persistent
HUD changes and pickup cues are recorded in `analysis/s6-reviewed-bonus.json`.
**UNVERIFIED accepted life default:** cap lives at five; if a life is selected at the cap,
reroll from the same game RNG until a non-life bonus is selected. Five-life reachability and
this branch's RNG consumption have not been established by the LCD.

Paired unmodified controls establish beam/enemy kills, beam/boss damage and a wall/boss kill.
The wall/enemy probe has the same bullet hits and score with and without the wall.
**UNVERIFIED accepted wall default:** ordinary enemies take H10's four HP per registered wall
hit through the enemy damage path. No repeated-hit cadence or universal instant kill is
inferred. Exact weapon damage, hit registration, bonus draw mapping and unexercised stacking
branches still require reconstruction; evidence is
`analysis/s6-special-effects-reviewed-partial.json`.

**Sounds and vibration (plan 24, in progress).** Reviewed recordings isolate shot, death,
missile, wall, beam and all four bonus cues. A pickup sounds ≈2637 Hz; a shot ascends through
440/466/494/523 Hz; the death alternates short low tones and ≈4186 Hz. Exact frequencies,
volume registers and programs come from `analysis/s9-reviewed-specials-sound.json` and the
sound goldens, not these rounded descriptions. Deaths and boss kills vibrate ≈480 ms. Warning
tones and Games Sounds gate the buzzer; Sounds Off keeps vibration, Shakes Off keeps sound;
Vibrating alert also gates vibration. The new-top-score ending uses the fireworks tune. Events
shorter than 34 ms follow the shared fidelity standard; no per-test sound tolerance applies.

**Remaining hypotheses (UNVERIFIED until golden replay or further evidence).** Exact collision
geometry, score ceiling and per-hit awards, all boss phases and projectiles, the pending-sound
return code and lost-event behavior, held-fire cap, shield durations and exact continue/exit
steps remain H1–H22 hypotheses where not demonstrated by an informative recording. A recorded
outcome must match exactly; unexercised branches stay labelled rather than asserted.

**Capture artefacts.**

| Artefact                                                       | Cause                                                     | Handling                                                             |
| -------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| Identical random events in every game at one clock setting     | emulator RTC frozen (issue #1); the seed is clock-derived | behaviour is "seed from the clock"; the frozen clock is a test input |
| Top score `45`, Score IDs `ç` / `ÆG`                           | uninitialised game EEPROM (plan 14)                       | virgin initial state                                                 |
| ANSI generator at its boot value in every capture's first game | each section starts from power-on                         | reproduced: a phone's first game after power-on starts there         |
| Tick-phase jitter of ±15 ms against Select                     | the timer's phase at the key                              | not reproduced; inputs by tick                                       |
| Timer unit ≈7.745 ms                                           | emulator timebase (plan 23)                               | reproduced as captured; UNVERIFIED against hardware                  |
