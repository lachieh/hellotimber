import { it } from "vite-plus/test";
import { expectSpaceImpactExit } from "./support/space-impact-replay";
import { loadGolden } from "./support/goldens";

it("replays every settled level-0 exit frame and its timing", () => {
  expectSpaceImpactExit(loadGolden("game/space-impact/level-0.exit"));
});
