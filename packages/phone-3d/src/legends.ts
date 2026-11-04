/**
 * The keypad's legends, redrawn from photographs of a real 3310 as SVG paths: the bold humanist
 * digits, the multi-tap letters, and the symbols (the voicemail tape, the space bracket, the
 * six-armed star, the shift house, the slanted hash, the C key's crescent and the rocker's two
 * hooks), each set where the original prints it on its key. They are painted once onto one
 * square texture; each key's decal maps into its cell (LEGEND_CELLS).
 *
 * Every mark is a centre line stroked at a weight (or, for the crescent, a filled outline), so
 * the painter needs only a 2D context and a way to make a path from SVG path data: it unit-tests
 * in node with a recording stub. The art is white on transparent; the decal's material tints it
 * (dark print by day, a green glow under the keypad LEDs).
 */
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

/** One mark of a glyph: SVG path data in the glyph's units (y down, baseline at 0), stroked
 *  along its centre at `weight` with butt ends and round joins, or filled. */
export interface Mark {
  d: string;
  weight: number;
  fill?: true;
}

interface Glyph {
  advance: number;
  marks: Mark[];
}

const stroke = (weight: number, ...paths: string[]): Mark[] => paths.map((d) => ({ d, weight }));

/** The keypad's face is wide: its glyphs are drawn narrow here and set `k` times as wide (the
 *  path's x coordinates scaled, so the strokes keep their weight). The paths use only absolute
 *  M, L, C and Z, so their numbers run in x, y pairs. */
function wide(k: number, glyph: Glyph): Glyph {
  let i = 0;
  const widen = (d: string) =>
    d.replace(/-?\d*\.?\d+/g, (n) =>
      String(i++ % 2 === 0 ? Math.round(Number(n) * k * 100) / 100 : n),
    );
  return {
    advance: glyph.advance * k,
    marks: glyph.marks.map((m) => {
      i = 0;
      return { ...m, d: widen(m.d) };
    }),
  };
}

const widened = (k: number, glyphs: Record<string, Glyph>, except: Record<string, number> = {}) =>
  Object.fromEntries(Object.entries(glyphs).map(([name, g]) => [name, wide(except[name] ?? k, g)]));

/** The digits: cap height 100, a bold, open humanist cut with a flagged 1 and a closed 4. */
const DIGIT = 22;
const DIGITS: Record<string, Glyph> = {
  "0": {
    advance: 60,
    marks: stroke(
      DIGIT,
      "M30 -92.5C42.4 -92.5 52.5 -73.5 52.5 -50C52.5 -26.5 42.4 -7.5 30 -7.5C17.6 -7.5 7.5 -26.5 7.5 -50C7.5 -73.5 17.6 -92.5 30 -92.5Z",
    ),
  },
  "1": { advance: 46, marks: stroke(DIGIT, "M9 -75L31 -94L31 0") },
  "2": {
    advance: 62,
    marks: stroke(
      DIGIT,
      "M9 -76C12 -87 20 -92.5 31 -92.5C43 -92.5 52 -85 52 -72C52 -56 41 -45 10 -7.5L56 -7.5",
    ),
  },
  "3": {
    advance: 61,
    marks: stroke(
      DIGIT,
      "M9 -85C14 -90 21 -92.5 30 -92.5C42 -92.5 50 -86 50 -74C50 -61 40 -54 25 -54C43 -54 53 -45 53 -31C53 -16 42 -7.5 29 -7.5C19 -7.5 12 -10 7 -15",
    ),
  },
  "4": { advance: 62, marks: stroke(DIGIT, "M41 0L41 -93L7 -31L59 -31") },
  "5": {
    advance: 61,
    marks: stroke(
      DIGIT,
      "M51 -92.5L18 -92.5L14 -52C19 -56 25 -58 32 -58C46 -58 54 -48 54 -33C54 -17 43 -7.5 29 -7.5C19 -7.5 12 -10 7 -15",
    ),
  },
  "6": {
    advance: 62,
    marks: stroke(
      DIGIT,
      "M48 -89C44 -91.5 39 -92.5 34 -92.5C17 -92.5 7.5 -74 7.5 -46C7.5 -22 16 -7.5 31 -7.5C45 -7.5 54 -18 54 -33C54 -48 45 -58 32 -58C20 -58 11 -50 8.5 -40",
    ),
  },
  "7": { advance: 59, marks: stroke(DIGIT, "M6 -92.5L54 -92.5L23 0") },
  "8": {
    advance: 62,
    marks: stroke(
      DIGIT,
      "M31 -53C19 -53 11 -60 11 -72.5C11 -85 19.5 -92.5 31 -92.5C42.5 -92.5 51 -85 51 -72.5C51 -60 43 -53 31 -53C17 -53 7.5 -44 7.5 -30.5C7.5 -16 17 -7.5 31 -7.5C45 -7.5 54.5 -16 54.5 -30.5C54.5 -44 45 -53 31 -53Z",
    ),
  },
  // The 6 turned over.
  "9": {
    advance: 62,
    marks: stroke(
      DIGIT,
      "M14 -11C18 -8.5 23 -7.5 28 -7.5C45 -7.5 54.5 -26 54.5 -54C54.5 -78 46 -92.5 31 -92.5C17 -92.5 8 -82 8 -67C8 -52 17 -42 30 -42C42 -42 51 -50 53.5 -60",
    ),
  },
};

