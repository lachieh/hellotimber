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
import type { MenuEntry, Phone, PhoneConfig, ScreenModel, SubmenuOptions } from "../src/index";
import { bootedPhone, makeFakeApp } from "./fixtures";

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);

function readers(count: number): ReaderEntry[] {
  return Array.from(
    { length: count },
    (_, index) =>
      new ReaderEntry(slug(`item-${index + 1}`), order(index + 1), `Item ${index + 1}`, "Body"),
  );
}

/** One top-level submenu "level" (with `options`) holding `children`, plus a second slot. */
function levelMenu(
  options: SubmenuOptions,
  children: readonly MenuEntry[] = readers(6),
): { menu: PhoneMenu; level: SubmenuEntry } {
  const level = new SubmenuEntry(
    slug("level"),
    order(1),
    "Level",
    new MenuLevel(children),
    undefined,
    options,
  );
  const menu = new PhoneMenu([
    new TopLevelEntry(level, new MenuGraphic("level")),
    new TopLevelEntry(
      new ReaderEntry(slug("other"), order(2), "Other", "Body"),
      new MenuGraphic("other"),
    ),
  ]);
  return { menu, level };
}

function phoneFor(
  options: SubmenuOptions,
  config: Partial<PhoneConfig> = {},
  children?: readonly MenuEntry[],
): Phone {
  return bootedPhone({ menu: levelMenu(options, children).menu, ...config });
}

function list(phone: Phone): Extract<ScreenModel, { kind: "list" }> {
  const screen = phone.screen;
  if (screen.kind !== "list") throw new Error(`Expected a list, received ${screen.kind}.`);
  return screen;
}

describe("SubmenuOptions.softkey", () => {
  it("is emitted as the level's list softkey", () => {
    const phone = phoneFor({ softkey: "OK" });
    phone.navigate("menu/level");
    expect(list(phone).softkey).toBe("OK");
  });

  it("defaults to Select and is exposed on the entry", () => {
    const phone = phoneFor({});
    phone.navigate("menu/level");
    expect(list(phone).softkey).toBe("Select");
    expect(levelMenu({}).level.softkey).toBe("Select");
    expect(levelMenu({ softkey: "OK" }).level.softkey).toBe("OK");
  });

  it("rejects an empty softkey", () => {
    expect(() => levelMenu({ softkey: "" })).toThrow(/softkey/);
    expect(() => levelMenu({ softkey: "  " })).toThrow(/softkey/);
  });
});

describe("SubmenuOptions.opening", () => {
  it("selects the opening child on Select, on a path landing and on a shortcut digit", () => {
    const phone = phoneFor({ opening: () => undefined }, {}, readers(3));
    // Undefined falls back to the first child.
    phone.navigate("menu");
    phone.pressKey("navi");
    expect(list(phone).selected).toBe(0);

    const { menu, level } = levelMenu({ opening: () => level.children.entries[4] });
    const opened = bootedPhone({ menu });
    opened.navigate("menu");
    opened.pressKey("navi");
    expect(list(opened).selected).toBe(4);

    opened.navigate("menu/other");
    opened.navigate("menu/level");
    expect(list(opened).selected).toBe(4);

    opened.navigate("standby");
    opened.pressKey("navi");
    opened.pressKey("1");
    expect(opened.path).toBe("menu/level");
    expect(list(opened).selected).toBe(4);
  });

  it("re-reads the opening child on every entry", () => {
    let current = 1;
    const { menu, level } = levelMenu({ opening: () => level.children.entries[current] });
    const phone = bootedPhone({ menu });
    phone.navigate("menu/level");
    expect(list(phone).selected).toBe(1);
    phone.pressKey("c");
    current = 3;
    phone.pressKey("navi");
    expect(list(phone).selected).toBe(3);
  });

  it("does not move the selection on a return from a child or a path through the level", () => {
    const { menu, level } = levelMenu({ opening: () => level.children.entries[2] });
    const phone = bootedPhone({ menu });
    phone.navigate("menu/level/item-6");
    phone.pressKey("c");
    expect(list(phone).selected).toBe(5);
    phone.pressKey("up");
    phone.pressKey("navi");
    phone.pressKey("c");
    expect(list(phone).selected).toBe(4);
  });

  it("falls back to the first child for an entry that is not a child", () => {
    const stranger = new ReaderEntry(slug("stranger"), order(9), "Stranger", "Body");
    const phone = phoneFor({ opening: () => stranger });
    phone.navigate("menu/level");
    expect(list(phone).selected).toBe(0);
  });

  it("starts the rows window at the opening child (D3 entry rule)", () => {
    const { menu, level } = levelMenu({ opening: () => level.children.entries[4] });
    const phone = bootedPhone({ menu, rowsWindow: 3 });
    phone.navigate("menu/level");
    expect(list(phone)).toMatchObject({ selected: 4, windowTop: 4 });

    // With rows or fewer items the window stays at 0 (Name list / Name, number / Large font).
    const small = levelMenu({ opening: () => small.level.children.entries[2] }, readers(3));
    const few = bootedPhone({ menu: small.menu, rowsWindow: 3 });
    few.navigate("menu/level");
    expect(list(few)).toMatchObject({ selected: 2, windowTop: 0 });
  });

  it("rejects an opening reader that is not a function", () => {
    expect(() => levelMenu({ opening: "first" as never })).toThrow(/opening/);
  });

  it("leaves models without options unchanged", () => {
    const fake = makeFakeApp("edit");
    const phone = phoneFor({}, {}, [
      ...readers(2),
      new ApplicationEntry(slug("edit"), order(3), "Edit", fake.application),
    ]);
    phone.navigate("menu/level");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Level",
      items: ["Item 1", "Item 2", "Edit"],
      selected: 0,
      softkey: "Select",
      menuIndicator: { segments: [1], awaitingNext: false },
    });
  });
});

