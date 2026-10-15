// The lights port (plan 25 D1, Task 4): its contract rules, the comparison's failure output, and
// the timeout, key, boot and power-key goldens driven through a stock phone.
import { describe, expect, it } from "vite-plus/test";
import type { PhoneKey } from "@hellotimber/phone-core";
import type { LightsGolden } from "../scripts/lights-format.ts";
import { createStockPhoneWith } from "../src/firmware/phone";
import type { StockLightEvent } from "../src/index";
import {
  expectLightsTimeline,
  lightsGoldenIds,
  lightsRig,
  lightsScenario,
  storageFor,
  type RecordedLights,
} from "./support/lights.ts";

describe("expectLightsTimeline", () => {
  const golden: LightsGolden = {
    id: "lights/test",
    status: "asserted",
    source: "test",
    sourceSha256: "0".repeat(64),
    state: "factory",
    powerOnMs: 1000,
    startMs: -100,
    endMs: 20_000,
    keys: [{ ms: 0, key: "c" }],
    omitted: [],
    rows: [
      { ms: 18, light: "display", on: true },
      { ms: 18, light: "keypad", on: true },
      { ms: 15491, light: "display", on: false },
      { ms: 15491, light: "keypad", on: false },
    ],
  };
  const both = (atMs: number, on: boolean): StockLightEvent[] => [
    { light: "display", atMs, on },
    { light: "keypad", atMs, on },
  ];
  const recorded = (events: StockLightEvent[]): RecordedLights => ({
    originMs: 5000,
    endMs: 30_000,
    events,
  });

  it("passes lights at the key-down and off edges within the tolerance", () => {
    expectLightsTimeline(recorded([...both(5000, true), ...both(20_494, false)]), golden, "ok");
  });

  it("reports an off edge earlier than the golden's tolerance", () => {
    expect(() =>
      expectLightsTimeline(recorded([...both(5000, true), ...both(20_480, false)]), golden, "t"),
    ).toThrow(
      /t: lights differ from lights\/test\n[^]*15491  display  off\s+15480\.0  -11\.0 ✗ early/,
    );
  });

  it("reports a missing event and an extra one", () => {
    expect(() => expectLightsTimeline(recorded(both(5000, true)), golden, "t")).toThrow(
      /15491  display  off\s+-  ✗ missing/,
    );
    expect(() =>
      expectLightsTimeline(
        recorded([...both(5000, true), ...both(20_491, false), ...both(21_000, true)]),
        golden,
        "t",
      ),
    ).toThrow(/-  display\s+16000\.0  ✗ extra on/);
  });

  it("states a light lit at the recording's start as a row there and ignores events after its end", () => {
    const lit: LightsGolden = {
      ...golden,
      rows: [
        { ms: -100, light: "display", on: true },
        { ms: -100, light: "keypad", on: true },
      ],
    };
    expectLightsTimeline(recorded([...both(3000, true), ...both(26_000, false)]), lit, "lit");
  });
});

/** A phone powered on with the animated boot, recording each event with the tick that emitted it. */
function bootedRig() {
  const emitted: { event: StockLightEvent; at: number }[] = [];
  const rig = lightsRig({
    storage: storageFor("factory"),
    lights: { change: (event) => emitted.push({ event, at: rig.now }) },
  });
  rig.powerOn();
  return { rig, emitted };
}

describe("the lights port's contract", () => {
  it("is dark at power-on until the boot lights it, at the self-test's first frame", () => {
    const { rig } = bootedRig();
    const powered = rig.poweredOnAt!;
    rig.advance(400);
    expect(rig.events.map((e) => [e.light, e.atMs - powered, e.on])).toEqual([
      ["display", 268, true],
      ["keypad", 268, true],
    ]);
  });

  it("stamps events no later than the emitting tick, in order, each light alternating", () => {
    const { rig, emitted } = bootedRig();
    const keys: [number, PhoneKey][] = [
      [20_000, "c"],
      [40_000, "navi"],
      [41_000, "down"],
      [70_000, "c"],
    ];
    for (const [at, key] of keys) {
      rig.advance(at - rig.now, 7);
      rig.hold(key);
      rig.advance(60);
      rig.release(key);
    }
    rig.advance(30_000, 113);
    expect(emitted.length).toBeGreaterThanOrEqual(8);
    emitted.forEach(({ event, at }, i) => {
      expect(event.atMs).toBeLessThanOrEqual(at);
      if (i > 0) expect(event.atMs).toBeGreaterThanOrEqual(emitted[i - 1]!.event.atMs);
    });
    for (const light of ["display", "keypad"] as const) {
      const states = emitted.filter((e) => e.event.light === light).map((e) => e.event.on);
      expect(
        states.every((on, i) => i === 0 || on !== states[i - 1]),
        light,
      ).toBe(true);
    }
  });

  it("emits off for each lit light at power-off", () => {
    const { rig } = bootedRig();
    rig.advance(15_000);
    rig.hold("c");
    rig.advance(60);
    rig.release("c");
    rig.advance(1000);
    rig.hold("power");
    rig.advance(3000);
    rig.release("power");
    const last = rig.events.slice(-2);
    expect(last.map((e) => [e.light, e.on])).toEqual([
      ["display", false],
      ["keypad", false],
    ]);
    expect(rig.phone.screen.kind).toBe("off");
  });

  it("changes nothing on screen: a phone without the port shows the same frames", () => {
    const screens = (withPort: boolean): string[] => {
      const phone = createStockPhoneWith({
        carrier: "Orange F",
        storage: storageFor("factory"),
        ...(withPort ? { lights: { change() {} } } : {}),
      });
      const out: string[] = [];
      phone.subscribe((snapshot) => out.push(JSON.stringify(snapshot)));
      let now = 0;
      const press = (key: PhoneKey, holdMs = 60) => {
        phone.send({ type: "down", key });
        for (let i = 0; i < holdMs; i += 10) phone.tick((now += 10));
        phone.send({ type: "up", key });
      };
      press("power", 1000);
      for (let i = 0; i < 1500; i++) phone.tick((now += 10));
      for (const key of ["navi", "down", "navi", "c", "c", "5", "c"] as PhoneKey[]) {
        press(key);
        for (let i = 0; i < 100; i++) phone.tick((now += 10));
      }
      return out;
    };
    expect(screens(true)).toEqual(screens(false));
  });
});

describe("timeout, key, boot and power-key goldens (D2, D3)", () => {
  const KNOWN: Readonly<Record<string, string>> = {
    "lights/timeout/virgin/tap-02":
      "the tick's ±3 ms: this key-down lies 13631.1 ms before the fitted tick and the LEDs stayed lit; factory/tap-02 (13631.6 ms) and factory/fine-252 (13627.6 ms) went dark",
    "lights/boot/power-off":
      "the kernel switches off 800 ms into the power key's hold, the firmware ≈1017 ms (the power key's long press, plan 17)",
  };
  const ids = [
    ...lightsGoldenIds("lights/timeout/"),
    ...lightsGoldenIds("lights/keys/"),
    ...lightsGoldenIds("lights/boot/"),
    ...["standby", "menu", "list"].map((place) => `lights/power-key/${place}`),
  ];
  for (const id of ids) {
    const gap = KNOWN[id];
    if (gap === undefined) it(id, () => lightsScenario(id));
    else it.fails(`${id} (known gap: ${gap})`, () => lightsScenario(id));
  }
});
