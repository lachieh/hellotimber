// Plan 30 Task 4: SMS stored on the SIM card (D2, Task 0 M): the GSM 7-bit alphabet, the
// validation of `StockSimCard.messages`, and the store that shows the SIM's messages until the
// phone first writes them.
import { describe, expect, it } from "vite-plus/test";
import { SIM_CONTENT_SIMS } from "../scripts/capture-sets/30-sim-content.ts";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import { MESSAGES_RECORD, StockMessages } from "../src/messages/store";
import { normaliseSim } from "../src/phone-book/sim-card";
import { gsmSeptets, simMessagesProblem, smsDrawn } from "../src/sim/messages";
import {
  createMemoryStorage,
  createStockPhone,
  STOCK_STORAGE_PREFIX,
  type StockSimCard,
  type StockTimestamp,
} from "../src/index";
import { standbyRig } from "./support/rig.ts";

const STAMP: StockTimestamp = { year: 2026, month: 10, day: 13, hour: 8, minute: 5, second: 0 };
const message = (number: string, text: string, read?: boolean) => ({
  number,
  text,
  sentAt: STAMP,
  ...(read === undefined ? {} : { read }),
});

const card = (messages: StockSimCard["messages"], id = "sim-1"): StockSimCard => ({ id, messages });

describe("gsmSeptets", () => {
  it("counts the default alphabet one septet a character", () => {
    expect(gsmSeptets("Hello @£$¥ èé ÄÖÑÜ§¿ äöñüà ΔΦΓΛΩΠΨΣΘΞ ÆæßÉ ¤ ¡")).toBe(46);
    expect(gsmSeptets("")).toBe(0);
  });

  it("counts the extension table two septets a character", () => {
    expect(gsmSeptets("€")).toBe(2);
    expect(gsmSeptets("[]{}~|^\\")).toBe(16);
    expect(gsmSeptets("Ext: 5€ [a] {b} ~c | d ^e \\f")).toBe(37);
  });

  it("is undefined for a character outside both tables", () => {
    expect(gsmSeptets("café")).toBe(4);
    expect(gsmSeptets("naïve")).toBeUndefined();
    expect(gsmSeptets("`")).toBeUndefined();
    expect(gsmSeptets("😀")).toBeUndefined();
  });
});

describe("smsDrawn", () => {
  it("draws the extension characters the 3310 lacks as ? (sms/read/2: € and \\ draw)", () => {
    expect(smsDrawn("Ext: 5€ [a] {b} ~c | d ^e \\f")).toBe("Ext: 5€ ?a? ?b? ?c ? d ?e \\f");
  });
});

