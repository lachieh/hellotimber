// Plan 17's goldens (docs/plans/17-profiles.md "Golden pipeline additions"; paths under plan17/
// unless they name plan 14's): Activate, the standby name and icon, Tones following the active
// profile, the power key's list, Rename, persistence and the effects' sound. An explicit table:
// every row names its capture, how the trigger aligns, and the task whose scenarios assert it.
// A row is `pending:17` until its task is in ASSERTED_TASKS (plan 29 "Pending workflow").
//
// Pure: imports only sibling scripts, reads captures through the injected io.
import type { CaptureIo, CaptureSetEntry, PlanCaptureSet, ShotFile } from "../capture-set.ts";
import type { GoldenStatus, TriggerFrame } from "../golden-format.ts";
import {
  buildSoundGolden,
  type SoundCaptureEntry,
  type SoundCaptureIo,
} from "../sound-capture-set.ts";
import type { SoundGolden } from "../sound-format.ts";
import { firstChangedFrame, type TreeCaptureIo } from "../tree-capture-set.ts";
import { resources, THIN_GLYPH_PAGES } from "../resource-inputs/17-profiles.ts";

export { THIN_GLYPH_PAGES };

/** The tasks whose scenarios exist: their rows are asserted. */
export const ASSERTED_TASKS: ReadonlySet<ProfilesTask> = new Set<ProfilesTask>([]);

/** The plan 17 task that drives a row: 6 Activate and standby, 7 the power key, 8 Rename. */
export type ProfilesTask = 6 | 7 | 8;

export const PROFILE_SLUGS = ["general", "silent", "discreet", "loud", "empty", "empty-2"] as const;
type Slug = (typeof PROFILE_SLUGS)[number];
const NAMED: readonly Slug[] = PROFILE_SLUGS.slice(1);

export class ProfilesCaptureError extends Error {
  constructor(where: string, message: string) {
    super(`${where}: ${message}`);
    this.name = "ProfilesCaptureError";
  }
}

// ---------------------------------------------------------------- table rows

/**
 * A timeline: one recording (or frames `from`..`to` of it), aligned on its first changed frame
 * unless `trigger` says otherwise (0: the key changes nothing at once).
 */
export interface TimelineRow {
  readonly id: string;
  readonly dir: string;
  readonly task: ProfilesTask;
  readonly note: string;
  readonly trigger?: TriggerFrame;
  /** Keep frames up to this one; the rest is omitted for `omittedReason`. */
  readonly to?: number;
  readonly omittedReason?: string;
}

/** A still: named shots, each image named after its file stem unless given. */
export interface StillRow {
  readonly id: string;
  readonly files: readonly ShotFile[];
  readonly task: ProfilesTask;
  readonly note: string;
}

const P = "plan17";

const activateNote = (slug: Slug, from = "General"): string =>
  `${from} active (factory): Select on ${slug}'s Activate: \`Selected profile:\` and the name, the edges step, standby, the name under the operator ≈1.91 s later (none for General).`;

/** What a digit does in the power list (Task 0 B). */
const DIGIT_EFFECT: Readonly<Record<string, string>> = {
  "1": "Switch off! (the phone switches off)",
  "2": "General (Activate's note, standby)",
  "3": "Silent",
  "4": "Discreet",
  "5": "Loud",
  "6": "(empty)",
  "7": "slot 6",
  "8": "Invalid shortcut at once, then standby",
  "9": "Invalid shortcut at once, then standby",
  "0": "Invalid shortcut after the shortcut window, then standby",
  star: "nothing",
  hash: "nothing",
};

/** What each effects recording plays. */
const EFFECTS = {
  keys: "Menu, ▼, ▼, ▲, C in the carousel",
  invalid: "Menu 1 9: Invalid shortcut",
  preview: "Tones › Ringing tone, ▼ (a preview), ▲",
} as const;

