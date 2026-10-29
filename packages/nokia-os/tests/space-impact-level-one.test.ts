import { it, expect } from "vite-plus/test";
import { Framebuffer } from "@hellotimber/phone-screen";
import {
  newSpaceImpactGame,
  spaceImpactKey,
  spaceImpactRender,
  stepSpaceImpact,
} from "../src/games/space-impact/engine";
import { paintSpaceImpact } from "../src/display/widgets/space-impact";
import { observedSpaceImpactInput } from "../scripts/space-impact-delivery";
import { deliverSpaceImpactEvent } from "./support/space-impact-replay";
import { goldenImage, loadGolden } from "./support/goldens";
import { expectLcd } from "./support/golden";
import recovery from "./fixtures/space-impact-seed-recovery.json";

it("enters level 1 after the recorded level-0 exit, preserving score and the random chain", () => {
  let state = newSpaceImpactGame({ seed: recovery.countedOrder.effectiveSeeds[0] });
  for (const event of observedSpaceImpactInput(loadGolden("game/space-impact/level-0").note))
    state = deliverSpaceImpactEvent(state, event);
  const { randomState, hud } = state;
  for (let n = 0; n < 37; n++) state = stepSpaceImpact(state).state;
  expect(state.level).toBe(1);
  expect(state.randomState).toBe(randomState);
  expect(state.hud).toEqual(hud);
  state = spaceImpactKey(state, "1").state;
  const fb = new Framebuffer();
  paintSpaceImpact(fb, { kind: "space-impact", board: spaceImpactRender(state) });
  expectLcd(fb, goldenImage("game/space-impact/level-1", "c"), "level 1 initial board");
});
