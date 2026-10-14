// The acceptance scenarios (plan 13 "Scenario harness and coverage guard"): every asserted
// golden's scenario, the known gaps, and `describeGoldens`, which the acceptance test files run
// in slices so they run in parallel (plan 16 Task 9). A golden marked `asserted` without a
// scenario fails; `pending` goldens are listed as todos naming their plan.
import { join } from "node:path";
import { expect, it } from "vite-plus/test";
import type { Golden, GoldenScenario } from "../../scripts/golden-format.ts";
import {
  readGoldenIndex,
  type GoldenIndexEntry as IndexEntry,
} from "../../scripts/golden-index.ts";
import type { StockPhoneConfig } from "../../src/index";
import {
  expectLcd,
  expectTimeline,
  lcdMismatch,
  TIMING_TOLERANCE_MS,
  type RecordedTimeline,
} from "./golden.ts";
import { goto, open } from "./drive.ts";
import { SNAKE_SCENARIOS } from "./game.ts";
import { BOOT_SCENARIOS, PROBE_SCENARIOS } from "./probes.ts";
import { SOUND_SCENARIOS } from "./sound-scenarios.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { frameAt, standbyRig, stockRig, type Rig } from "./rig.ts";

export type { IndexEntry };

export const INDEX: readonly IndexEntry[] = readGoldenIndex(
  join(import.meta.dirname, "../../goldens"),
);

/** The kernel's long press: power turns the phone on this long after the key goes down. */
export const LONG_PRESS_MS = 800;

/** Menu, then ▼ to carousel item `number` (1-based), with the icon settled. */
function carouselRig(number: number): Rig {
  const rig = standbyRig();
  rig.press("navi");
  for (let i = 1; i < number; i++) rig.press("down");
  rig.advance(6000);
  return rig;
}

/** How long after the trigger a timeline golden ends (the last frame's end, or lower bound). */
function spanAfterTrigger(golden: Golden): number {
  const rows = golden.timeline!;
  const trigger = rows[golden.triggerFrame as number]!;
  const last = rows[rows.length - 1]!;
  return last.startMs + last.durationMs - trigger.startMs;
}

function recordTimeline(rig: Rig, golden: Golden, trigger: () => void): RecordedTimeline {
  return rig.record(spanAfterTrigger(golden) + 100, trigger);
}

