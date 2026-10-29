import type { RandomSource } from "../random";
import type { SpaceImpactHud } from "./model";

/** H9, UNVERIFIED: draw mapping and stacking await seeded full-level replay. */
export function spaceImpactBonus(random: RandomSource, hud: SpaceImpactHud): SpaceImpactHud {
  let kind: number;
  // Accepted UNVERIFIED default: cap at five lives, reroll on the same game RNG.
  do kind = random.next() & 3;
  while (kind === 0 && hud.lives >= 5);
  if (kind === 0) return { ...hud, lives: hud.lives + 1 };
  const weapon = kind === 1 ? "missile" : kind === 2 ? "wall" : "beam";
  const amount = weapon === "beam" ? 1 : 3;
  return { ...hud, weapon, count: (hud.weapon === weapon ? hud.count : 0) + amount };
}
