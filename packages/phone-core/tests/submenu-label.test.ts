// Plan 17 Task 4: SubmenuOptions.label, the text a child shows in its level's list and as its own
// level's title, re-read on every tick (stored profile names; plan 27 Task 6: Composer slot names).
import { describe, expect, it } from "vite-plus/test";
import {
  ApplicationEntry,
  createPhone,
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneApplication,
  PhoneMenu,
  ReaderEntry,
  SubmenuEntry,
  TopLevelEntry,
} from "../src/index";
import type {
  ApplicationContext,
  MenuEntry,
  Phone,
  PhoneApplicationSession,
  PhoneSnapshot,
  ScreenModel,
  SubmenuOptions,
} from "../src/index";
import { bootedPhone } from "./fixtures";

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);

class BrokenApplication extends PhoneApplication {
  createSession(_context: ApplicationContext): PhoneApplicationSession {
    throw new Error("broken");
  }
}

/** Profiles: two profile levels (each with an Activate reader) and a broken application. */
function profilesMenu(options: SubmenuOptions): { menu: PhoneMenu; profiles: SubmenuEntry } {
  const profile = (name: string, n: number) =>
    new SubmenuEntry(
      slug(name),
      order(n),
      name === "general" ? "General" : "Silent",
      new MenuLevel([new ReaderEntry(slug("activate"), order(1), "Activate", "Body")]),
    );
  const profiles = new SubmenuEntry(
    slug("profiles"),
    order(1),
    "Profiles",
    new MenuLevel([
      profile("general", 1),
      profile("silent", 2),
      new ApplicationEntry(slug("broken"), order(3), "Broken", new BrokenApplication("broken")),
    ]),
    undefined,
    options,
  );
  const menu = new PhoneMenu([
    new TopLevelEntry(profiles, new MenuGraphic("profiles")),
    new TopLevelEntry(
      new ReaderEntry(slug("other"), order(2), "Other", "Body"),
      new MenuGraphic("other"),
    ),
  ]);
  return { menu, profiles };
}

function list(screen: ScreenModel): Extract<ScreenModel, { kind: "list" }> {
  if (screen.kind !== "list") throw new Error(`Expected a list, received ${screen.kind}.`);
  return screen;
}

describe("SubmenuOptions.label", () => {
  it("leaves labels unchanged without a reader", () => {
    const phone = bootedPhone({ menu: profilesMenu({}).menu });
    phone.navigate("menu/profiles");
    expect(list(phone.screen).items).toEqual(["General", "Silent", "Broken"]);
  });

  it("labels the children in the list and the child level's title", () => {
    let name = "Silenth";
    const label = (child: MenuEntry) => (child.slug.value === "silent" ? name : undefined);
    const phone = bootedPhone({ menu: profilesMenu({ label }).menu });
    phone.navigate("menu/profiles");
    expect(list(phone.screen).items).toEqual(["General", "Silenth", "Broken"]);
    phone.navigate("menu/profiles/silent");
    expect(list(phone.screen).title).toBe("Silenth");
    expect(phone.path).toBe("menu/profiles/silent");
    name = "Zz";
    phone.tick(100);
    expect(list(phone.screen).title).toBe("Zz");
  });

  it("is re-read on every tick: one snapshot per change, none while it holds", () => {
    let name = "Silent";
    const phone = bootedPhone({
      menu: profilesMenu({ label: (child) => (child.slug.value === "silent" ? name : undefined) })
        .menu,
    });
    phone.navigate("menu/profiles");
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    phone.tick(100);
    expect(snaps).toHaveLength(0);
    name = "Ab";
    phone.tick(200);
    phone.tick(300);
    expect(snaps).toHaveLength(1);
    expect(list(snaps[0]!.screen).items[1]).toBe("Ab");
  });

  it("names an application's App error reader", () => {
    const phone = bootedPhone({
      menu: profilesMenu({
        label: (child) => (child.slug.value === "broken" ? "Mended" : undefined),
      }).menu,
    });
    phone.navigate("menu/profiles/broken");
    expect(phone.screen).toMatchObject({ kind: "reader", title: "Mended", lines: ["App error"] });
  });

  it("throws for an empty label from the entry, and the kernel shows the child's own", () => {
    const { menu, profiles } = profilesMenu({ label: () => " " });
    const silent = profiles.children.entries[1]!;
    expect(() => profiles.labelOf(silent)).toThrow(/label/);
    const phone = bootedPhone({ menu });
    phone.navigate("menu/profiles");
    expect(list(phone.screen).items).toEqual(["General", "Silent", "Broken"]);
  });

  it("contains a reader's exception: the child's own label is shown", () => {
    const phone = bootedPhone({
      menu: profilesMenu({
        label: () => {
          throw new Error("broken reader");
        },
      }).menu,
    });
    phone.navigate("menu/profiles/silent");
    expect(list(phone.screen).title).toBe("Silent");
  });

  it("rejects a non-function reader", () => {
    expect(() => profilesMenu({ label: "Silent" as never })).toThrow(/label/);
  });
});

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

function shownList(phone: Phone): Extract<ScreenModel, { kind: "list" }> {
  const screen = phone.screen;
  if (screen.kind !== "list") throw new Error(`Expected a list, received ${screen.kind}.`);
  return screen;
}

function snapshots(phone: Phone): PhoneSnapshot[] {
  const seen: PhoneSnapshot[] = [];
  phone.subscribe((snap) => seen.push(snap));
  return seen;
}

describe("SubmenuOptions.label: Composer slots", () => {
  const names: Record<string, string> = { "empty-2": "Tune", "empty-3": "Song" };
  const label = (child: MenuEntry): string | undefined => names[child.slug.value];

  it("relabels the children in the level's list; undefined keeps the child's label", () => {
    const phone = phoneWith({ label });
    phone.navigate("menu/composer");
    expect(shownList(phone).items).toEqual(["(empty)", "Tune", "Song"]);
  });

  it("titles a child's own level (a submenu and a reader) with its read label", () => {
    const phone = phoneWith({ label });
    phone.navigate("menu/composer/empty-2");
    expect(shownList(phone)).toMatchObject({ title: "Tune", items: ["Inner"] });
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
    expect(shownList(phone).title).toBe("Tune");
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

  it("contains a reader's exception: the child keeps its own label", () => {
    const phone = phoneWith({
      label: (child) => {
        if (child.slug.value === "empty-3") throw new Error("broken store");
        return undefined;
      },
    });
    phone.navigate("menu/composer");
    expect(shownList(phone).items).toEqual(["(empty)", "(empty)", "(empty)"]);
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
