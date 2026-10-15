// Plan 16 Task 5: the sound assertions themselves, and the phone's keypad tones (the sound
// goldens run in tests/acceptance.test.ts through tests/support/sound-scenarios.ts).
import { describe, expect, it } from "vite-plus/test";
import type { SoundGolden } from "../scripts/sound-format.ts";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import { SoundSequencer } from "../src/sound/sequencer";
import { C_HOLD_BEEP_MS, StockSounder, type UserRingingTones } from "../src/sound/sounder";
import { LEVEL_REPEAT } from "../src/widgets/level-bar";
import type { StockSoundEvent } from "../src/index";
import { KEYPAD_BEEP, RINGING_TONES } from "../src/resources";
import { seededStorage } from "./support/rig.ts";
import { soundRig } from "./support/sound-scenarios.ts";
import { expectSoundTimeline, type RecordedSound } from "./support/sound.ts";

const BEEP = { kind: "sounding", hz: 900, volume: 0x9104 } as const;
const OFF = { kind: "off" } as const;

/** A golden: ▼ at 0 (its beep 30 ms later), then a preview at 991. */
const GOLDEN: SoundGolden = {
  id: "sound/test",
  status: "asserted",
  source: "test",
  sourceSha256: "0".repeat(64),
  state: "factory",
  keys: [{ ms: 0, key: "down" }],
  omitted: [],
  rows: [
    { ms: 30, output: "tone", state: BEEP },
    { ms: 175, output: "tone", state: OFF },
    { ms: 991, output: "buzzer", state: { kind: "sounding", hz: 1319, volume: 16 } },
    { ms: 991, output: "vibrator", state: { kind: "on" } },
    { ms: 1106, output: "buzzer", state: { kind: "sounding", hz: 1175, volume: 16 } },
    { ms: 1222, output: "buzzer", state: OFF },
    { ms: 1222, output: "vibrator", state: OFF },
  ],
};

const tone = (atMs: number, hz: number | null): StockSoundEvent =>
  hz === null ? { output: "tone", atMs, hz } : { output: "tone", atMs, hz, volume: 0x9104 };
const buzz = (atMs: number, hz: number | null): StockSoundEvent =>
  hz === null ? { output: "buzzer", atMs, hz } : { output: "buzzer", atMs, hz, volume: 16 };
const vib = (atMs: number, on: boolean): StockSoundEvent => ({ output: "vibrator", atMs, on });

/** The golden's events as nokia-os would emit them (beep at the key), from origin 5000. */
function recorded(change: (events: StockSoundEvent[]) => StockSoundEvent[] = (e) => e) {
  const events = [
    tone(0, 900),
    tone(145, null),
    buzz(990, 1319),
    vib(990, true),
    buzz(1105, 1175),
    buzz(1221, null),
    vib(1221, false),
  ];
  const shifted = change(events).map((e) => ({ ...e, atMs: e.atMs + 5000 }));
  return { originMs: 5000, endMs: 7000, events: shifted } satisfies RecordedSound;
}

