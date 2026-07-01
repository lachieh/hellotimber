// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { inbox } from "../src/content/messages";
import {
  getMessages,
  inboxItems,
  markAllRead,
  outboxItems,
  receiveRecorded,
  resetMessagesForTests,
  sendRecorded,
  subscribeMessages,
  threadOf,
} from "../src/messages/store";

const STAMP_LINE = /\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/;

beforeEach(() => {
  window.localStorage.clear();
  resetMessagesForTests();
});

describe("message store — seeding", () => {
  it("seeds the Inbox from the sample inbox content on first run", () => {
    const items = inboxItems();
    expect(items.length).toBe(inbox.length);
    // Seeds keep their original labels and full text.
    for (const m of inbox) {
      expect(
        items.some((i) => i.label === m.label && i.body.includes(m.text)),
        m.id,
      ).toBe(true);
    }
    expect(getMessages().unread).toBe(0);
  });

  it("seeds exactly once — a reload from storage does not duplicate", () => {
    sendRecorded("lachlan", "hello there"); // persists the seeded state + the send
    resetMessagesForTests(); // simulate a page reload: next read hits localStorage
    expect(inboxItems().length).toBe(inbox.length);
    expect(outboxItems().length).toBe(1);
  });
});

describe("message store — recording + persistence", () => {
  it("sendRecorded/receiveRecorded round-trip through localStorage", () => {
    sendRecorded("lachlan", "hi from the test");
    receiveRecorded("lachlan", "g'day right back");
    const raw = window.localStorage.getItem("hellotimber.messages");
    expect(raw).not.toBeNull();
    resetMessagesForTests();
    const thread = threadOf("lachlan");
    expect(thread.map((e) => ({ who: e.who, text: e.text }))).toEqual([
      { who: "me", text: "hi from the test" },
      { who: "them", text: "g'day right back" },
    ]);
  });

  it("corrupt stored JSON falls back to a fresh seeded state", () => {
    window.localStorage.setItem("hellotimber.messages", "{not json");
    resetMessagesForTests();
    expect(inboxItems().length).toBe(inbox.length);
  });

  it("counts unread on receive and clears with markAllRead (persisted)", () => {
    receiveRecorded("y2k-support", "case closed");
    receiveRecorded("y2k-support", "case reopened");
    expect(getMessages().unread).toBe(2);
    markAllRead();
    expect(getMessages().unread).toBe(0);
    resetMessagesForTests();
    expect(getMessages().unread).toBe(0);
  });

  it("notifies subscribers once per mutation and supports unsubscribe", () => {
    let calls = 0;
    const off = subscribeMessages(() => {
      calls += 1;
    });
    sendRecorded("lachlan", "one");
    expect(calls).toBe(1);
    off();
    receiveRecorded("lachlan", "two");
    expect(calls).toBe(1);
  });
});

describe("message store — item mapping", () => {
  it("inboxItems: newest first, label = contact name + first words, body = text + stamp", () => {
    receiveRecorded("recruiter-rachel", "Amazing WAP opportunity, call me!");
    receiveRecorded("lachlan", "G'day! Thanks for the SMS.");
    const items = inboxItems();
    expect(items.length).toBe(inbox.length + 2);
    // Newest first: the lachlan reply arrived last.
    expect(items[0]!.label).toContain("Lachlan");
    expect(items[0]!.label).toContain("G'day!");
    expect(items[0]!.body).toContain("G'day! Thanks for the SMS.");
    expect(items[0]!.body).toMatch(STAMP_LINE);
    expect(items[1]!.label).toContain("Recruiter Rachel");
    // ids unique
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("outboxItems: only sent messages, newest first", () => {
    sendRecorded("y2k-support", "STATUS");
    sendRecorded("lachlan", "nice phone");
    const items = outboxItems();
    expect(items.length).toBe(2);
    expect(items[0]!.label).toContain("Lachlan");
    expect(items[0]!.body).toContain("nice phone");
    expect(items[0]!.body).toMatch(STAMP_LINE);
    expect(items[1]!.label).toContain("Y2K Support");
    expect(inboxItems().some((i) => i.body.includes("STATUS"))).toBe(false);
  });
});
