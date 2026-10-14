import { describe, expect, it } from "vite-plus/test";
import {
  ActionEntry,
  ApplicationEntry,
  DynamicMenuListSource,
  ListEntry,
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneApplication,
  PhoneMenu,
  ReaderEntry,
  StaticMenuListSource,
  SubmenuEntry,
  TopLevelEntry,
} from "../src/index";
import type {
  ApplicationContext,
  MenuEntry,
  MenuEntryVisitor,
  PhoneApplicationSession,
} from "../src/index";

class TestApplication extends PhoneApplication {
  createSession(_context: ApplicationContext): PhoneApplicationSession {
    return {
      onKey() {},
      tick() {},
      render: () => ({ kind: "off" }),
    };
  }
}

function slug(value: string): MenuSlug {
  return new MenuSlug(value);
}

function order(value: number): MenuOrder {
  return new MenuOrder(value);
}

function reader(
  value: string,
  position: number,
  metadata?: { panel: string },
): ReaderEntry<{
  panel: string;
}> {
  return new ReaderEntry(slug(value), order(position), value, `${value} body`, metadata);
}

describe("menu value objects", () => {
  it("accepts valid immutable slugs, orders, and graphics", () => {
    const menuSlug = slug("phone-book-2");
    const menuOrder = order(1);
    const graphic = new MenuGraphic("phone-book");

    expect(menuSlug.value).toBe("phone-book-2");
    expect(menuSlug.toString()).toBe("phone-book-2");
    expect(menuOrder.value).toBe(1);
    expect(graphic.id).toBe("phone-book");
    expect([menuSlug, menuOrder, graphic].every(Object.isFrozen)).toBe(true);
  });

  it.each(["", " ", "Phone-book", "phone_book", "-phone", "phone-", "phone--book"])(
    "rejects invalid slug %j",
    (value) => expect(() => slug(value)).toThrow(/slug.*kebab-case/i),
  );

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid order %s", (value) =>
    expect(() => order(value)).toThrow(/order.*positive integer/i),
  );

  it.each(["", "   "])("rejects empty graphic id %j", (value) => {
    expect(() => new MenuGraphic(value)).toThrow(/graphic.*non-empty/i);
  });
});

describe("menu entries and visitors", () => {
  const app = new TestApplication("editor");
  const source = new StaticMenuListSource([{ id: "one", label: "One", body: "First" }]);
  const children = new MenuLevel([reader("child", 1)]);
  const entries: MenuEntry[] = [
    new SubmenuEntry(slug("submenu"), order(1), "Submenu", children),
    new ListEntry(slug("list"), order(2), "List", source),
    new ReaderEntry(slug("reader"), order(3), "Reader", "Body"),
    new ActionEntry(slug("action"), order(4), "Action", {
      kind: "href",
      value: "https://example.com",
    }),
    new ApplicationEntry(slug("application"), order(5), "Application", app),
  ];

  it("dispatches every concrete entry to its exhaustive visitor method", () => {
    const visitor: MenuEntryVisitor<unknown, string> = {
      visitSubmenu: () => "submenu",
      visitList: () => "list",
      visitReader: () => "reader",
      visitAction: () => "action",
      visitApplication: () => "application",
    };

    expect(entries.map((entry) => entry.accept(visitor))).toEqual([
      "submenu",
      "list",
      "reader",
      "action",
      "application",
    ]);
  });

  it("retains concrete payloads and freezes only owned entry data", () => {
    const metadata = { panel: "reader" };
    const action = { kind: "href" as const, value: "https://example.com" };
    const readerEntry = new ReaderEntry(slug("reader"), order(1), "Reader", "Body", metadata);
    const actionEntry = new ActionEntry(slug("action"), order(2), "Action", action);
    action.value = "https://changed.example.com";

    expect(readerEntry.body).toBe("Body");
    expect(readerEntry.metadata).toBe(metadata);
    expect(Object.isFrozen(metadata)).toBe(false);
    expect(Object.isFrozen(app)).toBe(false);
    expect(actionEntry.action).toEqual({ kind: "href", value: "https://example.com" });
    expect(Object.isFrozen(actionEntry.action)).toBe(true);
    expect(entries.every(Object.isFrozen)).toBe(true);
  });

  it("rejects empty labels and missing application definitions", () => {
    expect(() => new ReaderEntry(slug("reader"), order(1), " ", "Body")).toThrow(
      /label.*non-empty/i,
    );
    expect(
      () =>
        new ApplicationEntry(
          slug("application"),
          order(1),
          "Application",
          undefined as unknown as PhoneApplication,
        ),
    ).toThrow(/application.*definition/i);
  });
});

