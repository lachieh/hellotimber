import { describe, expect, it } from "vite-plus/test";
import { createPhone, Timeline } from "../src/index";
import type { PhoneSnapshot } from "../src/index";
import { testConfig } from "./fixtures";

describe("power & boot", () => {
  it("starts powered off, path 'standby'", () => {
    const phone = createPhone(testConfig());
    expect(phone.screen).toEqual({ kind: "off" });
    expect(phone.path).toBe("standby");
  });

  it("short power press while off does nothing", () => {
    const phone = createPhone(testConfig());
    phone.pressKey("power");
    expect(phone.screen).toEqual({ kind: "off" });
  });

  it("hold power ≈1s turns the phone on (bootMs 0 → straight to standby)", () => {
    const phone = createPhone(testConfig());
    phone.pressKey("power", 1000);
    expect(phone.screen.kind).toBe("standby");
  });

  it("plays hands frames, then welcome, then standby when bootMs is set", () => {
    const phone = createPhone(testConfig({ bootMs: 3000 }));
    phone.tick(0);
    phone.send({ type: "down", key: "power" });
    phone.tick(800); // long-press fires here → boot starts at now=800
    expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 0 });
    phone.send({ type: "up", key: "power" });
    phone.tick(1300); // 500ms into hands → frame 2 (200ms per frame)
    expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 2 });
    phone.tick(800 + 2200); // past the hands phase (2/3 of 3000 = 2000ms)
    expect(phone.screen).toEqual({ kind: "boot", phase: "welcome", frame: 1 });
    phone.tick(800 + 3000); // bootMs elapsed
    expect(phone.screen.kind).toBe("standby");
  });

  it("standby shows carrier, clock, full signal and battery", () => {
    const phone = createPhone(testConfig({ carrier: "LACHLAN", clock: () => "12:34" }));
    phone.pressKey("power", 1000);
    expect(phone.screen).toEqual({
      kind: "standby",
      carrier: "LACHLAN",
      clock: "12:34",
      signal: 4,
      battery: 4,
    });
  });

  it("carrier defaults to empty, clock omitted without a clock fn", () => {
    const phone = createPhone(testConfig());
    phone.pressKey("power", 1000);
    const screen = phone.screen;
    expect(screen).toEqual({
      kind: "standby",
      carrier: "",
      clock: undefined,
      signal: 4,
      battery: 4,
    });
    expect(screen).not.toHaveProperty("indicators");
  });

  it("hold power while on powers off; path returns to 'standby'", () => {
    const phone = createPhone(testConfig());
    phone.pressKey("power", 1000);
    expect(phone.screen.kind).toBe("standby");
    phone.pressKey("power", 1000);
    expect(phone.screen).toEqual({ kind: "off" });
    expect(phone.path).toBe("standby");
  });

  it("notifies subscribers on changes; unsubscribe stops notifications", () => {
    const phone = createPhone(testConfig());
    const seen: string[] = [];
    const off = phone.subscribe((snap) => seen.push(snap.screen.kind));
    phone.pressKey("power", 1000);
    expect(seen).toContain("standby");
    const count = seen.length;
    off();
    phone.pressKey("power", 1000);
    expect(seen).toHaveLength(count);
  });

  describe("bootTimeline", () => {
    // 0 (100 ms), 1 (50 ms), 0 again (30 ms), 2 held 200 ms: 380 ms in total.
    const bootTimeline = new Timeline([
      { frame: 0, durationMs: 100 },
      { frame: 1, durationMs: 50 },
      { frame: 0, durationMs: 30 },
      { frame: 2, durationMs: 200 },
    ]);

    function powerOn(overrides: Parameters<typeof testConfig>[0] = {}) {
      const phone = createPhone(testConfig({ bootMs: undefined, bootTimeline, ...overrides }));
      const seen: Array<[number, PhoneSnapshot["screen"]]> = [];
      let now = 0;
      phone.tick(now);
      phone.send({ type: "down", key: "power" });
      phone.subscribe((snap) => seen.push([now, snap.screen]));
      const advance = (ms: number): void => {
        for (let i = 0; i < ms; i++) phone.tick(++now);
      };
      advance(800); // long press fires: boot starts at 800
      phone.send({ type: "up", key: "power" });
      return { phone, seen, advance };
    }

    it("shows the timeline's frames as the hands phase, then standby after its duration", () => {
      const { phone, seen, advance } = powerOn();
      advance(1000);
      expect(phone.screen.kind).toBe("standby");
      expect(seen.map(([time, screen]) => [time - 800, screen])).toEqual([
        [0, { kind: "boot", phase: "hands", frame: 0 }],
        [100, { kind: "boot", phase: "hands", frame: 1 }],
        [150, { kind: "boot", phase: "hands", frame: 0 }],
        [180, { kind: "boot", phase: "hands", frame: 2 }],
        [380, expect.objectContaining({ kind: "standby" })],
      ]);
    });

    it("still skips boot with bootMs 0, and accepts bootMs equal to the duration", () => {
      const skipped = createPhone(testConfig({ bootMs: 0, bootTimeline }));
      skipped.pressKey("power", 1000);
      expect(skipped.screen.kind).toBe("standby");

      const { phone, advance } = powerOn({ bootMs: 380 });
      advance(379);
      expect(phone.screen).toEqual({ kind: "boot", phase: "hands", frame: 2 });
      advance(1);
      expect(phone.screen.kind).toBe("standby");
    });

    it("rejects a conflicting bootMs and a looping timeline", () => {
      expect(() => createPhone(testConfig({ bootMs: 3000, bootTimeline }))).toThrow(/bootMs/);
      const looping = new Timeline(bootTimeline.steps, { loopFrom: 1 });
      expect(() => createPhone(testConfig({ bootMs: undefined, bootTimeline: looping }))).toThrow(
        /finite/,
      );
    });

    it("honours a deep link requested during boot", () => {
      const { phone, advance } = powerOn();
      advance(10);
      phone.navigate("menu/phone-book/search");
      advance(369);
      expect(phone.screen.kind).toBe("boot");
      advance(1);
      expect(phone.path).toBe("menu/phone-book/search");
    });
  });
});
