import { spaceImpactScenarios } from "./support/game";
import { scenarioOf } from "./support/acceptance";
import { describe, expect, it } from "vite-plus/test";
import { createStockGames } from "../src/firmware/features/games";
import { spaceImpactGame } from "../src/firmware/features/space-impact";
import { SPACE_IMPACT_DATA } from "../src/resources/generated/space-impact";
import { flowRig, type FlowRig } from "./support/flow-rig";
import { goldenImage } from "./support/goldens";

function game() {
  let rig: FlowRig;
  let seeds = 0;
  const games = {
    ...createStockGames(),
    seed: () => {
      seeds++;
      return 12345;
    },
    now: () => rig.now,
  };
  rig = flowRig(() => spaceImpactGame({ games, start: "new" }));
  return { rig, games, seeds: () => seeds };
}

describe("Space impact session", () => {
  it.each(Object.keys(spaceImpactScenarios))("replays %s through the real Games menu", (id) => {
    spaceImpactScenarios[id]!(id);
  });
  it("opens the real Games binding and replays every frame of the tree leaf", () => {
    scenarioOf({ plan: "24", scenarios: {} }, "tree/08-games/8-2-1.leaf", ["8-2-1"])!();
  });
  it("seeds once, starts at the captured first offset and then ticks at the captured period", () => {
    const { rig, seeds } = game();
    expect(seeds()).toBe(1);
    expect(rig.frame()).toEqual(goldenImage("game/space-impact/level-0", "b").image.pixels);
    rig.advance(SPACE_IMPACT_DATA.timings.firstTickMs - 1);
    expect(rig.frame()).toEqual(goldenImage("game/space-impact/level-0", "b").image.pixels);
    rig.advance(1);
    expect(rig.frame()).toEqual(goldenImage("game/space-impact/pause-nav", "c").image.pixels);
    rig.advance(SPACE_IMPACT_DATA.timings.tickMs);
    expect(rig.frame()).toEqual(goldenImage("game/space-impact/level-0", "b").image.pixels);
  });

  it.each(["navi", "c"] as const)(
    "%s suspends, Continue waits and delivers the first key",
    (key) => {
      const { rig, games, seeds } = game();
      rig.advance(173 + 9 * 93);
      rig.press(key);
      expect(games.suspended["space-impact"]).toMatchObject({ state: { randomState: 12345 } });
      expect(rig.exits[0]?.options).toMatchObject({
        select: key === "c" ? "new-game" : "continue",
        ...(key === "navi" ? { row: "top" } : {}),
      });
      const board = goldenImage("game/space-impact/pause-continue", "b").image.pixels;
      const resumed = flowRig(() => spaceImpactGame({ games, start: "continue" }));
      expect(resumed.frame()).toEqual(board);
      resumed.advance(5000);
      expect(resumed.frame()).toEqual(board);
      resumed.press("1");
      expect(resumed.frame()).not.toEqual(board);
      expect(seeds()).toBe(1);
      expect(games.suspended["space-impact"]).toBeUndefined();
    },
  );

  it("New game replaces only its own suspended game and takes a fresh seed", () => {
    const { rig, games, seeds } = game();
    const snake = { preserved: true };
    games.suspended.snake = snake;
    rig.advance(3000);
    rig.press("navi");
    const fresh = flowRig(() => spaceImpactGame({ games, start: "new" }));
    expect(seeds()).toBe(2);
    expect(games.suspended.snake).toBe(snake);
    expect(games.suspended["space-impact"]).toBeUndefined();
    expect(fresh.frame()).toEqual(goldenImage("game/space-impact/level-0", "b").image.pixels);
  });

  it("key release stops movement repeats", () => {
    const { rig } = game();
    rig.session.onKey({ type: "down", key: "8" });
    rig.advance(200);
    rig.session.onKey({ type: "up", key: "8" });
    rig.advance(200);
    const stationary = rig.frame();
    rig.advance(186);
    expect(rig.frame()).toEqual(stationary);
  });
});
