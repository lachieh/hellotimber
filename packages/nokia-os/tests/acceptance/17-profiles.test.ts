// Plan 17's acceptance (docs/plans/17-profiles.md Tasks 6-9): every asserted profiles golden.
// Each scenario rebuilds the capture's state (gen_v639_plan17.py: plan 15's factory image, the
// active profile, names and Tones values seeded) and replays its keys. Timelines that replay
// another recording's timing (the Activate notes are the virgin tree recordings' timelines)
// compare within PROBE_TOLERANCE_MS; stills compare pixels exactly.
import type { PhoneKey } from "@hellotimber/phone-core";
import { PROFILE_SLUGS } from "../../src/firmware/features/profiles";
import { acceptancePlan, type Scenario } from "../support/acceptance.ts";
import { recordingScenario, type RecordingKey } from "../support/calculator.ts";
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockSettings } from "../../src/firmware/settings";
import { expectLcd, expectTimeline, PROBE_TOLERANCE_MS } from "../support/golden.ts";
import { goldenImage, loadGolden } from "../support/goldens.ts";
import { keys } from "../support/probes.ts";
import {
  ACTIVATE_TOLERANCE_MS,
  cutRecordingScenario,
  profilesRig,
  profilesStorage,
  shortcut,
  toLevel,
  toStandby,
  type ProfilesSeed,
} from "../support/profiles.ts";
import type { Rig } from "../support/rig.ts";
import { expectSound } from "../support/sound-scenarios.ts";

const key = (k: PhoneKey, at: RecordingKey["at"] = 0, holdMs?: number): RecordingKey => ({
  key: k,
  at,
  ...(holdMs === undefined ? {} : { holdMs }),
});

const NAMED = PROFILE_SLUGS.slice(1);

/** Tones settings by the option index the captures chose (the tree's option order). */
const ALERT = "tones/incoming-call-alert";
const MESSAGE = "tones/message-alert-tone";
const KEYPAD = "tones/keypad-tones";
const WARNING = "tones/warning-tones";
const VIBRA = "tones/vibrating-alert";
const VOLUME = "tones/ringing-volume";

/** Silent's factory Personalise values (plan 15's factory table). */
const SILENT_VALUES = {
  [ALERT]: 4,
  [MESSAGE]: 0,
  [KEYPAD]: 0,
  [WARNING]: 1,
  [VIBRA]: 1,
  [VOLUME]: 0,
};

/** Each still compares one image after its own setup: `steps[image]` drives a fresh rig. */
function seededStills(
  id: string,
  seeds: Readonly<Record<string, ProfilesSeed>>,
  drive: (rig: Rig, image: string) => void = () => {},
): void {
  for (const image of loadGolden(id).images) {
    const seed = seeds[image.name];
    if (seed === undefined) throw new Error(`${id}: no seed for image ${image.name}`);
    const rig = profilesRig(profilesStorage(seed));
    drive(rig, image.name);
    expectLcd(rig.paint(), goldenImage(id, image.name), `${id} ${image.name}`);
  }
}

/** One rig through every image in order: `steps[i]` runs before image i is compared. */
function stepStills(id: string, rig: Rig, steps: readonly ((rig: Rig) => void)[]): void {
  const images = loadGolden(id).images;
  if (images.length !== steps.length) {
    throw new Error(`${id}: ${images.length} images, ${steps.length} steps`);
  }
  images.forEach((image, i) => {
    steps[i]!(rig);
    expectLcd(rig.paint(), goldenImage(id, image.name), `${id} ${image.name}`);
  });
}

/** The capture's `key down` + `run <ms>`. */
const down =
  (ms: number) =>
  (rig: Rig): void => {
    rig.press("down");
    rig.advance(592 + ms);
  };

// ---------------------------------------------------------------- Task 6: Activate and standby

