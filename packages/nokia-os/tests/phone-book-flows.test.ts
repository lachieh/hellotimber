// Plan 19 Tasks 7-10: the phone book's flows on a whole stock phone (the goldens' replays are
// tests/acceptance/19-phone-book.test.ts; these pin the rules between the captures).
import { describe, expect, it } from "vite-plus/test";
import { PHONE_BOOK_SIMS } from "../scripts/capture-sets/19-phone-book.ts";
import { KEYGUARD_HINT_LEAD_MS, KEYGUARD_TIMES } from "../src/kit/system/keyguard";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import { createMemoryStorage, type StockSimCard, type StockStorage } from "../src/index";
import { normaliseSim } from "../src/phone-book/sim-card";
import { StockPhoneBook } from "../src/services/phone-book/store";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";
import { lockedRig } from "./support/keyguard.ts";
import { seededStorage, standbyRig, type Rig } from "./support/rig.ts";

const CONTENT = PHONE_BOOK_SIMS.content as StockSimCard;

/** The highlighted name in the Large font list (the soft key's), read from the model's frame. */
function onScreen(rig: Rig): string {
  return JSON.stringify(rig.phone.screen);
}

/** Menu, Phone book, the `k`th entry, Select; settled. */
function phoneBook(rig: Rig, k: number): void {
  rig.press("navi");
  rig.advance(1500);
  rig.press("navi");
  rig.advance(1500);
  for (let i = 1; i < k; i++) rig.press("down");
  rig.press("navi");
  rig.advance(1500);
}

/** Taps `keys` with the capture's 592 ms per tap, then lets the last letter commit. */
function type(rig: Rig, keys: string): void {
  for (const key of keys.split(" ")) {
    rig.press(key as never);
    rig.advance(592);
  }
  rig.advance(1700);
}

describe("standby ▼ (D5)", () => {
  it("C cancels the empty SIM note on key-down and keeps its keypad and held beeps", () => {
    const rig = standbyRig({ storage: seededStorage({ factory: true }) });
    rig.press("down");
    rig.advance(1060);
    expectLcd(
      rig.paint(),
      goldenImage("phone-book/standby-down-empty", "c"),
      "No phone numbers is still shown before C",
    );
    const seen = rig.sounds.length;
    rig.hold("c");
    expect(rig.phone.screen.kind).toBe("standby");
    rig.advance(650);
    expect(
      rig.sounds.slice(seen).filter((event) => event.output === "tone" && event.hz !== null),
    ).toMatchObject([
      { hz: 900, volume: 0x9104 },
      { hz: 900, volume: 0x9104 },
    ]);
    rig.release("c");
  });

  it("shows the keyguard hint at a locked standby, not the name list", () => {
    const rig = lockedRig("dark", { sim: CONTENT });
    rig.press("down");
    rig.advance(KEYGUARD_HINT_LEAD_MS);
    expectLcd(rig.paint(), goldenImage("keyguard/hint/up", "c"), "the hint");
    rig.advance(KEYGUARD_TIMES.hintMs);
    expect(rig.phone.path).toBe("standby");
    expect(rig.phone.screen.kind).toBe("custom");
  });

  it("opens the list on the first name with Call; C returns to standby", () => {
    const rig = standbyRig({ sim: CONTENT });
    rig.press("down");
    rig.advance(100);
    expect(rig.phone.path).toBe("standby");
    rig.press("c");
    rig.advance(200);
    expect(rig.phone.screen).toMatchObject({ kind: "standby" });
  });
});

