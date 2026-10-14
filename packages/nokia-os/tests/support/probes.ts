// Hand-written scenarios for the plan 14 probe goldens (Task 13, S7). Each replays the probe's
// keys from `$REF/captures/scripts/v639-plan14.cap` (see the golden's note): stills compare one
// image per step; timelines press the trigger, then each later key on the tick its effect starts
// in the golden (D8: the key-to-redraw latency is not reproduced).
//
// Timing (plan 14 closeout decision 2): the timeline is anchored on the trigger key. A probe
// that replays another recording's timings, or presses keys after the trigger, compares frame
// starts within PROBE_TOLERANCE_MS (each such scenario says why); every other probe keeps ±2 ms.
// Pixels are always exact.
import type { PhoneKey } from "@hellotimber/phone-core";
import { expect } from "vite-plus/test";
import {
  expectLcd,
  expectTimeline,
  lcdMismatch,
  PROBE_TOLERANCE_MS,
  type TimelineTolerance,
} from "./golden.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { GATE_BLANK_MS, SELF_TEST_MS } from "../../src/firmware/boot";
import { createMemoryStorage, type StockStorage } from "../../src/index";
import { frameAt, seededStorage, standbyRig, stockRig, type Rig } from "./rig.ts";

/** One harness tap (`key`): ≈42 ms down, the 250 ms settle and the 300 ms key gap. */
export const TAP_MS = 592;

/**
 * A token list: `navi`, `down*9`, `wait:1500`, `c~1000` (C held 1000 ms). Each key is a tap (or
 * the hold) followed by TAP_MS.
 */
export function keys(rig: Rig, script: string): void {
  for (const token of script.split(/\s+/).filter(Boolean)) {
    if (token.startsWith("wait:")) {
      rig.advance(Number(token.slice(5)));
      continue;
    }
    const hold = /^(.+)~(\d+)$/.exec(token);
    if (hold !== null) {
      rig.press(hold[1] as PhoneKey, Number(hold[2]));
      rig.advance(TAP_MS);
      continue;
    }
    const [key, times = "1"] = token.split("*");
    for (let i = 0; i < Number(times); i++) {
      rig.press(key as PhoneKey);
      rig.advance(TAP_MS);
    }
  }
}

/** A rig at standby after `script`. */
export function after(script: string): Rig {
  const rig = standbyRig();
  keys(rig, script);
  return rig;
}

/**
 * A still probe: `steps[i]` runs before image `i` is compared (the probe's images in order).
 * With `toleranceMs` an image may have been on screen up to that long before or after its step
 * ends (a shot timed from a key the firmware times from its redraw).
 */
export function stills(id: string, rig: Rig, steps: readonly string[], toleranceMs = 0): void {
  const golden = loadGolden(id);
  expect(steps.length, `${id}: one step per image`).toBe(golden.images.length);
  golden.images.forEach((image, i) => {
    const context = `${id}: ${steps.slice(0, i + 1).join(" | ")}`;
    if (toleranceMs === 0) {
      keys(rig, steps[i]!);
      expectLcd(rig.paint(), { id, image }, context);
      return;
    }
    const recording = rig.record(toleranceMs, () => keys(rig, steps[i]!));
    const at = recording.triggerMs;
    const shown = [
      frameAt(recording, at - toleranceMs),
      ...recording.frames.filter(
        (frame) => frame.startMs > at - toleranceMs && frame.startMs <= at + toleranceMs,
      ),
    ];
    if (shown.some((frame) => lcdMismatch(frame.pixels, { id, image }, context) === undefined)) {
      return;
    }
    expectLcd(frameAt(recording, at), { id, image }, `${context} (±${toleranceMs} ms)`);
  });
}

/**
 * The firmware redraws 50-125 ms after a key (D8). A key pressed ahead of its first redraw is
 * pressed by the lower bound, and that redraw's start is not compared.
 */
const KEY_TO_REDRAW_MS = 50;

