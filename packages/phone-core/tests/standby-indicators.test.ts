// Plan 18 Task 4: PhoneConfig.standbyIndicators, re-read on every tick like the clock.
import { describe, expect, it } from "vite-plus/test";
import type { PhoneSnapshot, StandbyIndicators } from "../src/index";
import { bootedPhone } from "./fixtures";

describe("standby indicators", () => {
  it("leaves the models unchanged without a reader", () => {
    const phone = bootedPhone();
    expect(phone.screen).not.toHaveProperty("indicators");
  });

  it("emits the fields that are true on the standby model only", () => {
    let indicators: StandbyIndicators | undefined = { message: true };
    const phone = bootedPhone({ standbyIndicators: () => indicators });
    expect(phone.screen).toMatchObject({ kind: "standby", indicators: { message: true } });
    phone.pressKey("navi");
    expect(phone.screen).not.toHaveProperty("indicators");
    phone.pressKey("c");
    indicators = { message: true, voicemail: false };
    phone.tick(10);
    expect(phone.screen).toEqual(expect.objectContaining({ indicators: { message: true } }));
  });

  it("emits no field for {} or false fields, nor for undefined", () => {
    for (const value of [{}, { message: false }, { message: false, voicemail: false }, undefined]) {
      const phone = bootedPhone({ standbyIndicators: () => value });
      expect(phone.screen, JSON.stringify(value)).not.toHaveProperty("indicators");
    }
  });

  it("emits exactly one snapshot when the value changes between ticks, none when it does not", () => {
    let indicators: StandbyIndicators | undefined;
    const phone = bootedPhone({ standbyIndicators: () => indicators });
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    phone.tick(100);
    expect(snaps).toHaveLength(0);
    indicators = { message: true };
    phone.tick(200);
    phone.tick(300);
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.screen).toMatchObject({ indicators: { message: true } });
    indicators = { message: true };
    phone.tick(400);
    expect(snaps).toHaveLength(1);
    indicators = undefined;
    phone.tick(500);
    expect(snaps).toHaveLength(2);
    expect(snaps[1]!.screen).not.toHaveProperty("indicators");
  });
});
