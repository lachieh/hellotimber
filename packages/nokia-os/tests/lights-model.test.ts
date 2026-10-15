// The stock light timer (plan 25 D2, Task 3): pure, on an injected clock. Off edges come from the
// committed lights goldens (their power-on and key-downs), within LIGHT_EDGE_TOLERANCE_MS.
import { describe, expect, it } from "vite-plus/test";
import {
  LIGHT_TICK_MS,
  LIGHT_TICK_PHASE_MS,
  LIGHT_TIMEOUT_MS,
  StockLights,
  type StockLightEvent,
} from "../src/firmware/features/backlight";
import type { LightsGolden } from "../scripts/lights-format.ts";
import {
  KEY_LIGHT_LATENCY_MAX_MS,
  LIGHT_EDGE_TOLERANCE_MS,
  lightsGoldenIds,
  loadLightsGolden,
} from "./support/lights.ts";

/** A StockLights on a settable clock, recording what it emits. */
function rig(): {
  lights: StockLights;
  events: StockLightEvent[];
  at(ms: number): void;
  readonly now: number;
} {
  let now = 0;
  const events: StockLightEvent[] = [];
  const lights = new StockLights(
    (event) => events.push(event),
    () => now,
  );
  return {
    lights,
    events,
    at(ms: number) {
      if (ms < now) throw new Error(`the clock goes back: ${ms} < ${now}`);
      now = ms;
      lights.tick();
    },
    get now() {
      return now;
    },
  };
}

/** Powers on at 0, replays the golden's key-downs as activity, returns its events at golden time. */
function replay(golden: LightsGolden): { ms: number; light: string; on: boolean }[] {
  const r = rig();
  r.lights.powerOn(0);
  const zero = golden.powerOnMs;
  for (const key of golden.keys ?? []) {
    r.at(zero + key.ms);
    r.lights.activity();
  }
  r.at(zero + (golden.rows.at(-1)?.ms ?? 0) + LIGHT_TICK_MS * 2);
  return r.events.map((e) => ({ ms: e.atMs - zero, light: e.light, on: e.on }));
}

describe("the light tick (D2)", () => {
  it("is the fitted 1982.61 ms tick from power-on + 2 ms, with D = 13624 ms", () => {
    expect(LIGHT_TICK_MS).toBe(1982.61);
    expect(LIGHT_TICK_PHASE_MS).toBe(2);
    expect(LIGHT_TIMEOUT_MS).toBe(13624);
  });

  const ids = [
    ...lightsGoldenIds("lights/timeout/"),
    ...lightsGoldenIds("lights/keys/"),
    ...lightsGoldenIds("lights/power-key/menu"),
    ...lightsGoldenIds("lights/power-key/list"),
    ...lightsGoldenIds("lights/screen-saver"),
  ];
  it("covers every timeout, hold and key golden", () => {
    expect(ids.length).toBeGreaterThan(90);
  });
  /**
   * The tick's ±3 ms: `factory/tap-02` went dark 13631.6 ms after its key on the fitted tick, this
   * one stayed lit at 13631.1 ms; `factory/fine-252` went dark at 13627.6 ms (D ≤ 13627.6).
   */
  const JITTER = "lights/timeout/virgin/tap-02";
  for (const id of ids) {
    const test = id === JITTER ? it.fails : it;
    test(`${id}: lights at the key-down, dark at the first tick at least D after the last`, () => {
      const golden = loadLightsGolden(id);
      const got = replay(golden);
      for (const light of ["display", "keypad"] as const) {
        const mine = got.filter((e) => e.light === light);
        const want = golden.rows.filter((row) => row.light === light);
        expect(
          mine.map((e) => e.on),
          light,
        ).toEqual(want.map((row) => row.on));
        want.forEach((row, i) => {
          const delta = row.ms - mine[i]!.ms;
          if (row.on) {
            expect(delta, `${light} on at ${row.ms}`).toBeGreaterThanOrEqual(0);
            expect(delta, `${light} on at ${row.ms}`).toBeLessThanOrEqual(KEY_LIGHT_LATENCY_MAX_MS);
          } else {
            expect(Math.abs(delta), `${light} off at ${row.ms}`).toBeLessThanOrEqual(
              LIGHT_EDGE_TOLERANCE_MS,
            );
          }
        });
      }
    });
  }
});

