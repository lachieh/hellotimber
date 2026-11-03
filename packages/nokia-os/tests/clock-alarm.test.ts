// Plan 21 Task 8: the alarm clock beyond its goldens' scenarios (tests/acceptance/21-*): the
// one-shot alarm and Snooze's minute, the ring that waited for standby (from the standby frame:
// the path there is the kernel's C held), the ring's text and bells, and the composed wake
// (D4: no capture can advance a powered-off emulator).
import { describe, expect, it } from "vite-plus/test";
import { ALARM_SNOOZE_MINUTES, bellsAt, ringTextShown } from "../src/firmware/features/clock/alarm";
import { CLOCK_ALERTS } from "@hellotimber/nokia-kit/ui/resources";
import { clockRig, play, setAlarm, toClock, toClockSettings, untilShows } from "./support/clock.ts";
import { lcdMismatch } from "./support/golden.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";
import { frameAt } from "./support/rig.ts";

describe("the alarm", () => {
  it("rings once at its minute and is Off after (a one-shot)", () => {
    const c = clockRig({ state: "factory" });
    setAlarm(c.rig, "1011");
    expect(c.rig.phone.screen.kind).toBe("standby");
    c.host.clock = "10:11";
    c.rig.advance(500);
    expect(ringing(c)).toBe(true);
    play(c.rig, "c +3000");
    expect(c.rig.phone.screen.kind).toBe("standby");
    // The next day's 10:11 does not ring again.
    c.host.clock = "10:12";
    c.rig.advance(1000);
    c.host.clock = "10:11";
    c.rig.advance(1000);
    expect(c.rig.phone.screen.kind).toBe("standby");
  });

  it(`snoozes for ${ALARM_SNOOZE_MINUTES - 1} minutes rounded up to a whole minute`, () => {
    const c = clockRig({ state: "factory" });
    setAlarm(c.rig, "1011");
    c.host.clock = "10:11";
    c.rig.advance(3000);
    play(c.rig, "menu +3000");
    for (const minute of [12, 13, 14, 15, 16]) {
      c.host.clock = `10:${minute}`;
      c.rig.advance(2000);
      expect(ringing(c), `10:${minute}`).toBe(false);
    }
    c.host.clock = "10:17";
    c.rig.advance(2000);
    expect(ringing(c)).toBe(true);
  });

  it("is listed by the standby indicator while set or snoozed", () => {
    const c = clockRig({ state: "factory" });
    expect(c.rig.phone.screen.kind === "standby" && c.rig.phone.screen.indicators?.alarm).toBe(
      undefined,
    );
    setAlarm(c.rig, "1011");
    const screen = c.rig.phone.screen;
    expect(screen.kind === "standby" && screen.indicators?.alarm).toBe(true);
  });
});

/** Whether the ring (its bell row) is on screen. */
const ringing = (c: ReturnType<typeof clockRig>): boolean =>
  c.rig.phone.screen.kind === "custom" && hasBells(c.rig.paint().pixels);

const hasBells = (pixels: Uint8Array): boolean => {
  let ink = 0;
  for (let y = 26; y <= 35; y++) for (let x = 5; x <= 78; x++) ink += pixels[y * 84 + x]!;
  return ink > 0;
};

describe("the ring's timers", () => {
  it("steps the bells from bellsFirstMs, the second step with the text", () => {
    const { ring, bells } = CLOCK_ALERTS;
    expect(bellsAt(0, ring.bellsFirstMs, ring.textFirstMs)).toBe(bells.sprites[0]);
    expect(bellsAt(ring.bellsFirstMs, ring.bellsFirstMs, ring.textFirstMs)).toBe(bells.sprites[1]);
    expect(bellsAt(ring.textFirstMs - 1, ring.bellsFirstMs, ring.textFirstMs)).toBe(
      bells.sprites[1],
    );
    expect(bellsAt(ring.textFirstMs, ring.bellsFirstMs, ring.textFirstMs)).toBe(bells.sprites[2]);
  });

  it("shows the text from textFirstMs, off at 925 ms, then every 481 ms", () => {
    expect(ringTextShown(CLOCK_ALERTS.ring.textFirstMs - 1)).toBe(false);
    expect(ringTextShown(CLOCK_ALERTS.ring.textFirstMs)).toBe(true);
    expect(ringTextShown(940)).toBe(false);
    expect(ringTextShown(1420)).toBe(true);
    expect(ringTextShown(1900)).toBe(false);
  });
});

describe("a ring that waited for standby", () => {
  it.each(["menu-page", "menu-list"])(
    "from %s: standby, then the ring without bells, its text blinking",
    (where) => {
      const id = `clock/alarm/ring-elsewhere-${where}-standby`;
      const golden = loadGolden(id);
      const rows = golden.timeline!;
      const c = clockRig({ state: "factory" });
      setAlarm(c.rig, "1011");
      if (where === "menu-page") toClock(c.rig, 0);
      else toClockSettings(c.rig, 0);
      c.host.clock = "10:11";
      c.rig.advance(20_000);
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

describe("the wake (D4, composed)", () => {
  /** A phone switched off with the alarm set, its minute come. */
  function offAtAlarm() {
    const c = clockRig({ state: "factory" });
    setAlarm(c.rig, "1011");
    c.rig.press("power", 3000);
    c.rig.advance(2000);
    expect(c.rig.phone.screen.kind).toBe("off");
    c.host.clock = "10:11";
    c.rig.advance(1000);
    return c;
  }

  it("switches the phone on into the ring", () => {
    const c = offAtAlarm();
    expect(ringing(c)).toBe(true);
  });

  it("asks `Activate phone for calls?` on Stop: Yes switches it on", () => {
    const c = offAtAlarm();
    play(c.rig, "c +1000");
    expect(c.rig.phone.screen.kind).toBe("custom");
    play(c.rig, "menu +3000");
    expect(c.rig.phone.screen.kind).toBe("standby");
  });

  it("asks `Activate phone for calls?` on Stop: C switches it off again", () => {
    const c = offAtAlarm();
    play(c.rig, "c +1000 c +3000");
    expect(c.rig.phone.screen.kind).toBe("off");
  });
});
