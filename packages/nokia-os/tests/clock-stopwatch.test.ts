// Plan 21 Task 10: the stopwatch beyond its goldens' scenarios (tests/acceptance/21-*): the
// display, its redraw on kernel time, the stale first frame of a reopened screen, the blinking
// standby indicator, and the RAM state lost at power-off.
import { describe, expect, it } from "vite-plus/test";
import { formatStopwatch, STOPWATCH_BLINK_MS } from "../src/firmware/features/clock/stopwatch";
import { STOPWATCH_REDRAW_MS, STOPWATCH_STALE_MS } from "../src/widgets/stopwatch";
import { clockRig, play, readStopwatch, toClock, toStandby } from "./support/clock.ts";

type C = ReturnType<typeof clockRig>;

const shown = (c: C): number | undefined => readStopwatch(c.rig.paint().pixels);

const indicators = (c: C) => {
  const screen = c.rig.phone.screen;
  return screen.kind === "standby" ? (screen.indicators ?? {}) : undefined;
};

function open(c: C): void {
  toClock(c.rig, 3);
  play(c.rig, "menu +2500");
}

describe("the stopwatch", () => {
  it("formats h:mm:ss.cc", () => {
    expect(formatStopwatch(0)).toBe("0:00:00.00");
    expect(formatStopwatch(61_480)).toBe("0:01:01.48");
    expect(formatStopwatch(3_661_480)).toBe("1:01:01.48");
  });

  it("redraws every 100 ms of kernel time while it runs; Stop shows the exact time", () => {
    const c = clockRig();
    open(c);
    expect(shown(c)).toBe(0);
    c.rig.press("navi");
    c.rig.advance(STOPWATCH_REDRAW_MS - 1);
    expect(shown(c)).toBe(0);
    c.rig.advance(1);
    expect(shown(c)).toBe(STOPWATCH_REDRAW_MS);
    c.rig.advance(1234 - STOPWATCH_REDRAW_MS);
    expect(shown(c)).toBe(1200);
    c.rig.press("navi");
    expect(shown(c)).toBe(1230);
  });

  it("keeps running elsewhere; a reopened screen shows its last time until its first redraw", () => {
    const c = clockRig();
    open(c);
    c.rig.press("navi");
    c.rig.advance(2000);
    play(c.rig, "c +2500");
    expect(c.rig.phone.screen.kind).toBe("list");
    c.rig.press("navi");
    expect(shown(c)).toBe(2000);
    c.rig.advance(STOPWATCH_STALE_MS + 1);
    expect(shown(c)).toBeGreaterThan(4000);
  });

  it("blinks its standby indicator while it runs", () => {
    const c = clockRig();
    open(c);
    c.rig.press("navi");
    toStandby(c.rig);
    const seen = new Set<boolean>();
    for (let t = 0; t < 4 * STOPWATCH_BLINK_MS; t += 50) {
      seen.add(indicators(c)?.stopwatch === true);
      c.rig.advance(50);
    }
    expect(seen.has(true) && seen.has(false)).toBe(true);
  });

  it("Options › Reset clears it; Exit keeps the time", () => {
    const c = clockRig();
    open(c);
    c.rig.press("navi");
    c.rig.advance(3000);
    play(c.rig, "menu +1500 menu +2500 down +1500 down +1500 menu +3000");
    expect(c.rig.phone.screen.kind).toBe("standby");
    open(c);
    expect(shown(c)).toBe(3000);
    play(c.rig, "menu +2500 down +1500 menu +3000");
    expect(shown(c)).toBe(0);
  });

  it("is RAM: switching the phone off loses it", () => {
    const c = clockRig();
    open(c);
    c.rig.press("navi");
    toStandby(c.rig);
    c.rig.press("power", 3000);
    c.rig.advance(2000);
    c.rig.press("power", 1000);
    c.rig.advance(15_000);
    toStandby(c.rig);
    expect(indicators(c)?.stopwatch).toBeUndefined();
    open(c);
    expect(shown(c)).toBe(0);
  });
});
