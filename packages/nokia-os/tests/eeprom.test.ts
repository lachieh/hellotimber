// Plan 15 Task 4: the host storage port and versioned EEPROM records.
import { describe, expect, it } from "vite-plus/test";
import { StockEeprom, type EepromRecord } from "../src/firmware/eeprom";
import { STOCK_RECORDS } from "../src/firmware/records";
import { createMemoryStorage, STOCK_STORAGE_PREFIX, type StockStorage } from "../src/index";

/** A toy record: a counter and a list, at version 2 (version 1 stored only `count`). */
interface Toy {
  count: number;
  tags: string[];
}

const TOY: EepromRecord<Toy> = {
  name: "toy",
  version: 2,
  initial: () => ({ count: 0, tags: [] }),
  decode(data, version) {
    const record = data as { count?: unknown; tags?: unknown };
    if (typeof record.count !== "number") throw new Error("count is not a number");
    if (version === 1) return { count: record.count, tags: ["migrated"] };
    if (!Array.isArray(record.tags)) throw new Error("tags is not a list");
    return { count: record.count, tags: record.tags.map(String) };
  },
  encode: (value) => ({ tags: value.tags, count: value.count }),
  factory: (current) => ({ count: 0, tags: current.tags }),
};

/** A record without `factory`: Restore factory settings keeps it (user guide). */
const KEPT: EepromRecord<number> = {
  name: "kept-score",
  version: 1,
  initial: () => 45,
  decode(data) {
    const value = (data as { score?: unknown }).score;
    if (typeof value !== "number") throw new Error("score is not a number");
    return value;
  },
  encode: (score) => ({ score }),
};

const TOY_KEY = `${STOCK_STORAGE_PREFIX}toy`;

/** A storage that counts and can refuse calls. */
function spyStorage(base: StockStorage = createMemoryStorage()) {
  const calls: string[] = [];
  let failWrites = false;
  const storage: StockStorage = {
    getItem(key) {
      calls.push(`get ${key}`);
      return base.getItem(key);
    },
    setItem(key, value) {
      calls.push(`set ${key}`);
      if (failWrites) throw new Error("QuotaExceededError");
      base.setItem(key, value);
    },
    removeItem(key) {
      calls.push(`remove ${key}`);
      base.removeItem(key);
    },
  };
  return {
    storage,
    calls,
    failWrites: () => {
      failWrites = true;
    },
  };
}

describe("createMemoryStorage", () => {
  it("is the Web Storage subset: null when missing, strings in and out, remove", () => {
    const storage = createMemoryStorage();
    expect(storage.getItem("a")).toBeNull();
    storage.setItem("a", "1");
    expect(storage.getItem("a")).toBe("1");
    storage.setItem("a", "2");
    expect(storage.getItem("a")).toBe("2");
    storage.removeItem("a");
    expect(storage.getItem("a")).toBeNull();
    storage.removeItem("missing");
  });

  it("shares nothing between instances", () => {
    const a = createMemoryStorage();
    const b = createMemoryStorage();
    a.setItem("k", "v");
    expect(b.getItem("k")).toBeNull();
  });

  it("names the prefix nokia-os writes under", () => {
    expect(STOCK_STORAGE_PREFIX).toBe("nokia-os/");
  });
});

