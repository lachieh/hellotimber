// Plan 17's scenario helpers: a phone in the profile captures' state (plan 15's factory-restored
// image with the setup's C held, `v639-factory-setup.inc`), seeded with an active profile, names
// and Tones values, and the captures' navigation (`gen_v639_plan17.py`).
import { StockEeprom } from "../../src/firmware/eeprom";
import {
  activateProfile,
  PROFILE_SLUGS,
  renameProfile,
  type ProfileSlug,
} from "../../src/firmware/features/profiles";
import { createStockSettings } from "../../src/firmware/settings";
import { createMemoryStorage, type StockStorage } from "../../src/index";
import type { PhoneKey } from "@hellotimber/phone-core";
import { recordTimeline } from "./acceptance.ts";
import { goto } from "./drive.ts";
import { expectLcd, expectTimeline, PROBE_TOLERANCE_MS } from "./golden.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { keys } from "./probes.ts";
import { seededStorage, standbyRig, type Rig } from "./rig.ts";

export interface ProfilesSeed {
  /** The virgin EEPROM instead of the factory state. */
  readonly virgin?: boolean;
  readonly active?: ProfileSlug;
  readonly names?: Readonly<Partial<Record<ProfileSlug, string>>>;
  /** Setting key → option index (`tones/…` keys write the active profile's). */
  readonly choices?: Readonly<Record<string, number>>;
}

/** Storage in the captures' state with `seed` written on top. */
export function profilesStorage(seed: ProfilesSeed = {}): StockStorage {
  const storage = seed.virgin ? createMemoryStorage() : seededStorage({ factory: true });
  const settings = createStockSettings(new StockEeprom(storage));
  for (const [slug, name] of Object.entries(seed.names ?? {})) {
    renameProfile(settings, slug as ProfileSlug, name);
  }
  if (seed.active !== undefined) activateProfile(settings, seed.active);
  for (const [key, index] of Object.entries(seed.choices ?? {})) settings.choose(key, index);
  return storage;
}

/**
 * A phone at standby as the factory captures leave it (C held 1.5 s, 1 s), over `storage`, then
 * `settle` ms more (default 2 s: the standby line is drawn; 0 keeps the DSP awake as at the
 * captures' first key). The virgin setup ends with C and 2 s.
 */
export function profilesRig(
  storage: StockStorage = profilesStorage(),
  { virgin = false, settle = 2000 }: { virgin?: boolean; settle?: number } = {},
): Rig {
  const rig = standbyRig({ storage });
  if (virgin) {
    rig.press("c");
    rig.advance(2000);
  } else {
    rig.press("c", 1500);
    rig.advance(1000);
  }
  rig.advance(settle);
  return rig;
}

/** A profile's menu number in the Profiles level (General 1 … slot 6 6). */
export const slot = (slug: ProfileSlug): number => PROFILE_SLUGS.indexOf(slug) + 1;

/**
 * The capture's `shortcut(...)`: Menu and the digits as harness taps, then `run 1700ms` and the
 * idle (≈300 ms more): ≈2 s after the last digit, the shortcut window still open.
 */
export function shortcut(rig: Rig, ...digits: (number | string)[]): void {
  keys(rig, `navi ${digits.join(" ")}`);
  rig.advance(1408);
}

/** Standby → the profile's level, Activate highlighted (the capture's `level(slug)`). */
export function toLevel(rig: Rig, slug: ProfileSlug): void {
  shortcut(rig, 1, 2, slot(slug));
}

/** Standby → Activate `slug` through its level, then 9 s (the note, standby and the name). */
export function activateByKeys(rig: Rig, slug: ProfileSlug): void {
  toLevel(rig, slug);
  rig.press("navi");
  rig.advance(9000);
}

/**
 * The capture's `to_standby()` (C held 1.5 s, then 1.5 s). The firmware leaves an option list for
 * standby on C held; nokia-os's list closes on the release (its kernel's C long press acts in
 * the menus only), so a tap closes a list first.
 */
export function toStandby(rig: Rig): void {
  if (rig.phone.screen.kind === "custom") {
    rig.press("c");
    rig.advance(300);
  }
  rig.press("c", 1500);
  rig.advance(1500);
}

/**
 * `recordingScenario` for a golden cut from a longer recording (a composite ending before an
 * artefact or an unreproduced draw): its last frame was still on screen at the cut, so it holds
 * at least as long as the golden says.
 */
export function cutRecordingScenario(
  id: string,
  rig: Rig,
  trigger: PhoneKey,
  toleranceMs?: number,
): void {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const cut = {
    ...golden,
    timeline: rows.map((row, i) => (i === rows.length - 1 ? { ...row, lowerBound: true } : row)),
  };
  const t = golden.triggerFrame as number;
  expectLcd(rig.paint(), goldenImage(id, rows[t - 1]!.image), `${id}: before the trigger`);
  const last = rows[rows.length - 1]!;
  const recording = rig.record(last.startMs + last.durationMs - rows[t]!.startMs + 100, () =>
    rig.press(trigger),
  );
  expectTimeline(
    recording,
    cut,
    `${id}: ${trigger}`,
    toleranceMs === undefined ? {} : { toleranceMs },
  );
}

/**
 * The generic tree `leaf` scenario of an Activate golden (virgin: 12-n-1 highlighted, Select)
 * compared within PROBE_TOLERANCE_MS: for the recording whose standby name comes earlier than
 * the others' (12-5-1: 1898 ms; PROFILE_LINE_DELAY_MS is their median, 1912).
 */
export function activateTreeScenario(id: string, number: string): void {
  const golden = loadGolden(id);
  const rig = standbyRig();
  goto(rig, number);
  rig.advance(592);
  const rows = golden.timeline!;
  const t = golden.triggerFrame as number;
  expectLcd(rig.paint(), goldenImage(id, rows[t - 1]!.image), `${number} highlighted`);
  const recording = recordTimeline(rig, golden, () => rig.press("navi"));
  expectTimeline(recording, golden, `${number} highlighted, Select`, {
    toleranceMs: PROBE_TOLERANCE_MS,
  });
}
