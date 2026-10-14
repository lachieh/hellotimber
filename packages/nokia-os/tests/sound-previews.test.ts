// Plan 16 Task 6: the programs later plans ring and alert with (D11), as programs and gating.
// The previews themselves run against their sound goldens in tests/acceptance.test.ts
// (tests/support/sound-scenarios.ts).
import { describe, expect, it } from "vite-plus/test";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import type { StockSoundEvent } from "../src/index";
import { MESSAGE_TONES, RINGING_TONES } from "../src/resources";
import { SoundSequencer } from "../src/sound/sequencer";
import { StockSounder } from "../src/sound/sounder";
import { soundStorage, type SettingChoices } from "./support/sound-scenarios.ts";

function factorySounder(choices: SettingChoices = {}) {
  const events: StockSoundEvent[] = [];
  const sequencer = new SoundSequencer((event) => events.push(event));
  const settings = createStockSettings(new StockEeprom(soundStorage("factory", choices)));
  const sounder = new StockSounder(sequencer, settings, () => 0);
  return { events, sequencer, sounder };
}

const NOKIA_TUNE = RINGING_TONES[12]!;
const buzzerOnsets = (events: readonly StockSoundEvent[]) =>
  events.flatMap((e) => (e.output === "buzzer" && e.hz !== null ? [[e.atMs, e.hz] as const] : []));

describe("ring (plan 22's incoming call, D11)", () => {
  it("each tone with a second pass has a cycle of whole steps (the ring's loop)", () => {
    for (const tone of RINGING_TONES) {
      if (tone.cycleMs === undefined) continue;
      let t = 0;
      const ends = tone.program.steps.map((step) => (t += step.ms));
      expect(
        Math.min(...ends.map((end) => Math.abs(end - tone.cycleMs!))),
        tone.slug,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("repeats the profile's tone with Ringing, at its volume, with its vibrator", () => {
    const { events, sequencer, sounder } = factorySounder();
    expect(sounder.ring("profiles/general/personalise")).toBeDefined();
    const pass = NOKIA_TUNE.cycleMs!;
    sequencer.advance(3 * pass);
    const onsets = buzzerOnsets(events);
    const first = onsets.filter(([t]) => t < pass);
    expect(first[0]).toEqual([0, 1319]);
    expect(onsets.filter(([t]) => t >= pass && t < 2 * pass)).toEqual(
      first.map(([t, hz]) => [t + pass, hz]),
    );
    expect(events).toContainEqual({ output: "vibrator", atMs: 0, on: true });
    expect(events).toContainEqual({ output: "buzzer", atMs: 0, hz: 1319, volume: 16 });
  });

  it("plays one pass with Ring once, nothing with Beep once or Off, no vibrator when it is Off", () => {
    const once = factorySounder({ "tones/incoming-call-alert": 2 });
    once.sounder.ring("tones");
    once.sequencer.advance(60_000);
    expect(buzzerOnsets(once.events).at(-1)![0]).toBeLessThan(NOKIA_TUNE.cycleMs!);
    expect(buzzerOnsets(once.events).length).toBeGreaterThan(5);
    for (const alert of [3, 4]) {
      const quiet = factorySounder({ "tones/incoming-call-alert": alert });
      expect(quiet.sounder.ring("tones")).toBeUndefined();
      quiet.sequencer.advance(10_000);
      expect(quiet.events).toEqual([]);
    }
    const still = factorySounder({ "tones/vibrating-alert": 1 });
    still.sounder.ring("tones");
    still.sequencer.advance(10_000);
    expect(still.events.filter((e) => e.output === "vibrator")).toEqual([]);
    expect(buzzerOnsets(still.events).length).toBeGreaterThan(0);
  });
});

describe("messageAlert (plan 18's received message, D11)", () => {
  it("plays the profile's Message alert tone at its volume, ungated by Incoming call alert", () => {
    const { events, sequencer, sounder } = factorySounder({ "tones/incoming-call-alert": 4 });
    sounder.messageAlert("tones");
    sequencer.advance(10_000);
    // General: Standard at Level 4, as captured (sound/message-tone/standard).
    expect(events[0]).toEqual({ output: "buzzer", atMs: 0, hz: 1499.9, volume: 25 });
    expect(buzzerOnsets(events)).toHaveLength(
      MESSAGE_TONES.standard!.steps.filter((s) => s.buzzer).length,
    );
  });

  it("is silent for No tone (Silent's factory alert)", () => {
    const { events, sequencer, sounder } = factorySounder();
    expect(sounder.messageAlert("profiles/silent/personalise")).toBeUndefined();
    sequencer.advance(10_000);
    expect(events).toEqual([]);
  });
});
