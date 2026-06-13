import { describe, expect, it } from "vite-plus/test";
import { createPhone } from "../src/index";
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

  it("carrier defaults to LACHLAN, clock omitted without a clock fn", () => {
    const phone = createPhone(testConfig());
    phone.pressKey("power", 1000);
    expect(phone.screen).toMatchObject({ kind: "standby", carrier: "LACHLAN" });
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
});
