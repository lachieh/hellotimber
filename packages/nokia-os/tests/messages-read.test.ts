// Plan 18 Task 11: arrivals (the received notice, the envelope, D11/D12), Inbox and Outbox (the
// lists, reading, Options, Erase, Details) through the stock phone's keys over a synthetic network.
import { describe, expect, it } from "vite-plus/test";
import { StockEeprom } from "../src/firmware/eeprom";
import { messagePages } from "../src/messages/read";
import { MESSAGE_SLOTS, StockMessages } from "../src/messages/store";
import { RECEIVE_LINK_MS } from "../src/resources";
import {
  createMemoryStorage,
  createSyntheticNetwork,
  type StockIncomingSms,
  type StockStorage,
} from "../src/index";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";
import { keys } from "./support/probes.ts";
import { expectLcdAnyBlink } from "./support/replay.ts";
import { standbyRig } from "./support/rig.ts";

const STAMP = { year: 2026, month: 10, day: 13, hour: 10, minute: 11, second: 20 };
const sms = (number: string, text: string): StockIncomingSms => ({ number, text, sentAt: STAMP });
const INBOX = "navi wait:300 down navi wait:500 down navi wait:500";
const OUTBOX = "navi wait:300 down navi wait:500 down*2 navi wait:500";

/** A phone without a T9 dictionary: the captures' editors had Dictionary off (plan 18b D5). */
function phone(storage: StockStorage = createMemoryStorage()) {
  const network = createSyntheticNetwork();
  const rig = standbyRig({ storage, network, t9: {} });
  const arrive = (message: StockIncomingSms) => {
    network.deliver(message);
    rig.advance(RECEIVE_LINK_MS + 10);
  };
  const store = () => new StockMessages(new StockEeprom(storage), "sim-1");
  return { rig, network, arrive, store };
}

describe("arrivals (D11, D12)", () => {
  it("shows `1 message received` with Read and the envelope at standby; counts unread ones", () => {
    const { rig, arrive } = phone();
    arrive(sms("0400000001", "Hello from the network"));
    expectLcd(rig.paint(), goldenImage("sms/notice", "count-1"), "1 message received");
    expect(rig.phone.screen).toMatchObject({
      kind: "standby",
      indicators: { message: true },
      notice: { text: "1\nmessage\nreceived", softkey: "Read" },
    });
    arrive(sms("0400000002", "Second"));
    expectLcd(rig.paint(), goldenImage("sms/notice", "count-2"), "2 messages received");
  });

  it("keeps the envelope after C dismisses the notice; Read opens Inbox with indicator 1", () => {
    const { rig, arrive } = phone();
    arrive(sms("0400000001", "Hello from the network"));
    keys(rig, "c wait:500");
    expect(rig.phone.screen).toMatchObject({ kind: "standby", indicators: { message: true } });
    expect(rig.phone.screen).not.toHaveProperty("notice");
    arrive(sms("0400000002", "Again"));
    keys(rig, "navi wait:500");
    // A standby application: the path stays standby; C goes back to standby.
    expect(rig.phone.path).toBe("standby");
    expect(rig.phone.screen.kind).toBe("custom");
    keys(rig, "c wait:500");
    expect(rig.phone.screen.kind).toBe("standby");
  });

  it("does not interrupt the menus; the notice waits for standby unless a key comes first", () => {
    const { rig, arrive } = phone();
    keys(rig, "navi wait:500");
    arrive(sms("0400000001", "In the menu"));
    expect(rig.phone.screen.kind).toBe("menu-carousel");
    keys(rig, "c wait:500");
    expect(rig.phone.screen).toMatchObject({ kind: "standby", indicators: { message: true } });
    expect(rig.phone.screen).not.toHaveProperty("notice");
  });

  it("refuses a message with every slot used: No space for new messages", () => {
    const storage = createMemoryStorage();
    const seed = new StockMessages(new StockEeprom(storage), "sim-1");
    for (let i = 0; i < MESSAGE_SLOTS; i++) seed.save(`saved ${i}`);
    const { rig, arrive, store } = phone(storage);
    arrive(sms("0400000016", "No room"));
    expect(rig.phone.screen).toMatchObject({
      kind: "standby",
      notice: { text: "No space\nfor new\nmessages", softkey: "OK" },
    });
    expect(store().inbox()).toEqual([]);
  });
});

describe("Inbox and Outbox (2-2, 2-3)", () => {
  it("lists, reads (marking read) and turns a message's pages, Sender and Sent (D13)", () => {
    const { rig, arrive, store } = phone();
    arrive(sms("0400000001", "Hello from the network"));
    keys(rig, `c wait:300 ${INBOX} wait:500`);
    expect(rig.phone.screen.kind).toBe("custom");
    keys(rig, "navi wait:300");
    expect(store().inbox()[0]!.read).toBe(true);
    expectLcd(rig.paint(), goldenImage("sms/inbox-view-1", "00"), "the text");
    keys(rig, "down");
    expectLcd(rig.paint(), goldenImage("sms/inbox-view-1", "down-01"), "Sender:");
    keys(rig, "down");
    expectLcd(rig.paint(), goldenImage("sms/inbox-view-1", "down-02"), "Sent:");
    keys(rig, "down");
    expectLcd(rig.paint(), goldenImage("sms/inbox-view-1", "down-03"), "back to the text");
  });

  it("pages a long text four lines at a time", () => {
    const pages = messagePages({
      text: "This is a long message from the emulator network that tests wrapping and scrolling of the message view on a 3310 ok",
      sender: "0400000002",
      sent: ["13-Oct-2026", "10:11:26"],
      read: false,
    });
    expect(pages.map((page) => page.length)).toEqual([4, 4, 1, 2, 3]);
    expect(pages.at(-2)).toEqual(["Sender:", "0400000002"]);
  });

  it("erases a message (Erase message?, Erased) and the last one (No more messages)", () => {
    const { rig, arrive, store } = phone();
    arrive(sms("0400000001", "First"));
    arrive(sms("0400000002", "Second"));
    keys(rig, `c wait:300 ${INBOX} navi wait:300 navi wait:300 navi wait:300 navi wait:4000`);
    expect(
      store()
        .inbox()
        .map((m) => m.text),
    ).toEqual(["Second"]);
    keys(rig, "navi wait:300 navi wait:300 navi wait:300 navi wait:3000");
    expect(store().inbox()).toEqual([]);
    expect(rig.phone.path).toBe("menu/messages");
  });

  it("reads a saved message without Sender or Sent; Edit and Forward keep its text", () => {
    const storage = createMemoryStorage();
    new StockMessages(new StockEeprom(storage), "sim-1").save("First");
    const { rig } = phone(storage);
    keys(rig, `${OUTBOX} wait:500 navi wait:300`);
    expectLcd(rig.paint(), goldenImage("sms/outbox-read", "00"), "First");
    keys(rig, "down");
    expectLcd(rig.paint(), goldenImage("sms/outbox-read", "down-1"), "one page: ▼ stays");
    keys(rig, "navi wait:300 down navi wait:300");
    expectLcdAnyBlink(rig.paint(), goldenImage("sms/outbox-edit", "b"), "Edit: the text");
  });
});
