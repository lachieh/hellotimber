// Plan 21 Task 9: the countdown timer beyond its goldens' scenarios (tests/acceptance/21-*): the
// time left on its page, 00:00, the RAM state lost at power-off, the timer icon until the alert
// is answered, the alert's sound limit, and the alert that waited for standby (from the standby
// frame: the path there is the kernel's C held).
import { describe, expect, it } from "vite-plus/test";
import { formatMinutes } from "../src/firmware/features/clock/countdown";
import { CLOCK_ALERTS } from "../src/resources";
import { TAP_DOWN_MS } from "./support/calculator.ts";
import { clockRig, play, toClock, toStandby, untilShows } from "./support/clock.ts";
import { lcdMismatch } from "./support/golden.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";
import { frameAt } from "./support/rig.ts";

type C = ReturnType<typeof clockRig>;

/** Countdown timer › Start `hhmm`; the kernel time it expires. */
function start(c: C, hhmm: string): number {
  toClock(c.rig, 4);
  play(c.rig, `menu +2500 ${hhmm.split("").join(" ")}`);
  const at = c.rig.now + TAP_DOWN_MS;
  play(c.rig, "menu +4000");
  return at + (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2))) * 60_000;
}

const indicators = (c: C) => {
  const screen = c.rig.phone.screen;
  return screen.kind === "standby" ? (screen.indicators ?? {}) : undefined;
};

/** Whether the countdown's alert (its bell row) is on screen. */
const alerting = (c: C): boolean => {
  if (c.rig.phone.screen.kind !== "custom") return false;
  const pixels = c.rig.paint().pixels;
  let ink = 0;
  for (let y = 26; y <= 35; y++) for (let x = 5; x <= 78; x++) ink += pixels[y * 84 + x]!;
  return ink > 0;
};

describe("the countdown", () => {
  it("formats whole minutes as hh:mm", () => {
    expect(formatMinutes(0)).toBe("00:00");
    expect(formatMinutes(5)).toBe("00:05");
    expect(formatMinutes(23 * 60 + 59)).toBe("23:59");
  });

  it("expires exactly hh × 3600 + mm × 60 s after Start (D5)", () => {
    const c = clockRig({ state: "factory" });
    const endsAt = start(c, "0001");
    toStandby(c.rig);
    expect(indicators(c)?.timer).toBe(true);
    c.rig.advance(endsAt - 1 - c.rig.now);
    expect(alerting(c)).toBe(false);
    c.rig.advance(2);
    expect(alerting(c)).toBe(true);
  });

  it("keeps the timer icon until its alert is answered", () => {
    const c = clockRig({ state: "factory" });
    const endsAt = start(c, "0001");
    toStandby(c.rig);
    c.rig.advance(endsAt + 100_000 - c.rig.now);
    expect(alerting(c)).toBe(true);
    play(c.rig, "c +2000");
    expect(c.rig.phone.screen.kind).toBe("standby");
    expect(indicators(c)?.timer).toBeUndefined();
  }, 30_000);

  it("stops its sound after countdownSoundMs; the screen stays", () => {
    const c = clockRig({ state: "factory" });
    const endsAt = start(c, "0001");
    toStandby(c.rig);
    c.rig.advance(endsAt - c.rig.now);
    const seen = c.rig.sounds.length;
    c.rig.advance(60_000);
    const buzzer = c.rig.sounds.slice(seen).filter((e) => e.output === "buzzer");
    const lastOn = buzzer.filter((e) => e.output === "buzzer" && e.hz !== null).at(-1)!;
    expect(lastOn.atMs - endsAt).toBeLessThan(CLOCK_ALERTS.countdownSoundMs);
    expect(lastOn.atMs - endsAt).toBeGreaterThan(CLOCK_ALERTS.countdownSoundMs - 2400);
    const last = buzzer.at(-1)!;
    expect(last.output === "buzzer" ? last.hz : undefined).toBe(null);
    expect(alerting(c)).toBe(true);
  }, 30_000);

  it("is RAM: switching the phone off loses it", () => {
    const c = clockRig({ state: "factory" });
    start(c, "0005");
    toStandby(c.rig);
    c.rig.press("power", 3000);
    c.rig.advance(2000);
    expect(c.rig.phone.screen.kind).toBe("off");
    c.rig.press("power", 1000);
    c.rig.advance(15_000);
    toStandby(c.rig);
    expect(indicators(c)?.timer).toBeUndefined();
  });

  it("00:00 stops a running countdown", () => {
    const c = clockRig({ state: "factory" });
    start(c, "0005");
    toStandby(c.rig);
    toClock(c.rig, 4);
    play(c.rig, "menu +3000 menu +3000 0 0 0 0 menu +4000");
    toStandby(c.rig);
    expect(indicators(c)?.timer).toBeUndefined();
  });
});

describe("an expiry that waited for standby", () => {
  it.each(["menu-page", "menu-list"])(
    "from %s: standby without its operator line, then the alert",
    (where) => {
      const id = `clock/countdown/expire-elsewhere-${where}-standby`;
      const rows = loadGolden(id).timeline!;
      const c = clockRig({ state: "factory" });
      const endsAt = start(c, "0001");
      toStandby(c.rig);
      if (where === "menu-page") toClock(c.rig, 0);
      else play(c.rig, "menu +300 up up +2000 menu +1500 down menu +1500 +3500");
      c.rig.advance(endsAt + 20_000 - c.rig.now);
      // The golden's standby frame (c): the kernel's C held reaches it at its own time.
      const standby = rows.findIndex((row) => row.image === "c");
      c.rig.hold("c");
      untilShows(c.rig, goldenImage(id, "c"), 2000);
      const origin = rows[standby]!.startMs;
      const recorded = c.rig.record(6000, undefined, [
        { atMs: 700, run: () => c.rig.release("c") },
      ]);
      const failures: string[] = [];
      for (const row of rows.slice(standby)) {
        if (row.durationMs < 50) continue;
        const at = row.startMs + row.durationMs / 2 - origin;
        if (at > 5900) break;
        const shown = frameAt(recorded, recorded.triggerMs + at);
        if (lcdMismatch(shown.pixels, goldenImage(id, row.image), id) !== undefined) {
          failures.push(`${row.image} at ${at.toFixed(0)} ms`);
        }
      }
      expect(failures).toEqual([]);
    },
  );
});
