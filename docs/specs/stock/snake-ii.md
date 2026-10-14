# Snake II (plan 23)

Part of the stock firmware's ground truth ([index](../nokia-3310.md#10-firmware-ground-truth-v639-captures)): the goldens under `packages/nokia-os/goldens/` are authoritative; where this file and a golden disagree, fix this file.

Source: the plan 23 recaptures (`captures/6.39/plan23/`, generator
`captures/scripts/gen_v639_plan23.py`), asserted by nokia-os's `game/snake/*` goldens (pixels
exact; tick intervals within 16 ms). The RE notes (`games_snake2_3310.md`) are cross-checks only.

**Board.** 20x9 cells; cell (x, y) at pixel (2 + 4x, 10 + 4y). A frame runs at x 0 and 83 from
y 8 to 47, with rules at y 6 and y 8. The score is four HUD digits at x 0/4/8/12 with leading
zeros (`0175`). A creature shows an 8x4 HUD icon at (66, 1) and a two-digit countdown at x
75/79. Edges wrap except where a maze has walls. Without a maze only the snake's body kills it.
The snake starts as seven segments heading right from the maze's start cell + 1: (4, 4), Maze 2
(0, 4), Maze 3 (0, 5), Maze 4 (4, 7).

**Speed and the virgin level 175.** The virgin EEPROM stores level 175. The Level page draws
`min(level, 9)` filled bars, so it shows nine. A meal scores the level (+175), and the snake moves
on every timer unit (≈7.7 ms), because the period table has nine entries and 175 reads a 0 past
them. ▼ lowers the level by one down to 1. ▲ raises it by one only below 9 (at 9 or above it does
nothing). OK stores the level and C discards the change; both return with Level selected. A held
▲ repeats after ≈780 ms, then every ≈490 ms. Digits leave for standby number entry. Periods for
levels 1-9: 635, 465, 364, 286, 217, 170, 132, 101 and 85 ms. Levels 10-174 (reachable by ▼ from 175) range from 8 ms to 2478 ms. The first tick comes about 20 ms less than a period after the
New game frame. Tick intervals jitter by ±15 ms (two timer units).

**Keys.** 2/4/6/8 turn to that direction. 1/3/7/9 are relative: 1 turns left when moving
vertically and up when moving horizontally, 3 right/up, 7 left/down, 9 right/down. `#` and ▼
turn clockwise, `*` and ▲ anticlockwise. 0, 5 and a reversal do nothing. A key is judged against
the current direction when it is pressed; the last key before a tick wins, and the tick applies
it. A key acts on key-down and does not repeat. Navi or C during play suspends the game, and
holding C goes to standby (not reproduced: the kernel drops a key held when an application
exits).

**Rules.** A blocked cell ahead (a wall, or the body; the tail's cell is free unless the snake
grows on this step) makes the blocked direction current and gives a ≈93 ms grace tick. A turn
perpendicular to the blocked direction saves the snake; the next tick comes one period later. A
second blocked tick kills it. Eating food scores the level, and the tail stays on the next tick.
Every meal adds 4 to a creature counter while no creature is out; at 20 a creature appears with a
countdown of 20 ticks. It is 2x1, or the 2x2 large creature when the large-creature bit is set (it
is in the virgin EEPROM). Eating a creature scores `5 × level + 5 + 2 × ticks left` and does not
grow the snake. Food and creatures never share a row or column. Placements come from `seed =
(seed × 0x625f + 0x3623) mod 0xfff1` (food x = r mod 20, then y = r mod 9). The seed is reset
from the clock and date at New game, not at Continue: one seed reproduces every placement of a
recorded game. Most captured clocks fit `(seconds of the day + 7930) mod 65521`, but no function
of the clock and date fits them all; nokia-os seeds from the minutes of the day (UNVERIFIED).

**Death and game over.** After the crash the snake blinks every ≈240 ms (nine frames) for ≈2.07
s, unless its ring index has wrapped (after ≈290 moves), in which case it does not blink. A new
top score is written first (the fireworks come ≈45 ms later than the plain note would) and then
shows the fireworks (six pictures twice, ≈217-241 ms each, ≈2.87 s in all) and `Game over!` /
`TOP SCORE:` / score for ≈2.94 s. Otherwise `Game over!` / `Your score:` / score shows for ≈2.94 s
on a cleared screen. The game menu follows with New game on the top row. Navi or C skips the
fireworks or the note; during the blink they suspend the dying game; ▼ does nothing. The top
score is written, and Last score ID (and with a new top score, Top score ID) changes to a
nine-character code.

**Suspend and Continue.** Navi shows the game menu with `Continue` first, numbered `8-1-1` (New
game `8-1-2` … Instructions `8-1-7`). C goes to the Games list. Entering Snake II again plays the
splash and opens on Continue; the suspended game survives standby. Continue redraws the board,
which stands until a key; ticks restart one period after that key. New game while suspended
starts a new game. Top score while suspended returns with Continue on the bottom row. OK on the
Level page while suspended removes Continue.

**Sound.** Game sounds need Tones › Warning tones On (unset in the virgin EEPROM, so captured
games are silent apart from the 900 Hz keypad beeps): a meal sounds 2637 Hz for one or two timer
units, the crash three ≈15 ms 440 Hz beeps. With Shakes On the vibrator runs ≈480 ms per meal and
from the crash. The edges lead the tick's redraw by 11-14 ms (40-55 ms when a meal's buzzer
delays it); nokia-os emits each cue with its frame, and plan 16 plays them (see [sound.md](sound.md): a new top score's fireworks tune starts 2045 ms after the crash, 21 ms before the death
steps end; keys on the game-over screens make no beep).

**UNVERIFIED** (not captured; nokia-os follows the RE notes or its own choice): the seed function
(above); eating the large creature (its collection bit, and no large
creature after it); a creature spawn that finds no place (its cells kept, hidden); Continue on a
game suspended during its blink (the blink resumes at the first key); ▲ or ▼ during Top score
while suspended; the timer unit (≈7.745 ms) on hardware. **Not reproduced:** the Score IDs
codes a game writes (the pages keep their virgin values; Club Nokia, later), the key-to-redraw
latency, the Warning tones redraw delay, the redraws the emulator drops at level 175, and C
held through a suspend going on to standby.