/** The letters: x-height 60, ascenders to 88, descenders to 25, a medium humanist cut (a
 *  double-storey a, a single-storey g). */
const LETTER = 16;
const STEM = (x: number, top = -60, bottom = 0) => `M${x} ${top}L${x} ${bottom}`;
const BOWL_RIGHT = (x: number) =>
  `M${x} -45C${x + 4} -52 ${x + 10} -55 ${x + 18} -55C${x + 30} -55 ${x + 37} -44 ${x + 37} -30C${x + 37} -15 ${x + 30} -5 ${x + 18} -5C${x + 10} -5 ${x + 4} -8 ${x} -15`;
const BOWL_LEFT = (x: number) =>
  `M${x} -45C${x - 4} -52 ${x - 10} -55 ${x - 18} -55C${x - 30} -55 ${x - 37} -44 ${x - 37} -30C${x - 37} -15 ${x - 30} -5 ${x - 18} -5C${x - 10} -5 ${x - 4} -8 ${x} -15`;
const ARCH = (x: number, to: number) =>
  `M${x} -43C${x + 4} -51 ${x + 10} -55 ${x + 18} -55C${to - 5} -55 ${to} -49 ${to} -38L${to} 0`;
const LETTERS: Record<string, Glyph> = {
  a: {
    advance: 46,
    marks: stroke(
      LETTER,
      "M8 -50C12 -54 17 -55 24 -55C34 -55 39 -50 39 -40L39 0",
      "M39 -31C29 -31 8 -31 8 -16C8 -9 13 -5 20 -5C30 -5 37 -11 39 -18",
    ),
  },
  b: { advance: 50, marks: stroke(LETTER, STEM(7, -88), BOWL_RIGHT(7)) },
  c: {
    advance: 45,
    marks: stroke(
      LETTER,
      "M41 -49C37 -53 32 -55 26 -55C14 -55 6 -45 6 -30C6 -15 14 -5 26 -5C32 -5 37 -7 41 -11",
    ),
  },
  d: { advance: 50, marks: stroke(LETTER, STEM(42, -88), BOWL_LEFT(42)) },
  e: {
    advance: 48,
    marks: stroke(
      LETTER,
      "M6 -31L43 -31C43 -46 36 -55 25 -55C13 -55 5 -45 5 -30C5 -15 13 -5 26 -5C32 -5 37 -7 41 -11",
    ),
  },
  f: {
    advance: 30,
    marks: stroke(
      LETTER,
      "M32 -84C29 -86 27 -88 23 -88C16 -88 13 -83 13 -74L13 0",
      "M2 -55L30 -55",
    ),
  },
  g: {
    advance: 49,
    marks: stroke(
      LETTER,
      "M42 -60L42 5C42 19 34 25 22 25C15 25 10 23 6 20",
      "M42 -44C38 -51 32 -55 24 -55C12 -55 5 -45 5 -31C5 -17 12 -8 24 -8C32 -8 38 -11 42 -18",
    ),
  },
  h: { advance: 48, marks: stroke(LETTER, STEM(7, -88), ARCH(7, 41)) },
  i: { advance: 14, marks: stroke(LETTER, STEM(7), STEM(7, -84, -72)) },
  j: { advance: 17, marks: stroke(LETTER, "M10 -60L10 11C10 20 6 25 -2 25", STEM(10, -84, -72)) },
  k: { advance: 42, marks: stroke(LETTER, STEM(7, -88), "M39 -60L8 -24", "M18 -34L41 0") },
  l: { advance: 14, marks: stroke(LETTER, STEM(7, -88)) },
  m: {
    advance: 67,
    marks: stroke(
      LETTER,
      STEM(7),
      "M7 -44C10 -51 14 -55 21 -55C29 -55 34 -50 34 -41L34 0",
      "M34 -42C37 -51 41 -55 48 -55C56 -55 60 -50 60 -41L60 0",
    ),
  },
  n: { advance: 48, marks: stroke(LETTER, STEM(7), ARCH(7, 41)) },
  o: {
    advance: 50,
    marks: stroke(
      LETTER,
      "M25 -55C37 -55 45 -45 45 -30C45 -15 37 -5 25 -5C13 -5 5 -15 5 -30C5 -45 13 -55 25 -55Z",
    ),
  },
  p: { advance: 50, marks: stroke(LETTER, STEM(7, -60, 25), BOWL_RIGHT(7)) },
  q: { advance: 50, marks: stroke(LETTER, STEM(42, -60, 25), BOWL_LEFT(42)) },
  r: {
    advance: 31,
    marks: stroke(LETTER, STEM(7), "M7 -40C10 -50 16 -55 24 -55C26 -55 28 -55 31 -54"),
  },
  s: {
    advance: 43,
    marks: stroke(
      LETTER,
      "M36 -50C33 -53 28 -55 22 -55C13 -55 7 -50 7 -43C7 -35 14 -33 22 -31C31 -29 38 -26 38 -17C38 -9 31 -5 22 -5C15 -5 9 -7 5 -11",
    ),
  },
  t: {
    advance: 32,
    marks: stroke(
      LETTER,
      "M13 -74L13 -18C13 -9 17 -5 24 -5C27 -5 29 -5.5 31 -6.5",
      "M2 -55L30 -55",
    ),
  },
  u: {
    advance: 48,
    marks: stroke(LETTER, "M7 -60L7 -22C7 -11 12 -5 22 -5C30 -5 37 -9 41 -17", STEM(41)),
  },
  v: { advance: 43, marks: stroke(LETTER, "M2 -60L21.5 0L41 -60") },
  w: { advance: 64, marks: stroke(LETTER, "M2 -60L16.5 0L32 -54L47.5 0L62 -60") },
  x: { advance: 43, marks: stroke(LETTER, "M4 -60L39 0", "M39 -60L4 0") },
  y: { advance: 43, marks: stroke(LETTER, "M2 -60L22 -2", "M41 -60L19 10C16 19 12 25 4 25") },
  z: { advance: 44, marks: stroke(LETTER, "M5 -55L38 -55L6 -5L40 -5") },
};

