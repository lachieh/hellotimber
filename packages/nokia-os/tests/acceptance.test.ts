// Acceptance: the stock phone, driven by key presses on a virtual 1 ms clock, reproduces every
// asserted golden pixel for pixel, and every timeline within ±2 ms after aligning on the
// transition (D9). A golden marked `asserted` without a scenario here fails (coverage guard);
// `pending` goldens are listed as todos naming their plan.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import type { Golden } from "../scripts/golden-format.ts";
import type { StockPhoneConfig } from "../src/index";
import {
  expectLcd,
  expectTimeline,
  lcdMismatch,
  TIMING_TOLERANCE_MS,
  type RecordedTimeline,
} from "./support/golden.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";
import { createRig, frameAt, type Rig } from "./support/rig.ts";

interface IndexEntry {
  id: string;
  status: string;
}

const INDEX: IndexEntry[] = JSON.parse(
  readFileSync(join(import.meta.dirname, "../goldens/index.json"), "utf8"),
);

/** The kernel's long press: power turns the phone on this long after the key goes down. */
const LONG_PRESS_MS = 800;

/**
 * The emulator's operator, clock and setup date are artefacts used as test inputs (D11). The
 * Task 11 captures set the clock to 19:48 and 07:59 instead of 10:10.
 */
function stockRig(config: Partial<StockPhoneConfig> = {}): Rig {
  return createRig({
    carrier: "Orange F",
    clock: () => "10:10",
    date: () => "13.10.2026",
    ...config,
  });
}

/** A phone at standby, booted with `boot: "skip"`, every timer settled. */
function standbyRig(config: Partial<StockPhoneConfig> = {}): Rig {
  const rig = stockRig({ boot: "skip", ...config });
  rig.press("power", 1000);
  rig.advance(1000);
  return rig;
}

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

const SLUGS = [
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

const SCENARIOS: Record<string, (id: string) => void> = {
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
  "menu/11-clock.sub-1948": (id) => levelOne(id, 11, { clock: () => "19:48" }),
  "menu/11-clock.sub-0759": (id) => levelOne(id, 11, { clock: () => "07:59" }),
};
SLUGS.forEach((slug, i) => {
  SCENARIOS[`menu/${slug}`] = (id) => carouselStill(id, i + 1);
  SCENARIOS[`menu/${slug}.anim`] = (id) => carouselAnim(id, i + 1);
  // Chat and Calculator open placeholders; their captured first screens are pending goldens.
  if (slug !== "03-chat" && slug !== "09-calculator") {
    SCENARIOS[`menu/${slug}.sub`] = (id) => levelOne(id, i + 1);
  }
});

describe("stock phone against every asserted v6.39 golden", () => {
  for (const { id, status } of INDEX) {
    if (status !== "asserted") {
      it.todo(`${id} (${status.replace("pending:", "pending: plan ")})`);
      continue;
    }
    const scenario = SCENARIOS[id];
    it(id, () => {
      if (scenario === undefined) throw new Error(`no scenario for ${id}`);
      scenario(id);
    });
  }

  it("has no scenario for a golden that is missing or not asserted", () => {
    const asserted = new Set(INDEX.filter((e) => e.status === "asserted").map((e) => e.id));
    expect(Object.keys(SCENARIOS).filter((id) => !asserted.has(id))).toEqual([]);
  });
});

describe("scenario rig", () => {
  it("starts a frame at power-on although boot's first image is as blank as off", () => {
    const rig = stockRig();
    rig.hold("power");
    rig.advance(LONG_PRESS_MS - 2);
    const recording = rig.record(10, () => rig.advance(1));
    expect(recording.frames.map((frame) => frame.startMs)).toEqual([LONG_PRESS_MS - 2, 800]);
    expect(recording.frames[1]!.pixels).toEqual(recording.frames[0]!.pixels);
    expect(recording.triggerMs).toBe(LONG_PRESS_MS);
  });

  it("keeps only frames whose pixels change", () => {
    // A placeholder application marks the screen dirty on every tick.
    const rig = standbyRig();
    rig.phone.navigate("menu/phone-book/search");
    const recording = rig.record(500);
    expect(recording.frames).toHaveLength(1);
  });
});
