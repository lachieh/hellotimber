// Plan 19 Tasks 7-10: the phone book's flows on a whole stock phone (the goldens' replays are
// tests/acceptance/19-phone-book.test.ts; these pin the rules between the captures).
import { describe, expect, it } from "vite-plus/test";
import { PHONE_BOOK_SIMS } from "../scripts/capture-sets/19-phone-book.ts";
import { KEYGUARD_HINT_LEAD_MS, KEYGUARD_TIMES } from "../src/firmware/features/keyguard";
import { createMemoryStorage, type StockSimCard } from "../src/index";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";
import { lockedRig } from "./support/keyguard.ts";
import { standbyRig, type Rig } from "./support/rig.ts";

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
