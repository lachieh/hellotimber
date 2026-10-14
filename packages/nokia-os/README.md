# @hellotimber/nokia-os

A strict reproduction of the stock Nokia 3310 firmware (v6.39, PPM E, English) on the generic
`@hellotimber/phone-core` kernel, painted with `@hellotimber/phone-screen`'s LCD toolkit. Every
pixel and timing step is checked against emulator captures of the real firmware.

What it covers today (plans 13 and 14): the boot sequence, standby, the 12-entry main-menu
carousel with its animated icons, and the whole v6.39 menu tree (279 nodes, depth 6) in order,
with hidden menu numbers, both presentations (row lists with the stateful circular window, and
one-item pages with a current value), each level's soft key and opening selection, and the stock
shortcut digits (menu numbers, delayed opening, `Invalid shortcut`). Leaves open stock widgets:
option lists (single choice, unset, multi-select), timed, static and progress notes, confirm
queries, info pages and screens, input prompts (first screen), level bars, text pages, and the
four game splashes. Choices persist in an in-memory settings store and pages show them. Snake II
is playable (plan 23; see "Snake II"). Leaves that are whole applications open a marked
placeholder (a dotted border the firmware never draws) naming the plan that owns them; see "Leaf
ownership".

## Usage

```ts
import { createStockPhone, paintStockScreen } from "@hellotimber/nokia-os";
import { createScreenRenderer } from "@hellotimber/phone-screen";

const pad = (n: number) => String(n).padStart(2, "0");
const phone = createStockPhone({
  carrier: "Telstra", // every character must exist in the stock font; otherwise this throws
  clock: () => {
    const now = new Date();
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`; // "07:59"
  },
  date: () => {
    const now = new Date();
    return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`; // "13.10.2026"
  },
  boot: "animated", // or "skip" (tests, reduced motion)
});

const renderer = createScreenRenderer({ paint: paintStockScreen, scale: 6 });
document.body.append(renderer.canvas);
phone.subscribe(({ screen }) => renderer.render(screen));

const loop = () => {
  phone.tick(Math.floor(performance.now()));
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

phone.send({ type: "down", key: "power" }); // the phone starts switched off;
setTimeout(() => phone.send({ type: "up", key: "power" }), 1000); // a long press turns it on
```

`missingStockGlyphs(text, font)` lists the characters a stock font cannot draw, so a host can
validate an operator name before calling `createStockPhone`.

With `@hellotimber/phone-3d`, pass `renderer.canvas` as the screen texture source and forward
the model's key callbacks to `phone.send(...)`. nokia-os never imports phone-3d.

## Demo

```sh
mise exec -- vp run @hellotimber/nokia-os#demo   # http://localhost:5173
```

Arrows ▲/▼, Enter Navi, Backspace or Escape C (hold it to return to standby), digits, `*`,
`#`, and `P` power (held for 1 s). The buttons do the same. In Snake II the digits steer (2/4/6/8,
and 1/3/7/9 relative), ▲/▼ and `*`/`#` turn, Enter or Escape suspend the game. The demo validates
the operator name, can skip the boot, and shows the phone's path, screen kind and application in
a status line. In dev it also lays any committed golden over the LCD, as an overlay or as a pixel
difference; the list groups the goldens by top-level menu (`tree/05-tones`) and kind (`menu`,
`probe`, `game`).

## Asset policy

Everything the painter draws comes from committed goldens. Fonts are harvested from the text in
golden images (`scripts/text-runs.ts` is the only manual input). Icons, boot frames and status
art are cropped from goldens, and timelines come from golden timing rows. Nothing is copied from
the capture corpus's extracted firmware assets.

## Golden and tree data pipeline

The capture corpus (`nokia-3310/`, emulator captures of the real firmware) is gitignored and is
never committed. Three scripts turn it into committed, generated data. Never edit their output;
change the script or its input tables and run it again (each run twice gives no diff):

```sh
REF=/path/to/nokia-3310
# 1. Import captures into goldens/ (84×48 '#'/'.' text grids with timings, plus index.json).
mise exec -- vp run @hellotimber/nokia-os#import-captures $REF
# 2. Generate the stock menu tree (src/firmware/generated/stock-tree.ts) from tree.json and the
#    corpus OCR, plus the harvester's text runs (scripts/generated/tree-text-runs.ts).
mise exec -- vp run @hellotimber/nokia-os#import-tree $REF
# 3. Derive fonts, icons, boot frames, status art, widget sprites and widget timelines, and
#    Snake II's pictures, mazes and timings, into src/resources/generated/.
mise exec -- vp run @hellotimber/nokia-os#extract-resources
# 4. Test: pixel and timing acceptance against every asserted golden, the tree coverage guard,
#    and freshness checks.
mise exec -- vp run @hellotimber/nokia-os#test
```

`scripts/capture-set.ts` (plan 13) and `scripts/tree-capture-set.ts` (the menu tree, by rule:
one golden per submenu, option-list signature, leaf response and probe) decide which captures
become goldens and whether each is `asserted` or `pending:<plan>`. Tree goldens declare a
`scenario` and the nodes they `covers`; `tests/support/drive.ts` derives their key presses from
the generated tree, and `tests/support/probes.ts` holds the probes' hand-written scenarios.
`tests/acceptance.test.ts` drives the phone on a virtual 1 ms clock through a scenario for every
asserted golden and fails if one has none; timelines are compared after aligning on the first
changed frame, within ±2 ms (probes that replay another recording's timings or press later keys:
`PROBE_TOLERANCE_MS`, 25 ms). Its `KNOWN_GAPS` table lists the asserted goldens nokia-os cannot
reproduce, each with its reason (they run as expected failures). The coverage guard proves
that every tree node and option choice is covered by an asserted golden, a golden pending for the
plan that owns the node, or a same-as subtree equal to its model. Tests never read the corpus.

## Settings store

`src/firmware/settings.ts` keeps option-list choices, multi-select marks, setter levels (Info
service, Screen saver), free text and numbers (Snake II's level and top score) in memory, per
phone. Its initial state is the captured virgin EEPROM (unset tone lists, Snake II level 175 and
`Top score: 45`, the SIM's numbers); Tones share the General profile's settings. It is internal:
nothing persists across a reload, and factory defaults and a host persistence port belong to
plan 15.

## Snake II

`Games › Snake II › New game` plays the firmware's game (plan 23), checked against gameplay
captures pixel for pixel and tick by tick.

- **Engine.** `src/games/snake/` is a pure engine (`newSnakeGame`, `snakeKey`, `stepSnake`,
  `blinkSnake`, `snakeRender`) with the firmware's rules: the 20x9 board and its wrap, the five
  mazes, every game key, food and growth, the bonus creatures and their countdown, the grace
  tick before a crash, the death blink and the ring quirk. It is separate from
  `@hellotimber/snake`, the website's game, whose rules all differ. `src/widgets/snake.ts` runs it
  at the captured timings and ends in the shared game-over screens (`src/widgets/game-over.ts`).
- **Speed.** The virgin EEPROM stores level 175, which the Level page draws as nine bars. At 175
  the firmware reads its period past the end of its nine-entry table and finds 0, so the snake
  moves one cell per ≈7.7 ms timer unit and a meal scores 175. nokia-os reproduces that, and
  every level the Level page can store (▼ from 175 reaches 174..1) ticks at its captured period
  (`SNAKE_PERIODS`, from the goldens).
- **Random numbers.** Placements come from the firmware's 16-bit generator, reseeded at New game
  (not at Continue); one seed reproduces every placement of each recorded game. The function from
  the clock to the seed is unknown, so the stock phone seeds from the minutes of the day
  (UNVERIFIED) and tests inject the recovered seeds.
- **Cues.** The game emits `eat`, `crash`, `vibrate` and `top-score` cues stamped with the kernel
  time to an internal sink. Plan 16 plays them; the stock settings (Warning tones, Sounds,
  Shakes) decide which sound.
- **Scores.** Game over writes a new top score to the settings store, which Top score then shows.
  Navi or C suspends a game; `Continue` heads the game menu until the game resumes or is
  discarded (New game, OK on the Level page, power-off).

## Leaf ownership

Leaves that are whole applications open the placeholder, tagged with the plan that owns them:
Write messages, Service command editor, Picture messages, Templates, Smileys, Topics, Chat and
Screen saver › Screen saver (18); Composer slots (16); the three native languages and the Welcome
note (15); the other games' New game (24); Calculator (20); Stopwatch
(21); Profiles › Activate (17). Prompts and empty-state notes show their first screen until the
plans for Messages (18), Phone book (19), Clock and Reminders (21), Call register and Call divert
(22) and Settings (15) take them over.

## Capture artefacts

The emulator's virgin EEPROM and synthetic network leave marks that the OS does not reproduce:

| Artefact                                            | Handling                                           |
| --------------------------------------------------- | -------------------------------------------------- |
| Operator `Orange F`, clock `10:10`, setup date      | host config and ports; goldens pass them as inputs |
| Security-code prompt, `Code accepted`, clock wizard | not reproduced; boot is self-test + hands          |
| First standby `Snooze` prompt                       | not imported                                       |
| Profiles slot 6 name                                | two U+E000 boxes, as captured                      |
| Page values (`Level 1`, `Off`, …)                   | initial state of the in-memory settings store      |
| Unset tone lists, `Top score: 45`, score IDs        | initial state of the in-memory settings store      |
| Snake II level 175 (one cell per ≈7.7 ms)           | the virgin state; plan 15 decides factory defaults |
| `Requesting` / `Searching` never finish             | the bar loops until Quit or C                      |
