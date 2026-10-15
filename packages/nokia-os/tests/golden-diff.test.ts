import { afterEach, describe, expect, it } from "vite-plus/test";
import { LCD_HEIGHT, LCD_WIDTH, type Golden } from "../scripts/golden-format.ts";
import {
  expectLcd,
  expectTimeline,
  FRAME_MS,
  timingToleranceMs,
  type RecordedTimeline,
} from "./support/golden.ts";

function pixels(...lit: [number, number][]): Uint8Array {
  const out = new Uint8Array(LCD_WIDTH * LCD_HEIGHT);
  for (const [x, y] of lit) out[y * LCD_WIDTH + x] = 1;
  return out;
}

function failure(run: () => void): string {
  try {
    run();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected a failure");
}

const SHA = "0".repeat(64);
const DOTS = ".".repeat(11);

// Golden ink at (10,20) (11,20) (12,21); actual ink at (10,20) (11,21) (12,21) (13,22):
// (11,20) is missing, (11,21) and (13,22) are extra.
const goldenRef = {
  id: "menu/02-messages.sub",
  image: { name: "01", pixels: pixels([10, 20], [11, 20], [12, 21]) },
};
const actual = { pixels: pixels([10, 20], [11, 21], [12, 21], [13, 22]) };

afterEach(() => {
  delete process.env.LCD_DIFF;
});

describe("expectLcd", () => {
  it("passes identical frames", () => {
    expect(() => expectLcd({ pixels: goldenRef.image.pixels }, goldenRef, "x")).not.toThrow();
  });

  it("prints a padded difference window with ruler, legend and counts", () => {
    expect(failure(() => expectLcd(actual, goldenRef, "Menu, ▼×1, Select"))).toBe(
      [
        'LCD mismatch: menu/02-messages.sub image "01"',
        "scenario: Menu, ▼×1, Select",
        "3 px differ (2 extra, 1 missing); first at (x=11, y=20); differences in x=11..13, y=20..22",
        "legend: '#' ink in both  '.' clear in both  '+' ink only in actual  '-' ink only in golden",
        "",
        "          0  1",
        "          78901234567",
        `    16    ${DOTS}`,
        `    17    ${DOTS}`,
        `    18    ${DOTS}`,
        `    19    ${DOTS}`,
        "    20    ...#-......",
        "    21    ....+#.....",
        "    22    ......+....",
        `    23    ${DOTS}`,
        `    24    ${DOTS}`,
        `    25    ${DOTS}`,
        `    26    ${DOTS}`,
        "window x=7..17, y=16..26 of 84x48; set LCD_DIFF=full to print golden | actual | diff side by side",
      ].join("\n"),
    );
  });

  it("clamps the window to the frame", () => {
    const message = failure(() =>
      expectLcd(
        { pixels: pixels([0, 0]) },
        { id: "g", image: { name: "a", pixels: pixels() } },
        "s",
      ),
    );
    expect(message.split("\n").slice(2)).toEqual([
      "1 px differ (1 extra, 0 missing); first at (x=0, y=0); differences in x=0..0, y=0..0",
      "legend: '#' ink in both  '.' clear in both  '+' ink only in actual  '-' ink only in golden",
      "",
      "          0",
      "          01234",
      "     0    +....",
      "     1    .....",
      "     2    .....",
      "     3    .....",
      "     4    .....",
      "window x=0..4, y=0..4 of 84x48; set LCD_DIFF=full to print golden | actual | diff side by side",
    ]);
  });

  it("shows the full width when the window is wider than 48 columns", () => {
    const message = failure(() =>
      expectLcd(
        { pixels: pixels([0, 10], [60, 10]) },
        { id: "g", image: { name: "a", pixels: pixels() } },
        "s",
      ),
    );
    const out = message.split("\n");
    expect(out[5]).toBe(
      "          0         1         2         3         4         5         6         7         8",
    );
    expect(out[6]).toBe("          " + "0123456789".repeat(8) + "0123");
    expect(out[7]).toBe("     6    " + ".".repeat(84));
    expect(out[11]).toBe("    10    +" + ".".repeat(59) + "+" + ".".repeat(23));
    expect(out.at(-1)).toBe(
      "window x=0..83, y=6..14 of 84x48; set LCD_DIFF=full to print golden | actual | diff side by side",
    );
  });

  it("prints golden | actual | diff side by side with LCD_DIFF=full", () => {
    process.env.LCD_DIFF = "full";
    const out = failure(() => expectLcd(actual, goldenRef, "s")).split("\n");
    expect(out.slice(0, 6)).toEqual([
      'LCD mismatch: menu/02-messages.sub image "01"',
      "scenario: s",
      "3 px differ (2 extra, 1 missing); first at (x=11, y=20); differences in x=11..13, y=20..22",
      "legend: '#' ink in both  '.' clear in both  '+' ink only in actual  '-' ink only in golden",
      "",
      "full frame: golden | actual | diff",
    ]);
    expect(out).toHaveLength(6 + LCD_HEIGHT);
    const row = (golden: string, act: string, diff: string) =>
      `20  ${golden.padEnd(84, ".")} | ${act.padEnd(84, ".")} | ${diff.padEnd(84, ".")}`;
    expect(out[6 + 20]).toBe(row("..........##", "..........#", "..........#-"));
    expect(out[6 + 0]).toBe(` 0  ${".".repeat(84)} | ${".".repeat(84)} | ${".".repeat(84)}`);
  });
});

// a b c b with trigger-frame 1; the last frame is a lower bound.
const imgA = pixels([0, 0]);
const imgB = pixels([1, 1]);
const imgC = pixels([2, 2]);
const timeline: Golden = {
  id: "menu/05-tones.anim",
  status: "asserted",
  source: "captures/x",
  sourceSha256: SHA,
  triggerFrame: 1,
  omitted: [],
  images: [
    { name: "a", pixels: imgA },
    { name: "b", pixels: imgB },
    { name: "c", pixels: imgC },
  ],
  timeline: [
    { frame: 0, image: "a", startMs: 1, durationMs: 75, lowerBound: false, lcd: "normal", leds: 3 },
    {
      frame: 1,
      image: "b",
      startMs: 76,
      durationMs: 193,
      lowerBound: false,
      lcd: "normal",
      leds: 3,
    },
    {
      frame: 2,
      image: "c",
      startMs: 269,
      durationMs: 193,
      lowerBound: false,
      lcd: "normal",
      leds: 3,
    },
    {
      frame: 3,
      image: "b",
      startMs: 462,
      durationMs: 500,
      lowerBound: true,
      lcd: "normal",
      leds: 3,
    },
  ],
};

function recording(frames: [number, Uint8Array][], endMs = 2000): RecordedTimeline {
  return { triggerMs: 1000, endMs, frames: frames.map(([startMs, p]) => ({ startMs, pixels: p })) };
}

const HEADER = " frame image  golden start  actual start       Δ  pixels";
const STANDARD = "fidelity standard";

describe("expectTimeline", () => {
  it("passes a recording that matches after aligning on the trigger", () => {
    const ok = recording([
      [990, imgA],
      [1000, imgB],
      [1194, imgC],
      [1385, imgB],
    ]);
    expect(() => expectTimeline(ok, timeline, "s")).not.toThrow();
  });

  it("marks early and late frames beyond the tolerance", () => {
    const message = failure(() =>
      expectTimeline(
        recording([
          [1000, imgB],
          [1210, imgC],
          [1411, imgB],
        ]),
        timeline,
        "Menu, ▼×4",
      ),
    );
    expect(message).toBe(
      [
        `Timeline mismatch: menu/05-tones.anim (aligned: golden frame 1 = trigger; ${STANDARD})`,
        "scenario: Menu, ▼×4",
        HEADER,
        "     1 b               0.0           0.0     0.0  ok",
        "     2 c             193.0         210.0   +17.0  ok",
        "     3 b             386.0         411.0   +25.0  ok       ✗ timing",
        " last: golden ends ≥ 886.0 ms; actual held to ≥ 1000.0 ms  ok",
      ].join("\n"),
    );
  });

  it("reports frames that never show and a last frame that changes too soon", () => {
    const message = failure(() =>
      expectTimeline(
        recording([
          [1000, imgB],
          [1193, imgC],
          [1386, imgB],
          [1506, imgA],
        ]),
        timeline,
        "s",
      ),
    );
    expect(message.split("\n").slice(2)).toEqual([
      HEADER,
      "     1 b               0.0           0.0     0.0  ok",
      "     2 c             193.0         193.0     0.0  ok",
      "     3 b             386.0         386.0     0.0  ok",
      " last: golden ends ≥ 886.0 ms; actual changed at 506.0 ms  ✗",
    ]);

    const missing = failure(() =>
      expectTimeline(
        recording([
          [1000, imgB],
          [1193, imgC],
        ]),
        timeline,
        "s",
      ),
    );
    expect(missing.split("\n").slice(3)).toEqual([
      "     1 b               0.0           0.0     0.0  ok",
      "     2 c             193.0         193.0     0.0  ok",
      "     3 b             386.0             -       -  missing  ✗ never shown",
      " last: not reached  ✗",
    ]);
  });

  it("checks an exact last duration and a recording that ends too early", () => {
    const exact: Golden = {
      ...timeline,
      timeline: timeline.timeline!.map((row) =>
        row.frame === 3 ? { ...row, lowerBound: false } : row,
      ),
    };
    const frames: [number, Uint8Array][] = [
      [1000, imgB],
      [1193, imgC],
      [1386, imgB],
    ];
    expect(() => expectTimeline(recording([...frames, [1886, imgA]]), exact, "s")).not.toThrow();
    expect(
      failure(() => expectTimeline(recording(frames, 1700), exact, "s"))
        .split("\n")
        .at(-1),
    ).toBe(" last: golden ends 886.0 ms; actual held to ≥ 700.0 ms  ✗");
    expect(
      failure(() => expectTimeline(recording(frames, 1700), timeline, "s"))
        .split("\n")
        .at(-1),
    ).toBe(" last: golden ends ≥ 886.0 ms; actual held to ≥ 700.0 ms  ✗");
  });

  it("appends the LCD mismatch block for the first pixel failure", () => {
    const message = failure(() =>
      expectTimeline(
        recording([
          [1000, imgB],
          [1193, imgA],
          [1386, imgB],
        ]),
        timeline,
        "s",
      ),
    );
    const out = message.split("\n");
    expect(out.slice(3, 7)).toEqual([
      "     1 b               0.0           0.0     0.0  ok",
      "     2 c             193.0         193.0     0.0  differ   ✗ pixels",
      "     3 b             386.0         386.0     0.0  ok",
      " last: golden ends ≥ 886.0 ms; actual held to ≥ 1000.0 ms  ok",
    ]);
    expect(out.slice(7, 11)).toEqual([
      "",
      'LCD mismatch: menu/05-tones.anim image "c"',
      "scenario: s; timeline frame 2",
      "2 px differ (1 extra, 1 missing); first at (x=0, y=0); differences in x=0..2, y=0..2",
    ]);
  });

  it("skips untimed rows on request (probes), still comparing their pixels", () => {
    // The last b 40 ms late: within the standard only with row 3 untimed.
    const late = recording([
      [1000, imgB],
      [1180, imgC],
      [1426, imgB],
    ]);
    expect(failure(() => expectTimeline(late, timeline, "s"))).toMatch(/\+40\.0 +ok +✗ timing/);
    expect(() => expectTimeline(late, timeline, "s", { untimedRows: new Set([3]) })).not.toThrow();
    expect(() =>
      expectTimeline(
        recording([
          [1000, imgB],
          [1193, imgC],
          [1402, imgA],
        ]),
        timeline,
        "s",
        { untimedRows: new Set([3]) },
      ),
    ).toThrow(/✗ pixels/);
  });

  it("aligns before-recording fixtures on the first change and skips frame 0's timing", () => {
    const fallback: Golden = { ...timeline, triggerFrame: "before-recording" };
    const ok = recording(
      [
        [1000, imgA],
        [1400, imgB],
        [1593, imgC],
        [1786, imgB],
      ],
      2400,
    );
    expect(() => expectTimeline(ok, fallback, "s")).not.toThrow();

    const late = failure(() =>
      expectTimeline(
        recording([
          [1000, imgA],
          [1400, imgB],
          [1620, imgC],
          [1786, imgB],
        ]),
        fallback,
        "s",
      ),
    );
    expect(late.split("\n").slice(0, 7)).toEqual([
      `Timeline mismatch: menu/05-tones.anim (aligned: golden frame 1 = first change; ${STANDARD})`,
      "scenario: s",
      HEADER,
      "     0 a             -75.0        -400.0     n/a  ok",
      "     1 b               0.0           0.0     0.0  ok",
      "     2 c             193.0         220.0   +27.0  ok       ✗ timing",
      "     3 b             386.0         386.0     0.0  ok",
    ]);
  });
});

// The fidelity standard (AGENTS.md): settled pixels exact, starts within one display frame (17
// ms), or 50 ms from 1 s after the trigger, and frames under 17 ms neither required nor forbidden.
describe("the fidelity standard", () => {
  const imgP = pixels([3, 3]);
  const row = (frame: number, image: string, startMs: number, durationMs: number) => ({
    frame,
    image,
    startMs,
    durationMs,
    lowerBound: false,
    lcd: "normal" as const,
    leds: 3,
  });
  /** a, then b (the trigger), a partial draw p of `partialMs`, c, and b held ≥ 500 ms. */
  const withPartial = (partialMs: number): Golden => ({
    ...timeline,
    images: [...timeline.images, { name: "p", pixels: imgP }],
    timeline: [
      row(0, "a", 1, 75),
      row(1, "b", 76, 193),
      row(2, "p", 269, partialMs),
      row(3, "c", 269 + partialMs, 193 - partialMs),
      { ...row(4, "b", 462, 500), lowerBound: true },
    ],
  });
  const plain: [number, Uint8Array][] = [
    [1000, imgB],
    [1193, imgC],
    [1386, imgB],
  ];

  it("allows one display frame, growing as 5 % of the elapsed time to 50 ms from 1 s", () => {
    expect([0, 193, 340, 500, 900, 1000, 2900, -1200].map(timingToleranceMs)).toEqual([
      17, 17, 17, 25, 45, 50, 50, 50,
    ]);
    expect(FRAME_MS).toBe(17);
  });

  it("ignores a 16 ms partial frame in the golden, shown or not", () => {
    const golden = withPartial(16);
    expect(() => expectTimeline(recording(plain), golden, "s")).not.toThrow();
    const shown = recording([
      [1000, imgB],
      [1193, imgP],
      [1209, imgC],
      [1386, imgB],
    ]);
    expect(() => expectTimeline(shown, golden, "s")).not.toThrow();
  });

  it("pairs a golden partial draw with the same picture shown longer", () => {
    // p for 9 ms in the golden, 23 ms here (starting 14 ms earlier): c still starts in time.
    const longer = recording([
      [1000, imgB],
      [1179, imgP],
      [1202, imgC],
      [1386, imgB],
    ]);
    expect(() => expectTimeline(longer, withPartial(9), "s")).not.toThrow();
    // Not in the golden at all, a 23 ms frame is a difference.
    expect(failure(() => expectTimeline(longer, timeline, "s"))).toMatch(/✗ pixels/);
  });

  it("ignores a partial draw at the trigger", () => {
    // b's first 16 ms are a partial draw p in the golden; the recording draws b at once.
    const golden: Golden = {
      ...withPartial(16),
      timeline: [
        row(0, "a", 1, 75),
        row(1, "p", 76, 16),
        row(2, "b", 92, 177),
        row(3, "c", 269, 193),
        { ...row(4, "b", 462, 500), lowerBound: true },
      ],
    };
    expect(() => expectTimeline(recording(plain), golden, "s")).not.toThrow();
  });

  it("does not ignore a 30 ms frame in the golden", () => {
    expect(failure(() => expectTimeline(recording(plain), withPartial(30), "s"))).toMatch(
      /     2 p .*✗ pixels/,
    );
  });

  it("ignores a 16 ms partial frame in the recording, not a 30 ms one", () => {
    const partial = (ms: number) =>
      recording([
        [1000, imgB],
        [1177 - ms + 16, imgP],
        [1193, imgC],
        [1386, imgB],
      ]);
    expect(() => expectTimeline(partial(16), timeline, "s")).not.toThrow();
    // A partial draw that returns to the frame before it is no change at all.
    const flicker = recording([
      [1000, imgB],
      [1100, imgP],
      [1110, imgB],
      [1193, imgC],
      [1386, imgB],
    ]);
    expect(() => expectTimeline(flicker, timeline, "s")).not.toThrow();
    expect(failure(() => expectTimeline(partial(30), timeline, "s"))).toMatch(/✗ pixels/);
  });

  it("fails a short step's start 18 or 20 ms off, passes 20 ms from 400 ms on", () => {
    for (const late of [18, 20]) {
      const off = recording([
        [1000, imgB],
        [1193 + late, imgC],
        [1386, imgB],
      ]);
      expect(failure(() => expectTimeline(off, timeline, "s"))).toMatch(/c .*✗ timing/);
    }
    // a b c b with b's second showing 400 ms after the trigger: 20 ms late is within 5 %.
    const later: Golden = {
      ...timeline,
      timeline: timeline.timeline!.map((r) =>
        r.frame === 2 ? { ...r, durationMs: 207 } : r.frame === 3 ? { ...r, startMs: 476 } : r,
      ),
    };
    const late = recording([
      [1000, imgB],
      [1193, imgC],
      [1420, imgB],
    ]);
    expect(() => expectTimeline(late, later, "s")).not.toThrow();
    const later25 = recording([
      [1000, imgB],
      [1193, imgC],
      [1425, imgB],
    ]);
    expect(failure(() => expectTimeline(later25, later, "s"))).toMatch(/\+25\.0 +ok +✗ timing/);
  });

  it("allows 50 ms once a frame starts 1 s or more after the trigger", () => {
    // a, b (the trigger) held 1450 ms, then c held ≥ 500 ms.
    const note: Golden = {
      ...timeline,
      timeline: [
        row(0, "a", 1, 75),
        row(1, "b", 76, 1450),
        { ...row(2, "c", 1526, 500), lowerBound: true },
      ],
    };
    const cAt = (late: number) =>
      recording(
        [
          [1000, imgB],
          [2450 + late, imgC],
        ],
        3200,
      );
    expect(() => expectTimeline(cAt(20), note, "s")).not.toThrow();
    expect(() => expectTimeline(cAt(45), note, "s")).not.toThrow();
    expect(() => expectTimeline(cAt(-45), note, "s")).not.toThrow();
    expect(failure(() => expectTimeline(cAt(60), note, "s"))).toMatch(/\+60\.0 +ok +✗ timing/);
    expect(failure(() => expectTimeline(cAt(100), note, "s"))).toMatch(/\+100\.0 +ok +✗ timing/);
  });

  it("still fails a wrong pixel in a settled frame", () => {
    const wrong = recording([
      [1000, imgB],
      [1193, pixels([2, 2], [40, 40])],
      [1386, imgB],
    ]);
    expect(failure(() => expectTimeline(wrong, timeline, "s"))).toMatch(
      /1 px differ \(1 extra, 0 missing\)/,
    );
  });
});
