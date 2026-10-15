// Plan 18 Task 9: the messages EEPROM record (D7): per-SIM Inbox and Outbox sharing 15 slots,
// malformed entries dropped, kept by Restore factory settings; and the Sent: time stamp format.
import { describe, expect, it } from "vite-plus/test";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import { messageDate, messageTime } from "../src/messages/timestamp";
import { MESSAGE_SLOTS, MESSAGES_RECORD, StockMessages } from "../src/messages/store";
import { createMemoryStorage, STOCK_STORAGE_PREFIX, type StockIncomingSms } from "../src/index";

const STAMP = { year: 2026, month: 10, day: 13, hour: 10, minute: 11, second: 20 };
const sms = (number: string, text: string): StockIncomingSms => ({ number, text, sentAt: STAMP });

describe("MESSAGES_RECORD", () => {
  it("starts empty and keeps each SIM's messages apart", () => {
    const eeprom = new StockEeprom(createMemoryStorage());
    const one = new StockMessages(eeprom, "sim-1");
    const two = new StockMessages(eeprom, "sim-2");
    expect(one.inbox()).toEqual([]);
    expect(one.receive(sms("0400000001", "Hello"), "+1234567890")).toBe("stored");
    expect(one.save("Kept", "0412345678")).toBe("saved");
    expect(two.inbox()).toEqual([]);
    expect(two.outbox()).toEqual([]);
    expect(one.inbox()).toEqual([
      { number: "0400000001", text: "Hello", sentAt: STAMP, centre: "+1234567890", read: false },
    ]);
    expect(one.outbox()).toEqual([{ text: "Kept", number: "0412345678" }]);
  });

  it("stores the shape pinned here", () => {
    const storage = createMemoryStorage();
    const messages = new StockMessages(new StockEeprom(storage), "sim-1");
    messages.receive(sms("0400000001", "Hi"));
    messages.save("Draft");
    expect(JSON.parse(storage.getItem(`${STOCK_STORAGE_PREFIX}messages`)!)).toEqual({
      sims: {
        "sim-1": {
          inbox: [{ centre: "", number: "0400000001", read: false, sentAt: STAMP, text: "Hi" }],
          outbox: [{ text: "Draft" }],
        },
      },
      version: 1,
    });
  });

  it("shares 15 slots between Inbox and Outbox (Task 0 F: 10 + 5)", () => {
    const messages = new StockMessages(new StockEeprom(createMemoryStorage()), "sim-1");
    expect(MESSAGE_SLOTS).toBe(15);
    for (let i = 0; i < 10; i++) expect(messages.receive(sms(`040000000${i}`, "x"))).toBe("stored");
    for (let i = 0; i < 5; i++) expect(messages.save(`saved ${i}`)).toBe("saved");
    expect(messages.receive(sms("0400000099", "one more"))).toBe("full");
    expect(messages.save("one more")).toBe("full");
    messages.erase("inbox", 0);
    expect(messages.save("now it fits")).toBe("saved");
  });

  it("marks messages read and counts the unread; erases by list and index", () => {
    const messages = new StockMessages(new StockEeprom(createMemoryStorage()), "sim-1");
    messages.receive(sms("1", "a"));
    messages.receive(sms("2", "b"));
    expect(messages.unread()).toBe(2);
    messages.markRead(1);
    expect(messages.unread()).toBe(1);
    expect(messages.inbox().map((m) => m.read)).toEqual([false, true]);
    messages.erase("inbox", 0);
    expect(messages.inbox().map((m) => m.text)).toEqual(["b"]);
  });

  it("drops malformed messages and throws on a malformed record", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      `${STOCK_STORAGE_PREFIX}messages`,
      JSON.stringify({
        version: 1,
        sims: {
          "sim-1": {
            inbox: [
              { number: "1", text: "ok", sentAt: STAMP, centre: "", read: true },
              { number: 1, text: "bad number", sentAt: STAMP, centre: "", read: false },
              { number: "2", text: "no stamp", centre: "", read: false },
            ],
            outbox: [{ text: "kept" }, { text: 5 }, { text: "with", number: 7 }],
          },
        },
      }),
    );
    const messages = new StockMessages(new StockEeprom(storage), "sim-1");
    expect(messages.inbox().map((m) => m.text)).toEqual(["ok"]);
    expect(messages.outbox()).toEqual([{ text: "kept" }]);
    storage.setItem(`${STOCK_STORAGE_PREFIX}messages`, JSON.stringify({ version: 1, sims: [] }));
    expect(() => new StockEeprom(storage)).toThrow(/nokia-os\/messages: sims must be an object/);
  });

  it("survives Restore factory settings (no factory function; Task 0 F)", () => {
    expect("factory" in MESSAGES_RECORD).toBe(false);
    const eeprom = new StockEeprom(createMemoryStorage());
    const messages = new StockMessages(eeprom, "sim-1");
    messages.receive(sms("1", "kept over restore"));
    messages.save("saved too");
    createStockSettings(eeprom).restoreFactory();
    expect(messages.inbox().map((m) => m.text)).toEqual(["kept over restore"]);
    expect(messages.outbox()).toEqual([{ text: "saved too" }]);
  });
});

describe("the Sent: time stamp", () => {
  it("reads 13-Oct-2026 and 10:11:20, 24-hour (sms/inbox-view-1, sms/time-format)", () => {
    expect(messageDate(STAMP)).toBe("13-Oct-2026");
    expect(messageTime(STAMP)).toBe("10:11:20");
    const afternoon = { year: 2026, month: 1, day: 3, hour: 14, minute: 1, second: 7 };
    expect(messageDate(afternoon)).toBe("03-Jan-2026");
    expect(messageTime(afternoon)).toBe("14:01:07");
  });
});
