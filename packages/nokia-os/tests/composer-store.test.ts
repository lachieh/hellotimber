// Plan 27 Task 5: the Composer's EEPROM record and slots (D7, D8, K13, Task 0 M).
import { describe, expect, it } from "vite-plus/test";
import { parseTokens } from "../src/composer/notation";
import { COMPOSER_RECORD, StockComposer, type ComposerTone } from "../src/composer/store";
import { createMemoryStorage, StockEeprom } from "../src/firmware/eeprom";
import { STOCK_RECORDS } from "../src/firmware/records";

const A: ComposerTone = { name: "A", tempo: 112, tokens: parseTokens("4c1 4d1 4e1") };
const B: ComposerTone = { name: "Bb tune", tempo: 225, tokens: parseTokens("16.#f2 8- 1c3") };

describe("COMPOSER_RECORD", () => {
  it("is registered with the phone's records", () => {
    expect(STOCK_RECORDS).toContain(COMPOSER_RECORD);
  });

  it("starts with seven empty slots (virgin) and Restore empties them (K13)", () => {
    expect(COMPOSER_RECORD.initial()).toEqual({ slots: Array(7).fill(null) });
    expect(COMPOSER_RECORD.factory!({ slots: [A, null, null, null, null, null, B] })).toEqual({
      slots: Array(7).fill(null),
    });
    expect(COMPOSER_RECORD.version).toBe(1);
  });

  it("stores tokens as their notation (the stored JSON)", () => {
    const storage = createMemoryStorage();
    const composer = new StockComposer(new StockEeprom(storage));
    composer.save(1, A);
    composer.save(7, B);
    expect(storage.getItem("nokia-os/composer")).toBe(
      '{"slots":[{"name":"A","tempo":112,"tokens":"4c1 4d1 4e1"},null,null,null,null,null,' +
        '{"name":"Bb tune","tempo":225,"tokens":"16.#f2 8- 1c3"}],"version":1}',
    );
  });

  it("drops a slot whose name, tempo or token is stale, and throws on a bad shape", () => {
    const decoded = COMPOSER_RECORD.decode(
      {
        slots: [
          { name: "A", tempo: 112, tokens: "4c1 4#e1" },
          { name: "", tempo: 112, tokens: "4c1" },
          { name: "A", tempo: 111, tokens: "4c1" },
          { name: "Sixteen letters!", tempo: 112, tokens: "4c1" },
          { name: "Ok", tempo: 40, tokens: "8- 2.g3" },
          null,
          7,
        ],
      },
      1,
    );
    expect(decoded.slots.map((s) => s?.name ?? null)).toEqual([
      null,
      null,
      null,
      null,
      "Ok",
      null,
      null,
    ]);
    expect(() => COMPOSER_RECORD.decode({ slots: [] }, 1)).toThrow(/7/);
    expect(() => COMPOSER_RECORD.decode([], 1)).toThrow(/slots/);
  });
});

describe("StockComposer", () => {
  it("saves at once: a second store over the same storage reads it back", () => {
    const storage = createMemoryStorage();
    new StockComposer(new StockEeprom(storage)).save(3, B);
    const again = new StockComposer(new StockEeprom(storage));
    expect(again.slot(3)).toEqual(B);
    expect(again.slot(1)).toBeNull();
    expect(() => again.slot(8)).toThrow(/slot 8/);
  });

  it("starts new tones at 112, then at the tempo last set or saved; a new phone at 112 (K13)", () => {
    const storage = createMemoryStorage();
    const composer = new StockComposer(new StockEeprom(storage));
    expect(composer.newTempo()).toBe(112);
    composer.setNewTempo(40);
    expect(composer.newTempo()).toBe(40);
    composer.save(1, B);
    expect(composer.newTempo()).toBe(225);
    expect(new StockComposer(new StockEeprom(storage)).newTempo()).toBe(112);
    expect(() => composer.setNewTempo(111)).toThrow(/111/);
  });

  it("labels and sounds Ringing tone options 35-41 by slots 1-7 (D8)", () => {
    const composer = new StockComposer(new StockEeprom(createMemoryStorage()));
    composer.save(1, A);
    composer.save(7, B);
    expect(composer.ringingToneLabel(35)).toBe("A");
    expect(composer.ringingToneLabel(41)).toBe("Bb tune");
    expect(composer.ringingToneLabel(36)).toBeUndefined();
    expect(composer.ringingToneLabel(34)).toBeUndefined();
    expect(composer.ringingToneLabel(42)).toBeUndefined();
    expect(composer.userRingingTone(35)?.name).toBe("A");
    expect(composer.userRingingTone(35)?.slug).toBe("composer-1");
    expect(composer.userRingingTone(36)).toBeUndefined();
    expect(composer.userRingingTone(12)).toBeUndefined();
  });

  it("refuses to save what is not a tone", () => {
    const composer = new StockComposer(new StockEeprom(createMemoryStorage()));
    expect(() => composer.save(1, { ...A, tokens: [] })).toThrow(/not a tone/);
    expect(() => composer.save(1, { ...A, name: "" })).toThrow(/not a tone/);
  });

  it("is emptied by Restore factory settings", () => {
    const eeprom = new StockEeprom(createMemoryStorage());
    const composer = new StockComposer(eeprom);
    composer.save(2, A);
    eeprom.restoreFactory();
    expect(composer.slot(2)).toBeNull();
  });
});
