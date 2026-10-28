// Plan 24's goldens (docs/plans/24-games-space-impact-bantumi-pairs.md "Capture set"): Space
// impact's game goldens from the plan 24 Task 0 captures (`captures/6.39/plan24/`), through the
// shared game machinery (`../game-capture.ts`) with Space impact's frame predicate, tick rule
// and still selection.
import type { CaptureSetEntry, PlanCaptureSet } from "./capture-set.ts";
import {
  gameGolden,
  lit,
  region,
  screenGolden,
  shotsGolden,
  type GameCaptureIo,
  type KeyEdge,
  type PlayedFrame,
  type StillRule,
  type Tick,
  type TickRule,
} from "./game-capture.ts";
import { LCD_HEIGHT, LCD_WIDTH, type GoldenStatus } from "./golden-format.ts";
import { buildSoundGolden, KEYS_HEADER, type SoundCaptureIo } from "./sound-capture-set.ts";
import type { SoundGolden } from "./sound-format.ts";

// ---------------------------------------------------------------- pixel features

/** The engine period (Task 0: 12 timer units, ≈93 ms; H1). */
export const SPACE_IMPACT_PERIOD_MS = 93;
/** New game frame → first tick (Task 0 S3: 173 ms; planning 158 ms). */
export const SPACE_IMPACT_FIRST_TICK_MS = 173;
/** A gap this much longer than expected holds ticks that drew nothing (the pending code, H16). */
const SILENT_SLACK_MS = 45;

/** The HUD digits, 3x5 (Task 0 S3/S5: score, special count and the continue countdown). */
const DIGITS: Readonly<Record<string, number>> = {
  "111101101101111": 0,
  "010110010010010": 1,
  "111001111100111": 2,
  "111001111001111": 3,
  "101101111001001": 4,
  "111100111001111": 5,
  "111100111101111": 6,
  "111001010010010": 7,
  "111101111101111": 8,
  "111101111001111": 9,
};

/**
 * Levels 0, 4 and 5 draw on a full black fill (H17): a frame whose play field (y 6..47) is
 * mostly lit is inverted. Returns the pixels as on a white field.
 */
export function normalized(pixels: Uint8Array): Uint8Array {
  let on = 0;
  for (let i = 6 * LCD_WIDTH; i < LCD_WIDTH * LCD_HEIGHT; i++) on += pixels[i]!;
  if (on <= (LCD_WIDTH * (LCD_HEIGHT - 6)) / 2) return pixels;
  return pixels.map((v) => v ^ 1);
}

function digitsAt(pixels: Uint8Array, x: number, y: number, count: number): number | undefined {
  let value = 0;
  for (let k = 0; k < count; k++) {
    const digit = DIGITS[region(pixels, x + 4 * k, x + 4 * k + 2, y, y + 4)];
    if (digit === undefined) return undefined;
    value = value * 10 + digit;
  }
  return value;
}

/**
 * The HUD's top row: y 0 above the play field, or y 43 below it under the ceiling terrain of
 * levels 4 and 5 (Task 0 S5).
 */
export const HUD_ROWS: readonly number[] = [0, 43];

/**
 * The HUD of a normalized frame: the 5-digit score at x 57 and the special count at x 43, on
 * either HUD row, with the row between it and the play field clear.
 */
export function hud(
  pixels: Uint8Array,
): { score: number; special: number; row: number } | undefined {
  for (const row of HUD_ROWS) {
    const score = digitsAt(pixels, 57, row, 5);
    const special = digitsAt(pixels, 43, row, 2);
    if (score === undefined || special === undefined) continue;
    const gap = row === 0 ? 5 : row - 1;
    let clear = true;
    for (let x = 0; x < LCD_WIDTH && clear; x++) clear = !lit(pixels, x, gap);
    if (clear) return { score, special, row };
  }
  return undefined;
}

/**
 * A gameplay frame: the HUD (score, special count, a clear row between it and the play field)
 * in either polarity and either place. The continue screen, the fireworks, the notes and menus
 * are not.
 */
export function isSpaceImpactFrame(pixels: Uint8Array): boolean {
  return hud(normalized(pixels)) !== undefined;
}

