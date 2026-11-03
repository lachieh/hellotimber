// Plan 30 Task 8: the host's IMEI (D9) and the phone-memory preload (D10).
import { describe, expect, it } from "vite-plus/test";
import { StockEeprom } from "../src/firmware/eeprom";
import { WELCOME_NOTE_KEY } from "../src/kit/system/boot";
import { StockReminders } from "../src/firmware/features/reminders/store";
import { checkImei } from "../src/firmware/preload";
import { createStockSettings } from "../src/firmware/settings";
import { SNAKE_SETTINGS } from "../src/widgets/snake";
import {
  createMemoryStorage,
  createStockPhone,
  describeStockScreen,
  stockImeiLines,
  type StockPhoneConfig,
  type StockStorage,
} from "../src/index";

const phone = (config: Partial<StockPhoneConfig>) =>
  createStockPhone({ carrier: "Orange F", boot: "skip", ...config });

describe("imei (D9)", () => {
  it("takes 15 digits with a valid Luhn check digit (Task 0 I: 490154203310018)", () => {
    expect(checkImei("490154203310018")).toBe("490154203310018");
    expect(() => phone({ imei: "490154203310018" })).not.toThrow();
  });

  it("refuses anything else, naming the field", () => {
    expect(() => phone({ imei: "490154203310019" })).toThrow(
      "imei 490154203310019 fails its Luhn check digit.",
    );
    expect(() => phone({ imei: "49015420331001" })).toThrow(/imei must be 15 digits/);
    expect(() => phone({ imei: "49015420331001X" })).toThrow(/imei must be 15 digits/);
  });

  it("splits as *#06# shows it: Serial No. over ten digits, then five (Task 0 I)", () => {
    expect(stockImeiLines("490154203310018")).toEqual(["4901542033", "10018"]);
    expect(() => stockImeiLines("123")).toThrow(/imei must be 15 digits/);
  });

  it("is what *#06# shows (plan 22's page), the virgin `?` glyphs without one", () => {
    const shown = (imei?: string) => {
      const p = phone(imei === undefined ? {} : { imei });
      p.pressKey("power", 1000);
      for (let t = 1000; t <= 3000; t += 10) p.tick(t);
      let t = 3000;
      for (const key of ["*", "#", "0", "6", "#"] as const) {
        p.pressKey(key);
        for (const end = t + 400; t < end; t += 10) p.tick(t);
      }
      return describeStockScreen(p.screen);
    };
    expect(shown("490154203310018")).toBe("Note: Serial No. 4901542033 10018");
    expect(shown()).toBe("Note: Serial No. ???????????? ??4");
  });
});

const note = (storage: StockStorage) =>
  createStockSettings(new StockEeprom(storage)).text(WELCOME_NOTE_KEY);
/** The stored reminders in the order they were added. */
const reminders = (storage: StockStorage) =>
  [...new StockReminders(new StockEeprom(storage)).list()]
    .sort((a, b) => a.added - b.added)
    .map((r) => [r.text, r.alarm]);

