import type { StockStorage } from "@hellotimber/nokia-os";
import type { StatusLevel } from "@hellotimber/phone-core";

/** What the World tab sets about the phone's surroundings. */
export interface WorldSettings {
  /** Charge left, 0-100 %. */
  batteryPercent: number;
  /** Received signal strength, GSM's reportable range (RSSI 0-31 = -113 to -51 dBm). */
  signalDbm: number;
  /** Minutes the phone's clock runs ahead of (or behind) the host's. */
  offsetMinutes: number;
  /** The display LEDs: the firmware's rules, or held on or off from outside. */
  backlight: BacklightMode;
}
export type BacklightMode = "auto" | "on" | "off";

export const SIGNAL_DBM = { min: -113, max: -51 } as const;
export const OFFSET_MINUTES = { min: -12 * 60, max: 12 * 60 } as const;

/** The captured phone: a full battery and full signal. */
export const DEFAULT_WORLD: WorldSettings = {
  batteryPercent: 100,
  signalDbm: -60,
  offsetMinutes: 0,
  backlight: "auto",
};

/** Signal ladder bars for a received level: one bar per 10 dB from -105 dBm, full from -75. */
export function signalBars(dbm: number): StatusLevel {
  if (dbm >= -75) return 4;
  if (dbm >= -85) return 3;
  if (dbm >= -95) return 2;
  if (dbm >= -105) return 1;
  return 0;
}

/** Battery ladder bars for a charge: full from 80 %, empty under 10 %. */
export function batteryBars(percent: number): StatusLevel {
  if (percent >= 80) return 4;
  if (percent >= 55) return 3;
  if (percent >= 30) return 2;
  if (percent >= 10) return 1;
  return 0;
}

/** `now` moved by the phone's clock offset. */
export function shiftedDate(offsetMinutes: number, now = Date.now()): Date {
  return new Date(now + offsetMinutes * 60_000);
}

/** "+02:30" / "-00:45" / "±00:00". */
export function formatOffset(minutes: number): string {
  const sign = minutes > 0 ? "+" : minutes < 0 ? "-" : "±";
  const abs = Math.abs(Math.round(minutes));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

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