/**
 * How a recording's ticks start: `new-game` (tick 0 is the New game frame, the first tick
 * SPACE_IMPACT_FIRST_TICK_MS later), `running` (tick 0 is any gameplay frame), or `continue`
 * (tick 0 is Continue's board, which stands until a key).
 */
export type TickStart = "new-game" | "running" | "continue";

/**
 * Space impact's ticks: gameplay frames every period; a longer gap holds ticks that drew
 * nothing, one per period (none while Continue's board stands).
 */
export function spaceImpactTicks(start: TickStart): TickRule {
  return {
    isGameFrame: isSpaceImpactFrame,
    periodMs: SPACE_IMPACT_PERIOD_MS,
    // Shots and specials are drawn at the key, 17-49 ms after it (S4); a tick comes 62 ms or
    // more after the last (S3, S5). Continue's board stands until the key.
    keyRedraw: {
      keys: ["1", "3", "4", "6"],
      latencyMs: 55,
      withinMs: (tick) => (start === "continue" && tick === 0 ? Infinity : 78),
    },
    silentTicks: (gap, fromTick) => {
      if (start === "continue" && fromTick === 0) return 0;
      const expect =
        start === "new-game" && fromTick === 0
          ? SPACE_IMPACT_FIRST_TICK_MS
          : SPACE_IMPACT_PERIOD_MS;
      if (gap <= expect + SILENT_SLACK_MS) return 0;
      return Math.max(0, Math.round((gap - expect) / SPACE_IMPACT_PERIOD_MS));
    },
  };
}

/** The ship, 10x7, without its gun row (row 3), which shots redraw (Task 0 S3). */
const SHIP = [
  "##........",
  ".##.###...",
  "..#.##.#..",
  ".#.####.##",
  "..#.##.#..",
  ".##.###...",
  "##........",
];
const SHIP_PIXELS: readonly (readonly [number, number])[] = SHIP.flatMap((row, y) =>
  y === 3 ? [] : row.split("").flatMap((c, x) => (c === "#" ? [[x, y] as const] : [])),
);

/** The ship's top-left in a normalized frame, if exactly one place shows it. */
export function shipAt(pixels: Uint8Array): { x: number; y: number } | undefined {
  let found: { x: number; y: number } | undefined;
  for (let y = 0; y <= LCD_HEIGHT - 7; y++) {
    for (let x = 0; x <= LCD_WIDTH - 10; x++) {
      if (!SHIP_PIXELS.every(([dx, dy]) => lit(pixels, x + dx, y + dy))) continue;
      if (found !== undefined) return undefined;
      found = { x, y };
    }
  }
  return found;
}

const MOVES: Readonly<Record<string, { dx: number; dy: number }>> = {
  "8": { dx: 0, dy: -1 },
  "0": { dx: 0, dy: 1 },
  "*": { dx: -1, dy: 0 },
  "#": { dx: 1, dy: 0 },
};

/**
 * Reads an ambiguous key edge from the frames: a move shows at the first tick after the game
 * takes it (the ship moves there, or, for a release, stops); a shot or special is drawn at the
 * key, so a frame between the key and the late tick's first frame is its redraw. Keys that
 * change nothing on the LCD (other keys, moves while the ship is not drawn) take the earlier
 * tick.
 */
function resolveEdge(
  frames: readonly PlayedFrame[],
  ticks: readonly Tick[],
): (edge: KeyEdge, before: Tick, late: Tick) => number | undefined {
  const byTick = new Map(ticks.map((t) => [t.tick, t]));
  const ship = (tick: number) => {
    const last = byTick.get(tick)?.last;
    return last === undefined ? undefined : shipAt(normalized(last.pixels));
  };
  return (edge, before, late) => {
    const move = MOVES[edge.key];
    if (move !== undefined) {
      const moved = (tick: number) => {
        const a = ship(tick - 1);
        const b = ship(tick);
        if (a === undefined || b === undefined) return undefined;
        return Math.sign(b.x - a.x) === move.dx && Math.sign(b.y - a.y) === move.dy;
      };
      const atLate = moved(late.tick);
      // No ship to move (an explosion, the level exit): the key changed nothing.
      if (atLate === undefined) return before.tick;
      if (edge.release) return atLate ? late.tick : before.tick;
      if (atLate) return before.tick;
      return moved(late.tick + 1) === true ? late.tick : before.tick;
    }
    if (!edge.release && ["1", "3", "4", "6"].includes(edge.key)) {
      const lateStart = late.first?.startMs ?? late.startMs;
      return frames.some((f) => f.startMs > edge.ms && f.startMs < lateStart)
        ? before.tick
        : late.tick;
    }
    return before.tick;
  };
}