/** Icon matrix cases (Task 0 A3): the active profile and the Tones values written. */
const ICON_SEEDS: Readonly<Record<string, ProfilesSeed>> = {
  "general-alert-off": { choices: { [ALERT]: 4 } },
  "general-vibra-off": { choices: { [VIBRA]: 1 } },
  "general-alert-off-vibra-off": { choices: { [ALERT]: 4, [VIBRA]: 1 } },
  "general-alert-off-keypad-off": { choices: { [ALERT]: 4, [KEYPAD]: 0 } },
  "general-alert-off-warning-off": { choices: { [ALERT]: 4, [WARNING]: 1 } },
  "general-alert-off-message-none": { choices: { [ALERT]: 4, [MESSAGE]: 0 } },
  "general-alert-off-volume-1": { choices: { [ALERT]: 4, [VOLUME]: 0 } },
  "general-silent-values": { choices: SILENT_VALUES },
  silent: { active: "silent" },
  "silent-alert-ringing": { active: "silent", choices: { [ALERT]: 0 } },
  "silent-alert-beep-once": { active: "silent", choices: { [ALERT]: 3 } },
  "silent-message-standard": { active: "silent", choices: { [MESSAGE]: 1 } },
  "silent-keypad-2": { active: "silent", choices: { [KEYPAD]: 2 } },
  "silent-warning-on": { active: "silent", choices: { [WARNING]: 0 } },
  "silent-vibra-on": { active: "silent", choices: { [VIBRA]: 0 } },
  "silent-volume-4": { active: "silent", choices: { [VOLUME]: 3 } },
  "loud-alert-off": { active: "loud", choices: { [ALERT]: 4 } },
};

/** General given other values (Task 0 A3b-d): when its line reads `Silent`. */
const SILENT_TEXT_SEEDS: Readonly<Record<string, ProfilesSeed>> = {
  "general-silent-values": { choices: SILENT_VALUES },
  "general-silent-values-volume-4": {
    choices: { [ALERT]: 4, [MESSAGE]: 0, [KEYPAD]: 0, [WARNING]: 1, [VIBRA]: 1 },
  },
  "general-silent-values-renamed": { names: { silent: "Quiet" }, choices: SILENT_VALUES },
  "general-alert-message-keypad-warning-off": {
    choices: { [ALERT]: 4, [MESSAGE]: 0, [KEYPAD]: 0, [WARNING]: 1 },
  },
  "general-alert-message-vibra-off": { choices: { [ALERT]: 4, [MESSAGE]: 0, [VIBRA]: 1 } },
  "general-alert-message-vibra-keypad-off": {
    choices: { [ALERT]: 4, [MESSAGE]: 0, [VIBRA]: 1, [KEYPAD]: 0 },
  },
  "general-alert-message-vibra-warning-off": {
    choices: { [ALERT]: 4, [MESSAGE]: 0, [VIBRA]: 1, [WARNING]: 1 },
  },
  "general-silent-values-but-alert": {
    choices: { [MESSAGE]: 0, [KEYPAD]: 0, [WARNING]: 1, [VIBRA]: 1 },
  },
  "general-silent-values-but-message": {
    choices: { [ALERT]: 4, [KEYPAD]: 0, [WARNING]: 1, [VIBRA]: 1 },
  },
  "general-volume-3": { choices: { [VOLUME]: 2 } },
  "general-discreet-values": {
    choices: { [VOLUME]: 0, [ALERT]: 3, [MESSAGE]: 3, [KEYPAD]: 1, [WARNING]: 1, [VIBRA]: 0 },
  },
  "loud-silent-values": { active: "loud", choices: SILENT_VALUES },
  "empty-2-silent-values": { active: "empty-2", choices: SILENT_VALUES },
  "silent-general-values": {
    active: "silent",
    choices: { [VOLUME]: 3, [ALERT]: 0, [MESSAGE]: 1, [KEYPAD]: 2, [WARNING]: 0, [VIBRA]: 0 },
  },
};