export const TIMELINES: readonly TimelineRow[] = [
  // ------------------------------------------------------------ Task 6: Activate, standby
  ...PROFILE_SLUGS.map(
    (slug): TimelineRow => ({
      id: `profiles/activate-${slug}`,
      dir: `${P}/activate/${slug}`,
      task: 6,
      note: activateNote(slug),
      ...(slug === "discreet"
        ? {
            to: 6,
            omittedReason:
              "Discreet's operator line overwritten 15 ms after its name: the restored image's uninitialised screen saver picture; D10",
          }
        : {}),
    }),
  ),
  ...NAMED.map(
    (slug): TimelineRow => ({
      id: `profiles/activate-general-from-${slug}`,
      dir: `${P}/activate/general-from-${slug}`,
      task: 6,
      note: activateNote("general", slug),
    }),
  ),
  {
    id: "profiles/standby-menu",
    dir: `${P}/standby/menu-c`,
    task: 6,
    note: "Silent active: Menu (39 ms of standby with the ladders erased, the name kept), the carousel.",
    to: 4,
    omittedReason:
      "C 1.5 s later: the ladders without the operator for 87 ms; a kernel redraw nokia-os does not reproduce; see profiles/standby-carousel-c",
  },
  {
    id: "profiles/standby-carousel-c",
    dir: `${P}/standby/carousel-c`,
    task: 6,
    note: "Silent active, the carousel, C: 95 ms of the ladders without the operator, standby, the name 1931 ms after the operator.",
  },
  // ------------------------------------------------------------ Task 7: the power key
  ...(["general", "silent"] as const).flatMap((who): TimelineRow[] => [
    {
      id: `profiles/power-${who}-list`,
      dir: `${P}/power/${who}/list`,
      task: 7,
      note: `${who} active: the power key's short press at standby: 29 ms with the ladders erased, then the list on Switch off!.`,
    },
    {
      id: `profiles/power-${who}-power-keys`,
      dir: `${P}/power/${who}/power-keys`,
      task: 7,
      note: `${who} active: the power key, then three more presses ≈760 ms apart: each moves down.`,
    },
    {
      id: `profiles/power-${who}-c`,
      dir: `${P}/power/${who}/c`,
      task: 7,
      note: `${who} active: C on the list: the ladders without the operator for 84-88 ms, then standby.`,
    },
    {
      id: `profiles/power-${who}-switch-off`,
      dir: `${P}/power/${who}/switch-off`,
      task: 7,
      note: `${who} active: OK on Switch off!: the phone switches off.`,
    },
  ]),
  ...PROFILE_SLUGS.map(
    (slug, i): TimelineRow => ({
      id: `profiles/power-general-ok-${slug}`,
      dir: `${P}/power/general/ok-${slug}`,
      task: 7,
      note: `General active: the list, ▼×${i + 1}, OK on ${slug}: Activate's note and standby.`,
    }),
  ),
  {
    id: "profiles/power-silent-ok-general",
    dir: `${P}/power/silent/ok-general`,
    task: 7,
    note: "Silent active: the list, ▼, OK on General: Activate's note and standby (no name).",
  },
  ...["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "star", "hash"].map(
    (digit): TimelineRow => ({
      id: `profiles/power-general-digit-${digit}`,
      dir: `${P}/power/general/digit-${digit}`,
      task: 7,
      note: `General active: the list, then ${digit}: ${DIGIT_EFFECT[digit]}.`,
      ...(digit === "0" || digit === "star" || digit === "hash" ? { trigger: 0 } : {}),
    }),
  ),
  ...["1", "3"].map(
    (digit): TimelineRow => ({
      id: `profiles/power-silent-digit-${digit}`,
      dir: `${P}/power/silent/digit-${digit}`,
      task: 7,
      note: `Silent active: the list, then ${digit}: ${DIGIT_EFFECT[digit]}.`,
    }),
  ),
  {
    id: "profiles/power-general-held",
    dir: `${P}/power/general/held`,
    task: 7,
    note: "The power key held 1.5 s at standby: the list, then off ≈1033 ms after the down.",
  },
  {
    id: "profiles/power-general-idle",
    dir: `${P}/power/general/idle`,
    task: 7,
    note: "The list left alone for 60 s: nothing changes.",
  },
  {
    id: "profiles/power-during-note",
    dir: `${P}/power/elsewhere/note`,
    task: 7,
    note: "Select on Silent's Activate, the power key 760 ms into the note: the list (Silent stays active).",
  },
  {
    id: "profiles/power-virgin-list",
    dir: `${P}/rename-virgin/power-list`,
    task: 7,
    note: "Virgin EEPROM: the power key at standby: the list, slot 6 named with two boxes.",
  },
  // ------------------------------------------------------------ Task 8: Rename
  ...(["3", "4", "5", "6"] as const).map(
    (n): TimelineRow => ({
      id: `profiles/rename-open-12-${n}`,
      dir: `plan14/open/12-${n}-2-10`,
      task: 8,
      note: `Virgin: Select on 12-${n}-2-10 Rename: \`New name:\` with the profile's name and the cursor blink.`,
    }),
  ),
  ...NAMED.flatMap((slug): TimelineRow[] => [
    {
      id: `profiles/rename-${slug}-open`,
      dir: `${P}/rename/${slug}/open`,
      task: 8,
      note: `Factory: Select on ${slug}'s Rename page: the prompt with the name, the cursor blinking.`,
    },
    {
      id: `profiles/rename-${slug}-type`,
      dir: `${P}/rename/${slug}/type`,
      task: 8,
      note: `The prompt, 9 twice (w, x): the pending x, its commit, the blink.`,
    },
    {
      id: `profiles/rename-${slug}-ok`,
      dir: `${P}/rename/${slug}/ok`,
      task: 8,
      note: "OK on the name with x: Done (tick), then the Rename page with the new name.",
    },
  ]),
  ...(["silent", "empty-2"] as const).map(
    (slug): TimelineRow => ({
      id: `profiles/rename-${slug}-activate`,
      dir: `${P}/rename/${slug}/activate`,
      task: 8,
      note: `Renamed ${slug === "silent" ? "Silenth" : "Ab"}: Activate: the note and standby with the new name.`,
    }),
  ),
  {
    id: "profiles/rename-limit-extra",
    dir: `${P}/rename/limit/extra`,
    task: 8,
    note: "Silent + abc (1 left), 3 twice: d typed (0 left), its second press ignored.",
  },
  {
    id: "profiles/rename-limit-ok",
    dir: `${P}/rename/limit/ok`,
    task: 8,
    note: "OK on Silentabcd: Done, the page.",
  },
  {
    id: "profiles/rename-c-keys",
    dir: `${P}/rename/c-keys`,
    task: 8,
    note: "Loud's prompt: C (deletes), C held (clears, Abc), C on the empty entry (the page, Loud kept).",
  },
  ...(["silent", "empty", "empty-2"] as const).map(
    (slug): TimelineRow => ({
      id: `profiles/rename-${slug}-empty-ok`,
      dir: `${P}/rename/${slug}/empty-ok`,
      task: 8,
      note: `Factory: ${slug}'s prompt cleared (C held), OK: Done, the page with the factory name.`,
    }),
  ),
  ...(["empty", "empty-2"] as const).map(
    (slug): TimelineRow => ({
      id: `profiles/rename-virgin-${slug}-empty-ok`,
      dir: `${P}/rename-virgin/${slug}/empty-ok`,
      task: 8,
      note: `Virgin: ${slug}'s prompt cleared, OK: Done, the page with (empty).`,
    }),
  ),
  {
    id: "profiles/rename-symbols",
    dir: `${P}/rename/symbols`,
    task: 8,
    note: "Silent's prompt cleared, abc, a; * (the symbol table), ▼×16, Use, then 2 twice (b).",
  },
  {
    id: "profiles/restore",
    dir: `${P}/persist/restore`,
    task: 6,
    note: "Silenth, Ab, slot 6 active: Restore factory settings, 12345, OK: Settings restored.",
  },
];