/** The HUD of a gameplay frame as drawn (normalized), or "" for any other frame. */
function hudKey(pixels: Uint8Array): string {
  const normal = normalized(pixels);
  const found = hud(normal);
  if (found === undefined) return "";
  return region(normal, 0, LCD_WIDTH - 1, found.row, found.row + 4);
}

/** A HUD change: a life, a special weapon or its count, or the score. */
const hudChanged = (a: Uint8Array, b: Uint8Array): boolean => hudKey(a) !== hudKey(b);

/** Key probes: each input tick (presses and releases) and the two after it. */
export const INPUT_STILLS = {
  rule: { afterInput: 2 },
  note: "each key's tick and the two after it",
};

/** Games without keys: tick 0, HUD changes ±1, every 16th tick and the last 12. */
export const GAME_STILLS: { rule: StillRule; note: string } = {
  rule: { first: true, event: hudChanged, around: 1, every: 16, last: 12, afterInput: 0 },
  note: "tick 0, HUD changes (lives, special, score) ±1, every 16th tick, the last 12",
};

// ---------------------------------------------------------------- the table

const ROOT = "plan24";

/** What a golden's recording is: game ticks (stills or a timeline), a screen timeline, shots. */
type Spec =
  | {
      readonly kind: "game";
      readonly name: string;
      readonly dirs: readonly string[];
      readonly start: TickStart;
      readonly stills?: { readonly rule: StillRule; readonly note: string };
      readonly note: string;
    }
  | {
      readonly kind: "screen";
      readonly name: string;
      readonly dir: string;
      readonly note: string;
      readonly from?: number;
    }
  | {
      readonly kind: "shots";
      readonly name: string;
      readonly files: readonly string[];
      readonly note: string;
    };

const CLOCKS = [
  ["0759", "07:59"],
  ["1010", "10:10"],
  ["1948", "19:48"],
  ["2359", "23:59"],
] as const;

const KEY_PROBES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "star", "hash", "up", "down"];
const KEY_NAME: Readonly<Record<string, string>> = { star: "*", hash: "#", up: "▲", down: "▼" };

