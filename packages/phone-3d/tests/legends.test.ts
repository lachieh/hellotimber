import { describe, expect, it } from "vite-plus/test";
import { ATLAS, LEGEND_CELLS, legendMark, paintLegendAtlas } from "../src/legends";
import type { Ctx2D, PrintedKey } from "../src/legends";

const KEYS = Object.keys(LEGEND_CELLS) as PrintedKey[];

/** A path's points (a curve stays inside its control points), in decal units. */
function points(d: string): [number, number][] {
  const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  return Array.from({ length: nums.length / 2 }, (_, i) => [nums[2 * i]!, nums[2 * i + 1]!]);
}

/** The print's bounds in decal units. */
function bounds(key: PrintedKey) {
  const ps = points(legendMark(key).d);
  return {
    left: Math.min(...ps.map((p) => p[0])),
    right: Math.max(...ps.map((p) => p[0])),
    top: Math.min(...ps.map((p) => p[1])),
    bottom: Math.max(...ps.map((p) => p[1])),
  };
}

describe("LEGEND_CELLS", () => {
  it("gives every key with front print a cell, inside the atlas, none overlapping", () => {
    expect([...KEYS].sort()).toEqual(
      ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#", "c", "up", "down"].sort(),
    );
    const cells = Object.values(LEGEND_CELLS);
    for (const c of cells) {
      expect(c.u).toBeGreaterThanOrEqual(0);
      expect(c.v).toBeGreaterThanOrEqual(0);
      expect(c.u + c.w).toBeLessThanOrEqual(1);
      expect(c.v + c.h).toBeLessThanOrEqual(1);
    }
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++) {
        const [a, b] = [cells[i]!, cells[j]!];
        expect(a.u + a.w <= b.u || b.u + b.w <= a.u || a.v + a.h <= b.v || b.v + b.h <= a.v).toBe(
          true,
        );
      }
  });
});

describe("the traced print", () => {
  /** Each key's height over its width (the model's key bounds): its decal shows that share of
   *  its cell's height. */
  const ASPECT: Record<PrintedKey, number> = {
    "1": 0.62,
    "2": 0.54,
    "3": 0.62,
    "4": 0.58,
    "5": 0.55,
    "6": 0.58,
    "7": 0.58,
    "8": 0.54,
    "9": 0.58,
    "*": 0.57,
    "0": 0.55,
    "#": 0.57,
    c: 0.96,
    up: 0.89,
    down: 0.91,
  };

  it("prints on every key, inside the part of its cell its decal shows", () => {
    for (const key of KEYS) {
      expect(legendMark(key).d, key).toMatch(/^M/);
      const b = bounds(key);
      const band = 100 * ASPECT[key];
      expect(b.left, key).toBeGreaterThanOrEqual(-100);
      expect(b.right, key).toBeLessThanOrEqual(100);
      expect(b.top, key).toBeGreaterThanOrEqual(-band);
      expect(b.bottom, key).toBeLessThanOrEqual(band);
    }
  });

  it("sits where the phone prints it: the digit (the print's top) left on the left column", () => {
    const topX = (key: PrintedKey) => {
      const ps = points(legendMark(key).d);
      return ps.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
    };
    for (const key of ["1", "4", "7", "*"] as const) expect(topX(key), key).toBeLessThan(0);
    for (const key of ["3", "6", "9", "#"] as const) expect(topX(key), key).toBeGreaterThan(0);
  });

  it("puts the rocker's up arrow above and right of its down arrow, each on its own key", () => {
    // Each arrow sits off-centre on its half towards the rocker's outer corner.
    const up = bounds("up");
    const down = bounds("down");
    expect((up.left + up.right) / 2).toBeGreaterThan(0);
    expect((down.left + down.right) / 2).toBeLessThan(0);
  });
});

describe("paintLegendAtlas", () => {
  it("fills every key's print, white and even-odd, centred in its cell", () => {
    const drawn: { d: string; rule: string; at: number[] }[] = [];
    let at: number[] = [];
    const ctx: Ctx2D<string> = {
      fillStyle: "",
      clearRect: () => {},
      setTransform: (...m) => {
        at = m;
      },
      fill: (d, rule) => {
        drawn.push({ d, rule, at });
      },
    };
    paintLegendAtlas(ctx, (d) => d);
    expect(ctx.fillStyle).toBe("#ffffff");
    expect(drawn).toHaveLength(KEYS.length);
    for (const [i, key] of KEYS.entries()) {
      const c = LEGEND_CELLS[key];
      expect(drawn[i]!.d).toBe(legendMark(key).d);
      expect(drawn[i]!.rule).toBe("evenodd");
      expect(drawn[i]!.at[4]).toBeCloseTo((c.u + c.w / 2) * ATLAS.size);
      expect(drawn[i]!.at[5]).toBeCloseTo((1 - c.v - c.h / 2) * ATLAS.size);
    }
  });
});
