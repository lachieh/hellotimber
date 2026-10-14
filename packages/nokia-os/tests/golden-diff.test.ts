import { afterEach, describe, expect, it } from "vite-plus/test";
import { LCD_HEIGHT, LCD_WIDTH, type Golden } from "../scripts/golden-format.ts";
import {
  expectLcd,
  expectTimeline,
  PROBE_TOLERANCE_MS,
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
          [1190, imgC],
          [1420, imgB],
        ]),
        timeline,
        "Menu, ▼×4",
      ),
    );
    expect(message).toBe(
      [
        "Timeline mismatch: menu/05-tones.anim (aligned: golden frame 1 = trigger; tolerance ±2 ms)",
        "scenario: Menu, ▼×4",
        HEADER,
        "     1 b               0.0           0.0     0.0  ok",
        "     2 c             193.0         190.0    -3.0  ok       ✗ timing",
        "     3 b             386.0         420.0   +34.0  ok       ✗ timing",
        " last: golden holds ≥ 500 ms; actual held ≥ 580 ms  ok",
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
        { ...timeline, timeline: timeline.timeline },
        "s",
      ),
    );
    expect(message.split("\n").slice(2)).toEqual([
      HEADER,
      "     1 b               0.0           0.0     0.0  ok",
      "     2 c             193.0         193.0     0.0  ok",
      "     3 b             386.0         386.0     0.0  ok",
      " last: golden holds ≥ 500 ms; actual changed after 120 ms  ✗",
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
    ).toBe(" last: golden holds 500 ms; actual held ≥ 314 ms  ✗");
    expect(
      failure(() => expectTimeline(recording(frames, 1700), timeline, "s"))
        .split("\n")
        .at(-1),
    ).toBe(" last: golden holds ≥ 500 ms; actual held ≥ 314 ms  ✗");
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
      " last: golden holds ≥ 500 ms; actual held ≥ 614 ms  ok",
    ]);
    expect(out.slice(7, 11)).toEqual([
      "",
      'LCD mismatch: menu/05-tones.anim image "c"',
      "scenario: s; timeline frame 2",
      "2 px differ (1 extra, 1 missing); first at (x=0, y=0); differences in x=0..2, y=0..2",
    ]);
  });

  it("widens the tolerance and skips untimed rows on request (probes)", () => {
    // c 24 ms early, the last b 40 ms late: within ±25 ms only with row 3 untimed.
    const jittered = recording([
      [1000, imgB],
      [1169, imgC],
      [1426, imgB],
    ]);
    expect(() => expectTimeline(jittered, timeline, "s")).toThrow(/tolerance ±2 ms/);
    const message = failure(() =>
      expectTimeline(jittered, timeline, "s", { toleranceMs: PROBE_TOLERANCE_MS }),
    );
    expect(message).toMatch(/tolerance ±25 ms/);
    expect(message).toMatch(/\+40\.0 +ok +✗ timing/);
    expect(message).not.toMatch(/-24\.0 +ok +✗/);
    expect(() =>
      expectTimeline(jittered, timeline, "s", {
        toleranceMs: PROBE_TOLERANCE_MS,
        untimedRows: new Set([3]),
      }),
    ).not.toThrow();
    // An untimed row still compares its pixels.
    expect(() =>
      expectTimeline(
        recording([
          [1000, imgB],
          [1193, imgC],
          [1402, imgC],
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
          [1600, imgC],
          [1786, imgB],
        ]),
        fallback,
        "s",
      ),
    );
    expect(late.split("\n").slice(0, 7)).toEqual([
      "Timeline mismatch: menu/05-tones.anim (aligned: golden frame 1 = first change; tolerance ±2 ms)",
      "scenario: s",
      HEADER,
      "     0 a             -75.0        -400.0     n/a  ok",
      "     1 b               0.0           0.0     0.0  ok",
      "     2 c             193.0         200.0    +7.0  ok       ✗ timing",
      "     3 b             386.0         386.0     0.0  ok",
    ]);
  });
});
