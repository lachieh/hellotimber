// Plan 21 Task 11: the reminder memory (D7, D8): the virgin junk entry, capacity, order, due
// reminders, malformed entries, Restore factory settings and the stored shape.
import { describe, expect, it } from "vite-plus/test";
import { createMemoryStorage, STOCK_STORAGE_PREFIX, StockEeprom } from "../src/firmware/eeprom";
import { minuteIndex, type PhoneTime } from "../src/kit/system/clock/time";
import {
  REMINDERS_CAPACITY,
  REMINDERS_RECORD,
  StockReminders,
} from "../src/firmware/features/reminders/store";

const at = (hour: number, minute: number, day = 13): PhoneTime => ({
  year: 2026,
  month: 10,
  day,
  hour,
  minute,
});

function memory(storage = createMemoryStorage()) {
  const eeprom = new StockEeprom(storage, [REMINDERS_RECORD as never]);
  return { storage, eeprom, reminders: new StockReminders(eeprom) };
}

describe("REMINDERS_RECORD", () => {
  it("is virgin with the junk reminder only: dormant, never listed or due (D8)", () => {
    const { reminders } = memory();
    expect(REMINDERS_RECORD.initial()).toEqual({ list: [], junk: true, next: 0 });
    expect(reminders.any()).toBe(true);
    expect(reminders.list()).toEqual([]);
    expect(reminders.due(at(23, 59, 31))).toEqual([]);
  });

  it("is kept by Restore factory settings (no factory rule)", () => {
    const { eeprom, reminders } = memory();
    reminders.add("A", at(10, 11));
    eeprom.restoreFactory();
    expect(reminders.list().map((r) => r.text)).toEqual(["A"]);
  });

  it("stores this JSON shape", () => {
    const { storage, reminders } = memory();
    reminders.add("A", at(10, 11));
    reminders.add("De", null);
    const raw = storage.getItem(`${STOCK_STORAGE_PREFIX}reminders`);
    expect(JSON.parse(raw ?? "null")).toMatchInlineSnapshot(`
      {
        "junk": true,
        "list": [
          {
            "added": 0,
            "alarm": {
              "day": 13,
              "hour": 10,
              "minute": 11,
              "month": 10,
              "year": 2026,
            },
            "alerted": false,
            "snoozedTo": null,
            "text": "A",
          },
          {
            "added": 1,
            "alarm": null,
            "alerted": false,
            "snoozedTo": null,
            "text": "De",
          },
        ],
        "next": 2,
        "version": 1,
      }
    `);
  });

  it("drops malformed reminders and keeps the rest", () => {
    const decoded = REMINDERS_RECORD.decode(
      {
        list: [
          { text: "A", alarm: null, alerted: false, snoozedTo: null, added: 0 },
          { text: 5, added: 1 },
          { text: "x".repeat(36), added: 2 },
          { text: "B", alarm: { year: 2026, month: 13, day: 1, hour: 0, minute: 0 }, added: 3 },
          "junk",
        ],
        junk: false,
        next: 1,
      },
      1,
    );
    expect(decoded.list.map((r) => [r.text, r.alarm])).toEqual([
      ["A", null],
      ["B", null],
    ]);
    // `next` stays past every reminder kept.
    expect(decoded.next).toBe(4);
  });
});

describe("StockReminders", () => {
  it("lists by alarm time, those without an alarm last, then as added", () => {
    const { reminders } = memory();
    reminders.add("noon", at(12, 0));
    reminders.add("none", null);
    reminders.add("early", at(10, 11));
    reminders.add("tomorrow", at(9, 0, 14));
    expect(reminders.list().map((r) => r.text)).toEqual(["early", "noon", "tomorrow", "none"]);
  });

  it("holds REMINDERS_CAPACITY reminders, then refuses until one is replaced", () => {
    const { reminders } = memory();
    for (let i = 0; i < REMINDERS_CAPACITY; i++) expect(reminders.add(`${i}`, null)).toBeDefined();
    expect(reminders.full()).toBe(true);
    expect(reminders.add("more", null)).toBeUndefined();
    const old = reminders.list()[3]!;
    expect(reminders.add("more", null, old)?.text).toBe("more");
    expect(reminders.list().map((r) => r.text)).not.toContain(old.text);
  });

  it("is due at or after its minute until answered, the later-added first (D2)", () => {
    const { reminders } = memory();
    reminders.add("A", at(10, 11));
    reminders.add("D", at(10, 11));
    reminders.add("none", null);
    expect(reminders.due(at(10, 10))).toEqual([]);
    expect(reminders.due(at(10, 25)).map((r) => r.text)).toEqual(["D", "A"]);
    reminders.answered(reminders.due(at(10, 11))[0]!, null);
    expect(reminders.due(at(10, 11)).map((r) => r.text)).toEqual(["A"]);
  });

  it("is due again at its snooze minute (REMINDER_SNOOZE_MINUTES later)", () => {
    const { reminders } = memory();
    reminders.add("A", at(10, 11));
    reminders.answered(reminders.due(at(10, 11))[0]!, minuteIndex(at(10, 21)));
    expect(reminders.due(at(10, 20))).toEqual([]);
    expect(reminders.due(at(10, 21)).map((r) => r.text)).toEqual(["A"]);
    expect(reminders.due(at(10, 22)).map((r) => r.text)).toEqual(["A"]);
  });

  it("erases one, and all with the junk reminder (Erase › All)", () => {
    const { reminders } = memory();
    const a = reminders.add("A", null)!;
    reminders.add("B", null);
    reminders.erase(a);
    expect(reminders.list().map((r) => r.text)).toEqual(["B"]);
    reminders.eraseAll();
    expect(reminders.list()).toEqual([]);
    expect(reminders.any()).toBe(false);
  });

  it("edits in place, alarm and alert state renewed", () => {
    const { reminders } = memory();
    const a = reminders.add("A", at(10, 11))!;
    reminders.answered(a, null);
    reminders.edit(a, "Ab", at(12, 0));
    expect(reminders.list()).toEqual([
      { text: "Ab", alarm: at(12, 0), alerted: false, snoozedTo: null, added: a.added },
    ]);
  });
});