const SPECS: readonly Spec[] = [
  // S1 the splash
  ...CLOCKS.map(
    ([tag, clock]): Spec => ({
      kind: "screen",
      name: `splash-${tag}`,
      dir: `splash/${tag}/nokey`,
      note: `S1: 13.10.2026 ${clock}, Select on Space impact (frame 0, the Games list) and no key: the splash, its 30 stars drawn from the clock's seed, then the game menu (New game).`,
    }),
  ),
  ...(
    [
      ["navi", "Navi"],
      ["c", "C"],
      ["1", "1"],
      ["down", "▼"],
    ] as const
  ).map(
    ([tag, key]): Spec => ({
      kind: "screen",
      name: `splash-key-${tag}`,
      dir: `splash/key-${tag}`,
      note: `S1: 10:10, Select on Space impact, then ${key} 300 ms later: the game menu at once.`,
    }),
  ),
  // S2 pause and Continue
  {
    kind: "game",
    name: "pause-nav",
    dirs: ["pause/nav"],
    start: "new-game",
    note: "S2: New game, Navi between ticks 10 and 11: Continue / New game / Top score / Score IDs / Instructions, on Continue.",
  },
  {
    kind: "shots",
    name: "pause-list",
    files: [1, 2, 3, 4, 5, 6, 7].map((i) => `pause/list/${String(i).padStart(2, "0")}.png`),
    note: "S2: the pause list after pause-nav, then ▼ per image through the wrap (8-2-1..8-2-5).",
  },
  {
    kind: "screen",
    name: "pause-c",
    dir: "pause/c",
    note: "S2: C on the pause list: the Games list (Space impact highlighted).",
  },
  {
    kind: "screen",
    name: "pause-reenter",
    dir: "pause/reenter",
    note: "S2: after pause-c, Select on Space impact: the splash, then the game menu on Continue.",
  },
  {
    kind: "screen",
    name: "pause-from-standby",
    dir: "pause/from-standby",
    note: "S2: suspended, C to standby, Menu, Games, Space impact: the splash, then the game menu on Continue.",
  },
  ...(
    [
      ["continue", "no key for 4 s: the board stands"],
      ["continue-8", "8 at 4.6 s: the game resumes, the ship moving up"],
      ["continue-1", "1 at 4.6 s: a shot at once, then the game resumes"],
      ["continue-navi", "Navi at 4.6 s: the pause list again"],
    ] as const
  ).map(
    ([tag, what]): Spec => ({
      kind: "game",
      name: `pause-${tag}`,
      dirs: [`pause/${tag}`],
      start: "continue",
      note: `S2: Select on Continue after pause-nav (frame 0, the pause list): the board ≈80 ms later, then ${what}. Ticks after the key count its redraw as one.`,
    }),
  ),
  {
    kind: "game",
    name: "pause-new-game",
    dirs: ["pause/new-game"],
    start: "new-game",
    note: "S2: suspended, ▼ to New game, Select: a new game.",
  },
  {
    kind: "screen",
    name: "pause-top-score",
    dir: "pause/top-score",
    note: "S2: suspended, Top score: the note, then the game menu.",
  },
  {
    kind: "game",
    name: "pause-c-during-play",
    dirs: ["pause/c-during-play"],
    start: "new-game",
    note: "S2: New game, C between ticks 10 and 11: the pause list, like Navi.",
  },
  // S3 no keys
  {
    kind: "game",
    name: "nokeys",
    dirs: ["nokeys/game"],
    start: "new-game",
    note: "S3: the virgin game with no keys: three deaths, the continue screen, the fireworks (70 beats the virgin 45), TOP SCORE:, the game menu.",
  },
  {
    kind: "screen",
    name: "nokeys-top-score",
    dir: "nokeys/top-score",
    note: "S3: Top score after the no-key game: 70.",
  },
  // S4 keys
  ...KEY_PROBES.flatMap((key): Spec[] => [
    {
      kind: "game",
      name: `keys-tap-${key}`,
      dirs: [`keys/tap-${key}`],
      start: "new-game",
      stills: INPUT_STILLS,
      note: `S4: New game, ${KEY_NAME[key] ?? key} tapped after tick 40 (the shield gone).`,
    },
    {
      kind: "game",
      name: `keys-hold-${key}`,
      dirs: [`keys/hold-${key}`],
      start: "new-game",
      stills: INPUT_STILLS,
      note: `S4: New game, ${KEY_NAME[key] ?? key} held from tick 40 to tick 60.`,
    },
  ]),
  ...(
    [
      ["pair-8-8", "8 twice between ticks 40 and 41"],
      ["pair-8-0", "8 then 0 between ticks 40 and 41"],
      ["pair-8-1", "8 then 1 between ticks 40 and 41"],
      ["pair-1-1", "1 twice between ticks 40 and 41"],
      ["fire-every", "1 after every tick from 40 to 51"],
      ["hold-1-40", "1 held from tick 40 to tick 80"],
      ["hold-3-40", "3 held from tick 40 to tick 80"],
      ["special-4", "4 every 12 ticks from tick 40, five times (three specials)"],
      ["special-6", "6 every 12 ticks from tick 40, five times (three specials)"],
      ["shield", "1 after tick 1, during the shield"],
    ] as const
  ).map(
    ([tag, what]): Spec => ({
      kind: "game",
      name: `keys-${tag}`,
      dirs: [`keys/${tag}`],
      start: "new-game",
      stills: INPUT_STILLS,
      note: `S4: New game, ${what}.`,
    }),
  ),
  ...(
    [
      ["1", "1: the level restarts"],
      ["3", "3: the level restarts"],
      ["4", "4: the level restarts"],
      ["6", "6: the level restarts"],
      ["5", "5: ignored"],
      ["8", "8: ignored"],
      ["navi", "Navi"],
      ["c", "C"],
    ] as const
  ).map(
    ([tag, what]): Spec => ({
      kind: "screen",
      name: `keys-continue-${tag}`,
      dir: `keys/continue-${tag}`,
      note: `S4: the no-key game's continue screen at 03 (frame 0), then ${what}.`,
    }),
  ),
  ...["0759", "1010", "1948", "2359", "0000", "1010-14102026"].flatMap((tag): Spec[] => [
    {
      kind: "screen",
      name: `seed-${tag}.splash`,
      dir: `seed/${tag}/splash`,
      note: `S7: ${tag}, the independently reviewed splash; its seed is not gameplay seed proof.`,
    },
    {
      kind: "game",
      name: `seed-${tag}`,
      dirs: [`seed/${tag}/game`],
      start: "new-game",
      stills: GAME_STILLS,
      note: `S7: ${tag}, recorded gameplay. Gameplay seed recovery is UNVERIFIED; no splash or RAM seed is injected as proof.`,
    },
  ]),
  ...[1, 2].map(
    (game): Spec => ({
      kind: "game",
      name: `ansi-game${game}`,
      dirs: [`ansi/game${game}`],
      start: "new-game",
      stills: GAME_STILLS,
      note: `S8: game ${game} in one power cycle, level-1 random rows at ANSI positions ${game === 1 ? "1-6" : "8-13"}. Original ending tails are unrecorded; independent ending controls establish the top-score draw, not those missing tails.`,
    }),
  ),
  ...[1, 2, 3].flatMap((game): Spec[] => [
    {
      kind: "game",
      name: `after-game${game}`,
      dirs: [`after/game${game}`],
      start: "new-game",
      note: `S10: game ${game}, the complete recorded no-key game and ending before its Top score check.`,
    },
    {
      kind: "screen",
      name: `after-top-score-${game}`,
      dir: `after/top-score-${game}`,
      note: `S10: Top score after game ${game}.`,
    },
  ]),
  ...["fireworks", "your-score"].flatMap((phase) =>
    ["navi", "c", "down"].flatMap((key) =>
      [1500, 4000].map(
        (ms): Spec => ({
          kind: "screen",
          name: `gameover-${phase}-${key}-${ms}`,
          dir: `after/${phase}-key-${key}-${ms}`,
          note: `S10: ${key} ${ms} ms into the ${phase} ending; preserve every recorded transition.`,
        }),
      ),
    ),
  ),
  ...[
    "level-0.beam-enemy",
    "level-0.beam-boss",
    "level-2.wall-boss",
    "level-2.wall-enemy",
    "level-2.wall-enemy-targeted",
  ].flatMap((probe) =>
    ["control", "special"].map(
      (arm): Spec => ({
        kind: "game",
        name: `variety-${probe}-${arm}`,
        dirs: [`special-evidence-20261027b/${probe}-${arm}`],
        start: "running",
        note: `S6 paired unmodified probe ${probe}, ${arm} arm. Same validated stream to the observed LCD anchor, then fixed key edges. Ordinary-enemy wall damage remains the accepted UNVERIFIED four-HP default; these controls do not establish it.`,
      }),
    ),
  ),
  ...["game1", "game2"].map(
    (game): Spec => ({
      kind: "game",
      name: `ansi-nokeys-${game}`,
      dirs: [`ansi-nokeys-20261027/${game}`],
      start: "new-game",
      note: `S8 continuous ending control ${game}: first game beats 45 with 70 (one ANSI draw); second ties 70 (no ending draw).`,
    }),
  ),
  {
    kind: "game",
    name: "ansi-first-after-reboot",
    dirs: ["ansi-top-score-20261027/first-after-reboot"],
    start: "new-game",
    note: "S8: first game after reboot, earned top score 70 retained; tied-score ending consumes no ANSI draw.",
  },
];

