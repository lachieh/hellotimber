// Plan 30 Task 5: SMS senders named from the phone book (D7, Task 0 N): the number rule, the
// phone book lookup and the screens that show a name (the Inbox list, Sender:, Details).
import { describe, expect, it } from "vite-plus/test";
import { SIM_CONTENT_SIMS } from "../scripts/capture-sets/30-sim-content.ts";
import { StockEeprom } from "../src/firmware/eeprom";
import { sameSubscriber } from "../src/services/phone-book/numbers";
import { normaliseSim } from "../src/phone-book/sim-card";
import { StockPhoneBook } from "../src/services/phone-book/store";
import { createMemoryStorage, type StockSimCard } from "../src/index";
import { messagePages } from "../src/messages/read";

describe("sameSubscriber (Task 0 N, names/digits)", () => {
  // Every arrival names2 received, and whom v6.39 named (Ann 0412345678, Zed +61498765432,
  // Sam 123456).
  const NAMED: Readonly<Record<string, string | undefined>> = {
    "0061412345678": "Ann",
    "0123456": "Sam",
    "0312345678": undefined,
    "0402345678": undefined,
    "0412345678": "Ann",
    "0412345679": undefined,
    "0412945678": undefined,
    "0413345678": undefined,
    "0498765432": "Zed",
    "123456": "Sam",
    "12345678": "Ann",
    "23456": "Sam",
    "2345678": "Ann",
    "412345678": "Ann",
    "44412345678": "Ann",
    "4498765432": "Zed",
    "498765432": "Zed",
    "5412345678": "Ann",
    "61412345678": "Ann",
    "61498765432": "Zed",
    "9123456": "Sam",
    "98765432": "Zed",
  };
  const BOOK = [
    ["Ann", "0412345678"],
    ["Zed", "+61498765432"],
    ["Sam", "123456"],
  ] as const;

  for (const [number, name] of Object.entries(NAMED)) {
    it(`${number} names ${name ?? "nobody"}`, () => {
      expect(BOOK.find(([, entry]) => sameSubscriber(entry, number))?.[0]).toBe(name);
    });
  }

  it("ignores the type of number (+) and compares numbers with * # p exactly", () => {
    expect(sameSubscriber("+61400000004", "0400000004")).toBe(true);
    expect(sameSubscriber("*100#", "*100#")).toBe(true);
    expect(sameSubscriber("0412p345", "412p345")).toBe(false);
    expect(sameSubscriber("", "")).toBe(false);
  });
});

describe("StockPhoneBook.byNumber", () => {
  const book = (sim: StockSimCard) =>
    new StockPhoneBook(new StockEeprom(createMemoryStorage()), normaliseSim(sim));
  const sms = book(SIM_CONTENT_SIMS.sms as StockSimCard);

  it("takes an exact match first (Task 0 N: +61412345678 names Intl, not Bob)", () => {
    expect(sms.byNumber("+61412345678")?.name).toBe("Intl");
    expect(sms.byNumber("0412345678")?.name).toBe("Bob");
  });

  it("else the first entry in SIM order with the same last 9 digits", () => {
    expect(sms.byNumber("+61400000003")?.name).toBe("Carl");
    expect(sms.byNumber("0400000004")?.name).toBe("Dave");
    expect(sms.byNumber("44412345678")?.name).toBe("Bob");
    expect(sms.byNumber("0412345679")).toBeUndefined();
  });

  it("does not name a sender from an entry without a name", () => {
    const unnamed = book({ id: "sim-1", phoneBook: { entries: [{ name: "", number: "0411" }] } });
    expect(unnamed.byNumber("0411")).toBeUndefined();
  });
});

describe("named senders on the message screens (D7)", () => {
  it("reads Sender: as the name line, then the number line; unknown senders by number", () => {
    const sent = ["13-Oct-2026", "08:05:00"];
    expect(
      messagePages({ text: "Hi", sender: "0400000002", name: "Ben", sent, read: true }).at(-2),
    ).toEqual(["Sender:", "Ben", "0400000002"]);
    expect(messagePages({ text: "Hi", sender: "0499000001", sent, read: true }).at(-2)).toEqual([
      "Sender:",
      "0499000001",
    ]);
  });
  // The list, Sender: and Details against Task 0's captures: sim/names-*, sim/sms-read-* (the
  // acceptance replays).
});
