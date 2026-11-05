/**
 * The keypad's print, traced off a front-on photo of a real 3310 (legend-paths.ts): each key's
 * digits, letters and symbols as one SVG path in its decal's units, painted once onto one square
 * texture. Each key's decal maps into its cell
 * (LEGEND_CELLS). The painter needs only a 2D context and a way to make a path from SVG path
 * data, so it unit-tests in node with a recording stub. The art is white on transparent; the
 * decal's material tints it (dark print by day, a green glow under the keypad LEDs).
 */
import { LEGEND_PATHS } from "./legend-paths";
import type { Nokia3310Key } from "./types";

export const ATLAS = { size: 2048, cell: 256 } as const;

export interface AtlasCell {
  /** UV rect, OpenGL convention (v grows upward, origin bottom-left). */
  u: number;
  v: number;
  w: number;
  h: number;
}

const CELL = ATLAS.cell / ATLAS.size;

/** Grid helper: column/row (row 0 = TOP of the texture) → UV rect. */
function cell(col: number, row: number): AtlasCell {
  return { u: col * CELL, v: 1 - (row + 1) * CELL, w: CELL, h: CELL };
}

/** The keys that carry print: every key but the power key (on the top edge) and the NaviKey
 *  (its cyan bar is a part of its own, Key.tsx). */
export type PrintedKey = Exclude<Nokia3310Key, "power" | "navi">;

export const LEGEND_CELLS: Record<PrintedKey, AtlasCell> = {
  "1": cell(0, 0),
  "2": cell(1, 0),
  "3": cell(2, 0),
  "4": cell(3, 0),
  "5": cell(4, 0),
  "6": cell(5, 0),
  "7": cell(6, 0),
  "8": cell(7, 0),
  "9": cell(0, 1),
  "0": cell(1, 1),
  "*": cell(2, 1),
  "#": cell(3, 1),
  c: cell(4, 1),
  up: cell(5, 1),
  down: cell(6, 1),
};

/** A key's print ready to paint: its path (fill even-odd) and the transform onto the atlas
 *  (canvas `setTransform` order: a, b, c, d, e, f). */
export interface AtlasMark {
  d: string;
  transform: [number, number, number, number, number, number];
}

/** Atlas pixels per decal unit: the decal's 200 units span its cell. */
const PX = ATLAS.cell / 200;

export function legendMark(key: PrintedKey): AtlasMark {
  const c = LEGEND_CELLS[key];
  const cx = (c.u + c.w / 2) * ATLAS.size;
  const cy = (1 - c.v - c.h / 2) * ATLAS.size;
  return { d: LEGEND_PATHS[key], transform: [PX, 0, 0, PX, cx, cy] };
}

/** The subset of CanvasRenderingContext2D the painter needs, over any path type. */
export interface Ctx2D<P> {
  fillStyle: string | CanvasGradient | CanvasPattern;
  clearRect(x: number, y: number, w: number, h: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  fill(path: P, rule: CanvasFillRule): void;
}

/** Paints every key's print, white, onto the atlas through `ctx`, making paths with `path`. */
export function paintLegendAtlas<P>(ctx: Ctx2D<P>, path: (d: string) => P): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ATLAS.size, ATLAS.size);
  ctx.fillStyle = "#ffffff";
  for (const key of Object.keys(LEGEND_CELLS) as PrintedKey[]) {
    const mark = legendMark(key);
    ctx.setTransform(...mark.transform);
    ctx.fill(path(mark.d), "evenodd");
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Browser-side: paint the atlas onto a fresh canvas (used by the meshes). */
export function createLegendAtlas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS.size;
  canvas.height = ATLAS.size;
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("2D canvas context unavailable");
  paintLegendAtlas(ctx, (d) => new Path2D(d));
  return canvas;
}
