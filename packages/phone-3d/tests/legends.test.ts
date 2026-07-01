import { describe, expect, it } from "vite-plus/test";
import { ATLAS, LEGEND_CELLS, paintLegendAtlas } from "../src/legends";
import type { Ctx2D } from "../src/legends";

/** Minimal recording stub — jsdom has no real 2D context in this repo
 *  (phone-screen precedent mocks getContext), so we assert on draw calls. */
function recordingCtx() {
  const texts: { text: string; x: number; y: number }[] = [];
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  const ctx: Ctx2D = {
    font: "",
    fillStyle: "",
    textAlign: "center",
    textBaseline: "middle",
    clearRect: () => {},
    fillText: (text: string, x: number, y: number) => {
      texts.push({ text, x, y });
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      rects.push({ x, y, w, h });
    },
    beginPath: () => {},
    ellipse: () => {},
    fill: () => {},
  };
  return { ctx, texts, rects };
}

const inCell = (name: string, x: number, y: number): boolean => {
  const c = LEGEND_CELLS[name];
  if (c === undefined) return false;
  const px = { x: c.u * ATLAS.size, y: (1 - c.v - c.h) * ATLAS.size };
  const w = c.w * ATLAS.size;
  const h = c.h * ATLAS.size;
  return x >= px.x && x <= px.x + w && y >= px.y && y <= px.y + h;
};

describe("LEGEND_CELLS", () => {
  const expected = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "*",
    "#",
    "c",
    "up",
    "down",
    "navi",
    "nokia",
    "earpiece",
  ];

  it("covers digits, symbols, cluster keys, wordmark, earpiece — nothing else", () => {
    expect(Object.keys(LEGEND_CELLS).sort()).toEqual([...expected].sort());
  });

  it("every cell is inside [0,1]² UV space", () => {
    for (const [name, c] of Object.entries(LEGEND_CELLS)) {
      expect(c.u, name).toBeGreaterThanOrEqual(0);
      expect(c.v, name).toBeGreaterThanOrEqual(0);
      expect(c.u + c.w, name).toBeLessThanOrEqual(1);
      expect(c.v + c.h, name).toBeLessThanOrEqual(1);
      expect(c.w, name).toBeGreaterThan(0);
      expect(c.h, name).toBeGreaterThan(0);
    }
  });

  it("cells never overlap", () => {
    const entries = Object.entries(LEGEND_CELLS);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [na, a] = entries[i]!;
        const [nb, b] = entries[j]!;
        const disjoint =
          a.u + a.w <= b.u || b.u + b.w <= a.u || a.v + a.h <= b.v || b.v + b.h <= a.v;
        expect(disjoint, `${na} overlaps ${nb}`).toBe(true);
      }
    }
  });
});

describe("paintLegendAtlas", () => {
  const { ctx, texts, rects } = recordingCtx();
  paintLegendAtlas(ctx);
  const drawn = (t: string) => texts.filter((e) => e.text === t);

  it("draws every digit inside its own cell", () => {
    for (const d of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
      const hits = drawn(d);
      expect(hits.length, d).toBeGreaterThanOrEqual(1);
      expect(
        hits.some((h) => inCell(d, h.x, h.y)),
        `digit ${d} lands in its cell`,
      ).toBe(true);
    }
  });

  it("draws the multi-tap letter triplets for 2–9 in the digit cells", () => {
    const letters: Record<string, string> = {
      "2": "abc",
      "3": "def",
      "4": "ghi",
      "5": "jkl",
      "6": "mno",
      "7": "pqrs",
      "8": "tuv",
      "9": "wxyz",
    };
    for (const [d, abc] of Object.entries(letters)) {
      const hits = drawn(abc);
      expect(hits.length, abc).toBe(1);
      expect(inCell(d, hits[0]!.x, hits[0]!.y), `${abc} in ${d}'s cell`).toBe(true);
    }
  });

  it("draws the symbol and cluster legends", () => {
    expect(drawn("*").length + drawn("* +").length).toBeGreaterThanOrEqual(1); // star (with plus)
    expect(drawn("#").length).toBeGreaterThanOrEqual(1);
    expect(drawn("C").length).toBe(1);
    expect(drawn("▲").length).toBe(1);
    expect(drawn("▼").length).toBe(1);
    expect(drawn("NOKIA").length).toBe(1);
  });

  it("draws the NaviKey bar and earpiece slots as fills in their cells", () => {
    const inRectCell = (name: string) =>
      rects.some((r) => inCell(name, r.x + r.w / 2, r.y + r.h / 2));
    expect(inRectCell("navi"), "navi bar").toBe(true);
    expect(inRectCell("earpiece"), "earpiece slots").toBe(true);
  });
});
