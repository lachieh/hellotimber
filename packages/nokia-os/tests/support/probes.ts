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
import { createMemoryStorage } from "../../src/index";
import { frameAt, standbyRig, type Rig } from "./rig.ts";

/** One harness tap (`key`): ≈42 ms down, the 250 ms settle and the 300 ms key gap. */
export const TAP_MS = 592;

/** A token list: `navi`, `down*9`, `wait:1500`. Each key is a tap followed by TAP_MS. */
export function keys(rig: Rig, script: string): void {
  for (const token of script.split(/\s+/).filter(Boolean)) {
    if (token.startsWith("wait:")) {
      rig.advance(Number(token.slice(5)));
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

export const PROBE_SCENARIOS: Record<string, (id: string) => void> = {
  "probe/persist-reboot": persistReboot,
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
