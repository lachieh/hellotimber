import { describe, expect, it } from "vite-plus/test";
import { createPhone, isValidPath, nokia3310Menu } from "../src/index";
import type { Nokia3310Content } from "../src/index";

function sampleContent(): Nokia3310Content {
  return {
    phonebook: [{ id: "email", label: "Email", body: "lachlan@example.com" }],
    inbox: [{ id: "intro", label: "Hello!", body: "Short intro SMS." }],
    chat: [
      { who: "them", text: "Great engineer." },
      { who: "me", text: "Thanks!" },
    ],
    missedCalls: [{ id: "one", label: "The one", body: "Got away." }],
    receivedCalls: [{ id: "acme", label: "Acme 2020", body: "Senior engineer." }],
    dialledNumbers: [{ id: "proj", label: "Project X", body: "Shipped." }],
    diverts: [{ id: "github", label: "GitHub", href: "https://github.com/example" }],
    reminders: [{ id: "now", label: "Learning", body: "three.js" }],
  };
}

describe("nokia3310Menu", () => {
  it("builds all 13 menus with verified labels, order and kebab-case ids", () => {
    const menu = nokia3310Menu(sampleContent());
    expect(menu.map((n) => n.label)).toEqual([
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
    expect(menu.map((n) => n.id)).toEqual([
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

  it("exposes every path the VISION sitemap needs", () => {
    const menu = nokia3310Menu(sampleContent());
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
      expect(isValidPath(menu, path), path).toBe(true);
    }
  });

  it("renders the chat as a > / < conversation reader", () => {
    const menu = nokia3310Menu(sampleContent());
    const chat = menu[2]!;
    if (chat.type !== "reader") throw new Error("chat must be a reader");
    expect(chat.body).toBe("> Great engineer.\n< Thanks!");
  });

  it("call divert entries are href action nodes", () => {
    const menu = nokia3310Menu(sampleContent());
    const divert = menu[6]!;
    if (divert.type !== "submenu") throw new Error("call-divert must be a submenu");
    expect(divert.children[0]).toEqual({
      type: "action",
      id: "github",
      label: "GitHub",
      action: { kind: "href", value: "https://github.com/example" },
    });
  });

  it("games: Snake II is an app node; the other three are listed (stub readers)", () => {
    const menu = nokia3310Menu(sampleContent());
    const games = menu[7]!;
    if (games.type !== "submenu") throw new Error("games must be a submenu");
    expect(games.children[0]).toEqual({
      type: "app",
      id: "snake",
      label: "Snake II",
      appId: "snake",
    });
    expect(games.children.map((c) => c.label)).toEqual([
      "Snake II",
      "Space Impact",
      "Bantumi",
      "Pairs II",
    ]);
  });

  it("Write messages is an app node wired to 'write-message'", () => {
    const menu = nokia3310Menu(sampleContent());
    const messages = menu[1]!;
    if (messages.type !== "submenu") throw new Error("messages must be a submenu");
    expect(messages.children[0]).toEqual({
      type: "app",
      id: "write",
      label: "Write messages",
      appId: "write-message",
    });
  });

  it("drives a full phone: standby ▲ reaches the phone book name list", () => {
    const phone = createPhone({ menu: nokia3310Menu(sampleContent()), bootMs: 0 });
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.pressKey("up");
    expect(phone.path).toBe("menu/phone-book/search");
    expect(phone.screen).toMatchObject({ kind: "list", items: ["Email"] });
  });

  it("the carousel reports 13 menus", () => {
    const phone = createPhone({ menu: nokia3310Menu(sampleContent()), bootMs: 0 });
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.pressKey("navi");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", total: 13, menuNumber: 1 });
  });
});
