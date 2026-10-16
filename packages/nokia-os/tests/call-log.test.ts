// Plan 22 Task 6: the call register's lists (RAM), the durations record and the call stamp.
import { describe, expect, it } from "vite-plus/test";
import {
  CALL_LIST_CAPACITY,
  CALLS_RECORD,
  callSeconds,
  durationText,
  StockCallLog,
} from "../src/calls/log";
import { CallClock, callDate, callTime, parseHostTime } from "../src/calls/timestamp";
import { createMemoryStorage, StockEeprom } from "../src/firmware/eeprom";

const log = () => new StockCallLog(new StockEeprom(createMemoryStorage()));

describe("the lists (D13)", () => {
  it("keeps the newest first, moves a repeated number up and drops past the capacity", () => {
    const l = log();
    for (let i = 0; i < 21; i++)
      l.add("dialled", { number: `04000000${String(i).padStart(2, "0")}` });
    expect(l.entries("dialled")).toHaveLength(CALL_LIST_CAPACITY.dialled);
    expect(l.entries("dialled")[0]!.number).toBe("0400000020");
    l.add("dialled", { number: "0400000005" });
    expect(l.entries("dialled")[0]!.number).toBe("0400000005");
    expect(l.entries("dialled")).toHaveLength(20);
  });

  it("counts missed calls for the notice and new numbers per number", () => {
    const l = log();
    l.add("missed", { number: "0412345678" });
    l.add("missed", { number: "0412345678" });
    expect(l.missedCalls()).toBe(2);
    expect(l.unreadMissed()).toBe(1);
    l.markMissedRead();
    l.clearNotice();
    expect([l.missedCalls(), l.unreadMissed()]).toEqual([0, 0]);
  });

  it("erases one entry or whole lists, and forgets everything at power-off", () => {
    const l = log();
    l.add("missed", { number: "1" });
    l.add("received", { number: "2" });
    l.add("dialled", { number: "3" });
    l.add("dialled", { number: "4" });
    l.erase("dialled", 0);
    expect(l.entries("dialled").map((e) => e.number)).toEqual(["3"]);
    l.erase("missed");
    expect(l.entries("missed")).toEqual([]);
    expect(l.unreadMissed()).toBe(0);
    l.erase("all");
    expect(l.entries("received")).toEqual([]);
    l.add("dialled", { number: "5" });
    l.powerOff();
    expect(l.entries("dialled")).toEqual([]);
  });
});

describe("the durations (D12)", () => {
  it("counts a second at ≈820 ms connected, then one every ≈980 ms", () => {
    expect([810, 1310, 1810, 60_810].map(callSeconds)).toEqual([0, 1, 2, 62]);
    expect(durationText(3725)).toBe("01:02:05");
  });

  it("persists the totals and zeroes them on Clear timers and Restore", () => {
    const storage = createMemoryStorage();
    const l = new StockCallLog(new StockEeprom(storage));
    l.addDuration("dialled", 5_000);
    l.addDuration("received", 2_000);
    const again = new StockCallLog(new StockEeprom(storage));
    expect(again.durations()).toEqual({ last: 2, all: 7, received: 2, dialled: 5 });
    again.clearDurations();
    expect(again.durations()).toEqual({ last: 0, all: 0, received: 0, dialled: 0 });
    expect(CALLS_RECORD.factory!({ last: 1, all: 1, received: 1, dialled: 0 })).toEqual({
      last: 0,
      all: 0,
      received: 0,
      dialled: 0,
    });
  });

  it("stores only the durations, and reads a malformed total as zero", () => {
    const value = { last: 1, all: 2, received: 1, dialled: 1 };
    expect(CALLS_RECORD.encode(value)).toEqual({ durations: value });
    expect(CALLS_RECORD.decode({ durations: { ...value, all: -3 } }, 1)).toEqual({
      ...value,
      all: 0,
    });
    expect(() => CALLS_RECORD.decode([], 1)).toThrow();
  });
});

describe("Time of call (D11)", () => {
  it("stamps the host's minute with the seconds counted since it changed", () => {
    let now = 0;
    let time = "10:10";
    const clock = new CallClock(
      () => time,
      () => "13.10.2026",
      () => now,
    );
    clock.tick();
    expect(clock.stamp()).toMatchObject({ hour: 10, minute: 10, second: 0 });
    time = "10:11";
    now = 1000;
    clock.tick();
    now = 13_500;
    expect(clock.stamp()).toMatchObject({ minute: 11, second: 12 });
    expect(
      new CallClock(
        () => undefined,
        () => undefined,
        () => 0,
      ).stamp(),
    ).toBeUndefined();
  });

  it("reads 13.10.2026 and 10:10:00, or 10:10:00 am", () => {
    const stamp = { ...parseHostTime("10:10", "13.10.2026")!, second: 0 };
    expect(callDate(stamp)).toBe("13.10.2026");
    expect(callTime(stamp)).toBe("10:10:00");
    expect(callTime(stamp, true)).toBe("10:10:00 am");
    expect(callTime({ ...stamp, hour: 0 }, true)).toBe("12:10:00 am");
    expect(callTime({ ...stamp, hour: 13 }, true)).toBe("01:10:00 pm");
  });
});