describe("MenuLevel", () => {
  it("defensively copies, sorts canonically, indexes, and iterates entries", () => {
    const first = reader("first", 1);
    const second = reader("second", 2);
    const input = [second, first];
    const level = new MenuLevel(input);
    input.length = 0;

    expect(level.entries).toEqual([first, second]);
    expect([...level]).toEqual([first, second]);
    expect(level.bySlug("second")).toBe(second);
    expect(level.bySlug("missing")).toBeUndefined();
    expect(level.byOrder(1)).toBe(first);
    expect(level.byOrder(3)).toBeUndefined();
    expect(Object.isFrozen(level.entries)).toBe(true);
    expect(Object.isFrozen(level)).toBe(true);
  });

  it("rejects duplicate slugs, duplicate orders, and non-contiguous orders", () => {
    expect(() => new MenuLevel([reader("same", 1), reader("same", 2)])).toThrow(
      /duplicate.*slug.*same/i,
    );
    expect(() => new MenuLevel([reader("first", 1), reader("second", 1)])).toThrow(
      /duplicate.*order.*1/i,
    );
    expect(() => new MenuLevel([reader("first", 1), reader("third", 3)])).toThrow(
      /contiguous.*expected 2/i,
    );
    expect(() => new MenuLevel([reader("second", 2)])).toThrow(/contiguous.*expected 1/i);
  });
});

describe("PhoneMenu", () => {
  function fixture(): {
    menu: PhoneMenu<{ panel: string }>;
    about: ReaderEntry<{ panel: string }>;
    work: SubmenuEntry<{ panel: string }>;
  } {
    const project = reader("project", 1, { panel: "project" });
    const work = new SubmenuEntry(slug("work"), order(2), "Work", new MenuLevel([project]), {
      panel: "work",
    });
    const about = reader("about", 1, { panel: "about" });
    const input = [
      new TopLevelEntry(work, new MenuGraphic("work")),
      new TopLevelEntry(about, new MenuGraphic("about")),
    ];
    const menu = new PhoneMenu(input);
    input.reverse();
    return { menu, about, work };
  }

  it("defensively copies top-level slots into canonical order", () => {
    const { menu, about, work } = fixture();

    expect(menu.entries.map(({ entry }) => entry)).toEqual([about, work]);
    expect(menu.entries.map(({ graphic }) => graphic.id)).toEqual(["about", "work"]);
    expect(Object.isFrozen(menu.entries)).toBe(true);
    expect(Object.isFrozen(menu)).toBe(true);
  });

  it("resolves menu paths and reports all paths in canonical pre-order", () => {
    const { menu, work } = fixture();

    expect(menu.resolve("menu")).toEqual([]);
    expect(menu.resolve("/menu/work/project/")).toEqual([work, work.children.bySlug("project")]);
    expect(menu.resolve("standby")).toBeNull();
    expect(menu.resolve("menu/about/child")).toBeNull();
    expect(menu.resolve("menu/missing")).toBeNull();
    expect(menu.paths()).toEqual(["menu", "menu/about", "menu/work", "menu/work/project"]);
    expect(menu.isValidPath("standby")).toBe(true);
    expect(menu.isValidPath("/menu/work/project/")).toBe(true);
    expect(menu.isValidPath("garbage")).toBe(false);
  });

  it("walks each semantic entry exactly once in canonical pre-order", () => {
    const { menu } = fixture();
    const visitor: MenuEntryVisitor<{ panel: string }, string> = {
      visitSubmenu: (entry) => `submenu:${entry.slug.value}`,
      visitList: (entry) => `list:${entry.slug.value}`,
      visitReader: (entry) => `reader:${entry.slug.value}`,
      visitAction: (entry) => `action:${entry.slug.value}`,
      visitApplication: (entry) => `application:${entry.slug.value}`,
    };

    expect(menu.walk(visitor)).toEqual(["reader:about", "submenu:work", "reader:project"]);
  });

  it("rejects missing top-level graphics and invalid top-level sibling order", () => {
    const first = reader("first", 1);
    expect(() => new TopLevelEntry(first, undefined as unknown as MenuGraphic)).toThrow(
      /top-level.*graphic/i,
    );
    expect(
      () =>
        new PhoneMenu([
          new TopLevelEntry(reader("first", 1), new MenuGraphic("first")),
          new TopLevelEntry(reader("third", 3), new MenuGraphic("third")),
        ]),
    ).toThrow(/contiguous.*expected 2/i);
  });

  it("rejects an entry object reused in separate branches", () => {
    const shared = reader("shared", 1);
    const first = new SubmenuEntry(slug("first"), order(1), "First", new MenuLevel([shared]));
    const second = new SubmenuEntry(slug("second"), order(2), "Second", new MenuLevel([shared]));

    expect(
      () =>
        new PhoneMenu([
          new TopLevelEntry(first, new MenuGraphic("first")),
          new TopLevelEntry(second, new MenuGraphic("second")),
        ]),
    ).toThrow(/entry.*shared.*reused/i);
  });

  it("rejects cycles in a malformed object graph", () => {
    const cyclic = Object.create(SubmenuEntry.prototype) as SubmenuEntry;
    const level = Object.create(MenuLevel.prototype) as MenuLevel;
    Object.defineProperties(cyclic, {
      slug: { value: slug("cycle") },
      order: { value: order(1) },
      label: { value: "Cycle" },
      metadata: { value: undefined },
      children: { value: level },
    });
    Object.defineProperty(level, "entries", { value: Object.freeze([cyclic]) });

    expect(() => new PhoneMenu([new TopLevelEntry(cyclic, new MenuGraphic("cycle"))])).toThrow(
      /cycle.*cycle/i,
    );
  });
});