describe("the SIM in the phone's storage (D3)", () => {
  it("keeps an added name for the same SIM over the same storage, and not for another SIM", () => {
    const storage = createMemoryStorage();
    const first = standbyRig({ storage, sim: { id: "s" } });
    phoneBook(first, 3); // Add name
    type(first, "9 9 9 9 6 6 6 3 3"); // Zoe
    first.press("navi");
    first.advance(1500);
    type(first, "0 4");
    first.press("navi");
    first.advance(4000);
    expect(onScreen(first)).not.toContain("No phone");

    // The same SIM in a new phone: ▼ shows the list, not `No phone numbers`.
    const again = standbyRig({ storage, sim: { id: "s" } });
    again.press("down");
    again.advance(500);
    expect(again.phone.screen).toMatchObject({ kind: "custom", appId: "stock:phone-book" });
    again.advance(3500);
    expect(again.phone.screen.kind).toBe("custom");

    // Another SIM: its own (empty) phone book.
    const other = standbyRig({ storage, sim: { id: "t" } });
    other.press("down");
    other.advance(3500);
    expect(other.phone.screen).toMatchObject({ kind: "standby" });
  });

  it("reads a host's initial entries until the phone first writes that SIM", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({
      storage,
      sim: { id: "s", phoneBook: { entries: [{ name: "Ann", number: "1" }] } },
    });
    rig.press("down");
    rig.advance(3500);
    expect(rig.phone.screen.kind).toBe("custom");
    // Changed host entries for a SIM the phone has not written: the host's.
    const changed = standbyRig({ storage, sim: { id: "s" } });
    changed.press("down");
    changed.advance(3500);
    expect(changed.phone.screen).toMatchObject({ kind: "standby" });
  });
});

describe("Memory status (D14)", () => {
  it("counts the SIM's free and used locations", () => {
    const rig = standbyRig({ sim: CONTENT });
    phoneBook(rig, 8);
    rig.press("down");
    rig.advance(300);
    rig.press("navi");
    rig.advance(500);
    expectLcd(
      rig.paint(),
      goldenImage("phone-book/memory-content", "b"),
      "SIM card: / 27 free / 23 in use",
    );
  });
});

/** The content SIM's phone book over `storage`, as the phone reads it. */
function bookOf(storage: StockStorage): StockPhoneBook {
  return new StockPhoneBook(new StockEeprom(storage), normaliseSim(CONTENT));
}

describe("Erase (Task 8 E)", () => {
  it("erases the highlighted name: its speed dial goes, its location keeps its tone", () => {
    const storage = createMemoryStorage();
    const book = bookOf(storage);
    const first = book.entries()[0]!;
    book.assign(3, first.location);
    book.setTone(first.location, 5);
    const rig = standbyRig({ storage, sim: CONTENT });
    phoneBook(rig, 4); // Erase
    rig.press("navi"); // One by one
    rig.advance(1500);
    rig.press("navi"); // Erase on the first name
    rig.advance(500);
    rig.press("navi"); // OK on Erase?
    rig.advance(4000);
    const after = bookOf(storage);
    expect(after.at(first.location)).toBeUndefined();
    expect(after.isAssigned(3)).toBe(false);
    expect(after.tone(first.location)).toBe(5);
    expect(after.used()).toBe(book.used() - 1);
  });

  it("erases every name after the security code (factory: 12345)", () => {
    const storage = createMemoryStorage();
    createStockSettings(new StockEeprom(storage)).restoreFactory();
    const rig = standbyRig({ storage, sim: CONTENT });
    phoneBook(rig, 4);
    rig.press("down");
    rig.press("navi"); // Erase all
    rig.advance(500);
    rig.press("navi"); // OK on Are you sure?
    rig.advance(500);
    for (const digit of "12345") rig.press(digit as never);
    rig.press("navi");
    rig.advance(6000);
    expect(bookOf(storage).used()).toBe(0);
  });
});

describe("Edit (Task 8 D)", () => {
  /** Edit on anna (the second name), `annab`, OK, OK: Replace / Add. */
  function editAnna(rig: ReturnType<typeof standbyRig>): void {
    phoneBook(rig, 5);
    rig.press("down"); // anna
    rig.press("navi");
    rig.advance(500);
    type(rig, "2 2"); // b
    rig.press("navi");
    rig.advance(500);
    rig.press("navi");
    rig.advance(500);
  }

  it("Replace keeps the location: its tone follows the new name", () => {
    const storage = createMemoryStorage();
    const book = bookOf(storage);
    const anna = book.entries().find((entry) => entry.name === "anna")!;
    book.setTone(anna.location, 2);
    const rig = standbyRig({ storage, sim: CONTENT });
    editAnna(rig);
    rig.press("navi"); // Replace
    rig.advance(4000);
    const after = bookOf(storage);
    expect(after.at(anna.location)).toMatchObject({ name: "annab", number: anna.number });
    expect(after.tone(anna.location)).toBe(2);
  });

  it("Add keeps the old entry and saves the new name in the first free location", () => {
    const storage = createMemoryStorage();
    const used = bookOf(storage).used();
    const rig = standbyRig({ storage, sim: CONTENT });
    editAnna(rig);
    rig.press("down");
    rig.press("navi"); // Add
    rig.advance(4000);
    const after = bookOf(storage);
    expect(after.used()).toBe(used + 1);
    expect(after.entries().map((entry) => entry.name)).toEqual(
      expect.arrayContaining(["anna", "annab"]),
    );
  });
});