function failure(recording: RecordedSound): string {
  try {
    expectSoundTimeline(recording, GOLDEN, "test");
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected a mismatch");
}

describe("expectSoundTimeline", () => {
  it("accepts a beep at its key, a preview onset within 25 ms and its edges within 2 ms", () => {
    expect(() => expectSoundTimeline(recorded(), GOLDEN, "test")).not.toThrow();
  });

  it("marks an edge early against its program's start", () => {
    const text = failure(
      recorded((events) => events.map((e) => (e.atMs === 1105 ? { ...e, atMs: 1087 } : e))),
    );
    expect(text).toContain("Sound mismatch: sound/test");
    expect(text).toMatch(/1106 {2}buzzer {4}1175 v=16 +1087 +-19 {2}\+991 ±17 \(-18\) {2}✗ timing/);
  });

  it("marks a wrong frequency", () => {
    const text = failure(
      recorded((events) =>
        events.map((e) => (e.atMs === 990 && e.output === "buzzer" ? buzz(990, 1320) : e)),
      ),
    );
    expect(text).toMatch(/991 {2}buzzer {4}1319 v=16 .*✗ state 1320 v=16/);
  });

  it("marks a missing event and an extra one", () => {
    const missing = failure(
      recorded((events) => events.filter((e) => e.atMs !== 1221 || e.output !== "vibrator")),
    );
    expect(missing).toMatch(/1222 {2}vibrator {2}off .*✗ missing/);
    const extra = failure(recorded((events) => [...events, tone(1500, 900)]));
    expect(extra).toMatch(/- {2}tone .* 1500 .*✗ extra 900 v=0x9104/);
  });

  it("marks a beep that starts after its key's golden onset (latency only lags)", () => {
    const text = failure(
      recorded((events) => events.map((e) => (e.atMs === 0 ? tone(48, 900) : e))),
    );
    expect(text).toMatch(/30 {2}tone .*\+18 {2}key −103\.\.\+17 {2}✗ timing/);
  });

  it("marks a preview onset 51 ms off (≈1 s after the key: ±50 ms)", () => {
    const text = failure(
      recorded((events) =>
        events.map((e) => (e.atMs >= 990 && e.atMs < 1000 ? { ...e, atMs: e.atMs + 51 } : e)),
      ),
    );
    expect(text).toMatch(/991 {2}buzzer .*onset ±50 {2}✗ timing/);
  });
});

/** The tone events of a rig from `from` on, as `[atMs - from, hz]`. */
function tones(events: readonly StockSoundEvent[], from: number): [number, number | null][] {
  return events.flatMap((e) =>
    e.output === "tone" && e.atMs >= from ? [[e.atMs - from, e.hz]] : [],
  );
}

describe("keypad tones (D8)", () => {
  it("beeps ≈145 ms while the DSP is awake and ≈124 ms when the key wakes it", () => {
    const rig = soundRig("factory");
    const t0 = rig.now;
    rig.press("navi");
    rig.advance(1000);
    rig.press("c");
    rig.advance(KEYPAD_BEEP.sleepAfterMs + KEYPAD_BEEP.awakeMs);
    rig.press("navi");
    rig.advance(1000);
    expect(tones(rig.sounds, t0)).toEqual([
      [0, 900],
      [KEYPAD_BEEP.awakeMs, null],
      [1000, 900],
      [1000 + KEYPAD_BEEP.awakeMs, null],
      [1000 + KEYPAD_BEEP.sleepAfterMs + KEYPAD_BEEP.awakeMs, 900],
      [1000 + KEYPAD_BEEP.sleepAfterMs + KEYPAD_BEEP.awakeMs + KEYPAD_BEEP.wokenMs, null],
    ]);
  });

  it("runs a sounding beep on to the next key's end", () => {
    const rig = soundRig("factory");
    const t0 = rig.now;
    rig.press("navi");
    rig.advance(100);
    rig.press("down");
    rig.advance(1000);
    expect(tones(rig.sounds, t0)).toEqual([
      [0, 900],
      [100 + KEYPAD_BEEP.awakeMs, null],
    ]);
  });

  it("beeps a held ▼ again at each auto-repeat and a held C at its long press", () => {
    const rig = soundRig("factory");
    rig.press("navi");
    rig.advance(1000);
    rig.press("navi"); // Phone book
    rig.advance(1000);
    const t0 = rig.now;
    rig.press("down", 1500);
    rig.advance(500);
    const starts = tones(rig.sounds, t0).filter(([, hz]) => hz !== null);
    expect(starts.map(([t]) => t)).toEqual([
      0,
      LEVEL_REPEAT.firstMs,
      LEVEL_REPEAT.firstMs + LEVEL_REPEAT.everyMs,
    ]);
    const t1 = rig.now;
    rig.press("c", 1500); // in a submenu: C's long press goes to standby
    rig.advance(500);
    expect(
      tones(rig.sounds, t1)
        .filter(([, hz]) => hz !== null)
        .map(([t]) => t),
    ).toEqual([0, C_HOLD_BEEP_MS]);
  });

  it("does not beep C's long press in the carousel (it leaves the menu at its key-down)", () => {
    const rig = soundRig("factory");
    rig.press("navi");
    rig.advance(1000);
    const t0 = rig.now;
    rig.press("c", 1500);
    rig.advance(500);
    expect(tones(rig.sounds, t0).filter(([, hz]) => hz !== null)).toEqual([[0, 900]]);
  });

  it("beeps the power key at standby only", () => {
    const rig = soundRig("factory");
    const t0 = rig.now;
    rig.press("power");
    rig.advance(1000);
    expect(tones(rig.sounds, t0)[0]).toEqual([0, 900]);
    // Plan 17: the press opened the power key's list; C leaves it for standby (86 ms later).
    rig.press("c");
    rig.advance(200);
    rig.press("navi");
    rig.advance(1000);
    const t1 = rig.now;
    rig.press("power");
    rig.advance(1000);
    expect(tones(rig.sounds, t1)).toEqual([]);
  });

  it("is silent with Keypad tones Off and at the unset level's word in the virgin state", () => {
    const off = soundRig("factory", { "tones/keypad-tones": 0 });
    const t0 = off.now;
    off.press("navi");
    off.advance(1000);
    expect(tones(off.sounds, t0)).toEqual([]);
    const virgin = soundRig("virgin");
    virgin.press("navi");
    virgin.advance(1000);
    expect(virgin.sounds.at(-2)).toMatchObject({
      output: "tone",
      hz: 900,
      volume: KEYPAD_BEEP.levels.unset,
    });
  });
});

describe("plan 27's sounder hooks (D10)", () => {
  function sounderRig(userTones?: UserRingingTones) {
    const events: StockSoundEvent[] = [];
    const sequencer = new SoundSequencer((event) => events.push(event));
    const settings = createStockSettings(new StockEeprom(seededStorage({ factory: true })));
    let now = 0;
    const sounder = new StockSounder(
      sequencer,
      settings,
      () => now,
      userTones === undefined ? {} : { userTones },
    );
    const at = (ms: number) => {
      now = ms;
      sounder.tick();
      sequencer.advance(ms);
    };
    return { events, sounder, at };
  }

  it("(a) user tones fill the Ringing tone options the built-in tones lack, with their delay", () => {
    const tone = {
      ...RINGING_TONES[0]!,
      slug: "user",
      program: { id: "user", steps: [{ ms: 300, buzzer: { hz: 523, volume: 11 } }] },
      firstMarkStep: 1,
      cycleMs: 300,
      level5At: { note: 0, offsetMs: 0 },
      ascendingAt: [],
      previewDelayMs: 1013,
    };
    const asked: number[] = [];
    const rig = sounderRig((index) => {
      asked.push(index);
      return index === 35 ? tone : undefined;
    });
    rig.sounder.preview("ringing-tone", 35, "tones");
    rig.at(2000);
    expect(rig.events.filter((e) => e.output === "buzzer")).toEqual([
      { output: "buzzer", atMs: 1013, hz: 523, volume: expect.any(Number) },
      { output: "buzzer", atMs: 1313, hz: null },
    ]);
    // a built-in tone is never asked for; an empty user slot stays silent
    rig.sounder.preview("ringing-tone", 12, "tones");
    rig.sounder.preview("ringing-tone", 36, "tones");
    rig.at(4000);
    expect(asked).toEqual([35, 36]);
    expect(rig.events.filter((e) => e.output === "buzzer" && e.atMs > 2000)).toEqual([]);
  });

  it("(c) a key silenced at its key-down beeps nothing, also at its long press", () => {
    const silenced = sounderRig();
    silenced.sounder.cue({ kind: "silent-key" }, 0);
    silenced.sounder.keyDown("c");
    silenced.at(C_HOLD_BEEP_MS + 100);
    expect(silenced.events).toEqual([]);
    // the same key unsilenced beeps at its down and at its long press
    const plain = sounderRig();
    plain.sounder.keyDown("c");
    plain.at(C_HOLD_BEEP_MS + 100);
    expect(plain.events.filter((e) => e.output === "tone" && e.hz !== null)).toHaveLength(2);
  });

  it("(b) cancel ends a play at once (now by default), or at a time given", () => {
    const rig = sounderRig();
    const program = { id: "t", steps: [{ ms: 500, buzzer: { hz: 523, volume: 11 } }] };
    const play = rig.sounder.play(program);
    rig.at(100);
    rig.sounder.cancel(play);
    rig.at(600);
    expect(rig.events).toEqual([
      { output: "buzzer", atMs: 0, hz: 523, volume: 11 },
      { output: "buzzer", atMs: 100, hz: null },
    ]);
    const later = rig.sounder.play(program);
    rig.sounder.cancel(later, 700);
    rig.at(1200);
    expect(rig.events.slice(2)).toEqual([
      { output: "buzzer", atMs: 600, hz: 523, volume: 11 },
      { output: "buzzer", atMs: 700, hz: null },
    ]);
  });
});
