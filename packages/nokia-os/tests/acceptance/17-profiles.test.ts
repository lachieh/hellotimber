// Plan 17's acceptance (docs/plans/17-profiles.md Tasks 6-9): every asserted profiles golden.
// Each scenario rebuilds the capture's state (gen_v639_plan17.py: plan 15's factory image, the
// active profile, names and Tones values seeded) and replays its keys. Timelines (some replay
// another recording's timing: the Activate notes are the virgin tree recordings' timelines)
// compare by the fidelity standard (tests/support/golden.ts); stills compare pixels exactly.
import type { PhoneKey } from "@hellotimber/phone-core";
import { PROFILE_SLUGS, type ProfileSlug } from "../../src/firmware/features/profiles";
import { MULTITAP_KEYS } from "../../src/text/keys";
import { THIN_GLYPH_PAGES } from "../../scripts/capture-sets/17-profiles.ts";
import { acceptancePlan, type Scenario } from "../support/acceptance.ts";
import { recordingScenario, type RecordingKey } from "../support/calculator.ts";
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockSettings } from "../../src/firmware/settings";
import { expectLcd, expectTimeline } from "../support/golden.ts";
import { goldenImage, loadGolden } from "../support/goldens.ts";
import { goto } from "../support/drive.ts";
import { keys } from "../support/probes.ts";
import {
  cutRecordingScenario,
  profilesRig,
  profilesStorage,
  shortcut,
  slot,
  toLevel,
  toStandby,
  type ProfilesSeed,
} from "../support/profiles.ts";
import { standbyRig, type Rig } from "../support/rig.ts";
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
        if (slug === "discreet") cutRecordingScenario(id, rig, "navi");
        else recordingScenario(id, rig, key("navi"), []);
      },
    ]),
  ),
  ...Object.fromEntries(
    NAMED.map((slug) => [
      `profiles/activate-general-from-${slug}`,
      (id: string) => {
        const rig = profilesRig(profilesStorage({ active: slug }));
        toLevel(rig, "general");
        recordingScenario(id, rig, key("navi"), []);
      },
    ]),
  ),
  // Silent active: Menu keeps the name (and the icon) while it erases the ladders.
  // The carousel's Phone book icon replays plan 13's recording of it (menu/01-phone-book.anim).
  "profiles/standby-menu": (id) =>
    cutRecordingScenario(id, profilesRig(profilesStorage({ active: "silent" })), "navi"),
  "profiles/standby-carousel-c": (id) => {
    const rig = profilesRig(profilesStorage({ active: "silent" }));
    rig.press("navi");
    // C while Phone book's icon shows frame 0's step (1170-1340 ms after Menu).
    rig.advance(1250);
    recordingScenario(id, rig, key("c"), []);
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
    recordingScenario(id, rig, key("navi"), []);
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
            // The capture stopped 1 s after ▲, before ▲'s own preview of Nokia tune began.
            expectSound(id, rig, "", { endMs: 6090 });
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
        [`profiles/power-${who}-c`, (id: string) => recordingScenario(id, listed(), key("c"), [])],
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
  // timeline), standby and the name.
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
              ? cutRecordingScenario(id, listed(), "navi")
              : recordingScenario(id, listed(), key("navi"), []),
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
    recordingScenario(id, rig, key("navi"), []);
  },
  ...Object.fromEntries(
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "star", "hash"].map((digit) => [
      `profiles/power-general-digit-${digit}`,
      (id: string) => {
        const rig = profilesRig();
        openPowerList(rig);
        const k = (DIGIT_KEYS[digit] ?? digit) as PhoneKey;
        if (digit === "0" || digit === "star" || digit === "hash") unchangedAtKey(id, rig, k);
        else if (digit === "4") cutRecordingScenario(id, rig, k);
        else recordingScenario(id, rig, key(k), []);
      },
    ]),
  ),
  ...Object.fromEntries(
    ["1", "3"].map((digit) => [
      `profiles/power-silent-digit-${digit}`,
      (id: string) => {
        const rig = profilesRig(profilesStorage({ active: "silent" }));
        openPowerList(rig);
        recordingScenario(id, rig, key(digit as PhoneKey), []);
      },
    ]),
  ),
  ...Object.fromEntries(
    ["1", "3", "8", "0", "star"].map((digit) => [
      `sound/profiles/power-general-digit-${digit}`,
      (id: string) => {
        const rig = profilesRig();
        openPowerList(rig);
        expectSound(id, rig, "");
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
    recordingScenario(id, rig, key("navi"), [key("power", 3)]);
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

// ---------------------------------------------------------------- Task 8: Rename

/** Standby → the profile's Rename page (the capture's `rename_page`: its level, ▲, 1 s). */
function toRenamePage(rig: Rig, slug: ProfileSlug): void {
  shortcut(rig, 1, 2, slot(slug), 2);
  rig.press("up");
  rig.advance(1592);
}

/**
 * Standby → the Rename prompt (`rename_prompt`: the page, OK, 1.5 s). The firmware draws the
 * prompt 80 ms after OK's down and its cursor blinks from there (rename/<slug>/open); nokia-os
 * opens it at the key, so a still compared later on the free-running blink comes `early`.
 */
function toRenamePrompt(rig: Rig, slug: ProfileSlug, early = 0): void {
  toRenamePage(rig, slug);
  rig.press("navi");
  rig.advance(2092 - early);
}

/** OK's key-to-redraw on the Rename page (rename/<slug>/open): stills shift by it. */
const PROMPT_LATENCY_MS = 80;

/** The Rename prompt cleared (C held 1.5 s, 0.8 s), as the empty-name recordings start. */
function clearedPrompt(rig: Rig, slug: ProfileSlug): void {
  toRenamePrompt(rig, slug);
  rig.press("c", 1500);
  rig.advance(1000);
}

/** Multi-tap `text` on the prompt as the capture typed it (one tap per 592 ms, 1.7 s commits). */
function typeText(rig: Rig, text: string): void {
  let previous: string | undefined;
  for (const [k, presses] of pressesOf(text)) {
    if (k === previous) rig.advance(1700);
    for (let i = 0; i < presses; i++) {
      rig.press(k);
      rig.advance(592);
    }
    previous = k;
  }
  rig.advance(1700);
}

/** The keys and presses typing lower case `text` (plan 18's cycles). */
function pressesOf(text: string): [PhoneKey, number][] {
  return Array.from(text, (ch): [PhoneKey, number] => {
    for (const [k, cycles] of Object.entries(MULTITAP_KEYS)) {
      const at = cycles.lower.indexOf(ch);
      if (at >= 0) return [k as PhoneKey, at + 1];
    }
    throw new Error(`${ch} is not typeable in lower case`);
  });
}

const TASK_8: Record<string, Scenario> = {
  // Virgin: Select on 12-n-2-10 (plan 14's recordings of the other profiles' prompts).
  ...Object.fromEntries(
    ["3", "4", "5", "6"].map((n) => [
      `profiles/rename-open-12-${n}`,
      (id: string) => {
        const rig = standbyRig();
        goto(rig, `12-${n}-2-10`);
        rig.advance(592);
        recordingScenario(id, rig, key("navi"), []);
      },
    ]),
  ),
  ...Object.fromEntries(
    NAMED.flatMap((slug) => {
      const page = () => {
        const rig = profilesRig();
        toRenamePage(rig, slug);
        return rig;
      };
      // The open recording (3 s) and its stop, then the type recording: 9 twice (w, then x).
      const prompt = () => {
        const rig = page();
        rig.press("navi");
        rig.advance(3030);
        return rig;
      };
      const typed = () => {
        const rig = prompt();
        rig.press("9");
        rig.advance(300);
        rig.press("9");
        rig.advance(2530);
        return rig;
      };
      return [
        [
          `profiles/rename-${slug}-open`,
          (id: string) => recordingScenario(id, page(), key("navi"), []),
        ],
        [
          `profiles/rename-${slug}-type`,
          // The second 9 on the row its x appears (the commit is timed from that redraw).
          (id: string) => recordingScenario(id, prompt(), key("9"), [key("9", 2)]),
        ],
        [
          `profiles/rename-${slug}-ok`,
          (id: string) => recordingScenario(id, typed(), key("navi"), []),
        ],
      ];
    }),
  ),
  ...Object.fromEntries(
    (
      [
        ["silent", "Silenth"],
        ["empty-2", "Ab"],
      ] as const
    ).flatMap(([slug, name]) => [
      [
        `profiles/rename-${slug}-activate`,
        (id: string) => {
          const rig = profilesRig(profilesStorage({ names: { [slug]: name } }));
          toLevel(rig, slug);
          recordingScenario(id, rig, key("navi"), []);
        },
      ],
      [
        `profiles/rename-${slug}-everywhere`,
        (id: string) => {
          const rig = profilesRig(profilesStorage({ names: { [slug]: name } }));
          stepStills(id, rig, [
            (r) => shortcut(r, 1, 2),
            ...Array.from({ length: 6 }, () => down(-92)),
            (r) => {
              toStandby(r);
              shortcut(r, 1, 2, slot(slug));
            },
            (r) => {
              toStandby(r);
              openPowerList(r);
            },
            ...Array.from({ length: 7 }, () => down(-92)),
            (r) => {
              r.press("c");
              r.advance(2592);
              toRenamePage(r, slug);
            },
          ]);
        },
      ],
    ]),
  ),
  // Silent + a, b, c (each committed), then d: the counter at 0.
  "profiles/rename-limit": (id) => {
    const rig = profilesRig();
    toRenamePrompt(rig, "silent", PROMPT_LATENCY_MS);
    stepStills(id, rig, [
      (r) => typeText(r, "a"),
      (r) => typeText(r, "b"),
      (r) => typeText(r, "c"),
      (r) => typeText(r, "d"),
    ]);
  },
  // At the limit 3 changes nothing: the golden runs from the key (trigger-frame 0).
  "profiles/rename-limit-extra": (id) => {
    const rig = profilesRig();
    toRenamePrompt(rig, "silent", PROMPT_LATENCY_MS);
    typeText(rig, "abcd");
    unchangedAtKey(id, rig, "3");
  },
  "profiles/rename-limit-ok": (id) => {
    const rig = profilesRig();
    toRenamePrompt(rig, "silent");
    typeText(rig, "abcd");
    rig.press("3");
    rig.advance(300);
    rig.press("3");
    rig.advance(2530);
    recordingScenario(id, rig, key("navi"), []);
  },
  // Loud's prompt: C (deletes), C held 1.5 s (clears), C on the empty entry (the page).
  "profiles/rename-c-keys": (id) => {
    const rig = profilesRig();
    toRenamePrompt(rig, "loud");
    recordingScenario(
      id,
      rig,
      key("c"),
      // Each later C on the row its deletion appears.
      [key("c", 4, 1500), key("c", 11)],
    );
  },
  ...Object.fromEntries(
    (["silent", "empty", "empty-2"] as const).flatMap((slug) => [
      [
        `profiles/rename-${slug}-empty-ok`,
        (id: string) => {
          const rig = profilesRig();
          clearedPrompt(rig, slug);
          recordingScenario(id, rig, key("navi"), []);
        },
      ],
    ]),
  ),
  ...Object.fromEntries(
    (["empty", "empty-2"] as const).map((slug) => [
      `profiles/rename-virgin-${slug}-empty-ok`,
      (id: string) => {
        const rig = profilesRig(profilesStorage({ virgin: true }), { virgin: true });
        clearedPrompt(rig, slug);
        recordingScenario(id, rig, key("navi"), []);
      },
    ]),
  ),
  "profiles/rename-empty-profiles": (id) =>
    seededStills(id, { silent: {}, empty: {}, "empty-2": {} }, (rig, image) => {
      shortcut(rig, 1, 2);
      for (let i = 1; i < slot(image as ProfileSlug); i++) {
        rig.press("down");
        rig.advance(342);
      }
      rig.advance(600 - 342);
    }),
  "profiles/rename-virgin-empty-profiles": (id) => {
    for (const slug of ["empty", "empty-2"] as const) {
      const storage = profilesStorage({ virgin: true, names: { [slug]: "" } });
      const rig = profilesRig(storage, { virgin: true });
      shortcut(rig, 1, 2);
      for (let i = 1; i < slot(slug); i++) {
        rig.press("down");
        rig.advance(342);
      }
      rig.advance(600 - 342);
      expectLcd(rig.paint(), goldenImage(id, slug), `${id} ${slug}`);
    }
  },
  // a, then * (the symbol table), ▼×16, Use, then 2 twice (b).
  "profiles/rename-symbols": (id) => {
    const rig = profilesRig();
    toRenamePrompt(rig, "silent");
    rig.press("c", 1500);
    rig.advance(800);
    keys(rig, "# #");
    rig.advance(800);
    keys(rig, "2");
    rig.advance(1700);
    // The keys' downs (rename/symbols/keys.csv), less *'s 66 ms redraw (the trigger).
    const at = (ms: number) => ({ ms: ms - 66 });
    const downs = Array.from({ length: 16 }, (_, i) => key("down", at(1060 + 300 * i)));
    recordingScenario(id, rig, key("*"), [
      ...downs,
      key("navi", at(6461)),
      key("2", at(8021)),
      key("2", at(8321)),
    ]);
  },
  "profiles/rename-symbols-after": (id) => {
    const rig = profilesRig(profilesStorage({ names: { silent: "a_b" } }));
    stepStills(id, rig, [
      (r) => toRenamePage(r, "silent"),
      (r) => {
        toStandby(r);
        toLevel(r, "silent");
        r.press("navi");
        r.advance(9000);
      },
    ]);
  },
  "profiles/glyphs-thin": (id) =>
    seededStills(
      id,
      Object.fromEntries(
        THIN_GLYPH_PAGES.map((page, i) => [`0${i + 1}`, { names: { silent: page } }]),
      ),
      (rig) => toRenamePage(rig, "silent"),
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

/** Rename's cursor phase after several commits typed at the captures' pace. */
const RENAME_BLINK =
  "after a run of multi-tap commits the firmware's cursor is in the other blink phase at this " +
  "point (one 15-row column differs); the prompt restarts its blink at a commit " +
  "(rename-*-type), but a commit's time after several letters is not pinned by these shots";

acceptancePlan({
  plan: "17",
  scenarios: { ...TASK_6, ...TASK_7, ...TASK_8 },
  knownGaps: {
    "profiles/rename-limit": RENAME_BLINK,
    "profiles/rename-limit-extra": RENAME_BLINK,
    "profiles/rename-limit-ok": RENAME_BLINK,
    "profiles/rename-symbols": RENAME_BLINK,
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