const TASK_6: Record<string, Scenario> = {
  // Select on Activate from the level Menu 1 2 n opened (the window still awaiting a digit).
  ...Object.fromEntries(
    PROFILE_SLUGS.map((slug) => [
      `profiles/activate-${slug}`,
      (id: string) => {
        const rig = profilesRig();
        toLevel(rig, slug);
        // Discreet's golden ends 15 ms into its name (the artefact that follows is cut, D10).
        if (slug === "discreet") cutRecordingScenario(id, rig, "navi", ACTIVATE_TOLERANCE_MS);
        else recordingScenario(id, rig, key("navi"), [], ACTIVATE_TOLERANCE_MS);
      },
    ]),
  ),
  ...Object.fromEntries(
    NAMED.map((slug) => [
      `profiles/activate-general-from-${slug}`,
      (id: string) => {
        const rig = profilesRig(profilesStorage({ active: slug }));
        toLevel(rig, "general");
        recordingScenario(id, rig, key("navi"), [], ACTIVATE_TOLERANCE_MS);
      },
    ]),
  ),
  // Silent active: Menu keeps the name (and the icon) while it erases the ladders.
  // The carousel's Phone book icon replays plan 13's recording of it (menu/01-phone-book.anim).
  "profiles/standby-menu": (id) =>
    cutRecordingScenario(
      id,
      profilesRig(profilesStorage({ active: "silent" })),
      "navi",
      PROBE_TOLERANCE_MS,
    ),
  "profiles/standby-carousel-c": (id) => {
    const rig = profilesRig(profilesStorage({ active: "silent" }));
    rig.press("navi");
    rig.advance(1500);
    recordingScenario(id, rig, key("c"), [], PROBE_TOLERANCE_MS);
  },
  // Silenth and Ab renamed, slot 6 active: Restore factory settings (6-4), 12345, OK.
  "profiles/restore": (id) => {
    const storage = profilesStorage({
      names: { silent: "Silenth", "empty-2": "Ab" },
      active: "empty-2",
    });
    const rig = profilesRig(storage);
    // Menu 6 4 opens the code prompt; the capture's OK on it and 1.5 s let the shortcut window
    // close before the code (the OK itself is not replayed: nokia-os's error note would take the
    // first digit the firmware kept).
    shortcut(rig, 6, 4);
    keys(rig, "wait:1500 1 2 3 4 5");
    recordingScenario(id, rig, key("navi"), [], PROBE_TOLERANCE_MS);
  },
  "profiles/icon": (id) => seededStills(id, ICON_SEEDS),
  "profiles/standby-silent-text": (id) => seededStills(id, SILENT_TEXT_SEEDS),
  ...Object.fromEntries(
    PROFILE_SLUGS.map((slug) => [
      `profiles/tones-${slug}`,
      (id: string) => {
        const rig = profilesRig(profilesStorage(slug === "general" ? {} : { active: slug }));
        stepStills(id, rig, [
          (r) => shortcut(r, 5),
          ...Array.from({ length: 8 }, () => down(108)),
          (r) => {
            toStandby(r);
            shortcut(r, 5, 6);
          },
          (r) => {
            toStandby(r);
            shortcut(r, 5, 2);
          },
        ]);
      },
    ]),
  ),
  // Silent active: Tones › Keypad tones → Level 3, then Silent's, General's and Tones' lists.
  "profiles/tones-write": (id) => {
    const rig = profilesRig(profilesStorage({ active: "silent" }));
    stepStills(id, rig, [
      (r) => {
        shortcut(r, 5, 6);
        for (let i = 0; i < 3; i++) {
          r.press("down");
          r.advance(342);
        }
        r.advance(300);
        r.press("navi");
        r.advance(592 + 3500);
      },
      (r) => {
        toStandby(r);
        shortcut(r, 1, 2, 2, 2, 6);
      },
      (r) => {
        toStandby(r);
        shortcut(r, 1, 2, 1, 2, 6);
      },
      (r) => {
        toStandby(r);
        shortcut(r, 5, 6);
      },
    ]);
  },
  "profiles/opening": (id) => {
    const golden = loadGolden(id);
    const check = (rig: Rig, image: string) =>
      expectLcd(rig.paint(), goldenImage(id, image), `${id} ${image}`);
    for (const slug of PROFILE_SLUGS) {
      const rig = profilesRig(profilesStorage(slug === "general" ? {} : { active: slug }));
      shortcut(rig, 1, 2);
      check(rig, slug);
    }
    // Silent active: Discreet's level, C, C held, Menu 1 2.
    const rig = profilesRig(profilesStorage({ active: "silent" }));
    shortcut(rig, 1, 2);
    keys(rig, "down wait:8 navi wait:908");
    check(rig, "visit-level");
    keys(rig, "c wait:208");
    check(rig, "visit-back");
    toStandby(rig);
    shortcut(rig, 1, 2);
    check(rig, "after-visit");
    // After a power cycle: a new phone over the same storage.
    for (const slug of ["silent", "discreet"] as const) {
      const storage = profilesStorage({ active: slug });
      const booted = profilesRig(storage);
      check(booted, `boot-${slug}-standby`);
      shortcut(booted, 1, 2);
      check(booted, `boot-${slug}`);
    }
    if (golden.images.length !== PROFILE_SLUGS.length + 7) throw new Error(`${id}: images`);
  },
  // Discreet with its Screen saver Off: standby keeps the operator.
  "profiles/discreet-screen-saver-off": (id) =>
    seededStills(id, { standby: { active: "discreet", choices: { "tones/screen-saver": 0 } } }),
  // The sound of Select on Activate: the new profile's keypad level (D4).
  ...Object.fromEntries(
    PROFILE_SLUGS.map((slug) => [
      `sound/profiles/activate-${slug}`,
      (id: string) => {
        const rig = profilesRig();
        toLevel(rig, slug);
        expectSound(id, rig);
      },
    ]),
  ),
  // Menu 1 2 n 1: the last digit's beep (D4, A6).
  ...Object.fromEntries(
    (["silent", "loud", "discreet"] as const).map((slug) => [
      `sound/profiles/shortcut-${slug}`,
      (id: string) => expectSound(id, profilesRig(profilesStorage(), { settle: 0 })),
    ]),
  ),
  // Effects (P8) per active profile: keys, Invalid shortcut, a Ringing tone preview.
  ...Object.fromEntries(
    PROFILE_SLUGS.flatMap((slug) => {
      const seed: ProfilesSeed = slug === "general" ? {} : { active: slug };
      return [
        [`sound/profiles/effects-${slug}-keys`, (id: string) => expectSound(id, effectsRig(seed))],
        [
          `sound/profiles/effects-${slug}-invalid`,
          (id: string) => expectSound(id, effectsRig(seed, "keys")),
        ],
        [
          `sound/profiles/effects-${slug}-preview`,
          (id: string) => {
            const rig = effectsRig(seed, "invalid");
            shortcut(rig, 5, 1);
            // The preview is the Nokia tune program (another recording: PASS_DRIFT), and the
            // capture stopped 1 s after ▲, before ▲'s own preview of Nokia tune began.
            expectSound(id, rig, "", { drift: true, endMs: 6090 });
          },
        ],
      ];
    }),
  ),
};