const pages = (dir: string, count: number, name = (i: number) => `${i}`): ShotFile[] =>
  Array.from({ length: count }, (_, i) => ({ file: `${dir}-${i + 1}.png`, name: name(i + 1) }));

const ICON_CASES = [
  "general-alert-off",
  "general-vibra-off",
  "general-alert-off-vibra-off",
  "general-alert-off-keypad-off",
  "general-alert-off-warning-off",
  "general-alert-off-message-none",
  "general-alert-off-volume-1",
  "general-silent-values",
  "silent",
  "silent-alert-ringing",
  "silent-alert-beep-once",
  "silent-message-standard",
  "silent-keypad-2",
  "silent-warning-on",
  "silent-vibra-on",
  "silent-volume-4",
  "loud-alert-off",
  "discreet-alert-off",
] as const;

/** The `match/<case>/standby.png` stills: when General's line reads `Silent` (Task 0 A3). */
export const SILENT_TEXT_CASES = [
  "general-silent-values",
  "general-silent-values-volume-4",
  "general-silent-values-renamed",
  "general-alert-message-keypad-warning-off",
  "general-alert-message-vibra-off",
  "general-alert-message-vibra-keypad-off",
  "general-alert-message-vibra-warning-off",
  "general-silent-values-but-alert",
  "general-silent-values-but-message",
  "general-volume-3",
  "general-discreet-values",
  "loud-silent-values",
  "empty-2-silent-values",
  "silent-general-values",
] as const;