describe("SubmenuOptions.entryIndicatorMs", () => {
  const HOLD_MS = 2948;

  /** The phone at the carousel on the level's slot, `now` ms into its clock. */
  function atCarousel(options: SubmenuOptions, config: Partial<PhoneConfig> = {}) {
    const phone = phoneFor(options, config);
    phone.navigate("menu");
    let now = 1000;
    return {
      phone,
      tick: (ms: number) => {
        now += ms;
        phone.tick(now);
      },
    };
  }

  it("shows the level's own path as entering for that long after Select, then the selection", () => {
    const { phone, tick } = atCarousel({ entryIndicatorMs: HOLD_MS });
    const indicators: unknown[] = [];
    phone.pressKey("navi");
    phone.subscribe((snap) => {
      if (snap.screen.kind === "list") indicators.push(snap.screen.menuIndicator);
    });
    expect(list(phone).menuIndicator).toEqual({
      segments: [1],
      awaitingNext: false,
      entering: true,
    });
    tick(HOLD_MS - 1);
    expect(list(phone).menuIndicator).toMatchObject({ entering: true });
    expect(indicators).toEqual([]);
    tick(1);
    expect(list(phone).menuIndicator).toEqual({ segments: [1], awaitingNext: false });
    expect(indicators).toEqual([{ segments: [1], awaitingNext: false }]);
  });

  it("ends at any key: ▼ moves on, Select opens the selected child", () => {
    const moved = atCarousel({ entryIndicatorMs: HOLD_MS });
    moved.phone.pressKey("navi");
    moved.tick(600);
    moved.phone.pressKey("down");
    expect(list(moved.phone)).toMatchObject({
      selected: 1,
      menuIndicator: { segments: [1], awaitingNext: false },
    });
    expect(list(moved.phone).menuIndicator).not.toHaveProperty("entering");

    const opened = atCarousel({ entryIndicatorMs: HOLD_MS });
    opened.phone.pressKey("navi");
    opened.tick(600);
    opened.phone.pressKey("navi");
    expect(opened.phone.path).toBe("menu/level/item-1");
    opened.phone.pressKey("c");
    expect(list(opened.phone).menuIndicator).toEqual({ segments: [1], awaitingNext: false });
  });

  it("is not shown on a path landing or a return from a child", () => {
    const { phone } = atCarousel({ entryIndicatorMs: HOLD_MS });
    phone.navigate("menu/level");
    expect(list(phone).menuIndicator).toEqual({ segments: [1], awaitingNext: false });
    phone.navigate("menu/level/item-2");
    phone.pressKey("c");
    expect(list(phone).menuIndicator).toEqual({ segments: [1], awaitingNext: false });
  });

  it("defaults to 0 (none) and rejects a negative or fractional duration", () => {
    expect(levelMenu({}).level.entryIndicatorMs).toBe(0);
    expect(levelMenu({ entryIndicatorMs: HOLD_MS }).level.entryIndicatorMs).toBe(HOLD_MS);
    expect(() => levelMenu({ entryIndicatorMs: -1 })).toThrow(/entryIndicatorMs/);
    expect(() => levelMenu({ entryIndicatorMs: 1.5 })).toThrow(/entryIndicatorMs/);
    const { phone } = atCarousel({});
    phone.pressKey("navi");
    expect(list(phone).menuIndicator).toEqual({ segments: [1], awaitingNext: false });
  });
});
