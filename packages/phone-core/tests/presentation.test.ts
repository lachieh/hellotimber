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
import type { MenuEntry, MenuPresentation, Phone, PhoneSnapshot } from "../src/index";

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);

const children = (): MenuLevel =>
  new MenuLevel([
    new ReaderEntry(slug("volume"), order(1), "Ringing\nvolume", "x"),
    new ReaderEntry(slug("composer"), order(2), "Composer", "x"),
    new ReaderEntry(slug("alert"), order(3), "Message\nalert tone", "x"),
  ]);

function phoneWith(
  presentation: MenuPresentation | undefined,
  detail?: (child: MenuEntry) => string | undefined,
  clock?: () => string | undefined,
): Phone {
  const options = {
    ...(presentation === undefined ? {} : { presentation }),
    ...(detail === undefined ? {} : { detail }),
  };
  const menu = new PhoneMenu([
    new TopLevelEntry(
      new SubmenuEntry(slug("tones"), order(1), "Tones", children(), undefined, options),
      new MenuGraphic("tones"),
    ),
  ]);
  const phone = createPhone({ menu, bootMs: 0, ...(clock === undefined ? {} : { clock }) });
  phone.tick(0);
  phone.pressKey("power", 1000);
  return phone;
}

function snapshots(phone: Phone): PhoneSnapshot[] {
  const seen: PhoneSnapshot[] = [];
  phone.subscribe((snap) => seen.push(snap));
  return seen;
}

describe("submenu presentation", () => {
  it("defaults to rows and emits no presentation field for rows", () => {
    const entry = new SubmenuEntry(slug("tones"), order(1), "Tones", children());
    expect(entry.presentation).toBe("rows");
    const phone = phoneWith(undefined);
    phone.navigate("menu/tones");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Tones",
      items: ["Ringing\nvolume", "Composer", "Message\nalert tone"],
      selected: 0,
      softkey: "Select",
      menuIndicator: { segments: [1], awaitingNext: false },
    });
    const explicit = phoneWith("rows");
    explicit.navigate("menu/tones");
    expect(explicit.screen).not.toHaveProperty("presentation");
  });

  it("emits presentation: pages only for page submenus", () => {
    const phone = phoneWith("pages");
    phone.navigate("menu/tones");
    expect(phone.screen).toMatchObject({ kind: "list", presentation: "pages", selected: 0 });
  });

  it("rejects an unknown presentation and a non-function detail reader", () => {
    expect(
      () =>
        new SubmenuEntry(slug("tones"), order(1), "Tones", children(), undefined, {
          presentation: "grid" as never,
        }),
    ).toThrow(/presentation/);
    expect(
      () =>
        new SubmenuEntry(slug("tones"), order(1), "Tones", children(), undefined, {
          detail: "Off" as never,
        }),
    ).toThrow(/detail/);
  });
});

describe("submenu details", () => {
  const values: Record<string, string> = { volume: "Level 1", alert: "No tone" };
  const detail = (child: MenuEntry): string | undefined => values[child.slug.value];

  it("emits the selected child's value, and none for a child without one", () => {
    const phone = phoneWith("pages", detail);
    phone.navigate("menu/tones");
    expect(phone.screen).toMatchObject({ selected: 0, detail: "Level 1" });
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ selected: 1 });
    expect(phone.screen).not.toHaveProperty("detail");
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ selected: 2, detail: "No tone" });
  });

  it("emits an empty-string value, since the reader returned a string", () => {
    const phone = phoneWith("pages", () => "");
    phone.navigate("menu/tones");
    expect(phone.screen).toMatchObject({ detail: "" });
  });
});

describe("tick refresh of host strings", () => {
  it("emits exactly one snapshot when the standby clock changes, none while it holds", () => {
    let time = "10:10";
    const phone = phoneWith(undefined, undefined, () => time);
    const seen = snapshots(phone);
    phone.tick(2000);
    phone.tick(3000);
    expect(seen).toHaveLength(0);
    time = "10:11";
    phone.tick(4000);
    phone.tick(5000);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.screen).toMatchObject({ kind: "standby", clock: "10:11" });
  });

  it("emits exactly one snapshot when the visible detail changes, none while it holds", () => {
    let volume = "Level 1";
    const phone = phoneWith("pages", (child) =>
      child.slug.value === "volume" ? volume : undefined,
    );
    phone.navigate("menu/tones");
    const seen = snapshots(phone);
    phone.tick(2000);
    expect(seen).toHaveLength(0);
    volume = "Level 2";
    phone.tick(3000);
    phone.tick(4000);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.screen).toMatchObject({ kind: "list", detail: "Level 2" });
  });

  it("ignores a changing clock while it is not on screen", () => {
    let time = "10:10";
    const phone = phoneWith("pages", undefined, () => time);
    phone.navigate("menu/tones");
    const seen = snapshots(phone);
    time = "10:11";
    phone.tick(2000);
    expect(seen).toHaveLength(0);
  });
});
