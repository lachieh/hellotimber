// Plan 16 Task 8: Snake II's cues as sound and vibration (D13). Every `sound/game/*` golden runs
// in tests/acceptance.test.ts (tests/support/sound-scenarios.ts).
import { describe, expect, it } from "vite-plus/test";
import type { StockCue } from "../src/firmware/cues";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import { SNAKE_VIBRATE_MS } from "../src/games/snake/engine";
import type { StockSoundEvent } from "../src/index";
import { GAME_CUES, KEYPAD_BEEP } from "../src/resources";
import { SoundSequencer } from "../src/sound/sequencer";
import { StockSounder } from "../src/sound/sounder";
import type { SoundGolden } from "../scripts/sound-format.ts";
import { FRAME_MS, LONG_TOLERANCE_MS } from "./support/golden.ts";
import { soundStorage, type SettingChoices } from "./support/sound-scenarios.ts";
import { expectSoundTimeline, type RecordedSound } from "./support/sound.ts";

const WARNING_TONES = "tones/warning-tones";
const VIBRATING_ALERT = "tones/vibrating-alert";
const SOUNDS = "games/settings/sounds";
const SHAKES = "games/settings/shakes";
/** Warning tones and Vibrating alert: On, Off. Games › Settings: Off, On. */
const TONES_OFF = 1;
const GAMES_OFF = 0;

function sounderAt(state: "virgin" | "factory", choices: SettingChoices = {}) {
  const events: StockSoundEvent[] = [];
  const sequencer = new SoundSequencer((event) => events.push(event));
  const settings = createStockSettings(new StockEeprom(soundStorage(state, choices)));
  let now = 1000;
  const sounder = new StockSounder(sequencer, settings, () => now);
  return {
    events,
    /** Cues `cue` at the current time, then runs 5 s. */
    cue(cue: StockCue): StockSoundEvent[] {
      sounder.cue(cue, now);
      now += 5000;
      sequencer.advance(now);
      return events;
    },
  };
}

/** The buzzer events a program plays from `atMs` (each step's state at its start). */
function buzzerOf(program: (typeof GAME_CUES)["eat"], atMs: number): StockSoundEvent[] {
  const events: StockSoundEvent[] = [];
  let t = atMs;
  for (const step of program.steps) {
    if (step.buzzer !== undefined) {
      events.push(
        step.buzzer === null
          ? { output: "buzzer", atMs: t, hz: null }
          : { output: "buzzer", atMs: t, hz: step.buzzer.hz, volume: step.buzzer.volume },
      );
    }
    t += step.ms;
  }
  if (events.at(-1)?.output === "buzzer" && (events.at(-1) as { hz: unknown }).hz !== null) {
    events.push({ output: "buzzer", atMs: t, hz: null });
  }
  return events;
}

describe("game sounds (D13: Warning tones On and Games › Settings › Sounds On)", () => {
  it("plays a meal's 2636.9 Hz chirp on the buzzer at the cue's time", () => {
    const events = sounderAt("factory").cue({ kind: "eat" });
    expect(events).toEqual([
      { output: "buzzer", atMs: 1000, hz: 2636.9, volume: 6 },
      { output: "buzzer", atMs: 1006, hz: null },
    ]);
  });

  it("plays the crash's three 440 Hz pulses and the top score's fireworks as captured", () => {
    expect(sounderAt("factory").cue({ kind: "crash" })).toEqual(buzzerOf(GAME_CUES.crash, 1000));
    expect(
      buzzerOf(GAME_CUES.crash, 0).filter((e) => e.output === "buzzer" && e.hz === 440),
    ).toHaveLength(3);
    const fireworks = sounderAt("factory").cue({ kind: "top-score" });
    expect(fireworks).toEqual(buzzerOf(GAME_CUES.topScore, 1000));
    expect(
      new Set(fireworks.flatMap((e) => (e.output === "buzzer" && e.hz ? [e.hz] : []))),
    ).toEqual(new Set([587, 880]));
  });

  it("is silent with Warning tones Off or unset, or with Sounds Off", () => {
    for (const [state, choices] of [
      ["factory", { [WARNING_TONES]: TONES_OFF }],
      ["factory", { [SOUNDS]: GAMES_OFF }],
      ["virgin", {}],
    ] as const) {
      const sounder = sounderAt(state, choices);
      for (const kind of ["eat", "crash", "top-score"] as const) sounder.cue({ kind });
      expect(sounder.events, JSON.stringify(choices)).toEqual([]);
    }
  });
});

