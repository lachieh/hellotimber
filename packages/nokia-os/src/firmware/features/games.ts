// Games (menu 8; plans 23 and 24): the games holder every game shares (one suspended state per
// game, the New-game seed, cues and the kernel clock), the table of game levels that lists each
// level's Continue and routes its Top score and Level returns (plan 24 D10), and the games that
// are not built yet: their fixed Level bars, virgin top scores, and Club Nokia's ID query.
import { spaceImpactGame } from "./space-impact";
import { createAnsiRandom, type AnsiRandom } from "../../kit/apps/games/random";
import { gameSeed } from "../../kit/apps/games/seed";
import type { Widget } from "../../kit/ui/widgets/flow";
import { snakeGame } from "../../widgets/snake";
import { NO_CUES, type StockCueSink } from "../../kit/system/cues";
import type { StockPorts } from "../../kit/system/ports";
import { nextSibling } from "../tree";
import { STOCK_TREE } from "../generated/stock-tree";
import type { LeadEntry, NoteEndBinding, StockFeature, StockServices } from "./feature";

/**
 * The games that suspend (D10). Pairs II's two modes are provisional: whether they share one
 * state is plan 24c's question (`pairs2/out-e6`).
 */
export type StockGameId =
  | "snake"
  | "space-impact"
  | "bantumi"
  | "pairs-time-trial"
  | "pairs-puzzle";

/**
 * What the games share per phone (like the settings store): each game's suspended state, the
 * seed New game takes, the cue sink and the kernel clock that stamps cues.
 */
export interface StockGames {
  /**
   * A state per suspended game (D10: Snake II and Space impact keep Continue together, in both
   * orders, plan 24 Task 0 S2). Each game reads and writes only its own entry.
   */
  suspended: Partial<Record<StockGameId, unknown>>;
  /** The seed New game writes (D5). */
  seed(): number;
  /**
   * Phone-wide random-row chain; replaced only at power-on. UNVERIFIED accepted default:
   * other games and Settings leave it unchanged; plans 24b/24c revisit their consumers.
   */
  ansi: AnsiRandom;
  readonly cues: StockCueSink;
  now(): number;
  /** Phone events that suspend an active game (plan 21). */
  events?(): number;
}

/**
 * A phone's games holder: no suspended game, New game seeded from the clock port's minutes of
 * the day (D5 fallback, UNVERIFIED; 0 without a clock), no cue sink, and a clock that reads 0
 * unless the phone supplies the kernel time.
 */
export function createStockGames(ports: StockPorts = {}, now: () => number = () => 0): StockGames {
  return {
    suspended: {},
    ansi: createAnsiRandom(),
    seed: () => gameSeed(ports.clock?.(), ports.date?.()) ?? 0,
    cues: NO_CUES,
    now,
  };
}

/** Reset the phone-wide random chain at power-on; New game and Continue keep it. */
export function powerOnGames(games: StockGames): void {
  games.ansi = createAnsiRandom();
}

/** Power-off loses every suspended game; standby keeps them (plan 23 Task 0 C8). */
export function powerOffGames(games: StockGames): void {
  games.suspended = {};
}

/** A game's level in the Games menu. */
export interface GameLevel {
  /** The level's node (`8-1`). */
  readonly number: string;
  /** Its New game (`8-1-1`), which discards the suspended game. */
  readonly newGame: string;
  readonly game: StockGameId;
  /** The flow Continue opens: the board stands until a key, which then reaches the game. */
  readonly continue: (services: StockServices) => () => Widget;
  /**
   * Its Top score note, which returns to Continue while the game is suspended and to New game
   * otherwise, on the bottom row unless `row` is "top".
   */
  readonly topScore?: { readonly number: string; readonly row?: "top" };
  /**
   * Its Level page: OK while the game is suspended discards the game, and the selection moves
   * to the entry after Level (plan 23 Task 0 C8).
   */
  readonly level?: string;
}

const CONTINUE = { slug: "continue", label: "Continue" } as const;

/** The levels whose games suspend; a plan adds its game with one line. */
export const GAME_LEVELS: readonly GameLevel[] = [
  {
    number: "8-1",
    newGame: "8-1-1",
    game: "snake",
    continue:
      ({ games, settings }) =>
      () =>
        snakeGame({ games, settings, start: "continue" }),
    topScore: { number: "8-1-4" },
    level: "8-1-2",
  },
  {
    number: "8-2",
    newGame: "8-2-1",
    game: "space-impact",
    continue:
      ({ games }) =>
      () =>
        spaceImpactGame({ games, start: "continue" }),
    topScore: { number: "8-2-2", row: "top" },
  },
];

