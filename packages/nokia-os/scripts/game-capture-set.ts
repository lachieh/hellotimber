// Snake II gameplay goldens (plan 23 "Capture set"): an explicit table over the plan 23 Task 0
// recaptures (`captures/6.39/plan23/`), Snake II's board predicate, grace and still selection
// for the shared machinery (`game-capture.ts`), and the period fixture.
//
// Reads captures only through the injected `GameCaptureIo`, so tests run it on synthetic
// recordings. Paths are relative to `$REF/captures/6.39`. Pure: imports only sibling scripts.
import type { CaptureSetEntry } from "./capture-set.ts";
import {
  framePeriod,
  GameCaptureError,
  gameGolden,
  lit,
  numberTicks,
  playBackToBack,
  region,
  screenGolden,
  selectTickStills,
  shotsGolden,
  tickRow,
  type GameCaptureIo,
  type StillRule,
  type Tick,
  type TickFixtureSpec,
  type TickRule,
} from "./game-capture.ts";
import { LCD_HEIGHT, LCD_WIDTH, type GoldenKeyPress, type GoldenStatus } from "./golden-format.ts";

// ---------------------------------------------------------------- measured constants

/** The grace tick after a blocked tick (Task 0: ≈93 ms, 12 timer units; H6). */
export const GRACE_MS = 93;
/** How far an interval may stray from `period + GRACE_MS` and still mark a grace. */
export const GRACE_TOLERANCE_MS = 16;

/** Engine tick periods of the levels the bot and the probes played (Task 0, C2). */
export const PERIOD_BY_LEVEL: Readonly<Record<number, number>> = {
  1: 635,
  2: 465,
  175: 8,
};

// ---------------------------------------------------------------- pixel features

/** The Snake II board: rules at y 6 and y 8 (y 7 clear), bottom row y 47, sides x 0 and 83. */
export function isBoardFrame(pixels: Uint8Array): boolean {
  for (let x = 0; x < LCD_WIDTH; x++) {
    if (!lit(pixels, x, 6) || lit(pixels, x, 7) || !lit(pixels, x, 8) || !lit(pixels, x, 47)) {
      return false;
    }
  }
  for (let y = 8; y < LCD_HEIGHT; y++) {
    if (!lit(pixels, 0, y) || !lit(pixels, 83, y)) return false;
  }
  return true;
}

/** The four score digits (x 0..15, y 0..4). */
export function scoreKey(pixels: Uint8Array): string {
  return region(pixels, 0, 15, 0, 4);
}

/** The creature HUD (icon at x 66, countdown at x 75/79) is drawn. */
export function creatureShown(pixels: Uint8Array): boolean {
  return region(pixels, 64, 83, 0, 5).includes("1");
}

// ---------------------------------------------------------------- ticks

/**
 * Snake II's ticks: board frames at the level's period; a gap of `period + GRACE_MS` (±
 * tolerance) holds a blocked tick, which draws nothing (H6).
 */
export function snakeTickRule(periodMs: number): TickRule {
  return {
    isGameFrame: isBoardFrame,
    periodMs,
    silentTicks: (gap) => (Math.abs(gap - (periodMs + GRACE_MS)) <= GRACE_TOLERANCE_MS ? 1 : 0),
  };
}

/**
 * Which ticks become tick stills (plan 23 D5): `game` (bot games) keeps tick 0, every tick
 * whose HUD changes (a meal, a creature appearing, eaten or expiring) ±1, every 25th tick and
 * the last 12; `meals` keeps tick 0, the meal ticks (where the score changes) and the last tick;
 * `input` keeps each input tick and the two after it (key probes).
 */
export type StillSelection = "game" | "meals" | "input";

const meal = (a: Uint8Array, b: Uint8Array) => scoreKey(a) !== scoreKey(b);

const STILL_RULES: Readonly<Record<StillSelection, StillRule>> = {
  game: {
    first: true,
    event: (a, b) => meal(a, b) || creatureShown(a) !== creatureShown(b),
    around: 1,
    every: 25,
    last: 12,
  },
  meals: { first: true, event: meal, last: 1 },
  input: { afterInput: 2 },
};

