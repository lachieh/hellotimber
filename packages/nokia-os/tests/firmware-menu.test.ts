import {
  ApplicationEntry,
  createPhone,
  SubmenuEntry,
  type MenuEntry,
  type Phone,
} from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { LEVEL1 } from "../scripts/text-runs.ts";
import { paintDottedBorder } from "../src/display/unsupported";
import { createStockMenu } from "../src/firmware/menu";
import { PlaceholderApplication } from "../src/firmware/placeholder";
import { stockMenu } from "../src/index";
import { STOCK_FONTS } from "../src/resources";

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
        // The golden omits slot 6 (uninitialised EEPROM name); the menu keeps it for the rail.
        expect(labels).toEqual([...level.labels, "(empty)"]);
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

  it("has no levels below level 1: every child is a placeholder application", () => {
    for (const slot of stockMenu.entries) {
      const children = slot.entry instanceof SubmenuEntry ? slot.entry.children.entries : [];
      for (const child of children) {
        expect(child, child.slug.value).toBeInstanceOf(ApplicationEntry);
        expect((child as ApplicationEntry).application).toBeInstanceOf(PlaceholderApplication);
      }
    }
  });

  it("has unique kebab-case paths, reusing the website's slugs where labels match", () => {
    const paths = stockMenu.paths();
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path).toMatch(/^menu(\/[a-z0-9]+(-[a-z0-9]+)*)*$/);
    expect(paths.length).toBe(1 + 12 + 10 + 10 + 8 + 9 + 4 + 5 + 5 + 3 + 6 + 6);
    for (const path of [
      "menu/phone-book/search",
      "menu/phone-book/send-bcard",
      "menu/messages/write",
      "menu/call-register/dialled-numbers",
      "menu/call-divert/cancel-all-diverts",
      "menu/games/snake",
      "menu/profiles/empty",
      "menu/profiles/empty-2",
    ])
      expect(paths).toContain(path);
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
    const phone = atLeaf("menu/call-divert/divert-if-not-answered");
    const screen = phone.screen;
    if (screen.kind !== "custom") throw new Error(`expected custom, got ${screen.kind}`);
    expect(screen.appId).toBe("placeholder:call-divert/divert-if-not-answered");
    const expected = new Framebuffer();
    paintDottedBorder(expected);
    expected.drawTextCentered(STOCK_FONTS.small, "Divert if not", 15);
    expected.drawTextCentered(STOCK_FONTS.small, "answered", 24);
    expect(Array.from(screen.frame.pixels)).toEqual(Array.from(expected.pixels));
  });

  it("swallows every key but C, which returns to the parent with the selection kept", () => {
    const phone = atLeaf("menu/call-divert/divert-if-not-answered");
    const frame = phone.screen;
    for (const key of ["navi", "up", "down", "1", "*", "#"] as const) phone.pressKey(key);
    expect(phone.path).toBe("menu/call-divert/divert-if-not-answered");
    expect(phone.screen).toEqual(frame);
    phone.pressKey("c");
    expect(phone.path).toBe("menu/call-divert");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 2 });
  });

  it("opens for the top-level applications too (Chat, Calculator)", () => {
    const phone = atLeaf("menu/chat");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "placeholder:chat" });
    phone.pressKey("c");
    expect(phone.path).toBe("menu");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", label: "Chat" });
  });
});
