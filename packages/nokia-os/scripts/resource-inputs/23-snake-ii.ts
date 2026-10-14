import type { ResourceDeclarations, SpriteCrop } from "../resource-declarations.ts";
import type { TextRun } from "../harvest-glyphs.ts";
/** A game-over note (plan 23 D13): large lines from x 0 at tops 3, 18 and 33. */
function gameOver(label: string, score: string): TextRun[] {
  return [
    { font: "large", text: "Game over!", top: 3 },
    { font: "large", text: label, top: 18 },
    { font: "large", text: score, top: 33 },
  ];
}

type Rect = Pick<SpriteCrop, "x0" | "x1" | "y0" | "y1">;

const FULL: Rect = { x0: 0, x1: 83, y0: 0, y1: 47 };

/** One sprite per image, ids `<id>-1`, `<id>-2`, … in the order given. */
function frames(
  id: string,
  group: string,
  golden: string,
  images: readonly string[],
  rect: Rect,
): SpriteCrop[] {
  return images.map((image, i) => ({ id: `${id}-${i + 1}`, group, golden, image, ...rect }));
}

export const resources: ResourceDeclarations = {
  textRuns: {
    // Snake II's game-over notes (plan 23): Your score: 4 and 8, TOP SCORE: 105.
    "game/snake/bot-short.death": { c: gameOver("Your score:", "4") },
    "game/snake/score-8.death": { c: gameOver("Your score:", "8") },
    "game/snake/bot-long.death": { h: gameOver("TOP SCORE:", "105") },
  },
  glyphOverrides: [
    // game/snake/bot-long.death "h" ("TOP SCORE:", plan 23): the leg runs into a following E too.
    { kind: "touch", font: "large", pair: "RE", width: 8 },
    // game/snake/score-8.death "c" ("8", plan 23): '8' ink is 7 columns, a full large digit cell.
    { kind: "advance", font: "large", char: "8", advance: 8 },
  ],
  spriteBatches: [
    {
      order: 20,
      entries: [
        // Snake II's Level page at each stored level 1..9 (plan 23 C1, D11): `min(level, 9)` bars.
        ...Array.from({ length: 9 }, (_, i) => ({
          id: `level/snake-${i + 1}`,
          group: "level-snake" as const,
          golden: `game/snake/level-${i + 1}`,
          image: `${i + 1}`,
          x0: 5,
          x1: 74,
          y0: 13,
          y1: 36,
        })),
        // Game over (plan 23 D13): a new top score's six full-screen fireworks pictures, and the
        // note's first line, `Game over!` (the lines below it carry the score and vary).
        ...frames(
          "fireworks",
          "fireworks",
          "game/snake/bot-long.death",
          ["b", "c", "d", "e", "f", "g"],
          FULL,
        ),
        {
          id: "game-over/title",
          group: "game-over",
          golden: "game/snake/bot-short.death",
          image: "c",
          x0: 0,
          x1: 83,
          y0: 0,
          y1: 16,
        },
      ],
    },
  ],
  timelineGroups: { "game-over": ["fireworks", "game-over"] },
  timelineBatches: [
    {
      order: 40,
      entries: [
        // Plan 23 D13: Game over! / Your score: (the short game), and the fireworks before Game over!
        // / TOP SCORE: (the long game's new top score), each until the game menu returns.
        { golden: "game/snake/bot-short.death", kind: "game-over", name: "game-over-note" },
        { golden: "game/snake/bot-long.death", kind: "game-over", name: "game-over-fireworks" },
      ],
    },
  ],
};
