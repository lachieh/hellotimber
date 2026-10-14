// Plan 14's goldens (docs/plans/14-menu-depth-and-stock-widgets.md "Golden selection"): the
// generated tree selection (rules S1-S8 over `tree.json`, scripts/tree-capture-set.ts) and the
// Task 0 probes (S7), each with a hand-written scenario.
import type { PlanCaptureSet } from "../capture-set.ts";
import type { GoldenStatus } from "../golden-format.ts";
import { probeCaptureSet, treeCaptureSet, type ProbeSpec } from "../tree-capture-set.ts";

const PROBE_STILLS: readonly ProbeSpec[] = [
  {
    name: "wrap-down",
    dir: "wrap-down",
    note: "P1: Phone book ▼×9 (Voice tags), then ▼ per image past the wrap.",
  },
  ...(["reminders", "phone-book-erase", "games", "profiles"] as const).flatMap((list) =>
    (["down", "up"] as const).map((key) => ({
      name: `wrap-small-${list}-${key}`,
      dir: `wrap-small/${list}-${key}`,
      note: `P2: the list as it opens, then ${key === "down" ? "▼" : "▲"} per image through the wrap.`,
    })),
  ),
  {
    name: "return-top-row",
    dir: "return/top-row",
    note: "P3: Phone book ▼×5 ▲×2 (Erase on the top row), Select, C.",
  },
  {
    name: "return-bottom-row",
    dir: "return/bottom-row",
    note: "P3: Phone book ▼×3 (Erase on the bottom row), Select, C.",
  },
  {
    name: "return-wrapped",
    dir: "return/wrapped",
    note: "P3: Phone book ▲ (Voice tags on top), Select, C.",
  },
  {
    name: "reenter",
    dir: "reenter",
    note: "P4: Phone book ▼×5, C, Select: the window is rebuilt.",
  },
  {
    name: "unset-down",
    dir: "unset/down",
    note: "P10: Ringing volume opens unset, then ▼ per image.",
  },
  { name: "unset-up", dir: "unset/up", note: "P10: Ringing volume opens unset, then ▲ per image." },
  {
    name: "unset-reopen",
    dir: "unset/reopen",
    note: "P10: after ▼×6, C (the page) and Select: still unset.",
  },
  {
    name: "profile-share",
    dir: "profile-share",
    note: "P11: Tones › Ringing volume → Level 3; General's page and list show it, Silent's do not.",
    shots: [
      "01-level-3",
      "02-tones-page",
      "general-page",
      "general-list",
      "silent-page",
      "silent-list",
      "tones-page",
      "tones-list",
    ],
  },
  ...(
    [
      ["8-1-6", 5],
      ["8-2-4", 5],
      ["8-3-3", 5],
      ["8-4-1-5", 5],
      ["8-4-2-5", 4],
    ] as const
  ).map(([number, keep]) => ({
    name: `games-instructions-${number}`,
    dir: `games/instructions-${number}`,
    note: `P12: Instructions (${number}), More per image: the pages cycle back to the first.`,
    omitted: Object.fromEntries(
      Array.from({ length: 12 - keep }, (_, i) => [
        String(keep + i + 1).padStart(2, "0"),
        "the pages repeat",
      ]),
    ),
  })),
  {
    name: "set-delay",
    dir: "set-delay",
    note: "P13: Set delay opens unset (7-3-0), ▼ to 5 seconds.",
  },
  {
    name: "multiselect",
    dir: "multiselect",
    note: "P14: Language as it opens; after Unmark, ▼, Mark and C: Save changes?",
    shots: ["00", "after-c"],
  },
  {
    name: "prepaid-credit-info-display",
    dir: "prepaid/credit-info-display",
    note: "P15: Prepaid credit page 1, Select (On/Off list on Off), then ▼ per image.",
  },
  {
    name: "prepaid-recharge-status",
    dir: "prepaid/recharge-status",
    note: "P15: Prepaid credit page 4, Select (info pages), then ▼ per image.",
  },
];

