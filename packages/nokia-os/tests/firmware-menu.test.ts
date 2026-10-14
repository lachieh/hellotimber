import {
  ApplicationEntry,
  createPhone,
  PhoneApplication,
  SubmenuEntry,
  type MenuEntry,
  type Phone,
} from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { LEVEL1 } from "../scripts/text-runs.ts";
import { paintDottedBorder } from "../src/display/unsupported";
import { placeholderOwner } from "../src/firmware/bindings";
import { STOCK_TREE, type StockTreeNode } from "../src/firmware/generated/stock-tree";
import { createStockMenu } from "../src/firmware/menu";
import { PlaceholderApplication } from "../src/firmware/placeholder";
import { createMemorySettings, virginSettings } from "../src/firmware/settings";
import { stockMenu } from "../src/index";
import { STOCK_FONTS } from "../src/resources";
import { StockFlowApplication } from "../src/widgets/flow";

const SLUGS = [
  "phone-book",
  "messages",
  "chat",
  "call-register",
  "tones",
  "settings",
  "call-divert",
  "games",
  "calculator",
  "reminders",
  "clock",
  "profiles",
];

function submenu(entry: MenuEntry): SubmenuEntry {
  if (!(entry instanceof SubmenuEntry)) throw new Error(`${entry.slug.value} is not a submenu`);
  return entry;
}

describe("stockMenu", () => {
  it("has the 12 v6.39 entries in order, each with its animated stock graphic", () => {
    expect(stockMenu.entries.map((slot) => slot.entry.slug.value)).toEqual(SLUGS);
    expect(stockMenu.entries.map((slot) => slot.entry.order.value)).toEqual(
      SLUGS.map((_, i) => i + 1),
    );
    for (const slot of stockMenu.entries) {
      expect(slot.graphic.id).toBe(slot.entry.slug.value);
      expect(slot.graphic.timeline, slot.graphic.id).toBeDefined();
    }
    expect(stockMenu.entries[10]!.graphic.timelineFor("return")).not.toBe(
      stockMenu.entries[10]!.graphic.timeline,
    );
  });

  // LEVEL1 is the transcription the fonts were harvested from, checked against every golden.
  LEVEL1.forEach((level, i) => {
    const entry = stockMenu.entries[i]!.entry;

    it(`${level.slug}: title, presentation, labels and menu numbers match the goldens`, () => {
      expect(entry.label).toBe(level.title);
      if (level.labels.length === 0) {
        // Chat and Calculator are top-level applications (placeholders in this plan).
        expect(entry).toBeInstanceOf(ApplicationEntry);
        return;
      }
      const level1 = submenu(entry);
      expect(level1.presentation).toBe(level.presentation);
      const children = level1.children.entries;
      const labels = children.map((child) => child.label);
      if (level.slug === "12-profiles") {
        // The golden omits slot 6, whose uninitialised name is two U+E000 boxes (D10).
        expect(labels).toEqual([...level.labels, "\uE000\uE000"]);
      } else {
        expect(labels).toEqual(level.labels);
      }
      expect(children.slice(0, level.labels.length).map((child) => child.order.value)).toEqual(
        level.numbers ?? level.labels.map((_, j) => j + 1),
      );
    });

    if (level.presentation === "pages") {
      it(`${level.slug}: page values match the goldens (clock 10:10, date 13.10.2026 as inputs)`, () => {
        const level1 = submenu(
          createStockMenu({ clock: () => "10:10", date: () => "13.10.2026" }).entries[i]!.entry,
        );
        expect(level1.children.entries.map((child) => level1.detailOf(child))).toEqual(
          level.labels.map((_, j) => level.values?.[j + 1]),
        );
      });
    }
  });

  it("holds every node of the generated tree in order, with hidden numbers kept", () => {
    const visit = (nodes: readonly StockTreeNode[], entries: readonly MenuEntry[]): void => {
      expect(entries.map((e) => e.slug.value)).toEqual(nodes.map((n) => n.slug));
      nodes.forEach((node, i) => {
        const entry = entries[i]!;
        expect(entry.label, node.number).toBe(node.label);
        expect(entry.order.value, node.number).toBe(Number(node.number.split("-").at(-1)));
        const spec = node.opens;
        if (spec.kind === "submenu") {
          const level = submenu(entry);
          expect(level.presentation, node.number).toBe(spec.presentation);
          expect(level.softkey, node.number).toBe(spec.softkey);
          expect(level.intro !== undefined, node.number).toBe(spec.intro === true);
          visit(node.children ?? [], level.children.entries);
        } else {
          expect(entry, node.number).toBeInstanceOf(ApplicationEntry);
        }
      });
    };
    visit(
      STOCK_TREE,
      stockMenu.entries.map((slot) => slot.entry),
    );
  });

  it("opens every leaf as a stock flow, the placeholder of its owner plan, or an exit", () => {
    const kinds = new Map<string, string>();
    const visit = (nodes: readonly StockTreeNode[], entries: readonly MenuEntry[]): void => {
      nodes.forEach((node, i) => {
        const entry = entries[i]!;
        if (entry instanceof SubmenuEntry) {
          visit(node.children ?? [], entry.children.entries);
          return;
        }
        const application = (entry as ApplicationEntry).application;
        const owner = placeholderOwner(node.number);
        if (application instanceof PlaceholderApplication) {
          expect(application.ownerPlan, node.number).toBe(owner);
          expect(application.ownerPlan).toMatch(/^\d+$/);
          kinds.set(node.number, "placeholder");
        } else {
          expect(owner, `${node.number} is owned by plan ${owner}`).toBeUndefined();
          expect(application, node.number).toBeInstanceOf(
            node.opens.kind === "returns-immediately" ? PhoneApplication : StockFlowApplication,
          );
          kinds.set(node.number, "stock");
        }
      });
    };
    visit(
      STOCK_TREE,
      stockMenu.entries.map((slot) => slot.entry),
    );
    // The "Leaf ownership" table: Chat, Calculator, Composer, New game, Activate, Stopwatch, ...
    for (const number of ["3", "9", "2-1", "5-4-3", "8-1-1", "8-4-2-1", "11-4", "12-5-1"]) {
      expect(kinds.get(number), number).toBe("placeholder");
    }
    for (const number of ["1-1", "1-2", "1-8-1", "4-5", "8-1-2", "8-1-6", "10-2", "8-6-4"]) {
      expect(kinds.get(number), number).toBe("stock");
    }
  });

  it("has unique kebab-case paths, reusing the website's slugs where labels match", () => {
    const paths = stockMenu.paths();
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path).toMatch(/^menu(\/[a-z0-9]+(-[a-z0-9]+)*)*$/);
    let nodes = 0;
    const count = (level: readonly StockTreeNode[]): void =>
      level.forEach((node) => {
        nodes++;
        count(node.children ?? []);
      });
    count(STOCK_TREE);
    expect(paths.length).toBe(1 + nodes);
    for (const path of [
      "menu/phone-book/search",
      "menu/phone-book/send-bcard",
      "menu/messages/write",
      "menu/call-register/dialled-numbers",
      "menu/call-divert/cancel-all-diverts",
      "menu/games/snake",
      "menu/games/snake/top-score",
      "menu/profiles/empty",
      "menu/profiles/empty-2",
      "menu/profiles/empty-2/personalise/screen-saver/timeout",
    ])
      expect(paths).toContain(path);
  });

  it("shows choices from the settings store on its pages (Tones share the General profile's)", () => {
    const settings = createMemorySettings(virginSettings());
    const tones = submenu(createStockMenu({}, settings).entries[4]!.entry);
    const volume = tones.children.entries[1]!;
    expect(tones.detailOf(volume)).toBe("Level 1");
    settings.choose("profiles/general/personalise/ringing-volume", 2);
    expect(tones.detailOf(volume)).toBe("Level 3");
    // A fresh menu has its own store.
    const fresh = submenu(createStockMenu().entries[4]!.entry);
    expect(fresh.detailOf(fresh.children.entries[1]!)).toBe("Level 1");
  });

  it("returns no page value without host ports for the Clock and Date pages", () => {
    const clock = submenu(stockMenu.entries[10]!.entry);
    expect(clock.children.entries.map((child) => clock.detailOf(child))).toEqual([
      "Off",
      undefined,
      undefined,
      undefined,
      "Off",
      "Off",
    ]);
  });
});