const everywhere = (dir: string): ShotFile[] => [
  `${dir}/standby.png`,
  ...Array.from({ length: 7 }, (_, i) => `${dir}/profiles-${i}.png`),
  ...Array.from({ length: 8 }, (_, i) => `${dir}/power-${i}.png`),
  ...Array.from({ length: 9 }, (_, i) => `${dir}/tones-${i + 1}.png`),
];

export const STILLS: readonly StillRow[] = [
  // ------------------------------------------------------------ Task 6
  {
    id: "profiles/icon",
    files: ICON_CASES.map((name) => `${P}/icon/${name}.png`),
    task: 6,
    note: "Standby after one or more Tones changes (image names): the icon top left exactly while Incoming call alert is Off.",
  },
  {
    id: "profiles/standby-silent-text",
    files: SILENT_TEXT_CASES.map((name) => ({ file: `${P}/match/${name}/standby.png`, name })),
    task: 6,
    note: "Standby with General (Loud, slot 6, Silent) given another profile's values: General reads `Silent` while its alert, message tone, keypad and warning tones are all off.",
  },
  ...PROFILE_SLUGS.map(
    (slug): StillRow => ({
      id: `profiles/tones-${slug}`,
      files: [
        ...pages(`${P}/tones/${slug}/page`, 9, (i) => `page-${i}`),
        `${P}/tones/${slug}/keypad-list.png`,
        `${P}/tones/${slug}/volume-list.png`,
      ],
      task: 6,
      note: `${slug} active: Tones pages 1-9 (Menu 5, ▼), then Tones › Keypad tones and › Ringing volume opened.`,
    }),
  ),
  {
    id: "profiles/tones-write",
    files: ["page", "silent-list", "general-list", "tones-list"].map(
      (name) => `${P}/tones/write/${name}.png`,
    ),
    task: 6,
    note: "Silent active, Tones › Keypad tones → Level 3: the page, then Silent's, General's and Tones' lists.",
  },
  {
    id: "profiles/opening",
    files: [
      ...PROFILE_SLUGS.map((slug) => `${P}/opening/${slug}.png`),
      `${P}/opening/visit-level.png`,
      `${P}/opening/visit-back.png`,
      `${P}/opening/after-visit.png`,
      `${P}/opening/boot-silent-standby.png`,
      `${P}/opening/boot-silent.png`,
      `${P}/opening/boot-discreet-standby.png`,
      `${P}/opening/boot-discreet.png`,
    ],
    task: 6,
    note: "Menu 1 2 with each profile active; Silent active: Discreet's level, C, C held, Menu 1 2; after a power cycle (Silent, Discreet).",
  },
  {
    id: "profiles/persist-after-boot",
    files: everywhere(`${P}/persist/after-boot`),
    task: 6,
    note: "Silenth and Ab renamed, slot 6 active, power cycle: standby, the Profiles level ▼×0-6, the power list ▼×0-7, Tones pages 1-9.",
  },
  {
    id: "profiles/persist-after-restore",
    files: everywhere(`${P}/persist/after-restore`),
    task: 6,
    note: "Then Restore factory settings: the same screens (General active, names reset).",
  },
  {
    id: "profiles/discreet-screen-saver-off",
    files: [{ file: `${P}/discreet/screen-saver-off/000.png`, name: "standby" }],
    task: 6,
    note: "Discreet active with its Screen saver Off: standby keeps the operator (25 s, no overwrite).",
  },
  // ------------------------------------------------------------ Task 7
  ...(["general", "silent"] as const).flatMap((who): StillRow[] => [
    {
      id: `profiles/power-${who}-down`,
      files: pages(`${P}/power/${who}/down`, 8),
      task: 7,
      note: `${who} active: the list, then ▼ 1-8 times (the circular window).`,
    },
    {
      id: `profiles/power-${who}-up`,
      files: pages(`${P}/power/${who}/up`, 8),
      task: 7,
      note: `${who} active: the list, then ▲ 1-8 times.`,
    },
  ]),
  {
    id: "profiles/power-virgin-down",
    files: pages(`${P}/rename-virgin/power`, 7),
    task: 7,
    note: "Virgin EEPROM: the list, then ▼ 1-7 times.",
  },
  // ------------------------------------------------------------ Task 8
  ...(["silent", "empty-2"] as const).map(
    (slug): StillRow => ({
      id: `profiles/rename-${slug}-everywhere`,
      files: [
        ...Array.from({ length: 7 }, (_, i) => `${P}/rename/${slug}/profiles-${i}.png`),
        `${P}/rename/${slug}/level.png`,
        ...Array.from({ length: 8 }, (_, i) => `${P}/rename/${slug}/power-${i}.png`),
        `${P}/rename/${slug}/page.png`,
      ],
      task: 8,
      note: `Renamed ${slug === "silent" ? "Silenth" : "Ab"}: the Profiles level ▼×0-6, the profile's level, the power list ▼×0-7, the Rename page.`,
    }),
  ),
  {
    id: "profiles/rename-limit",
    files: [1, 2, 3, 4].map((i) => ({ file: `${P}/rename/limit/${i}.png`, name: `${i}` })),
    task: 8,
    note: "Silent's prompt, then a, b, c (each committed): the counter down to 1.",
  },
  {
    id: "profiles/rename-empty-profiles",
    files: (["silent", "empty", "empty-2"] as const).map((slug) => ({
      file: `${P}/rename/${slug}/empty-profiles.png`,
      name: slug,
    })),
    task: 8,
    note: "After an empty name's OK: the Profiles level on the slot, its factory name back.",
  },
  {
    id: "profiles/rename-virgin-empty-profiles",
    files: (["empty", "empty-2"] as const).map((slug) => ({
      file: `${P}/rename-virgin/${slug}/empty-profiles.png`,
      name: slug,
    })),
    task: 8,
    note: "Virgin: after an empty name's OK: the Profiles level, slots 5 and 6 named (empty).",
  },
  {
    id: "profiles/rename-symbols-after",
    files: [`${P}/rename/symbols-page.png`, `${P}/rename/symbols-standby.png`],
    task: 8,
    note: "Silent renamed a_b: its Rename page, then standby after Activate.",
  },
  {
    id: "profiles/glyphs-thin",
    files: Array.from({ length: 7 }, (_, i) => `${P}/glyphs/thin/0${i + 1}.png`),
    task: 8,
    note: "Rename pages spelling the typeable characters the thin face lacked, one page per image",
  },
];

