// Plan 21 Task 5: phone time's pure helpers (D1). Expected strings are transcribed from the
// plan21/settings/format goldens' pages (`12:05 am`, `01:07 pm`, `23:59`) and date pages.
import { describe, expect, it } from "vite-plus/test";
import {
  addMinutes,
  formatClock,
  formatDate,
  minuteIndex,
  parseHostTime,
  type PhoneTime,
} from "../src/kit/system/clock/time";

const at = (day: number, month: number, year: number, hour: number, minute: number): PhoneTime => ({
  year,
  month,
  day,
  hour,
  minute,
});

describe("parseHostTime", () => {
  it("reads HH:MM and DD.MM.YYYY", () => {
    expect(parseHostTime("10:10", "13.10.2026")).toEqual(at(13, 10, 2026, 10, 10));
    expect(parseHostTime("00:00", "01.01.2000")).toEqual(at(1, 1, 2000, 0, 0));
    expect(parseHostTime("23:59", "29.02.2028")).toEqual(at(29, 2, 2028, 23, 59));
  });

  it("is undefined for anything else (never throws)", () => {
    for (const [clock, date] of [
      ["24:00", "13.10.2026"],
      ["9:5", "13.10.2026"],
      ["10:60", "13.10.2026"],
      ["", "13.10.2026"],
      [undefined, "13.10.2026"],
      ["10:10", "31.02.2026"],
      ["10:10", "29.02.2026"],
      ["10:10", "13.13.2026"],
      ["10:10", "00.10.2026"],
      ["10:10", "13-10-2026"],
      ["10:10", undefined],
      ["10:10", ""],
      [" 10:10", "13.10.2026"],
    ] as const) {
      expect(parseHostTime(clock, date), `${clock} ${date}`).toBeUndefined();
    }
  });
});

describe("addMinutes", () => {
  it("crosses midnight, month ends, year ends and leap days, both ways", () => {
    expect(addMinutes(at(13, 10, 2026, 23, 59), 1)).toEqual(at(14, 10, 2026, 0, 0));
    expect(addMinutes(at(31, 10, 2026, 23, 50), 10)).toEqual(at(1, 11, 2026, 0, 0));
    expect(addMinutes(at(31, 12, 2026, 23, 59), 1)).toEqual(at(1, 1, 2027, 0, 0));
    expect(addMinutes(at(28, 2, 2028, 23, 59), 1)).toEqual(at(29, 2, 2028, 0, 0));
    expect(addMinutes(at(28, 2, 2026, 23, 59), 1)).toEqual(at(1, 3, 2026, 0, 0));
    expect(addMinutes(at(1, 3, 2028, 0, 0), -1)).toEqual(at(29, 2, 2028, 23, 59));
    expect(addMinutes(at(1, 1, 2027, 0, 5), -10)).toEqual(at(31, 12, 2026, 23, 55));
    expect(addMinutes(at(13, 10, 2026, 10, 10), 0)).toEqual(at(13, 10, 2026, 10, 10));
  });
});

describe("minuteIndex", () => {
  it("counts minutes since 1.1.2000 and orders times", () => {
    expect(minuteIndex(at(1, 1, 2000, 0, 0))).toBe(0);
    expect(minuteIndex(at(2, 1, 2000, 0, 1))).toBe(1441);
    expect(minuteIndex(at(1, 3, 2000, 0, 0))).toBe((31 + 29) * 1440);
    const a = at(13, 10, 2026, 10, 10);
    expect(minuteIndex(addMinutes(a, 12345)) - minuteIndex(a)).toBe(12345);
  });
});

describe("formatClock", () => {
  it("24-hour: two-digit hours (settings/format/24-*-page)", () => {
    expect(formatClock(at(13, 10, 2026, 0, 5), false)).toBe("00:05");
    expect(formatClock(at(13, 10, 2026, 9, 41), false)).toBe("09:41");
    expect(formatClock(at(13, 10, 2026, 23, 59), false)).toBe("23:59");
  });

  it("12-hour: 12 for 0 and 12, two-digit hours, am/pm (settings/format/12-*-page)", () => {
    expect(formatClock(at(13, 10, 2026, 0, 5), true)).toBe("12:05 am");
    expect(formatClock(at(13, 10, 2026, 9, 41), true)).toBe("09:41 am");
    expect(formatClock(at(13, 10, 2026, 12, 0), true)).toBe("12:00 pm");
    expect(formatClock(at(13, 10, 2026, 13, 7), true)).toBe("01:07 pm");
    expect(formatClock(at(13, 10, 2026, 23, 59), true)).toBe("11:59 pm");
  });
});

describe("formatDate", () => {
  it("DD.MM.YYYY", () => {
    expect(formatDate(at(13, 10, 2026, 10, 10))).toBe("13.10.2026");
    expect(formatDate(at(2, 2, 2006, 0, 0))).toBe("02.02.2006");
  });
});
