// Plan 25's goldens (docs/plans/25-keyguard-and-backlight.md "Golden pipeline additions"): the
// keyguard's LCD timelines and stills, lights goldens from the 1 ms LED logs (`<dir>.lights.csv`,
// Task 0's harness copy) and the keyguard's sound goldens. Sources are under
// `$REF/captures/6.39/plan25/`.
//
// Statuses (plan 29's pending workflow): a golden whose screens belong to a later plan names it
// (`pending:18`, `pending:22`); every other golden is `pending:25` until the plan 25 task that
// drives it promotes it here (Tasks 4 and 7-9). Task 4 asserts the timeout, key, boot and
// power-key lights goldens (tests/support/lights.ts `lightsScenario`), Task 7 the keyguard's LCD
// goldens (tests/support/keyguard.ts `keyguardTimeline`).
import type { CaptureSetEntry, PlanCaptureSet } from "../capture-set.ts";
import type { GoldenStatus } from "../golden-format.ts";
import type { LightName, LightsCaptureIo, LightsGolden, LightsRow } from "../lights-format.ts";
import { resources } from "../resource-inputs/25-keyguard-and-backlight.ts";
import {
  alignOnKeys,
  buildSoundGolden,
  parseKeysCsv,
  type SoundCaptureEntry,
} from "../sound-capture-set.ts";
import type { TreeCaptureIo } from "../tree-capture-set.ts";

const P = "plan25";
const OWN: GoldenStatus = "pending:25";
const ASSERTED: GoldenStatus = "asserted";
const MESSAGES: GoldenStatus = "pending:18";
const CALLS: GoldenStatus = "pending:22";
/** Recordings this close (same images, every frame start within it) share one golden. */
const SHARE_TOLERANCE_MS = 2;

// ---------------------------------------------------------------- lights goldens

export interface LightsCaptureEntry {
  readonly id: string;
  /** The recording, relative to `captures/6.39`. */
  readonly dir: string;
  /** `virgin`, `factory` or the image the recording started from. */
  readonly state: string;
  readonly status: GoldenStatus;
  readonly note: string;
}

export class LightsCaptureError extends Error {
  constructor(where: string, message: string) {
    super(`${where}: ${message}`);
    this.name = "LightsCaptureError";
  }
}

interface LedRow {
  readonly ms: number;
  readonly display: boolean;
  readonly keypad: boolean;
}

/** `<dir>.lights.csv`: the power-on comment, the header, then `t_ms,lcd_led,kbd_led` rows. */
export function parseLightsCsv(text: string, where: string): { powerOnMs: number; rows: LedRow[] } {
  const lines = text.trim().split("\n");
  const powerOn = /^# power_on_ms=([0-9]+(?:\.[0-9]+)?)$/.exec(lines[0] ?? "");
  if (!powerOn) throw new LightsCaptureError(`${where}:1`, 'expected "# power_on_ms=<ms>"');
  if (lines[1] !== "t_ms,lcd_led,kbd_led") {
    throw new LightsCaptureError(
      `${where}:2`,
      `expected "t_ms,lcd_led,kbd_led", got "${lines[1]}"`,
    );
  }
  const rows = lines.slice(2).map((line, i) => {
    const cells = line.split(",");
    if (
      cells.length !== 3 ||
      !Number.isFinite(Number(cells[0])) ||
      !/^[01]$/.test(cells[1]!) ||
      !/^[01]$/.test(cells[2]!)
    ) {
      throw new LightsCaptureError(`${where}:${i + 3}`, `bad row "${line}"`);
    }
    return { ms: Number(cells[0]), display: cells[1] === "1", keypad: cells[2] === "1" };
  });
  if (rows[0]?.ms !== 0) throw new LightsCaptureError(`${where}:3`, "the first row is not at 0");
  return { powerOnMs: Number(powerOn[1]), rows };
}

/**
 * A lights golden: each light's changes, aligned on the first key-down (else the recording's
 * start), with the power-on that far before time 0 and the recording's end (its last LCD frame's,
 * the LED log having started with it). A light already on at the start gets a row there (every
 * light is off before its first row).
 */
