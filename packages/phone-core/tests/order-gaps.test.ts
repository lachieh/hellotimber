import { describe, expect, it } from "vite-plus/test";
import {
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneMenu,
  ReaderEntry,
  SubmenuEntry,
  TopLevelEntry,
} from "../src/index";
import type { Phone } from "../src/index";
import { bootedPhone } from "./fixtures";

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);
const reader = (name: string, number: number): ReaderEntry =>
  new ReaderEntry(slug(name), order(number), name, `${name} body`);

/** A level whose third visible entry keeps menu number 4 (number 3 is hidden). */
function gapPhone(): Phone {
  const menu = new PhoneMenu([
    new TopLevelEntry(
      new SubmenuEntry(
        slug("divert"),
        order(1),
        "Divert",
        new MenuLevel([reader("busy", 1), reader("off", 2), reader("cancel", 4)]),
      ),
      new MenuGraphic("divert"),
    ),
    new TopLevelEntry(
      new SubmenuEntry(
        slug("tones"),
        order(2),
        "Tones",
        new MenuLevel([reader("volume", 1), reader("alert", 2)]),
      ),
      new MenuGraphic("tones"),
    ),
  ]);
  return bootedPhone({ menu });
}

describe("sibling order gaps (hidden entries keep their numbers)", () => {
  it("lists the visible entries and exposes their menu numbers", () => {
    const phone = gapPhone();
    phone.navigate("menu/divert");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Divert",
      items: ["busy", "off", "cancel"],
      itemOrders: [1, 2, 4],
      selected: 0,
      softkey: "Select",
      menuIndicator: { segments: [1], awaitingNext: false },
    });
  });

  it("omits itemOrders when the numbers are 1..n", () => {
    const phone = gapPhone();
    phone.navigate("menu/tones");
    expect(phone.screen).not.toHaveProperty("itemOrders");
  });

  it("selects the entry's position, not its number, when a path lands under it", () => {
    const phone = gapPhone();
    phone.navigate("menu/divert/cancel");
    phone.pressKey("c");
    expect(phone.path).toBe("menu/divert");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 2 });
  });

  it("opens the entry by its number from a shortcut and ignores the hidden number", () => {
    const phone = gapPhone();
    phone.pressKey("navi");
    phone.pressKey("1");
    phone.pressKey("3");
    expect(phone.path).toBe("menu/divert");
    phone.pressKey("4");
    expect(phone.path).toBe("menu/divert/cancel");
    expect(phone.screen).toMatchObject({
      kind: "reader",
      menuIndicator: { segments: [1, 4] },
    });
  });

  it("moves through the visible entries with ▲/▼", () => {
    const phone = gapPhone();
    phone.navigate("menu/divert");
    phone.pressKey("up");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 2 });
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/divert/cancel");
  });
});

/** Two slots numbered 1 and 14 (v6.39's SIM services: Menu 14 without a 13). */
function topGapPhone(): Phone {
  const menu = new PhoneMenu([
    new TopLevelEntry(
      new SubmenuEntry(slug("sim"), order(14), "SIM", new MenuLevel([reader("one", 1)])),
      new MenuGraphic("sim"),
    ),
    new TopLevelEntry(reader("book", 1), new MenuGraphic("book")),
  ]);
  return bootedPhone({ menu });
}

describe("top-level order gaps (an entry carries its own menu number)", () => {
  it("keeps the slots in order and numbers each by its order", () => {
    const phone = topGapPhone();
    phone.navigate("menu");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", label: "book", menuNumber: 1 });
    expect(phone.screen).not.toHaveProperty("position");
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({
      kind: "menu-carousel",
      label: "SIM",
      menuNumber: 14,
      position: 2,
      total: 2,
      menuIndicator: { segments: [14], awaitingNext: false },
    });
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ label: "book", menuNumber: 1 });
    phone.pressKey("up");
    expect(phone.screen).toMatchObject({ label: "SIM", menuNumber: 14 });
  });

  it("lands a path on the slot's position and numbers its children under its number", () => {
    const phone = topGapPhone();
    phone.navigate("menu/sim/one");
    expect(phone.screen).toMatchObject({ kind: "reader", menuIndicator: { segments: [14, 1] } });
    phone.pressKey("c");
    expect(phone.screen).toMatchObject({ kind: "list", title: "SIM", selected: 0 });
    phone.pressKey("c");
    expect(phone.path).toBe("menu");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", menuNumber: 14, position: 2 });
  });
});
