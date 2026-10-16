// Plan 21 Task 11: Reminders' flows through keys, where no golden shows the outcome: the level's
// entries with and without reminders, the memory-full replacement, Edit, an erased reminder's
// alert and the alert of a reminder due while the phone was elsewhere.
import { describe, expect, it } from "vite-plus/test";
import { StockEeprom } from "../src/firmware/eeprom";
import { REMINDERS_RECORD, StockReminders } from "../src/firmware/features/reminders/store";
import {
  addReminder,
  clockRig,
  eraseAllReminders,
  play,
  toClock,
  toReminders,
  toStandby,
  type ClockRig,
} from "./support/clock.ts";

/** The reminders stored on `c`'s phone, in View all's order. */
const stored = (c: ClockRig) =>
  new StockReminders(new StockEeprom(c.storage, [REMINDERS_RECORD as never])).list();

const listed = (c: ClockRig) => {
  const screen = c.rig.phone.screen;
  return screen.kind === "list" ? screen.items : [];
};

describe("the Reminders level (D8, D9)", () => {
  it("lists View all and Erase while the memory holds a reminder, Add new only when empty", () => {
    const c = clockRig();
    toReminders(c.rig);
    // The virgin junk reminder keeps them listed.
    expect(listed(c)).toEqual(["Add new", "View all", "Erase"]);
    toStandby(c.rig);
    eraseAllReminders(c.rig);
    toReminders(c.rig);
    expect(listed(c)).toEqual(["Add new"]);
    toStandby(c.rig);
    addReminder(c.rig, { alarm: false });
    toReminders(c.rig);
    expect(listed(c)).toEqual(["Add new", "View all", "Erase"]);
  });
});

describe("Add new", () => {
  it("saves the text with its alarm, or without one", () => {
    const c = clockRig();
    eraseAllReminders(c.rig);
    addReminder(c.rig, { hhmm: "1200" });
    addReminder(c.rig, { text: "3", alarm: false });
    expect(stored(c).map((r) => [r.text, r.alarm?.hour ?? null])).toEqual([
      ["A", 12],
      ["D", null],
    ]);
  });

  it("with the memory full replaces the reminder chosen (Memory full. Replace old reminder?)", () => {
    const c = clockRig();
    eraseAllReminders(c.rig);
    for (let n = 0; n < 10; n++) addReminder(c.rig, { text: String(2 + (n % 8)), alarm: false });
    const before = stored(c).map((r) => r.text);
    toReminders(c.rig);
    // OK on the query, ▼ to the second reminder, Erase, then the new text without an alarm.
    play(c.rig, "menu +2500 menu +2500 down +1500 menu +2500 6 +1600 6 +1600 menu +2000");
    play(c.rig, "down +1000 menu +4000");
    const replaced = before.filter((_, i) => i !== 1);
    expect(
      stored(c)
        .map((r) => r.text)
        .sort(),
    ).toEqual([...replaced, "Mm"].sort());
  }, 60_000);
});

describe("View all › Options › Edit", () => {
  it("replaces the text and the alarm in place", () => {
    const c = clockRig();
    eraseAllReminders(c.rig);
    addReminder(c.rig);
    toReminders(c.rig, 1);
    // Options, Edit, the text extended, Alarm off.
    play(c.rig, "menu +2500 menu +2500 down +1200 menu +2500 3 +1600 menu +2000");
    play(c.rig, "down +1000 menu +4000");
    expect(stored(c).map((r) => [r.text, r.alarm])).toEqual([["Ad", null]]);
  });
});

describe("alerts", () => {
  it("drops an erased reminder's waiting alert", () => {
    const c = clockRig();
    eraseAllReminders(c.rig);
    addReminder(c.rig);
    toClock(c.rig, 0);
    // Due while the phone shows a menu page: it waits for standby.
    c.host.clock = "10:11";
    c.rig.advance(2000);
    toStandby(c.rig);
    toReminders(c.rig, 2);
    // Erase › One by one › Erase › OK.
    play(c.rig, "menu +2500 menu +2500 menu +2500 menu +4000");
    toStandby(c.rig);
    c.rig.advance(3000);
    const screen = c.rig.phone.screen;
    expect(screen.kind).toBe("standby");
  });

  it("shows a reminder that fell due elsewhere when the phone returns to standby", () => {
    const c = clockRig();
    eraseAllReminders(c.rig);
    addReminder(c.rig);
    toClock(c.rig, 0);
    c.host.clock = "10:11";
    c.rig.advance(5000);
    expect(c.rig.phone.path).toBe("menu/clock");
    play(c.rig, "c@1500 +3000");
    expect(c.rig.phone.screen.kind).toBe("custom");
    expect(c.rig.phone.path).toBe("standby");
  });
});
