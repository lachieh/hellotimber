// Plan 19 Task 5: the SIM card (D2) and the phone book record (D3, D4).
import { describe, expect, it } from "vite-plus/test";
import { PHONE_BOOK_SIMS } from "../scripts/capture-sets/19-phone-book.ts";
import { createMemoryStorage, StockEeprom, type StockStorage } from "../src/firmware/eeprom";
import { STOCK_RECORDS } from "../src/firmware/records";
import { normaliseSim, type StockSimCard } from "../src/phone-book/sim-card";
import { PHONE_BOOK_RECORD, StockPhoneBook } from "../src/phone-book/store";

const CONTENT = PHONE_BOOK_SIMS.content as StockSimCard;

function book(sim: string | StockSimCard = CONTENT, storage: StockStorage = createMemoryStorage()) {
  return new StockPhoneBook(new StockEeprom(storage), normaliseSim(sim));
}

describe("normaliseSim (D2)", () => {
  it("reads a string as the emulator SIM: 50 locations, 16-character names, empty", () => {
    const sim = normaliseSim("sim-1");
    expect(sim).toMatchObject({ id: "sim-1", locations: 50, nameLength: 16, serviceNumbers: [] });
    expect(sim.entries).toHaveLength(50);
    expect(sim.entries.every((e) => e === null)).toBe(true);
  });

  it("fills a card's free locations and keeps its service numbers", () => {
    const sim = normaliseSim({
      id: "s",
      phoneBook: { locations: 3, entries: [null, { name: "Zed", number: "1" }] },
      serviceNumbers: [{ name: "Help", number: "123" }],
    });
    expect(sim.entries).toEqual([null, { name: "Zed", number: "1" }, null]);
    expect(sim.serviceNumbers).toEqual([{ name: "Help", number: "123" }]);
  });

  it("accepts every Task 0 fixture", () => {
    for (const card of Object.values(PHONE_BOOK_SIMS)) {
      expect(() => normaliseSim(card as StockSimCard)).not.toThrow();
    }
  });

  it.each([
    ["", /non-empty/],
    [{ id: "" }, /non-empty id/],
    [{ id: "s", phoneBook: { locations: 0 } }, /phoneBook\.locations must be a positive integer/],
    [{ id: "s", phoneBook: { nameLength: 1.5 } }, /phoneBook\.nameLength must be a positive/],
    [
      { id: "s", phoneBook: { locations: 1, entries: [null, null] } },
      /phoneBook\.entries has 2 entries for 1 locations/,
    ],
    [
      { id: "s", phoneBook: { entries: [null, { name: "W", number: "04w1" }] } },
      /SIM card "s": phoneBook\.entries\[1\] \(location 2\) number "04w1"/,
    ],
    [
      { id: "s", phoneBook: { entries: [{ name: "Abcdefghijklmnopq", number: "1" }] } },
      /location 1\) name "Abcdefghijklmnopq" is longer than the SIM's 16 characters/,
    ],
    [
      { id: "s", phoneBook: { nameLength: 3, entries: [{ name: "Anna", number: "1" }] } },
      /longer than the SIM's 3 characters/,
    ],
    [
      { id: "s", phoneBook: { entries: [{ name: "A☃", number: "1" }] } },
      /location 1\) name "A☃" has characters the stock small font lacks: "☃"/,
    ],
    [
      { id: "s", phoneBook: { entries: [{ name: "", number: "" }] } },
      /neither a name nor a number/,
    ],
    [
      { id: "s", phoneBook: { entries: [{ name: "A", number: "123456789012345678901" }] } },
      /0-20 of 0-9 \* # p/,
    ],
    [{ id: "s", serviceNumbers: [{ name: "Help", number: "+-1" }] }, /serviceNumbers\[0\] number/],
  ] as const)("throws for an invalid card %#", (card, message) => {
    expect(() => normaliseSim(card as string | StockSimCard)).toThrow(message);
  });

  it("allows a name without a number, a number without a name, + and 20 digits", () => {
    const sim = normaliseSim({
      id: "s",
      phoneBook: {
        entries: [
          { name: "Noel", number: "" },
          { name: "", number: "0499000000" },
          { name: "Intl", number: "+12345678901234567890" },
          { name: "Codes", number: "*100#p1" },
        ],
      },
    });
    expect(sim.entries.slice(0, 4).every((e) => e !== null)).toBe(true);
  });
});

