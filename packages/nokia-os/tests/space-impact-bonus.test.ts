import { describe, expect, it } from "vite-plus/test";
import { createGameRandom } from "@hellotimber/nokia-kit/apps/games/random";
import {
  newSpaceImpactGame,
  stepSpaceImpact,
  spaceImpactKey,
} from "@hellotimber/nokia-kit/apps/games/space-impact/engine";
import { loadGolden } from "./support/goldens";
import { observedSpaceImpactInput } from "../scripts/space-impact-delivery";
import { deliverSpaceImpactEvent } from "./support/space-impact-replay";
import recovery from "./fixtures/space-impact-seed-recovery.json";

const seed = recovery.countedOrder.effectiveSeeds[0]!;

describe("Space impact seeded pickup contact", () => {
  it("collects the first recorded orb, consumes draw one and defers its sound", () => {
    const golden = loadGolden("game/space-impact/level-0");
    let state = newSpaceImpactGame({ seed });
    for (const event of observedSpaceImpactInput(golden.note)) {
      if (event.atMs > 18149) break;
      state = deliverSpaceImpactEvent(state, event);
      if (state.hud.weapon === "wall") break;
    }
    const random = createGameRandom(seed);
    const first = random.next();
    expect(state.bonuses).toEqual([]);
    expect(state.hud).toEqual({ lives: 3, weapon: "wall", count: 3, score: 100 });
    expect(state.randomState).toBe(first);
    expect(state.pendingCue).toBe("space-impact/bonus");
    const released = spaceImpactKey(state, "1", "up");
    expect(released.state.pendingCue).toBe("space-impact/bonus");
    expect(released.cues).toEqual([]);
    const returned = stepSpaceImpact(released.state);
    expect(returned.state.tick).toBe(state.tick);
    expect(returned.cues).toEqual([{ kind: "game-sound", id: "space-impact/bonus" }]);
    expect(returned.state.shots).toEqual(state.shots);
    expect(returned.state.randomState).toBe(first);
  });

  it.each([
    { tick: 184, x: 12, collected: false },
    { tick: 185, x: 10, collected: false },
    { tick: 186, x: 8, collected: true },
  ])("matches the captured skimming contact at tick $tick, orb x=$x", ({ tick, x, collected }) => {
    const original = {
      ...newSpaceImpactGame({ seed }),
      tick,
      shield: false,
      ship: { x: 5, y: 15 },
      bonuses: [{ x, y: 9, dx: -2, animationOffset: 0 }],
    };
    const after = stepSpaceImpact(original).state;
    expect(after.bonuses).toHaveLength(collected ? 0 : 1);
    expect(after.hud.weapon).toBe(collected ? "wall" : "missile");
    expect(after.randomState === seed).toBe(!collected);
  });

  it("keeps a shielded overlapping orb without drawing a bonus", () => {
    const original = {
      ...newSpaceImpactGame({ seed }),
      bonuses: [{ x: 8, y: 20, dx: -2, animationOffset: 0 }],
    };
    const after = stepSpaceImpact(original).state;
    expect(after.bonuses).toHaveLength(1);
    expect(after.randomState).toBe(seed);
    expect(after.hud).toEqual(original.hud);
  });

  it("uses the accepted same-chain life reroll when a contacted orb meets five lives", () => {
    const lifeSeed = Array.from({ length: 65521 }, (_, n) => n).find(
      (n) => (createGameRandom(n).next() & 3) === 0,
    )!;
    const expected = createGameRandom(lifeSeed);
    let kind: number;
    do kind = expected.next() & 3;
    while (kind === 0);
    const state = {
      ...newSpaceImpactGame({ seed: lifeSeed }),
      ship: { x: 5, y: 20 },
      shield: false,
      hud: { lives: 5, weapon: "missile" as const, count: 3, score: 100 },
      bonuses: [{ x: 8, y: 20, dx: -2, animationOffset: 0 }],
    };
    const picked = stepSpaceImpact(state).state;
    expect(picked.bonuses).toEqual([]);
    expect(picked.hud.lives).toBe(5);
    expect(picked.randomState).toBe(expected.state);
    expect(picked.hud.weapon).toBe(kind === 1 ? "missile" : kind === 2 ? "wall" : "beam");
    expect(state.randomState).toBe(lifeSeed);
  });
});
