// Plan 15's goldens (docs/plans/15-storage-and-settings.md "Golden pipeline additions"; paths
// under plan15/): the boot gates and welcome notes, and the security-code probes.
import type { CaptureSetEntry, PlanCaptureSet } from "../capture-set.ts";
import { probeCaptureSet, type ProbeSpec } from "../tree-capture-set.ts";

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
    {
      id: "boot/security-lockout-4",
      kind: "timeline",
      status: "asserted",
      prefer: {
        source: {
          kind: "composite",
          parts: [{ dir: "plan15/boot/gate-lockout-4", from: 0, to: 43 }],
        },
        triggerFrame: 1,
        note: "The power-on prompt: four 00000 then 12345: Code accepted, then the hands (four wrong codes do not lock). Frame 1 is the first digit.",
        omitted: { "044-046": WIZARD },
      },
    },
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

const PROBE_STILLS: readonly ProbeSpec[] = [
  {
    name: "code-keys-6-4",
    dir: "menu/6-4-keys",
    note: "Plan 15 A5: Restore factory settings' prompt after each key: 1 2, C, C to empty, C on empty (back to the page), Select again, 1 2 3, OK (the empty prompt after Code error), 5-11 digits (10 at most), C held 1 s.",
    shots: [
      "00-entry",
      "01-prompt",
      "02-after-12",
      "03-after-c",
      "04-after-c-to-empty",
      "06-after-c-on-empty",
      "07-reopened",
      "09-typed-123",
      "11-after-ok-123",
      "12-digits-05",
      "13-digits-06",
      "14-digits-07",
      "15-digits-08",
      "16-digits-09",
      "17-digits-10",
      "18-digits-11",
      "19-after-hold-c-1s",
    ],
  },
  {
    name: "persist-reboot",
    dir: "persist",
    note: "Plan 15 A7: Keypad tones and Cell info display before, after choosing Level 2 and On, then standby after saveflash and reboot, and both pages and lists as they open.",
    shots: [
      "before-5-6-page",
      "before-5-6-list",
      "set-5-6-page",
      "before-6-2-2-page",
      "before-6-2-2-list",
      "set-6-2-2-page",
      "standby",
      "5-6-page",
      "5-6-list",
      "6-2-2-page",
      "6-2-2-list",
    ],
  },
  {
    name: "accept-restore-phone-security",
    dir: "accept",
    note: "Plan 15 0c: the Phone security page set On (code 11111), then after Restore factory settings: Off.",
    shots: ["c7-6-3-5-on", "c7-6-3-5-after-restore"],
  },
];

const PROBE_TIMELINES: readonly ProbeSpec[] = [
  ...(
    [
      ["6-3-5", "Phone security"],
      ["6-3-6-1", "Change security code"],
      ["6-4", "Restore factory settings"],
      ["4-5-5", "Show call duration › Clear timers"],
    ] as const
  ).map(([number, label]) => ({
    name: `code-wrong-${number}`,
    dir: `menu/${number}-wrong`,
    note: `Plan 15 A4: ${label} (${number}) Select, 00000 OK: Code error, the empty prompt, then C back to the page.`,
  })),
  ...(
    [
      ["c-on-empty", "05-c-on-empty", "C on the empty prompt: back to the page at once"],
      ["ok-empty", "08-ok-empty", "OK on the empty prompt: Code error, then the empty prompt"],
      ["ok-123", "10-ok-123", "OK with 1 2 3: Code error, then the empty prompt"],
    ] as const
  ).map(([name, dir, note]) => ({
    name: `code-keys-6-4-${name}`,
    dir: `menu/6-4-keys/${dir}`,
    note: `Plan 15 A5: Restore factory settings' prompt, ${note}.`,
  })),
  ...(
    [
      ["6-3-5-on", "Phone security Off, 12345: the Off/On list on Off, ▼, OK: Done, the page On"],
      [
        "6-3-5-off",
        "Phone security On, 12345: the Off/On list on On, to Off, OK: Done, the page Off",
      ],
      [
        "6-3-6-1-mismatch",
        "Change security code, 12345, new 11111, verify 22222: Code error, back to Enter new",
      ],
      [
        "6-3-6-1-lengths",
        "Change security code at Enter new: new codes of 4, 6, 0 and 10 digits, each OK'd: Code error, back to Enter new each time",
      ],
      [
        "6-3-6-1-match",
        "Change security code, 12345, new 11111, verify 11111: Security code changed, the page",
      ],
      ["6-4-old-code", "after the change, Restore factory settings' prompt with 12345: Code error"],
      [
        "6-4-new-code",
        "after the change, Restore factory settings' prompt with 11111: Settings restored, the page",
      ],
      ["6-4-restore", "Restore factory settings, 12345: Settings restored, the page"],
      [
        "c7-restore",
        "Phone security On and code 11111, then Restore factory settings with 11111: Settings restored",
      ],
      ["4-5-5", "Clear timers, 12345: Timers cleared, the page"],
    ] as const
  ).map(([flow, note]) => ({
    name: `accept-${flow}`,
    dir: `accept/${flow}`,
    note: `Plan 15 0c (re-provisioned code): ${note}.`,
  })),
];

export const storageAndSettings: PlanCaptureSet = {
  plan: "15",
  lcd: (io) => [
    ...plan15BootEntries(),
    ...probeCaptureSet(io.frames, {
      base: "plan15",
      stills: PROBE_STILLS,
      timelines: PROBE_TIMELINES,
    }),
  ],
  notImported: {
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
      "every list after Restore: transcribed into the features' factory defaults (src/firmware/features/, plan 15 Task 5), each entry citing its scroll",
    "plan15/*.wav, *.events.csv": "sound is out of scope (tones plan)",
  },
};

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}
