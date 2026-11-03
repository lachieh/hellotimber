import type { StockStorage } from "@hellotimber/nokia-os";

/** A storage that keeps its keys under `prefix` in `base`, and can forget all of them. */
export interface ScopedStorage extends StockStorage {
  /** Removes every key under the prefix; returns how many there were. */
  clear(): number;
}

/** The part of Web Storage a scoped storage needs (it enumerates keys to clear them). */
export type EnumerableStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

export function scopedStorage(base: EnumerableStorage, prefix: string): ScopedStorage {
  return {
    getItem: (key) => base.getItem(prefix + key),
    setItem: (key, value) => base.setItem(prefix + key, value),
    removeItem: (key) => base.removeItem(prefix + key),
    clear() {
      const keys: string[] = [];
      for (let i = 0; i < base.length; i++) {
        const key = base.key(i);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      for (const key of keys) base.removeItem(key);
      return keys.length;
    },
  };
}

/** An in-memory Web Storage, where the browser refuses `localStorage`. */
export function memoryStorage(): EnumerableStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
    key: (index) => Array.from(items.keys())[index] ?? null,
    get length() {
      return items.size;
    },
  };
}

/** `window.localStorage`, or memory where the browser refuses it. */
export function hostStorage(): EnumerableStorage {
  try {
    return window.localStorage;
  } catch {
    return memoryStorage();
  }
}