/**
 * A later key: pressed on the tick golden row `row` starts (its effect), at `ms`, or `ahead` of
 * the row it draws first (KEY_TO_REDRAW_MS before it; the row is then untimed). A key goes ahead
 * when its effect pre-empts a timer step that would fall inside its redraw latency.
 */
export type Later =
  | readonly [row: number, key: PhoneKey]
  | readonly [{ ms: number }, PhoneKey]
  | readonly [{ ahead: number }, PhoneKey];

/**
 * A timeline probe from `rig`: frame 0 must be on screen, then the trigger key and the later
 * keys; the recording runs until the golden's last row has been held as long as it was.
 */
export function timeline(
  id: string,
  rig: Rig,
  trigger: PhoneKey,
  later: readonly Later[] = [],
  { toleranceMs }: Pick<TimelineTolerance, "toleranceMs"> = {},
): void {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const t = golden.triggerFrame as number;
  expectLcd(rig.paint(), goldenImage(id, rows[t - 1]!.image), `${id}: before the trigger`);
  const origin = rows[t]!.startMs;
  const last = rows[rows.length - 1]!;
  const span = last.startMs + last.durationMs - origin + 100;
  const untimedRows = new Set<number>();
  const schedule = later.map(([at, key]) => {
    let atMs: number;
    if (typeof at === "number") atMs = rows[at]!.startMs - origin;
    else if ("ms" in at) atMs = at.ms;
    else {
      untimedRows.add(at.ahead);
      atMs = rows[at.ahead]!.startMs - origin - KEY_TO_REDRAW_MS;
    }
    return { atMs, run: () => rig.press(key) };
  });
  const recording = rig.record(span, () => rig.press(trigger), schedule);
  const context = `${id}: ${trigger}, then ${later.map((l) => l[1]).join(", ")}`;
  expectTimeline(recording, golden, context, {
    untimedRows,
    ...(toleranceMs === undefined ? {} : { toleranceMs }),
  });
}

/** Probe timelines compared within PROBE_TOLERANCE_MS (see the file header). */
export const JITTER = { toleranceMs: PROBE_TOLERANCE_MS } as const;

export const SNAKE = "navi down*7 navi navi wait:7000";
const PHONE_BOOK = "navi navi";

/** Instructions of each game: the path to its game menu and the ▼ count to Instructions. */
const INSTRUCTIONS: Readonly<Record<string, string>> = {
  "8-1-6": `${SNAKE} down*5 navi`,
  "8-2-4": "navi down*7 navi down navi wait:7000 down*3 navi",
  "8-3-3": "navi down*7 navi down*2 navi wait:7000 down*2 navi",
  "8-4-1-5": "navi down*7 navi down*3 navi wait:7000 navi down*4 navi",
  "8-4-2-5": "navi down*7 navi down*3 navi wait:7000 down navi down*4 navi",
};

const wrap = (base: string, key: "down" | "up", count: number): string[] => [
  base,
  ...Array.from({ length: count - 1 }, () => key),
];

/** Stills: ▲/▼ per image after opening a list. */
const WRAPS: Readonly<Record<string, string>> = {
  reminders: "navi down*9 navi",
  "phone-book-erase": "navi navi down*3 navi",
  games: "navi down*7 navi",
  profiles: "navi down*11 navi",
};

/** Tones › Keypad tones and Settings › Phone settings › Cell info display, as plan 15 A7 keys. */
const KEYPAD_TONES = "navi wait:300 down*4 wait:1000 navi down*5";
const CELL_INFO = "navi wait:300 down*5 wait:1000 navi down navi down";
const TO_STANDBY = "c wait:1000 c wait:1000 c wait:2000";

/**
 * Plan 15 A7 (`probe/persist-reboot`): Keypad tones › Level 2 and Cell info display › On, then
 * a new phone over the same storage (`saveflash`, `reboot`) shows both on their pages and opens
 * both lists on them.
 */
