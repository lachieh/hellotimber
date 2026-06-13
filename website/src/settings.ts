import { useSyncExternalStore } from "react";

/** Site settings, dressed as phone settings (VISION Menu 5/6). */
export interface SiteSettings {
  /** Tones 5-6 — key beeps on/off (deviation 11: On/Off, not levels). */
  keypadTones: boolean;
  /** Settings → Phone settings → Lights — drives phone-3d backlightOn. */
  backlight: boolean;
  /** Settings → Phone settings → Welcome note — shown at boot (next load). */
  welcomeNote: string;
  /** Global mute — overrides everything (the SoundToggle button). */
  muted: boolean;
  /** Tones 5-1 — selected ringtone id (see src/phone/tones.ts). */
  ringtone: string;
  /** Tones 5-9 — idle screensaver on/off. */
  screenSaver: boolean;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  keypadTones: true,
  backlight: true,
  welcomeNote: "Welcome!",
  muted: false,
  ringtone: "nokia-tune",
  screenSaver: true,
};

const STORAGE_KEY = "hellotimber.settings";
const listeners = new Set<() => void>();
let cached: SiteSettings | null = null;

function load(): SiteSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SiteSettings>) };
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