const circle = (cx: number, cy: number, r: number) => {
  const k = r * 0.5523;
  return `M${cx} ${cy - r}C${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy}C${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r}C${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy}C${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r}Z`;
};

/** The symbols, drawn at the size they print (decal units). */
const SYMBOLS: Record<string, Glyph> = {
  /** The star key's six-armed star: a bar crossed by a steep X, bold. */
  star: { advance: 58, marks: stroke(9, "M0 -27L58 -27", "M15 -54L43 0", "M43 -54L15 0") },
  plus: { advance: 30, marks: stroke(5.5, "M0 -15L30 -15", "M15 -30L15 0") },
  /** The hash, bold and steeply slanted. */
  hash: {
    advance: 54,
    marks: stroke(9.5, "M28 -44L13 0", "M46 -44L31 0", "M7 -31L53 -31", "M2 -13L48 -13"),
  },
  /** The shift key's house: an outline, its roof's eaves past its walls. */
  house: { advance: 60, marks: stroke(4.5, "M2 -18L30 -33L58 -18", "M9 -22L9 -2L51 -2L51 -22") },
  /** The voicemail tape: two reels on a band. */
  voicemail: {
    advance: 82,
    marks: stroke(4.5, circle(18, -17, 15), circle(64, -17, 15), "M18 -2L64 -2"),
  },
  /** The space: an open bracket on the baseline. */
  space: { advance: 57, marks: stroke(4, "M2 -12L2 -2L55 -2L55 -12") },
  /** The C key's crescent: a heavy bracket, thickest at its middle, its ends rounded off. */
  crescent: {
    advance: 22,
    marks: [
      {
        d: "M16 -48C6 -44 0 -35 0 -24C0 -13 6 -4 16 0C19 1 21 -2 20 -5C14 -8 11 -15 11 -24C11 -33 14 -40 20 -43C21 -46 19 -49 16 -48Z",
        weight: 0,
        fill: true,
      },
    ],
  },
  /** The rocker's arrowheads: up's apex on top, a short arm out left and a long one down; down
   *  is up turned over. Both taper to points from a heavy apex. */
  hookUp: {
    advance: 28,
    marks: [
      { d: "M0 -22L19 -31C22 -32.5 25 -31 25.5 -28L27 -3L18.5 -23.5Z", weight: 0, fill: true },
    ],
  },
  hookDown: {
    advance: 28,
    marks: [{ d: "M27 -13L8 -4C5 -2.5 2 -4 1.5 -7L0 -32L8.5 -11.5Z", weight: 0, fill: true }],
  },
};