// ---------------------------------------------------------------- sound

export interface SoundRow {
  readonly id: string;
  readonly dir: string;
  readonly task: ProfilesTask;
  readonly note: string;
  readonly state?: string;
}

export const SOUNDS: readonly SoundRow[] = [
  ...PROFILE_SLUGS.map(
    (slug): SoundRow => ({
      id: `sound/profiles/activate-${slug}`,
      dir: `${P}/activate/${slug}`,
      task: 6,
      note: `General active: Select on ${slug}'s Activate: the key beeps at ${slug}'s Keypad tones level.`,
    }),
  ),
  ...(["silent", "loud", "discreet"] as const).map(
    (slug): SoundRow => ({
      id: `sound/profiles/shortcut-${slug}`,
      dir: `${P}/shortcut/${slug}`,
      task: 6,
      note: `Menu 1 2 ${PROFILE_SLUGS.indexOf(slug) + 1} 1: the last digit beeps at ${slug}'s level.`,
    }),
  ),
  ...PROFILE_SLUGS.flatMap((slug): SoundRow[] =>
    (["keys", "invalid", "preview"] as const).map((what) => ({
      id: `sound/profiles/effects-${slug}-${what}`,
      dir: `${P}/effects/${slug}/${what}`,
      task: 6,
      note: `${slug} active: ${EFFECTS[what]}.`,
    })),
  ),
  ...(["general", "silent"] as const).flatMap((who): SoundRow[] => [
    {
      id: `sound/profiles/power-${who}-list`,
      dir: `${P}/power/${who}/list`,
      task: 7,
      note: `${who} active: the power key at standby beeps at the keypad level.`,
    },
    {
      id: `sound/profiles/power-${who}-power-keys`,
      dir: `${P}/power/${who}/power-keys`,
      task: 7,
      note: `${who} active: four power presses: each beeps.`,
    },
    {
      id: `sound/profiles/power-${who}-switch-off`,
      dir: `${P}/power/${who}/switch-off`,
      task: 7,
      note: `${who} active: OK on Switch off!: the power-off tone instead of the key's beep.`,
    },
  ]),
  ...PROFILE_SLUGS.map(
    (slug): SoundRow => ({
      id: `sound/profiles/power-general-ok-${slug}`,
      dir: `${P}/power/general/ok-${slug}`,
      task: 7,
      note: `General active: OK on ${slug} in the power list beeps at ${slug}'s level.`,
    }),
  ),
  ...["1", "3", "8", "0", "star"].map(
    (digit): SoundRow => ({
      id: `sound/profiles/power-general-digit-${digit}`,
      dir: `${P}/power/general/digit-${digit}`,
      task: 7,
      note: `General active: ${digit} in the power list: ${DIGIT_EFFECT[digit]}.`,
    }),
  ),
];

