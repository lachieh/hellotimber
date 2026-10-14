import { describe, expect, it } from "vite-plus/test";
import {
  createPhone,
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneMenu,
  ReaderEntry,
  SubmenuEntry,
  TopLevelEntry,
} from "../src/index";
import type { MenuEntry, Phone, PhoneSnapshot, ScreenModel, SubmenuOptions } from "../src/index";

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);

/** Composer: three slots, the second a submenu (its own level) holding one reader. */
function composer(options: SubmenuOptions): SubmenuEntry {
  return new SubmenuEntry(
    slug("composer"),
    order(1),
    "Composer",
    new MenuLevel([
      new ReaderEntry(slug("empty"), order(1), "(empty)", "Slot one"),
      new SubmenuEntry(
        slug("empty-2"),
        order(2),
        "(empty)",
        new MenuLevel([new ReaderEntry(slug("inner"), order(1), "Inner", "x")]),
      ),
      new ReaderEntry(slug("empty-3"), order(3), "(empty)", "Slot three"),
    ]),
    undefined,
    options,
  );
}

function phoneWith(options: SubmenuOptions): Phone {
  const menu = new PhoneMenu([
    new TopLevelEntry(composer(options), new MenuGraphic("composer")),
    new TopLevelEntry(
      new ReaderEntry(slug("other"), order(2), "Other", "Body"),
      new MenuGraphic("other"),
    ),
  ]);
  const phone = createPhone({ menu, bootMs: 0 });
  phone.tick(0);
  phone.pressKey("power", 1000);
  return phone;
}

function list(phone: Phone): Extract<ScreenModel, { kind: "list" }> {
  const screen = phone.screen;
  if (screen.kind !== "list") throw new Error(`Expected a list, received ${screen.kind}.`);
  return screen;
}

function snapshots(phone: Phone): PhoneSnapshot[] {
  const seen: PhoneSnapshot[] = [];
  phone.subscribe((snap) => seen.push(snap));
  return seen;
}

describe("SubmenuOptions.label", () => {
  const names: Record<string, string> = { "empty-2": "Tune", "empty-3": "Song" };
  const label = (child: MenuEntry): string | undefined => names[child.slug.value];

  it("relabels the children in the level's list; undefined keeps the child's label", () => {
    const phone = phoneWith({ label });
    phone.navigate("menu/composer");
    expect(list(phone).items).toEqual(["(empty)", "Tune", "Song"]);
  });

  it("titles a child's own level (a submenu and a reader) with its read label", () => {
    const phone = phoneWith({ label });
    phone.navigate("menu/composer/empty-2");
    expect(list(phone)).toMatchObject({ title: "Tune", items: ["Inner"] });
    phone.navigate("menu/composer/empty-3");
    expect(phone.screen).toMatchObject({ kind: "reader", title: "Song" });
  });

  it("leaves paths and slugs unchanged", () => {
    const phone = phoneWith({ label });
    phone.navigate("menu/composer/empty-2");
    expect(phone.path).toBe("menu/composer/empty-2");
    phone.navigate("menu/composer");
    phone.pressKey("down");
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/composer/empty-2");
    expect(list(phone).title).toBe("Tune");
  });

  it("re-reads on every tick and emits one snapshot per change, none while it holds", () => {
    let name: string | undefined;
    const phone = phoneWith({
      label: (child) => (child.slug.value === "empty" ? name : undefined),
    });
    phone.navigate("menu/composer");
    const seen = snapshots(phone);
    phone.tick(2000);
    expect(seen).toHaveLength(0);
    name = "Saved";
    phone.tick(3000);
    phone.tick(4000);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.screen).toMatchObject({ kind: "list", items: ["Saved", "(empty)", "(empty)"] });
  });

  it("re-reads a child level's title on every tick", () => {
    let name = "Tune";
    const phone = phoneWith({
      label: (child) => (child.slug.value === "empty-2" ? name : undefined),
    });
    phone.navigate("menu/composer/empty-2");
    const seen = snapshots(phone);
    name = "Other tune";
    phone.tick(2000);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.screen).toMatchObject({ kind: "list", title: "Other tune" });
  });

  it("throws on an empty label, as entry labels do", () => {
    const phone = phoneWith({ label: () => "" });
    expect(() => phone.navigate("menu/composer")).toThrow(/label/);
  });

  it("contains a reader's exception: the child keeps its own label", () => {
    const phone = phoneWith({
      label: (child) => {
        if (child.slug.value === "empty-3") throw new Error("broken store");
        return undefined;
      },
    });
    phone.navigate("menu/composer");
    expect(list(phone).items).toEqual(["(empty)", "(empty)", "(empty)"]);
  });

  it("produces the same models as no reader when it returns undefined", () => {
    const plain = phoneWith({});
    const reading = phoneWith({ label: () => undefined });
    for (const path of ["menu/composer", "menu/composer/empty-2", "menu/composer/empty-3"]) {
      plain.navigate(path);
      reading.navigate(path);
      expect(reading.screen).toEqual(plain.screen);
    }
  });

  it("rejects a reader that is not a function, and exposes labelOf on the entry", () => {
    expect(() => composer({ label: "Tune" as never })).toThrow(/label/);
    const entry = composer({ label });
    const [first, second] = entry.children.entries;
    expect(entry.labelOf(first!)).toBe("(empty)");
    expect(entry.labelOf(second!)).toBe("Tune");
  });
});
