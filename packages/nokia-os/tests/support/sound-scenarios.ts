// Scenarios for the sound goldens (plan 16 Tasks 5-8): each rebuilds the capture's state and
// setup (`$REF/captures/scripts/v639-plan16-<section>.cap`), presses the golden's keys from time 0
// and compares the port's events (tests/support/sound.ts). The acceptance test runs them.
import { LEVEL_COVER_TONES } from "../../scripts/sound-capture-set.ts";
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockSettings } from "../../src/firmware/settings";
import { createMemoryStorage, type StockStorage } from "../../src/index";
import { RINGING_TONES } from "../../src/resources";
import { open } from "./drive.ts";
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
const TONE = "tones/ringing-tone";
const VOLUME = "tones/ringing-volume";
const ALERT = "tones/incoming-call-alert";
const MESSAGE = "tones/message-alert-tone";
const VIBRA = "tones/vibrating-alert";
/** Ringing tone list indices: Croak, Nokia tune. */
const CROAK = 11;
const NOKIA_TUNE = 12;
/** Ringing volume options: Level n is n - 1. */
const level = (n: number): number => n - 1;
/** Incoming call alert: Ringing, Ascending, Ring once, Beep once, Off. */
const ASCENDING = 1;
/** Message alert tone: No tone, Standard, Special, Beep once, Ascending. */
const STANDARD = 1;
const SPECIAL = 2;
const BEEP_ONCE = 3;
const OFF = 1; // On/Off lists (Vibrating alert)