describe("StockSimCard.messages", () => {
  it("defaults to the emulator SIM's 15 empty slots", () => {
    expect(normaliseSim("sim-1").messages).toEqual({ slots: 15, entries: [] });
    expect(normaliseSim({ id: "sim-1" }).messages).toEqual({ slots: 15, entries: [] });
  });

  it("fills in each message's defaults (read, no centre) and keeps free slots", () => {
    const sim = normaliseSim(
      card({
        slots: 10,
        entries: [null, message("+61400000001", "Hi"), message("0400", "x", false)],
      }),
    );
    expect(sim.messages).toEqual({
      slots: 10,
      entries: [
        null,
        { number: "+61400000001", text: "Hi", sentAt: STAMP, read: true, centre: "" },
        { number: "0400", text: "x", sentAt: STAMP, read: false, centre: "" },
      ],
    });
  });

  it("takes any number of slots (Task 0 M: the capacity follows the SIM)", () => {
    expect(normaliseSim(card({ slots: 255 })).messages.slots).toBe(255);
  });

  it("accepts 160 septets and refuses 161", () => {
    expect(simMessagesProblem({ entries: [message("1", "a".repeat(160))] }, "S")).toBeUndefined();
    expect(simMessagesProblem({ entries: [message("1", `${"a".repeat(158)}€`)] }, "S")).toBe(
      undefined,
    );
    expect(() => normaliseSim(card({ entries: [message("1", `${"a".repeat(159)}€`)] }))).toThrow(
      'SIM card "sim-1": messages.entries[0].text takes 161 septets, more than one SMS\'s 160.',
    );
    expect(simMessagesProblem({ entries: [message("1", "a".repeat(161))] }, "S")).toBe(
      "S: messages.entries[0].text takes 161 septets, more than one SMS's 160.",
    );
  });

  it("refuses characters outside the GSM alphabet or the small face, naming them", () => {
    expect(() => normaliseSim(card({ entries: [message("1", "naïve")] }))).toThrow(
      'SIM card "sim-1": messages.entries[0].text has characters outside the GSM 7-bit alphabet: "ï".',
    );
    // In the alphabet, but the stock small font has no glyph.
    expect(() => normaliseSim(card({ entries: [null, message("1", "ΔΦ")] }))).toThrow(
      'SIM card "sim-1": messages.entries[1].text has characters the stock small font lacks: "Δ", "Φ".',
    );
  });

  it("refuses bad slots, numbers, time stamps, read flags and centres, naming the field", () => {
    const bad = (messages: unknown) => () =>
      normaliseSim({ id: "sim-1", messages } as unknown as StockSimCard);
    expect(bad({ slots: 0 })).toThrow(
      'SIM card "sim-1": messages.slots must be a positive integer',
    );
    expect(bad({ slots: 2.5 })).toThrow(/messages.slots must be a positive integer/);
    expect(bad({ slots: 1, entries: [null, null] })).toThrow(
      'SIM card "sim-1": messages.entries has 2 entries for 1 slots.',
    );
    expect(bad({ entries: {} })).toThrow(/messages.entries must be an array/);
    expect(bad({ entries: [5] })).toThrow(/messages.entries\[0\] must be a message or null/);
    expect(bad({ entries: [message("", "x")] })).toThrow(
      /entries\[0\].number "" must be 1-20 digits/,
    );
    expect(bad({ entries: [message("*100#", "x")] })).toThrow(/entries\[0\].number "\*100#"/);
    expect(bad({ entries: [message("1".repeat(21), "x")] })).toThrow(/number/);
    expect(bad({ entries: [{ ...message("1", "x"), sentAt: { ...STAMP, month: 13 } }] })).toThrow(
      /messages.entries\[0\].sentAt.month must be an integer 1-12 \(received 13\)/,
    );
    expect(bad({ entries: [{ number: "1", text: "x" }] })).toThrow(/sentAt must be a time stamp/);
    expect(bad({ entries: [{ ...message("1", "x"), read: "yes" }] })).toThrow(
      /read must be a boolean/,
    );
    expect(bad({ entries: [{ ...message("1", "x"), centre: "SMSC" }] })).toThrow(/centre "SMSC"/);
  });

  it("accepts every SIM fixture Task 0 captured with (SIM_CONTENT_SIMS)", () => {
    for (const [name, sim] of Object.entries(SIM_CONTENT_SIMS)) {
      expect(() => normaliseSim(sim as StockSimCard), name).not.toThrow();
    }
  });

  it("throws from createStockPhone for an invalid SIM message", () => {
    expect(() =>
      createStockPhone({ carrier: "Orange F", sim: card({ entries: [message("1", "`")] }) }),
    ).toThrow(/messages.entries\[0\].text/);
  });
});

/** The `sms` fixture: unread in slots 2, 3, 7; read in 1, 5, 9. */
const SMS = SIM_CONTENT_SIMS.sms as StockSimCard;

