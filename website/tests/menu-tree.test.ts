import { createPhone, isValidPath } from "@hellotimber/phone-core";
import type { MenuNode } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { chatMessages } from "../src/content/chat";
import { contacts } from "../src/content/contacts";
import { diverts } from "../src/content/divert";
import { siteMenu } from "../src/content/menu";
import { phonebook } from "../src/content/phonebook";
import type { SiteNode } from "../src/content/types";
import { APP_IDS } from "../src/phone/phone";

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** SiteNode is MenuNode + optional web metadata — structurally assignable. */
const asMenu: MenuNode[] = siteMenu;

function top(id: string): SiteNode {
  const node = siteMenu.find((n) => n.id === id);
  if (node === undefined) throw new Error(`missing top-level node: ${id}`);
  return node;
}

function childrenOf(node: SiteNode): SiteNode[] {
  return node.type === "submenu" ? node.children : [];
}

function child(parentId: string, id: string): SiteNode {
  const node = childrenOf(top(parentId)).find((n) => n.id === id);
  if (node === undefined) throw new Error(`missing node: ${parentId}/${id}`);
  return node;
}

function eachLevel(nodes: SiteNode[], visit: (level: SiteNode[]) => void): void {
  visit(nodes);
  for (const n of nodes) {
    if (n.type === "submenu") eachLevel(n.children, visit);
  }
}

function appNodes(nodes: SiteNode[]): { id: string; appId: string }[] {
  const found: { id: string; appId: string }[] = [];
  eachLevel(nodes, (level) => {
    for (const n of level) {
      if (n.type === "app") found.push({ id: n.id, appId: n.appId });
    }
  });
  return found;
}

