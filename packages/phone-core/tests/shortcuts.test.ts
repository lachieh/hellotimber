import { describe, expect, it } from "vite-plus/test";
import { bootedPhone } from "./fixtures";

describe("menu shortcuts", () => {
  it("a digit inside the window positions the carousel on that menu without entering", () => {
    const phone = bootedPhone();
    phone.pressKey("navi");
    phone.pressKey("2");
    expect(phone.screen).toMatchObject({
      kind: "menu-carousel",
      label: "Messages",
      menuNumber: 2,
    });
    expect(phone.path).toBe("menu");
  });

  it("navi enters the shortcut target", () => {
    const phone = bootedPhone();
    phone.pressKey("navi");
    phone.pressKey("2");
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/messages");
  });

  it("the window times out after 3s and enters the target", () => {
    const phone = bootedPhone();
    phone.tick(10_000);
    phone.pressKey("navi"); // window: 10000 → 13000
    phone.pressKey("2"); // restarts: still 13000 (no tick since)
    phone.tick(12_999);
    expect(phone.path).toBe("menu");
    phone.tick(13_000);
    expect(phone.path).toBe("menu/messages");
  });

  it("multi-digit shortcuts descend levels: Menu 2 2 opens the Inbox", () => {
    const phone = bootedPhone();
    phone.pressKey("navi");
    phone.pressKey("2");
    phone.pressKey("2");
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/messages/inbox");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Inbox" });
  });

  it("an expired window without digits just stays in the carousel; later digits are ignored", () => {
    const phone = bootedPhone();
    phone.tick(10_000);
    phone.pressKey("navi");
    phone.tick(14_000); // window (no digits) expires silently
    expect(phone.path).toBe("menu");
    phone.pressKey("2"); // no window → ignored
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", menuNumber: 1 });
  });

  it("out-of-range digits leave the carousel where it is", () => {
    const phone = bootedPhone();
    phone.pressKey("navi");
    phone.pressKey("9"); // only 5 menus in the fixture — no preview jump
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", menuNumber: 1 });
    phone.pressKey("navi"); // digits [9] resolve to nothing → window cleared, still in carousel
    expect(phone.path).toBe("menu");
    phone.pressKey("navi"); // a plain navi now enters the selection
    expect(phone.path).toBe("menu/phone-book");
  });
});
