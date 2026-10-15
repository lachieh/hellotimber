// Plan 17 Task 4: SubmenuOptions.label, the text a child shows in its level's list and as its own
// level's title, re-read on every tick (stored profile names).
import { describe, expect, it } from "vite-plus/test";
import {
  ApplicationEntry,
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