function persistReboot(id: string): void {
  const storage = createMemoryStorage();
  const golden = loadGolden(id);
  const check = (rig: Rig, image: string, script: string): void => {
    keys(rig, script);
    expectLcd(rig.paint(), goldenImage(id, image), `${id}: ${image}`);
  };
  const first = standbyRig({ storage });
  check(first, "before-5-6-page", KEYPAD_TONES);
  check(first, "before-5-6-list", "navi");
  check(first, "set-5-6-page", "down*3 navi wait:3000");
  check(first, "before-6-2-2-page", `${TO_STANDBY} ${CELL_INFO}`);
  check(first, "before-6-2-2-list", "navi");
  check(first, "set-6-2-2-page", "down navi wait:3000");
  const second = standbyRig({ storage });
  check(second, "standby", "");
  check(second, "5-6-page", KEYPAD_TONES);
  check(second, "5-6-list", "navi");
  check(second, "6-2-2-page", `${TO_STANDBY} ${CELL_INFO}`);
  check(second, "6-2-2-list", "navi");
  expect(golden.images).toHaveLength(11);
}

/** The security-code leaves highlighted, as plan 15 A4/A5 reach them. */
const CODE_LEAVES: Readonly<Record<string, string>> = {
  "6-3-5": "navi wait:300 down*5 wait:1000 navi down*2 navi down*3",
  "6-3-6-1": "navi wait:300 down*5 wait:1000 navi down*2 navi down*4 navi",
  "6-4": "navi wait:300 down*5 wait:1000 navi down*3",
  "4-5-5": "navi wait:300 down*3 wait:1000 navi down*4 navi down*4",
};
const RESTORE_PROMPT = `${CODE_LEAVES["6-4"]} navi wait:2000`;

/** A4: Select, `00000` one digit per golden row, OK, `Code error`, the empty prompt, C. */
function codeWrong(id: string, number: string): void {
  const digits = [2, 3, 4, 5, 6].map((row) => [row, "0"] as const);
  timeline(id, after(CODE_LEAVES[number]!), "navi", [...digits, [7, "navi"], [9, "c"]]);
}

const STANDBY = "c*5 wait:2000";
/** At standby with the code changed to 11111 (Change security code, a matching verify). */
const CODE_11111 = `${CODE_LEAVES["6-3-6-1"]} navi 1 2 3 4 5 navi 1*5 navi 1*5 navi wait:3000 ${STANDBY}`;
/** At standby with Phone security On, set with `code`. */
const securityOn = (code: string) =>
  `${CODE_LEAVES["6-3-5"]} navi ${code.split("").join(" ")} navi down navi wait:3000 ${STANDBY}`;
/** At Change security code's `Enter new security code:` prompt. */
const ENTER_NEW = `${CODE_LEAVES["6-3-6-1"]} navi 1 2 3 4 5 navi`;

/** Keys on golden rows `from`, `from + 1`, …: one digit each. */
function digitsAt(from: number, digits: string): Later[] {
  return digits.split("").map((digit, i) => [from + i, digit as PhoneKey] as const);
}