describe("silent keys (Task 0: keys on the game-over screens make no beep)", () => {
  it("drops the beep of the key going down when the cue comes", () => {
    const events: StockSoundEvent[] = [];
    const sequencer = new SoundSequencer((event) => events.push(event));
    const settings = createStockSettings(new StockEeprom(soundStorage("factory")));
    let now = 1000;
    const sounder = new StockSounder(sequencer, settings, () => now);
    sounder.cue({ kind: "silent-key" }, now);
    sounder.keyDown("3");
    now = 2000;
    sounder.keyDown("3");
    now = 3000;
    sequencer.advance(now);
    expect(events.map((e) => e.atMs)).toEqual([2000, 2000 + KEYPAD_BEEP.wokenMs]);
  });
});

describe("game shakes (D13: Shakes On and Vibrating alert On)", () => {
  it("runs the vibrator for the cue's ms", () => {
    expect(sounderAt("factory").cue({ kind: "vibrate", ms: SNAKE_VIBRATE_MS })).toEqual([
      { output: "vibrator", atMs: 1000, on: true },
      { output: "vibrator", atMs: 1000 + SNAKE_VIBRATE_MS, on: false },
    ]);
  });

  it("captures the meal's shake as the engine's SNAKE_VIBRATE_MS", () => {
    expect(Math.abs(GAME_CUES.vibrateMs - SNAKE_VIBRATE_MS)).toBeLessThanOrEqual(1);
  });

  it("keeps the vibrator off with Shakes Off or Vibrating alert Off, whatever the sounds", () => {
    const offs: SettingChoices[] = [
      { [SHAKES]: GAMES_OFF },
      { [VIBRATING_ALERT]: TONES_OFF },
      { [SHAKES]: GAMES_OFF, [VIBRATING_ALERT]: TONES_OFF },
    ];
    for (const choices of offs) {
      expect(sounderAt("factory", choices).cue({ kind: "vibrate", ms: 480 })).toEqual([]);
    }
  });

  it("shakes with Warning tones or Sounds Off (the vibrator has its own settings)", () => {
    const offs: SettingChoices[] = [{ [WARNING_TONES]: TONES_OFF }, { [SOUNDS]: GAMES_OFF }];
    for (const choices of offs) {
      const events = sounderAt("factory", choices).cue({ kind: "vibrate", ms: 480 });
      expect(events.map((e) => e.output)).toEqual(["vibrator", "vibrator"]);
    }
  });
});

describe("cue comparison (tests/support/sound.ts, `cues`)", () => {
  const ON = { kind: "sounding", hz: 2636.9, volume: 6 } as const;
  const OFF = { kind: "off" } as const;
  /** Two meals 3810 ms apart, a key between them that the cues ignore. */
  const golden: SoundGolden = {
    id: "sound/test-cues",
    status: "asserted",
    source: "test",
    sourceSha256: "0".repeat(64),
    state: "factory",
    keys: [
      { ms: 0, key: "navi" },
      { ms: 4400, key: "6" },
    ],
    omitted: [],
    rows: [
      { ms: 4477, output: "buzzer", state: ON },
      { ms: 4483, output: "buzzer", state: OFF },
      { ms: 8287, output: "buzzer", state: ON },
      { ms: 8293, output: "buzzer", state: OFF },
    ],
  };
  const meals = (second: number, length = 6): RecordedSound => ({
    originMs: 0,
    endMs: 10_000,
    events: [
      { output: "buzzer", atMs: 4477, hz: 2636.9, volume: 6 },
      { output: "buzzer", atMs: 4483, hz: null },
      { output: "buzzer", atMs: second, hz: 2636.9, volume: 6 },
      { output: "buzzer", atMs: second + length, hz: null },
    ],
  });
  const check = (recording: RecordedSound) => () =>
    expectSoundTimeline(recording, golden, "test", { cues: true });

  it("matches each cue's onset by the fidelity standard, not as a key's output", () => {
    expect(check(meals(8287 + LONG_TOLERANCE_MS))).not.toThrow();
    expect(check(meals(8287 - LONG_TOLERANCE_MS - 1))).toThrow(/onset ±50 {2}✗ timing/);
  });

  it("holds a cue's own edges to one display frame of its onset", () => {
    expect(check(meals(8287, 6 + FRAME_MS))).not.toThrow();
    expect(check(meals(8287, 6 + FRAME_MS + 1))).toThrow(/\+8287 ±17 \(\+18\) {2}✗ timing/);
  });
});
