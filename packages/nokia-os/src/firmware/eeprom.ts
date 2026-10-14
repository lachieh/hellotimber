// The phone's EEPROM (plan 15 D1, D2): a host storage port and versioned records over it.
//
// The port is the Web Storage subset, synchronous, so a host passes `window.localStorage` as it
// is. Each feature owns one record; its storage key is STOCK_STORAGE_PREFIX + its name and its
// value is `{"version":n,...}` JSON with sorted keys. Writes are immediate, as on the phone.
import { STOCK_RECORDS } from "./records";

/** The phone's EEPROM, as the Web Storage subset (`window.localStorage` fits). */
export interface StockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** nokia-os writes only keys that start with this. */
export const STOCK_STORAGE_PREFIX = "nokia-os/";

/** A fresh in-memory storage (the default; tests). */
export function createMemoryStorage(): StockStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem(key, value) {
      items.set(key, String(value));
    },
    removeItem(key) {
      items.delete(key);
    },
  };
}

/** One owner's data in the EEPROM. */
export interface EepromRecord<T> {
  /** Storage key = STOCK_STORAGE_PREFIX + name; kebab-case. */
  readonly name: string;
  /** Positive integer; bump on any shape change and migrate the older shape in `decode`. */
  readonly version: number;
  /** The virgin EEPROM value. */
  initial(): T;
  /**
   * Decodes the stored fields (without `version`) written by `version`; older versions migrate.
   * Throws on a bad shape; stale content in a good shape is dropped instead (D2).
   */
  decode(data: unknown, version: number): T;
  /** A JSON-safe object without a `version` field; the writer sorts its keys. */
  encode(value: T): unknown;
  /** What Restore factory settings leaves; absent = the record is kept (user guide). */
  factory?(current: T): T;
}

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** JSON with every object's keys sorted, so equal values store equal strings. */
function sortedJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    isPlainObject(inner)
      ? Object.fromEntries(
          Object.keys(inner)
            .sort()
            .map((key) => [key, inner[key]]),
        )
      : inner,
  );
}

/**
 * The records a phone holds, read once from storage and cached. A malformed record throws at
 * construction, naming its storage key; a storage that refuses a write keeps the value in memory.
 */
export class StockEeprom {
  private readonly storage: StockStorage;
  private readonly values = new Map<EepromRecord<unknown>, unknown>();

  constructor(storage: StockStorage, records: readonly EepromRecord<unknown>[] = STOCK_RECORDS) {
    this.storage = storage;
    const names = new Set<string>();
    for (const record of records) {
      if (!NAME.test(record.name)) {
        throw new Error(`EEPROM record name "${record.name}" must be kebab-case.`);
      }
      if (names.has(record.name))
        throw new Error(`EEPROM record "${record.name}" is listed twice.`);
      if (!Number.isInteger(record.version) || record.version < 1) {
        throw new Error(
          `EEPROM record "${record.name}" version must be a positive integer (${record.version}).`,
        );
      }
      names.add(record.name);
      this.values.set(record, this.load(record));
    }
  }

  /** The record's value: decoded once, then cached; a copy, so callers cannot mutate it. */
  read<T>(record: EepromRecord<T>): T {
    return structuredClone(this.held(record) as T);
  }

  /** Stores `value` at once. A storage failure is contained: the value stays in memory. */
  write<T>(record: EepromRecord<T>, value: T): void {
    this.held(record);
    const encoded = record.encode(value);
    if (!isPlainObject(encoded)) {
      throw new Error(`EEPROM record "${record.name}" must encode to an object.`);
    }
    if ("version" in encoded) {
      throw new Error(`EEPROM record "${record.name}" must not encode its own version.`);
    }
    this.values.set(record as EepromRecord<unknown>, structuredClone(value));
    try {
      this.storage.setItem(keyOf(record), sortedJson({ ...encoded, version: record.version }));
    } catch {
      // A full or unavailable storage keeps the phone working on its in-memory value.
    }
  }

  /** Restore factory settings: every record with `factory` gets factory(current). */
  restoreFactory(): void {
    for (const record of this.values.keys()) {
      if (record.factory === undefined) continue;
      this.write(record, record.factory(this.read(record)));
    }
  }

  private held<T>(record: EepromRecord<T>): unknown {
    if (!this.values.has(record as EepromRecord<unknown>)) {
      throw new Error(`EEPROM record "${record.name}" is not one of this phone's records.`);
    }
    return this.values.get(record as EepromRecord<unknown>);
  }

  private load<T>(record: EepromRecord<T>): T {
    const key = keyOf(record);
    const stored = this.storage.getItem(key);
    if (stored === null) return record.initial();
    const fail = (message: string): never => {
      throw new Error(`EEPROM record ${key}: ${message}`);
    };
    let parsed: unknown;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return fail("not JSON.");
    }
    if (!isPlainObject(parsed)) return fail("not an object.");
    const { version, ...data } = parsed;
    if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
      return fail(`version must be a positive integer (stored ${JSON.stringify(version)}).`);
    }
    if (version > record.version) {
      return fail(`version ${version} is newer than this firmware's (${record.version}).`);
    }
    try {
      return record.decode(data, version);
    } catch (error) {
      return fail((error as Error).message);
    }
  }
}

function keyOf(record: EepromRecord<unknown>): string {
  return `${STOCK_STORAGE_PREFIX}${record.name}`;
}
