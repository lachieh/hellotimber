import {
  ActionEntry,
  ApplicationEntry,
  createPhone,
  ListEntry,
  ReaderEntry,
  SubmenuEntry,
} from "@hellotimber/phone-core";
import type { MenuEntry, PhoneKey } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { siteMenu } from "../src/content/menu";
import type { WebMetadata } from "../src/content/types";

type GoldenKind = "submenu" | "list" | "reader" | "app" | "action";
type GoldenEntry = readonly [path: string, type: GoldenKind, label: string, position: number];

const GOLDEN_ENTRIES: readonly GoldenEntry[] = [
  ["/menu/phone-book", "submenu", "Phone book", 1],
  ["/menu/phone-book/search", "list", "Search", 1],
  ["/menu/phone-book/service-nos", "reader", "Service Nos.", 2],
  ["/menu/phone-book/add-name", "reader", "Add name", 3],
  ["/menu/phone-book/erase", "reader", "Erase", 4],
  ["/menu/phone-book/edit", "reader", "Edit", 5],
  ["/menu/phone-book/assign-tone", "reader", "Assign tone", 6],
  ["/menu/phone-book/send-bcard", "reader", "Send b'card", 7],
  ["/menu/phone-book/options", "reader", "Options", 8],
  ["/menu/phone-book/speed-dials", "reader", "Speed dials", 9],
  ["/menu/phone-book/voice-tags", "reader", "Voice tags", 10],
  ["/menu/messages", "submenu", "Messages", 2],
  ["/menu/messages/write", "app", "Write messages", 1],
  ["/menu/messages/inbox", "list", "Inbox", 2],
  ["/menu/messages/outbox", "list", "Outbox", 3],
  ["/menu/messages/picture-messages", "reader", "Picture messages", 4],
  ["/menu/messages/templates", "reader", "Templates", 5],
  ["/menu/messages/smileys", "reader", "Smileys", 6],
  ["/menu/messages/message-settings", "reader", "Message settings", 7],
  ["/menu/messages/info-service", "reader", "Info service", 8],
  ["/menu/messages/voice-mailbox-number", "reader", "Voice mailbox number", 9],
  ["/menu/messages/service-command-editor", "reader", "Service command editor", 10],
  ["/menu/chat", "app", "Chat", 3],
  ["/menu/call-register", "submenu", "Call register", 4],
  ["/menu/call-register/missed-calls", "list", "Missed calls", 1],
  ["/menu/call-register/received-calls", "list", "Received calls", 2],
  ["/menu/call-register/dialled-numbers", "list", "Dialled numbers", 3],
  ["/menu/call-register/erase-recent-call-lists", "reader", "Erase recent call lists", 4],
  ["/menu/call-register/show-call-duration", "reader", "Show call duration", 5],
  ["/menu/call-register/show-call-costs", "reader", "Show call costs", 6],
  ["/menu/call-register/call-cost-settings", "reader", "Call cost settings", 7],
  ["/menu/call-register/prepaid-credit", "reader", "Prepaid credit", 8],
  ["/menu/tones", "submenu", "Tones", 5],
  ["/menu/tones/ringing-tone", "app", "Ringing tone", 1],
  ["/menu/tones/ringing-volume", "reader", "Ringing volume", 2],
  ["/menu/tones/incoming-call-alert", "reader", "Incoming call alert", 3],
  ["/menu/tones/composer", "reader", "Composer", 4],
  ["/menu/tones/message-alert-tone", "reader", "Message alert tone", 5],
  ["/menu/tones/keypad-tones", "app", "Keypad tones", 6],
  ["/menu/tones/warning-and-game-tones", "reader", "Warning and game tones", 7],
  ["/menu/tones/vibrating-alert", "reader", "Vibrating alert", 8],
  ["/menu/tones/screen-saver", "app", "Screen saver", 9],
  ["/menu/settings", "submenu", "Settings", 6],
  ["/menu/settings/call-settings", "reader", "Call settings", 1],
  ["/menu/settings/phone-settings", "submenu", "Phone settings", 2],
  ["/menu/settings/phone-settings/welcome-note", "app", "Welcome note", 1],
  ["/menu/settings/phone-settings/lights", "app", "Lights", 2],
  ["/menu/settings/security-settings", "reader", "Security settings", 3],
  ["/menu/settings/restore-factory-settings", "reader", "Restore factory settings", 4],
  ["/menu/call-divert", "submenu", "Call divert", 7],
  ["/menu/call-divert/github", "action", "GitHub", 1],
  ["/menu/call-divert/linkedin", "action", "LinkedIn", 2],
  ["/menu/call-divert/x", "action", "X", 3],
  ["/menu/call-divert/cancel-all-diverts", "reader", "Cancel all diverts", 4],
  ["/menu/games", "submenu", "Games", 8],
  ["/menu/games/snake", "app", "Snake II", 1],
  ["/menu/games/space-impact", "reader", "Space Impact", 2],
  ["/menu/games/bantumi", "reader", "Bantumi", 3],
  ["/menu/games/pairs-ii", "reader", "Pairs II", 4],
  ["/menu/calculator", "app", "Calculator", 9],
  ["/menu/reminders", "list", "Reminders", 10],
  ["/menu/clock", "reader", "Clock", 11],
  ["/menu/profiles", "list", "Profiles", 12],
  ["/menu/sim-services", "reader", "SIM services", 13],
];

const GOLDEN_CAROUSEL = [
  ["Phone book", 1, 13, "phone-book"],
  ["Messages", 2, 13, "messages"],
  ["Chat", 3, 13, "chat"],
  ["Call register", 4, 13, "call-register"],
  ["Tones", 5, 13, "tones"],
  ["Settings", 6, 13, "settings"],
  ["Call divert", 7, 13, "call-divert"],
  ["Games", 8, 13, "games"],
  ["Calculator", 9, 13, "calculator"],
  ["Reminders", 10, 13, "reminders"],
  ["Clock", 11, 13, "clock"],
  ["Profiles", 12, 13, "profiles"],
  ["SIM services", 13, 13, "sim-services"],
] as const;

