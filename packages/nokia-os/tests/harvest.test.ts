import { describe, expect, it } from "vite-plus/test";
import { LCD_HEIGHT, LCD_WIDTH } from "../scripts/golden-format.ts";
import { harvestGlyphs, type GlyphOverride, type RunSample } from "../scripts/harvest-glyphs.ts";

/** An 84×48 frame with `art` (rows of '#'/'.') stamped at (x, y); `fill` paints a solid band first. */
function frame(
  art: readonly string[],
  x: number,
  y: number,
  fill?: { x0: number; x1: number; y0: number; y1: number },
): Uint8Array {
  const pixels = new Uint8Array(LCD_WIDTH * LCD_HEIGHT);
  if (fill) {
    for (let yy = fill.y0; yy <= fill.y1; yy++) {
      for (let xx = fill.x0; xx <= fill.x1; xx++) pixels[yy * LCD_WIDTH + xx] = 1;
    }
  }
  art.forEach((row, dy) => {
    Array.from(row).forEach((ch, dx) => {
      if (ch === "#") pixels[(y + dy) * LCD_WIDTH + x + dx] = fill ? 0 : 1;
    });
  });
  return pixels;
}

// A 3-row toy font: 'A' is 3 wide, 'B' 2 wide ("##/##/#."), '1' is 2 wide with one column of
// bearing in a 4-column cell. One blank column follows each glyph's ink.
const A = ["###", "#.#", "#.#"];

function sample(text: string, art: readonly string[], options: Partial<RunSample["run"]> = {}) {
  return {
    source: `toy ${text}`,
    run: { font: "small" as const, text, top: 10, ...options },
    pixels: frame(art, 5, 10),
  };
}

const METRICS = { small: 3, large: 3, digits: 3, thin: 3 };