export const PROBE_SCENARIOS: Record<string, (id: string) => void> = {
  "probe/persist-reboot": persistReboot,

  // Plan 15 0c: accepted codes (v6.39 with the re-provisioned code). Each note plays its own
  // recording's timeline, so only the notes recorded elsewhere compare within ±25 ms (JITTER).
  "probe/accept-6-3-5-on": (id) =>
    timeline(id, after(CODE_LEAVES["6-3-5"]!), "navi", [
      ...digitsAt(3, "12345"),
      [8, "navi"],
      [9, "down"],
      [10, "navi"],
    ]),
  "probe/accept-6-3-5-off": (id) =>
    timeline(id, after(`${securityOn("12345")} ${CODE_LEAVES["6-3-5"]}`), "navi", [
      ...digitsAt(2, "12345"),
      [7, "navi"],
      [8, "down"],
      [9, "navi"],
    ]),
  // Code error plays probe/code-wrong-6-4's timeline (2904 ms; here 2911 ms).
  "probe/accept-6-3-6-1-mismatch": (id) =>
    timeline(
      id,
      after(CODE_LEAVES["6-3-6-1"]!),
      "navi",
      [
        ...digitsAt(2, "12345"),
        [7, "navi"],
        ...digitsAt(8, "11111"),
        [13, "navi"],
        ...digitsAt(14, "22222"),
        [19, "navi"],
      ],
      JITTER,
    ),
  // New codes of 4, 6, 0 and 10 digits; Code error as above (2910-2918 ms here).
  "probe/accept-6-3-6-1-lengths": (id) =>
    timeline(
      id,
      after(ENTER_NEW),
      "1",
      [
        ...digitsAt(2, "234"),
        [5, "navi"],
        ...digitsAt(7, "123456"),
        [13, "navi"],
        [15, "navi"],
        ...digitsAt(17, "1234567890"),
        [27, "navi"],
      ],
      JITTER,
    ),
  "probe/accept-6-3-6-1-match": (id) =>
    timeline(id, after(ENTER_NEW), "1", [
      ...digitsAt(2, "1111"),
      [6, "navi"],
      ...digitsAt(7, "11111"),
      [12, "navi"],
    ]),
  // Code error as above (2919 ms here).
  "probe/accept-6-4-old-code": (id) =>
    timeline(
      id,
      after(`${CODE_11111} ${CODE_LEAVES["6-4"]}`),
      "navi",
      [...digitsAt(2, "12345"), [7, "navi"]],
      JITTER,
    ),
  // Settings restored plays probe/accept-c7-restore's timeline (18 ms off this recording's).
  "probe/accept-6-4-new-code": (id) =>
    timeline(
      id,
      after(`${CODE_11111} ${RESTORE_PROMPT}`),
      "1",
      [...digitsAt(2, "1111"), [6, "navi"]],
      JITTER,
    ),
  // As above (15 ms off).
  "probe/accept-6-4-restore": (id) =>
    timeline(
      id,
      after(CODE_LEAVES["6-4"]!),
      "navi",
      [...digitsAt(2, "12345"), [7, "navi"]],
      JITTER,
    ),
  "probe/accept-c7-restore": (id) =>
    timeline(id, after(`${CODE_11111} ${securityOn("11111")} ${CODE_LEAVES["6-4"]}`), "navi", [
      ...digitsAt(2, "11111"),
      [7, "navi"],
    ]),
  "probe/accept-4-5-5": (id) =>
    timeline(id, after(CODE_LEAVES["4-5-5"]!), "navi", [...digitsAt(2, "12345"), [7, "navi"]]),
  // Phone security On (code 11111), then Restore factory settings: the page reads Off.
  "probe/accept-restore-phone-security": (id) =>
    stills(id, standbyRig(), [
      `${CODE_11111} ${securityOn("11111")} ${CODE_LEAVES["6-3-5"]}`,
      `${STANDBY} ${CODE_LEAVES["6-4"]} navi 1*5 navi wait:3000 ${STANDBY} ${CODE_LEAVES["6-3-5"]}`,
    ]),
  ...Object.fromEntries(
    Object.keys(CODE_LEAVES).map((number) => [
      `probe/code-wrong-${number}`,
      (id: string) => codeWrong(id, number),
    ]),
  ),
  // A5: Restore's prompt after each key (`v639-plan15.cap`); the sub-recordings are timelines.
  "probe/code-keys-6-4": (id) =>
    stills(id, standbyRig(), [
      CODE_LEAVES["6-4"]!,
      "navi wait:2000",
      "1 2",
      "c",
      "c",
      "c wait:3000",
      "navi wait:2000",
      "navi wait:4000 1 2 3",
      "navi wait:5000",
      "1 2 3 4 5",
      "6",
      "7",
      "8",
      "9",
      "0",
      "1",
      "c~1000",
    ]),
  "probe/code-keys-6-4-c-on-empty": (id) => timeline(id, after(RESTORE_PROMPT), "c"),
  "probe/code-keys-6-4-ok-empty": (id) => timeline(id, after(RESTORE_PROMPT), "navi"),
  "probe/code-keys-6-4-ok-123": (id) => timeline(id, after(`${RESTORE_PROMPT} 1 2 3`), "navi"),
  "probe/wrap-down": (id) => stills(id, standbyRig(), wrap(`${PHONE_BOOK} down*9`, "down", 4)),
  ...Object.fromEntries(
    Object.entries(WRAPS).flatMap(([name, base]) =>
      (["down", "up"] as const).map((key) => [
        `probe/wrap-small-${name}-${key}`,
        (id: string) => stills(id, standbyRig(), wrap(base, key, loadGolden(id).images.length)),
      ]),
    ),
  ),
  "probe/return-top-row": (id) =>
    stills(id, standbyRig(), [`${PHONE_BOOK} down*5 up*2`, "navi", "c"]),
  "probe/return-bottom-row": (id) =>
    stills(id, standbyRig(), [`${PHONE_BOOK} down*3`, "navi", "c"]),
  "probe/return-wrapped": (id) => stills(id, standbyRig(), [`${PHONE_BOOK} up`, "navi", "c"]),
  "probe/return-note": (id) => timeline(id, after(`${PHONE_BOOK} down*4`), "navi"),
  // Image 02 is shot 2.1 s after C, 9 ms after Phone book's icon steps (its timeline from
  // menu/01-phone-book.anim); the firmware times the step from its redraw after C.
  "probe/reenter": (id) =>
    stills(id, standbyRig(), [`${PHONE_BOOK} down*5`, "c wait:1500", "navi"], PROBE_TOLERANCE_MS),

  // Shortcut probes press digits after Menu: the window (2920-2948 ms) and the opening delay
  // (1427-1502 ms between redraws) differ between recordings, so they compare within ±25 ms.
  "probe/shortcut-m1": (id) => timeline(id, standbyRig(), "navi", [[3, "1"]], JITTER),
  "probe/shortcut-m1-8": (id) =>
    timeline(
      id,
      standbyRig(),
      "navi",
      [
        [3, "1"],
        [5, "8"],
      ],
      JITTER,
    ),
  "probe/shortcut-m1-1-0": (id) =>
    timeline(
      id,
      standbyRig(),
      "navi",
      [
        [3, "1"],
        [5, "1"],
        [6, "0"],
      ],
      JITTER,
    ),
  "probe/shortcut-m1-2": (id) =>
    timeline(
      id,
      standbyRig(),
      "navi",
      [
        [3, "1"],
        [5, "2"],
      ],
      JITTER,
    ),
  "probe/shortcut-m8-1": (id) =>
    timeline(
      id,
      standbyRig(),
      "navi",
      [
        [3, "8"],
        [5, "1"],
      ],
      JITTER,
    ),
  "probe/shortcut-m8-1-2": (id) =>
    timeline(
      id,
      standbyRig(),
      "navi",
      [
        [3, "8"],
        [5, "1"],
        [8, "2"],
      ],
      JITTER,
    ),
  "probe/shortcut-m8-6": (id) =>
    timeline(
      id,
      standbyRig(),
      "navi",
      [
        [3, "8"],
        [5, "6"],
      ],
      JITTER,
    ),
  "probe/shortcut-m8-6-3": (id) =>
    timeline(
      id,
      standbyRig(),
      "navi",
      [
        [3, "8"],
        [5, "6"],
        [6, "3"],
      ],
      JITTER,
    ),
  "probe/shortcut-m1-wait-9": (id) =>
    timeline(
      id,
      standbyRig(),
      "navi",
      [
        [3, "1"],
        [16, "9"],
      ],
      JITTER,
    ),
  "probe/note-keys-service-nos-c-500": (id) =>
    timeline(id, after(`${PHONE_BOOK} down`), "navi", [[3, "c"]]),
  // Done plays tree/01-phone-book/1-8-1-1.choose's timeline.
  "probe/note-keys-done-down-300": (id) =>
    timeline(id, after(`${PHONE_BOOK} down*7 navi navi down`), "navi", [[3, "down"]], JITTER),

  "probe/progress-7-6-quit": (id) =>
    timeline(id, after("navi down*6 navi down*4"), "navi", [[41, "navi"]]),
  // Searching plays tree/06-settings/6-2-4-2.leaf's bar (7-22 ms off this recording's). C comes
  // before the bar step due at 10593 ms, which never shows: it goes ahead of its redraw.
  "probe/progress-6-2-4-2-c": (id) =>
    timeline(
      id,
      after("navi down*5 navi down navi down*3 navi down"),
      "navi",
      [[{ ahead: 40 }, "c"]],
      JITTER,
    ),

  "probe/confirm-5-2-5-c": (id) =>
    timeline(id, after("navi down*4 navi down navi down*5"), "navi", [[2, "c"]]),
  "probe/confirm-5-2-5-ok": (id) =>
    timeline(id, after("navi down*4 navi down navi down*5"), "navi", [[2, "navi"]]),
  "probe/confirm-8-6-4-c": (id) =>
    timeline(id, after("navi down*7 navi down*4 navi down*3"), "navi", [[2, "c"]]),
  "probe/confirm-8-6-4-ok": (id) =>
    timeline(id, after("navi down*7 navi down*4 navi down*3"), "navi", [[2, "navi"]]),
  "probe/prompts-1-1": (id) => timeline(id, after(PHONE_BOOK), "navi", [[2, "c"]]),
  "probe/prompts-1-9": (id) => timeline(id, after(`${PHONE_BOOK} down*8`), "navi", [[2, "c"]]),
  "probe/prompts-6-4": (id) => timeline(id, after("navi down*5 navi down*3"), "navi", [[2, "c"]]),
  "probe/prompts-11-5": (id) =>
    timeline(id, after("navi down*10 navi down*4"), "navi", [[13, "c"]]),

  "probe/unset-down": (id) =>
    stills(id, after("navi down*4 navi down"), ["navi", ...Array(6).fill("down")]),
  "probe/unset-reopen": (id) =>
    stills(id, after("navi down*4 navi down navi down*6"), ["c", "navi"]),
  "probe/unset-up": (id) =>
    stills(id, after("navi down*4 navi down"), ["navi", ...Array(6).fill("up")]),
  "probe/unset-quit": (id) => timeline(id, after("navi down*4 navi down navi"), "navi"),

  "probe/profile-share": (id) => {
    // Tones › Ringing volume → Level 3, back to standby; then each page and list.
    const base = "navi down*4 navi down navi down*3";
    const level3 = () => after(`${base} navi wait:4000 c*4 wait:2000`);
    const check = (rig: Rig, image: string, script: string) => {
      keys(rig, script);
      expectLcd(rig.paint(), goldenImage(id, image), `${id}: ${image}`);
    };
    const rig = standbyRig();
    check(rig, "01-level-3", base);
    check(rig, "02-tones-page", "navi wait:4000");
    for (const [name, path] of [
      ["general", "navi down*11 navi navi down navi down"],
      ["silent", "navi down*11 navi down navi down navi down"],
      ["tones", "navi down*4 navi down"],
    ] as const) {
      const shared = level3();
      check(shared, `${name}-page`, path);
      check(shared, `${name}-list`, "navi");
    }
  },

  "probe/games-splash-8-1": (id) => timeline(id, after("navi down*7 navi"), "navi"),
  "probe/games-splash-8-2": (id) => timeline(id, after("navi down*7 navi down"), "navi"),
  "probe/games-splash-8-3": (id) => timeline(id, after("navi down*7 navi down*2"), "navi"),
  "probe/games-splash-8-4": (id) => timeline(id, after("navi down*7 navi down*3"), "navi"),
  ...Object.fromEntries(
    (
      [
        ["down", "down"],
        ["c", "c"],
        ["menu", "navi"],
      ] as const
    ).map(([name, key]) => [
      `probe/games-splash-skip-${name}`,
      // The splash plays probe/games-splash-8-1's timeline (first step 248 ms, here 252 ms).
      (id: string) => timeline(id, after("navi down*7 navi"), "navi", [[3, key]], JITTER),
    ]),
  ),
  "probe/games-level-keys": (id) =>
    timeline(id, after(`${SNAKE} down`), "navi", [
      [{ ms: 1600 }, "up"],
      [{ ms: 3200 }, "down"],
      [2, "navi"],
    ]),
  "probe/games-level-c": (id) => timeline(id, after(`${SNAKE} down`), "navi", [[2, "c"]]),
  // Top score plays tree/08-games/8-1-4.leaf's timeline (3-16 ms off these recordings').
  "probe/games-top-score-wait": (id) => timeline(id, after(`${SNAKE} down*3`), "navi", [], JITTER),
  "probe/games-top-score-c-2s": (id) =>
    timeline(id, after(`${SNAKE} down*3`), "navi", [[13, "c"]], JITTER),
  "probe/games-top-score-down-2s": (id) =>
    timeline(id, after(`${SNAKE} down*3`), "navi", [[13, "down"]], JITTER),
  ...Object.fromEntries(
    Object.entries(INSTRUCTIONS).map(([number, path]) => [
      `probe/games-instructions-${number}`,
      (id: string) => {
        const count = loadGolden(id).images.length;
        stills(id, standbyRig(), [path, ...Array(count - 1).fill("navi")]);
      },
    ]),
  ),
  "probe/games-instructions-c": (id) =>
    timeline(id, after(`${SNAKE} down*5`), "navi", [
      [2, "navi"],
      [3, "c"],
    ]),

  "probe/set-delay": (id) =>
    stills(id, after("navi down*6 navi down*2 navi down*3"), ["navi", "down"]),
  "probe/set-delay.rec": (id) =>
    timeline(id, after("navi down*6 navi down*2 navi down*3 navi down"), "navi"),

  "probe/multiselect": (id) => {
    const path = "navi down navi down*7 navi down*3";
    const rig = after(path);
    keys(rig, "navi");
    expectLcd(rig.paint(), goldenImage(id, "00"), `${id}: Language`);
    keys(rig, "navi wait:1000 down wait:1000 navi wait:1000 c wait:3000");
    expectLcd(rig.paint(), goldenImage(id, "after-c"), `${id}: Save changes?`);
  },
  "probe/multiselect.rec": (id) =>
    timeline(id, after("navi down navi down*7 navi down*3 navi"), "navi", [
      [2, "down"],
      [3, "navi"],
      [4, "c"],
    ]),

  "probe/prepaid-credit-info-display": (id) =>
    stills(id, after("navi down*3 navi down*7 navi"), ["", "navi", ...Array(6).fill("down")]),
  "probe/prepaid-recharge-status": (id) =>
    stills(id, after("navi down*3 navi down*7 navi"), ["down*3", "navi", ...Array(6).fill("down")]),
};