describe("menu list sources", () => {
  it("static sources retain a defensive immutable snapshot", () => {
    const item = { id: "one", label: "One", body: "First" };
    const input = [item];
    const source = new StaticMenuListSource(input);
    input.push({ id: "two", label: "Two", body: "Second" });
    item.label = "Changed";

    const snapshot = source.read();
    expect(snapshot).toEqual([{ id: "one", label: "One", body: "First" }]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot[0])).toBe(true);
    expect(source.read()).toBe(snapshot);
  });

  it("dynamic sources validate and copy every read independently", () => {
    const backing = [{ id: "one", label: "One", body: "First" }];
    let reads = 0;
    const source = new DynamicMenuListSource(() => {
      reads += 1;
      return backing;
    });

    const first = source.read();
    backing[0]!.label = "Changed";
    backing.push({ id: "two", label: "Two", body: "Second" });
    const second = source.read();

    expect(reads).toBe(2);
    expect(first).toEqual([{ id: "one", label: "One", body: "First" }]);
    expect(second).toEqual([
      { id: "one", label: "Changed", body: "First" },
      { id: "two", label: "Two", body: "Second" },
    ]);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(second)).toBe(true);
  });

  it.each([
    [[{ id: "", label: "Empty", body: "" }], /item id.*non-empty/i],
    [[{ id: " ", label: "Blank", body: "" }], /item id.*non-empty/i],
    [
      [
        { id: "same", label: "First", body: "" },
        { id: "same", label: "Second", body: "" },
      ],
      /duplicate.*item id.*same/i,
    ],
  ])("rejects invalid static snapshots", (items, message) => {
    expect(() => new StaticMenuListSource(items)).toThrow(message);
  });

  it("rejects an invalid later dynamic snapshot", () => {
    let valid = true;
    const source = new DynamicMenuListSource(() =>
      valid
        ? [{ id: "one", label: "One", body: "" }]
        : [
            { id: "one", label: "One", body: "" },
            { id: "one", label: "Duplicate", body: "" },
          ],
    );
    expect(source.read()).toHaveLength(1);
    valid = false;
    expect(() => source.read()).toThrow(/duplicate.*item id.*one/i);
  });
});
