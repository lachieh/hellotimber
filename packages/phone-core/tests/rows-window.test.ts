import { describe, expect, it } from "vite-plus/test";
import {
  ApplicationEntry,
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneMenu,
  ReaderEntry,
  SubmenuEntry,
  TopLevelEntry,
} from "../src/index";
import type { MenuEntry, Phone, PhoneConfig, ScreenModel } from "../src/index";
import { bootedPhone, makeFakeApp } from "./fixtures";

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);

const LABELS = [
  "Search",
  "Service Nos.",
  "Add name",
  "Erase",
  "Edit",
  "Send b'card",
  "Options",
  "Speed dials",
  "Voice tags",
  "Last",
];

/** A ten-item rows level (Phone book's size) with a child submenu at Erase and an app at Edit. */
function windowMenu(): PhoneMenu {
  const app = makeFakeApp("edit").application;
  const children: MenuEntry[] = LABELS.map((label, index) => {
    const id = slug(`item-${index + 1}`);
    if (index === 3) {
      return new SubmenuEntry(
        id,
        order(index + 1),
        label,
        new MenuLevel([
          new ReaderEntry(slug("one-by-one"), order(1), "One by one", "Body"),
          new ReaderEntry(slug("erase-all"), order(2), "Erase all", "Body"),
        ]),
      );
    }
    if (index === 4) return new ApplicationEntry(id, order(index + 1), label, app);
    return new ReaderEntry(id, order(index + 1), label, "Body");
  });
  return new PhoneMenu([
    new TopLevelEntry(
      new SubmenuEntry(slug("book"), order(1), "Phone book", new MenuLevel(children)),
      new MenuGraphic("book"),
    ),
    new TopLevelEntry(
      new SubmenuEntry(
        slug("settings"),
        order(2),
        "Settings",
        new MenuLevel(
          LABELS.slice(0, 5).map(
            (label, index) =>
              new ReaderEntry(slug(`page-${index + 1}`), order(index + 1), label, "Body"),
          ),
        ),
        undefined,
        { presentation: "pages" },
      ),
      new MenuGraphic("settings"),
    ),
  ]);
}

function phoneWith(overrides: Partial<PhoneConfig> = {}): Phone {
  return bootedPhone({ menu: windowMenu(), rowsWindow: 3, ...overrides });
}

function list(phone: Phone): Extract<ScreenModel, { kind: "list" }> {
  const screen = phone.screen;
  if (screen.kind !== "list") throw new Error(`Expected a list, received ${screen.kind}.`);
  return screen;
}

/** Selection and window after each key. */
function press(phone: Phone, keys: readonly ("up" | "down")[]): [number, number | undefined][] {
  return keys.map((key) => {
    phone.pressKey(key);
    const { selected, windowTop } = list(phone);
    return [selected, windowTop];
  });
}

describe("rows window (PhoneConfig.rowsWindow)", () => {
  it("emits windowTop from entry and follows ▼ through the wrap (P1)", () => {
    const phone = phoneWith();
    phone.navigate("menu");
    phone.pressKey("navi");
    expect(list(phone)).toMatchObject({ selected: 0, windowTop: 0 });

    const steps = press(phone, Array(12).fill("down"));
    expect(steps.slice(0, 3)).toEqual([
      [1, 0],
      [2, 0],
      [3, 1],
    ]);
    expect(steps[8]).toEqual([9, 7]);
    // Speed dials / Voice tags / Search, then Voice tags / Search / Service Nos., ...
    expect(steps.slice(9)).toEqual([
      [0, 8],
      [1, 9],
      [2, 0],
    ]);
  });

  it("puts the last item on the top row for ▲ from the first, and ▲ above the window on top", () => {
    const phone = phoneWith();
    phone.navigate("menu/book");
    expect(press(phone, ["up", "up", "down", "down", "down", "up"])).toEqual([
      [9, 9],
      [8, 8],
      [9, 8],
      [0, 8],
      [1, 9],
      [0, 9],
    ]);
  });

  it("keeps the window across a child submenu and an application (P3)", () => {
    const phone = phoneWith();
    phone.navigate("menu/book");
    press(phone, ["down", "down", "down", "down", "down", "up", "up"]); // Erase (3) on the top row
    expect(list(phone)).toMatchObject({ selected: 3, windowTop: 3 });

    phone.pressKey("navi");
    expect(phone.path).toBe("menu/book/item-4");
    phone.pressKey("c");
    expect(list(phone)).toMatchObject({ selected: 3, windowTop: 3 });

    phone.pressKey("down"); // Edit: an application
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/book/item-5");
    phone.pressKey("c");
    expect(phone.path).toBe("menu/book");
    expect(list(phone)).toMatchObject({ selected: 4, windowTop: 3 });
  });

  it("rebuilds the window when the level is entered again (P4)", () => {
    const phone = phoneWith();
    phone.navigate("menu/book");
    press(phone, Array(5).fill("down"));
    expect(list(phone)).toMatchObject({ selected: 5, windowTop: 3 });
    phone.pressKey("c");
    phone.pressKey("navi");
    expect(list(phone)).toMatchObject({ selected: 0, windowTop: 0 });
  });

  it("puts the entry a path lands under on the parent's top row", () => {
    const phone = phoneWith();
    phone.navigate("menu/book/item-4");
    phone.pressKey("c");
    expect(list(phone)).toMatchObject({ selected: 3, windowTop: 3 });

    phone.navigate("menu/book/item-10");
    phone.pressKey("c");
    expect(list(phone)).toMatchObject({ selected: 9, windowTop: 9 });
  });

  it("puts a shortcut digit's entry on the top row (P5: Speed dials / Voice tags / Search)", () => {
    const phone = phoneWith();
    phone.pressKey("navi");
    phone.pressKey("1");
    expect(list(phone)).toMatchObject({ selected: 0, windowTop: 0 });
    phone.pressKey("8");
    expect(phone.path).toBe("menu/book/item-8");
    phone.pressKey("c");
    expect(list(phone)).toMatchObject({ selected: 7, windowTop: 7 });
  });

  it("never scrolls a level of rows or fewer", () => {
    const phone = phoneWith();
    phone.navigate("menu/book/item-4");
    expect(list(phone)).toMatchObject({ selected: 0, windowTop: 0 });
    expect(press(phone, ["down", "down", "up"])).toEqual([
      [1, 0],
      [0, 0],
      [1, 0],
    ]);
  });

  it("omits windowTop for pages levels and without rowsWindow", () => {
    const phone = phoneWith();
    phone.navigate("menu/settings");
    expect("windowTop" in list(phone)).toBe(false);

    const plain = phoneWith({ rowsWindow: undefined });
    plain.navigate("menu/book");
    plain.pressKey("down");
    expect("windowTop" in list(plain)).toBe(false);
  });

  it("rejects a rowsWindow that is not a positive integer", () => {
    for (const rowsWindow of [0, -1, 2.5]) {
      expect(() => phoneWith({ rowsWindow })).toThrow(/rowsWindow/);
    }
  });
});