/** The 35 tones' golden slugs (`13-nokia-tune`), by list index. */
const TONE_SLUGS = RINGING_TONES.map((tone) => tone.slug);

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
  // V: the Ringing volume list previews the stored Nokia tune at the highlighted level, to its
  // first cycle mark; Level 5 before its query, whose OKs only beep.
  "sound/ringing-volume/level-1": (id) => volumeList(id, 1, {}),
  "sound/ringing-volume/level-2": (id) => volumeList(id, 0, {}),
  "sound/ringing-volume/level-3": (id) => volumeList(id, 1, {}),
  "sound/ringing-volume/level-4": (id) => volumeList(id, 2, {}),
  "sound/ringing-volume/level-5": (id) => volumeList(id, 3, {}),
  // R: an `(empty)` slot previews nothing (▼ from Get cool).
  "sound/ringing-tone/empty": (id) => toneList(id, 35, {}),
  // A: the alert type's effect on the Nokia tune preview (▼ from Croak).
  "sound/alert/ascending-l1": (id) => nokiaTune(id, { [ALERT]: ASCENDING, [VOLUME]: level(1) }),
  "sound/alert/ascending-l4": (id) => nokiaTune(id, { [ALERT]: ASCENDING }),
  "sound/alert/ascending-l5": (id) => nokiaTune(id, { [ALERT]: ASCENDING, [VOLUME]: level(5) }),
  "sound/alert/ring-once": (id) => nokiaTune(id, { [ALERT]: 2 }),
  "sound/alert/beep-once": (id) => nokiaTune(id, { [ALERT]: 3 }),
  "sound/alert/off": (id) => nokiaTune(id, { [ALERT]: 4 }),
  // The Incoming call alert list previews nothing.
  "sound/alert/list": (id) => expectSound(id, soundRig("factory"), `navi 5 3 ${SETTLE}`),
  // Vb: Vibrating alert Off removes the vibrator track; choosing On or Off pulses nothing.
  "sound/vibrator/off": (id) => nokiaTune(id, { [VIBRA]: OFF }),
  "sound/vibrator/choose": (id) => expectSound(id, soundRig("factory"), `navi 5 8 ${SETTLE}`),
  // M: message tone previews (once, ≈1004 ms after the key), Level 4 unless set.
  "sound/message-tone/no-tone": (id) => messageList(id, STANDARD, {}),
  "sound/message-tone/standard": (id) => messageList(id, 0, {}),
  "sound/message-tone/special": (id) => messageList(id, STANDARD, {}),
  "sound/message-tone/beep-once": (id) => messageList(id, SPECIAL, {}),
  "sound/message-tone/ascending": (id) => messageList(id, BEEP_ONCE, {}),
  "sound/message-tone/special-l1": (id) => messageList(id, STANDARD, { [VOLUME]: level(1) }),
  "sound/message-tone/standard-l5": (id) => messageList(id, 0, { [VOLUME]: level(5) }),
  "sound/message-tone/vib-off-special": (id) => messageList(id, STANDARD, { [VIBRA]: OFF }),
  "sound/message-tone/vib-off-beep-once": (id) => messageList(id, SPECIAL, { [VIBRA]: OFF }),
  "sound/message-tone/alert-off-special": (id) => messageList(id, STANDARD, { [ALERT]: 4 }),
  "sound/message-tone/beep-once-ringing-l1": (id) =>
    messageList(id, SPECIAL, { [VOLUME]: level(1) }),
  "sound/message-tone/beep-once-ringing-l5": (id) =>
    messageList(id, SPECIAL, { [VOLUME]: level(5) }),
  "sound/message-tone/beep-once-keypad-l3": (id) => messageList(id, SPECIAL, { [KEYPAD]: 3 }),
  "sound/message-tone/beep-once-keypad-off": (id) => messageList(id, SPECIAL, { [KEYPAD]: 0 }),
  // OK during Special's preview stops it (its Done is silent).
  "sound/message-tone/ok": (id) => messageList(id, STANDARD, {}),
  // P: a Personalise list previews with its profile's alert type and volume, and the active
  // profile's (General's) Vibrating alert.
  ...Object.fromEntries(
    (["general", "silent", "discreet", "loud"] as const).flatMap((profile, i) => [
      [
        `sound/profile/${profile}/ringing-tone`,
        (id: string) => personalise(id, i + 1, "ringing-tone", {}),
      ],
      [
        `sound/profile/${profile}/message-tone`,
        (id: string) => personalise(id, i + 1, "message-tone", {}),
      ],
    ]),
  ),
  ...Object.fromEntries(
    (
      [
        ["general-vibra-off", { [VIBRA]: OFF }],
        ["general-alert-off", { [ALERT]: 4 }],
        ["general-volume-1", { [VOLUME]: level(1) }],
      ] as const
    ).flatMap(([name, choices]) => [
      [
        `sound/profile/active/${name}/ringing-tone`,
        (id: string) => personalise(id, 4, "ringing-tone", choices),
      ],
      [
        `sound/profile/active/${name}/message-tone`,
        (id: string) => personalise(id, 4, "message-tone", choices),
      ],
    ]),
  ),
  // X: what arms and stops a preview.
  // The captures record 2620 ms plus 6 s (3 s after C): the next preview runs past them.
  "sound/preview/stop-key": (id) => nokiaTune(id, {}, { endMs: 8620 }),
  "sound/preview/stop-up": (id) => nokiaTune(id, {}, { endMs: 8620 }),
  "sound/preview/stop-c": (id) => nokiaTune(id, {}, { endMs: 5620 }),
  "sound/preview/ok": (id) => nokiaTune(id, {}, { endMs: 8620 }),
  "sound/preview/long": (id) => nokiaTune(id, {}),
  // ▼ ×4 150 ms apart: in the capture each key's beep starts ≈30 ms late, so the second key
  // runs the first beep on; nokia-os beeps at the key (D8), where the first beep has ended.
  // The beeps are a latency artefact here; the preview (buzzer, vibrator) is compared.
  "sound/preview/rapid": (id) =>
    toneList(id, NOKIA_TUNE, {}, true, { outputs: ["buzzer", "vibrator"] }),
  "sound/preview/rapid-500": (id) => toneList(id, NOKIA_TUNE, {}, true),
  // Six ▼ 0.7-1.2 s apart, then 6 s (11.7 s recorded).
  "sound/preview/delay-sweep": (id) => toneList(id, NOKIA_TUNE, {}, true, { endMs: 11700 }),
  "sound/preview/volume-stop-c": (id) => volumeList(id, 3, {}),
  "sound/preview/open": (id) => expectSound(id, soundRig("factory")),
  // Virgin: no alert type, no preview; the first ▼ out of the unset list previews nothing (S9).
  "sound/preview/virgin": (id) => virginToneList(id, {}),
  "sound/preview/virgin-volume": (id) => virginToneList(id, { [VOLUME]: level(3) }),
  "sound/preview/virgin-alert": (id) => virginToneList(id, { [ALERT]: 0 }),
  "sound/preview/virgin-vibra": (id) =>
    virginToneList(id, { [VOLUME]: level(3), [ALERT]: 0, [VIBRA]: 0 }),
  "sound/preview/first-down": (id) => virginToneList(id, { [VOLUME]: level(3), [ALERT]: 0 }),
  "sound/preview/first-down-back": (id) => virginToneList(id, { [VOLUME]: level(3), [ALERT]: 0 }),
  "sound/preview/virgin-message": (id) =>
    expectSound(id, soundRig("virgin"), `navi 5 5 ${SETTLE}`, { drift: true }),
  // B: holding the power key stops the preview; power-off plays the power-on tone.
  "sound/boot/power-off": (id) => powerOff(id),
  // B: the power-on tone 2425 ms into the boot (time 0: the phone turns on), Keypad tones or not.
  "sound/boot/power-on": (id) => powerOnSound(id, {}),
  "sound/boot/power-on-keypad-off": (id) => powerOnSound(id, { [KEYPAD]: 0 }),
};

