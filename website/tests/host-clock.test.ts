import { expect, it } from "vite-plus/test";
import { hostClock, hostDate, hostTimestamp } from "../src/phone/host-clock";
it("uses New York's date across the UTC date boundary", () => {
  const date = new Date("2026-10-30T02:30:40Z");
  expect(hostClock(date)).toBe("22:30");
  expect(hostDate(date)).toBe("29.10.2026");
  expect(hostTimestamp(date)).toEqual({
    year: 2026,
    month: 10,
    day: 29,
    hour: 22,
    minute: 30,
    second: 40,
  });
  expect(hostClock(new Date("2026-10-30T04:00:00Z"))).toBe("00:00");
});

it("follows Eastern daylight saving time", () => {
  expect(hostClock(new Date("2026-01-15T12:00:00Z"))).toBe("07:00");
  expect(hostClock(new Date("2026-07-15T12:00:00Z"))).toBe("08:00");
});