describe("the SIM's messages in the store", () => {
  const storeOf = (sim: StockSimCard = SMS, storage = createMemoryStorage()) =>
    new StockMessages(new StockEeprom(storage), normaliseSim(sim));

  it("lists unread messages first, then read ones, each in slot order (Task 0 M, sms/order)", () => {
    const order = storeOf(SIM_CONTENT_SIMS.order as StockSimCard);
    expect(order.inbox().map((m) => m.text)).toEqual([
      "Old unread",
      "New unread",
      "Oldest unread",
      "New read",
      "Old read",
      "Newest read",
    ]);
    expect(
      storeOf()
        .inbox()
        .map((m) => m.slot),
    ).toEqual([2, 3, 7, 1, 5, 9]);
    expect(storeOf().unread()).toBe(3);
  });

  it("writes nothing until the phone first changes the messages, then stores them all", () => {
    const storage = createMemoryStorage();
    const store = storeOf(SMS, storage);
    expect(store.inbox()).toHaveLength(6);
    expect(storage.getItem(`${STOCK_STORAGE_PREFIX}messages`)).toBeNull();
    store.markRead(2);
    const stored = new StockEeprom(storage).read(MESSAGES_RECORD).sims["sim-1"]!;
    expect(stored.inbox.map((m) => m.slot)).toEqual([1, 2, 3, 5, 7, 9]);
    expect(stored.inbox.find((m) => m.slot === 2)!.read).toBe(true);
    // From now on the record is the SIM's contents: another phone sees the read flag.
    expect(storeOf(SMS, storage).unread()).toBe(2);
  });

  it("keeps the stored copy over the host's messages (D2: plan 19 D3's rule)", () => {
    const storage = createMemoryStorage();
    storeOf(SMS, storage).erase("inbox", 1);
    const changed = card({ entries: [message("0499", "the host's new text")] });
    expect(
      storeOf(changed, storage)
        .inbox()
        .map((m) => m.text),
    ).not.toContain("the host's new text");
    expect(storeOf(SMS, storage).inbox()).toHaveLength(5);
  });

  it("keeps each SIM identity's messages apart", () => {
    const storage = createMemoryStorage();
    storeOf(SMS, storage).erase("inbox", 9);
    const other = storeOf({ ...SMS, id: "sim-2" }, storage);
    expect(other.inbox()).toHaveLength(6);
  });

  it("gives an arrival the first free slot, listed among the unread by it", () => {
    const store = storeOf();
    expect(store.receive({ number: "0400000002", text: "new", sentAt: STAMP })).toBe("stored");
    expect(store.inbox().map((m) => m.slot)).toEqual([2, 3, 4, 7, 1, 5, 9]);
  });

  it("holds as many messages as the SIM has slots (Task 0 M: 10, 15 and 30)", () => {
    for (const name of ["slots10", "slots15", "slots30"] as const) {
      const store = storeOf(SIM_CONTENT_SIMS[name] as StockSimCard);
      const slots = SIM_CONTENT_SIMS[name].messages.slots;
      expect(store.slots).toBe(slots);
      expect(store.full()).toBe(false);
      expect(store.receive({ number: "1", text: "last slot", sentAt: STAMP })).toBe("stored");
      expect(store.full()).toBe(true);
      expect(store.receive({ number: "2", text: "no room", sentAt: STAMP })).toBe("full");
      expect(store.save("no room")).toBe("full");
      expect(store.inbox()).toHaveLength(slots);
      expect(store.inbox()[0]!.text).toBe("last slot");
    }
  });

  it("keeps the SIM's messages over Restore factory settings (Task 0 M)", () => {
    const eeprom = new StockEeprom(createMemoryStorage());
    const store = new StockMessages(eeprom, normaliseSim(SMS));
    store.markRead(3);
    createStockSettings(eeprom).restoreFactory();
    expect(store.inbox()).toHaveLength(6);
    expect(store.unread()).toBe(2);
  });
});

describe("power-on with SIM messages (Task 0 M, sms/boot)", () => {
  it("shows the standby envelope for unread SIM messages, with no notice and no tone", () => {
    const rig = standbyRig({ sim: SMS });
    const screen = rig.phone.screen;
    expect(screen).toMatchObject({ kind: "standby", indicators: { message: true } });
    expect(screen).not.toHaveProperty("notice");
    // No message alert (factory or virgin, Task 0 M): the buzzer stays silent.
    expect(rig.sounds.filter((event) => event.output === "buzzer")).toEqual([]);
  });

  it("shows no envelope when every SIM message is read", () => {
    const rig = standbyRig({ sim: SIM_CONTENT_SIMS.smsread as StockSimCard });
    expect(rig.phone.screen).toMatchObject({ kind: "standby" });
    expect(rig.phone.screen).not.toHaveProperty("indicators.message");
  });
});
