// Which REF captures become which golden fixtures. The importer executes this table; nothing
// else decides what is imported. Paths are relative to `$REF/captures/6.39`.
// See docs/plans/13-nokia-os-foundation.md "Capture set" and "Ground truth and artefacts".
import type { GoldenStatus, TriggerFrame } from "./golden-format.ts";

/** Frames `from`..`to` (inclusive, 0-based) of one `record` directory. */
export interface FrameRange {
  readonly dir: string;
  readonly from: number;
  readonly to: number;
}

export type CaptureSource =
  /** One `shot` PNG. */
  | { readonly kind: "shot"; readonly file: string }
  /** A whole `record` directory (NNN.png + timings.csv). */
  | { readonly kind: "recording"; readonly dir: string }
  /** Frame ranges of several recordings, concatenated into one timeline. */
  | { readonly kind: "composite"; readonly parts: readonly FrameRange[] }
  /** A `scroll` directory (01.png, 02.png, …), one still per screen. */
  | { readonly kind: "scroll"; readonly dir: string };

export interface SourceChoice {
  readonly source: CaptureSource;
  readonly triggerFrame?: TriggerFrame;
  readonly note?: string;
  /** Source frames left out on purpose, by name, with the reason. */
  readonly omitted?: Readonly<Record<string, string>>;
}

export interface CaptureSetEntry {
  readonly id: string;
  readonly kind: "still" | "timeline";
  readonly status: GoldenStatus;
  readonly prefer: SourceChoice;
  /** Used, and reported, when `prefer`'s files are absent. */
  readonly fallback?: SourceChoice;
  /** Optional rows are skipped silently when no source exists (Task 0 probes). */
  readonly optional?: boolean;
}

export const MENU_SLUGS = [
  "01-phone-book",
  "02-messages",
  "03-chat",
  "04-call-register",
  "05-tones",
  "06-settings",
  "07-call-divert",
  "08-games",
  "09-calculator",
  "10-reminders",
  "11-clock",
  "12-profiles",
] as const;

const LABELS: Record<(typeof MENU_SLUGS)[number], string> = {
  "01-phone-book": "Phone book",
  "02-messages": "Messages",
  "03-chat": "Chat",
  "04-call-register": "Call register",
  "05-tones": "Tones",
  "06-settings": "Settings",
  "07-call-divert": "Call divert",
  "08-games": "Games",
  "09-calculator": "Calculator",
  "10-reminders": "Reminders",
  "11-clock": "Clock",
  "12-profiles": "Profiles",
};

/** Capture artefacts and captures that are deliberately not imported, with the reason. */
export const NOT_IMPORTED: Readonly<Record<string, string>> = {
  "boot/security-code*, boot/security-code-entry": "virgin-EEPROM security-code prompt",
  "setup/": "virgin-EEPROM time and date wizard",
  "standby/00-first-standby-prompt": "virgin-EEPROM alarm state (Snooze, 0000000000)",
  "menu/NN-<slug>/anim": "3 s recordings that truncate animations; menu-anim-long replaces them",
  "game/": "out of scope (Snake II plans)",
  "boot/*.wav, *.events.csv": "sound is out of scope (tones plan)",
};