// ---------------------------------------------------------------- plan 15 boot gates (Task 8)

/** The kernel's long press: power turns the phone on this long after the key goes down. */
const POWER_LONG_PRESS_MS = 800;

/**
 * A boot golden from the power key (trigger frame 0), with `later` keys on the ticks their
 * golden rows start. Every boot scenario compares within PROBE_TOLERANCE_MS: its self-test
 * replays boot/power-on's recording, whose first frame (power key to the first draw, 268 ms)
 * these recordings show as 245-270 ms, and whose steps the gate-free welcome note's recording
 * shows 8 ms longer; the gate's notes replay boot/security-gate's and boot/welcome-note's.
 */
function bootTimeline(id: string, storage: StockStorage, later: readonly Later[] = []): Rig {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const rig = stockRig({ storage });
  rig.advance(100);
  rig.hold("power");
  rig.advance(POWER_LONG_PRESS_MS - 2);
  const last = rows[rows.length - 1]!;
  const span = last.startMs + last.durationMs - rows[0]!.startMs + 100;
  const schedule = later.map(([row, key]) => {
    if (typeof row !== "number") throw new Error(`${id}: boot keys go on golden rows`);
    return { atMs: rows[row]!.startMs - rows[0]!.startMs, run: () => rig.press(key) };
  });
  const recording = rig.record(
    span,
    () => {
      rig.advance(1);
      rig.release("power");
    },
    schedule,
  );
  expectTimeline(
    recording,
    golden,
    `${id}: power on, then ${later.map((l) => l[1]).join(" ")}`,
    JITTER,
  );
  return rig;
}