const GLYPHS: Record<string, Glyph> = {
  ...widened(1.7, DIGITS, { "0": 1.45, "1": 1.15 }),
  ...widened(1.55, LETTERS, { i: 1, j: 1, l: 1, m: 1.35, w: 1.25 }),
  ...SYMBOLS,
};

/** A glyph set on a key: its origin (left end of its baseline) and its size (units per glyph
 *  unit), in the key's decal space: x −100 (left) to 100 (right), y down from its centre. */
export interface Placed {
  glyph: string;
  x: number;
  y: number;
  size: number;
}

/** Digits stand 42 units tall on a key, the letters' x-height 21. */
const DIGIT_SIZE = 0.42;
const LETTER_SIZE = 0.35;
const TRACKING = 9;

const glyph = (
  name: string,
  x: number,
  y: number,
  size = name in SYMBOLS ? 1 : DIGIT_SIZE,
): Placed => ({
  glyph: name,
  x,
  y,
  size,
});

/** A run of letters from `x` along the baseline `y`. */
function word(text: string, x: number, y: number, size = LETTER_SIZE): Placed[] {
  const placed: Placed[] = [];
  for (const ch of text) {
    placed.push(glyph(ch, x, y, size));
    x += (GLYPHS[ch]!.advance + TRACKING) * size;
  }
  return placed;
}

/** Each key's print, placed as on the photographed phone: the left column's digits sit high
 *  left with their letters below right, the right column mirrors that, and the middle column
 *  runs digit then letters along one line. */
export const LEGENDS: Record<PrintedKey, Placed[]> = {
  "1": [glyph("1", -95, -4), glyph("voicemail", -18, 27)],
  "2": [glyph("2", -66, 13), ...word("abc", -5, 13)],
  "3": [...word("def", -72, 26), glyph("3", 30, -4)],
  "4": [glyph("4", -84, -1), ...word("ghi", -15, 29)],
  "5": [glyph("5", -59, 16), ...word("jkl", 13, 16)],
  "6": [...word("mno", -78, 20), glyph("6", 28, -9)],
  "7": [glyph("7", -80, -6), ...word("pqrs", -37, 23)],
  "8": [glyph("8", -63, 20), ...word("tuv", -5, 20)],
  "9": [...word("wxyz", -82, 23), glyph("9", 32, -8)],
  "0": [glyph("0", -63, 12), glyph("space", 11, 12)],
  "*": [glyph("star", -80, 14), glyph("plus", 11, 38)],
  "#": [glyph("house", -61, 44), glyph("hash", 28, 6)],
  c: [glyph("crescent", -12, 36, 1.5)],
  up: [glyph("hookUp", -20, 46, 1.9)],
  down: [glyph("hookDown", -30, 50, 1.9)],
};

/** A mark ready to paint: its path, weight and fill, and the transform onto the atlas (canvas
 *  `setTransform` order: a, b, c, d, e, f). */
export interface AtlasMark extends Mark {
  transform: [number, number, number, number, number, number];
}

/** Atlas pixels per decal unit: the decal's 200 units span its cell. */
const PX = ATLAS.cell / 200;

export function legendMarks(key: PrintedKey): AtlasMark[] {
  const c = LEGEND_CELLS[key];
  const cx = (c.u + c.w / 2) * ATLAS.size;
  const cy = (1 - c.v - c.h / 2) * ATLAS.size;
  return LEGENDS[key].flatMap((p) => {
    const g = GLYPHS[p.glyph];
    if (g === undefined) throw new Error(`no glyph ${p.glyph}`);
    const s = p.size * PX;
    return g.marks.map((m) => ({
      ...m,
      transform: [s, 0, 0, s, cx + p.x * PX, cy + p.y * PX] as AtlasMark["transform"],
    }));
  });
}

/** The glyph names: every legend draws from these. */
export const GLYPH_NAMES: readonly string[] = Object.keys(GLYPHS);

/** The subset of CanvasRenderingContext2D the painter needs, over any path type. */
export interface Ctx2D<P> {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  clearRect(x: number, y: number, w: number, h: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  stroke(path: P): void;
  fill(path: P): void;
}

/** Paints every legend, white, onto the atlas through `ctx`, making paths with `path`. */
export function paintLegendAtlas<P>(ctx: Ctx2D<P>, path: (d: string) => P): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ATLAS.size, ATLAS.size);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  for (const key of Object.keys(LEGEND_CELLS) as PrintedKey[]) {
    for (const mark of legendMarks(key)) {
      ctx.setTransform(...mark.transform);
      if (mark.fill) ctx.fill(path(mark.d));
      else {
        ctx.lineWidth = mark.weight;
        ctx.stroke(path(mark.d));
      }
    }
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