export function tickStillSelection(
  ticks: readonly Tick[],
  selection: StillSelection = "game",
  input: readonly GoldenKeyPress[] = [],
): number[] {
  return selectTickStills(ticks, STILL_RULES[selection], input);
}

// ---------------------------------------------------------------- the table

const ROOT = "plan23";

/** A gameplay golden over one or more back-to-back recordings. */
interface GameSpec {
  readonly name: string;
  readonly dirs: readonly string[];
  readonly level: number;
  readonly note: string;
  /** `stills`: tick stills; `timeline`: the whole recording(s), or up to `toTick`. */
  readonly kind: "stills" | "timeline";
  /** Tick stills: which ticks (default `game`). */
  readonly selection?: StillSelection;
  /** Timelines: cut after this tick's last frame. */
  readonly toTick?: number;
  /** Input read from the frames when Task 0's keys are ambiguous (level 175), with the reason. */
  readonly input?: readonly GoldenKeyPress[];
  /** Keys a capture pressed but did not log (`key` in the capture script), as keys.csv rows. */
  readonly extraKeys?: readonly { dir: string; key: string; pressMs: number }[];
  readonly status?: GoldenStatus;
}

/** A timeline over a recording that has no engine ticks to number (menus, notes, a death). */
interface ScreenSpec {
  readonly name: string;
  readonly dir: string;
  readonly note: string;
  /** Default: the first frame that differs from the first kept frame. */
  readonly triggerFrame?: number;
  /** Keep the recording from this frame on (the frame before a key). */
  readonly from?: number;
  readonly status?: GoldenStatus;
}

interface StillSpec {
  readonly name: string;
  readonly files: readonly string[];
  readonly note: string;
}

const MAZE_NAMES = ["No maze", "Maze 1", "Maze 2", "Maze 3", "Maze 4", "Maze 5"] as const;

const KEY_PROBES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "star", "hash", "up", "down", "0"];

const STILLS: readonly StillSpec[] = [
  ...Array.from({ length: 9 }, (_, i) => ({
    name: `level-${i + 1}`,
    files: [i < 8 ? `levels/down/${i + 1}.png` : "levels/up/9.png"],
    note: `C1: the Snake II Level page at level ${i + 1} (${i + 1} filled bars); ${
      i < 8 ? `▼ from the virgin page (175) down to ${i + 1}` : "▲ from 1 back up to 9"
    }.`,
  })),
  {
    name: "level-keys-virgin-up",
    files: ["levels/virgin.png", "levels/up-from-virgin.png", "levels/up-then-down-to-8.png"],
    note: "C1: the virgin page (level 175, nine bars); ▲ (still nine bars); then ▼ ×167 (eight bars): ▲ from 175 changes nothing.",
  },
  {
    name: "pause-list",
    files: Array.from({ length: 9 }, (_, i) => `pause/list/${String(i + 1).padStart(2, "0")}.png`),
    note: "C8: Navi during a level-1 game: the game menu opens on Continue (8-1-1), then ▼ per image through the wrap.",
  },
  {
    name: "pause-level",
    files: ["pause/level-page.png", "pause/level-after-ok.png"],
    note: "C8: suspended at level 1, Level (▼ ×2, Select): the page; ▲ and OK: Continue is gone and the selection stays on the third row (Mazes, 8-1-3).",
  },
  ...(["long", "short"] as const).map((name) => ({
    name: `after-${name}`,
    files: [`bot/${name}/after/menu.png`, `bot/${name}/after/top-score-after.png`],
    note: `C11: after the ${name} game: the game menu (New game on the top row), then Top score's return (New game on the bottom row).`,
  })),
  {
    name: "after-virgin",
    files: ["virgin/after/menu.png", "virgin/after/top-score-after.png"],
    note: "C11: after the virgin game: the game menu, then Top score's return.",
  },
];

