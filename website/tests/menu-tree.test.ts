import {
  ActionEntry,
  ApplicationEntry,
  createPhone,
  ListEntry,
  PhoneApplication,
  ReaderEntry,
  SubmenuEntry,
} from "@hellotimber/phone-core";
import type { MenuEntry } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { chatMessages } from "../src/content/chat";
import { contacts } from "../src/content/contacts";
import { diverts } from "../src/content/divert";
import { SITE_STANDBY_KEYS, siteMenu } from "../src/content/menu";
import { phonebook } from "../src/content/phonebook";
import type { WebMetadata } from "../src/content/types";
import { CalculatorApplication } from "../src/phone/applications/calculator";
import { ChatApplication } from "../src/phone/applications/chat";
import { ConfiguredEditorApplication } from "../src/phone/applications/editor";
import { PickerApplication } from "../src/phone/applications/picker";
import { SmsApplication } from "../src/phone/applications/sms";
import { SnakeApplication } from "../src/phone/applications/snake";

function top(slug: string): MenuEntry<WebMetadata> {
  const entry = siteMenu.entries.find((slot) => slot.entry.slug.value === slug)?.entry;
  if (entry === undefined) throw new Error(`missing top-level entry: ${slug}`);
  return entry;
}

function childrenOf(entry: MenuEntry<WebMetadata>): readonly MenuEntry<WebMetadata>[] {
  return entry instanceof SubmenuEntry ? entry.children.entries : [];
}

function child(parentSlug: string, slug: string): MenuEntry<WebMetadata> {
  const entry = childrenOf(top(parentSlug)).find((candidate) => candidate.slug.value === slug);
  if (entry === undefined) throw new Error(`missing entry: ${parentSlug}/${slug}`);
  return entry;
}

function eachLevel(
  entries: readonly MenuEntry<WebMetadata>[],
  visit: (level: readonly MenuEntry<WebMetadata>[]) => void,
): void {
  visit(entries);
  for (const entry of entries) {
    if (entry instanceof SubmenuEntry) eachLevel(entry.children.entries, visit);
  }
}