export function buildLightsGolden(
  entry: LightsCaptureEntry,
  io: LightsCaptureIo,
  frames: TreeCaptureIo,
): LightsGolden {
  const logText = io.lights(entry.dir);
  if (logText === undefined) {
    throw new LightsCaptureError(entry.id, `missing ${entry.dir}.lights.csv`);
  }
  const keysText = io.keys(entry.dir);
  if (keysText === undefined)
    throw new LightsCaptureError(entry.id, `missing ${entry.dir}/keys.csv`);
  const log = parseLightsCsv(logText, `${entry.dir}.lights.csv`);
  const last = frames.recording(entry.dir)?.at(-1);
  if (last === undefined)
    throw new LightsCaptureError(entry.id, `missing ${entry.dir}/timings.csv`);
  const rawKeys = parseKeysCsv(keysText, `${entry.dir}/keys.csv`);
  const zero = rawKeys[0]?.downMs ?? 0;
  const { keys } = alignOnKeys([], rawKeys);
  const rows: LightsRow[] = [];
  const state: Record<LightName, boolean> = { display: false, keypad: false };
  for (const led of log.rows) {
    for (const light of ["display", "keypad"] as const) {
      if (led[light] === state[light]) continue;
      state[light] = led[light];
      rows.push({ ms: Math.round(led.ms - zero), light, on: led[light] });
    }
  }
  return {
    id: entry.id,
    status: entry.status,
    source: `captures/6.39/${entry.dir}`,
    sourceSha256: io.sha256(entry.dir),
    state: entry.state,
    powerOnMs: Math.round(log.powerOnMs + zero),
    startMs: -Math.round(zero),
    endMs: Math.round(last.startMs + last.durationMs - zero),
    ...(keys ? { keys } : {}),
    note: entry.note,
    omitted: [],
    rows,
  };
}

/** Task 4 drives these families; the rest wait for Task 8 (or plans 18 and 22). */
const DRIVEN = /^lights\/(timeout|keys|boot)\/|^lights\/power-key\/(standby|menu|list)$/;

const lights = (
  id: string,
  state: string,
  note: string,
  dir = `${P}/${id}`,
  status: GoldenStatus = DRIVEN.test(id) ? ASSERTED : OWN,
): LightsCaptureEntry => ({ id, dir, state, status, note });

const range = (from: number, to: number, step: number): number[] =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

const STANDBY_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].concat(
  "star hash up down c menu".split(" "),
);