const SCREENS: readonly ScreenSpec[] = [
  {
    name: "level-keys-ok",
    dir: "levels/ok",
    note: "C1: the Level page at 5 (stored 175), OK at frame 1: back to the game menu with Level selected; reopening shows 5.",
  },
  {
    name: "level-keys-c",
    dir: "levels/c",
    note: "C1: the Level page at 3 (stored 5), C at frame 1: back to the game menu with Level selected; reopening shows 5.",
  },
  {
    name: "level-keys-hold-up",
    dir: "levels/hold-up",
    note: "C1: the Level page at 5, ▲ held 2 s: +1 at frame 1, then repeats after ≈778 ms and ≈490 ms up to 9.",
  },
  {
    name: "level-keys-digit-1",
    dir: "levels/key-1",
    note: "C1: 1 on the Level page leaves for standby number entry.",
  },
  {
    name: "pause-c",
    dir: "pause/c",
    note: "C8: C on the game menu while suspended: the Games list (8-1).",
  },
  {
    name: "pause-reenter",
    dir: "pause/reenter",
    note: "C8: Select on Snake II while suspended: the splash, then the game menu on Continue.",
  },
  {
    name: "pause-from-standby",
    dir: "pause/from-standby",
    note: "C8: suspended, C ×3 to standby, back to Games: Select on Snake II plays the splash and opens on Continue.",
  },
  {
    name: "pause-top-score",
    dir: "pause/top-score",
    note: "C8: Top score while suspended: the note, then the game menu with Continue on the bottom row.",
  },
  ...(["long", "virgin"] as const).map((name) => ({
    name: `after-${name}-top-score`,
    dir: name === "long" ? "bot/long/after/top-score" : "virgin/after/top-score",
    note: `C11: Top score after the ${name} game (new top score ${name === "long" ? 105 : 175}).`,
  })),
  ...(["long", "short", "maze2", "maze3", "grace"] as const).map((name) => ({
    name: `bot-${name}.death`,
    dir: `bot/${name}/death`,
    note: `C5: the ${name} game from the bot's last key: the blocked tick, the grace, ${
      name === "long"
        ? "no blink (the ring index has wrapped), the fireworks and TOP SCORE:"
        : "the blink, Game over! / Your score:"
    }, then the game menu.`,
  })),
  {
    name: "score-8.death",
    dir: "score-8/death",
    note: "Task 4 recapture: the score-8 game from the bot's last key: the blocked tick, the grace, the blink, Game over! / Your score: / 8, then the game menu.",
  },
  {
    name: "gameover-blink-navi",
    dir: "gameover/short-navi-1500",
    from: 5,
    note: "C12: the short game's death, Navi 1500 ms after the bot's last key, during the blink: the game menu with Continue.",
  },
  {
    name: "gameover-fireworks-navi",
    dir: "gameover/long-navi-4000",
    from: 6,
    note: "C12: the long game's death, Navi 4000 ms after the bot's last key, during the fireworks: the game menu at once.",
  },
  {
    name: "gameover-note-navi",
    dir: "gameover/long-navi-7000",
    from: 13,
    note: "C12: the long game's death, Navi 7000 ms after the bot's last key, during TOP SCORE: the game menu at once.",
  },
  {
    name: "gameover-note-down",
    dir: "gameover/long-down-7000",
    from: 13,
    note: "C12: the long game's death, ▼ 7000 ms after the bot's last key, during TOP SCORE: ignored (the note ends by itself).",
  },
];

