// Plan 18c Task 4: the templates, smileys and Info topics records over host storage.
import { describe, expect, it } from "vite-plus/test";
import { StockEeprom } from "../src/firmware/eeprom";
import { createMemoryStorage, STOCK_STORAGE_PREFIX } from "../src/index";
import {
  SMILEYS_RECORD,
  StockTextSlots,
  STOCK_SMILEYS,
  STOCK_TEMPLATES,
  TEMPLATES_RECORD,
  TEXT_SLOTS,
} from "../src/content/slots";
import { INFO_TOPICS_RECORD, StockTopics, TOPIC_CAPACITY } from "../src/content/topics";

const RECORDS = [TEMPLATES_RECORD, SMILEYS_RECORD, INFO_TOPICS_RECORD] as const;

function eeprom(storage = createMemoryStorage()) {
  return { storage, eeprom: new StockEeprom(storage, [...RECORDS]) };
}

describe("text slots (Templates 2-5, Smileys 2-6)", () => {
  it("are absent on the virgin EEPROM: no list (`restore/virgin-templates`)", () => {
    const templates = new StockTextSlots(eeprom().eeprom, "templates");
    expect(templates.provisioned).toBe(false);
    expect(templates.list()).toEqual([]);
  });

  it("show eight slots after Restore: five ROM defaults, then (empty) (`restore/templates`)", () => {
    const { eeprom: e } = eeprom();
    e.restoreFactory();
    const templates = new StockTextSlots(e, "templates");
    expect(templates.provisioned).toBe(true);
    expect(templates.list()).toEqual([...STOCK_TEMPLATES, null, null, null]);
    expect(new StockTextSlots(e, "smileys").list()).toEqual([...STOCK_SMILEYS, null, null, null]);
    expect(TEXT_SLOTS).toBe(8);
  });

  it("hold the measured defaults, trailing spaces included (the editors' counters)", () => {
    // `templates/edit/01`-`05`: 58, 46, 46, 27, 40 characters left of 70.
    expect(STOCK_TEMPLATES.map((text) => 70 - Array.from(text).length)).toEqual([
      58, 46, 46, 27, 40,
    ]);
    expect(STOCK_SMILEYS).toEqual([":-)", ":-(", ":-/", ";o)", ";oD"]);
  });

  it("store an edit at once; Erase brings the slot's default back (`content/templates-edited`)", () => {
    const { storage, eeprom: e } = eeprom();
    e.restoreFactory();
    const templates = new StockTextSlots(e, "templates");
    templates.save(0, "Please call a");
    templates.save(5, "Ok");
    expect(templates.text(0)).toBe("Please call a");
    expect(templates.text(5)).toBe("Ok");
    const reread = new StockTextSlots(new StockEeprom(storage, [...RECORDS]), "templates");
    expect(reread.text(0)).toBe("Please call a");
    reread.erase(0);
    reread.erase(5);
    expect(reread.text(0)).toBe(STOCK_TEMPLATES[0]);
    expect(reread.text(5)).toBeNull();
  });

  it("go back to the defaults on Restore (`content/restore-edited-after-5`)", () => {
    const { eeprom: e } = eeprom();
    e.restoreFactory();
    const smileys = new StockTextSlots(e, "smileys");
    smileys.save(0, ":-)a");
    smileys.save(5, "Ok");
    e.restoreFactory();
    expect(smileys.list()).toEqual([...STOCK_SMILEYS, null, null, null]);
  });

  it("write a versioned record and reject a malformed one", () => {
    const { storage, eeprom: e } = eeprom();
    e.restoreFactory();
    new StockTextSlots(e, "templates").save(6, "Hi");
    expect(JSON.parse(storage.getItem(`${STOCK_STORAGE_PREFIX}templates`)!)).toEqual({
      slots: [null, null, null, null, null, null, "Hi", null],
      version: 1,
    });
    storage.setItem(`${STOCK_STORAGE_PREFIX}templates`, '{"version":1,"slots":[1]}');
    expect(() => new StockEeprom(storage, [...RECORDS])).toThrow(/templates/);
  });
});

describe("Info service topics (2-8-4)", () => {
  it("hold the virgin EEPROM's five junk topics (plan 14's box-glyph goldens)", () => {
    const topics = new StockTopics(eeprom().eeprom);
    expect(topics.list().map((t) => t.number)).toEqual(["", "", "", "p9", ""]);
    expect(topics.list().every((t) => t.name === "\uE000".repeat(6))).toBe(true);
    expect(topics.full()).toBe(true);
    expect(TOPIC_CAPACITY).toBe(5);
  });

  it("are empty after Restore (`content/restore-topics`)", () => {
    const { eeprom: e } = eeprom();
    e.restoreFactory();
    expect(new StockTopics(e).list()).toEqual([]);
  });

  it("add at the end, edit, mark and erase, written at once", () => {
    const { storage, eeprom: e } = eeprom();
    e.restoreFactory();
    const topics = new StockTopics(e);
    topics.add("100", "ONE");
    topics.add("100", "TWO");
    topics.edit(0, "12", "NEWS");
    topics.mark(1, false);
    const reread = new StockTopics(new StockEeprom(storage, [...RECORDS]));
    // A new topic is marked (`topics/factory-select-1`); Edit keeps the mark.
    expect(reread.list()).toEqual([
      { number: "12", name: "NEWS", marked: true },
      { number: "100", name: "TWO", marked: false },
    ]);
    reread.erase(0);
    expect(reread.list().map((t) => t.name)).toEqual(["TWO"]);
  });

  it("refuse a sixth topic", () => {
    const topics = new StockTopics(eeprom().eeprom);
    expect(() => topics.add("1", "X")).toThrow(/full/);
  });
});