describe("Assign tone (Task 8 T)", () => {
  it("stores the chosen tone; Default clears it", () => {
    const storage = createMemoryStorage();
    const first = bookOf(storage).entries()[0]!;
    const rig = standbyRig({ storage, sim: CONTENT });
    phoneBook(rig, 6);
    rig.press("navi"); // Assign: the list on Default
    rig.advance(500);
    rig.press("down"); // Ring ring
    rig.press("navi");
    rig.advance(3000);
    expect(bookOf(storage).tone(first.location)).toBe(1);
    rig.press("navi"); // the list on Ring ring
    rig.advance(500);
    rig.press("up"); // Default
    rig.press("navi");
    rig.advance(3000);
    expect(bookOf(storage).tone(first.location)).toBeNull();
  });

  it("previews No tone as a 1750 Hz beep after the list's preview delay", () => {
    const rig = standbyRig({ sim: CONTENT });
    phoneBook(rig, 6);
    rig.press("navi");
    rig.advance(500);
    const seen = rig.sounds.length;
    rig.press("up"); // No tone
    rig.advance(1500);
    expect(rig.sounds.slice(seen)).toContainEqual(
      expect.objectContaining({ output: "tone", hz: 1750 }),
    );
  });
});

describe("Speed dials (Task 9 K)", () => {
  /** Menu, Phone book, Speed dials: Key 2. */
  function speedDials(rig: ReturnType<typeof standbyRig>): void {
    phoneBook(rig, 9);
  }

  it("assigns a name to a key, then Erase falls back to SIM location n", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage, sim: CONTENT });
    speedDials(rig);
    rig.press("down"); // Key 3 (Ben, SIM location 3)
    rig.press("navi"); // Assign: the list
    rig.advance(500);
    rig.press("navi"); // Select the first name
    rig.advance(3000);
    const first = bookOf(storage).entries()[0]!;
    expect(bookOf(storage).speedDial(3)).toEqual(first);
    rig.press("navi"); // Options
    rig.advance(300);
    rig.press("up"); // Erase (the list wraps)
    rig.press("navi");
    rig.advance(300);
    rig.press("navi"); // OK on Erase?
    rig.advance(4000);
    expect(bookOf(storage).isAssigned(3)).toBe(false);
    expect(bookOf(storage).speedDial(3)?.name).toBe("Ben");
  });

  it("stops the keys at the SIM's last location", () => {
    const sim: StockSimCard = {
      id: "small",
      phoneBook: { locations: 3, entries: [{ name: "Zed", number: "1" }] },
    };
    const rig = standbyRig({ sim });
    speedDials(rig);
    const key2 = rig.paint();
    rig.press("down"); // Key 3
    rig.press("down"); // Key 2 again
    rig.advance(100);
    expect(rig.paint().pixels).toEqual(key2.pixels);
  });

  it("goes to standby on a held C", () => {
    const rig = standbyRig({ sim: CONTENT });
    speedDials(rig);
    rig.press("c", 1200);
    rig.advance(500);
    expect(rig.phone.path).toBe("standby");
  });
});

describe("Voice tags (Task 9 G, D9)", () => {
  it("Start shows Please speak now, then Voice system error, then the list", () => {
    const rig = standbyRig({ sim: CONTENT });
    phoneBook(rig, 10);
    rig.press("navi"); // Add voice tag: the list
    rig.advance(500);
    const list = rig.paint().pixels;
    rig.press("navi"); // Press Start, then
    rig.advance(500);
    rig.press("navi"); // Start: Please speak now
    rig.advance(1000);
    expect(rig.paint().pixels).not.toEqual(list);
    const sounds = rig.sounds.length;
    rig.advance(1500); // Voice system error with its 675 Hz beeps
    expect(rig.sounds.slice(sounds)).toContainEqual(
      expect.objectContaining({ output: "tone", hz: 675 }),
    );
    rig.advance(3000);
    expect(rig.paint().pixels).toEqual(list);
  });
});