/** Every lights golden: the timeout, the keys, boot, the power key, the keyguard, games, arrivals. */
export const LIGHTS_ENTRIES: readonly LightsCaptureEntry[] = [
  ...(["virgin", "factory"] as const).flatMap((state) => [
    ...range(0, 15, 1).map((n) =>
      lights(
        `lights/timeout/${state}/tap-${String(n).padStart(2, "0")}`,
        state,
        `C at standby with the LEDs off, ${n * 124} ms after a light tick (Task 0 L).`,
      ),
    ),
    ...[200, 500, 1000, 2000, 4000, 8000, 16000].map((ms) =>
      lights(`lights/timeout/${state}/hold-${ms}`, state, `C held ${ms} ms at standby.`),
    ),
    lights(
      `lights/timeout/${state}/pair-straddle`,
      state,
      "C 500 ms before and after a light tick.",
    ),
    ...[5000, 10000, 13000, 13600, 13800].map((ms) =>
      lights(
        `lights/timeout/${state}/relight-${ms}`,
        state,
        `C, then C ${ms} ms later while the LEDs are on.`,
      ),
    ),
  ]),
  ...range(252, 364, 8).map((ms) =>
    lights(
      `lights/timeout/factory/fine-${ms}`,
      "factory",
      `C at standby ${ms} ms after a light tick: pins the timeout (D2).`,
    ),
  ),
  ...STANDBY_KEYS.map((k) =>
    lights(`lights/keys/standby-${k}`, "factory", `${k} at standby with the LEDs off.`),
  ),
  ...["down", "up", "1", "menu", "c"].map((k) =>
    lights(`lights/keys/carousel-${k}`, "factory", `${k} in the menu carousel (Phone book), dark.`),
  ),
  ...["down", "up", "menu", "c", "5", "c-held"].map((k) =>
    lights(`lights/keys/list-${k}`, "factory", `${k} in Phone book's list, dark.`),
  ),
  lights("lights/boot/power-on", "factory", "Power-on to 40 s, no key (L4)."),
  lights("lights/boot/gate", "virgin", "Power-on, the code 12345 typed at 8 s, to 40 s."),
  lights(
    "lights/boot/welcome",
    "v639-plan15-welcome-hi",
    "Power-on with the welcome note Hi, the code at 8 s, to 40 s.",
  ),
  lights(
    "lights/boot/power-off",
    "factory",
    "C at a dark standby, then the power key held until the LCD blanks.",
  ),
  ...["standby", "menu", "list"].map((place) =>
    lights(
      `lights/power-key/${place}`,
      "factory",
      `The power key's short press, dark, at ${place === "menu" ? "the carousel" : place === "list" ? "Phone book's list" : "standby (the profile list is plan 17's)"}.`,
    ),
  ),
  lights(
    "lights/power-key/game",
    "factory",
    "Snake II level 1 under Lights Off: New game, the power key at 5 s.",
  ),
  lights(
    "lights/keyguard/lock",
    "virgin",
    "Menu, then * at 300 ms, dark (K1).",
    `${P}/keyguard/lock`,
  ),
  lights(
    "lights/keyguard/hint",
    "virgin",
    "5 on a dark locked standby (K3).",
    `${P}/keyguard/hint/5`,
  ),
  lights(
    "lights/keyguard/hint-power",
    "virgin",
    "The power key's short press on a dark locked standby: the hint, lit.",
    `${P}/keyguard/hint/pwr`,
  ),
  lights(
    "lights/keyguard/unlock-alone",
    "virgin",
    "Unlock alone on a dark locked standby (K4).",
    `${P}/keyguard/unlock-alone`,
  ),
  lights(
    "lights/keyguard/unlock",
    "virgin",
    "Unlock, then * at 300 ms, dark (K5).",
    `${P}/keyguard/unlock`,
  ),
  lights(
    "lights/keyguard/emergency",
    "virgin",
    "1 1 2 500 ms apart on a dark locked standby (K6).",
    `${P}/keyguard/emergency/112`,
  ),
  lights(
    "lights/keyguard/emergency-call",
    "virgin",
    "1 1 2, then Call (Navi) 1 s into the display.",
    `${P}/keyguard/emergency-call`,
    CALLS,
  ),
  ...["hint-5", "unlock-alone", "unlock", "emergency-112"].map((name) =>
    lights(
      `lights/keyguard/lit/${name}`,
      "virgin",
      "While the lock's own light is on (locked ≈3.5 s after Menu).",
      `${P}/keyguard/lit/${name}`,
    ),
  ),
  lights(
    "lights/keyguard/power-key-held",
    "factory",
    "The power key held 10 s on a lit locked standby: the hint, no power-off.",
    `${P}/keyguard/power-cycle/power-key-held`,
  ),
  ...(["off", "on"] as const).flatMap((setting) =>
    [
      ["play", "New game, 30 s of bot play"],
      ["pause-nav", "New game, Navi between ticks 4 and 5 (pause), Continue 20 s later, 6"],
      ["pause-c", "New game, C between ticks 4 and 5 (pause), Continue 20 s later, 6"],
      ["over", "New game, 3 s of play, a crash, 20 s"],
      ["top-score", "New game, one meal, a crash (a new top score), 20 s"],
    ].map(([name, what]) =>
      lights(
        `lights/game/${setting}/${name}`,
        "factory",
        `Snake II level 1, Games › Settings › Lights ${setting === "on" ? "On" : "Off"}: ${what}.`,
      ),
    ),
  ),
  ...["", "-locked"].flatMap((suffix) => [
    lights(
      `lights/arrival/sms${suffix}`,
      "virgin",
      `An SMS arriving at a dark${suffix ? " locked" : ""} standby.`,
      `${P}/lights/arrival/sms${suffix}`,
      MESSAGES,
    ),
    ...[
      ["", "answered with Navi at 6 s, ended with Navi 3 s later"],
      ["-reject", "rejected with C at 3 s"],
      ["-ringout", "left to ring 75 s"],
    ].map(([end, what]) =>
      lights(
        `lights/arrival/call${suffix}${end}`,
        "virgin",
        `An incoming call at a dark${suffix ? " locked" : ""} standby, ${what}.`,
        `${P}/lights/arrival/call${suffix}${end}`,
        CALLS,
      ),
    ),
  ]),
  lights("lights/screen-saver", "factory", "Screen saver On, C at a dark standby, 60 s (L8)."),
];

