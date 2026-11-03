import { Framebuffer } from "@hellotimber/phone-screen";
import { paintSpaceImpact } from "../src/kit/apps/games/display-space-impact";
import { spaceImpactRender, stepSpaceImpact } from "../src/games/space-impact/engine";
import { createGameRandom } from "../src/games/random";
import { newSpaceImpactGame } from "../src/games/space-impact/engine";
import { deliverSpaceImpactEvent } from "./support/space-impact-replay";
import { observedSpaceImpactInput } from "../scripts/space-impact-delivery";
import recovery from "./fixtures/space-impact-seed-recovery.json";
import { expect, it } from "vite-plus/test";
import { loadGolden } from "./support/goldens";
import { replaySpaceImpactLevel } from "./support/space-impact-replay";

it("replays all level-0 waves through the second seeded pickup pixel-exactly", () => {
  const replay = replaySpaceImpactLevel(loadGolden("game/space-impact/level-0"));
  expect(replay.events).toBe(1812);
  expect(
    replay.next?.startMs,
    `matched ${replay.matched}/${replay.total}, next ${replay.next?.image}`,
  ).toBeGreaterThan(65592);
});

it("executes the counted eighteen ordinary consumers before the second pickup on the same chain", () => {
  const random = createGameRandom(recovery.countedOrder.effectiveSeeds[0]!);
  let state = newSpaceImpactGame({ seed: random.state });
  let changes = 0;
  for (const event of observedSpaceImpactInput(loadGolden("game/space-impact/level-0").note)) {
    if (event.atMs >= 65000) break;
    const next = deliverSpaceImpactEvent(state, event);
    if (next.randomState !== state.randomState) {
      expect(next.randomState).toBe(random.next());
      changes++;
    }
    state = next;
  }
  expect(changes).toBe(19);
});

it("executes all 105 consumers and reproduces the first five boss-destruction windows exactly", () => {
  const random = createGameRandom(recovery.countedOrder.effectiveSeeds[0]!);
  let state = newSpaceImpactGame({ seed: random.state });
  for (const event of observedSpaceImpactInput(loadGolden("game/space-impact/level-0").note))
    state = deliverSpaceImpactEvent(state, event);
  for (let n = 0; n < 105; n++) random.next();
  expect(state.phase.kind).toBe("boss-destruction");
  expect(state.randomState).toBe(random.state);
  expect(state.hud.score).toBe(585);
  const golden = loadGolden("game/space-impact/level-0.exit");
  for (const name of ["a", "b", "c", "d", "e"]) {
    const expected = golden.images.find((image) => image.name === name)!;
    const fb = new Framebuffer();
    paintSpaceImpact(fb, { kind: "space-impact", board: spaceImpactRender(state) });
    for (let y = 24; y < 47; y++)
      for (let x = 60; x < 81; x++)
        expect(fb.pixels[y * 84 + x], `${name} ${x},${y}`).toBe(expected.pixels[y * 84 + x]);
    state = stepSpaceImpact(state).state;
  }
});
