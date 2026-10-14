// Which REF captures become which golden fixtures. The importer executes this table; nothing
// else decides what is imported. Paths are relative to `$REF/captures/6.39`.
// See docs/plans/13-nokia-os-foundation.md "Capture set" and "Ground truth and artefacts".
import type {
  GoldenKeyPress,
  GoldenScenario,
  GoldenStatus,
  TriggerFrame,
} from "./golden-format.ts";

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
  | { readonly kind: "scroll"; readonly dir: string }
  /** Named `shot` PNGs, one still each, named after the file stem. */
  | { readonly kind: "shots"; readonly files: readonly string[] }
  /** Single frames of `record` directories as named stills (plan 23 tick stills). */
  | {
      readonly kind: "frames";
      readonly frames: readonly {
        readonly name: string;
        readonly dir: string;
        readonly frame: number;
      }[];
    };

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
  /** Generated tree goldens (plan 14 D7): the generic scenario and the tree nodes covered. */
  readonly scenario?: GoldenScenario;
  readonly covers?: readonly string[];
  /** Game goldens (plan 23): the keys pressed, by engine tick. */
  readonly input?: readonly GoldenKeyPress[];
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
  "boot/power-on, boot/security-code*, boot/security-code-entry, boot/welcome":
    "the virgin-EEPROM power-on prompt; plan15/boot/gate records the same gate as one sequence and boot-clean/power-on the gate-free boot (plan 15 D9)",
  "boot/welcome 011-015, plan15/boot/*/ and factory/boot clock-wizard frames, boot-clean/first-standby":
    "virgin-EEPROM time and date wizard after the boot",
  "plan15/boot/gate-lockout-early, -expiry, -reboot, -restart":
    "lockout probes whose waits span minutes: their facts (≈290 s, restart, power cycle) are in the plan 15 Task 0 outcome",
  "plan15/boot/welcome-erased, plan15/welcome/":
    "the Welcome note editor and its notes: plan 18 owns the editor (plan 15 D12)",
  "plan15/accept/boot-*": "the new-SIM rule, asserted by plan 15 Task 8's tests (no new pixels)",
  "plan15/accept/c4-*, plan15/accept/c7-restore-again, plan15/accept/6-4-page":
    "Restore's setup screens (text editor, page shots) and a repeat of c7-restore",
  "plan15/factory/scroll/":
    "every list after Restore: transcribed into FACTORY_DEFAULTS (plan 15 Task 5), each entry citing its scroll",
  "plan15/*.wav, *.events.csv": "sound is out of scope (tones plan)",
  "setup/": "virgin-EEPROM time and date wizard",
  "standby/00-first-standby-prompt": "virgin-EEPROM alarm state (Snooze, 0000000000)",
  "menu/NN-<slug>/anim": "3 s recordings that truncate animations; menu-anim-long replaces them",
  "game/": "the first Snake II recording (level 175); plan 23's recaptures (plan23/) replace it",
  "plan23/bot/*/after/score-ids, plan23/virgin/after/score-ids":
    "Last/Top score IDs after a game are codes the firmware derives (plan 23 Open question 4)",
  "plan23/bot/grace/try-*": "the grace window probes; bot-grace holds the saved run",
  "plan23/sound/, plan23/*.wav, plan23/*.events.csv":
    "cue timing: plan 23 Task 10 reads the measured edges (plan 23 Task 0 outcome)",
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
      source: { kind: "composite", parts: [{ dir: "boot-clean/power-on", from: 0, to: 11 }] },
      triggerFrame: 0,
      note: "Power key at the start of the recording. The gate-free boot after Restore factory settings (plan 15 Task 0c): self-test, then the hands at irregular steps; the last hands frame is held until the clock wizard, then standby (plan 15 D9).",
      omitted: { "012-043": "virgin-EEPROM time and date wizard" },
    },
  },
  ...plan15BootEntries(),
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
  // Task 11 supplementary captures (`scripts/v639-plan13-clock.cap`): the setup's 10:10 shows
  // only some digits, so the same setup ran with the clock set to 19:48 and to 07:59.
  ...clockTimeEntries(),
  {
    id: "menu/01-phone-book.sub-up",
    kind: "still",
    status: "asserted",
    prefer: {
      source: { kind: "scroll", dir: "menu-scroll-up/01-phone-book" },
      note: "Phone book level 1 from item 6, ▲ per image through the wrap to Voice tags. The rows window keeps its position, ▲ above it puts the selection on the top row, and the wrap shows Voice tags, Search, Service Nos. (plan 14 D3).",
    },
  },
];

