// Snake II (Games › 8-1; plan 23): New game opens the game, the Level page edits the numeric
// level, and the scores it writes. The game is src/widgets/snake.ts over src/games/snake/; its
// Continue, Top score and Level returns come from its row of GAME_LEVELS (features/games.ts).
import { levelPage } from "../../widgets/level-bar";
import { snakeGame } from "../../widgets/snake";
import type { StockFeature } from "./feature";
import { GAME_LEVEL_TABLES } from "./games";

export const snakeFeature: StockFeature = {
  name: "games-snake",
  screens: {
    // New game opens the game.
    "8-1-1":
      ({ games, settings }) =>
      () =>
        snakeGame({ games, settings, start: "new" }),
    // The Level page edits the numeric level (D11): nine bars at most. OK while a game is
    // suspended discards it; the selection stays on Level's row, now the next entry (Task 0 C8:
    // `8-1-3`, Mazes).
    "8-1-2": (services, { number, screen }) => {
      const softkey = "softkey" in screen ? screen.softkey : undefined;
      if (softkey === undefined) throw new Error(`${number}: a level bar without a soft key.`);
      const store = GAME_LEVEL_TABLES.levelStores[number];
      if (store === undefined) throw new Error(`${number}: not a game's Level page.`);
      return () =>
        levelPage({
          settings: services.settings,
          key: "games/snake/level",
          max: 9,
          bars: "level/snake",
          softkey,
          onStore: () => store(services),
        });
    },
  },
  widgets: {
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