/**
 * Level recordings of the look-ahead bot (S5 `full`, S6 varieties): each level from its first
 * frame (level 0 from Select), its restarts after a continue, its exit (from the boss kill's
 * +100), and the end. The accepted 2026-10-27 scope keeps every full-level frame; varieties
 * keep the HUD events and input ticks. No unreviewed census can thin the full-level evidence.
 */
const VARIETY_STILLS: { rule: StillRule; note: string } = {
  rule: { first: true, event: hudChanged, around: 2, every: 16, last: 12, afterInput: 0 },
  note: "tick 0, HUD changes (kills, pickups, specials, lives) ±2, every 16th tick, the last 12",
};

const BOT_RUNS: readonly {
  readonly run: string;
  readonly levels: readonly number[];
  readonly stills?: { rule: StillRule; note: string };
  readonly what: string;
}[] = [
  {
    run: "full",
    levels: [0, 1, 2, 3, 4, 5, 6, 7],
    what: "S5: the look-ahead bot from New game to the end of the game (Warning tones On)",
  },
  {
    run: "deaths-0",
    levels: [0],
    stills: VARIETY_STILLS,
    what: "S6 deaths: no keys in level 0 until the continue screen, 1 to continue, then the bot",
  },
  {
    run: "deaths-3",
    levels: [3],
    stills: VARIETY_STILLS,
    what: "S6 deaths: from S5's level 3, no keys through three continue screens (3, 4, then none)",
  },
  {
    run: "deaths-3-key1",
    levels: [3],
    stills: VARIETY_STILLS,
    what: "S6 deaths: level 3's reviewed two key-1 Continues, final refusal and ending",
  },
  {
    run: "cap",
    levels: [1],
    stills: VARIETY_STILLS,
    what: "S6 cap: from S5's level 1, 1 held for 30 ticks, then the bot",
  },
];