// R: each tone's Ringing tone list preview at Level 4 (▼ from the tone above; ▲ for the first),
// at Levels 1, 2, 3 and 5 for the level rule, and with Ascending.
for (const [i, slug] of TONE_SLUGS.entries()) {
  SOUND_SCENARIOS[`sound/ringing-tone/${slug}`] = (id) => toneList(id, i, {});
  // Levels 1-3 for the eight tones that cover every frequency (D10), Level 5 for all.
  for (const n of LEVEL_COVER_TONES.includes(i + 1) ? [1, 2, 3, 5] : [5]) {
    SOUND_SCENARIOS[`sound/ringing-tone/level-${n}/${slug}`] = (id) =>
      toneList(id, i, { [VOLUME]: level(n) });
  }
  SOUND_SCENARIOS[`sound/alert/ascending/${slug}`] = (id) =>
    toneList(id, i, { [ALERT]: ASCENDING });
  // The Ringing volume list previews each stored tone to its first mark (▼ Level 3 → 4).
  SOUND_SCENARIOS[`sound/ringing-volume/tone/${slug}`] = (id) => volumeList(id, 2, { [TONE]: i });
}

/**
 * Tones › Ringing tone opened next to tone `index` (stored there, so no move arms a preview
 * before the recording), then the golden's keys; `opened`: the list opens on `index` itself.
 */
function toneList(
  id: string,
  index: number,
  choices: SettingChoices,
  opened = false,
  options: PlayOptions & SoundTolerance = {},
): void {
  const golden = loadSoundGolden(id);
  const from = opened ? index : golden.keys?.[0]?.key === "up" ? index + 1 : index - 1;
  const rig = soundRig("factory", { [TONE]: from, ...choices });
  const cycleMs = RINGING_TONES[index]?.cycleMs;
  // The tone's own Level 4 recording is its program; any other drifts.
  const drift = id !== `sound/ringing-tone/${RINGING_TONES[index]?.slug}`;
  expectSound(id, rig, `navi 5 1 ${SETTLE}`, {
    drift,
    ...(cycleMs === undefined ? {} : { cycleMs }),
    ...options,
  });
}

/** Nokia tune's preview: ▼ from Croak. */
function nokiaTune(id: string, choices: SettingChoices, options: SoundTolerance = {}): void {
  const rig = soundRig("factory", { [TONE]: CROAK, ...choices });
  expectSound(id, rig, `navi 5 1 ${SETTLE}`, { drift: true, ...options });
}

