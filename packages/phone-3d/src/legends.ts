/**
 * The legend atlas: every printed marking on the phone — key digits, multi-tap
 * letter triplets, cluster glyphs, the NaviKey bar, the NOKIA wordmark, and the
 * earpiece slot pattern — painted once onto a single square texture. Key/decal
 * meshes map into it via LEGEND_CELLS UV rects.
 *
 * Pure logic: `paintLegendAtlas` draws through the minimal `Ctx2D` interface so
 * it unit-tests in node with a recording stub (jsdom here has no real 2D
 * context — see phone-screen's renderer test precedent). `createLegendAtlas`
 * is the browser-side convenience that binds it to a real canvas.
 *
 * Art is white-on-transparent; materials tint it (dark print by day, green
 * emissive glow when the backlight is on).
 */

export const ATLAS = { size: 1024, cell: 128 } as const;

export interface AtlasCell {
  /** UV rect, OpenGL convention (v grows upward, origin bottom-left). */
  u: number;
  v: number;
  w: number;
  h: number;
}

const CELL = ATLAS.cell / ATLAS.size; // 0.125 — one grid step in UV

/** Grid helper: column/row (row 0 = TOP of the texture) → UV rect. */
function cell(col: number, row: number, cols = 1, rows = 1): AtlasCell {
  return { u: col * CELL, v: 1 - (row + rows) * CELL, w: cols * CELL, h: rows * CELL };
}

/** Where each legend lives in the atlas. Rows 0–2: digits/symbols; row 3:
 *  cluster keys; row 4: wide decals. */
export const LEGEND_CELLS: Record<string, AtlasCell> = {
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
  navi: cell(0, 2, 4), // wide: the NaviKey bar
  nokia: cell(0, 3, 4), // wide: wordmark above the screen
  earpiece: cell(4, 3, 2), // slot pattern under the dome
};

/** Multi-tap letter triplets printed under the digits (spec §6). */
const LETTERS: Record<string, string> = {
  "2": "abc",
  "3": "def",
  "4": "ghi",
  "5": "jkl",
  "6": "mno",
  "7": "pqrs",
  "8": "tuv",
  "9": "wxyz",
};

/** The subset of CanvasRenderingContext2D the painter needs — kept minimal so
 *  tests can pass a recording stub. */
export interface Ctx2D {
  font: string;
  fillStyle: string | CanvasGradient | CanvasPattern;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  fill(): void;
}

/** Pixel-space center of a cell (canvas convention: y grows downward). */
function centerPx(c: AtlasCell): { x: number; y: number; w: number; h: number } {
  const x = c.u * ATLAS.size;
  const yTop = (1 - c.v - c.h) * ATLAS.size;
  const w = c.w * ATLAS.size;
  const h = c.h * ATLAS.size;
  return { x: x + w / 2, y: yTop + h / 2, w, h };
}

export function paintLegendAtlas(ctx: Ctx2D): void {
  ctx.clearRect(0, 0, ATLAS.size, ATLAS.size);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Digits + their letter triplets.
  for (const d of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
    const p = centerPx(LEGEND_CELLS[d]!);
    const letters = LETTERS[d];
    ctx.font = "bold 64px sans-serif";
    ctx.fillText(d, p.x, letters === undefined ? p.y : p.y - 18);
    if (letters !== undefined) {
      ctx.font = "600 28px sans-serif";
      ctx.fillText(letters, p.x, p.y + 34);
    }
  }

  // Symbols — the 3310 prints "* +" on the star key.
  {
    const star = centerPx(LEGEND_CELLS["*"]!);
    ctx.font = "bold 60px sans-serif";
    ctx.fillText("*", star.x - 18, star.y + 8);
    ctx.font = "600 34px sans-serif";
    ctx.fillText("+", star.x + 26, star.y - 12);
    const hash = centerPx(LEGEND_CELLS["#"]!);
    ctx.font = "bold 56px sans-serif";
    ctx.fillText("#", hash.x, hash.y);
  }

  // Cluster keys.
  {
    const c = centerPx(LEGEND_CELLS.c!);
    ctx.font = "bold 58px sans-serif";
    ctx.fillText("C", c.x, c.y);
    const up = centerPx(LEGEND_CELLS.up!);
    ctx.font = "48px sans-serif";
    ctx.fillText("▲", up.x, up.y);
    const down = centerPx(LEGEND_CELLS.down!);
    ctx.fillText("▼", down.x, down.y);
  }

  // NaviKey bar — the single horizontal stripe on the blue key.
  {
    const n = centerPx(LEGEND_CELLS.navi!);
    ctx.fillRect(n.x - n.w * 0.32, n.y - 7, n.w * 0.64, 14);
  }

  // NOKIA wordmark.
  {
    const n = centerPx(LEGEND_CELLS.nokia!);
    ctx.font = "bold 72px sans-serif";
    ctx.fillText("NOKIA", n.x, n.y);
  }

  // Earpiece: two columns of small slots.
  {
    const e = centerPx(LEGEND_CELLS.earpiece!);
    const slotW = 10;
    const slotH = 26;
    for (let col = -1; col <= 1; col += 2) {
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(e.x + col * 18 - slotW / 2, e.y - 60 + i * 32, slotW, slotH);
      }
    }
  }
}

/** Browser-side: paint the atlas onto a fresh canvas (used by the meshes). */
export function createLegendAtlas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS.size;
  canvas.height = ATLAS.size;
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("2D canvas context unavailable");
  paintLegendAtlas(ctx);
  return canvas;
}
