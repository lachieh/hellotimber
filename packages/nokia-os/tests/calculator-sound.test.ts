// Plan 20 Task 7: the calculator's sounds against its sound goldens (D9), from the factory
// state as captured: 900 Hz key beeps (Keypad tones Level 2), the 1750 Hz warning tone in place
// of the beep of the OK that opens Out of range or Dividing by zero, no tone for Rate saved, and
// a silent error OK in the virgin state (Warning tones unset).
import { describe, it } from "vite-plus/test";
import { CALCULATOR_SOUND_SCENARIOS, play } from "./support/calculator.ts";
import { expectSoundTimeline, loadSoundGolden, playSound } from "./support/sound.ts";
import { soundRig } from "./support/sound-scenarios.ts";

describe("calculator sound goldens", () => {
  for (const [id, scenario] of Object.entries(CALCULATOR_SOUND_SCENARIOS)) {
    it(id, () => scenario(id));
  }

  it("beeps Select on Calculator as plan 16's note recording of node 9 (sound/note/2-7-1-1)", () => {
    // `sound/note/9` shares this golden: OK on node 9 beeps, the calculator plays no tone.
    const golden = loadSoundGolden("sound/note/2-7-1-1");
    const rig = soundRig("factory");
    play(rig, "menu +100 down down down down down down down down +500");
    expectSoundTimeline(playSound(rig, golden), golden, "Menu, ▼×8, OK on Calculator");
  });
});