describe("PHONE_BOOK_RECORD (D3)", () => {
  it("is one of the phone's EEPROM records, empty when virgin", () => {
    expect(STOCK_RECORDS).toContain(PHONE_BOOK_RECORD);
    expect(PHONE_BOOK_RECORD.name).toBe("phone-book");
    expect(PHONE_BOOK_RECORD.version).toBe(1);
    expect(PHONE_BOOK_RECORD.initial()).toEqual({ sims: {}, speedDials: {}, tones: {} });
  });

  it("has no factory: Restore factory settings keeps the phone book, speed dials and tones", () => {
    expect("factory" in PHONE_BOOK_RECORD).toBe(false);
    const storage = createMemoryStorage();
    const eeprom = new StockEeprom(storage);
    const phoneBook = new StockPhoneBook(eeprom, normaliseSim(CONTENT));
    phoneBook.add({ name: "Zoe", number: "1" });
    phoneBook.assign(3, 4);
    phoneBook.setTone(5, 2);
    const before = storage.getItem("nokia-os/phone-book");
    eeprom.restoreFactory();
    expect(storage.getItem("nokia-os/phone-book")).toBe(before);
  });

  it("stores sorted JSON: each SIM's locations, speed dials and tones by SIM", () => {
    const storage = createMemoryStorage();
    const phoneBook = book({ id: "s", phoneBook: { locations: 3 } }, storage);
    phoneBook.add({ name: "Ann", number: "0400" });
    phoneBook.assign(2, 1);
    phoneBook.setTone(1, 0);
    expect(storage.getItem("nokia-os/phone-book")).toMatchInlineSnapshot(
      `"{"sims":{"s":{"locations":[{"name":"Ann","number":"0400"},null,null]}},"speedDials":{"s":{"2":1}},"tones":{"s":{"1":0}},"version":1}"`,
    );
  });

  it("drops malformed parts and keeps the rest", () => {
    const decoded = PHONE_BOOK_RECORD.decode(
      {
        sims: {
          s: { locations: [{ name: "A", number: "1" }, { name: 5 }, null, "x"] },
          bad: { locations: "x" },
        },
        speedDials: { s: { "2": 1, "1": 3, "4": "x", "5": 0 }, t: 3 },
        tones: { s: { "1": 3, x: 2, "2": "loud" } },
      },
      1,
    );
    expect(decoded).toEqual({
      sims: { s: { locations: [{ name: "A", number: "1" }, null, null, null] } },
      speedDials: { s: { "2": 1 } },
      tones: { s: { "1": 3 } },
    });
  });

  it("throws on a bad shape", () => {
    expect(() => PHONE_BOOK_RECORD.decode(null, 1)).toThrow();
    expect(() => PHONE_BOOK_RECORD.decode({ sims: [] }, 1)).toThrow(/sims/);
  });
});