// ---------------------------------------------------------------- keyguard LCD goldens

/** The hint recordings (`keyguard/hint/<key>`) that may share one golden; the power key lights. */
export const HINT_KEYS: readonly string[] = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "star",
  "hash",
  "up",
  "down",
  "c",
  "c-held-1500",
  "c-held-4000",
  "up-held-1500",
  "5-held-600",
];

function timeline(
  id: string,
  dir: string,
  note: string,
  status: GoldenStatus = ASSERTED,
): CaptureSetEntry {
  return {
    id,
    kind: "timeline",
    status,
    prefer: { source: { kind: "recording", dir: `${P}/${dir}` }, triggerFrame: 1, note },
  };
}

function still(
  id: string,
  file: string,
  note: string,
  status: GoldenStatus = ASSERTED,
): CaptureSetEntry {
  return {
    id,
    kind: "still",
    status,
    prefer: { source: { kind: "shot", file: `${P}/${file}` }, note },
  };
}

/** Same images and every frame's start within SHARE_TOLERANCE_MS. */
function sameRecording(frames: TreeCaptureIo, a: string, b: string): boolean {
  const x = frames.recording(a);
  const y = frames.recording(b);
  if (x === undefined || y === undefined) throw new LightsCaptureError(a, "missing recording");
  return (
    x.length === y.length &&
    x.every(
      (frame, i) =>
        frame.image === y[i]!.image &&
        Math.abs(frame.startMs - y[i]!.startMs) <= SHARE_TOLERANCE_MS,
    )
  );
}

/** The hint recordings grouped by equality: `keyguard/hint` holds 5's, others their first key's. */
function hintEntries(frames: TreeCaptureIo): CaptureSetEntry[] {
  const groups: string[][] = [];
  for (const key of HINT_KEYS) {
    const group = groups.find((g) =>
      sameRecording(frames, `${P}/keyguard/hint/${g[0]}`, `${P}/keyguard/hint/${key}`),
    );
    if (group) group.push(key);
    else groups.push([key]);
  }
  return groups.map((group) => {
    const main = group.includes("5");
    const source = main ? "5" : group[0]!;
    return timeline(
      main ? "keyguard/hint" : `keyguard/hint/${group[0]}`,
      `keyguard/hint/${source}`,
      `A key on a dark locked standby: the hint (K3). Equal recordings: ${group.join(", ")}; the source is ${source}'s.`,
    );
  });
}