describe("siteMenu — the 3310 tree as website data (spec §5)", () => {
  it("has exactly 13 top-level menus in manual order", () => {
    expect(siteMenu.map((n) => n.label)).toEqual([
      "Phone book",
      "Messages",
      "Chat",
      "Call register",
      "Tones",
      "Settings",
      "Call divert",
      "Games",
      "Calculator",
      "Reminders",
      "Clock",
      "Profiles",
      "SIM services",
    ]);
    expect(siteMenu.map((n) => n.id)).toEqual([
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
      "sim-services",
    ]);
  });

  it("submenu children match spec §5 labels and order", () => {
    expect(childrenOf(top("phone-book")).map((n) => n.label)).toEqual([
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
    expect(childrenOf(top("messages")).map((n) => n.label)).toEqual([
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
    expect(childrenOf(top("call-register")).map((n) => n.label)).toEqual([
      "Missed calls",
      "Received calls",
      "Dialled numbers",
      "Erase recent call lists",
      "Show call duration",
      "Show call costs",
      "Call cost settings",
      "Prepaid credit",
    ]);
    expect(childrenOf(top("tones")).map((n) => n.label)).toEqual([
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
    expect(childrenOf(top("settings")).map((n) => n.label)).toEqual([
      "Call settings",
      "Phone settings",
      "Security settings",
      "Restore factory settings",
    ]);
    expect(childrenOf(top("games")).map((n) => n.label)).toEqual([
      "Snake II",
      "Space Impact",
      "Bantumi",
      "Pairs II",
    ]);
  });

  it("every node id is kebab-case and unique per level", () => {
    let levels = 0;
    eachLevel(siteMenu, (level) => {
      levels += 1;
      const ids = level.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(KEBAB);
    });
    expect(levels).toBeGreaterThan(1); // sanity: the walk descended
  });

  it("every app node's appId is a registered app id", () => {
    // "calculator" pre-dates plan 07 and has never had a registered app —
    // unregistered appIds are a safe no-op in phone-core (machine.ts).
    const pending = ["calculator"];
    const apps = appNodes(siteMenu);
    expect(apps.length).toBeGreaterThanOrEqual(3); // sanity: apps exist
    for (const { id, appId } of apps) {
      expect([...APP_IDS, ...pending], `app node '${id}' → appId '${appId}'`).toContain(appId);
    }
  });

  it("declares the working Tones/Settings apps directly in data (no patching)", () => {
    expect(child("tones", "ringing-tone")).toMatchObject({ type: "app", appId: "ringing-tone" });
    expect(child("tones", "keypad-tones")).toMatchObject({ type: "app", appId: "keypad-tones" });
    expect(child("tones", "screen-saver")).toMatchObject({ type: "app", appId: "screen-saver" });
    const phoneSettings = child("settings", "phone-settings");
    expect(phoneSettings.type).toBe("submenu");
    expect(childrenOf(phoneSettings)).toMatchObject([
      { type: "app", id: "welcome-note", appId: "welcome-note" },
      { type: "app", id: "lights", appId: "lights" },
    ]);
  });

  it("stub Settings readers carry the authentic spec §5 child lists in their bodies", () => {
    const callSettings = child("settings", "call-settings");
    if (callSettings.type !== "reader") throw new Error("call-settings must be a reader");
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
    const security = child("settings", "security-settings");
    if (security.type !== "reader") throw new Error("security-settings must be a reader");
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

describe("siteMenu — web metadata", () => {
  it("all 13 top-level menus carry a meta description", () => {
    for (const n of siteMenu) {
      expect(typeof n.web?.description, `top-level '${n.id}'`).toBe("string");
    }
  });

  it("the routed second-level pages carry descriptions", () => {
    for (const [parent, id] of [
      ["messages", "inbox"],
      ["messages", "write"],
      ["games", "snake"],
    ] as const) {
      expect(typeof child(parent, id).web?.description, `${parent}/${id}`).toBe("string");
    }
  });

  it("sim-services is the noindex easter egg with its bespoke panel", () => {
    expect(top("sim-services").web).toMatchObject({ noindex: true, panel: "sim-services" });
  });
});

// Ported from packages/phone-core/tests/nokia-menu.test.ts so no authenticity
// coverage is lost when phone-core drops the builder (plan 07 Task 5).
describe("siteMenu — ported nokia-menu authenticity tests", () => {
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
    for (const path of required) {
      expect(isValidPath(asMenu, path), path).toBe(true);
    }
  });

  it("renders the chat as a > / < conversation reader from the chat content", () => {
    const chat = top("chat");
    if (chat.type !== "reader") throw new Error("chat must be a reader");
    expect(chat.body).toBe(
      chatMessages
        .map((m) => `${m.who === "them" ? ">" : "<"} ${m.nickname}: ${m.text}`)
        .join("\n"),
    );
  });

  it("call divert entries are href action nodes from the divert content", () => {
    const children = childrenOf(top("call-divert"));
    expect(children.length).toBe(diverts.length + 1); // + the authentic stub
    diverts.forEach((d, i) => {
      expect(children[i]).toMatchObject({
        type: "action",
        id: d.id,
        label: d.label,
        action: { kind: "href", value: d.href },
      });
    });
    expect(children.at(-1)).toMatchObject({ id: "cancel-all-diverts" });
  });

  it("games: Snake II is an app node; the other three are listed", () => {
    expect(child("games", "snake")).toMatchObject({ type: "app", appId: "snake" });
  });

  it("Write messages is an app node wired to 'write-message'", () => {
    expect(child("messages", "write")).toMatchObject({
      type: "app",
      id: "write",
      label: "Write messages",
      appId: "write-message",
    });
  });

  it("drives a full phone: standby ▲ reaches the phone book name list", () => {
    const phone = createPhone({ menu: asMenu, bootMs: 0 });
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.pressKey("up");
    expect(phone.path).toBe("menu/phone-book/search");
    // Contact links first, then the SMS personas (plan 08).
    expect(phone.screen).toMatchObject({
      kind: "list",
      items: [...phonebook.map((c) => c.label), ...contacts.map((c) => c.name)],
    });
  });

  it("the carousel reports 13 menus", () => {
    const phone = createPhone({ menu: asMenu, bootMs: 0 });
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.pressKey("navi");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", total: 13, menuNumber: 1 });
  });
});
