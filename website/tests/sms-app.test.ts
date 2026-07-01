// @vitest-environment jsdom
import { createPhone, MULTITAP_TIMEOUT_MS } from "@hellotimber/phone-core";
import type { MenuNode, Phone } from "@hellotimber/phone-core";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { inbox } from "../src/content/messages";
import {
  getMessages,
  inboxItems,
  outboxItems,
  receiveRecorded,
  resetMessagesForTests,
  sendRecorded,
} from "../src/messages/store";
import { smsApps } from "../src/phone/apps/sms";
import type { SmsDeps } from "../src/phone/apps/sms";

const MENU: MenuNode[] = [
  {
    type: "submenu",
    id: "messages",
    label: "Messages",
    children: [
      { type: "app", id: "write", label: "Write messages", appId: "write-message" },
      { type: "list", id: "inbox", label: "Inbox", items: () => inboxItems() },
      { type: "list", id: "outbox", label: "Outbox", items: () => outboxItems() },
    ],
  },
];

interface Harness {
  phone: Phone;
  sends: { contactId: string; text: string }[];
  scheduled: { fn: () => void | Promise<void>; ms: number }[];
  alerts: number;
  tick(ms: number): void;
  typeHi(): void;
}

function makeHarness(reply = "a reply!"): Harness {
  const sends: Harness["sends"] = [];
  const scheduled: Harness["scheduled"] = [];
  const state = { alerts: 0 };
  let phoneRef: Phone | null = null;
  const deps: SmsDeps = {
    contacts: [
      { id: "lachlan", name: "Lachlan" },
      { id: "recruiter-rachel", name: "Recruiter Rachel" },
    ],
    send: (contactId, text) => {
      sends.push({ contactId, text });
      return Promise.resolve(reply);
    },
    recordSend: sendRecorded,
    recordReceive: receiveRecorded,
    notify: (n) => phoneRef?.setNotice(n),
    playAlert: () => {
      state.alerts += 1;
    },
    replyDelayMs: () => 5000,
    schedule: (fn, ms) => {
      scheduled.push({ fn, ms });
    },
  };
  const phone = createPhone({ menu: MENU, apps: smsApps(deps), bootMs: 0 });
  phoneRef = phone;
  let now = 0;
  phone.tick(now);
  phone.pressKey("power", 1000);
  now = 1000;
  const harness: Harness = {
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
    typeHi() {
      // "Abc" mode: 4,4 → "H"; timeout commit; 4,4,4 → "i".
      phone.pressKey("4");
      phone.pressKey("4");
      harness.tick(MULTITAP_TIMEOUT_MS + 50);
      phone.pressKey("4");
      phone.pressKey("4");
      phone.pressKey("4");
      harness.tick(MULTITAP_TIMEOUT_MS + 50);
    },
  };
  return harness;
}

beforeEach(() => {
  window.localStorage.clear();
  resetMessagesForTests();
});

describe("SMS flow: compose → Options → Send → To: → sending → reply", () => {
  it("drives the full flow and lands the reply in the Inbox with a standby notice", async () => {
    const h = makeHarness();
    h.phone.navigate("menu/messages/write");
    expect(h.phone.screen).toMatchObject({ kind: "editor", title: "Message:", limit: 160 });

    h.typeHi();
    expect(h.phone.screen).toMatchObject({ kind: "editor", text: "Hi" });

    // NaviKey opens the Options overlay; Send is first.
    h.phone.pressKey("navi");
    expect(h.phone.screen).toMatchObject({
      kind: "list",
      title: "Options",
      items: ["Send", "Clear text", "Exit"],
      selected: 0,
    });

    // Send → To: picker; the URL stays at the launching node the whole chain.
    h.phone.pressKey("navi");
    expect(h.phone.screen).toMatchObject({
      kind: "list",
      title: "To:",
      items: ["Lachlan", "Recruiter Rachel"],
    });
    expect(h.phone.path).toBe("menu/messages/write");

    // Pick Lachlan → sending beat; the send fires immediately.
    h.phone.pressKey("navi");
    expect(h.phone.screen).toMatchObject({ kind: "confirm", text: "Sending message" });
    expect(h.sends).toEqual([{ contactId: "lachlan", text: "Hi" }]);
    expect(outboxItems()[0]!.body).toContain("Hi");

    // ~1.2s → "Message sent", ~0.8s more → exits to the Messages submenu.
    h.tick(1200);
    expect(h.phone.screen).toMatchObject({ kind: "confirm", text: "Message sent" });
    h.tick(900);
    expect(h.phone.path).toBe("menu/messages");

    // The reply is scheduled with the injected delay; fire it manually.
    expect(h.scheduled).toHaveLength(1);
    expect(h.scheduled[0]!.ms).toBe(5000);
    expect(h.alerts).toBe(0);
    await h.scheduled[0]!.fn();

    expect(inboxItems()[0]!.body).toContain("a reply!");
    expect(inboxItems()).toHaveLength(inbox.length + 1);
    expect(getMessages().unread).toBe(1);
    expect(h.alerts).toBe(1);

    // Standby shows the envelope notice; navi lands in the Inbox.
    h.phone.navigate("standby");
    expect(h.phone.screen).toMatchObject({
      kind: "standby",
      notice: { text: "1 message received", softkey: "Read" },
    });
    h.phone.pressKey("navi");
    expect(h.phone.path).toBe("menu/messages/inbox");
    expect(h.phone.screen).toMatchObject({ kind: "list", title: "Inbox" });
  });

  it("C from the To: picker returns to the editor with the draft intact", () => {
    const h = makeHarness();
    h.phone.navigate("menu/messages/write");
    h.typeHi();
    h.phone.pressKey("navi"); // Options
    h.phone.pressKey("navi"); // Send → To:
    expect(h.phone.screen).toMatchObject({ kind: "list", title: "To:" });
    h.phone.pressKey("c"); // back to the draft
    expect(h.phone.screen).toMatchObject({ kind: "editor", text: "Hi" });
    expect(h.phone.path).toBe("menu/messages/write");
    expect(h.sends).toHaveLength(0);
  });

  it("Send with an empty draft stays in the editor (nothing to send)", () => {
    const h = makeHarness();
    h.phone.navigate("menu/messages/write");
    h.phone.pressKey("navi"); // Options over the empty draft
    h.phone.pressKey("navi"); // Send
    expect(h.phone.screen).toMatchObject({ kind: "editor", text: "" });
    expect(h.sends).toHaveLength(0);
  });

  it("keys during the sending beat are swallowed (the beat completes)", () => {
    const h = makeHarness();
    h.phone.navigate("menu/messages/write");
    h.typeHi();
    h.phone.pressKey("navi");
    h.phone.pressKey("navi");
    h.phone.pressKey("navi"); // pick contact → sending
    h.phone.pressKey("c");
    expect(h.phone.screen).toMatchObject({ kind: "confirm", text: "Sending message" });
  });
});
