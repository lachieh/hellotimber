/** 4×4 cell sprites ('#' = set pixel). The chequered body look comes from
 * alternating solid and notched segments along the snake. */
export const SPRITE_HEAD: readonly string[] = [
  "####",
  "#..#", // 2px "eye" slot
  "####",
  "####",
];

export const SPRITE_BODY_NOTCH: readonly string[] = ["####", "#..#", "#..#", "####"];

export const SPRITE_BODY_SOLID: readonly string[] = ["####", "####", "####", "####"];

export const SPRITE_FOOD: readonly string[] = [
  "....",
  ".##.", // 2×2 centered dot
  ".##.",
  "....",
];

export const SPRITE_BONUS: readonly string[] = [
  ".##.", // bug: round back...
  "####",
  "####",
  "#..#", // ...and legs
];
