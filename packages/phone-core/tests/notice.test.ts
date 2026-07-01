import { describe, expect, it } from "vite-plus/test";
import type { PhoneSnapshot, ScreenModel } from "../src/index";
import { bootedPhone } from "./fixtures";

type StandbyScreen = Extract<ScreenModel, { kind: "standby" }>;

const NOTICE = { text: "1 message received", softkey: "Read" };

describe("standby notice", () => {
  it("setNotice shows on the standby screen and flushes to subscribers", () => {
    const phone = bootedPhone();
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    phone.setNotice({ ...NOTICE, path: "menu/messages/inbox" });
    expect(phone.screen).toMatchObject({ kind: "standby", notice: NOTICE });
    expect(snaps).toHaveLength(1); // dirty flush → subscribers re-render
  });

  it("navi while noticed navigates to the path and clears the notice", () => {
    const phone = bootedPhone();
    phone.setNotice({ ...NOTICE, path: "menu/messages/inbox" });
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/messages/inbox");
    phone.pressKey("c", 1000); // hold-C back to standby
    expect((phone.screen as StandbyScreen).notice).toBeUndefined();
  });

  it("navi with no path just clears, staying in standby", () => {
    const phone = bootedPhone();
    phone.setNotice(NOTICE);
    phone.pressKey("navi");
    expect(phone.path).toBe("standby");
    expect((phone.screen as StandbyScreen).notice).toBeUndefined();
    phone.pressKey("navi"); // no notice anymore → normal Menu behavior
    expect(phone.path).toBe("menu");
  });

  it("C clears the notice in place", () => {
    const phone = bootedPhone();
    phone.setNotice(NOTICE);
    phone.pressKey("c");
    expect(phone.path).toBe("standby");
    expect((phone.screen as StandbyScreen).notice).toBeUndefined();
  });

  it("setNotice(null) clears", () => {
    const phone = bootedPhone();
    phone.setNotice(NOTICE);
    phone.setNotice(null);
    expect((phone.screen as StandbyScreen).notice).toBeUndefined();
  });

  it("the notice survives menu round-trips (standby state, not screen state)", () => {
    const phone = bootedPhone();
    phone.setNotice({ ...NOTICE, path: "menu/messages/inbox" });
    phone.navigate("menu/phone-book/search");
    expect(phone.path).toBe("menu/phone-book/search");
    phone.navigate("standby");
    expect(phone.screen).toMatchObject({ kind: "standby", notice: NOTICE });
    phone.pressKey("navi"); // still armed: Read → inbox
    expect(phone.path).toBe("menu/messages/inbox");
  });
});