function menuEntries(): CaptureSetEntry[] {
  const entries: CaptureSetEntry[] = [];
  MENU_SLUGS.forEach((slug, i) => {
    const label = LABELS[slug];
    const previous = i === 0 ? "standby" : LABELS[MENU_SLUGS[i - 1]!];
    const key = i === 0 ? "Menu" : "▼";
    entries.push({
      id: `menu/${slug}`,
      kind: "still",
      status: "asserted",
      prefer: {
        source: { kind: "shot", file: `menu/${slug}.png` },
        note: `${label} carousel after its 3 s recording (the icon has settled).`,
      },
    });
    entries.push({
      id: `menu/${slug}.anim`,
      kind: "timeline",
      status: "asserted",
      prefer: {
        source: { kind: "recording", dir: `menu-anim-long/${slug}` },
        triggerFrame: 1,
        note:
          i === 0
            ? "Menu from standby at frame 1; frame 0 is standby. Frame 1 is a transient (bars erased); the carousel with the first-digit dots follows."
            : `${key} from ${previous} at frame 1; frame 0 is the previous screen.`,
      },
      fallback: {
        source: { kind: "recording", dir: `menu/${slug}/anim` },
        triggerFrame: "before-recording",
        note: `${key} from ${previous} before the recording started; truncated after 3 s.`,
      },
    });
    if (slug === "09-calculator") {
      entries.push({
        id: `menu/${slug}.sub`,
        kind: "still",
        status: "pending:20",
        prefer: {
          source: { kind: "scroll", dir: `menu/${slug}/sub` },
          note: "Calculator's first screen; the Calculator plan asserts it.",
        },
      });
      return;
    }
    if (slug === "03-chat") {
      entries.push({
        id: `menu/${slug}.sub`,
        kind: "still",
        status: "pending:18",
        prefer: {
          source: { kind: "scroll", dir: `menu/${slug}/sub` },
          note: "Chat's first screens; the Messages and Chat plan asserts them.",
        },
      });
      return;
    }
    entries.push({
      id: `menu/${slug}.sub`,
      kind: "still",
      status: "asserted",
      prefer: {
        source: { kind: "scroll", dir: `menu/${slug}/sub` },
        note: `${label} level 1: Select, then ▼ per image.`,
        ...(slug === "12-profiles"
          ? { omitted: { "06": "uninitialised EEPROM name drawn as two boxes" } }
          : {}),
      },
    });
  });
  return entries;
}

export const CAPTURE_SET: readonly CaptureSetEntry[] = [
  {
    id: "boot/power-on",
    kind: "timeline",
    status: "asserted",
    prefer: {
      source: { kind: "recording", dir: "boot-clean/power-on" },
      triggerFrame: 0,
      note: "Power key at the start of the recording.",
    },
    fallback: {
      source: {
        kind: "composite",
        parts: [
          { dir: "boot/power-on", from: 0, to: 3 },
          { dir: "boot/welcome", from: 4, to: 10 },
        ],
      },
      triggerFrame: 0,
      note: "D12 composition (UNVERIFIED as one sequence): self-test frames 0-3 of boot/power-on, then hands frames 4-10 of boot/welcome; the last hands frame is held for its captured duration, then standby.",
      omitted: {
        "power-on/004": "42 ms blank before the security-code prompt",
        "power-on/005": "virgin-EEPROM security-code prompt",
        "welcome/000-003": "virgin-EEPROM Code accepted animation",
        "welcome/011-015": "virgin-EEPROM clock prompt",
      },
    },
  },
  {
    id: "standby/standby",
    kind: "still",
    status: "asserted",
    prefer: {
      source: { kind: "shot", file: "standby/01-standby.png" },
      note: 'Standby; "Orange F" and 10:10 are emulator artefacts used as test inputs.',
    },
  },
  {
    id: "standby/idle",
    kind: "timeline",
    status: "asserted",
    prefer: {
      source: { kind: "recording", dir: "standby/standby-10s" },
      triggerFrame: 0,
      note: "10 s of standby with no key: nothing blinks or changes.",
    },
  },
  ...menuEntries(),
  {
    id: "menu/revisit.anim",
    kind: "timeline",
    status: "asserted",
    optional: true,
    prefer: {
      source: { kind: "recording", dir: "menu-anim-long/90-revisit" },
      triggerFrame: 1,
      note: "▲ from Profiles back to Clock at frame 1: the Clock icon restarts.",
    },
  },
  {
    id: "menu/return.anim",
    kind: "timeline",
    status: "asserted",
    optional: true,
    prefer: {
      source: { kind: "recording", dir: "menu-anim-long/91-return" },
      triggerFrame: 2,
      note: "Select on Clock at frame 1, C back to the carousel at frame 2: the Clock icon restarts.",
    },
  },
];
