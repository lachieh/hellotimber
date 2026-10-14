// Games (menu 8) other than Snake II (plan 24 implements Space impact, Bantumi and Pairs II):
// their fixed Level bars, virgin top scores, Top score's return, and Club Nokia's ID query.
import type { StockFeature } from "./feature";

export const gamesFeature: StockFeature = {
  name: "games",
  placeholders: {
    "8-2-1": "24", // Space impact › New game
    "8-3-1": "24", // Bantumi › New game
    "8-4-1-1": "24", // Pairs II › Time trial › New game
    "8-4-2-1": "24", // Pairs II › Puzzle › New game
  },
  widgets: {
    // The fixed level bar each game's Level shows (virgin EEPROM; Pairs II's two modes share
    // one) until plan 24 measures them.
    levelBars: { "8-3-2": "level/8-3", "8-4-1-2": "level/8-4", "8-4-2-2": "level/8-4" },
    // Top score returns to New game on the top row, the window rebuilt at it (`New game / Top
    // score / Score IDs`, `tree/08-games/8-2-2.leaf`, `8-4-1-3.leaf`, `8-4-2-3.leaf` image m).
    noteEnds: {
      "8-2-2": { select: "new-game", row: "top" },
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
    // `Top score:` / the score: uninitialised game EEPROM (Space impact) and zero (Pairs II).
    virginTexts: [
      { key: "games/space-impact/top-score", number: "8-2-2", line: 1 },
      { key: "games/pairs-ii/time-trial/top-score", number: "8-4-1-3", line: 1 },
      { key: "games/pairs-ii/puzzle/top-score", number: "8-4-2-3", line: 1 },
    ],
  },
};