export interface GameLevelTables {
  /** Continue heading each level while its game is suspended (positional numbers follow). */
  readonly leads: Readonly<Record<string, LeadEntry>>;
  readonly noteEnds: Readonly<Record<string, (services: StockServices) => NoteEndBinding>>;
  /** What OK on each Level page does: the slug it selects, if any. */
  readonly levelStores: Readonly<Record<string, (services: StockServices) => string | undefined>>;
}

/** The tables `levels` contribute; a game or node listed twice throws. */
export function gameLevelTables(levels: readonly GameLevel[]): GameLevelTables {
  const games = new Set<StockGameId>();
  const leads: Record<string, LeadEntry> = {};
  const noteEnds: Record<string, (services: StockServices) => NoteEndBinding> = {};
  const levelStores: Record<string, (services: StockServices) => string | undefined> = {};
  for (const level of levels) {
    const { game } = level;
    if (games.has(game) || level.number in leads) {
      throw new Error(`Game level ${level.number} (${game}) is listed twice.`);
    }
    games.add(game);
    leads[level.number] = {
      ...CONTINUE,
      shown: ({ games }) => games.suspended[game] !== undefined,
      open: level.continue,
    };
    const topScore = level.topScore;
    if (topScore !== undefined) {
      noteEnds[topScore.number] = ({ games }) => ({
        select: games.suspended[game] === undefined ? "new-game" : CONTINUE.slug,
        ...(topScore.row === undefined ? {} : { row: topScore.row }),
      });
    }
    const page = level.level;
    if (page !== undefined) {
      const after = nextSibling(STOCK_TREE, page);
      levelStores[page] = ({ games }) => {
        if (games.suspended[game] === undefined) return undefined;
        delete games.suspended[game];
        return after;
      };
    }
  }
  return { leads, noteEnds, levelStores };
}

export const GAME_LEVEL_TABLES: GameLevelTables = gameLevelTables(GAME_LEVELS);

export const gamesFeature: StockFeature = {
  name: "games",
  placeholders: {
    "8-3-1": "24", // Bantumi › New game
    "8-4-1-1": "24", // Pairs II › Time trial › New game
    "8-4-2-1": "24", // Pairs II › Puzzle › New game
  },
  screens: {
    "8-2-1":
      ({ games }) =>
      () =>
        spaceImpactGame({ games, start: "new" }),
  },
  leads: GAME_LEVEL_TABLES.leads,
  widgets: {
    // The fixed level bar each game's Level shows (virgin EEPROM; Pairs II's two modes share
    // one) until plan 24 measures them.
    levelBars: { "8-3-2": "level/8-3", "8-4-1-2": "level/8-4", "8-4-2-2": "level/8-4" },
    noteEnds: {
      ...GAME_LEVEL_TABLES.noteEnds,
      // Top score returns to New game on the top row, the window rebuilt at it (`New game / Top
      // score / Score IDs`, `tree/08-games/8-2-2.leaf`, `8-4-1-3.leaf`, `8-4-2-3.leaf` image m).
      "8-4-*-3": { select: "new-game", row: "top" },
    },
    // Club Nokia › Club Nokia ID asks for the ID (probe/confirm-8-6-4-ok image c: no value). It
    // has no recording of its own: its cursor steps (474, 481, 481, 479, 481, 479, 481, 482 ms)
    // start within ±2 ms of the Closed user group number prompt's (476, 480, 481, 479, 481, 480,
    // 481, 479 ms), a prompt of the same layout.
    queryResults: {
      "Replace old ID?": {
        kind: "prompt",
        lines: ["Club Nokia ID:"],
        softkey: "OK",
        layout: { icons: ["pen"], entry: "end" },
        blink: "6-3-4-2",
      },
    },
  },
  settings: {
    // Pairs II's top scores start at zero; each game writes them and Restore keeps them.
    virginNumbers: [
      { key: "games/pairs-ii/time-trial/top-score", number: "8-4-1-3", line: 1 },
      { key: "games/pairs-ii/puzzle/top-score", number: "8-4-2-3", line: 1 },
    ],
    restoreKeeps: ["games/pairs-ii/time-trial/top-score", "games/pairs-ii/puzzle/top-score"],
  },
};