/** Tones › Ringing volume opened on option `from`, then the golden's keys. */
function volumeList(id: string, from: number, choices: SettingChoices): void {
  const rig = soundRig("factory", { ...choices, [VOLUME]: from });
  expectSound(id, rig, `navi 5 2 ${SETTLE}`, { drift: true });
}

/** Tones › Message alert tone opened on option `from`, then the golden's keys. */
function messageList(id: string, from: number, choices: SettingChoices): void {
  const rig = soundRig("factory", { ...choices, [MESSAGE]: from });
  // The four message goldens the programs come from replay exactly; the others drift.
  const source = /^sound\/message-tone\/(standard|special|beep-once|ascending)$/.test(id);
  expectSound(id, rig, `navi 5 5 ${SETTLE}`, { drift: !source });
}

/** The virgin Ringing tone list (unset), with `choices` set first. */
function virginToneList(id: string, choices: SettingChoices): void {
  expectSound(id, soundRig("virgin", choices), `navi 5 1 ${SETTLE}`, { drift: true });
}

/**
 * Profiles › profile `n` (1 General … 4 Loud) › Personalise › Ringing tone (opened on Croak) or
 * Message alert tone (opened on Standard; `profile/active/*`: on Special), then the golden's ▼.
 */
function personalise(
  id: string,
  n: number,
  list: "ringing-tone" | "message-tone",
  choices: SettingChoices,
): void {
  const profile = ["general", "silent", "discreet", "loud"][n - 1]!;
  const prefix = `profiles/${profile}/personalise`;
  const active = id.includes("/active/");
  const opening =
    list === "ringing-tone"
      ? { [`${prefix}/ringing-tone`]: CROAK }
      : { [`${prefix}/message-alert-tone`]: active ? SPECIAL : STANDARD };
  const rig = soundRig("factory", { ...choices, ...opening });
  open(rig, list === "ringing-tone" ? `12-${n}-2-1` : `12-${n}-2-5`);
  rig.advance(1500);
  expectSound(id, rig, "", { drift: true });
}

/** ▼ onto Nokia tune, then the power key held until the phone is off (time 0: the ▼). */
function powerOff(id: string): void {
  const rig = soundRig("factory", { [TONE]: CROAK });
  keys(rig, `navi 5 1 ${SETTLE}`);
  const golden = loadSoundGolden(id);
  // The kernel turns off at its 800 ms long press, the firmware ≈1046 ms after the key: compare
  // the preview up to the power key, then the power-off's events from the kernel's power-off.
  const recorded = playSound(rig, golden);
  const powerKey = golden.keys![1]!.ms;
  const before = { ...golden, rows: golden.rows.filter((row) => row.ms < powerKey + 1000) };
  expectSoundTimeline(
    {
      ...recorded,
      events: recorded.events.filter((e) => e.atMs < recorded.originMs + powerKey + 800),
    },
    before,
    `${id}: the preview up to the power key`,
    { drift: true },
  );
  const off = recorded.originMs + powerKey + 800;
  const firmwareOff = golden.rows.find((row) => row.ms >= powerKey + 1000)!.ms;
  // The power-off is a key-like trigger: the stop and the tone lag it in the capture (the DSP
  // wakes for the tone), which nokia-os does not reproduce (D8).
  const after = {
    ...golden,
    keys: [{ ms: 0, key: "power" }],
    rows: golden.rows
      .filter((row) => row.ms >= powerKey + 1000)
      .map((row) => ({ ...row, ms: row.ms - firmwareOff })),
  };
  expectSoundTimeline(
    { ...recorded, originMs: off, events: recorded.events.filter((e) => e.atMs >= off) },
    after,
    `${id}: from the power-off`,
  );
}

/** The animated power-on of a factory phone; time 0 is the kernel's power-on (long press). */
function powerOnSound(id: string, choices: SettingChoices): void {
  const rig = stockRig({ storage: soundStorage("factory", choices) });
  rig.hold("power");
  rig.advance(800);
  rig.release("power");
  const golden = loadSoundGolden(id);
  expectSoundTimeline(playSound(rig, golden), golden, `${id}: power on`);
}
