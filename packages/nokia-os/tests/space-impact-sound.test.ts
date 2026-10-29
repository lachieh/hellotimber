import { it } from "vite-plus/test";
import { expectSpaceImpactSound } from "./support/space-impact-sound";

it("replays the complete level-0 sound through the real sounder", () => {
  expectSpaceImpactSound("sound/game/space-impact/level-0");
});