const GAMES: readonly GameSpec[] = [
  ...Array.from({ length: 9 }, (_, i) => ({
    name: `ticks-l${i + 1}`,
    dirs: [`ticks/${i + 1}`],
    level: i + 1,
    kind: "timeline" as const,
    toTick: 8,
    note: `C2: New game at level ${i + 1}, No maze, no keys: the start frame and 8 ticks.`,
  })),
  ...MAZE_NAMES.map((maze, m) => ({
    name: `maze-${m}`,
    dirs: [`mazes/${m}`],
    level: 1,
    kind: "timeline" as const,
    ...([1, 3, 4].includes(m) ? {} : { toTick: 8 }),
    note: [1, 3, 4].includes(m)
      ? `C4: New game at level 1 on ${maze}: the snake runs right into the wall; grace, blink, Game over!, the game menu.`
      : `C4: New game at level 1 on ${maze}: the start frame and 8 ticks (it never meets a wall).`,
  })),
  {
    name: "bot-long",
    dirs: ["bot/long/game"],
    level: 1,
    kind: "stills",
    note: "C5: level 1, No maze, bot-steered: 31 meals, five creatures (the first expires, the large one too), 297 moves; ends at the bot's last key.",
  },
  {
    name: "bot-short",
    dirs: ["bot/short/game"],
    level: 2,
    kind: "stills",
    note: "C5: level 2, No maze, bot-steered: two meals; ends at the bot's last key.",
  },
  {
    name: "bot-maze2",
    dirs: ["bot/maze2/game"],
    level: 1,
    kind: "stills",
    note: "C5: level 1, Maze 2, bot-steered: five meals, then toward a wall; ends at the bot's last key.",
  },
  {
    name: "bot-maze3",
    dirs: ["bot/maze3/game"],
    level: 1,
    kind: "stills",
    note: "C5: level 1, Maze 3, bot-steered: five meals, then toward a wall; ends at the bot's last key.",
  },
  {
    name: "bot-grace",
    dirs: ["bot/grace/game", "bot/grace/save"],
    level: 1,
    kind: "stills",
    note: "C5: level 1, No maze, bot-steered (seven meals): a turn into the body, then a perpendicular turn during the grace tick (the blocked tick shows no frame, tick 60); ends at the bot's last key.",
  },
  {
    name: "virgin-meal",
    dirs: ["virgin/meal"],
    level: 175,
    kind: "timeline",
    toTick: 12,
    input: [{ tick: 3, key: "8" }],
    note: "C6: the virgin level 175, No maze: 8 pressed 68 ms after Select (before the New game frame) turns the snake down at tick 4; it eats (14, 8) for 0175 at tick 7. Input read from the frames: at one cell per ≈8 ms every key is within a tick of its latency window.",
  },
  {
    name: "virgin-game",
    dirs: ["virgin/game"],
    level: 175,
    kind: "timeline",
    input: [
      { tick: 3, key: "2" },
      { tick: 7, key: "4" },
    ],
    note: "C6: the virgin level 175 on Maze 1: ▲ after Select turns the snake up at tick 4; it is blocked by the top wall at tick 7 (no frame), and ← in the grace runs it along row 1 through (12, 1) (0175) into the left wall: blink, fireworks, TOP SCORE: 175, the game menu. Input read from the frames (level 175).",
  },
  ...KEY_PROBES.flatMap((key) => [
    {
      name: `keys-right-${key}`,
      dirs: [`keys/right-${key}`],
      level: 1,
      kind: "stills" as const,
      selection: "input" as const,
      note: `C7: level 1, heading right, ${key} between ticks 2 and 3.`,
    },
    {
      name: `keys-up-${key}`,
      dirs: [`keys/up-${key}`],
      level: 1,
      kind: "stills" as const,
      selection: "input" as const,
      note: `C7: level 1, 2 between ticks 1 and 2 (heading up from tick 2), then ${key} between ticks 3 and 4.`,
    },
  ]),
  ...(
    [
      ["pair-2-8", "2 then 8 (60 ms apart) between ticks 2 and 3: the last wins (down)"],
      ["pair-2-4", "2 then 4 between ticks 2 and 3: 4 is a reversal, so up stays"],
      ["pair-8-2", "8 then 2 between ticks 2 and 3: the last wins (up)"],
      [
        "hold-2",
        "2 held for three ticks from between ticks 2 and 3: one turn at tick 3, no repeat",
      ],
      ["hold-hash", "# held for three ticks: one clockwise turn at tick 3, no repeat"],
    ] as const
  ).map(([probe, what]) => ({
    name: `keys-${probe}`,
    dirs: [`keys/${probe}`],
    level: 1,
    kind: "stills" as const,
    selection: "input" as const,
    note: `C7: level 1, heading right: ${what}.`,
  })),
  ...(
    [
      ["navi", "Navi between ticks 2 and 3: the game menu with Continue"],
      ["c", "C between ticks 2 and 3: the game menu with Continue, like Navi"],
      ["c-hold", "C held for three ticks: the game menu, then standby"],
    ] as const
  ).map(([probe, what]) => ({
    name: `keys-${probe}`,
    dirs: [`keys/${probe}`],
    level: 1,
    kind: "timeline" as const,
    note: `C7: level 1: ${what}.`,
  })),
  {
    name: "pause-nav",
    dirs: ["pause/nav"],
    level: 1,
    kind: "timeline",
    note: "C8: level 1, Navi between ticks 2 and 3: the game menu opens on Continue (8-1-1).",
  },
  {
    name: "pause-continue",
    dirs: ["pause/continue"],
    level: 1,
    kind: "timeline",
    note: "C8: suspended at tick 2, Select on Continue: the board as it was, standing until 6 (no turn), then ticks one period after it.",
  },
  {
    name: "pause-continue-turn",
    dirs: ["pause/continue-turn"],
    level: 1,
    kind: "timeline",
    note: "C8: suspended at tick 2, Select on Continue, then 2: the turn applies at the first tick after the key.",
  },
  {
    name: "pause-new-game",
    dirs: ["pause/new-game"],
    level: 1,
    kind: "timeline",
    toTick: 4,
    note: "C8: suspended, ▼ to New game (8-1-2), Select: a new game.",
  },
  {
    name: "pause-bot",
    dirs: ["pause/bot/game", "pause/bot/continue"],
    level: 1,
    kind: "stills",
    extraKeys: [{ dir: "pause/bot/continue", key: "menu", pressMs: 0 }],
    note: "C8: level 1, bot-steered: Navi after tick 3, Select on Continue, 6 to resume, then three meals placed as in an uninterrupted game (Continue does not reseed, D4).",
  },
  ...(
    [
      ["1010", "13.10.2026 10:10"],
      ["1011", "13.10.2026 10:11"],
      ["0000", "13.10.2026 00:00"],
      ["0001", "13.10.2026 00:01"],
      ["1200", "13.10.2026 12:00"],
      ["1948", "13.10.2026 19:48"],
      ["0759", "13.10.2026 07:59"],
      ["2359", "13.10.2026 23:59"],
      ["1010-14102026", "14.10.2026 10:10"],
    ] as const
  ).map(([tag, clock]) => ({
    name: `seed-${tag}`,
    dirs: [`seed/${tag}/game`],
    level: 1,
    kind: "stills" as const,
    selection: "meals" as const,
    note: `C9: power-on with the clock at ${clock}, level 1, No maze, bot-steered to three meals: the placements of that clock's seed.`,
  })),
  {
    name: "seed-1010-second",
    dirs: ["seed/1010/game2"],
    level: 1,
    kind: "stills",
    selection: "meals",
    note: "C9: the second game after seed-1010 without a power cycle (13.10.2026 10:10): the same placements, so New game reseeds from the clock.",
  },
  // Task 4 recaptures: C5 showed the creature kinds 3-5 only; these clocks' seeds draw kinds 0-2.
  ...(
    [
      ["0914", 0],
      ["0956", 0],
      ["1007", 2],
      ["1021", 2],
      ["1035", 2],
      ["1107", 1],
      ["1221", 1],
    ] as const
  ).map(([tag, kind]) => ({
    name: `creature-${tag}`,
    dirs: [`creatures/${tag}/game`],
    level: 1,
    kind: "stills" as const,
    selection: "meals" as const,
    note: `Task 4 recapture: power-on with the clock at 13.10.2026 ${tag.slice(0, 2)}:${tag.slice(2)}, level 1, No maze, bot-steered; the fifth meal brings a creature of kind ${kind}, left alone until it expires.`,
  })),
  {
    name: "score-8",
    dirs: ["score-8/game"],
    level: 1,
    kind: "stills",
    selection: "meals",
    note: "Task 4 recapture: level 1, No maze, 13.10.2026 10:10, bot-steered to eight meals (the creature left alone); ends at the bot's last key.",
  },
];

