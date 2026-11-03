// The settings a service reads (plan 32 D20): the chosen option of a setting, by its key. The
// v6.39 firmware's `StockSettings` (src/firmware/settings.ts) is one.

/** Reads the phone's settings. */
export interface SettingsReader {
  /** The chosen option's index of the setting at `key`, or null while none is chosen. */
  choice(key: string): number | null;
}
