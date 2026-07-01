// @vitest-environment jsdom
import { createPhone, MULTITAP_TIMEOUT_MS } from "@hellotimber/phone-core";
import type { MenuNode, Phone } from "@hellotimber/phone-core";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { chatMessages } from "../src/content/chat";
import {
  ensureThread,
  inboxItems,
  outboxItems,
  receiveRecorded,
  resetMessagesForTests,
  sendRecorded,
  threadOf,
} from "../src/messages/store";
import { chatApps } from "../src/phone/apps/chat";
import type { ChatDeps } from "../src/phone/apps/chat";

const MENU: MenuNode[] = [{ type: "app", id: "chat", label: "Chat", appId: "chat" }];

function makeHarness(reply = "heya!") {
  const sends: string[] = [];
  const scheduled: { fn: () => void | Promise<void>; ms: number }[] = [];
  const state = { alerts: 0 };
  const deps: ChatDeps = {
    nickname: "Lachlan",
    thread: () => threadOf("lachlan"),
    seed: () =>
      ensureThread(
        "lachlan",
        chatMessages.map((m) => ({ who: m.who, text: `${m.nickname}: ${m.text}` })),
      ),
    send: (text) => {
      sends.push(text);
      return Promise.resolve(reply);
    },
    recordSend: (text) => sendRecorded("lachlan", text, { chat: true }),
    recordReceive: (text) => receiveRecorded("lachlan", text, { chat: true }),
    playAlert: () => {
      state.alerts += 1;
    },
    replyDelayMs: () => 3000,
    schedule: (fn, ms) => {
      scheduled.push({ fn, ms });
    },
  };
  const phone: Phone = createPhone({ menu: MENU, apps: chatApps(deps), bootMs: 0 });
  let now = 0;
  phone.tick(now);
  phone.pressKey("power", 1000);
  now = 1000;
  return {
    phone,
    sends,
    scheduled,
    get alerts() {
      return state.alerts;
    },
    tick(ms: number) {
      now += ms;
      phone.tick(now);
    },
  };
}

function readerLines(phone: Phone): string[] {
  const screen = phone.screen;
  if (screen.kind !== "reader") throw new Error(`expected reader, got ${screen.kind}`);
  return screen.lines;
}

beforeEach(() => {
  window.localStorage.clear();
  resetMessagesForTests();
});

describe("Chat (Menu 3) session app", () => {
  it("seeds the lachlan thread from the testimonial content exactly once", () => {
    const h = makeHarness();
    h.phone.navigate("menu/chat");
    expect(threadOf("lachlan")).toHaveLength(chatMessages.length);
    // Re-entering does not duplicate the seed.
    h.phone.pressKey("c");
    h.phone.navigate("menu/chat");
    expect(threadOf("lachlan")).toHaveLength(chatMessages.length);
    // Seeded chat lines stay out of the SMS Inbox/Outbox lists.
    expect(inboxItems().some((i) => i.body.includes(chatMessages[0]!.text))).toBe(false);
  });

  it("renders the thread as a > / < session titled with the nickname", () => {
    const h = makeHarness();
    h.phone.navigate("menu/chat");
    const screen = h.phone.screen;
    expect(screen).toMatchObject({ kind: "reader", title: "Lachlan" });
    const text = readerLines(h.phone).join(" ");
    expect(text).toContain("> CTO@Acme:");
    expect(text).toContain("< Lachlan:");
  });

  it("compose → send → reply appends in order (alert only, no notice)", async () => {
    const h = makeHarness();
    h.phone.navigate("menu/chat");

    // NaviKey = Write → chat-compose editor with [Send, Exit].
    h.phone.pressKey("navi");
    expect(h.phone.screen).toMatchObject({ kind: "editor", title: "Chat:", limit: 160 });

    // Type "Hi" (Abc mode: 4,4 → "H", timeout, 4,4,4 → "i").
    h.phone.pressKey("4");
    h.phone.pressKey("4");
    h.tick(MULTITAP_TIMEOUT_MS + 50);
    h.phone.pressKey("4");
    h.phone.pressKey("4");
    h.phone.pressKey("4");
    h.tick(MULTITAP_TIMEOUT_MS + 50);

    h.phone.pressKey("navi"); // Options
    expect(h.phone.screen).toMatchObject({
      kind: "list",
      title: "Options",
      items: ["Send", "Exit"],
    });
    h.phone.pressKey("navi"); // Send → back to the session

    expect(h.sends).toEqual(["Hi"]);
    const lines = readerLines(h.phone);
    expect(lines.at(-1)).toContain("< Hi");

    // The reply arrives after the injected delay and appends in order.
    expect(h.scheduled).toHaveLength(1);
    expect(h.scheduled[0]!.ms).toBe(3000);
    await h.scheduled[0]!.fn();
    const after = readerLines(h.phone);
    expect(after.at(-1)).toContain("> heya!");
    expect(after.indexOf(after.find((l) => l.includes("< Hi"))!)).toBeLessThan(
      after.indexOf(after.find((l) => l.includes("> heya!"))!),
    );
    expect(h.alerts).toBe(1);

    // Chat traffic never reaches the SMS lists.
    expect(outboxItems().some((i) => i.body.includes("Hi"))).toBe(false);
    expect(inboxItems().some((i) => i.body.includes("heya!"))).toBe(false);

    // No standby notice — you're in the session.
    h.phone.navigate("standby");
    expect(h.phone.screen).toMatchObject({ kind: "standby" });
    const standby = h.phone.screen;
    if (standby.kind === "standby") expect(standby.notice).toBeUndefined();
  });

  it("the session sticks to the latest lines and scrolls with ▲", () => {
    const h = makeHarness();
    h.phone.navigate("menu/chat");
    const screen = h.phone.screen;
    if (screen.kind !== "reader") throw new Error("expected reader");
    // Seeded thread wraps to more than one screenful; view starts at the bottom.
    expect(screen.lines.length).toBeGreaterThan(3);
    expect(screen.scrollTop).toBe(screen.lines.length - 3);
    h.phone.pressKey("up");
    const scrolled = h.phone.screen;
    if (scrolled.kind !== "reader") throw new Error("expected reader");
    expect(scrolled.scrollTop).toBe(scrolled.lines.length - 4);
  });

  it("C exits the session; C in an empty compose returns to the session", () => {
    const h = makeHarness();
    h.phone.navigate("menu/chat");
    h.phone.pressKey("navi"); // compose
    expect(h.phone.screen).toMatchObject({ kind: "editor", title: "Chat:" });
    h.phone.pressKey("c"); // empty draft → back to the session, not out
    expect(h.phone.screen).toMatchObject({ kind: "reader", title: "Lachlan" });
    h.phone.pressKey("c"); // out of the session
    expect(h.phone.screen).toMatchObject({ kind: "menu-carousel" });
  });
});
