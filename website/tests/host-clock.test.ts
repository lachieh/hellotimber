import { expect, it } from "vite-plus/test";
import { hostClock, hostDate, hostTimestamp } from "../src/phone/host-clock";
it("uses Brisbane's date across the UTC date boundary", () => {
  const date = new Date("2026-10-29T20:30:40Z");
  expect(hostClock(date)).toBe("06:30");
  expect(hostDate(date)).toBe("30.10.2026");
  expect(hostTimestamp(date)).toEqual({
    year: 2026,
    month: 10,
    day: 30,
    hour: 6,
    minute: 30,
    second: 40,
  });
  expect(hostClock(new Date("2026-10-29T14:00:00Z"))).toBe("00:00");
});