// ---------------------------------------------------------------- Task 7: the power key

/** Opens the power list at standby and lets it settle (the capture's `power_list()`). */
function openPowerList(rig: Rig): void {
  rig.press("power");
  rig.advance(1000);
}

/**
 * A timeline whose key changes nothing at once (`trigger-frame: 0`): frame 0 is on screen at
 * the key, aligned on it.
 */
function unchangedAtKey(id: string, rig: Rig, k: PhoneKey): void {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  expectLcd(rig.paint(), goldenImage(id, rows[0]!.image), `${id}: before the key`);
  const last = rows[rows.length - 1]!;
  const recording = rig.record(last.startMs + last.durationMs + 100, () => rig.press(k));
  const [first, ...rest] = recording.frames;
  expectTimeline(
    { ...recording, frames: [{ ...first!, startMs: recording.triggerMs }, ...rest] },
    golden,
    `${id}: ${k}`,
    { toleranceMs: PROBE_TOLERANCE_MS },
  );
}

const DIGIT_KEYS: Readonly<Record<string, PhoneKey>> = { star: "*", hash: "#" };

/** The rig of a `persist-*` still: Silenth, Ab, slot 6 active; after Restore, the factory. */
function persistRig(restored: boolean): Rig {
  const storage = profilesStorage({
    names: { silent: "Silenth", "empty-2": "Ab" },
    active: "empty-2",
  });
  if (restored) createStockSettings(new StockEeprom(storage)).restoreFactory();
  return profilesRig(storage);
}