export const SLUGS = [
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

/**
 * When each carousel still was shot, in ms after its trigger (Menu for 01, ▼ for the rest).
 * `v639-all.cap` taps the key, records 3 s, then shoots; the recording starts when the tap
 * returns. Measured from REF by aligning each 3 s recording's first icon change with the same
 * change in `menu-anim-long` (whose frame 1 is the trigger), plus 3000 ms.
 */
const STILL_AT_MS: Readonly<Record<(typeof SLUGS)[number], number>> = {
  "01-phone-book": 3576,
  "02-messages": 3545,
  "03-chat": 3566,
  "04-call-register": 3557,
  "05-tones": 3550,
  "06-settings": 3549,
  "07-call-divert": 3544,
  "08-games": 3537,
  "09-calculator": 3551,
  "10-reminders": 3563,
  "11-clock": 3569,
  "12-profiles": 3553,
};

/** From the previous carousel item (or standby for 01), press the key that shows item `n`. */
function revealCarouselItem(n: number): { rig: Rig; trigger: () => void; context: string } {
  if (n === 1) {
    const rig = standbyRig();
    return { rig, trigger: () => rig.press("navi"), context: "standby, Menu" };
  }
  const rig = carouselRig(n - 1);
  return { rig, trigger: () => rig.press("down"), context: `Menu, ▼×${n - 2}, settle, ▼` };
}

function carouselStill(id: string, n: number): void {
  const slug = SLUGS[n - 1]!;
  const { rig, trigger, context } = revealCarouselItem(n);
  const at = STILL_AT_MS[slug];
  const recording = rig.record(at + TIMING_TOLERANCE_MS + 1, trigger);
  const golden = goldenImage(id, slug);
  // Within ±2 ms of a frame boundary either neighbouring frame may have been on screen.
  const shown = new Set(
    [at - TIMING_TOLERANCE_MS, at, at + TIMING_TOLERANCE_MS].map((t) =>
      frameAt(recording, recording.triggerMs + t),
    ),
  );
  if ([...shown].some((frame) => lcdMismatch(frame.pixels, golden, context) === undefined)) return;
  expectLcd(frameAt(recording, recording.triggerMs + at), golden, `${context}, ${at} ms later`);
}

function carouselAnim(id: string, n: number): void {
  const golden = loadGolden(id);
  const { rig, trigger, context } = revealCarouselItem(n);
  expectTimeline(recordTimeline(rig, golden, trigger), golden, context);
}

/** Menu, ▼ to item `n`, Select, then ▼ per image; each image is the screen after its key. */
function levelOne(id: string, n: number, config: Partial<StockPhoneConfig> = {}): void {
  const golden = loadGolden(id);
  const rig = standbyRig(config);
  rig.press("navi");
  rig.advance(100);
  for (let i = 1; i < n; i++) rig.press("down");
  rig.press("navi");
  golden.images.forEach((image, i) => {
    if (i > 0) rig.press("down");
    rig.advance(10);
    expectLcd(rig.paint(), { id, image }, `Menu, ▼×${n - 1}, Select, ▼×${i}`);
  });
}

export const SCENARIOS: Record<string, (id: string) => void> = {
  "boot/power-on": (id) => {
    const golden = loadGolden(id);
    const rig = stockRig();
    rig.advance(100);
    rig.hold("power");
    rig.advance(LONG_PRESS_MS - 2);
    // The trigger is the tick on which the held power key turns the phone on.
    const recording = recordTimeline(rig, golden, () => {
      rig.advance(1);
      rig.release("power");
    });
    expectTimeline(recording, golden, "hold power until the phone turns on");
    expectLcd(rig.paint(), goldenImage("standby/standby", "01-standby"), "after boot");
  },
  "standby/standby": (id) => {
    expectLcd(standbyRig().paint(), goldenImage(id, "01-standby"), "power on (boot skipped)");
  },
  "standby/standby-1948": (id) => {
    const rig = standbyRig({ clock: () => "19:48" });
    expectLcd(rig.paint(), goldenImage(id, "standby"), "power on at 19:48");
  },
  "standby/standby-0759": (id) => {
    const rig = standbyRig({ clock: () => "07:59" });
    expectLcd(rig.paint(), goldenImage(id, "standby"), "power on at 07:59");
  },
  "standby/idle": (id) => {
    const rig = standbyRig();
    expectTimeline(rig.record(10_000), loadGolden(id), "standby, no key for 10 s");
  },
  "menu/revisit.anim": (id) => {
    const golden = loadGolden(id);
    const rig = carouselRig(12);
    expectTimeline(
      recordTimeline(rig, golden, () => rig.press("up")),
      golden,
      "Profiles, ▲",
    );
  },
  "menu/return.anim": (id) => {
    const golden = loadGolden(id);
    const rig = carouselRig(11);
    rig.press("navi");
    rig.advance(2000);
    expectTimeline(
      recordTimeline(rig, golden, () => rig.press("c")),
      golden,
      "Clock, Select, 2 s, C",
    );
  },
  "menu/01-phone-book.sub-up": (id) => {
    const golden = loadGolden(id);
    const rig = standbyRig();
    rig.press("navi");
    rig.advance(100);
    rig.press("navi");
    for (let i = 0; i < 5; i++) rig.press("down");
    golden.images.forEach((image, i) => {
      if (i > 0) rig.press("up");
      rig.advance(10);
      expectLcd(rig.paint(), { id, image }, `Phone book, ▼×5, ▲×${i}`);
    });
  },
  "menu/11-clock.sub-1948": (id) => levelOne(id, 11, { clock: () => "19:48" }),
  "menu/11-clock.sub-0759": (id) => levelOne(id, 11, { clock: () => "07:59" }),
};
Object.assign(SCENARIOS, PROBE_SCENARIOS, BOOT_SCENARIOS, SNAKE_SCENARIOS, SOUND_SCENARIOS);
SLUGS.forEach((slug, i) => {
  SCENARIOS[`menu/${slug}`] = (id) => carouselStill(id, i + 1);
  SCENARIOS[`menu/${slug}.anim`] = (id) => carouselAnim(id, i + 1);
  // Chat and Calculator open placeholders; their captured first screens are pending goldens.
  if (slug !== "03-chat" && slug !== "09-calculator") {
    SCENARIOS[`menu/${slug}.sub`] = (id) => levelOne(id, i + 1);
  }
});

/**
 * After `goto`, the trigger comes one harness tap later, as in the captures (`key`: ≈42 ms down,
 * the 250 ms settle and the 300 ms key gap): Screen saver's entry indicator (≈2.9 s) is still on
 * screen when its leaves are selected (`tree/05-tones/5-9-1.leaf` frame 0).
 */
const SETTLE_MS = 592;

/**
 * `golden` with every row that shows frame 0's image (the parent screen before the trigger, and
 * the same screen when the note returns) replaced by `parent`: a shared golden's image `a` is its
 * first covered node's parent, so the other covered nodes compare against their own (Task 2
 * deviation).
 */
function withOwnParent(golden: Golden, parent: Uint8Array): Golden {
  const rows = golden.timeline!;
  const frame0 = rows[(golden.triggerFrame as number) - 1]!.image;
  const name = "own-parent";
  return {
    ...golden,
    images: [...golden.images, { name, pixels: parent }],
    timeline: rows.map((row) => (row.image === frame0 ? { ...row, image: name } : row)),
  };
}

/** Opens `number` and compares one image per ▼ (`list`, `options`) or the first (`open`). */
function treeStills(id: string, number: string, scenario: "list" | "options" | "open"): void {
  const golden = loadGolden(id);
  const rig = standbyRig();
  open(rig, number);
  const images = scenario === "open" ? golden.images.slice(0, 1) : golden.images;
  images.forEach((image, i) => {
    if (i > 0) rig.press("down");
    rig.advance(10);
    expectLcd(rig.paint(), { id, image }, `open ${number}, ▼×${i}`);
  });
}

/**
 * Highlights `number` in its parent (an option in its open list), settles, then records Select
 * (OK) as the trigger. The first covered node also matches frame 0; the others compare frame 0's
 * rows with their own parent screen.
 */
function treeTimeline(id: string, number: string, first: boolean): void {
  const golden = loadGolden(id);
  const rig = standbyRig();
  goto(rig, number);
  rig.advance(SETTLE_MS);
  const parent = rig.paint().pixels;
  const context = `${number} highlighted, Select`;
  if (golden.triggerFrame === 0) {
    // The key changes nothing (Polish): the screen stays as long as the recording ran.
    const still = golden.timeline![0]!;
    if (first) expectLcd({ pixels: parent }, goldenImage(id, still.image), `${number} highlighted`);
    const recording = rig.record(still.durationMs, () => rig.press("navi"));
    expect(recording.frames.length, `${context}: the screen changed`).toBe(1);
    return;
  }
  const frame0 = golden.timeline![(golden.triggerFrame as number) - 1]!.image;
  if (first) expectLcd({ pixels: parent }, goldenImage(id, frame0), `${number} highlighted`);
  const recording = recordTimeline(rig, golden, () => rig.press("navi"));
  expectTimeline(recording, first ? golden : withOwnParent(golden, parent), context);
}

/** The generic scenario of a generated tree golden (plan 14 D7), per covered node. */
function treeScenario(id: string, covers: readonly string[]): void {
  const golden = loadGolden(id);
  const scenario: GoldenScenario | undefined = golden.scenario;
  if (scenario === undefined) throw new Error(`${id} declares no scenario.`);
  covers.forEach((number, i) => {
    if (scenario === "leaf" || scenario === "choose") treeTimeline(id, number, i === 0);
    else treeStills(id, number, scenario);
  });
}

const PARTIAL_8 =
  "`8` first draws a 16 ms partial frame (image d: the first 27 bytes of the Games screen over " +
  "Phone book's), a redraw in progress that the kernel does not reproduce (closeout decision 2: " +
  "no key-to-redraw latency) and exact pixels cannot skip";
const ON_OVER_GAMES =
  "while 8-6 is opening the firmware draws Settings' first page value (`On`) over the Games " +
  "list (image f)";

/** Plan 16: Badinerie's Level 4 recording (its program) rests 8 ms where other recordings do not. */
const BADINERIE_REST =
  "Badinerie's Level 4 recording, the program, rests 8 ms between two 831 Hz notes ≈2.28 s " +
  "into the preview; this recording plays them as one";

/**
 * Asserted goldens whose scenario cannot pass, each with its reason: separate recordings of one
 * path that disagree beyond what the comparison allows (partial draws caught at different
 * points, timer spreads beyond PROBE_TOLERANCE_MS), or a firmware quirk behind one. Their
 * scenarios run as expected failures, so a gap that starts passing must leave this table.
 */
export const KNOWN_GAPS: Readonly<Record<string, string>> = {
  "probe/accept-6-3-5-on":
    "the prompt first draws a 15 ms partial frame (image b: the soft key row still shows " +
    "Select's last letter), a redraw in progress that the kernel does not reproduce (closeout " +
    "decision 2); probe/accept-6-3-5-off's prompt, the same path, has none",
  "boot/security-lockout-4":
    "Code accepted and the hands play boot/security-gate's timeline (689/232/582 ms, then a " +
    "308 ms first hands step); this recording's are 678/232/575 and 299 ms, so the hands start " +
    "26-28 ms late, a spread between two recordings of one path beyond PROBE_TOLERANCE_MS. The " +
    "fact it records, four wrong codes do not lock, passes up to Code accepted",
  "probe/note-keys-done-down-300":
    "Done's 16 ms partial draw covers fewer LCD bytes than the 15 ms one of " +
    "tree/01-phone-book/1-8-1-1.choose (same path), whose timeline the note plays",
  "probe/shortcut-m1-wait-9":
    "Speed dials opens 1502 ms after the 9's redraw (1427-1477 ms in the other shortcut " +
    "probes, 1460 configured): -42 ms; the captures record redraws, not key times",
  "probe/shortcut-m8-1": PARTIAL_8,
  "probe/shortcut-m8-1-2": `${PARTIAL_8}; Snake II opens 1427 ms after the 1's redraw (-33 ms)`,
  "probe/shortcut-m8-6": `${PARTIAL_8}; ${ON_OVER_GAMES}`,
  "game/snake/keys-c-hold":
    "C held through the suspend goes on to standby in the capture, but the kernel swallows the " +
    "keys held when an application exits, so the held C's long press never fires (phone-core; " +
    "the game suspends on C's key-down, as the capture shows the menu while C is held)",
  "sound/keypad/pair":
    "the ▲ pressed 70 ms before the DSP powers down beeps for 77 ms in the capture (one " +
    "recording: the tone starts 93 ms after the key and stops where a 145 ms beep would); " +
    "nokia-os beeps 145 ms (plan 16 D8)",
  "sound/note/1-2":
    "Phone book › Search shows `No phone numbers` ≈150 ms after OK in the capture, so OK's " +
    "beep sounds before the note's tone replaces it; nokia-os opens the note at the key " +
    "(plan 14 D8), so its tone replaces the beep at once",
  "sound/alert/ascending-l5":
    "Ascending at Level 5: the Level 2 → 3 step and Nokia tune's last note race in this " +
    "recording (that note stays at Level 2; in the Level 4 recordings it steps, `ascendingAt`)",
  "sound/alert/ascending/15-badinerie": BADINERIE_REST,
  "sound/ringing-tone/level-3/15-badinerie": BADINERIE_REST,
  "sound/ringing-tone/level-5/33-mangrove":
    "this recording lacks Mangrove's 27th 7 ms chirp (≈25.7 s into the preview; 35 of the 36 " +
    "the Level 4 recording, the program, plays)",
  "probe/shortcut-m8-6-3":
    `${PARTIAL_8}; ${ON_OVER_GAMES}; the window ends 2920 ms after the 3's redraw ` +
    "(2948 configured, +28 ms)",
};

/** The scenario of an asserted golden: hand-written (plan 13, probes) or generic (tree). */
export function scenarioOf(
  id: string,
  covers: readonly string[] | undefined,
): (() => void) | undefined {
  const scenario = SCENARIOS[id];
  if (scenario !== undefined) return () => scenario(id);
  if (covers !== undefined) return () => treeScenario(id, covers);
  return undefined;
}

/**
 * One `it` per golden of `INDEX` that `include` takes: asserted ones run their scenario (a known
 * gap as an expected failure, so a gap that starts passing must leave KNOWN_GAPS; one without a
 * scenario fails), pending ones are todos naming their plan.
 */
export function describeGoldens(include: (id: string) => boolean): void {
  for (const { id, status, covers } of INDEX) {
    if (!include(id)) continue;
    if (status !== "asserted") {
      it.todo(`${id} (${status.replace("pending:", "pending: plan ")})`);
      continue;
    }
    const scenario = scenarioOf(id, covers);
    const gap = KNOWN_GAPS[id];
    if (gap !== undefined && scenario !== undefined) {
      it.fails(`${id} (known gap: ${gap})`, scenario);
      continue;
    }
    it(
      id,
      () => {
        if (scenario === undefined) throw new Error(`no scenario for ${id}`);
        scenario();
      },
      TIMEOUTS_MS[id],
    );
  }
}

/**
 * Scenarios that may outlast the default 5 s timeout on a loaded machine: `game/snake/periods`
 * plays New game at all 166 captured levels on one phone (≈1.6 s alone, the longest scenario,
 * ≈5× any other).
 */
const TIMEOUTS_MS: Readonly<Record<string, number>> = { "game/snake/periods": 20_000 };

/**
 * The slices the acceptance files run (each file one, so they run in parallel): Snake II's
 * goldens, the sound goldens in two halves, and the rest (`acceptance.test.ts`).
 */
export const ACCEPTANCE_SLICES = {
  games: (id: string): boolean => id.startsWith("game/"),
  "sound-tones": (id: string): boolean => /^sound\/(ringing-tone|ringing-volume|alert)\//.test(id),
  sound: (id: string): boolean =>
    id.startsWith("sound/") && !/^sound\/(ringing-tone|ringing-volume|alert)\//.test(id),
} as const;

/** Goldens no slice takes: `acceptance.test.ts` runs them. */
export const isRest = (id: string): boolean =>
  !Object.values(ACCEPTANCE_SLICES).some((slice) => slice(id));