describe("siteMenu - the 3310 PhoneMenu (spec section 5)", () => {
  it("has exactly 13 top-level menus with explicit canonical order and graphics", () => {
    expect(
      siteMenu.entries.map(({ entry, graphic }) => [
        entry.label,
        entry.slug.value,
        entry.order.value,
        graphic.id,
      ]),
    ).toEqual([
      ["Phone book", "phone-book", 1, "phone-book"],
      ["Messages", "messages", 2, "messages"],
      ["Chat", "chat", 3, "chat"],
      ["Call register", "call-register", 4, "call-register"],
      ["Tones", "tones", 5, "tones"],
      ["Settings", "settings", 6, "settings"],
      ["Call divert", "call-divert", 7, "call-divert"],
      ["Games", "games", 8, "games"],
      ["Calculator", "calculator", 9, "calculator"],
      ["Reminders", "reminders", 10, "reminders"],
      ["Clock", "clock", 11, "clock"],
      ["Profiles", "profiles", 12, "profiles"],
      ["SIM services", "sim-services", 13, "sim-services"],
    ]);
  });

  it("submenu children match spec section 5 labels and order", () => {
    expect(childrenOf(top("phone-book")).map((entry) => entry.label)).toEqual([
      "Search",
      "Service Nos.",
      "Add name",
      "Erase",
      "Edit",
      "Assign tone",
      "Send b'card",
      "Options",
      "Speed dials",
      "Voice tags",
    ]);
    expect(childrenOf(top("messages")).map((entry) => entry.label)).toEqual([
      "Write messages",
      "Inbox",
      "Outbox",
      "Picture messages",
      "Templates",
      "Smileys",
      "Message settings",
      "Info service",
      "Voice mailbox number",
      "Service command editor",
    ]);
    expect(childrenOf(top("call-register")).map((entry) => entry.label)).toEqual([
      "Missed calls",
      "Received calls",
      "Dialled numbers",
      "Erase recent call lists",
      "Show call duration",
      "Show call costs",
      "Call cost settings",
      "Prepaid credit",
    ]);
    expect(childrenOf(top("tones")).map((entry) => entry.label)).toEqual([
      "Ringing tone",
      "Ringing volume",
      "Incoming call alert",
      "Composer",
      "Message alert tone",
      "Keypad tones",
      "Warning and game tones",
      "Vibrating alert",
      "Screen saver",
    ]);
    expect(childrenOf(top("settings")).map((entry) => entry.label)).toEqual([
      "Call settings",
      "Phone settings",
      "Security settings",
      "Restore factory settings",
    ]);
    expect(childrenOf(top("games")).map((entry) => entry.label)).toEqual([
      "Snake II",
      "Space Impact",
      "Bantumi",
      "Pairs II",
    ]);
  });

  it("has contiguous explicit orders and unique slugs at every level", () => {
    let levels = 0;
    eachLevel(
      siteMenu.entries.map((slot) => slot.entry),
      (level) => {
        levels += 1;
        expect(level.map((entry) => entry.order.value)).toEqual(
          level.map((_entry, index) => index + 1),
        );
        expect(new Set(level.map((entry) => entry.slug.value)).size).toBe(level.length);
      },
    );
    expect(levels).toBeGreaterThan(1);
  });

  it("references concrete application definitions directly", () => {
    const applications = siteMenu.walk({
      visitSubmenu: () => null,
      visitList: () => null,
      visitReader: () => null,
      visitAction: () => null,
      visitApplication: (entry) => entry,
    });
    const appEntries = applications.filter(
      (entry): entry is ApplicationEntry<WebMetadata> => entry instanceof ApplicationEntry,
    );
    expect(appEntries.length).toBeGreaterThanOrEqual(9);
    for (const entry of appEntries) expect(entry.application).toBeInstanceOf(PhoneApplication);

    expect(
      (child("messages", "write") as ApplicationEntry<WebMetadata>).application,
    ).toBeInstanceOf(SmsApplication);
    expect((top("chat") as ApplicationEntry<WebMetadata>).application).toBeInstanceOf(
      ChatApplication,
    );
    expect((child("games", "snake") as ApplicationEntry<WebMetadata>).application).toBeInstanceOf(
      SnakeApplication,
    );
    expect((top("calculator") as ApplicationEntry<WebMetadata>).application).toBeInstanceOf(
      CalculatorApplication,
    );
    expect(
      (child("tones", "ringing-tone") as ApplicationEntry<WebMetadata>).application,
    ).toBeInstanceOf(PickerApplication);
    const phoneSettings = child("settings", "phone-settings");
    const welcome = childrenOf(phoneSettings)[0] as ApplicationEntry<WebMetadata>;
    expect(welcome.application).toBeInstanceOf(ConfiguredEditorApplication);
  });

  it("uses static sources except for the live Inbox and Outbox", () => {
    const search = child("phone-book", "search");
    const inbox = child("messages", "inbox");
    const outbox = child("messages", "outbox");
    expect(search).toBeInstanceOf(ListEntry);
    expect(inbox).toBeInstanceOf(ListEntry);
    expect(outbox).toBeInstanceOf(ListEntry);
    expect((search as ListEntry<WebMetadata>).source.constructor.name).toBe("StaticMenuListSource");
    expect((inbox as ListEntry<WebMetadata>).source.constructor.name).toBe("DynamicMenuListSource");
    expect((outbox as ListEntry<WebMetadata>).source.constructor.name).toBe(
      "DynamicMenuListSource",
    );
  });

  it("stub Settings readers carry the authentic child lists in their bodies", () => {
    const callSettings = child("settings", "call-settings");
    const security = child("settings", "security-settings");
    if (!(callSettings instanceof ReaderEntry) || !(security instanceof ReaderEntry)) {
      throw new Error("settings stubs must be readers");
    }
    for (const label of [
      "Automatic redial",
      "Speed dialling",
      "Call waiting options",
      "Own number sending",
      "Phone line in use",
      "Automatic answer",
    ]) {
      expect(callSettings.body).toContain(label);
    }
    for (const label of [
      "PIN code request",
      "Call barring service",
      "Fixed dialling",
      "Closed user group",
      "Security level",
    ]) {
      expect(security.body).toContain(label);
    }
  });
});

