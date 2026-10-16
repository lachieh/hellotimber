// Plan 21 Task 7: Clock settings over the phone's time (D1, D10, D13), through keys.
import { describe, expect, it } from "vite-plus/test";
import { createMemoryStorage } from "../src/index";
import { clockRig, play, toClock, toClockSettings, toStandby } from "./support/clock.ts";

const standbyClock = (c: ReturnType<typeof clockRig>) => {
  const screen = c.rig.phone.screen;
  return screen.kind === "standby" ? screen.clock : `(${screen.kind})`;
};

describe("Clock settings", () => {
  it("hides the standby clock and relabels Hide clock as Show clock until shown again", () => {
    const c = clockRig();
    expect(standbyClock(c)).toBe("10:10");
    toClockSettings(c.rig, 0);
    const list = () => {
      const s = c.rig.phone.screen;
      return s.kind === "list" ? s.items[0] : undefined;
    };
    expect(list()).toBe("Hide clock");
    play(c.rig, "menu +4000");
    toStandby(c.rig);
    expect(standbyClock(c)).toBeUndefined();
    toClockSettings(c.rig, 0);
    expect(list()).toBe("Show clock");
    play(c.rig, "menu +4000");
    toStandby(c.rig);
    expect(standbyClock(c)).toBe("10:10");
  });

  it("sets the phone's time and date over the host's, and keeps them across a power cycle", () => {
    const storage = createMemoryStorage();
    const c = clockRig({ storage });
    toClockSettings(c.rig, 1);
    play(c.rig, "menu +1500 0 9 5 9 menu +4000");
    toStandby(c.rig);
    toClock(c.rig, 2);
    play(c.rig, "menu +1500 1 4 1 0 2 0 2 6 menu +4000");
    toStandby(c.rig);
    expect(standbyClock(c)).toBe("09:59");
    c.host.clock = "10:11";
    c.rig.advance(10);
    expect(standbyClock(c)).toBe("10:00");
    const again = clockRig({ storage, clock: "10:11" });
    expect(standbyClock(again)).toBe("10:00");
    toClock(again.rig, 2);
    const page = again.rig.phone.screen;
    expect(page.kind === "list" ? page.detail : undefined).toBe("14.10.2026");
  });

  it("shows the 12-hour form on standby", () => {
    const c = clockRig({ clock: "13:07" });
    toClockSettings(c.rig, 2);
    play(c.rig, "menu +1500 down +1000 menu +4000");
    toStandby(c.rig);
    expect(standbyClock(c)).toBe("01:07 pm");
  });

  it("Auto update On clears the offset at power-on and says so at standby", () => {
    const storage = createMemoryStorage();
    const c = clockRig({ storage });
    toClockSettings(c.rig, 1);
    play(c.rig, "menu +1500 1 1 0 0 menu +4000");
    toStandby(c.rig);
    toClock(c.rig, 5);
    play(c.rig, "menu +2500 up up menu +4000");
    toStandby(c.rig);
    expect(standbyClock(c)).toBe("11:00");
    const again = clockRig({ storage });
    again.rig.advance(200);
    const note = again.rig.phone.screen;
    expect(note.kind).toBe("custom");
    again.rig.advance(3000);
    expect(standbyClock(again)).toBe("10:10");
  });
});
