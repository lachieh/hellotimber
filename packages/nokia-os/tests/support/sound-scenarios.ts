// Scenarios for the sound goldens (plan 16 Tasks 5-8): each rebuilds the capture's state and
// setup (`$REF/captures/scripts/v639-plan16-<section>.cap`), presses the golden's keys from time 0
// and compares the port's events (tests/support/sound.ts). The acceptance test runs them.
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockSettings } from "../../src/firmware/settings";
import { createMemoryStorage, type StockStorage } from "../../src/index";
import { keys } from "./probes.ts";
import { seededStorage, standbyRig, stockRig, type Rig } from "./rig.ts";
import {
  expectSoundTimeline,
  loadSoundGolden,
  playSound,
  type PlayOptions,
  type SoundTolerance,
} from "./sound.ts";

/** Setting key → option index, written over the base state. */
export type SettingChoices = Readonly<Record<string, number>>;

/** Storage in the golden's state (`virgin` or `factory`), with `choices` written on top. */
export function soundStorage(
  state: "virgin" | "factory",
  choices: SettingChoices = {},
): StockStorage {
  const storage = state === "factory" ? seededStorage({ factory: true }) : createMemoryStorage();
  const settings = createStockSettings(new StockEeprom(storage));
  for (const [key, index] of Object.entries(choices)) settings.choose(key, index);
  return storage;
}

/**
 * A phone at standby in the golden's state, after the capture's setup: the factory setup ends
 * with C held 1.5 s and 1 s of standby (the DSP awake at time 0), the virgin one with C and 2 s
 * of standby after which the virgin captures find the DSP asleep (`sound/keypad/virgin`: its
 * first beep is a woken one), so here C and 3.5 s.
 */
export function soundRig(state: "virgin" | "factory", choices: SettingChoices = {}): Rig {
  const rig = standbyRig({ storage: soundStorage(state, choices) });
  if (state === "factory") {
    rig.press("c", 1500);
    rig.advance(1000);
  } else {
    rig.press("c");
    rig.advance(3500);
  }
  return rig;
}

/** Plays golden `id`'s keys on `rig` (after `setup`, a `keys` script) and compares. */
export function expectSound(
  id: string,
  rig: Rig,
  setup = "",
  options: PlayOptions & SoundTolerance = {},
): void {
  const golden = loadSoundGolden(id);
  if (setup !== "") keys(rig, setup);
  const recorded = playSound(rig, golden, options);
  expectSoundTimeline(
    recorded,
    golden,
    `${id}: ${setup === "" ? "" : `${setup}, then `}${golden.note ?? "its keys"}`,
    options,
  );
}

const KEYPAD = "tones/keypad-tones";

/** The capture's settle after a menu key script (`run 1500ms`, `idle 300ms 3000ms`). */
const SETTLE = "wait:1500";

export const SOUND_SCENARIOS: Record<string, (id: string) => void> = {
  // K: Keypad tones Off and Levels 1-3 (factory), set before the recording; the unset level.
  "sound/keypad/level-off": (id) => expectSound(id, soundRig("factory", { [KEYPAD]: 0 })),
  "sound/keypad/level-1": (id) => expectSound(id, soundRig("factory", { [KEYPAD]: 1 })),
  "sound/keypad/level-2": (id) => expectSound(id, soundRig("factory", { [KEYPAD]: 2 })),
  "sound/keypad/level-3": (id) => expectSound(id, soundRig("factory", { [KEYPAD]: 3 })),
  "sound/keypad/virgin": (id) => expectSound(id, soundRig("virgin")),
  // ▼ in the Incoming call alert list (no preview there), C, ▼, Select, ▼.
  "sound/keypad/list": (id) => expectSound(id, soundRig("factory"), `navi 5 3 ${SETTLE}`),
  // The Keypad tones list's own ▲/▼ beep at the highlighted level; C at the stored one.
  "sound/keypad/levels-list": (id) => expectSound(id, soundRig("factory"), `navi 5 6 ${SETTLE}`),
  "sound/keypad/virgin-list": (id) => expectSound(id, soundRig("virgin"), `navi 5 6 ${SETTLE}`),
  // Phone book: ▼▼ 100-400 ms apart (one beep runs on), ▲ after gaps that let the DSP sleep.
  "sound/keypad/pair": (id) => expectSound(id, soundRig("factory"), `navi 1 ${SETTLE}`),
  // B: the power-on tone 2425 ms into the boot (time 0: the phone turns on), Keypad tones or not.
  "sound/boot/power-on": (id) => powerOnSound(id, {}),
  "sound/boot/power-on-keypad-off": (id) => powerOnSound(id, { [KEYPAD]: 0 }),
};

/** The animated power-on of a factory phone; time 0 is the kernel's power-on (long press). */
function powerOnSound(id: string, choices: SettingChoices): void {
  const rig = stockRig({ storage: soundStorage("factory", choices) });
  rig.hold("power");
  rig.advance(800);
  rig.release("power");
  const golden = loadSoundGolden(id);
  expectSoundTimeline(playSound(rig, golden), golden, `${id}: power on`);
}