function botSpecs(io: GameCaptureIo): Spec[] {
  const specs: Spec[] = [];
  const exists = (dir: string) => io.recording(`${ROOT}/${dir}`) !== undefined;
  for (const { run, levels, stills, what } of BOT_RUNS) {
    const prefix = run === "full" ? "level" : `${run}-level`;
    for (const level of levels) {
      const dir = `bot/${run}/level-${level}`;
      if (!exists(dir)) continue;
      specs.push({
        kind: "game",
        name: `${prefix}-${level}`,
        dirs: [dir],
        start:
          level === 0 && (run === "full" || run === "bonus" || run === "deaths-0")
            ? "new-game"
            : "running",
        ...(stills === undefined ? {} : { stills }),
        note: `${what}: level ${level} from its first frame${level === 0 ? " (frame 0: the menu, Select)" : ""}.`,
      });
      for (const k of [1, 2, 3]) {
        const tag = k === 1 ? "restart" : `restart-${k}`;
        if (!exists(`${dir}.${tag}`)) continue;
        specs.push({
          kind: "game",
          name: `${prefix}-${level}.${tag}`,
          dirs: [`${dir}.${tag}`],
          start: "running",
          ...(stills === undefined ? {} : { stills }),
          note: `${what}: level ${level} restarted after continue ${k}.`,
        });
      }
      if (exists(`${dir}.exit`)) {
        specs.push({
          kind: "screen",
          name: `${prefix}-${level}.exit`,
          dir: `${dir}.exit`,
          note: `${what}: level ${level}'s exit from the boss kill's +100 (frame 0): the ship lines up and flies off${level === 7 ? ", and the end of the game" : ""}.`,
        });
      }
    }
    if (exists(`bot/${run}/end`)) {
      specs.push({
        kind: "screen",
        name: run === "full" ? "end" : `${run}-end`,
        dir: `bot/${run}/end`,
        note: `${what}: the end of the game to the game menu.`,
      });
    }
  }
  return specs;
}

/** How the ticks of golden `id` are numbered (the importer's rule; the integrity test's). */
export function spaceImpactStart(id: string): TickStart {
  const name = id.slice("game/space-impact/".length);
  const spec = SPECS.find((s) => s.name === name);
  if (spec?.kind === "game") return spec.start;
  return /^(level|bonus-level|deaths-0-level)-0$/.test(name) ? "new-game" : "running";
}

function entry(spec: Spec, io: GameCaptureIo): CaptureSetEntry {
  const id = `game/space-impact/${spec.name}`;
  const status: GoldenStatus = "pending:24";
  if (spec.kind === "shots")
    return shotsGolden({ id, root: ROOT, files: spec.files, note: spec.note, status });
  if (spec.kind === "screen") {
    return screenGolden(
      {
        id,
        root: ROOT,
        dir: spec.dir,
        note: spec.note,
        status,
        ...(spec.from === undefined ? {} : { from: spec.from }),
      },
      io,
    );
  }
  return gameGolden(
    {
      id,
      root: ROOT,
      dirs: spec.dirs,
      ticks: spaceImpactTicks(spec.start),
      note: spec.note,
      status,
      ...(spec.stills === undefined ? {} : { stills: spec.stills }),
      resolve: resolveEdge,
      triggerNote: (frame) =>
        spec.start === "new-game"
          ? `Frame ${frame} is the New game frame (tick 0).`
          : `Frame ${frame} is tick 0.`,
    },
    io,
  );
}