const STILL_NOTES: Readonly<Record<StillSelection, string>> = {
  game: "tick 0, meals and creature changes ±1, every 25th tick, the last 12",
  meals: "tick 0, each meal and the last tick",
  input: "each key's tick and the two after it",
};

// ---------------------------------------------------------------- building entries

function gameEntry(spec: GameSpec, io: GameCaptureIo): CaptureSetEntry {
  const selection = spec.selection ?? "game";
  return gameGolden(
    {
      id: `game/snake/${spec.name}`,
      root: ROOT,
      dirs: spec.dirs,
      ticks: (frames) =>
        snakeTickRule(PERIOD_BY_LEVEL[spec.level] ?? framePeriod(frames, isBoardFrame)),
      note: spec.note,
      status: spec.status ?? "asserted",
      ...(spec.kind === "stills"
        ? { stills: { rule: STILL_RULES[selection], note: STILL_NOTES[selection] } }
        : {}),
      ...(spec.toTick === undefined ? {} : { toTick: spec.toTick }),
      ...(spec.input === undefined ? {} : { input: spec.input }),
      ...(spec.extraKeys === undefined ? {} : { extraKeys: spec.extraKeys }),
    },
    io,
  );
}

/** The game goldens, in table order. */
export function gameCaptureSet(io: GameCaptureIo): CaptureSetEntry[] {
  return [
    ...STILLS.map((spec) =>
      shotsGolden({
        id: `game/snake/${spec.name}`,
        root: ROOT,
        files: spec.files,
        note: spec.note,
        status: "asserted",
      }),
    ),
    ...SCREENS.map((spec) =>
      screenGolden(
        {
          id: `game/snake/${spec.name}`,
          root: ROOT,
          dir: spec.dir,
          note: spec.note,
          status: spec.status ?? "asserted",
          ...(spec.triggerFrame === undefined ? {} : { triggerFrame: spec.triggerFrame }),
          ...(spec.from === undefined ? {} : { from: spec.from }),
        },
        io,
      ),
    ),
    ...GAMES.map((spec) => gameEntry(spec, io)),
  ];
}