describe("harvestGlyphs", () => {
  it("splits a run on blank columns and measures advances between left edges", () => {
    // "AB": A at x 5..7, gap, B at 9..10.
    const result = harvestGlyphs([sample("AB", ["###.##", "#.#.##", "#.#.#."])], [], METRICS);
    expect(result.issues).toEqual([
      { kind: "unknown-advance", font: "small", char: "B", sources: ["toy AB"] },
    ]);
    expect(result.fonts.small.glyphs.A).toEqual(["###.", "#.#.", "#.#."]);
  });

  it("takes the space width from word gaps once the left glyph's advance is known", () => {
    const result = harvestGlyphs(
      [
        sample("AB", ["###.##", "#.#.##", "#.#.#."]),
        sample("BA", ["##.###", "##.#.#", "#..#.#"]),
        // "A A": A at 5, A at 11 → advance 4 + space 2.
        sample("A A", ["###...###", "#.#...#.#", "#.#...#.#"]),
      ],
      [],
      METRICS,
    );
    expect(result.issues).toEqual([]);
    expect(result.fonts.small.glyphs).toEqual({
      " ": ["..", "..", ".."],
      A: ["###.", "#.#.", "#.#."],
      B: ["##.", "##.", "#.."],
    });
  });

  it("inverts the band for selected rows and honours the run's column bounds", () => {
    // Ink-on-band: the band is solid from x 0..20 and the glyph pixels are clear.
    const pixels = frame(["###.##", "#.#.##", "#.#.#."], 5, 10, { x0: 0, x1: 20, y0: 10, y1: 12 });
    pixels[11 * LCD_WIDTH + 40] = 1; // ink outside `right` is ignored
    const result = harvestGlyphs(
      [
        {
          source: "inverted",
          run: { font: "small", text: "AB", top: 10, inverted: true, right: 20 },
          pixels,
        },
      ],
      [{ kind: "advance", font: "small", char: "B", advance: 3 }],
      METRICS,
    );
    expect(result.issues).toEqual([]);
    expect(result.fonts.small.glyphs.B).toEqual(["##.", "##.", "#.."]);
  });

  it("reports a segment count that differs from the character count", () => {
    const result = harvestGlyphs([sample("ABA", ["###.##", "#.#.##", "#.#.#."])], [], METRICS);
    expect(result.issues).toEqual([
      {
        kind: "segment-count",
        source: "toy ABA",
        font: "small",
        text: "ABA",
        expected: 3,
        found: 2,
      },
    ]);
  });

  it("splits touching glyphs where a touch override gives the first glyph's ink width", () => {
    // "BA" with no blank column between B (ink x 5..6) and A (ink x 7..9).
    const touching = sample("BA", ["#####", "###.#", "#.#.#"]);
    const unsplit = harvestGlyphs([touching], [], METRICS);
    expect(unsplit.issues).toEqual([
      { kind: "segment-count", source: "toy BA", font: "small", text: "BA", expected: 2, found: 1 },
    ]);
    const split = harvestGlyphs(
      [touching],
      [
        { kind: "touch", font: "small", pair: "BA", width: 2 },
        { kind: "advance", font: "small", char: "A", advance: 4 },
      ],
      METRICS,
    );
    expect(split.issues).toEqual([]);
    expect(split.fonts.small.glyphs.B).toEqual(["##", "##", "#."]);
  });

  it("applies a touch override to every run with the pair, in any position, and only there", () => {
    const result = harvestGlyphs(
      [
        // "ABA": A at 5..7, B at 9..10 touching A at 11..13.
        sample("ABA", ["###.#####", "#.#.###.#", "#.#.#.#.#"]),
        // "B A": a space separates the pair, so nothing is split.
        sample("B A", ["##...###", "##...#.#", "#....#.#"]),
      ],
      [
        { kind: "touch", font: "small", pair: "BA", width: 2 },
        { kind: "advance", font: "small", char: "A", advance: 4 },
      ],
      METRICS,
    );
    expect(result.issues).toEqual([]);
    expect(result.fonts.small.glyphs.B).toEqual(["##", "##", "#."]);
    expect(result.fonts.small.glyphs[" "]).toEqual(["...", "...", "..."]);
  });

  it("reports conflicting bitmaps for one character", () => {
    const result = harvestGlyphs(
      [sample("A", A), sample("A", ["###", "###", "#.#"])].map((s, i) => ({
        ...s,
        source: `s${i}`,
      })),
      [{ kind: "advance", font: "small", char: "A", advance: 4 }],
      METRICS,
    );
    expect(result.issues).toEqual([
      {
        kind: "bitmap-conflict",
        font: "small",
        char: "A",
        variants: [
          { rows: A, sources: ["s0"] },
          { rows: ["###", "###", "#.#"], sources: ["s1"] },
        ],
      },
    ]);
  });

  it("reports conflicting advances, and a bearing override resolves them", () => {
    // "A1": A at 5, 1's ink at 10 (cell at 9, bearing 1). "AB": B at 9.
    const samples = [
      sample("A1", ["###...#", "#.#..##", "#.#...#"]),
      sample("AB", ["###.##", "#.#.##", "#.#.#."]),
      sample("1A", [".#.###", "##.#.#", ".#.#.#"]),
    ];
    const conflict = harvestGlyphs(
      samples,
      [{ kind: "advance", font: "small", char: "B", advance: 3 }],
      METRICS,
    );
    expect(conflict.issues).toEqual([
      {
        kind: "advance-conflict",
        font: "small",
        char: "A",
        values: [
          { advance: 5, sources: ["toy A1"] },
          { advance: 4, sources: ["toy AB"] },
        ],
      },
    ]);

    const overrides: GlyphOverride[] = [
      { kind: "bearing", font: "small", char: "1", bearing: 1 },
      { kind: "advance", font: "small", char: "B", advance: 3 },
    ];
    const resolved = harvestGlyphs(samples, overrides, METRICS);
    expect(resolved.issues).toEqual([]);
    expect(resolved.fonts.small.glyphs["1"]).toEqual(["..#.", ".##.", "..#."]);
  });

  it("reports an override that contradicts a measurement", () => {
    const result = harvestGlyphs(
      [sample("AB", ["###.##", "#.#.##", "#.#.#."])],
      [
        { kind: "advance", font: "small", char: "A", advance: 5 },
        { kind: "advance", font: "small", char: "B", advance: 3 },
      ],
      METRICS,
    );
    expect(result.issues).toEqual([
      {
        kind: "advance-conflict",
        font: "small",
        char: "A",
        values: [
          { advance: 5, sources: ["override"] },
          { advance: 4, sources: ["toy AB"] },
        ],
      },
    ]);
  });

  it("reports conflicting space widths", () => {
    const result = harvestGlyphs(
      [
        sample("A A", ["###...###", "#.#...#.#", "#.#...#.#"]),
        sample("A A", ["###..###", "#.#..#.#", "#.#..#.#"], {}),
      ].map((s, i) => ({ ...s, source: `s${i}` })),
      [{ kind: "advance", font: "small", char: "A", advance: 4 }],
      METRICS,
    );
    expect(result.issues).toEqual([
      {
        kind: "space-conflict",
        font: "small",
        values: [
          { width: 2, sources: ["s0"] },
          { width: 1, sources: ["s1"] },
        ],
      },
    ]);
  });

  it("reports ink wider than the glyph's advance", () => {
    const result = harvestGlyphs(
      [sample("A", A)],
      [{ kind: "advance", font: "small", char: "A", advance: 2 }],
      METRICS,
    );
    expect(result.issues).toEqual([
      { kind: "overflow", font: "small", char: "A", bearing: 0, inkWidth: 3, advance: 2 },
    ]);
  });
});