describe("siteMenu - web metadata", () => {
  it("all 13 top-level menus carry typed indexing metadata and descriptions", () => {
    for (const { entry } of siteMenu.entries) {
      expect(typeof entry.metadata?.description, `top-level '${entry.slug.value}'`).toBe("string");
      expect(["index", "noindex"]).toContain(entry.metadata?.indexing);
    }
  });

  it("the routed second-level pages carry index metadata", () => {
    for (const [parent, slug] of [
      ["messages", "inbox"],
      ["messages", "write"],
      ["games", "snake"],
    ] as const) {
      expect(child(parent, slug).metadata?.indexing, `${parent}/${slug}`).toBe("index");
    }
  });

  it("sim-services is the noindex easter egg with its typed panel", () => {
    expect(top("sim-services").metadata).toEqual({
      indexing: "noindex",
      description: "No service.",
      panel: "sim-services",
    });
  });
});

describe("siteMenu - handset integration", () => {
  it("exposes every path the VISION sitemap needs", () => {
    const required = [
      "menu/phone-book",
      "menu/phone-book/search",
      "menu/messages",
      "menu/messages/write",
      "menu/messages/inbox",
      "menu/chat",
      "menu/call-register/missed-calls",
      "menu/call-register/received-calls",
      "menu/call-register/dialled-numbers",
      "menu/tones",
      "menu/settings",
      "menu/call-divert",
      "menu/games",
      "menu/games/snake",
      "menu/calculator",
      "menu/reminders",
      "menu/clock",
      "menu/profiles",
      "menu/sim-services",
    ];
    for (const path of required) expect(siteMenu.isValidPath(path), path).toBe(true);
  });

  it("imports and traverses the complete menu in a node environment", async () => {
    const imported = await import("../src/content/menu");
    expect(imported.siteMenu.paths().length).toBeGreaterThan(40);
    expect(
      imported.siteMenu.walk({
        visitSubmenu: (entry) => entry.slug.value,
        visitList: (entry) => entry.slug.value,
        visitReader: (entry) => entry.slug.value,
        visitAction: (entry) => entry.slug.value,
        visitApplication: (entry) => entry.slug.value,
      }),
    ).toHaveLength(imported.siteMenu.paths().length - 1);
    expect(typeof window).toBe("undefined");
  });

  it("keeps Chat as the Menu 3 application with seeded content", () => {
    const chat = top("chat");
    expect(chat).toBeInstanceOf(ApplicationEntry);
    expect(chat.order.value).toBe(3);
    expect(chatMessages.length).toBeGreaterThan(0);
  });

  it("keeps call divert entries as href actions", () => {
    const entries = childrenOf(top("call-divert"));
    expect(entries.length).toBe(diverts.length + 1);
    diverts.forEach((divert, index) => {
      const entry = entries[index];
      expect(entry).toBeInstanceOf(ActionEntry);
      expect(entry).toMatchObject({
        label: divert.label,
        action: { kind: "href", value: divert.href },
      });
    });
  });

  it("drives a full phone: standby up reaches the phone book name list", () => {
    const phone = createPhone({ menu: siteMenu, bootMs: 0, standbyKeys: SITE_STANDBY_KEYS });
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.pressKey("up");
    expect(phone.path).toBe("menu/phone-book/search");
    expect(phone.screen).toMatchObject({
      kind: "list",
      items: [...phonebook.map((entry) => entry.label), ...contacts.map((contact) => contact.name)],
    });
  });

  it("reports 13 carousel menus and launches Calculator at Menu 9", () => {
    const phone = createPhone({ menu: siteMenu, bootMs: 0 });
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.pressKey("navi");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", total: 13, menuNumber: 1 });
    for (let index = 1; index < 9; index += 1) phone.pressKey("down");
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/calculator");
    expect(phone.screen).toEqual({
      kind: "editor",
      title: "Calculator",
      text: "0",
      cursor: 1,
      mode: "123",
    });
  });
});