function clockTimeEntries(): CaptureSetEntry[] {
  return (["1948", "0759"] as const).flatMap((time): CaptureSetEntry[] => {
    const shown = `${time.slice(0, 2)}:${time.slice(2)}`;
    return [
      {
        id: `standby/standby-${time}`,
        kind: "still",
        status: "asserted",
        prefer: {
          source: { kind: "shot", file: `clock-time/${time}/standby.png` },
          note: `Standby with the clock set to ${shown} during setup (a test input, like 10:10).`,
        },
      },
      {
        id: `menu/11-clock.sub-${time}`,
        kind: "still",
        status: "asserted",
        prefer: {
          source: { kind: "scroll", dir: `clock-time/${time}/clock-sub` },
          note: `Clock level 1 with the clock set to ${shown}: Select, then ▼ per image.`,
        },
      },
    ];
  });
}

/** Plan 15's boot goldens (plan 15 "Golden pipeline additions"; paths under plan15/boot/). */
function plan15BootEntries(): CaptureSetEntry[] {
  const WIZARD = "virgin-EEPROM time and date wizard";
  const cut = (
    id: string,
    dir: string,
    to: number,
    last: number,
    note: string,
  ): CaptureSetEntry => ({
    id,
    kind: "timeline",
    status: "asserted",
    prefer: {
      source: { kind: "composite", parts: [{ dir, from: 0, to }] },
      triggerFrame: 0,
      note,
      omitted: { [`${pad3(to + 1)}-${pad3(last)}`]: WIZARD },
    },
  });
  const recording = (id: string, dir: string, note: string): CaptureSetEntry => ({
    id,
    kind: "timeline",
    status: "asserted",
    prefer: { source: { kind: "recording", dir }, triggerFrame: 1, note },
  });
  const keys = [
    "00-prompt",
    "01-after-1",
    "02-after-2",
    "03-after-c",
    "04-after-c-to-empty",
    "05-after-c-on-empty",
    "06-after-c-on-empty-2s",
    "07-digits-05",
    "08-digits-06",
    "09-digits-07",
    "10-digits-08",
    "11-digits-09",
    "12-digits-10",
    "13-digits-11",
    "14-after-hold-c-1s",
    "15-typed-123",
  ];
  return [
    cut(
      "boot/security-gate",
      "plan15/boot/gate",
      27,
      38,
      "Power key at the start. Phone security asks for the code: self-test, 42 ms blank, the prompt; 00000 OK: Code error, the empty prompt; 12345 OK: Code accepted, then the hands (regular steps).",
    ),
    {
      id: "boot/security-gate-keys",
      kind: "still",
      status: "asserted",
      prefer: {
        source: { kind: "shots", files: keys.map((name) => `plan15/boot/gate-keys/${name}.png`) },
        note: "The power-on prompt after each key: 1, 2, C, C to empty, C on empty (nothing, also 2 s later), 5-11 digits (10 at most), C held 1 s (clears), 1 2 3.",
      },
    },
    recording(
      "boot/security-gate-ok-123",
      "plan15/boot/gate-keys/ok-123",
      "The power-on prompt with 1 2 3, OK at frame 1: Code error, then the empty prompt.",
    ),
    recording(
      "boot/security-gate-ok-empty",
      "plan15/boot/gate-keys/ok-empty",
      "The empty power-on prompt, OK at frame 1: Code error, then the empty prompt.",
    ),
    recording(
      "boot/security-lockout",
      "plan15/boot/gate-lockout",
      "The power-on prompt: six 00000 then 12345, each OK'd; the sixth and 12345 get Code error too (five wrong codes lock every entry). Frame 1 is the first digit.",
    ),
    recording(
      "boot/security-lockout-4",
      "plan15/boot/gate-lockout-4",
      "The power-on prompt: four 00000 then 12345: Code accepted, then the hands (four wrong codes do not lock). Frame 1 is the first digit.",
    ),
    cut(
      "boot/welcome-note",
      "plan15/boot/welcome-hi",
      14,
      30,
      "Power key at the start; welcome note Hi and the code gate: 12345, Code accepted, then Hi in the large face instead of the hands.",
    ),
    cut(
      "boot/welcome-note-long",
      "plan15/boot/welcome-long",
      14,
      30,
      "As boot/welcome-note with the note Welcome to my phone, wrapped at the space.",
    ),
    cut(
      "boot/welcome-note-ungated",
      "plan15/factory/boot",
      5,
      38,
      "Power key at the start; welcome note Hi after Restore factory settings (no code gate): self-test, a 7 ms partial draw, then Hi (plan 15 D9).",
    ),
  ];
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}