/** Levels of the period fixture (C3); levels 1-9 come from `ticks-l<L>`. */
export const PERIOD_LEVELS: readonly number[] = Array.from({ length: 166 }, (_, i) => i + 10);

/** The period fixture: the first tick and every interval at each level 10..175. */
export function periodFixture(io: GameCaptureIo): TickFixtureSpec {
  const rows = PERIOD_LEVELS.map((level) => {
    const dir = `periods/${level}`;
    const frames = io.recording(`${ROOT}/${dir}`);
    if (frames === undefined || frames.length === 0) {
      throw new GameCaptureError(`${ROOT}/${dir}`, "missing capture");
    }
    const played = playBackToBack([{ dir, frames }]).frames;
    const ticks = numberTicks(played, snakeTickRule(framePeriod(played, isBoardFrame)));
    return tickRow(level, ticks, `${ROOT}/${dir}`);
  });
  return {
    id: "game/snake/periods",
    status: "asserted",
    source: `captures/6.39/${ROOT}/periods`,
    timings: PERIOD_LEVELS.map((level) => `${ROOT}/periods/${level}/timings.csv`),
    note: "C3: New game at each level 10..175 (▼ from the virgin 175), No maze, no keys; tick start times after the start frame (at most 60 frames per level).",
    rows,
  };
}