/** Every keyguard LCD golden. */
export function keyguardLcdSet(frames: TreeCaptureIo): CaptureSetEntry[] {
  return [
    timeline("keyguard/lock", "keyguard/lock", "Menu, then * at 300 ms (K1): Keypad locked."),
    ...[2000, 2500, 2800, 2900, 2910, 2920, 2930, 2940, 2960, 3000].map((ms) =>
      timeline(
        `keyguard/lock-gap/${ms}`,
        `keyguard/lock-gap/${ms}`,
        `Menu, then * ${ms} ms later: ${ms <= 2920 ? "locks" : "standby number entry (plan 22)"}.`,
        ms <= 2920 ? ASSERTED : CALLS,
      ),
    ),
    timeline(
      "keyguard/lock-cancel/digit",
      "keyguard/lock-cancel/digit",
      "Menu, 1 at 300 ms, * 300 ms later: the shortcut, no lock.",
    ),
    timeline(
      "keyguard/lock-cancel/down",
      "keyguard/lock-cancel/down",
      "Menu, ▼ at 300 ms, * 300 ms later: standby number entry (plan 22).",
      CALLS,
    ),
    timeline(
      "keyguard/lock-cancel/c",
      "keyguard/lock-cancel/c",
      "Menu, C at 300 ms, * 300 ms later: standby number entry (plan 22).",
      CALLS,
    ),
    timeline(
      "keyguard/carousel-star",
      "keyguard/carousel-star",
      "Menu, then * 4000 ms later: standby number entry (plan 22).",
      CALLS,
    ),
    timeline("keyguard/lock-star-held", "keyguard/lock-star-held", "Menu, then * held 600 ms."),
    still("keyguard/standby", "keyguard/standby.png", "The locked standby (K2)."),
    still(
      "keyguard/standby-message",
      "keyguard/standby-message.png",
      "The locked standby with a message waiting (K2; the envelope is plan 18's).",
      MESSAGES,
    ),
    ...hintEntries(frames),
    timeline(
      "keyguard/hint/pwr",
      "keyguard/hint/pwr",
      "The power key's short press on a dark locked standby: the hint, lit.",
    ),
    timeline("keyguard/hint-during", "keyguard/hint-during", "5, then 6 1000 ms later: restarts."),
    timeline("keyguard/hint-late", "keyguard/hint-late", "5, then 6 2700 ms later: restarts."),
    timeline("keyguard/unlock-alone", "keyguard/unlock-alone", "Unlock alone (K4)."),
    timeline("keyguard/unlock", "keyguard/unlock", "Unlock, then * at 300 ms (K5)."),
    ...[1300, 1350, 1400, 1410, 1420, 1430, 1440, 1450, 1500, 1550].map((ms) =>
      timeline(
        `keyguard/unlock-gap/${ms}`,
        `keyguard/unlock-gap/${ms}`,
        `Unlock, then * ${ms} ms later: ${ms <= 1440 ? "unlocks" : "the hint"}.`,
      ),
    ),
    timeline("keyguard/unlock-digit", "keyguard/unlock-digit", "Unlock, then 5 at 300 ms."),
    timeline("keyguard/unlock-c", "keyguard/unlock-c", "Unlock, then C at 300 ms."),
    timeline("keyguard/unlock-twice", "keyguard/unlock-twice", "Unlock, Unlock 700 ms later."),
    timeline(
      "keyguard/unlock-twice-star",
      "keyguard/unlock-twice-star",
      "Unlock, Unlock 700 ms later, * 300 ms after it.",
    ),
    timeline("keyguard/unlock-held", "keyguard/unlock-held", "Unlock held 800 ms."),
    timeline(
      "keyguard/unlock-star-held",
      "keyguard/unlock-star-held",
      "Unlock, then * held 600 ms.",
    ),
    ...["112", "911", "999", "000", "08", "110", "113", "1122", "2112", "0112"].map((digits) =>
      timeline(
        `keyguard/emergency/${digits}`,
        `keyguard/emergency/${digits}`,
        `${digits.split("").join(" ")}, 500 ms apart, on a dark locked standby (K6).`,
      ),
    ),
    timeline("keyguard/emergency/112-c", "keyguard/emergency/112-c", "1 1 2, C 1 s later."),
    timeline("keyguard/emergency/112-digit", "keyguard/emergency/112-digit", "1 1 2, 5 1 s later."),
    timeline("keyguard/emergency/112-held", "keyguard/emergency/112-held", "1 1, 2 held 600 ms."),
    timeline(
      "keyguard/emergency/112-unlock-after",
      "keyguard/emergency/112-unlock-after",
      "1 1 2, then Unlock and * after the display.",
    ),
    timeline(
      "keyguard/emergency-call",
      "keyguard/emergency-call",
      "1 1 2, then Call (Navi) 1 s later: Attempting emergency call (plan 22).",
      CALLS,
    ),
    ...["hint-5", "unlock-alone", "unlock", "emergency-112"].map((name) =>
      timeline(
        `keyguard/lit/${name}`,
        `keyguard/lit/${name}`,
        "The same keys while the lock's own light is on.",
      ),
    ),
    timeline(
      "keyguard/power-key-held",
      "keyguard/power-cycle/power-key-held",
      "The power key held 10 s on a lit locked standby: the hint, no power-off.",
    ),
    still(
      "keyguard/power-cycle",
      "keyguard/power-cycle/standby.png",
      "After a cold power-on from the locked phone's flash: unlocked (Menu).",
    ),
    timeline(
      "keyguard/call",
      "lights/arrival/call-locked",
      "An incoming call on a locked phone, answered and ended with Navi: Keypad locked again.",
      CALLS,
    ),
    timeline(
      "keyguard/call-reject",
      "lights/arrival/call-locked-reject",
      "An incoming call on a locked phone, rejected with C: Keypad locked again.",
      CALLS,
    ),
    timeline(
      "keyguard/sms",
      "lights/arrival/sms-locked",
      "An SMS arriving at a locked phone (K7): the notice with Unlock, dark.",
      MESSAGES,
    ),
  ];
}