describe("StockLights", () => {
  it("is dark at power-on, lights both at an activity and restarts the timeout", () => {
    const r = rig();
    r.lights.powerOn(0);
    expect([r.lights.display, r.lights.keypad]).toEqual([false, false]);
    r.at(1000);
    r.lights.activity();
    expect(r.events).toEqual([
      { light: "display", atMs: 1000, on: true },
      { light: "keypad", atMs: 1000, on: true },
    ]);
    r.at(10_000);
    r.lights.activity(); // still lit: no event, the timeout restarts
    r.at(23_000);
    expect(r.events).toHaveLength(2);
    r.at(40_000);
    // The first tick at least 13624 ms after 10 000 (23 624): tick 12 (23 793.3 ms).
    const off = LIGHT_TICK_PHASE_MS + 12 * LIGHT_TICK_MS;
    expect(r.events.slice(2)).toEqual([
      { light: "display", atMs: off, on: false },
      { light: "keypad", atMs: off, on: false },
    ]);
  });

  it("anchors the tick at the power-on", () => {
    const r = rig();
    r.at(500);
    r.lights.powerOn(500);
    r.lights.activity();
    r.at(30_000);
    expect(r.events.at(-1)!.atMs).toBe(500 + LIGHT_TICK_PHASE_MS + 7 * LIGHT_TICK_MS);
  });

  it("ignores activity while powered off, and power-off darkens what is lit", () => {
    const r = rig();
    r.lights.activity();
    expect(r.events).toEqual([]);
    r.lights.powerOn(0);
    r.at(100);
    r.lights.activity();
    r.at(2000);
    r.lights.powerOff();
    expect(r.events.slice(2)).toEqual([
      { light: "display", atMs: 2000, on: false },
      { light: "keypad", atMs: 2000, on: false },
    ]);
    r.lights.powerOff();
    r.lights.activity();
    r.at(60_000);
    expect(r.events).toHaveLength(4);
  });

  it("forces the LEDs off and on, and releases into the timeout (D7)", () => {
    const r = rig();
    r.lights.powerOn(0);
    r.at(1000);
    r.lights.activity();
    r.lights.force("off");
    r.at(1500);
    r.lights.activity(); // a key under Lights Off: dark
    expect(r.events.map((e) => [e.atMs, e.on])).toEqual([
      [1000, true],
      [1000, true],
      [1000, false],
      [1000, false],
    ]);
    r.lights.force(null); // released within D of the last activity: lit again
    expect(r.events.slice(4).map((e) => [e.atMs, e.on])).toEqual([
      [1500, true],
      [1500, true],
    ]);
    r.lights.force("on");
    r.at(120_000); // no timeout while forced on
    expect(r.events).toHaveLength(6);
    r.lights.force(null); // long past D: dark at once
    expect(r.events.slice(6).map((e) => [e.atMs, e.on])).toEqual([
      [120_000, false],
      [120_000, false],
    ]);
  });

  it("lights at the pause and times out from it under Lights Off (lights/game/off/pause-nav)", () => {
    const golden = loadLightsGolden("lights/game/off/pause-nav");
    const zero = golden.powerOnMs;
    const pause = golden.keys!.find((k) => k.ms > 2000 && k.key === "navi")!.ms;
    const r = rig();
    r.lights.powerOn(0);
    r.at(zero - 1000);
    r.lights.activity(); // the Select of the game menu before New game: lit
    r.at(zero);
    r.lights.activity();
    r.lights.force("off"); // New game
    r.at(zero + pause);
    r.lights.force(null); // the pause
    r.lights.activity();
    r.at(zero + 20_000);
    const got = r.events.slice(2).map((e) => ({ ms: e.atMs - zero, on: e.on }));
    expect(got.map((e) => e.on)).toEqual([false, false, true, true, false, false]);
    // The golden: dark at New game (rows 2-3), lit at the pause (4-5), dark on the tick (6-7).
    const rows = golden.rows;
    expect([rows[4]!.on, rows[6]!.on]).toEqual([true, false]);
    // The pause lights 36 ms after its key-down (the game's key scan; not reproduced).
    expect(rows[4]!.ms - got[2]!.ms).toBe(36);
    expect(Math.abs(got[4]!.ms - rows[6]!.ms)).toBeLessThanOrEqual(LIGHT_EDGE_TOLERANCE_MS);
  });

  it("emits the same events whether the clock moves 1 ms at a time or in one jump", () => {
    const script = (step: number): StockLightEvent[] => {
      const r = rig();
      r.lights.powerOn(0);
      const actions: [number, () => void][] = [
        [300, () => r.lights.activity()],
        [5_000, () => r.lights.activity()],
        [21_000, () => r.lights.activity()],
        [22_000, () => r.lights.force("off")],
        [26_000, () => r.lights.force(null)],
        [60_000, () => r.lights.powerOff()],
      ];
      let t = 0;
      for (const [at, act] of actions) {
        while (t + step < at) {
          t += step;
          r.at(t);
        }
        t = at;
        r.at(at);
        act();
      }
      return r.events;
    };
    const fine = script(1);
    expect(script(60_000)).toEqual(fine);
    expect(fine.length).toBeGreaterThan(4);
    for (let i = 1; i < fine.length; i++) {
      expect(fine[i]!.atMs).toBeGreaterThanOrEqual(fine[i - 1]!.atMs);
    }
    for (const light of ["display", "keypad"] as const) {
      const mine = fine.filter((e) => e.light === light).map((e) => e.on);
      expect(mine.every((on, i) => i === 0 || on !== mine[i - 1])).toBe(true);
    }
  });

  it("never stamps an event later than the time it is emitted at", () => {
    const seen: [number, number][] = [];
    let now = 0;
    const lights = new StockLights(
      (event) => seen.push([event.atMs, now]),
      () => now,
    );
    lights.powerOn(0);
    now = 50;
    lights.activity();
    now = 33_333;
    lights.tick();
    now = 34_000;
    lights.activity();
    expect(seen.length).toBe(6);
    for (const [atMs, emittedAt] of seen) expect(atMs).toBeLessThanOrEqual(emittedAt);
  });
});
