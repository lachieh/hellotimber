/** 4×4 cell sprites ('#' = set pixel), styled after the real Snake II
 * (reference: the classic in-game screenshot — wavy stepped body, diamond
 * food, open-jawed head, thin tapering tail). */

/** Rotate 4×4 string art 90° clockwise. */
export function rotateCW(art: readonly string[]): readonly string[] {
  const size = art.length;
  const out: string[] = [];
  for (let y = 0; y < size; y++) {
    let row = "";
    for (let x = 0; x < size; x++) row += art[size - 1 - x]![y] ?? ".";
    out.push(row);
  }
  return out;
}

/** Head facing RIGHT: blunt skull, open jaws toward the food. */
const HEAD_RIGHT: readonly string[] = ["###.", "##.#", "###.", "##.#"];

/** Head sprites by direction of travel. */
export const HEAD: Record<"up" | "right" | "down" | "left", readonly string[]> = (() => {
  const right = HEAD_RIGHT;
  const down = rotateCW(right);
  const left = rotateCW(down);
  const up = rotateCW(left);
  return { up, right, down, left };
})();

/** Food: the Snake II hollow diamond. */
export const SPRITE_FOOD: readonly string[] = [".#..", "#.#.", ".#..", "...."];

/** Bonus: the little beetle. */
export const SPRITE_BONUS: readonly string[] = ["#..#", ".##.", "####", ".##."];
