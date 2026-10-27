// The shared game-golden machinery (plan 24 Task 3, split from plan 23's) and Space impact's
// frame predicate, tick rule and still selection, on synthetic recordings.
import { describe, expect, it } from "vite-plus/test";
import {
  inputFromKeys,
  numberTicks,
  playBackToBack,
  selectTickStills,
  type GameRecordingFrame,
  type PlayedFrame,
} from "../scripts/game-capture.ts";
import {
  hud,
  isSpaceImpactFrame,
  normalized,
  spaceImpactTicks,
  SPACE_IMPACT_FIRST_TICK_MS,
  SPACE_IMPACT_PERIOD_MS,
} from "../scripts/capture-sets/24-space-impact.ts";
import { LCD_HEIGHT, LCD_WIDTH } from "../scripts/golden-format.ts";

const P = SPACE_IMPACT_PERIOD_MS;

/** 3x5 HUD digits as drawn (rows top to bottom). */
const GLYPHS: readonly string[] = [
  "111101101101111",
  "010110010010010",
  "111001111100111",
  "111001111001111",
  "101101111001001",
  "111100111001111",
  "111100111101111",
  "111001010010010",
  "111101111101111",
  "111101111001111",
];

/**
 * A Space impact frame: the HUD (score at x 57, special count at x 43; at the top, or at the
 * bottom with `bottom`) and a mark at (x, 25) in the play field; `inverted` draws it on the black
 * fill of levels 0, 4 and 5.
 */
function frame(
  x: number,
  opts: { score?: number; special?: number; inverted?: boolean; bottom?: boolean } = {},
) {
  const pixels = new Uint8Array(LCD_WIDTH * LCD_HEIGHT);
  const set = (px: number, py: number): void => {
    pixels[py * LCD_WIDTH + px] = 1;
  };
  const top = opts.bottom ? 43 : 0;
  const number = (value: number, digits: number, x0: number) => {
    const text = String(value).padStart(digits, "0");
    text.split("").forEach((d, k) => {
      const glyph = GLYPHS[Number(d)]!;
      for (let i = 0; i < 15; i++) {
        if (glyph[i] === "1") set(x0 + 4 * k + (i % 3), top + Math.floor(i / 3));
      }
    });
  };
  number(opts.score ?? 0, 5, 57);
  number(opts.special ?? 3, 2, 43);
  set(x, 25);
  return opts.inverted ? pixels.map((v) => v ^ 1) : pixels;
}

function played(rows: readonly [number, Uint8Array][]): PlayedFrame[] {
  const frames: GameRecordingFrame[] = rows.map(([startMs, pixels], i) => ({
    pixels,
    startMs,
    durationMs: (rows[i + 1]?.[0] ?? startMs + 100) - startMs,
  }));
  return playBackToBack([{ dir: "rec", frames }]).frames;
}

const blank = () => new Uint8Array(LCD_WIDTH * LCD_HEIGHT);

describe("Space impact's frame predicate", () => {
  it("reads the HUD in both polarities", () => {
    expect(hud(frame(20, { score: 1325, special: 2 }))).toEqual({
      score: 1325,
      special: 2,
      row: 0,
    });
    const inverted = frame(20, { score: 70, inverted: true });
    expect(hud(inverted)).toBeUndefined();
    expect(hud(normalized(inverted))).toEqual({ score: 70, special: 3, row: 0 });
    expect(isSpaceImpactFrame(inverted)).toBe(true);
  });

  it("reads the HUD under the ceiling terrain of levels 4 and 5, at the bottom", () => {
    const bottom = frame(20, { score: 3340, inverted: true, bottom: true });
    expect(hud(normalized(bottom))).toEqual({ score: 3340, special: 3, row: 43 });
    const touching = normalized(bottom);
    touching[42 * LCD_WIDTH + 30] = 1;
    expect(isSpaceImpactFrame(touching)).toBe(false);
  });

  it("rejects frames without the HUD, or with ink in the row under it", () => {
    expect(isSpaceImpactFrame(blank())).toBe(false);
    const broken = frame(20);
    broken[57] = 0; // (57, 0): the score's first digit is no digit
    expect(isSpaceImpactFrame(broken)).toBe(false);
    const row5 = frame(20);
    row5[5 * LCD_WIDTH + 30] = 1;
    expect(isSpaceImpactFrame(row5)).toBe(false);
  });
});

