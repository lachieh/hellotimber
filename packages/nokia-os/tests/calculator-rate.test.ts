// Plan 20 Task 4: the exchange-rate record (D6) and the rate entry (D7). Expected values are the
// `calculator/rate-*`, `calculator/convert` and `calculator/persist` stills' text.
import { describe, expect, it } from "vite-plus/test";
import { CalculatorRate, CALCULATOR_RECORD } from "../src/calculator/rate";
import {
  openRateEntry,
  pressRateKey,
  clearRateEntry,
  rateToSave,
  type RateEntry,
  type RateKey,
} from "../src/calculator/rate-entry";
import { StockEeprom, createMemoryStorage, type StockStorage } from "../src/firmware/eeprom";
import { STOCK_RECORDS } from "../src/firmware/records";

function rateOn(storage: StockStorage = createMemoryStorage()): CalculatorRate {
  return new CalculatorRate(new StockEeprom(storage));
}

describe("CALCULATOR_RECORD (D6)", () => {
  it("is one of the phone's records, under nokia-os/calculator", () => {
    expect(STOCK_RECORDS).toContain(CALCULATOR_RECORD);
    expect(CALCULATOR_RECORD.name).toBe("calculator");
    expect(CALCULATOR_RECORD.version).toBe(1);
  });

  it("starts virgin at Foreign 0 and stores the typed rate with its direction", () => {
    expect(CALCULATOR_RECORD.initial()).toEqual({ direction: "foreign", rate: "0" });
    const storage = createMemoryStorage();
    rateOn(storage).set("domestic", "3");
    expect(storage.getItem("nokia-os/calculator")).toBe(
      '{"direction":"domestic","rate":"3","version":1}',
    );
  });

  it("decodes its shape, drops stale fields and rejects a bad rate", () => {
    expect(CALCULATOR_RECORD.decode({ direction: "domestic", rate: "1.5", old: 1 }, 1)).toEqual({
      direction: "domestic",
      rate: "1.5",
    });
    expect(() => CALCULATOR_RECORD.decode({ direction: "up", rate: "1" }, 1)).toThrow();
    expect(() => CALCULATOR_RECORD.decode({ direction: "foreign", rate: "-1" }, 1)).toThrow();
    expect(() => CALCULATOR_RECORD.decode({ direction: "foreign", rate: "1.2.3" }, 1)).toThrow();
    expect(() => CALCULATOR_RECORD.decode("x", 1)).toThrow();
  });

  it("survives a new phone over the same storage (persist/boot-*)", () => {
    const storage = createMemoryStorage();
    rateOn(storage).set("foreign", "1.5");
    expect(rateOn(storage).shown("foreign")).toBe("1.5");
    expect(rateOn(storage).shown("domestic")).toBe("0.6666667");
  });

  it("resets to 1 in both directions on Restore factory settings, from either direction", () => {
    for (const [direction, value] of [
      ["domestic", "2"],
      ["foreign", "1.5"],
    ] as const) {
      const eeprom = new StockEeprom(createMemoryStorage());
      const rate = new CalculatorRate(eeprom);
      rate.set(direction, value);
      eeprom.restoreFactory();
      expect(rate.shown("foreign")).toBe("1");
      expect(rate.shown("domestic")).toBe("1");
    }
  });
});

describe("CalculatorRate", () => {
  it("shows virgin Foreign 0 and an empty Domestic prompt", () => {
    const rate = rateOn();
    expect(rate.shown("foreign")).toBe("0");
    expect(rate.shown("domestic")).toBe("");
  });

  it("shows the reciprocal in the other direction (rate/after/*)", () => {
    const rate = rateOn();
    rate.set("domestic", "2");
    expect(rate.shown("foreign")).toBe("0.5");
    rate.set("domestic", "3");
    expect(rate.shown("foreign")).toBe("0.3333333");
    expect(rate.shown("domestic")).toBe("3");
  });

  it("saves an empty or point-only entry as zero (rate/keys/ok-*)", () => {
    const rate = rateOn();
    rate.set("foreign", "");
    expect(rate.shown("foreign")).toBe("0");
    expect(rate.shown("domestic")).toBe("");
    rate.set("foreign", ".");
    expect(rate.shown("foreign")).toBe("0");
  });

  it.each([
    ["foreign", "1.5", "10", "15", "6.6666667"],
    ["foreign", "1.5", "15", "22.5", "10"],
    ["foreign", "1.5", "0.5", "0.75", "0.3333333"],
    ["domestic", "2", "10", "5", "20"],
    ["domestic", "2", "5", "2.5", "10"],
    // Domestic 3 converts with the typed 3, not the shown 0.3333333 (3.333333).
    ["domestic", "3", "10", "3.3333333", "30"],
    ["domestic", "3", "1", "0.3333333", "3"],
    ["foreign", "3", "10", "30", "3.3333333"],
    ["foreign", "100", "1", "100", "0.01"],
    ["foreign", "0.5", "0.0000001", "0.0000001", "0.0000002"],
    ["foreign", "0.5", "3", "1.5", "6"],
  ] as const)(
    "%s %s: %s is %s in domestic, %s in foreign",
    (direction, value, amount, home, away) => {
      const rate = rateOn();
      rate.set(direction, value);
      expect(rate.convert(amount, "domestic")).toEqual({ ok: home });
      expect(rate.convert(amount, "foreign")).toEqual({ ok: away });
    },
  );

  it("converts at the virgin rate 0 and overflows (convert/rate-0-*, foreign-100-99999999-*)", () => {
    expect(rateOn().convert("10", "domestic")).toEqual({ ok: "0" });
    expect(rateOn().convert("10", "foreign")).toEqual({ error: "divide-by-zero" });
    const rate = rateOn();
    rate.set("foreign", "100");
    expect(rate.convert("99999999", "domestic")).toEqual({ error: "out-of-range" });
    expect(rate.convert("99999999", "foreign")).toEqual({ ok: "999999.99" });
  });
});