const GOLDEN_INDEXABLE_PATHS = [
  "/menu",
  "/menu/phone-book",
  "/menu/messages",
  "/menu/messages/write",
  "/menu/messages/inbox",
  "/menu/chat",
  "/menu/call-register",
  "/menu/tones",
  "/menu/settings",
  "/menu/call-divert",
  "/menu/games",
  "/menu/games/snake",
  "/menu/calculator",
  "/menu/reminders",
  "/menu/clock",
  "/menu/profiles",
];

function kindOf(entry: MenuEntry<WebMetadata>): GoldenKind {
  if (entry instanceof SubmenuEntry) return "submenu";
  if (entry instanceof ListEntry) return "list";
  if (entry instanceof ReaderEntry) return "reader";
  if (entry instanceof ApplicationEntry) return "app";
  if (entry instanceof ActionEntry) return "action";
  throw new Error(`unknown menu entry: ${entry.slug.value}`);
}

function goldenEntries(): GoldenEntry[] {
  return siteMenu
    .paths()
    .slice(1)
    .map((path) => {
      const entry = siteMenu.resolve(path)?.at(-1);
      if (entry === undefined) throw new Error(`unresolved menu path: ${path}`);
      return [`/${path}`, kindOf(entry), entry.label, entry.order.value];
    });
}

function bootedPhone() {
  const phone = createPhone({ menu: siteMenu, bootMs: 0 });
  phone.tick(0);
  phone.pressKey("power", 1000);
  return phone;
}

describe("current menu golden", () => {
  it("pins every path, entry kind, label, and one-based sibling position", () => {
    expect(goldenEntries()).toEqual(GOLDEN_ENTRIES);
    expect(siteMenu.paths().map((path) => `/${path}`)).toEqual([
      "/menu",
      ...GOLDEN_ENTRIES.map(([path]) => path),
    ]);
  });

  it("pins every carousel number and explicit graphic", () => {
    const phone = bootedPhone();
    phone.pressKey("navi");
    const screens: (readonly [string, number, number, string])[] = [];
    for (let index = 0; index < 13; index += 1) {
      const screen = phone.screen;
      if (screen.kind !== "menu-carousel") throw new Error(`expected carousel, got ${screen.kind}`);
      screens.push([screen.label, screen.menuNumber, screen.total, screen.iconId]);
      phone.pressKey("down");
    }
    expect(screens).toEqual(GOLDEN_CAROUSEL);
  });

  it("pins the complete indexable path set and order from typed metadata", () => {
    const indexable = siteMenu.paths().filter((path) => {
      if (path === "menu") return true;
      return siteMenu.resolve(path)?.at(-1)?.metadata?.indexing === "index";
    });
    expect(indexable.map((path) => `/${path}`)).toEqual(GOLDEN_INDEXABLE_PATHS);
  });

  it("reconstructs every reported path from its resolved parent chain", () => {
    for (const expectedPath of siteMenu.paths()) {
      const chain = siteMenu.resolve(expectedPath);
      expect(chain, expectedPath).not.toBeNull();
      expect(`menu${chain!.map((entry) => `/${entry.slug.value}`).join("")}`).toBe(expectedPath);
    }
  });
});

describe("current deep-link restoration", () => {
  it("restores each parent selection while backing out of a three-level app path", () => {
    const phone = bootedPhone();

    phone.navigate("menu/settings/phone-settings/lights");
    expect(phone.path).toBe("menu/settings/phone-settings/lights");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Lights",
      items: ["On", "Off"],
      selected: 0,
      softkey: "OK",
    });

    phone.pressKey("c");
    expect(phone.path).toBe("menu/settings/phone-settings");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Phone settings",
      items: ["Welcome note", "Lights"],
      selected: 1,
      softkey: "Select",
      menuIndicator: { segments: [6, 2], awaitingNext: false },
    });

    phone.pressKey("c");
    expect(phone.path).toBe("menu/settings");
    expect(phone.screen).toEqual({
      kind: "list",
      title: "Settings",
      items: ["Call settings", "Phone settings", "Security settings", "Restore factory settings"],
      selected: 1,
      softkey: "Select",
      menuIndicator: { segments: [6], awaitingNext: false },
    });

    phone.pressKey("c");
    expect(phone.path).toBe("menu");
    expect(phone.screen).toEqual({
      kind: "menu-carousel",
      label: "Settings",
      menuNumber: 6,
      total: 13,
      iconId: "settings",
      menuIndicator: { segments: [6], awaitingNext: false },
    });
  });
});

describe("current menu shortcuts", () => {
  it("uses one digit per level", () => {
    const phone = bootedPhone();
    phone.pressKey("navi");
    phone.pressKey("4");
    phone.pressKey("3");
    expect(phone.path).toBe("menu/call-register/dialled-numbers");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Dialled numbers" });
  });

  it.each([
    ["10", "menu/phone-book", "menu/reminders"],
    ["11", "menu/phone-book/search", "menu/clock"],
    ["12", "menu/phone-book/service-nos", "menu/profiles"],
    ["13", "menu/phone-book/add-name", "menu/sim-services"],
  ] as const)(
    "does not interpret %s as a direct top-level target",
    (digits, expected, excluded) => {
      const phone = bootedPhone();
      phone.pressKey("navi");
      for (const digit of digits) phone.pressKey(digit as PhoneKey);
      expect(phone.path).toBe(expected);
      expect(phone.path).not.toBe(excluded);
    },
  );
});