describe("Space impact's ticks", () => {
  it("numbers the New game frame 0, the first tick after it, then one per period", () => {
    const t0 = 66;
    const ticks = numberTicks(
      played([
        [0, blank()],
        [t0, frame(0)],
        [t0 + SPACE_IMPACT_FIRST_TICK_MS, frame(1)],
        [t0 + SPACE_IMPACT_FIRST_TICK_MS + P, frame(2)],
        [t0 + SPACE_IMPACT_FIRST_TICK_MS + 2 * P + 14, frame(3)],
        [t0 + SPACE_IMPACT_FIRST_TICK_MS + 3 * P - 10, frame(4)],
      ]),
      spaceImpactTicks("new-game"),
    );
    expect(ticks.map((t) => [t.tick, t.virtual])).toEqual([
      [0, false],
      [1, false],
      [2, false],
      [3, false],
      [4, false],
    ]);
  });

  it("counts ticks that drew nothing (a step eaten by a pending sound, H16)", () => {
    const ticks = numberTicks(
      played([
        [0, frame(0)],
        [P, frame(1)],
        [3 * P, frame(2)],
        [4 * P, frame(3)],
      ]),
      spaceImpactTicks("running"),
    );
    expect(ticks.map((t) => [t.tick, t.virtual])).toEqual([
      [0, false],
      [1, false],
      [2, true],
      [3, false],
      [4, false],
    ]);
  });

  it("ignores the continue screen and other non-game frames", () => {
    const ticks = numberTicks(
      played([
        [0, frame(0, { inverted: true })],
        [P, blank()],
        [2 * P, frame(1, { inverted: true })],
      ]),
      spaceImpactTicks("running"),
    );
    expect(ticks.map((t) => t.tick)).toEqual([0, 1, 2]);
    expect(ticks[2]!.virtual).toBe(false);
  });
});

describe("input with releases (D9)", () => {
  const ticks = numberTicks(
    played(Array.from({ length: 12 }, (_, i): [number, Uint8Array] => [i * P, frame(i)])),
    spaceImpactTicks("running"),
  );

  it("a key released before the next tick is a tap; a later release is held to its tick", () => {
    expect(
      inputFromKeys(
        ticks,
        [
          { key: "1", pressMs: 2 * P + 2, releaseMs: 2 * P + 24 },
          { key: "8", pressMs: 3 * P + 2, releaseMs: 7 * P + 2 },
          { key: "menu", pressMs: 9 * P + 27, releaseMs: 9 * P + 49 },
        ],
        "rec",
      ),
    ).toEqual([
      { tick: 2, key: "1" },
      { tick: 3, key: "8" },
      { tick: 7, key: "8", release: true },
      { tick: 9, key: "navi" },
    ]);
  });

  it("orders a release among the presses of its tick", () => {
    expect(
      inputFromKeys(
        ticks,
        [
          { key: "8", pressMs: 3 * P + 2, releaseMs: 5 * P + 2 },
          { key: "1", pressMs: 5 * P + 27, releaseMs: 5 * P + 49 },
        ],
        "rec",
      ),
    ).toEqual([
      { tick: 3, key: "8" },
      { tick: 5, key: "8", release: true },
      { tick: 5, key: "1" },
    ]);
  });
});

describe("selectTickStills", () => {
  const ticks = numberTicks(
    played(
      Array.from({ length: 40 }, (_, i): [number, Uint8Array] => [
        i * P,
        frame(i % 30, { score: i >= 20 ? 10 : 0 }),
      ]),
    ),
    spaceImpactTicks("running"),
  );
  const scored = (a: Uint8Array, b: Uint8Array) =>
    hud(normalized(a))?.score !== hud(normalized(b))?.score;

  it("keeps tick 0, events ±around, every n-th tick and the last ones", () => {
    expect(
      selectTickStills(ticks, { first: true, event: scored, around: 1, every: 16, last: 3 }),
    ).toEqual([0, 16, 19, 20, 21, 32, 37, 38, 39]);
  });

  it("keeps each input tick and the ticks after it", () => {
    expect(selectTickStills(ticks, { afterInput: 2 }, [{ tick: 5, key: "1" }])).toEqual([5, 6, 7]);
  });
});
