import type { Cell } from "./types";

export const MAZE_NAMES: readonly string[] = [
  "No maze",
  "Box",
  "Tunnel",
  "Mill",
  "Rails",
  "Apartment",
];

const EMPTY = ".....................";

/**
 * 21×10 playfield mazes; '#' = wall cell, '.' = free.
 * Box is the authentic Snake II perimeter maze. Tunnel/Mill/Rails/Apartment are
 * plausible approximations of the originals (exact layouts are UNVERIFIED — see
 * docs/specs/nokia-3310.md §7). All mazes keep the snake start row (y=5, x=4..10)
 * free.
 */
export const MAZE_ART: readonly (readonly string[])[] = [
  // 0 — No maze
  [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  // 1 — Box: perimeter wall
  [
    "#####################",
    "#...................#",
    "#...................#",
    "#...................#",
    "#...................#",
    "#...................#",
    "#...................#",
    "#...................#",
    "#...................#",
    "#####################",
  ],
  // 2 — Tunnel: two wall bands form a central corridor, open at the wrap edges
  [
    EMPTY,
    EMPTY,
    EMPTY,
    "######.........######",
    EMPTY,
    EMPTY,
    "######.........######",
    EMPTY,
    EMPTY,
    EMPTY,
  ],
  // 3 — Mill: pinwheel arms, 180°-rotationally symmetric
  [
    EMPTY,
    "......#..............",
    "......#..............",
    "......#......######..",
    EMPTY,
    EMPTY,
    "..######......#......",
    "..............#......",
    "..............#......",
    EMPTY,
  ],
  // 4 — Rails: two long parallel rails
  [
    EMPTY,
    "..#################..",
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    EMPTY,
    "..#################..",
    EMPTY,
    EMPTY,
  ],
  // 5 — Apartment: perimeter + room dividers with doorways
  [
    "#####################",
    "#.........#.........#",
    "#.........#.........#",
    "#...................#",
    "####...#######...####",
    "#...................#",
    "#.........#.........#",
    "#.........#.........#",
    "#.........#.........#",
    "#####################",
  ],
];

/** Expand a maze's string art into wall cells. Unknown index → No maze. */
export function parseMaze(index: number): Cell[] {
  const art = MAZE_ART[index] ?? MAZE_ART[0];
  const walls: Cell[] = [];
  art.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "#") walls.push({ x, y });
    }
  });
  return walls;
}