// ---------------------------------------------------------------- sound goldens

const KEYGUARD_SOUNDS: readonly SoundCaptureEntry[] = [
  ["emergency", "1 1 2 on a dark locked standby: silent."],
  ["hint-key", "5 on a locked standby: silent."],
  ["hint-key-c", "C on a locked standby: silent."],
  ["lock", "Menu, then * at 300 ms: Menu's beep, then the lock's warning tone."],
  ["unlock", "Unlock, then * at 300 ms: the *'s beep."],
  ["unlock-alone", "Unlock alone: silent."],
].map(([name, note]) => ({
  id: `sound/keyguard/${name}`,
  dir: `${P}/sound/keyguard/${name}`,
  state: "factory",
  status: OWN,
  note: note!,
}));

export const keyguardAndBacklight: PlanCaptureSet = {
  plan: "25",
  resources,
  lcd: (io) => keyguardLcdSet(io.frames),
  lights: (io) => LIGHTS_ENTRIES.map((entry) => buildLightsGolden(entry, io.lights, io.frames)),
  sounds: (io) => KEYGUARD_SOUNDS.map((entry) => buildSoundGolden(entry, io.sound)),
  notImported: {
    "plan25/stats.txt, plan25/text.json": "Task 0's analysis and OCR",
    "plan25/lights/timeout/**, lights/keys/**, lights/boot/**, lights/power-key/** (LCD)":
      "standby, carousel and list pixels plans 13-15 assert; only their lights are plan 25's",
    "plan25/lights/game/** (LCD)": "Snake II's screens (plan 23); only their lights are plan 25's",
    "plan25/lights/arrival/{sms,call*} (LCD, unlocked)":
      "the notice and call screens (plans 18, 22)",
    "plan25/lights/screen-saver-*":
      "Screen saver's pages (plan 14) and its picture list (plan 18c)",
    "plan25/keyguard/standby-dark.png, lit/standby.png, power-cycle/locked.png":
      "the same pixels as keyguard/standby.png",
    "plan25/keyguard/standby-message-{notice,unlocked}.png": "the message notice (plan 18)",
    "plan25/keyguard/power-cycle/power-on, standby-note.png":
      "the power-on and clock wizard (plan 15); keyguard/power-cycle holds the result",
    "plan25/keyguard/** lights logs not listed":
      "dark throughout (stats.txt); the LCD goldens hold them",
    "plan25/sound/keyguard/** (LCD, lights)": "the same flows as keyguard/*; sound only",
    "plan25/**/*.wav": "the emulator's synthesis, not firmware output (plan 16 D1)",
  },
};
