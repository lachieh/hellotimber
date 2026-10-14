import { resources } from "../resource-inputs/13-foundation.ts";
// Plan 13's goldens (docs/plans/13-nokia-os-foundation.md "Capture set"): the boot, standby, the
// menu carousel, its animations and level-one lists.
import type { CaptureSetEntry, PlanCaptureSet } from "../capture-set.ts";
import { MENU_SLUGS } from "../capture-set.ts";

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

/** Plan 13's goldens: boot, standby, the carousel and its level lists. */
const ENTRIES: readonly CaptureSetEntry[] = [
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

export const foundation: PlanCaptureSet = {
  plan: "13",
  resources,
  lcd: () => ENTRIES,
  notImported: {
    "setup/": "virgin-EEPROM time and date wizard",
    "standby/00-first-standby-prompt": "virgin-EEPROM alarm state (Snooze, 0000000000)",
    "menu/NN-<slug>/anim": "3 s recordings that truncate animations; menu-anim-long replaces them",
    "boot/*.wav, *.events.csv": "sound is out of scope (tones plan)",
  },
};
