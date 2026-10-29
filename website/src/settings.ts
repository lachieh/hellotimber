import { useSyncExternalStore } from "react";

export interface SiteSettings {
  muted: boolean;
}
export const DEFAULT_SETTINGS: SiteSettings = { muted: false };

const STORAGE_KEY = "hellotimber.settings";
const listeners = new Set<() => void>();
let cached: SiteSettings | null = null;

function load(): SiteSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    const settings = {
      muted: typeof raw === "object" && raw !== null && "muted" in raw && raw.muted === true,
    };
    window.localStorage.removeItem("hellotimber.messages");
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function getSettings(): SiteSettings {
  cached ??= load();
  return cached;
}

export function updateSettings(patch: Partial<SiteSettings>): SiteSettings {
  cached = { ...getSettings(), ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // storage unavailable (private mode/quota) — settings stay in-memory
  }
  // Snapshot so a listener that unsubscribes mid-notify can't skip siblings.
  // oxlint-disable-next-line no-useless-spread
  for (const listener of [...listeners]) listener();
  return cached;
}

export function subscribeSettings(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** React view of the store. Server snapshot = defaults (no hydration crash). */
export function useSettings(): SiteSettings {
  return useSyncExternalStore(subscribeSettings, getSettings, () => DEFAULT_SETTINGS);
}

/** Test hook: drop the cache so the next read goes back to localStorage. */
export function resetSettingsForTests(): void {
  cached = null;
}
