import { describe, expect, it } from "vite-plus/test";
import { BEZEL, BODY, KEY_LAYOUT, KEY_TRAVEL, LCD, LEGEND_LIFT } from "../src/layout";
import type { KeyLayoutEntry } from "../src/layout";
import { ALL_KEYS } from "../src/types";

// ── rotated-rectangle helpers (SAT) ─────────────────────────────────────────

type Vec = { x: number; y: number };

function corners(e: { x: number; y: number; w: number; h: number; rot: number }): Vec[] {
  const r = (e.rot * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const hw = e.w / 2;
  const hh = e.h / 2;
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((p) => ({ x: e.x + p.x * cos - p.y * sin, y: e.y + p.x * sin + p.y * cos }));
}

/** True when two oriented rectangles overlap (separating-axis theorem). */
function obbOverlap(a: KeyLayoutEntry, b: KeyLayoutEntry): boolean {
  const ca = corners(a);
  const cb = corners(b);
  for (const poly of [ca, cb]) {
    for (let i = 0; i < 4; i++) {
      const edge = { x: poly[(i + 1) % 4]!.x - poly[i]!.x, y: poly[(i + 1) % 4]!.y - poly[i]!.y };
      const axis = { x: -edge.y, y: edge.x };
      const proj = (pts: Vec[]) => {
        const dots = pts.map((p) => p.x * axis.x + p.y * axis.y);
        return { min: Math.min(...dots), max: Math.max(...dots) };
      };
      const pa = proj(ca);
      const pb = proj(cb);
      if (pa.max <= pb.min || pb.max <= pa.min) return false; // gap found
    }
  }
  return true;
}

const byKey = new Map(KEY_LAYOUT.map((e) => [e.key, e]));
const get = (k: string): KeyLayoutEntry => {
  const e = byKey.get(k as KeyLayoutEntry["key"]);
  if (e === undefined) throw new Error(`missing key ${k}`);
  return e;
};

// ── master dimensions ───────────────────────────────────────────────────────

describe("body & screen constants", () => {
  it("matches the spec §1 dimensions (1 unit = 1 cm)", () => {
    expect(BODY).toEqual({ w: 4.8, h: 11.3, d: 2.2 });
  });

  it("LCD is exactly 84:48 (7:4) and sits inside the bezel with even side margins", () => {
    expect(LCD.w / LCD.h).toBeCloseTo(7 / 4, 5);
    expect(LCD.w).toBeLessThan(BEZEL.w);
    expect(LCD.h).toBeLessThan(BEZEL.h);
    expect(LCD.x).toBeCloseTo(BEZEL.x, 5); // horizontally centered in the bezel
  });

  it("bezel fits inside the face with margins", () => {
    expect(BEZEL.w / 2 + Math.abs(BEZEL.x)).toBeLessThan(BODY.w / 2);
    expect(BEZEL.y + BEZEL.h / 2).toBeLessThan(BODY.h / 2);
  });

  it("travel and legend lift are small positive offsets", () => {
    expect(KEY_TRAVEL).toBeGreaterThan(0);
    expect(KEY_TRAVEL).toBeLessThan(0.2);
    expect(LEGEND_LIFT).toBeGreaterThan(0);
    expect(LEGEND_LIFT).toBeLessThan(KEY_TRAVEL);
  });
});

// ── keypad layout ───────────────────────────────────────────────────────────

describe("KEY_LAYOUT", () => {
  it("has every physical key exactly once", () => {
    expect(KEY_LAYOUT.map((e) => e.key).sort()).toEqual([...ALL_KEYS].sort());
    expect(new Set(KEY_LAYOUT.map((e) => e.key)).size).toBe(17);
  });

  it("no two keys overlap (rotation-aware)", () => {
    for (let i = 0; i < KEY_LAYOUT.length; i++) {
      for (let j = i + 1; j < KEY_LAYOUT.length; j++) {
        const a = KEY_LAYOUT[i]!;
        const b = KEY_LAYOUT[j]!;
        expect(obbOverlap(a, b), `${a.key} overlaps ${b.key}`).toBe(false);
      }
    }
  });

  it("every key is inside the face silhouette bounds", () => {
    for (const e of KEY_LAYOUT) {
      for (const c of corners(e)) {
        expect(Math.abs(c.x), `${e.key} x`).toBeLessThan(BODY.w / 2);
        expect(Math.abs(c.y), `${e.key} y`).toBeLessThan(BODY.h / 2);
      }
    }
  });

  it("keys never intrude into the screen bezel", () => {
    const bezelBottom = BEZEL.y - BEZEL.h / 2;
    for (const e of KEY_LAYOUT) {
      if (e.key === "power") continue; // power lives on the top edge, above the bezel
      for (const c of corners(e)) {
        expect(c.y, `${e.key} reaches into the bezel`).toBeLessThan(bezelBottom);
      }
    }
    // power sits fully ABOVE the bezel
    for (const c of corners(get("power"))) {
      expect(c.y).toBeGreaterThan(BEZEL.y + BEZEL.h / 2);
    }
  });

  it("the digit grid mirrors left/right and fans symmetrically", () => {
    const rows: [string, string, string][] = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["*", "0", "#"],
    ];
    for (const [l, m, r] of rows) {
      expect(get(m).x).toBeCloseTo(0, 5); // middle column centered
      expect(get(m).rot).toBeCloseTo(0, 5); // middle column level
      expect(get(l).x + get(r).x).toBeCloseTo(0, 1); // mirrored positions (±0.05)
      expect(get(l).rot + get(r).rot).toBeCloseTo(0, 5); // mirrored fan rotation
      expect(get(l).rot).toBeLessThan(0); // left keys tilt down-left
      expect(get(l).y).toBeCloseTo(get(r).y, 1); // same row height
      expect(get(l).y).toBeGreaterThan(get(m).y); // fan: outer keys ride higher
    }
    // rows strictly descend
    const rowY = rows.map(([, m]) => get(m).y);
    for (let i = 1; i < rowY.length; i++) expect(rowY[i]!).toBeLessThan(rowY[i - 1]!);
  });

  it("top cluster: navi centered above the digit rows, c/up/down around it", () => {
    const navi = get("navi");
    expect(navi.x).toBeCloseTo(0, 5);
    expect(navi.shape).toBe("crescent");
    expect(navi.w).toBeGreaterThan(get("5").w); // the big blue key
    for (const k of ["c", "up", "down"]) {
      expect(get(k).y).toBeGreaterThan(get("1").y); // cluster above row 1
    }
    expect(get("c").x).toBeLessThan(0); // C on the left…
    expect(get("up").x).toBeGreaterThan(0); // …rocker on the right
    expect(get("down").x).toBeGreaterThan(0);
    expect(get("c").shape).toBe("wing-l");
    expect(get("up").shape).toBe("wing-r");
    expect(get("down").shape).toBe("wing-r");
  });

  it("power is the top-edge dot", () => {
    const power = get("power");
    expect(power.shape).toBe("dot");
    expect(power.x).toBeCloseTo(0, 5);
    expect(power.y).toBeGreaterThan(4);
  });

  it("digit keys are pills", () => {
    for (const k of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]) {
      expect(get(k).shape).toBe("pill");
    }
  });
});
