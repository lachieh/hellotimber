import { describe, expect, it } from "vite-plus/test";
import {
  MenuGraphic,
  MenuOrder,
  MenuSlug,
  PhoneMenu,
  ReaderEntry,
  TopLevelEntry,
} from "../src/index";
import { bootedPhone, TEST_STANDBY_KEYS } from "./fixtures";

describe("standby keys & menu carousel", () => {
  it("navi in standby opens the carousel on menu 1", () => {
    const phone = bootedPhone();
    phone.pressKey("navi");
    expect(phone.path).toBe("menu");
    expect(phone.screen).toEqual({
      kind: "menu-carousel",
      label: "Phone book",
      menuNumber: 1,
      total: 5,
      iconId: "phone-book",
      menuIndicator: { segments: [1], awaitingNext: false, awaitingFirst: true },
    });
  });

  it("down cycles forward; up cycles backward; both wrap around", () => {
    const phone = bootedPhone();
    phone.pressKey("navi");
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({
      kind: "menu-carousel",
      label: "Messages",
      menuNumber: 2,
    });
    phone.pressKey("up");
    phone.pressKey("up"); // wraps from 1 to 5
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", label: "GitHub", menuNumber: 5 });
    phone.pressKey("down"); // wraps back to 1
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", menuNumber: 1 });
  });

  it("scrolling the carousel does not change the path", () => {
    const phone = bootedPhone();
    phone.pressKey("navi");
    phone.pressKey("down");
    expect(phone.path).toBe("menu");
  });

  it("navi enters the selected menu; c steps back; c again returns to standby", () => {
    const phone = bootedPhone();
    phone.pressKey("navi");
    phone.pressKey("navi"); // enter Phone book
    expect(phone.path).toBe("menu/phone-book");
    expect(phone.screen).toMatchObject({
      kind: "list",
      title: "Phone book",
      items: ["Search", "Memory status"],
      selected: 0,
      softkey: "Select",
    });
    phone.pressKey("c");
    expect(phone.path).toBe("menu");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", label: "Phone book" });
    phone.pressKey("c");
    expect(phone.path).toBe("standby");
  });

  it("entering a top-level reader shows it (Chat)", () => {
    const phone = bootedPhone();
    phone.pressKey("navi");
    phone.pressKey("down");
    phone.pressKey("down"); // Chat
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/chat");
    expect(phone.screen).toMatchObject({ kind: "reader", title: "Chat", scrollTop: 0 });
  });

  it("hold-c exits to standby from deep in the menus", () => {
    const phone = bootedPhone();
    phone.pressKey("navi");
    phone.pressKey("navi"); // Phone book
    phone.pressKey("navi"); // Search list
    expect(phone.path).toBe("menu/phone-book/search");
    phone.pressKey("c", 1000);
    expect(phone.path).toBe("standby");
  });

  const standbyKeys = TEST_STANDBY_KEYS;

  it("standby up opens the configured up path", () => {
    const phone = bootedPhone({ standbyKeys });
    phone.pressKey("up");
    expect(phone.path).toBe("menu/phone-book/search");
    expect(phone.screen).toMatchObject({
      kind: "list",
      title: "Search",
      items: ["Alice", "Bob"],
    });
  });

  it("standby down opens the configured down path", () => {
    const phone = bootedPhone({ standbyKeys });
    phone.pressKey("down");
    expect(phone.path).toBe("menu/call-register/dialled-numbers");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Dialled numbers" });
  });

  it("standby up/down are no-ops without standbyKeys or with one key configured", () => {
    const phone = bootedPhone();
    phone.pressKey("up");
    phone.pressKey("down");
    expect(phone.path).toBe("standby");
    const upOnly = bootedPhone({ standbyKeys: { up: standbyKeys.up } });
    upOnly.pressKey("down");
    expect(upOnly.path).toBe("standby");
  });

  it("standby up is a no-op when the configured path is not in the menu", () => {
    const phone = bootedPhone({
      standbyKeys,
      menu: new PhoneMenu([
        new TopLevelEntry(
          new ReaderEntry(new MenuSlug("only"), new MenuOrder(1), "Only", "x"),
          new MenuGraphic("only"),
        ),
      ]),
    });
    phone.pressKey("up");
    expect(phone.path).toBe("standby");
  });
});