describe("preload (D10)", () => {
  it("writes the Welcome note when storage has no settings record (power-on shows it: plan 15)", () => {
    const storage = createMemoryStorage();
    phone({ storage, preload: { welcomeNote: "Hello from Lachlan" } });
    expect(note(storage)).toBe("Hello from Lachlan");
  });

  it("never writes over a stored note, nor after Erase (the record exists without the key)", () => {
    const stored = createMemoryStorage();
    createStockSettings(new StockEeprom(stored)).setText(WELCOME_NOTE_KEY, "Mine");
    phone({ storage: stored, preload: { welcomeNote: "Host" } });
    expect(note(stored)).toBe("Mine");
    const erased = createMemoryStorage();
    const settings = createStockSettings(new StockEeprom(erased));
    settings.setText(WELCOME_NOTE_KEY, "Mine");
    settings.setText(WELCOME_NOTE_KEY, undefined);
    phone({ storage: erased, preload: { welcomeNote: "Host" } });
    expect(note(erased)).toBeUndefined();
  });

  it("adds the reminders in order when there is no reminders record, never otherwise", () => {
    const storage = createMemoryStorage();
    phone({
      storage,
      preload: {
        reminders: [
          { text: "Call Ann" },
          { text: "Ship it", alarm: { date: "14.10.2026", time: "09:30" } },
        ],
      },
    });
    expect(reminders(storage)).toEqual([
      ["Call Ann", null],
      ["Ship it", { year: 2026, month: 10, day: 14, hour: 9, minute: 30 }],
    ]);
    // A second creation over the same storage changes nothing (the record exists now).
    phone({ storage, preload: { reminders: [{ text: "Again" }] } });
    expect(reminders(storage)).toHaveLength(2);
    // Nor does a record the visitor emptied.
    const emptied = createMemoryStorage();
    const store = new StockReminders(new StockEeprom(emptied));
    store.add("x", null);
    store.erase(store.list()[0]!);
    phone({ storage: emptied, preload: { reminders: [{ text: "Host" }] } });
    expect(reminders(emptied)).toEqual([]);
  });

  it("stores Snake II's level while the level was never written, as the Level page would", () => {
    const level = (storage: StockStorage) =>
      createStockSettings(new StockEeprom(storage)).number(SNAKE_SETTINGS.level);
    const storage = createMemoryStorage();
    phone({ storage, preload: { snakeLevel: 5 } });
    expect(level(storage)).toBe(5);
    // Without it, the virgin EEPROM's 175 (snake-ii.md: the snake moves every timer unit).
    expect(level(createMemoryStorage())).toBe(175);
    // A level the visitor stored stays, even 175's neighbour ▼ reaches.
    const stored = createMemoryStorage();
    createStockSettings(new StockEeprom(stored)).setNumber(SNAKE_SETTINGS.level, 174);
    phone({ storage: stored, preload: { snakeLevel: 5 } });
    expect(level(stored)).toBe(174);
    // Other settings written first do not stop it.
    const other = createMemoryStorage();
    createStockSettings(new StockEeprom(other)).setText(WELCOME_NOTE_KEY, "Mine");
    phone({ storage: other, preload: { snakeLevel: 3 } });
    expect(level(other)).toBe(3);
    // Nor does it stop the Welcome note, which needs no settings record.
    const both = createMemoryStorage();
    phone({ storage: both, preload: { welcomeNote: "Hi", snakeLevel: 5 } });
    expect([note(both), level(both)]).toEqual(["Hi", 5]);
  });

  it("refuses a Snake II level the Level page cannot store (1 to 9)", () => {
    expect(() => phone({ preload: { snakeLevel: 0 } })).toThrow(
      "preload.snakeLevel must be a whole number from 1 to 9 (received 0).",
    );
    expect(() => phone({ preload: { snakeLevel: 10 } })).toThrow(/preload\.snakeLevel/);
    expect(() => phone({ preload: { snakeLevel: 2.5 } })).toThrow(/preload\.snakeLevel/);
    expect(() => phone({ preload: { snakeLevel: 9 } })).not.toThrow();
  });

  it("refuses what no editor could have typed, naming the field", () => {
    expect(() => phone({ preload: { welcomeNote: "a".repeat(37) } })).toThrow(
      "preload.welcomeNote has 37 characters, more than its 36.",
    );
    expect(() => phone({ preload: { welcomeNote: "a".repeat(36) } })).not.toThrow();
    expect(() => phone({ preload: { welcomeNote: "Δelta" } })).toThrow(
      'preload.welcomeNote has characters no key types: "Δ".',
    );
    expect(() => phone({ preload: { reminders: [{ text: "a".repeat(36) }] } })).toThrow(
      "preload.reminders[0].text has 36 characters, more than its 35.",
    );
    const eleven = Array.from({ length: 11 }, (_, i) => ({ text: `R${i}` }));
    expect(() => phone({ preload: { reminders: eleven } })).toThrow(
      "preload.reminders has 11 reminders, more than the phone's 10.",
    );
    expect(() =>
      phone({
        preload: { reminders: [{ text: "x", alarm: { date: "31.02.2026", time: "10:00" } }] },
      }),
    ).toThrow(/preload.reminders\[0\].alarm must be a real date/);
    expect(() =>
      phone({
        preload: { reminders: [{ text: "x", alarm: { date: "14.10.2026", time: "9:00" } }] },
      }),
    ).toThrow(/alarm must be a real date "DD.MM.YYYY" and time "HH:MM"/);
  });

  it("writes nothing when the preload is invalid (checked before anything is written)", () => {
    const storage = createMemoryStorage();
    expect(() =>
      phone({ storage, preload: { welcomeNote: "ok", reminders: [{ text: "" }] } }),
    ).toThrow(/preload.reminders\[0\].text must be a non-empty string/);
    expect(note(storage)).toBeUndefined();
  });
});
