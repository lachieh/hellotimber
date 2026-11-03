// Plan 21 Task 5: phone time over a scripted host clock (D1) and minute edges (D2).
import { describe, expect, it } from "vite-plus/test";
import { createMemoryStorage, StockEeprom } from "../src/firmware/eeprom";
import { CLOCK_RECORD } from "../src/kit/system/clock/record";
import { StockClock, TIME_FORMAT } from "../src/kit/system/clock/service";
import { createStockSettings } from "../src/firmware/settings";
import type { PhoneTime } from "../src/kit/system/clock/time";

/** A host clock the test moves: `HH:MM` and `DD.MM.YYYY`. */
function scriptedHost(clock = "10:10", date = "13.10.2026") {
  const host = { clock: clock as string | undefined, date: date as string | undefined };
  return {
    host,
    ports: { clock: () => host.clock, date: () => host.date },
  };
}

function rig(clock?: string, date?: string, storage = createMemoryStorage()) {
  const { host, ports } = scriptedHost(clock, date);
  const eeprom = new StockEeprom(storage);
  const settings = createStockSettings(eeprom);
  const service = new StockClock({ host: ports, settings, eeprom });
  const edges: PhoneTime[] = [];
  service.onMinute((at) => edges.push(at));
  return { host, eeprom, settings, service, edges, storage };
}

describe("CLOCK_RECORD", () => {
  it("is virgin: no alarm, no snooze, no offset, the clock shown", () => {
    expect(CLOCK_RECORD.initial()).toEqual({
      alarm: null,
      alarmOn: false,
      snooze: null,
      offsetMinutes: 0,
      hidden: false,
    });
  });

  it("keeps the alarm and the time on Restore factory settings, and shows the clock", () => {
    const state = {
      alarm: { hour: 10, minute: 11 },
      alarmOn: true,
      snooze: null,
      offsetMinutes: 50,
      hidden: true,
    };
    expect(CLOCK_RECORD.factory!(state)).toEqual({ ...state, hidden: false });
  });

  it("round-trips and drops malformed fields", () => {
    const value = {
      alarm: { hour: 10, minute: 11 },
      alarmOn: true,
      snooze: { dueMinute: 1234 },
      offsetMinutes: -61,
      hidden: true,
    };
    expect(CLOCK_RECORD.decode(CLOCK_RECORD.encode(value), 1)).toEqual(value);
    expect(
      CLOCK_RECORD.decode(
        { alarm: { hour: 24, minute: 0 }, snooze: "x", offsetMinutes: 1.5, hidden: "yes" },
        1,
      ),
    ).toEqual(CLOCK_RECORD.initial());
    expect(() => CLOCK_RECORD.decode([], 1)).toThrow();
  });
});

describe("StockClock", () => {
  it("shows the host's time while no offset is stored", () => {
    const { service } = rig("10:10", "13.10.2026");
    expect(service.ports.clock!()).toBe("10:10");
    expect(service.ports.date!()).toBe("13.10.2026");
    expect(service.standbyClock()).toBe("10:10");
  });

  it("is host time plus the offset Set the time and Date setting store; the host is untouched", () => {
    const { service, host, storage } = rig("10:10", "13.10.2026");
    service.setTime(9, 59);
    expect(service.ports.clock!()).toBe("09:59");
    expect(service.ports.date!()).toBe("13.10.2026");
    service.setDate(14, 10, 2026);
    expect(service.ports.clock!()).toBe("09:59");
    expect(service.ports.date!()).toBe("14.10.2026");
    host.clock = "23:59";
    expect(service.ports.clock!()).toBe("23:48");
    expect(service.ports.date!()).toBe("14.10.2026");
    host.clock = "00:20";
    host.date = "14.10.2026";
    expect(service.ports.date!()).toBe("15.10.2026");
    // persisted: a new phone over the same EEPROM keeps the offset
    const again = rig("10:10", "13.10.2026", storage);
    expect(again.service.ports.clock!()).toBe("09:59");
    expect(again.service.ports.date!()).toBe("14.10.2026");
  });

  it("has no time (and never throws) while the host's strings do not parse", () => {
    const { service, host } = rig("10:10", "13.10.2026");
    host.clock = "25:00";
    expect(service.now()).toBeUndefined();
    expect(service.ports.clock!()).toBeUndefined();
    expect(service.ports.date!()).toBeUndefined();
    expect(service.standbyClock()).toBeUndefined();
    service.setTime(1, 2);
    host.clock = "10:10";
    expect(service.ports.clock!()).toBe("10:10");
  });

  it("hides the standby clock and shows the 12-hour form (D10)", () => {
    const { service, settings } = rig("13:07", "13.10.2026");
    settings.choose(TIME_FORMAT.key, TIME_FORMAT.twelveHour);
    expect(service.standbyClock()).toBe("01:07 pm");
    expect(service.ports.clock!()).toBe("13:07");
    service.setHidden(true);
    expect(service.standbyClock()).toBeUndefined();
    expect(service.ports.clock!()).toBe("13:07");
    service.setHidden(false);
    expect(service.standbyClock()).toBe("01:07 pm");
  });

  it("fires one edge per forwards minute change, at any tick rate", () => {
    const { service, host, edges } = rig("10:10", "13.10.2026");
    for (let i = 0; i < 1000; i++) service.tick();
    expect(edges).toEqual([]);
    host.clock = "10:11";
    service.tick();
    service.tick();
    expect(edges.map((t) => `${t.hour}:${t.minute}`)).toEqual(["10:11"]);
    host.clock = "10:21"; // a ten-minute jump: one edge
    service.tick();
    expect(edges.map((t) => `${t.hour}:${t.minute}`)).toEqual(["10:11", "10:21"]);
    host.clock = "10:05"; // backwards: none, and none on the way back up to 10:21
    service.tick();
    host.clock = "10:06";
    service.tick();
    expect(edges).toHaveLength(3);
    expect(edges[2]!.minute).toBe(6);
  });

  it("never fires for Set the time or Date setting, nor without a time", () => {
    const { service, host, edges } = rig("10:10", "13.10.2026");
    service.setTime(23, 0);
    service.tick();
    service.setDate(1, 1, 2030);
    service.tick();
    expect(edges).toEqual([]);
    host.clock = undefined;
    service.tick();
    host.clock = "10:30";
    service.tick();
    expect(edges).toEqual([]);
    host.clock = "10:31";
    service.tick();
    expect(edges).toHaveLength(1);
  });
});