const PROBE_TIMELINES: readonly ProbeSpec[] = [
  {
    name: "return-note",
    dir: "return/note/rec",
    note: "P3: Phone book ▼×4, Select on Edit: the note returns to the same window.",
  },
  ...(
    [
      ["m1", "Menu 1: waits for a second digit, then opens Phone book."],
      ["m1-8", "Menu 1 8: Invalid shortcut, then standby."],
      [
        "m1-8-1",
        "Menu 1 8 1: Invalid shortcut, then the digit starts a number at standby.",
        "pending:22",
      ],
      ["m1-8-1-2", "Menu 1 8 1 2: Invalid shortcut, then the number 12.", "pending:22"],
      ["m1-1-0", "Menu 1 1 0: Clock (11), then 11-0 and Invalid shortcut when the window ends."],
      ["m1-2", "Menu 1 2: Profiles (12) opens after the delay, then 12- and dots."],
      ["m8-1", "Menu 8 1: the Snake II splash, the Games list at 8-1, then the game menu."],
      ["m8-1-2", "Menu 8 1 2: the 2 skips the splash; the game menu ends on New game."],
      ["m8-6", "Menu 8 6: Games list at 8-6 without the soft key, then Settings opens."],
      ["m8-6-3", "Menu 8 6 3: the Shakes page, then its option list opens."],
      [
        "m1-wait-9",
        "Menu 1, wait (Phone book opens), 9: Speed dials on the top row, then its prompt.",
      ],
      ["m1-9-c/rec", "Menu 1 9: Invalid shortcut, then C at standby.", "pending:22"],
    ] as readonly (readonly [string, string, GoldenStatus?])[]
  ).map(([dir, note, status]) => ({
    name: `shortcut-${dir.replace("/rec", "")}`,
    dir: `shortcut/${dir}`,
    note: `P5: ${note}`,
    ...(status === undefined ? {} : { status }),
  })),
  {
    name: "note-keys-done-down-300",
    dir: "note-keys/done-down-300",
    note: "P6: Name list OK, ▼ 300 ms into Done.",
  },
  {
    name: "note-keys-service-nos-c-500",
    dir: "note-keys/service-nos-c-500",
    note: "P6: Service Nos. Select, C 500 ms into the note.",
  },
  {
    name: "progress-7-6-quit",
    dir: "progress/7-6-quit",
    note: "P7: Cancel all diverts: Requesting for 10 s, then Quit.",
  },
  {
    name: "progress-6-2-4-2-c",
    dir: "progress/6-2-4-2-c",
    note: "P7: Network selection › Manual: Searching for 10 s, then C.",
  },
  {
    name: "confirm-5-2-5-c",
    dir: "confirm/5-2-5-c/rec",
    note: "P8: Ringing volume › Level 5 OK, then C on the query.",
  },
  {
    name: "confirm-5-2-5-ok",
    dir: "confirm/5-2-5-ok/rec",
    note: "P8: Ringing volume › Level 5 OK, then OK on the query.",
  },
  {
    name: "confirm-8-6-4-c",
    dir: "confirm/8-6-4-c",
    note: "P8: Club Nokia ID Select, then C on the query.",
  },
  {
    name: "confirm-8-6-4-ok",
    dir: "confirm/8-6-4-ok",
    note: "P8: Club Nokia ID Select, then OK on the query.",
  },
  {
    name: "confirm-10-3-2-yes",
    dir: "confirm/10-3-2-yes",
    note: "P8: Reminders › Erase › All OK, then Yes.",
    status: "pending:21",
  },
  ...(["1-1", "1-9", "6-4", "11-5"] as const).map((number) => ({
    name: `prompts-${number}`,
    dir: `prompts/${number}`,
    note: `P9: ${number} Select, 5 s, then C.`,
  })),
  { name: "unset-quit", dir: "unset/quit", note: "P10: Quit while Ringing volume is unset." },
  ...(["8-1", "8-2", "8-3", "8-4"] as const).map((number) => ({
    name: `games-splash-${number}`,
    dir: `games/splash-${number}`,
    note: `P12: Select on ${number}: the splash, then the game menu.`,
  })),
  ...(["down", "c", "menu"] as const).map((key) => ({
    name: `games-splash-skip-${key}`,
    dir: `games/splash-skip-${key}`,
    note: `P12: Select on Snake II, ${key === "down" ? "▼" : key === "c" ? "C" : "Navi"} 300 ms into the splash.`,
  })),
  { name: "games-level-keys", dir: "games/level-keys", note: "P12: Level Select, ▲, ▼, OK." },
  { name: "games-level-c", dir: "games/level-c", note: "P12: Level Select, C." },
  {
    name: "games-top-score-wait",
    dir: "games/top-score-wait",
    note: "P12: Top score Select, no key for 9 s.",
  },
  {
    name: "games-top-score-c-2s",
    dir: "games/top-score-c-2s",
    note: "P12: Top score Select, C at 2 s.",
  },
  {
    name: "games-top-score-down-2s",
    dir: "games/top-score-down-2s",
    note: "P12: Top score Select, ▼ at 2 s.",
  },
  {
    name: "games-instructions-c",
    dir: "games/instructions-c",
    note: "P12: Instructions Select, More, C.",
  },
  {
    name: "set-delay.rec",
    dir: "set-delay/rec",
    note: "P13: OK on 5 seconds: straight back to the Call divert page.",
  },
  {
    name: "multiselect.rec",
    dir: "multiselect/rec",
    note: "P14: Language: Unmark on All, ▼, Mark on Suomi, C.",
  },
];

export const menuDepth: PlanCaptureSet = {
  plan: "14",
  lcd: (io) => [
    ...probeCaptureSet(io.frames, {
      base: "plan14/probe",
      stills: PROBE_STILLS,
      timelines: PROBE_TIMELINES,
    }),
    ...treeCaptureSet(io.tree, io.frames),
  ],
};