describe("StockPhoneBook (D3, D4)", () => {
  it("lists the host's entries sorted until the phone first writes", () => {
    const phoneBook = book();
    expect(phoneBook.entries().map((e) => e.name)[0]).toBe("Abcdefghijklmnop");
    expect(phoneBook.entries().find((e) => e.name === "Jack")?.location).toBe(1);
    expect(phoneBook.used()).toBe(23);
    expect(phoneBook.free()).toBe(27);
    expect(phoneBook.serviceNumbers()).toEqual([
      { name: "Help", number: "1800123456" },
      { name: "Operator", number: "123" },
    ]);
  });

  it("adds at the first free location (Task 0 A: small), and is full at capacity", () => {
    const phoneBook = book({
      id: "s",
      phoneBook: { locations: 3, entries: [{ name: "Zed", number: "1" }] },
    });
    expect(phoneBook.add({ name: "Ann", number: "2" })).toEqual({
      name: "Ann",
      number: "2",
      location: 2,
    });
    expect(phoneBook.add({ name: "Bea", number: "3" })).toMatchObject({ location: 3 });
    expect(phoneBook.add({ name: "Cy", number: "4" })).toBe("full");
    phoneBook.erase(2);
    expect(phoneBook.add({ name: "Cy", number: "4" })).toMatchObject({ location: 2 });
    expect(phoneBook.free()).toBe(0);
  });

  it("replaces, erases and erases all", () => {
    const phoneBook = book();
    expect(phoneBook.replace(2, { name: "annab", number: "0400000001" })).toEqual({
      name: "annab",
      number: "0400000001",
      location: 2,
    });
    expect(phoneBook.entries().some((e) => e.name === "anna")).toBe(false);
    phoneBook.erase(3);
    expect(phoneBook.entries().some((e) => e.name === "Ben")).toBe(false);
    expect(phoneBook.used()).toBe(22);
    phoneBook.eraseAll();
    expect(phoneBook.entries()).toEqual([]);
    expect(phoneBook.free()).toBe(50);
  });

  it("falls back to SIM location n for an unassigned speed dial key (S13)", () => {
    const phoneBook = book();
    expect(phoneBook.isAssigned(2)).toBe(false);
    expect(phoneBook.speedDial(2)).toEqual({ name: "anna", number: "0400000001", location: 2 });
    expect(book("sim-1").speedDial(2)).toBeUndefined();
    const small = book({ id: "s", phoneBook: { locations: 3 } });
    expect(small.speedDial(4)).toBeUndefined();
  });

  it("assigns, follows Replace, and drops a key whose name is erased (Task 0 K, D)", () => {
    const phoneBook = book();
    phoneBook.assign(3, 4);
    expect(phoneBook.isAssigned(3)).toBe(true);
    expect(phoneBook.speedDial(3)?.name).toBe("Carl");
    phoneBook.replace(4, { name: "Carlx", number: "9" });
    expect(phoneBook.speedDial(3)?.name).toBe("Carlx");
    phoneBook.erase(4);
    expect(phoneBook.isAssigned(3)).toBe(false);
    expect(phoneBook.speedDial(3)?.name).toBe("Ben");
    phoneBook.assign(5, 6);
    phoneBook.unassign(5);
    expect(phoneBook.speedDial(5)?.name).toBe("Dave");
    expect(() => phoneBook.assign(1, 2)).toThrow(/key/);
    expect(() => phoneBook.assign(2, 51)).toThrow(/location/);
  });

  it("keeps a tone on its location: through Replace and Erase (Task 0 D, T)", () => {
    const phoneBook = book();
    expect(phoneBook.tone(14)).toBeNull();
    phoneBook.setTone(14, 2);
    phoneBook.replace(14, { name: "Ånnax", number: "1" });
    expect(phoneBook.tone(14)).toBe(2);
    phoneBook.erase(14);
    expect(phoneBook.add({ name: "New", number: "2" })).toMatchObject({ location: 14 });
    expect(phoneBook.tone(14)).toBe(2);
    phoneBook.setTone(14, null);
    expect(phoneBook.tone(14)).toBeNull();
    phoneBook.setTone(14, 0);
    expect(phoneBook.tone(14)).toBe(0);
  });

  it("finds a name by its number (plan 22: caller names)", () => {
    const phoneBook = book();
    expect(phoneBook.byNumber("0412345678")?.name).toBe("Bob");
    expect(phoneBook.byNumber("0499")).toBeUndefined();
  });

  it("shares a SIM between phones over one storage; another SIM keeps its own (P)", () => {
    const storage = createMemoryStorage();
    const first = book(CONTENT, storage);
    first.add({ name: "Zoe", number: "1" });
    first.assign(3, 4);
    first.setTone(5, 2);
    // The same SIM in a new phone (and with other host entries): the stored copy.
    const again = book({ ...CONTENT, phoneBook: { entries: [] } }, storage);
    expect(again.entries().some((e) => e.name === "Zoe")).toBe(true);
    expect(again.speedDial(3)?.name).toBe("Carl");
    expect(again.tone(5)).toBe(2);
    // Another SIM: its own names, its own fallbacks, no tones (sim/second-*).
    const second = book(PHONE_BOOK_SIMS.second as StockSimCard, storage);
    expect(second.entries().map((e) => e.name)).toEqual(["Kim", "Lee", "Max", "Ned", "Oz"]);
    expect(second.isAssigned(3)).toBe(false);
    expect(second.speedDial(3)?.name).toBe("Max");
    expect(second.tone(5)).toBeNull();
  });
});