/** A phone at the power-on prompt (Phone security On, no recent SIM), as `run 8s` leaves it. */
function atGatePrompt(): Rig {
  const rig = stockRig({ storage: seededStorage() });
  rig.press("power", 1000);
  rig.advance(SELF_TEST_MS + GATE_BLANK_MS + 3000);
  return rig;
}

/** Entries at the power-on prompt from golden row `from`: one digit per row, then OK. */
function entriesAt(from: number, codes: readonly string[]): Later[] {
  return codes.flatMap((code, k) => {
    const start = from + k * (code.length + 2);
    return [...digitsAt(start, code), [start + code.length, "navi"] as const];
  });
}

const STANDBY_IMAGE = () => goldenImage("standby/standby", "01-standby");

export const BOOT_SCENARIOS: Record<string, (id: string) => void> = {
  // A1: 00000 OK (Code error, 2889 ms), then 12345 OK: Code accepted, the hands, standby.
  "boot/security-gate": (id) => {
    const rig = bootTimeline(id, seededStorage(), [
      ...entriesAt(6, ["00000"]),
      ...entriesAt(13, ["12345"]),
    ]);
    expectLcd(rig.paint(), STANDBY_IMAGE(), `${id}: after the hands`);
  },
  // A6: 12345 OK: Code accepted, then the note instead of the hands, then standby.
  "boot/welcome-note": (id) => {
    const rig = bootTimeline(id, seededStorage({ welcomeNote: "Hi" }), entriesAt(6, ["12345"]));
    expectLcd(rig.paint(), STANDBY_IMAGE(), `${id}: after the note`);
  },
  "boot/welcome-note-long": (id) => {
    const storage = seededStorage({ welcomeNote: "Welcome to my phone" });
    const rig = bootTimeline(id, storage, entriesAt(6, ["12345"]));
    expectLcd(rig.paint(), STANDBY_IMAGE(), `${id}: after the note`);
  },
  // 0c: after Restore (no gate), the note follows the self-test.
  "boot/welcome-note-ungated": (id) => {
    const rig = bootTimeline(id, seededStorage({ phoneSecurity: false, welcomeNote: "Hi" }));
    expectLcd(rig.paint(), STANDBY_IMAGE(), `${id}: after the note`);
  },
  // A2: the prompt after each key (`v639-plan15.cap`).
  "boot/security-gate-keys": (id) =>
    stills(id, atGatePrompt(), [
      "",
      "1",
      "2",
      "c",
      "c",
      "c",
      "wait:2000",
      "1 2 3 4 5",
      "6",
      "7",
      "8",
      "9",
      "0",
      "1",
      "c~1000",
      "1 2 3",
    ]),
  // Code error plays boot/security-gate's timeline (2889 ms; here 2904 and 2909 ms).
  "boot/security-gate-ok-123": (id) => {
    const rig = atGatePrompt();
    keys(rig, "1 2 3");
    timeline(id, rig, "navi", [], JITTER);
  },
  "boot/security-gate-ok-empty": (id) => timeline(id, atGatePrompt(), "navi", [], JITTER),
  // A3: six 00000 then 12345; the fifth wrong code locks every entry. Code error as above
  // (2890-2907 ms here).
  "boot/security-lockout": (id) => {
    const [first, ...later] = entriesAt(1, [...Array(6).fill("00000"), "12345"]);
    timeline(id, atGatePrompt(), first![1], later, JITTER);
  },
  // Four 00000 then 12345: accepted, the hands. Code error as above (2890-2904 ms here).
  "boot/security-lockout-4": (id) => {
    const [first, ...later] = entriesAt(1, [...Array(4).fill("00000"), "12345"]);
    timeline(id, atGatePrompt(), first![1], later, JITTER);
  },
};