// ---------------------------------------------------------------- entries

const status = (task: ProfilesTask): GoldenStatus =>
  ASSERTED_TASKS.has(task) ? "asserted" : "pending:17";

/** The LCD entries; `frames` (the importer's) aligns each timeline on its first change. */
export function profilesLcd(frames: TreeCaptureIo): CaptureSetEntry[] {
  const timelines = TIMELINES.map((row): CaptureSetEntry => {
    const recorded = frames.recording(row.dir);
    if (recorded === undefined) throw new ProfilesCaptureError(row.id, `no recording ${row.dir}`);
    if (row.to !== undefined && row.to >= recorded.length - 1) {
      throw new ProfilesCaptureError(row.id, `${row.dir} has no frame after ${row.to} to omit`);
    }
    const trigger = row.trigger ?? firstChangedFrame(recorded);
    const source =
      row.to === undefined
        ? ({ kind: "recording", dir: row.dir } as const)
        : ({ kind: "composite", parts: [{ dir: row.dir, from: 0, to: row.to }] } as const);
    const omitted =
      row.to === undefined
        ? undefined
        : { [`frames ${row.to + 1}-${recorded.length - 1}`]: row.omittedReason! };
    return {
      id: row.id,
      kind: "timeline",
      status: status(row.task),
      prefer: {
        source,
        triggerFrame: trigger,
        note: row.note,
        ...(omitted === undefined ? {} : { omitted }),
      },
    };
  });
  const stills = STILLS.map(
    (row): CaptureSetEntry => ({
      id: row.id,
      kind: "still",
      status: status(row.task),
      prefer: {
        source: { kind: "shots", files: row.files },
        note:
          row.id === "profiles/glyphs-thin"
            ? `${row.note}; manifest ${JSON.stringify(THIN_GLYPH_PAGES)}`
            : row.note,
      },
    }),
  );
  return [...timelines, ...stills];
}

export function profilesSounds(io: SoundCaptureIo): SoundGolden[] {
  return SOUNDS.map((row) => {
    const entry: SoundCaptureEntry = {
      id: row.id,
      dir: row.dir,
      state: row.state ?? "factory",
      status: status(row.task),
      note: row.note,
    };
    return buildSoundGolden(entry, io);
  });
}

export const profiles: PlanCaptureSet = {
  plan: "17",
  resources,
  lcd: (io: CaptureIo) => profilesLcd(io.frames),
  sounds: (io) => profilesSounds(io.sound),
  notImported: {
    "plan17/standby/{level-c-c,level-c-held,list-c-held,power-c,notice-c,boot}":
      "evidence for D5 (the name's delay per entry): key returns repeat standby-carousel-c's operator-less redraw; the notice is plan 18's painter; the power-on follows the clock wizard nokia-os does not have",
    "plan17/discreet/* (but screen-saver-off frame 0)":
      "Discreet's overwritten operator line: an uninitialised screen saver picture (D10, an artefact)",
    "plan17/match/*/{profiles,*-volume,tones-volume,power,standby-undone}.png":
      "evidence for the General `Silent` rule (Task 0 A3): the lists show the values as Tones does",
    "plan17/shortcut/*/ frames":
      "plan 14's shortcut timing (the typed leaf opens at the last digit); only the digit's beep is imported",
    "plan17/power/elsewhere/{notice,carousel,rows,pages,option-list,prompt,snake-menu}":
      "the short press elsewhere: nothing changes (Task 7 tests it); the notice needs plan 18's painter",
    "plan17/persist/boot": "an in-process reboot without the network (no operator): evidence only",
    "plan17/glyphs/thin/prompt-*.png, manifest.json":
      "the typed names' prompts (the cursor hides the last character); the manifest is transcribed as THIN_GLYPH_PAGES",
    "plan17/tones/*/ ringing previews, plan17/effects/*/ LCD":
      "the effects' LCD repeats the carousel and notes; only their sound is imported",
    "plan17/**/*@8x.png": "previews",
    "plan17/text.json": "OCR",
    "scratch-plan17/": "planning probes (plan 17 P1-P11), never imported",
  },
};
