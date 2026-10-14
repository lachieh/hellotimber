// Plan 17 D8 (for plan 21): SubmenuOptions.label, the text a child shows from a host reader.
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
import type { MenuEntry, Phone, PhoneSnapshot } from "../src/index";

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);

function profilesPhone(label?: (child: MenuEntry) => string | undefined): Phone {
  const general = new SubmenuEntry(
    slug("general"),
    order(1),
    "General",
    new MenuLevel([new ReaderEntry(slug("activate"), order(1), "Activate", "On.")]),
  );
  const silent = new ReaderEntry(slug("silent"), order(2), "Silent", "Shh.");
  const profiles = new SubmenuEntry(
    slug("profiles"),
    order(1),
    "Profiles",
    new MenuLevel([general, silent]),
    undefined,
    label === undefined ? {} : { label },
  );
  const phone = createPhone({
    menu: new PhoneMenu([new TopLevelEntry(profiles, new MenuGraphic("profiles"))]),
    bootMs: 0,
  });
  phone.tick(0);
  phone.pressKey("power", 1000);
  return phone;
}

describe("submenu label reader", () => {
  it("labels the level's list items and each child's own title", () => {
    const names: Record<string, string> = { general: "Work", silent: "Silenth" };
    const phone = profilesPhone((child) => names[child.slug.value]);
    phone.navigate("menu/profiles");
    expect(phone.screen).toMatchObject({ title: "Profiles", items: ["Work", "Silenth"] });
    phone.navigate("menu/profiles/general");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Work", items: ["Activate"] });
    phone.navigate("menu/profiles/silent");
    expect(phone.screen).toMatchObject({ kind: "reader", title: "Silenth" });
  });

  it("keeps paths and slugs", () => {
    const phone = profilesPhone(() => "Renamed");
    phone.navigate("menu/profiles");
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/profiles/general");
  });

  it("uses the child's label for undefined, and when the reader throws", () => {
    const phone = profilesPhone((child) => {
      if (child.slug.value === "silent") throw new Error("broken host");
      return undefined;
    });
    phone.navigate("menu/profiles");
    expect(phone.screen).toMatchObject({ items: ["General", "Silent"] });
    phone.navigate("menu/profiles/silent");
    expect(phone.screen).toMatchObject({ title: "Silent" });
  });

  it("throws for an empty label, as entry labels do", () => {
    const phone = profilesPhone((child) => (child.slug.value === "silent" ? " " : undefined));
    expect(() => {
      phone.navigate("menu/profiles");
      return phone.screen;
    }).toThrow(/label/);
  });

  it("rejects a reader that is not a function", () => {
    expect(
      () =>
        new SubmenuEntry(slug("x"), order(1), "X", new MenuLevel([]), undefined, {
          label: "Work" as unknown as () => string,
        }),
    ).toThrow(/label must be a function/);
  });

  it("is re-read on every tick: a change emits one snapshot, none otherwise", () => {
    let name = "Work";
    const phone = profilesPhone((child) => (child.slug.value === "general" ? name : undefined));
    phone.navigate("menu/profiles");
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    phone.tick(1100);
    expect(snaps).toHaveLength(0);
    name = "Meeting";
    phone.tick(1200);
    phone.tick(1300);
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.screen).toMatchObject({ items: ["Meeting", "Silent"] });
    phone.navigate("menu/profiles/general");
    const titled = snaps.length;
    name = "Outdoor";
    phone.tick(1400);
    expect(snaps).toHaveLength(titled + 1);
    expect(snaps.at(-1)!.screen).toMatchObject({ title: "Outdoor" });
  });
});
