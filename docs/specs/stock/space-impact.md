# Space impact (plan 24)

Part of the stock firmware's ground truth ([index](../nokia-3310.md#10-firmware-ground-truth-v639-captures)): the goldens under `packages/nokia-os/goldens/` are authoritative; where this file and a golden disagree, fix this file.

Source: the plan 24 Task 0 captures (`captures/6.39/plan24/`, generator
`captures/scripts/gen_v639_plan24.py`). Facts below are measured on the LCD (frame times within
1 ms) or the audio and vibrator events; RAM reads only cross-check them and are marked (peek).
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
splash takes its 60 draws from the same u32. The u32 is `0xd452fe80 + seconds of the day + 86400 ×
days since 13.10.2026` at every captured clock except hour 0 (00:00 and 00:01 write the same u32),
so nokia-os seeds every game from the minutes of the day (UNVERIFIED). Its first draw is the first
draw after every Snake II seed plan 23 recovered from the LCD, the 23:59 and 14.10.2026 overflows
included.

**Levels, enemies, bonuses, specials, bosses, scoring and sounds.** (plan 24, in progress)

**Capture artefacts.**

| Artefact                                                       | Cause                                                     | Handling                                                             |
| -------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| Identical random events in every game at one clock setting     | emulator RTC frozen (issue #1); the seed is clock-derived | behaviour is "seed from the clock"; the frozen clock is a test input |
| Top score `45`, Score IDs `ç` / `ÆG`                           | uninitialised game EEPROM (plan 14)                       | virgin initial state                                                 |
| ANSI generator at its boot value in every capture's first game | each section starts from power-on                         | reproduced: a phone's first game after power-on starts there         |
| Tick-phase jitter of ±15 ms against Select                     | the timer's phase at the key                              | not reproduced; inputs by tick                                       |
| Timer unit ≈7.745 ms                                           | emulator timebase (plan 23)                               | reproduced as captured; UNVERIFIED against hardware                  |
