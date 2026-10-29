# Space impact (plan 24, in progress)

**Capture gate closed (Lachlan, 2026-10-27).** Task 0's accepted scope is the eight validated
full-level recordings, their exits and ending, plus the reviewed key, pause, bonus, special,
seed, ANSI and sound evidence. Twenty-eight plan-24 fixtures and the inherited New game tree fixture pass partial implementation
replays. The full-level recordings remain pending. Other gameplay observations below remain
**(plan 24, in progress)** until their replays pass.
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

**Suspend and Continue.** Navi during play opens `Continue / New game / Top score / Score
IDs / Instructions` (`8-2-1`..`8-2-5`) ≈70 ms after the key, Continue on the top row.
C also suspends; its `pause-c-during-play` recording returns with New game selected in the
middle row (the current implementation's window placement remains pending; checkpoint below). C there goes
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

**Terrain resources (Task 4, 2026-10-28).** Eight 2×16 maps use the exact 32×8 LCD
pictures in the resource crop table; level 0 has no terrain. Ground starts at row 32,
ceiling at row 0 in levels 4/5. A map's scroll selects world column `(scroll + x) % 512`.
Explicit clean rectangles, including disjoint fragments when objects obscure a complete tile,
establish each observed tile; every pixel of each accepted clean frame is checked exactly.
The resource extractor never votes on pixels. Resource extraction does not assert gameplay.
Every settled frame of the full-level acceptance replays will prove terrain and sprites together.

Level 6 has four observed leading-tile variants (columns 0, 4, 9, 12, numbered from zero):
when a tile reaches screen x=0, its first column at LCD rows 43/44 differs from the interior
specimen. Both are retained exactly in `leadingTiles`. The mechanism behind these boundary
draws remains **UNVERIFIED**; the resources record LCD observations, not an inferred firmware
blitter. Clean frames prove both variants and wrapping without relaxing pixel comparisons.

**UNVERIFIED terrain columns:** level 1 column 15, and level 7 columns 7–15. These do not
have complete clean pixel coverage in the recordings: level 1 reaches only the start of
column 15, while both final-level recordings expose only part of column 7 before the terrain
stops scrolling. Maps contain `null` for those cells, and the reference renderer refuses to
invent their pixels. Level 1's upper column 5 and level 7's column 6 are established by two
independent specimens of each disjoint fragment. Full-level replay remains the next check on
all scroll placements and pictures. **UNVERIFIED sprites:** any sprite or animation picture
absent from the committed crop table, including unobserved pictures; later replay adds needed
pictures using two exact LCD specimens. The four accepted gameplay defaults above/below remain
UNVERIFIED and unchanged.

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

**Runtime checkpoint (2026-10-29; incomplete).** The pure engine/painter reproduce 14 settled
opening frames from the canonical level-0 recording and all 36 tick stills of the 12 tap-key
fixtures (movement, ignored keys and ordinary fire). The opening wave's three linear entries
are generated from independent tick stills; they are not a complete level script. The generated
level-0 observation table preserves every alternative for 855 decoded settled images and the
unresolved `ala` redraw. Painting each of its 8,055 alternatives reproduces the original pixels;
this is resource/painter proof, not full gameplay acceptance. No plan-24 fixture was asserted
at this initial engine checkpoint.
**UNVERIFIED implementation hypotheses:** held fire makes five attempts including its initial
press; a pending sound consumes the next engine event. Their synthetic tests check the chosen
contract, not a complete firmware replay. The four accepted defaults retain their labels above.

**Session checkpoint (2026-10-29; incomplete).** Games › Space impact › New game now opens
the initial pure engine through the stock feature/session, and its per-game Continue survives
standby and Top score. Twenty plan-24 fixtures are asserted through real menu navigation: the
12 tap-key still sets and eight pause/menu fixtures (Navi, list, C from the menu, re-entry,
standby, the waiting Continue board, Navi from Continue and Top score). The inherited New game
tree fixture is asserted over all 60 original frames. This does not establish a complete game.
The first movement/shot redraw `af` now includes the preceding move and uses its new gun row;
`ag` verifies it is not applied twice. Shield expiry changes pixels only on a subsequent redraw.
The next observed enemy enters at tick 55, (82,17), with the opposite animation phase from the
opening group, fitted from independent frames `ao`/`ap` of the tree capture.

Continue's waiting board uses `ship/shielded/2`, distinct from the two moving shield frames.
**UNVERIFIED session defaults:** simultaneous deadlines run shield, tick, then repeats; an alert
or call suspends to Continue as Snake does. C during play selects New game; its captured middle-row
placement remains pending, with the current implementation using the existing top-row return.
`pause-c-during-play`'s final frame equals `pause-list/02`, so the earlier "like Navi" note does
not establish identical return selection/window placement. No comparison is relaxed for it.

A diagnostic ran all 631 level-0 input taps through 831 engine steps. Only the initial 25 of
879 settled timeline rows currently match in sequence; `ah` (2534 ms) is the next mismatch.
The source contains zero-duration movement pulses and a 4 ms fire pulse, but no duration filter
or latency model is accepted. The shot program is generated from the first level-0 sound sequence and reaches the real sounder:
440/466/494/523 Hz at volume 3, with edges 0/34/73/112/150 ms. Warning tones Off and Games Sounds
Off silence it. Full-level acceptance, collision/bonus/RNG consumption, the boss, endings and
complete sound replays remain pending. The seed is stored once per game, without claiming seed
recovery or random-event replay; the four accepted UNVERIFIED defaults above remain unchanged.

**Input-delivery checkpoint (2026-10-29; incomplete).** The full level-0 timeline's input
now distinguishes raw matrix pulses from delivered game keys. Fifty-three zero-execution
press/release pairs and the independently controlled `1` pulse at 2840.3–2844.3 ms are absent
from game input; their raw source log remains intact. First-five-second firmware controls
preserve all 66 native frames and byte-identical PCM audio. This introduces no minimum pulse
duration: all other positive-duration pulses remain represented. The complete control diverges
later at frame 143, so it does not establish an identical full run or a general scan rule.
Every original golden pixel and timeline row is retained.

The imported input has 577 entries. An engine/painter regression matches all 31 settled frames
through `am` (3029 ms); the complete diagnostic matches 36 of 879 rows, next failing at `at`
(frame 45, 3532 ms): recorded ship y=8 versus engine y=10. Removing the 3445-ms movement pulse
changes the recorded ship by one pixel; removing the 3525-ms pulse or the shot does not remove
the extra two-pixel displacement. Delivered key-repeat ordering is still unresolved. No new
runtime rule, seed claim, accepted UNVERIFIED default, tolerance or known gap follows from
these controls. Plan 24 remains 20 asserted and 148 pending; full-level replay is incomplete.

**Delivered-input checkpoint (2026-10-29; partial).** The framework has one repeat key.
A delivered down replaces it, including a key ignored by gameplay; a delivered release stops
that sole repeat. Movement contributes one pixel on down and two on repeat, applied at the
next tick or a shot redraw. The session uses the captured 94 ms repeat period. Recorded 8/1/8
ordering, both held-direction movement prefixes and short input windows from all eight levels
have ship-position regressions. A byte-preserving trace control covers all 64 canonical full-
game/key recordings (15,899 PNGs and all paired PCM WAVs); inspection of delivered handler
arguments corroborates the input ordering but does not replace gameplay pixel proof.

A short raw pulse can repeat: the 3339.3–3357.3 ms tap's delivered down precedes its repeat,
which precedes its delivered release. Raw matrix release time is not game-release time. No
universal pulse cutoff or release grace is established. Across all 631 raw level-0 taps the
firmware receives 537 downs plus 71 repeats; the current importer still has 577 entries and
has not normalized the full delivered stream. UNVERIFIED boundary choice: host KeyEvents
represent delivered events; raw matrix scanning remains capture-side work, consistent with
D8's exclusion of key latency. The complete general input model remains unfinished.

Using independently observed delivered events, the engine/painter checks 46/879 settled
level-0 rows through `bf`, next failing at `bg` (4467 ms), the first captured kill/score 10.
Using the unchanged imported input, it still checks 36/879 and fails at `at` (3532 ms).
These are distinct diagnostic results. No additional golden is asserted; plan 24 remains
20 asserted and 148 pending. No raw scan delay, seed, tolerance or runtime captured-state
substitution is introduced.

**Opening kills checkpoint (2026-10-29; partial).** Accepted full-level replay input is the
observed delivered stream, deterministically imported into the committed golden's note.
Raw harness scanner timing is capture-side follow-up and does not gate gameplay; short tap
and held-key fixtures retain their exact input checks. The complete level-0 diagnostic now
matches 96/879 settled rows through `dm` (8630 ms), first failing at `dn` (8736 ms), the next
right-edge enemy entry. This is a pixel-exact prefix, not full-level acceptance.

The opening five round-wide enemy kills award 10 points each and consume their colliding
shots. Their hit redraw retains the enemy; the next three ticks show split, checker and
spark explosions, fixed at the hit position with shrinking-picture offsets. The next
wave's second entry (tick 64, y=17) is generated from two complete held-0 LCD specimens.
The exact held-0 tick fixture passes through real Games navigation and establishes that
an enemy retires when its left edge becomes negative. It is now asserted: plan 24 has
21 asserted, 147 pending and no registered known gaps. Every original pixel, timeline row
and short fixture's input is unchanged.
**UNVERIFIED:** collision geometry and explosion behavior outside the captured arrangements,
other enemy HP/score rules, multi-hit behavior and score ceiling. The four accepted defaults
and previous labelled hypotheses remain unchanged. No gameplay seed recovery, later-wave
rule, bonus, boss, ending or complete sound replay is established by this checkpoint.

**Later-wave checkpoint (2026-10-29; partial).** The complete delivered-input diagnostic
matches 205/879 settled rows through `ij` (18075 ms), with ten kills and score 100. `ik`
(18149 ms) is the first remaining mismatch: the real pickup changes missiles to wall ×3.
No gameplay seed or bonus result is injected. The full level-0 golden remains pending.
The second orb's runtime entry phase is UNVERIFIED until earlier pickup/pending-return
behavior is replayed; its current generated entry uses the delivered callback ordinal.

Generated static data now includes twelve linear round-wide entries, each with its own
horizontal speed, and both bonus-orb entries. The entries at updates 90 and 108 move one
pixel per update. `dv` and `fb` establish inclusive right-edge and lower-edge shot contacts
against these slow enemies; earlier settled pixels remain exact. The first orb's captured
entry, animation and approach replay alongside the ship, shots, enemies, explosions and HUD.
**UNVERIFIED:** these collision boundaries outside the recorded arrangements, and retiring
an uncollected orb at negative x (both recorded level-0 orbs are collected earlier).

The generated full-level observation inventory retains 34 tracks: twelve round-wide,
six triangle, nine round-small, four long-left, two orbs and the boss. Every unambiguous
complete ordinary-enemy observation is accounted for. Candidate delivered entry ordinals,
spatial path alternatives and LCD specimen references are retained; they do not constitute
a fitted complete spawn/HP/fire program. **UNVERIFIED:** later entry attribution, nonlinear
path association and HP not established by runtime replay. Clipped entry/kill attribution
at `qy`, `td` and `vi` stays unresolved. The boss approaches x=56; its observed later y
alternatives are not a fitted phase model. The runtime does not substitute these observed
frames for game state. Remaining reconstruction and RNG ordering continue from the pickup.

Seven further held-key tick fixtures (`2`, `5`, `7`, `9`, ▲, ▼ and `*`) pass every still and
both input edges through real Games navigation. Plan 24 now has 28 asserted, 140 pending
and no registered known gaps. The full held timelines, held-8 and level-0 acceptance remain
pending; no comparison or timing tolerance changes.

**Bonus RNG checkpoint (2026-10-29; partial).** A pure, currently unwired helper centralizes
H9's **UNVERIFIED** draw mapping (low two bits: life, missiles, wall, beam) and stacking
(three matching missiles/walls or one beam; another weapon replaces the count). It uses the
same game RNG for the accepted **UNVERIFIED** five-life cap/reroll. The four reviewed pickup
outcomes do not establish their numeric random mapping, draw positions or unseen stacking.
The engine still does not collect an orb; no pickup result or extra RNG draw is injected.

The seed search enumerates all 65,521 effective pre-draw states for provenance-labelled
observations at explicit draw indices, and refuses contradictory evidence. Its result is
conditional on those indices; a unique effective state would not identify the original u32
clock seed. With H9 and a first-draw assumption, level 0's first wall HUD (`ik`) leaves
16,380 candidates, excluding both accepted fallback inputs 0 and 610. Later random outcomes
and consumer ordering are not yet fitted, so this is not a complete level-0 seed search.
The first-pickup contact/order also remains unresolved: `ih` and `ij` retain the orb while
the ship is at (5,15), before `ik` removes it. Neither a simple full box test nor the tried
pixel-intersection test establishes collection. The replay remains 205/879 settled rows,
28 asserted fixtures, 140 pending and no registered known gaps. Every original pixel and
tolerance remains unchanged; no splash/RAM seed supplies gameplay proof.

**Joint RNG recovery checkpoint (2026-10-29; conditional).** The dedicated
`scripts/space-impact-seed-recovery.ts` derives both pickups, two boss bullet tracks,
69 boss firing/non-firing opportunities and the first five destruction windows from
committed level-0/exit goldens. It searches all effective seeds and the full byte firing
denominator domain (excluding no-fire sentinels). Under the independently counted order
(draw 1 pickup; 2–19 ordinary rolls; 20 pickup; 21–89 boss rolls; 90–105 destruction),
remaining effective seeds are 16,380 after the first pickup, 4,093 after the second,
38 after boss opportunities, 3 after the first destruction window, and **44530 alone**
after the second. The sole rate is **40**. Every destruction pixel in the unobscured
21×23 window matches, and the next three windows also match. This is conditional RNG
derivation, not full-level acceptance. The generated JSON fixture records every event.

**UNVERIFIED consumer attribution:** adding a nineteenth hidden ordinary roll instead
leaves seed **59408** and the same later recorded outcomes. That counterexample is
retained. Both histories reach state **59365** immediately after the second pickup, so
every later draw is identical. The byte-identical read-only native control counts 18, but the engine has yet
to execute the full spawn/fire program and prove its count. Do not inject an arbitrary
survivor or treat the conditional result as a clock rule. Either effective seed has
65,551 original u32 aliases with the same wrapping first draw; future gameplay cannot
distinguish those aliases. No ANSI draw occurs in the level-0 order hypothesis; later
random-row replay remains pending. No registered known gap follows from histories
that agree on every recorded outcome. The runtime is unchanged: **205/879** settled
rows, first mismatch **`ik` at 18149 ms**, **28 asserted / 140 pending** plan-24 fixtures,
zero registered known gaps, and the bonus policy remains unwired.

**Accepted seed and first-pickup replay (2026-10-29; partial).** The parent accepts the
counted eighteen-roll hypothesis, effective seed **44530**, as level 0's recovered seed,
labelled **UNVERIFIED**. It is derived by the committed LCD recovery script and supplied
from its generated derivation to the replay, satisfying accepted S7. The nineteen-roll
alternative (59408) is observationally equivalent: both reach 59365 after pickup two,
and nothing visible distinguishes the histories beforehand. The choice is imperceptible
under AGENTS.md; it establishes no clock formula or original u32 seed.

The engine now collects the first orb and consumes the first shared RNG draw, awarding
wall ×3. The ship uses an opaque bitmap; on inverted level 0 the collision test meets
clear pixels of the XOR orb. The exact skimming approach misses at orb x10/x8, then
collects at x6 with ship (5,15). A read-only observer corroborates this mechanism and
preserves all 2,049 original PNG/PCM files byte-for-byte. The LCD pixels remain the proof.
**UNVERIFIED:** generalizing this contact to other arrangements and levels, and suppressing
ship collection while shielded. The accepted same-chain five-life reroll is now wired into
contact and covered synthetically; its reachability remains UNVERIFIED.

Pickup leaves a pending sound return. Framework key release ends the repeat but does not
consume that game return; the next game event returns the cue without advancing the engine.
The bonus sound is generated from the committed 2636.9 Hz, volume-6 cue (4 ms), and replaces
an ongoing shot through the real sounder. Warning tones and Games Sounds still gate it.
This is cue proof, not complete sound-timeline acceptance.

The complete delivered stream now matches **237/879** settled rows through **`jy` at
21090 ms**. First remaining mismatch is **`jz`, frame 285, 21192 ms**, the next triangle
enemy entry. The runtime does not yet execute the eighteen ordinary rolls, second pickup,
boss rolls or destruction draws; their accepted order remains the next replay obligation.
Plan 24 stays **28 asserted / 140 pending / 0 registered known gaps**. Full level 0 remains
pending; no comparator, timing tolerance, golden pixel or input changes.

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
