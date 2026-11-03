import { SPACE_IMPACT_WAVE_PROGRAM } from "../../kit/ui/resources/generated/space-impact-wave-program";
import { SPACE_IMPACT_OPENING_WAVE } from "../../kit/ui/resources/generated/space-impact-opening-wave";
import type { SpaceImpactEnemy } from "./model";

export function spaceImpactEnemyY(enemy: SpaceImpactEnemy, x: number): number {
  switch (enemy.motion) {
    case "straight":
      return enemy.y;
    case "boss": {
      if (x > 56) return 12;
      const phase = (((6 - (enemy.age + 1 - 27)) % 38) + 38) % 38;
      return 6 + Math.min(phase, 38 - phase);
    }
    case "descend":
      return x <= 56 && x >= 29 ? enemy.y + 1 : enemy.y;
    case "slope":
      return Math.max(6, 82 - x);
    case "wave":
      // UNVERIFIED outside the observed columns: hold the last row; offscreen extrema still roll.
      return SPACE_IMPACT_WAVE_PROGRAM.path.find((point) => point.x === x)?.y ?? enemy.y;
  }
}

export function spaceImpactEnemyEntries(tick: number): SpaceImpactEnemy[] {
  const opening = SPACE_IMPACT_OPENING_WAVE.entries
    .filter((entry) => entry.tick === tick)
    .map((entry) => ({
      ...entry,
      family: "enemy/round-wide",
      motion: "straight" as const,
      flash: false,
      flashToggle: false,
      age: 0,
      hp: 1,
      shotsLeft: 0,
      fireDenominator: 0,
      deathFrame: null,
    }));
  const later = SPACE_IMPACT_WAVE_PROGRAM.groups
    .filter((group) => group.tick === tick)
    .flatMap((group) =>
      Array.from(
        { length: group.count },
        (_, member): SpaceImpactEnemy => ({
          x: group.x + member * group.spacing,
          y: group.y,
          dx: group.dx,
          family: group.family,
          motion: group.motion,
          flash: false,
          flashToggle: false,
          age: 0,
          hp: group.hp,
          shotsLeft: group.shots,
          fireDenominator: group.fireDenominator,
          animationOffset: 0,
          deathFrame: null,
        }),
      ),
    );
  return [...opening, ...later];
}