/** Standby, the Profiles level ▼×0-6, the power list ▼×0-7, Tones pages 1-9 (`everywhere`). */
const EVERYWHERE: readonly ((rig: Rig) => void)[] = [
  (r) => r.advance(1000),
  (r) => shortcut(r, 1, 2),
  ...Array.from({ length: 6 }, () => down(-92)),
  (r) => {
    toStandby(r);
    openPowerList(r);
  },
  ...Array.from({ length: 7 }, () => down(-92)),
  (r) => {
    r.press("c");
    r.advance(2592);
    shortcut(r, 5);
  },
  ...Array.from({ length: 8 }, () => down(108)),
];

const TASK_7: Record<string, Scenario> = {
  ...Object.fromEntries(
    (["general", "silent"] as const).flatMap((who) => {
      // The factory setup leaves the DSP awake (General); Silent was activated 9 s before.
      const rig = () =>
        profilesRig(profilesStorage(who === "general" ? {} : { active: who }), {
          settle: who === "general" ? 0 : 2000,
        });
      const listed = () => {
        const r = rig();
        openPowerList(r);
        return r;
      };
      return [
        [`profiles/power-${who}-list`, (id: string) => recordingScenario(id, rig(), key("power"))],
        [
          `profiles/power-${who}-power-keys`,
          (id: string) =>
            recordingScenario(id, rig(), key("power"), [
              key("power", 3),
              key("power", 4),
              key("power", 5),
            ]),
        ],
        // C: standby without the operator for 86 ms (84-88 ms captured), then standby and, for
        // Silent, its name.
        [
          `profiles/power-${who}-c`,
          (id: string) => recordingScenario(id, listed(), key("c"), [], PROBE_TOLERANCE_MS),
        ],
        [
          `profiles/power-${who}-switch-off`,
          (id: string) => recordingScenario(id, listed(), key("navi")),
        ],
        [
          `profiles/power-${who}-down`,
          (id: string) =>
            stepStills(
              id,
              listed(),
              Array.from({ length: 8 }, () => down(-92)),
            ),
        ],
        [
          `profiles/power-${who}-up`,
          (id: string) =>
            stepStills(
              id,
              listed(),
              Array.from({ length: 8 }, () => (r: Rig) => {
                r.press("up");
                r.advance(500);
              }),
            ),
        ],
        [`sound/profiles/power-${who}-list`, (id: string) => expectSound(id, rig())],
        [`sound/profiles/power-${who}-power-keys`, (id: string) => expectSound(id, rig())],
        [`sound/profiles/power-${who}-switch-off`, (id: string) => expectSound(id, listed())],
      ];
    }),
  ),
  // OK on each entry (▼ taps 342 ms apart, 600 ms): Activate's note (the slot's virgin
  // timeline: PROBE_TOLERANCE_MS), standby and the name.
  ...Object.fromEntries(
    PROFILE_SLUGS.flatMap((slug, i) => {
      const listed = () => {
        const r = profilesRig();
        openPowerList(r);
        for (let k = 0; k <= i; k++) {
          r.press("down");
          r.advance(342);
        }
        r.advance(600 - 342);
        return r;
      };
      return [
        [
          `profiles/power-general-ok-${slug}`,
          (id: string) =>
            slug === "discreet"
              ? cutRecordingScenario(id, listed(), "navi", ACTIVATE_TOLERANCE_MS)
              : recordingScenario(id, listed(), key("navi"), [], ACTIVATE_TOLERANCE_MS),
        ],
        [`sound/profiles/power-general-ok-${slug}`, (id: string) => expectSound(id, listed())],
      ];
    }),
  ),
  "profiles/power-silent-ok-general": (id) => {
    const rig = profilesRig(profilesStorage({ active: "silent" }));
    openPowerList(rig);
    rig.press("down");
    rig.advance(600);
    recordingScenario(id, rig, key("navi"), [], ACTIVATE_TOLERANCE_MS);
  },
  ...Object.fromEntries(
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "star", "hash"].map((digit) => [
      `profiles/power-general-digit-${digit}`,
      (id: string) => {
        const rig = profilesRig();
        openPowerList(rig);
        const k = (DIGIT_KEYS[digit] ?? digit) as PhoneKey;
        if (digit === "0" || digit === "star" || digit === "hash") unchangedAtKey(id, rig, k);
        else if (digit === "4") cutRecordingScenario(id, rig, k, ACTIVATE_TOLERANCE_MS);
        else recordingScenario(id, rig, key(k), [], ACTIVATE_TOLERANCE_MS);
      },
    ]),
  ),
  ...Object.fromEntries(
    ["1", "3"].map((digit) => [
      `profiles/power-silent-digit-${digit}`,
      (id: string) => {
        const rig = profilesRig(profilesStorage({ active: "silent" }));
        openPowerList(rig);
        recordingScenario(id, rig, key(digit as PhoneKey), [], ACTIVATE_TOLERANCE_MS);
      },
    ]),
  ),
  ...Object.fromEntries(
    ["1", "3", "8", "0", "star"].map((digit) => [
      `sound/profiles/power-general-digit-${digit}`,
      (id: string) => {
        const rig = profilesRig();
        openPowerList(rig);
        // 0's `Invalid shortcut` tone is the menus' program (another recording: PASS_DRIFT).
        expectSound(id, rig, "", digit === "0" ? { drift: true } : {});
      },
    ]),
  ),
  "profiles/power-general-held": (id) =>
    recordingScenario(id, profilesRig(), key("power", 0, 1500)),
  "profiles/power-general-idle": (id) => recordingScenario(id, profilesRig(), key("power")),
  // Select on Silent's Activate, the power key 760 ms into the note: the list, at once.
  "profiles/power-during-note": (id) => {
    const rig = profilesRig();
    toLevel(rig, "silent");
    recordingScenario(id, rig, key("navi"), [key("power", 3)], ACTIVATE_TOLERANCE_MS);
  },
  "profiles/power-virgin-list": (id) =>
    recordingScenario(
      id,
      profilesRig(profilesStorage({ virgin: true }), { virgin: true }),
      key("power"),
    ),
  "profiles/power-virgin-down": (id) => {
    const rig = profilesRig(profilesStorage({ virgin: true }), { virgin: true });
    rig.press("power");
    rig.advance(3000);
    stepStills(
      id,
      rig,
      Array.from({ length: 7 }, () => down(-92)),
    );
  },
  "profiles/persist-after-boot": (id) => stepStills(id, persistRig(false), EVERYWHERE.slice(1)),
  "profiles/persist-after-restore": (id) => stepStills(id, persistRig(true), EVERYWHERE.slice(1)),
};

