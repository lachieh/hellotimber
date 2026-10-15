// Plan 17's acceptance (docs/plans/17-profiles.md Tasks 6-9): every asserted profiles golden.
// Each scenario rebuilds the capture's state (gen_v639_plan17.py: plan 15's factory image, the
// active profile, names and Tones values seeded) and replays its keys. Timelines that replay
// another recording's timing (the Activate notes are the virgin tree recordings' timelines)
// compare within PROBE_TOLERANCE_MS; stills compare pixels exactly.
import type { PhoneKey } from "@hellotimber/phone-core";
import { PROFILE_SLUGS } from "../../src/firmware/features/profiles";
import { acceptancePlan, type Scenario } from "../support/acceptance.ts";
import { recordingScenario, type RecordingKey } from "../support/calculator.ts";
import { expectLcd, PROBE_TOLERANCE_MS } from "../support/golden.ts";
import { goldenImage, loadGolden } from "../support/goldens.ts";
import { keys } from "../support/probes.ts";
import {
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
        if (slug === "discreet") cutRecordingScenario(id, rig, "navi", PROBE_TOLERANCE_MS);
        else recordingScenario(id, rig, key("navi"), [], PROBE_TOLERANCE_MS);
      },
    ]),
  ),
  ...Object.fromEntries(
    NAMED.map((slug) => [
      `profiles/activate-general-from-${slug}`,
      (id: string) => {
        const rig = profilesRig(profilesStorage({ active: slug }));
        toLevel(rig, "general");
        recordingScenario(id, rig, key("navi"), [], PROBE_TOLERANCE_MS);
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
  scenarios: { ...TASK_6 },
  knownGaps: {
    "profiles/activate-empty":
      "the note's tick is 27 ms shorter here than in the virgin 12-5-1 recording whose timeline " +
      "slot 5 plays (1974 against 1987 ms); every other slot's recordings agree within 25 ms",
    "profiles/standby-carousel-c":
      "a key's return to standby first draws the ladders without the operator for 95 ms (84-95 " +
      "ms in every such recording), a kernel-wide redraw nokia-os does not reproduce; the name " +
      "then follows the operator by 1931 ms (PROFILE_LINE_DELAY_MS 1912 from the C)",
  },
});