/** Space impact's LCD goldens, in table order. */
export function spaceImpactCaptureSet(io: GameCaptureIo): CaptureSetEntry[] {
  return [...SPECS, ...botSpecs(io)].map((spec) => entry(spec, io));
}

// ---------------------------------------------------------------- sound goldens

/**
 * Plan 24's `keys.csv` (`tick,key,press_ms,release_ms`) in plan 16's form (`key,down_ms,up_ms`)
 * for the sound machinery.
 */
export function soundKeys(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const [header, ...rows] = text.trim().split("\n");
  if (header !== "tick,key,press_ms,release_ms") return text;
  return [
    KEYS_HEADER,
    ...rows.map((row) => {
      const [, key, down, up] = row.split(",");
      return `${key},${down},${up}`;
    }),
  ].join("\n");
}

const SOUNDS: readonly { readonly name: string; readonly dir: string; readonly note: string }[] = [
  {
    name: "nokeys-warning-on",
    dir: "sound/warning-on/game",
    note: "S9: Tones › Warning tones On, the no-key game: three deaths (sound and the vibrator), the continue screen, the fireworks tune.",
  },
  {
    name: "nokeys-sounds-off",
    dir: "sound/sounds-off/game",
    note: "S9: Warning tones On, Games › Settings › Sounds Off, the no-key game: the vibrator only.",
  },
  {
    name: "nokeys-shakes-off",
    dir: "sound/shakes-off/game",
    note: "S9: Warning tones On, Games › Settings › Shakes Off, the no-key game: sounds without the vibrator.",
  },
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((level) => ({
    name: `level-${level}`,
    dir: `bot/full/level-${level}`,
    note: `S5 (Warning tones On): level ${level} of the bot's game: shots, kills, deaths, bonuses and the boss.`,
  })),
  ...[
    "level-0.beam-enemy",
    "level-0.beam-boss",
    "level-2.wall-boss",
    "level-2.wall-enemy",
    "level-2.wall-enemy-targeted",
  ].flatMap((probe) =>
    ["control", "special"].map((arm) => ({
      name: `variety-${probe}-${arm}`,
      dir: `special-evidence-20261027b/${probe}-${arm}`,
      note: `S9: isolated ${probe} ${arm} arm with its exact keys, paired LCD and audio.`,
    })),
  ),
  { name: "end", dir: "bot/full/end", note: "S5/S9: full game's ending and fireworks tune." },
];

/** Space impact's sound goldens (plan 16 format), from recordings with their keys. */
export function spaceImpactSounds(io: SoundCaptureIo): SoundGolden[] {
  const converted: SoundCaptureIo = { ...io, keys: (dir) => soundKeys(io.keys(dir)) };
  return SOUNDS.filter((s) => io.events(`${ROOT}/${s.dir}`) !== undefined).map((s) =>
    buildSoundGolden(
      {
        id: `sound/game/space-impact/${s.name}`,
        dir: `${ROOT}/${s.dir}`,
        state: "virgin",
        status: "pending:24",
        note: s.note,
      },
      converted,
    ),
  );
}

export const spaceImpact: PlanCaptureSet = {
  plan: "24",
  lcd: (io) => spaceImpactCaptureSet(io.game),
  sounds: (io) => spaceImpactSounds(io.sound),
  notImported: {
    "plan24/slot/": "D10's per-game suspension, encoded by tests/game-seams.test.ts (Task 2)",
    "plan24/identifiability/, plan24/seed-fit/, plan24/*/peek.json, plan24/driver-proof/":
      "RAM cross-checks and the capture bot's proofs (planning evidence, never goldens)",
    "scratch-plan24/": "planning probes (plan 24 Planning investigation)",
    "plan24/*.wav": "the emulator's synthesis, not firmware output (plan 16 D1)",
  },
};
