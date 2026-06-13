import { describe, expect, it } from "vite-plus/test";
import { bootedPhone } from "./fixtures";

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

  it("standby up opens the phone book name list", () => {
    const phone = bootedPhone();
    phone.pressKey("up");
    expect(phone.path).toBe("menu/phone-book/search");
    expect(phone.screen).toMatchObject({
      kind: "list",
      title: "Search",
      items: ["Alice", "Bob"],
    });
  });

  it("standby down opens the dialled numbers list", () => {
    const phone = bootedPhone();
    phone.pressKey("down");
    expect(phone.path).toBe("menu/call-register/dialled-numbers");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Dialled numbers" });
  });

  it("standby up is a no-op when the menu lacks phone-book/search", () => {
    const phone = bootedPhone({
      menu: [{ type: "reader", id: "only", label: "Only", body: "x" }],
    });
    phone.pressKey("up");
    expect(phone.path).toBe("standby");
  });
});