/** Keys from the prompt opened on `shown`; the text and cursor after them. */
function keys(shown: string, sequence: readonly RateKey[]): RateEntry {
  return sequence.reduce(pressRateKey, openRateEntry(shown));
}
const digits = (text: string): RateKey[] =>
  text.split("").map((ch) => (ch === "." ? "#" : ch) as RateKey);

describe("rate entry (D7)", () => {
  it("opens on the shown value with the cursor at its end", () => {
    expect(openRateEntry("0.6666667")).toEqual({ text: "0.6666667", cursor: 9, prefilled: true });
    expect(openRateEntry("")).toEqual({ text: "", cursor: 0, prefilled: false });
  });

  it.each([
    ["0", digits("5"), "5"],
    ["0", digits("0"), "0"],
    ["0", ["#"], "."],
    ["0", ["#", "#"], "."],
    ["0", digits("1.5"), "1.5"],
    ["0", [...digits("1.5"), "#", "2"], "1.52"],
    ["0", [...digits("1.5"), "c"], "1."],
    ["0", [...digits("1.5"), "c", "c"], "1"],
    ["0", [...digits("1.5"), "c", "c", "c"], ""],
    ["0", ["c"], ""],
    ["0", digits("123456789012"), "1234567"],
    ["0", digits("1.123456789"), "1.12345"],
    ["0", digits("0.123456789"), "0.12345"],
    ["1.5", ["7"], "7"],
    ["1.5", ["#"], "."],
    ["0.6666667", ["4"], "4"],
    ["0.6666667", ["c"], "0.666666"],
    ["0.6666667", ["c", "c"], "0.66666"],
    ["0", [...digits("1"), "*"], "1"],
  ] as const)("%s, %j: %s", (shown, sequence, text) => {
    expect(keys(shown, sequence).text).toBe(text);
  });

  it("moves the cursor with ▲ (to the right, wrapping from the end to the start) and ▼", () => {
    const typed = digits("123");
    expect(keys("0", [...typed, "up"]).cursor).toBe(0);
    expect(keys("0", [...typed, "up", "4"])).toMatchObject({ text: "4123", cursor: 1 });
    expect(keys("0", [...typed, "up", "up", "4"])).toMatchObject({ text: "1423", cursor: 2 });
    expect(keys("0", [...typed, "up", "up", "up", "c"])).toMatchObject({ text: "13", cursor: 1 });
    expect(keys("0", [...typed, "up", "up", "up", "up"]).cursor).toBe(3);
    expect(keys("0", [...typed, "up", "c"])).toMatchObject({ text: "123", cursor: 0 });
    expect(keys("0", [...typed, "up", "down"]).cursor).toBe(3);
    expect(keys("0", [...typed, "down"]).cursor).toBe(2);
  });

  it("rejects an insertion at seven typed characters (rate/keys/limit-insert)", () => {
    expect(keys("0", [...digits("1234567"), "up", "8"]).text).toBe("1234567");
  });

  it("clears to an empty field when C is held, and saves empty or . as zero", () => {
    expect(clearRateEntry()).toEqual({ text: "", cursor: 0, prefilled: false });
    expect(pressRateKey(clearRateEntry(), "7").text).toBe("7");
    expect(rateToSave(clearRateEntry())).toBe("0");
    expect(rateToSave(keys("0", ["#"]))).toBe("0");
    expect(rateToSave(keys("0", digits("1.5")))).toBe("1.5");
  });
});