/**
 * The effects section's phone before one of its recordings: after the activation, 3 s, then the
 * recordings before it (`keys`: Menu ▼ ▼ ▲ C at 600 ms steps, 1 s, 1 s; `invalid`: Menu 1 9,
 * 5 s, C held, 1 s), so the DSP is as awake as in the capture.
 */
function effectsRig(seed: ProfilesSeed, after?: "keys" | "invalid"): Rig {
  const rig = profilesRig(profilesStorage(seed));
  rig.advance(1000);
  if (after === undefined) return rig;
  keys(rig, "navi wait:8 down wait:8 down wait:8 up wait:8 c wait:2008");
  if (after === "keys") return rig;
  keys(rig, "navi 1 9 wait:5000");
  rig.advance(1000);
  return rig;
}

acceptancePlan({
  plan: "17",
  scenarios: { ...TASK_6, ...TASK_7 },
  knownGaps: {
    "sound/profiles/power-general-power-keys":
      "in the list the power key beeps 121-123 ms after its down (63 ms after its release; the " +
      "opening press 51 ms after its down), beyond the key latency the sound check allows; " +
      "nokia-os beeps at the down",
    "profiles/power-general-held":
      "the firmware switches off 1033 ms after the power key goes down; the kernel's long press " +
      "is 800 ms (plan 16's boot/power-off agrees, 1046 ms)",
    "profiles/standby-carousel-c":
      "a key's return to standby first draws the ladders without the operator for 95 ms (84-95 " +
      "ms in every such recording), a kernel-wide redraw nokia-os does not reproduce; the name " +
      "then follows the operator by 1931 ms (PROFILE_LINE_DELAY_MS 1912 from the C)",
  },
});
