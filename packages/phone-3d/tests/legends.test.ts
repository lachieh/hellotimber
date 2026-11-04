import { describe, expect, it } from "vite-plus/test";
import {
  ATLAS,
  GLYPH_NAMES,
  LEGEND_CELLS,
  LEGENDS,
  legendMarks,
  paintLegendAtlas,
} from "../src/legends";
import type { Ctx2D, PrintedKey } from "../src/legends";

const KEYS = Object.keys(LEGEND_CELLS) as PrintedKey[];

/** A mark's extent on the atlas, from its path's points (a curve stays inside its control
 *  points) and half its weight. */
function extent(mark: ReturnType<typeof legendMarks>[number]) {
  const [s, , , , e, f] = mark.transform;
  const nums = (mark.d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const pad = (mark.weight / 2) * s;
  const xs = nums.filter((_, i) => i % 2 === 0).map((x) => e + x * s);
  const ys = nums.filter((_, i) => i % 2 === 1).map((y) => f + y * s);
  return {
    left: Math.min(...xs) - pad,
    right: Math.max(...xs) + pad,
    top: Math.min(...ys) - pad,
    bottom: Math.max(...ys) + pad,
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

describe("LEGENDS", () => {
  const glyphs = (key: PrintedKey) => LEGENDS[key].map((p) => p.glyph).join(",");

  it("prints each digit key's digit and its multi-tap letters, as on the phone", () => {
    expect(glyphs("1")).toBe("1,voicemail");
    expect(glyphs("2")).toBe("2,a,b,c");
    expect(glyphs("3")).toBe("d,e,f,3");
    expect(glyphs("4")).toBe("4,g,h,i");
    expect(glyphs("5")).toBe("5,j,k,l");
    expect(glyphs("6")).toBe("m,n,o,6");
    expect(glyphs("7")).toBe("7,p,q,r,s");
    expect(glyphs("8")).toBe("8,t,u,v");
    expect(glyphs("9")).toBe("w,x,y,z,9");
    expect(glyphs("0")).toBe("0,space");
    expect(glyphs("*")).toBe("star,plus");
    expect(glyphs("#")).toBe("house,hash");
    expect(glyphs("c")).toBe("crescent");
  });

  it("draws every glyph it places", () => {
    for (const key of KEYS) for (const p of LEGENDS[key]) expect(GLYPH_NAMES).toContain(p.glyph);
  });

  it("keeps the left column's digit left and the right column's right", () => {
    const digitX = (key: PrintedKey) => LEGENDS[key].find((p) => p.glyph === key)!.x;
    for (const key of ["1", "4", "7"] as const) expect(digitX(key)).toBeLessThan(-50);
    for (const key of ["3", "6", "9"] as const) expect(digitX(key)).toBeGreaterThan(20);
  });
});

describe("legendMarks", () => {
  it("keeps every key's print inside its cell's middle band (the decals are wide ovals)", () => {
    for (const key of KEYS) {
      const c = LEGEND_CELLS[key];
      const left = c.u * ATLAS.size;
      const top = (1 - c.v - c.h) * ATLAS.size;
      // The digit keys' decals show the middle 54 % of their cell's height.
      const band = ["c", "up", "down"].includes(key) ? 1 : 0.54;
      const margin = (ATLAS.cell * (1 - band)) / 2;
      for (const mark of legendMarks(key)) {
        const e = extent(mark);
        expect(e.left, key).toBeGreaterThanOrEqual(left);
        expect(e.right, key).toBeLessThanOrEqual(left + ATLAS.cell);
        expect(e.top, key).toBeGreaterThanOrEqual(top + margin);
        expect(e.bottom, key).toBeLessThanOrEqual(top + ATLAS.cell - margin);
      }
    }
  });
});

describe("paintLegendAtlas", () => {
  it("strokes or fills every mark, white, with the mark's own weight", () => {
    const drawn: { kind: string; d: string; width: number }[] = [];
    const ctx: Ctx2D<string> = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      lineCap: "round",
      lineJoin: "miter",
      clearRect: () => {},
      setTransform: () => {},
      stroke(d) {
        drawn.push({ kind: "stroke", d, width: this.lineWidth });
      },
      fill(d) {
        drawn.push({ kind: "fill", d, width: 0 });
      },
    };
    paintLegendAtlas(ctx, (d) => d);
    expect(ctx.fillStyle).toBe("#ffffff");
    expect(ctx.strokeStyle).toBe("#ffffff");
    const marks = KEYS.flatMap(legendMarks);
    expect(drawn).toHaveLength(marks.length);
    for (const [i, m] of marks.entries()) {
      expect(drawn[i]!.d).toBe(m.d);
      expect(drawn[i]!.kind).toBe(m.fill ? "fill" : "stroke");
      if (!m.fill) expect(drawn[i]!.width).toBe(m.weight);
    }
  });
});
