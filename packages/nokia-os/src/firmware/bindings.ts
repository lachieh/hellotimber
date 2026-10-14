// How the generated stock tree (src/firmware/generated/stock-tree.ts) binds to behaviour (plan 14
// D4). Setting keys and aliases come first (Task 8); Task 12 adds the leaf bindings.
import type { StockTreeNode } from "./generated/stock-tree";

/** A setting's key: the slug path of its tree node below the menu (`tones/ringing-volume`). */
export function settingKey(path: readonly StockTreeNode[]): string {
  return path.map((node) => node.slug).join("/");
}

/** Kebab-case slug of a label: line breaks become spaces, apostrophes vanish (plan 13). */
export function slugOf(label: string): string {
  return label
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Settings one menu shares with another (D9, P11): Tones are the active profile's Personalise
 * settings, and the virgin EEPROM's active profile is General. Silent and the other profiles
 * keep their own. Plan 17 makes the active profile switchable.
 */
export const SETTING_ALIASES: readonly { readonly prefix: string; readonly target: string }[] = [
  { prefix: "tones/", target: "profiles/general/personalise/" },
];

/**
 * The key `key` shares by `SETTING_ALIASES`, else itself. The virgin settings alias a key only
 * when that target exists (Composer has no Personalise counterpart).
 */
export function settingAlias(key: string): string {
  for (const { prefix, target } of SETTING_ALIASES) {
    if (key.startsWith(prefix)) return target + key.slice(prefix.length);
  }
  return key;
}

/** Host ports whose text appears on stock pages (and the clock on standby). */
export interface StockPorts {
  /** "HH:MM"; shown on Clock → Clock settings (and on standby). */
  clock?: () => string | undefined;
  /** Date text in the firmware's format (captured: `13.10.2026`); shown on Clock → Date setting. */
  date?: () => string | undefined;
}

/** Pages whose value is the host's (plan 13 D6), by setting key. */
export const HOST_VALUES: Readonly<Record<string, keyof StockPorts>> = {
  "clock/clock-settings": "clock",
  "clock/date-setting": "date",
};

/**
 * Virgin free-text values (D10) that are not page values, by key: a leaf screen's line from the
 * tree (`number`, `line`), or a value read from a golden (`text`).
 */
export const VIRGIN_TEXTS: readonly (
  | { readonly key: string; readonly number: string; readonly line: number }
  | { readonly key: string; readonly text: string }
)[] = [
  // tree/02-messages/2-7-1-1.leaf "c": the SIM's message centre (an emulator artefact). The tree
  // has no lines for this prompt.
  { key: "messages/message-settings/set-1/message-centre-number", text: "+1234567890" },
  // The SIM's voice mailbox (2-9 `Phone number:`).
  { key: "messages/voice-mailbox-number", number: "2-9", line: 1 },
  // Phone book › Options › Memory status: `SIM card:` / `50 free` / `0 in use`.
  { key: "phone-book/options/memory-status/free", number: "1-8-2", line: 1 },
  { key: "phone-book/options/memory-status/used", number: "1-8-2", line: 2 },
  // Top scores (`Top score:` / the score): uninitialised game EEPROM (Snake II, Space impact)
  // and zero (Pairs II).
  { key: "games/snake/top-score", number: "8-1-4", line: 1 },
  { key: "games/space-impact/top-score", number: "8-2-2", line: 1 },
  { key: "games/pairs-ii/time-trial/top-score", number: "8-4-1-3", line: 1 },
  { key: "games/pairs-ii/puzzle/top-score", number: "8-4-2-3", line: 1 },
];
