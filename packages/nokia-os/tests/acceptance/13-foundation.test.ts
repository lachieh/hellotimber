// Plan 13's acceptance (docs/plans/13-nokia-os-foundation.md "Scenario harness and coverage
// guard"): the boot, standby, the menu carousel and its level lists, driven by key presses on a
// virtual 1 ms clock, pixel for pixel and every timeline by the fidelity standard after aligning
// on the transition (D9; tests/support/golden.ts).
import { MENU_SLUGS } from "../../scripts/capture-set.ts";
import type { StockPhoneConfig } from "../../src/index";
import {
  acceptancePlan,
  LONG_PRESS_MS,
  recordTimeline,
  type Scenario,
} from "../support/acceptance.ts";
import { expectLcd, expectTimeline, lcdMismatch, timingToleranceMs } from "../support/golden.ts";
import { goldenImage, loadGolden } from "../support/goldens.ts";
import { frameAt, standbyRig, stockRig, type Rig } from "../support/rig.ts";

const SLUGS = MENU_SLUGS;

/** Menu, then ▼ to carousel item `number` (1-based), with the icon settled. */
function carouselRig(number: number): Rig {
  const rig = standbyRig();
  rig.press("navi");
  for (let i = 1; i < number; i++) rig.press("down");
  rig.advance(6000);
  return rig;
}

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
  const toleranceMs = timingToleranceMs(at);
  const recording = rig.record(at + toleranceMs + 1, trigger);
  const golden = goldenImage(id, slug);
  // A frame boundary may move by the fidelity standard's tolerance, so any frame on screen within
  // it of the shot may be the shot's.
  const from = recording.triggerMs + at - toleranceMs;
  const shown = [
    frameAt(recording, from),
    ...recording.frames.filter(
      (frame) => frame.startMs > from && frame.startMs <= from + 2 * toleranceMs,
    ),
  ];
  if (shown.some((frame) => lcdMismatch(frame.pixels, golden, context) === undefined)) return;
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

const SCENARIOS: Record<string, Scenario> = {
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
SLUGS.forEach((slug, i) => {
  SCENARIOS[`menu/${slug}`] = (id) => carouselStill(id, i + 1);
  SCENARIOS[`menu/${slug}.anim`] = (id) => carouselAnim(id, i + 1);
  // Chat opens a placeholder; its captured first screens are pending goldens.
  if (slug !== "03-chat") {
    SCENARIOS[`menu/${slug}.sub`] = (id) => levelOne(id, i + 1);
  }
});

acceptancePlan({ plan: "13", scenarios: SCENARIOS });
