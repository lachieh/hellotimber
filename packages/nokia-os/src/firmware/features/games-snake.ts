// Snake II (Games › 8-1; plan 23): New game and Continue open the game, the Level page edits the
// numeric level, and the scores it writes. The game is src/widgets/snake.ts over
// src/games/snake/.
import { snakeLevel } from "../../widgets/level-bar";
import { snakeGame } from "../../widgets/snake";
import { nextSibling } from "../tree";
import type { StockFeature } from "./feature";

/** Snake II's level and its entries (plan 23 D10, Task 0 C8). */
export const SNAKE_LEVEL = {
  number: "8-1",
  newGame: "8-1-1",
  continue: { slug: "continue", label: "Continue" },
} as const;

export const snakeFeature: StockFeature = {
  name: "games-snake",
  screens: {
    // New game opens the game.
    [SNAKE_LEVEL.newGame]:
      ({ games, settings }) =>
      () =>
        snakeGame({ games, settings, start: "new" }),
    // The Level page edits the numeric level (D11). OK while a game is suspended discards it;
    // the selection stays on Level's row, now the next entry (Task 0 C8: `8-1-3`, Mazes).
    "8-1-2": ({ games, settings }, { number, screen }) => {
      const softkey = "softkey" in screen ? screen.softkey : undefined;
      if (softkey === undefined) throw new Error(`${number}: a level bar without a soft key.`);
      const after = nextSibling(number);
      const discard = (): string | undefined => {
        if (games.snake === undefined) return undefined;
        games.snake = undefined;
        return after;
      };
      return () => snakeLevel({ settings, key: "games/snake/level", softkey, onStore: discard });
    },
  },
  // While a game is suspended a Continue entry heads the list (`Continue / New game / Level /
  // …`, numbered by position `8-1-1`..`8-1-7`) and the level opens on it.
  leads: {
    [SNAKE_LEVEL.number]: {
      ...SNAKE_LEVEL.continue,
      shown: ({ games }) => games.snake !== undefined,
      open:
        ({ games, settings }) =>
        () =>
          snakeGame({ games, settings, start: "continue" }),
    },
  },
  widgets: {
    // Top score returns to the first entry on the bottom row (`Score IDs / Instructions / New
    // game`, P12): Continue while a game is suspended (Task 0 C8: `Score IDs / Instructions /
    // Continue`).
    noteEnds: {
      "8-1-4": ({ games }) => ({
        select: games.snake === undefined ? "new-game" : SNAKE_LEVEL.continue.slug,
      }),
    },
    // ▼ during Top score returns to New game and moves on to Level, which puts Level on the
    // bottom row (`Instructions / New game / Level`, `probe/games-top-score-down-2s` image m); ▲
    // there is UNVERIFIED and only dismisses.
    noteMoves: { "8-1-4": { down: "level" } },
  },
  settings: {
    // The level, 175 in the virgin EEPROM (D2: `game/snake/level-keys-virgin-up`, 167 ▼ from it
    // show eight bars), and the top score, the `Top score:` note's second line
    // (`tree/08-games/8-1-4.leaf`: 45). The game writes the top score; the Level page the level.
    virginNumbers: [
      { key: "games/snake/level", value: 175 },
      { key: "games/snake/top-score", number: "8-1-4", line: 1 },
    ],
    // Restore keeps the top score (v5.79 `5.79/plan15/before/8-1-4` and `after/`: 1297 both).
    restoreKeeps: ["games/snake/top-score"],
  },
};