describe("StockEeprom", () => {
  it("reads initial() for a missing key", () => {
    const eeprom = new StockEeprom(createMemoryStorage(), [TOY]);
    expect(eeprom.read(TOY)).toEqual({ count: 0, tags: [] });
  });

  it("round-trips a written value through a second EEPROM on the same storage", () => {
    const storage = createMemoryStorage();
    new StockEeprom(storage, [TOY]).write(TOY, { count: 3, tags: ["a", "b"] });
    expect(new StockEeprom(storage, [TOY]).read(TOY)).toEqual({ count: 3, tags: ["a", "b"] });
  });

  it("stores {version, ...} JSON with sorted keys, nested objects included", () => {
    const nested: EepromRecord<Record<string, unknown>> = {
      name: "nested",
      version: 3,
      initial: () => ({}),
      decode: (data) => data as Record<string, unknown>,
      encode: (value) => value,
    };
    const storage = createMemoryStorage();
    const eeprom = new StockEeprom(storage, [TOY, nested]);
    eeprom.write(TOY, { count: 7, tags: ["z", "a"] });
    expect(storage.getItem(TOY_KEY)).toBe('{"count":7,"tags":["z","a"],"version":2}');
    eeprom.write(nested, { b: { y: 1, x: [2, { d: 1, c: 2 }] }, a: null });
    expect(storage.getItem(`${STOCK_STORAGE_PREFIX}nested`)).toBe(
      '{"a":null,"b":{"x":[2,{"c":2,"d":1}],"y":1},"version":3}',
    );
  });

  it("passes older versions to decode (migration)", () => {
    const storage = createMemoryStorage();
    storage.setItem(TOY_KEY, '{"count":5,"version":1}');
    expect(new StockEeprom(storage, [TOY]).read(TOY)).toEqual({ count: 5, tags: ["migrated"] });
  });

  it("passes decode the stored fields without the version", () => {
    const seen: unknown[] = [];
    const record: EepromRecord<number> = { ...KEPT, decode: (data) => (seen.push(data), 1) };
    const storage = createMemoryStorage();
    storage.setItem(`${STOCK_STORAGE_PREFIX}kept-score`, '{"score":9,"version":1}');
    new StockEeprom(storage, [record]).read(record);
    expect(seen).toEqual([{ score: 9 }]);
  });

  it.each([
    ["not JSON", "{oops", /not JSON/],
    ["an array", "[1,2]", /not an object/],
    ["null", "null", /not an object/],
    ["a number", "42", /not an object/],
    ["no version", '{"count":1}', /version/],
    ["a version of 0", '{"count":1,"version":0}', /version/],
    ["a fractional version", '{"count":1,"version":1.5}', /version/],
    ["a string version", '{"count":1,"version":"2"}', /version/],
    ["a newer version", '{"count":1,"tags":[],"version":3}', /newer/],
    ["a shape decode rejects", '{"count":"x","tags":[],"version":2}', /count is not a number/],
  ])("throws naming the storage key for %s", (_what, stored, message) => {
    const storage = createMemoryStorage();
    storage.setItem(TOY_KEY, stored);
    const create = () => new StockEeprom(storage, [TOY]);
    expect(create).toThrow(message);
    expect(create).toThrow(TOY_KEY);
  });

  it("reads each record from storage once, then from its cache", () => {
    const { storage, calls } = spyStorage();
    const eeprom = new StockEeprom(storage, [TOY]);
    eeprom.read(TOY);
    eeprom.read(TOY);
    eeprom.write(TOY, { count: 1, tags: [] });
    expect(eeprom.read(TOY)).toEqual({ count: 1, tags: [] });
    expect(calls.filter((call) => call.startsWith("get"))).toEqual([`get ${TOY_KEY}`]);
  });

  it("does not hand out its cache: callers cannot change a stored value by mutation", () => {
    const eeprom = new StockEeprom(createMemoryStorage(), [TOY]);
    const value = { count: 1, tags: ["a"] };
    eeprom.write(TOY, value);
    value.tags.push("b");
    eeprom.read(TOY).tags.push("c");
    expect(eeprom.read(TOY)).toEqual({ count: 1, tags: ["a"] });
  });

  it("keeps a value in memory when storage refuses the write, and does not throw", () => {
    const spy = spyStorage();
    const eeprom = new StockEeprom(spy.storage, [TOY]);
    spy.failWrites();
    expect(() => eeprom.write(TOY, { count: 9, tags: [] })).not.toThrow();
    expect(eeprom.read(TOY)).toEqual({ count: 9, tags: [] });
  });

  it("restoreFactory() applies factory and leaves records without one untouched", () => {
    const storage = createMemoryStorage();
    const eeprom = new StockEeprom(storage, [TOY, KEPT]);
    eeprom.write(TOY, { count: 4, tags: ["keep"] });
    eeprom.write(KEPT, 1297);
    const keptBefore = storage.getItem(`${STOCK_STORAGE_PREFIX}kept-score`);
    eeprom.restoreFactory();
    expect(eeprom.read(TOY)).toEqual({ count: 0, tags: ["keep"] });
    expect(new StockEeprom(storage, [TOY, KEPT]).read(TOY)).toEqual({ count: 0, tags: ["keep"] });
    expect(eeprom.read(KEPT)).toBe(1297);
    expect(storage.getItem(`${STOCK_STORAGE_PREFIX}kept-score`)).toBe(keptBefore);
  });

  it("touches only keys with STOCK_STORAGE_PREFIX", () => {
    const base = createMemoryStorage();
    base.setItem("theme", "dark");
    base.setItem("toy", "not ours");
    const spy = spyStorage(base);
    const eeprom = new StockEeprom(spy.storage, [TOY, KEPT]);
    eeprom.write(TOY, { count: 1, tags: [] });
    eeprom.write(KEPT, 2);
    eeprom.restoreFactory();
    expect(spy.calls.every((call) => call.split(" ")[1]!.startsWith(STOCK_STORAGE_PREFIX))).toBe(
      true,
    );
    expect(base.getItem("theme")).toBe("dark");
    expect(base.getItem("toy")).toBe("not ours");
  });

  it("rejects records it does not hold, and malformed record lists", () => {
    const eeprom = new StockEeprom(createMemoryStorage(), [TOY]);
    expect(() => eeprom.read(KEPT)).toThrow(/kept-score/);
    expect(() => eeprom.write(KEPT, 1)).toThrow(/kept-score/);
    expect(() => new StockEeprom(createMemoryStorage(), [TOY, TOY])).toThrow(/twice/);
    expect(() => new StockEeprom(createMemoryStorage(), [{ ...TOY, name: "Bad_Name" }])).toThrow(
      /kebab-case/,
    );
    expect(() => new StockEeprom(createMemoryStorage(), [{ ...TOY, version: 0 }])).toThrow(
      /version/,
    );
  });

  it("refuses an encoding that is not an object or that writes its own version", () => {
    const array: EepromRecord<number[]> = {
      name: "array",
      version: 1,
      initial: () => [],
      decode: () => [],
      encode: (value) => value,
    };
    const versioned: EepromRecord<number> = { ...KEPT, encode: (score) => ({ score, version: 9 }) };
    expect(() => new StockEeprom(createMemoryStorage(), [array]).write(array, [1])).toThrow(
      /object/,
    );
    expect(() => new StockEeprom(createMemoryStorage(), [versioned]).write(versioned, 1)).toThrow(
      /version/,
    );
  });

  it("defaults to STOCK_RECORDS", () => {
    const eeprom = new StockEeprom(createMemoryStorage());
    for (const record of STOCK_RECORDS) expect(() => eeprom.read(record)).not.toThrow();
  });
});
