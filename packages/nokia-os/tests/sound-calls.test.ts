// Plan 22 Task 5: DTMF, the ringing alert types and the call sounds as sounder behaviour. The
// sound goldens themselves run in tests/acceptance/22-call-register-divert-and-dialling.test.ts.
import { describe, expect, it } from "vite-plus/test";
import {
  DTMF_PAIRS,
  DTMF_TAIL_MS,
  EARPIECE_TOP_WORD,
  earpieceWord,
  netEndProgram,
  ringbackProgram,
} from "../src/calls/sounds";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import type { StockSoundEvent } from "../src/index";
import { SoundSequencer } from "../src/sound/sequencer";
import { StockSounder } from "../src/sound/sounder";
import { soundStorage, type SettingChoices } from "./support/sound-scenarios.ts";

function sounderAt(choices: SettingChoices = {}) {
  const events: StockSoundEvent[] = [];
  const sequencer = new SoundSequencer((event) => events.push(event));
  const settings = createStockSettings(new StockEeprom(soundStorage("factory", choices)));
  let now = 0;
  const sounder = new StockSounder(sequencer, settings, () => now);
  const advance = (ms: number) => {
    now += ms;
    sounder.tick();
    sequencer.advance(now);
  };
  return { events, sequencer, sounder, advance };
}

const tones = (events: readonly StockSoundEvent[]) => events.filter((e) => e.output === "tone");

describe("DTMF (S6)", () => {
  it("sounds a dial key's pair with keyDtmf, both oscillators, until the tail after its up", () => {
    const { events, sounder, advance } = sounderAt();
    sounder.keyDtmf();
    sounder.keyDown("5");
    advance(1000);
    sounder.keyUp("5");
    advance(500);
    const on = tones(events).find((e) => e.hz !== null);
    expect(on).toMatchObject({ hz: DTMF_PAIRS["5"]![0], hz2: DTMF_PAIRS["5"]![1] });
    const off = tones(events)
      .filter((e) => e.hz === null)
      .at(-1)!;
    expect(off.atMs).toBe(1000 + DTMF_TAIL_MS);
  });

  it("plays the earpiece word in a call", () => {
    const { events, sounder, advance } = sounderAt();
    sounder.keyDtmf(earpieceWord(10));
    sounder.keyDown("#");
    advance(10);
    sounder.keyUp("#");
    advance(500);
    expect(tones(events)[0]).toMatchObject({ hz: 1477, hz2: 941, volume: EARPIECE_TOP_WORD });
  });

  it("leaves the key beep alone without keyDtmf", () => {
    const { events, sounder, advance } = sounderAt();
    sounder.keyDown("5");
    advance(200);
    sounder.keyUp("5");
    advance(200);
    expect(events.some((e) => e.output === "tone" && e.hz2 !== undefined)).toBe(false);
  });
});

describe("the call sounds (D7-D9)", () => {
  it("steps the earpiece word one per Volume bar", () => {
    expect(earpieceWord(10)).toBe(EARPIECE_TOP_WORD);
    expect(earpieceWord(1)).toBe(EARPIECE_TOP_WORD + 9);
  });

  it("loops the ringback until stopped", () => {
    const { events, sounder, advance } = sounderAt();
    const play = sounder.callSound(ringbackProgram(EARPIECE_TOP_WORD));
    advance(10_000);
    expect(tones(events).filter((e) => e.hz === 425)).toHaveLength(3);
    sounder.stopRing(play);
    advance(10_000);
    expect(tones(events).filter((e) => e.hz === 425)).toHaveLength(3);
  });

  it("beeps three times at the network's end", () => {
    const { events, sounder, advance } = sounderAt();
    sounder.callSound(netEndProgram(EARPIECE_TOP_WORD));
    advance(5000);
    expect(tones(events).filter((e) => e.hz === 1000)).toHaveLength(3);
  });

  it("rings Beep once as one beep, and Off silently with the vibrator off", () => {
    const beep = sounderAt({ "tones/incoming-call-alert": 3 });
    beep.sounder.ring("tones");
    beep.advance(10_000);
    expect(beep.events.filter((e) => e.output === "buzzer" && e.hz !== null)).toHaveLength(1);
    const off = sounderAt({ "tones/incoming-call-alert": 4 });
    off.sounder.ring("tones");
    off.advance(10_000);
    expect(off.events.filter((e) => e.output === "buzzer")).toEqual([]);
  });
});