describe("PlaceholderApplication", () => {
  function atLeaf(path: string): Phone {
    const phone = createPhone({ menu: stockMenu, bootMs: 0 });
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.navigate(path);
    return phone;
  }

  it("renders a dotted border and the entry label, one centred line per line break", () => {
    const phone = atLeaf("menu/messages/picture-messages");
    const screen = phone.screen;
    if (screen.kind !== "custom") throw new Error(`expected custom, got ${screen.kind}`);
    expect(screen.appId).toBe("placeholder:messages/picture-messages");
    const expected = new Framebuffer();
    paintDottedBorder(expected);
    expected.drawTextCentered(STOCK_FONTS.small, "Picture", 15);
    expected.drawTextCentered(STOCK_FONTS.small, "messages", 24);
    expect(Array.from(screen.frame.pixels)).toEqual(Array.from(expected.pixels));
  });

  it("swallows every key but C, which returns to the parent with the selection kept", () => {
    const phone = atLeaf("menu/messages/picture-messages");
    const frame = phone.screen;
    for (const key of ["navi", "up", "down", "1", "*", "#"] as const) phone.pressKey(key);
    expect(phone.path).toBe("menu/messages/picture-messages");
    expect(phone.screen).toEqual(frame);
    phone.pressKey("c");
    expect(phone.path).toBe("menu/messages");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 3 });
  });

  it("names the plan that owns it (never drawn)", () => {
    const owners: Record<string, string> = {};
    const walk = (entries: readonly MenuEntry[], prefix: string): void => {
      for (const entry of entries) {
        const path = `${prefix}/${entry.slug.value}`;
        if (entry instanceof SubmenuEntry) walk(entry.children.entries, path);
        else if ((entry as ApplicationEntry).application instanceof PlaceholderApplication) {
          owners[path] = (
            (entry as ApplicationEntry).application as PlaceholderApplication
          ).ownerPlan;
        }
      }
    };
    walk(
      stockMenu.entries.map((slot) => slot.entry),
      "menu",
    );
    expect(owners).toMatchObject({
      "menu/messages/write": "18",
      "menu/chat": "18",
      "menu/tones/composer/empty-4": "16",
      "menu/settings/phone-settings/welcome-note": "15",
      "menu/games/snake/new-game": "23",
      "menu/games/bantumi/new-game": "24",
      "menu/calculator": "20",
      "menu/clock/stopwatch": "21",
      "menu/profiles/loud/activate": "17",
    });
  });

  it("opens for the top-level applications too (Chat, Calculator)", () => {
    const phone = atLeaf("menu/chat");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "placeholder:chat" });
    phone.pressKey("c");
    expect(phone.path).toBe("menu");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", label: "Chat" });
  });
});
