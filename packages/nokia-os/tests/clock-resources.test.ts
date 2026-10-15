// Plan 21 Task 3: the clock's resources from its goldens (scripts/clock-resources.ts, the
// sprites of scripts/resource-inputs/21-clock-and-reminders.ts).
import { describe, expect, it } from "vite-plus/test";
import {
  CLOCK_ALERTS,
  missingStockGlyphs,
  WIDGET_SPRITES,
  WIDGET_TIMELINE_BY_NAME,
} from "../src/resources";

describe("clock resources", () => {
  it("has the standby indicators, the 12-hour marks and the reminder icons", () => {
    for (const id of [
      "clock/alarm",
      "clock/timer",
      "clock/stopwatch",
      "clock/am",
      "clock/pm",
      "reminder/alert",
      "reminder/alarm",
      "reminder/note",
      "note/alarm-clock",
      "note/clock-displayed",
    ]) {
      expect(WIDGET_SPRITES[id], id).toBeDefined();
    }
    // the indicators are 6 rows tall, as the clock's digits
    for (const id of ["clock/alarm", "clock/timer", "clock/stopwatch"]) {
      expect(WIDGET_SPRITES[id]!.bitmap.height).toBe(6);
    }
    expect(WIDGET_SPRITES["clock/am"]!.bitmap.width).toBe(3);
  });

  it("steps the alerts' bell row through nine pictures every ≈233 ms", () => {
    expect(CLOCK_ALERTS.bells.sprites).toHaveLength(9);
    for (const id of CLOCK_ALERTS.bells.sprites) expect(WIDGET_SPRITES[id], id).toBeDefined();
    expect(CLOCK_ALERTS.bells.stepMs).toBeGreaterThan(225);
    expect(CLOCK_ALERTS.bells.stepMs).toBeLessThan(240);
  });

  it("blinks the ringing alarm's text every ≈480 ms, and snoozes after ≈58 s", () => {
    expect(CLOCK_ALERTS.ring.textMs).toBeGreaterThan(470);
    expect(CLOCK_ALERTS.ring.textMs).toBeLessThan(490);
    expect(CLOCK_ALERTS.alarmRingMs).toBeGreaterThan(57_000);
    expect(CLOCK_ALERTS.alarmRingMs).toBeLessThan(60_000);
    expect(CLOCK_ALERTS.countdownSoundMs).toBeGreaterThan(28_000);
    expect(CLOCK_ALERTS.countdownSoundMs).toBeLessThan(30_000);
  });

  it("plays each alert as a looped cycle of 2683.7 Hz pulses at Level 1", () => {
    for (const [name, program] of Object.entries(CLOCK_ALERTS.programs)) {
      expect(program.loopFrom, name).toBe(0);
      const pulses = program.steps.filter((s) => s.buzzer);
      expect(pulses.length, name).toBeGreaterThanOrEqual(5);
      for (const step of pulses) expect(step.buzzer, name).toEqual({ hz: 2683.7, volume: 6 });
      expect(program.steps.at(-1)!.buzzer, name).toBeNull();
    }
  });

  it("names the clock's notes", () => {
    for (const name of [
      "clock-hidden",
      "clock-displayed",
      "time-is-set",
      "date-is-set",
      "invalid-date",
      "invalid-time",
      "clock-not-set",
      "alarm-on",
      "alarm-off",
      "snooze-off",
      "timer-running",
      "timer-stopped",
      "reminder-set",
      "reminder-erased",
    ]) {
      expect(WIDGET_TIMELINE_BY_NAME[name], name).toBeDefined();
    }
  });

  it("draws every string the clock's screens show in its face", () => {
    expect(missingStockGlyphs("0123456789:.", "large")).toEqual([]);
    expect(missingStockGlyphs("hh:mm dd.mm.yyyy", "large")).toEqual([]);
    expect(missingStockGlyphs("0123456789:. ", "digits")).toEqual([]);
    for (const text of [
      "Countdown",
      "time up",
      "Alarm!",
      "Snooze active",
      "Stop",
      "Alarm postponed for 10 min",
      "Update date and time of the phone?",
      "Memory full. Replace old reminder?",
      "Erase? A",
    ]) {
      expect(missingStockGlyphs(text, "small"), text).toEqual([]);
    }
  });
});
