import { SoundSequencer } from "../../src/sound/sequencer";
import { StockSounder } from "../../src/sound/sounder";
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockSettings } from "../../src/firmware/settings";
import type { StockSoundEvent } from "../../src/index";
import { observedSpaceImpactInput } from "../../scripts/space-impact-delivery";
import { loadGolden } from "./goldens";
import { soundStorage } from "./sound-scenarios";
import { expectSoundTimeline, loadSoundGolden } from "./sound";
import { newSpaceImpactGame } from "../../src/games/space-impact/engine";
import { deliverSpaceImpactResult } from "./space-impact-replay";
import recovery from "../fixtures/space-impact-seed-recovery.json";

export function expectSpaceImpactSound(id: string): void {
  const golden = loadSoundGolden(id);
  const events: StockSoundEvent[] = [];
  const sequencer = new SoundSequencer((event) => events.push(event));
  const settings = createStockSettings(new StockEeprom(soundStorage("factory")));
  let now = 0;
  const sounder = new StockSounder(sequencer, settings, () => now);
  let state = newSpaceImpactGame({ seed: recovery.countedOrder.effectiveSeeds[0] });
  for (const event of observedSpaceImpactInput(loadGolden("game/space-impact/level-0").note)) {
    const atMs = Math.round(event.atMs);
    now = atMs;
    sequencer.advance(atMs);
    const result = deliverSpaceImpactResult(state, event);
    state = result.state;
    for (const cue of result.cues) sounder.cue(cue, atMs);
  }
  const endMs = loadGolden("game/space-impact/level-0").timeline!.at(-1)!;
  const end = endMs.startMs + endMs.durationMs;
  sequencer.advance(end);
  expectSoundTimeline({ originMs: 0, endMs: end, events }, golden, golden.id, { cues: true });
}
