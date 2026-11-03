// Plan 32 Phase 1: the host's signal and battery levels on standby (PhoneConfig.signal, .battery).
import { describe, expect, it } from "vite-plus/test";
import type { ScreenModel, StatusLevel } from "../src/index";
import { bootedPhone } from "./fixtures";

function standby(screen: ScreenModel): Extract<ScreenModel, { kind: "standby" }> {
  if (screen.kind !== "standby") throw new Error(`expected standby, got ${screen.kind}`);
  return screen;
}

describe("standby signal and battery levels", () => {
  it("shows full ladders without host levels", () => {
    const screen = standby(bootedPhone().screen);
    expect(screen.signal).toBe(4);
    expect(screen.battery).toBe(4);
  });

  it("re-reads the host's levels on every tick", () => {
    let signal: StatusLevel = 2;
    let battery: StatusLevel = 1;
    const phone = bootedPhone({ signal: () => signal, battery: () => battery });
    expect(standby(phone.screen)).toMatchObject({ signal: 2, battery: 1 });
    signal = 0;
    battery = 3;
    phone.tick(5000);
    expect(standby(phone.screen)).toMatchObject({ signal: 0, battery: 3 });
  });
});
