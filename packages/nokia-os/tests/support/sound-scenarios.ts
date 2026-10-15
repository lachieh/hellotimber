// Scenarios for the sound goldens (plan 16 Tasks 5-8): each rebuilds the capture's state and
// setup (`$REF/captures/scripts/v639-plan16-<section>.cap`), presses the golden's keys from time 0
// and compares the port's events (tests/support/sound.ts). The acceptance test runs them.
import { LEVEL_COVER_TONES } from "../../scripts/sound-capture-set.ts";
import { StockEeprom } from "../../src/firmware/eeprom";
import { GATE_BLANK_MS, SELF_TEST_MS } from "../../src/firmware/boot";
import { createStockSettings, type StockSettings } from "../../src/firmware/settings";
import { createMemoryStorage, type StockStorage } from "../../src/index";
import { RINGING_TONES } from "../../src/resources";
import { settingKey } from "../../src/firmware/tree";
import { goto, open } from "./drive.ts";
import { INDEX, treePath } from "./tree.ts";
import { expect } from "vite-plus/test";
import { SNAKE_SETTINGS } from "../../src/widgets/snake";
import { GAME_TICK_TOLERANCE_MS } from "./golden.ts";
import { keys, SNAKE } from "./probes.ts";
import { seededStorage, standbyRig, stockRig, type Rig } from "./rig.ts";
import {
  expectSoundTimeline,
  KEY_LATENCY_MAX_MS,
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
  // Plan 17: the power key's list opens at standby (its beep), C returns (its beep).
  "sound/boot/power-key": (id) => expectSound(id, soundRig("factory")),
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

// N: the warning tone of every timed note (Warning tones On): OK on the golden's first node.
for (const { id, status } of INDEX) {
  const number = /^sound\/note\/(\d[\d-]*)$/.exec(id)?.[1];
  if (number === undefined || status !== "asserted") continue;
  SOUND_SCENARIOS[id] = (golden) => {
    const storage = soundStorage("factory");
    const rig = standbyRig({ storage });
    rig.press("c", 1500);
    rig.advance(1000);
    gotoFactory(rig, number, createStockSettings(new StockEeprom(storage)));
    // The capture idles before its OK (`idle 300ms`): the last move's beep has ended.
    rig.advance(NAV_SETTLE_MS);
    expectSound(golden, rig);
  };
}

Object.assign(SOUND_SCENARIOS, {
  // Menu 1 9: `Invalid shortcut`'s 1750 Hz tone replaces the 9's beep; a key on the note sounds
  // it again; at Keypad tones Level 3 the tone keeps its own level.
  "sound/note/invalid-shortcut": (id: string) => expectSound(id, soundRig("factory")),
  "sound/note/invalid-shortcut-key": (id: string) => expectSound(id, soundRig("factory")),
  "sound/note/invalid-shortcut-keypad-l3": (id: string) =>
    expectSound(id, soundRig("factory", { [KEYPAD]: 3 })),
  // Menu 6 4, 00000, OK: `Code error` on the buzzer in place of OK's beep.
  "sound/note/code-error": (id: string) => expectSound(id, soundRig("factory")),
  // Warning tones Off: both error notes silent, and so are the keys that opened them (Menu 1 9,
  // C held, Menu 6 4).
  "sound/note/warning-off": (id: string) =>
    expectSound(id, soundRig("factory", { "tones/warning-tones": 1 })),
  // Call divert › Cancel all diverts: Requesting, Quit, `Request not confirmed` (silent).
  "sound/note/request-not-confirmed": (id: string) => {
    const rig = soundRig("factory");
    goto(rig, "7-6");
    rig.advance(NAV_SETTLE_MS);
    expectSound(id, rig);
  },
  // The power-on prompt (Phone security On, a new SIM): 00000, OK: the gate's `Code error`.
  "sound/note/gate-code-error": (id: string) => {
    const storage = soundStorage("factory", { "settings/security-settings/phone-security": 1 });
    const rig = stockRig({ storage });
    rig.press("power", 800);
    rig.advance(SELF_TEST_MS + GATE_BLANK_MS + 500);
    expectSound(id, rig);
  },
});

/** The wait after a scenario's own navigation, before the golden's first key. */
const NAV_SETTLE_MS = 500;

/**
 * Highlights tree node or option `number` from a settled factory standby. An option of a
 * single-choice list is reached from the list's stored choice (the factory state's, which
 * `goto`'s virgin openings do not know); everything else as `goto`.
 */
function gotoFactory(rig: Rig, number: string, settings: StockSettings): void {
  const segments = number.split("-");
  const listNumber = segments.slice(0, -1).join("-");
  const listPath = listNumber === "" ? undefined : treePath(listNumber);
  const list = listPath?.at(-1);
  if (list?.opens.kind !== "option-list" || list.opens.multi) {
    goto(rig, number);
    return;
  }
  open(rig, listNumber);
  const count = list.opens.options.length;
  const target = Number(segments.at(-1)) - 1;
  const chosen = settings.choice(settingKey(listPath!));
  const downs = chosen === null ? target + 1 : (target - chosen + count) % count;
  for (let i = 0; i < downs; i++) rig.press("down");
}

// G: Snake II's cues (D13) at level 1 with the captures' seed (rig.ts SEED_1010, plan 23 Task 5:
// `game/meal`'s first food at (14, 8)) and their top score, 0.
const SOUNDS = "games/settings/sounds";
const SHAKES = "games/settings/shakes";
Object.assign(SOUND_SCENARIOS, {
  "sound/game/snake-meal": (id: string) => snakeSound(id, {}),
  // The 8 comes 150 ms after Navi: in the capture Navi's beep starts 40 ms late and the 8 runs it
  // on; nokia-os beeps at the key (D8), where it has ended (as `sound/preview/rapid`). The beeps
  // compare from the 4.
  "sound/game/snake-crash": (id: string) => snakeSound(id, {}, "", 700),
  "sound/game/snake-top-score": (id: string) => snakeSound(id, {}),
  "sound/game/snake-keys": (id: string) => snakeSound(id, {}),
  "sound/game/snake-sounds-off": (id: string) => snakeSound(id, { [SOUNDS]: 0 }),
  "sound/game/snake-warning-off": (id: string) => snakeSound(id, { "tones/warning-tones": 1 }),
  "sound/game/snake-shakes-on-vibra-off": (id: string) => snakeSound(id, { [VIBRA]: OFF }),
  "sound/game/snake-shakes-off-vibra-on": (id: string) => snakeSound(id, { [SHAKES]: 0 }),
  "sound/game/snake-shakes-off-vibra-off": (id: string) =>
    snakeSound(id, { [SHAKES]: 0, [VIBRA]: OFF }),
  // Snake II › Top score: its note is silent (OK's beep only).
  "sound/game/snake-top-score-page": (id: string) => snakeSound(id, {}, "down*3"),
});

/**
 * The session's ticks run from the New game key (plan 23 D6: no key-to-redraw latency), while the
 * capture's game ran from its New game redraw, 56-83 ms after the key: its cues lag the session's
 * by that latency less their lead over the tick's redraw (47-54 ms in `sound/game/*`), within the
 * key latency nokia-os does not reproduce.
 */
const NEW_GAME_LATENCY_MAX_MS = KEY_LATENCY_MAX_MS;

/**
 * Snake II's menu (New game highlighted; `menu`: ▼ to another entry) at level 1 over the factory
 * state with `choices`, its last key 300 ms before the golden's first (the DSP awake, as after the
 * capture's level setting), then the golden's keys. The key beeps compare as keys; the cues (the
 * buzzer and the vibrator) align on the golden's first cue and keep GAME_TICK_TOLERANCE_MS.
 */
function snakeSound(id: string, choices: SettingChoices, menu = "", beepsFromMs = 0): void {
  const storage = soundStorage("factory", choices);
  const settings = createStockSettings(new StockEeprom(storage));
  settings.setNumber(SNAKE_SETTINGS.level, 1);
  settings.setNumber(SNAKE_SETTINGS.topScore, 0);
  const rig = standbyRig({ storage });
  rig.press("c", 1500);
  rig.advance(1000);
  keys(rig, `${SNAKE} down up ${menu}`);
  const golden = loadSoundGolden(id);
  const recorded = playSound(rig, golden);
  const beeps = {
    ...golden,
    keys: golden.keys?.filter((k) => k.ms >= beepsFromMs),
    rows: golden.rows.filter((r) => r.ms >= beepsFromMs),
  };
  expectSoundTimeline(
    {
      ...recorded,
      events: recorded.events.filter((e) => e.atMs >= recorded.originMs + beepsFromMs),
    },
    beeps,
    `${id}: ${golden.note}${beepsFromMs > 0 ? ` (beeps from ${beepsFromMs} ms)` : ""}`,
    { outputs: ["tone"] },
  );
  const isCue = (output: string): boolean => output !== "tone";
  const ours = recorded.events.find((e) => isCue(e.output));
  const theirs = golden.rows.find((row) => isCue(row.output));
  if (ours === undefined || theirs === undefined) {
    expect(ours, `${id}: a cue where the golden has none`).toBeUndefined();
    expect(theirs, `${id}: no cue where the golden has one`).toBeUndefined();
    return;
  }
  const lag = theirs.ms - (ours.atMs - recorded.originMs);
  expect(lag, `${id}: the capture's first cue after the session's`).toBeGreaterThanOrEqual(0);
  expect(lag, `${id}: the capture's first cue after the session's`).toBeLessThanOrEqual(
    NEW_GAME_LATENCY_MAX_MS,
  );
  expectSoundTimeline(
    { ...recorded, originMs: recorded.originMs - lag },
    golden,
    `${id}: ${golden.note} (cues aligned on the first, ${lag} ms later in the capture)`,
    { outputs: ["buzzer", "vibrator"], cueOnsetMs: GAME_TICK_TOLERANCE_MS },
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
