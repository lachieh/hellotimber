// Harvest stock font glyphs from text runs in golden images (plan 13, Task 7, D8).
//
// A run names the text drawn in one font at one band of an image. The harvester splits the
// band's ink into glyphs on blank columns and measures each character's advance as the distance
// between consecutive left edges within a word; word gaps give the space width. It never guesses:
// anything it cannot decide is reported as an issue, and plan-owned glyph overrides resolves the
// reported cases explicitly. Pure: no node:* imports, so tests run it in-process.
import { LCD_WIDTH } from "./golden-format.ts";

export type FontName = "small" | "large" | "digits" | "thin";

export const FONT_HEIGHTS: Readonly<Record<FontName, number>> = {
  small: 8,
  large: 13,
  digits: 6,
  thin: 8,
};

export const FONT_NAMES: readonly FontName[] = ["small", "large", "digits", "thin"];

export interface TextRun {
  readonly font: FontName;
  /** The characters drawn, as read from the golden. Spaces separate words. */
  readonly text: string;
  /** First row of the font's cell (ascender top). */
  readonly top: number;
  /** Light text on a solid band (the selected row of a list). */
  readonly inverted?: boolean;
  /** Columns the run occupies; other ink in the band (status bars, rail) is outside. Default 0..83. */
  readonly left?: number;
  readonly right?: number;
}

export interface RunSample {
  /** Where the run comes from, e.g. `menu/02-messages.sub 01`; quoted in issues. */
  readonly source: string;
  readonly run: TextRun;
  /** 84×48, one byte per pixel, 1 = lit. */
  readonly pixels: Uint8Array;
}

export type GlyphOverride =
  /** The glyph's ink starts `bearing` columns into its cell. */
  | {
      readonly kind: "bearing";
      readonly font: FontName;
      readonly char: string;
      readonly bearing: number;
    }
  /** Cell width for a character the goldens never show inside a word. */
  | {
      readonly kind: "advance";
      readonly font: FontName;
      readonly char: string;
      readonly advance: number;
    }
  /**
   * A pair of characters whose glyphs always touch (no blank column between them): wherever the
   * pair is written with no space, the second glyph's ink starts `width` columns after the first's.
   */
  | {
      readonly kind: "touch";
      readonly font: FontName;
      readonly pair: string;
      readonly width: number;
    };

export type HarvestIssue =
  | {
      readonly kind: "segment-count";
      readonly source: string;
      readonly font: FontName;
      readonly text: string;
      readonly expected: number;
      readonly found: number;
    }
  | {
      readonly kind: "bitmap-conflict";
      readonly font: FontName;
      readonly char: string;
      readonly variants: readonly { rows: readonly string[]; sources: readonly string[] }[];
    }
  | {
      readonly kind: "advance-conflict";
      readonly font: FontName;
      readonly char: string;
      readonly values: readonly { advance: number; sources: readonly string[] }[];
    }
  | {
      readonly kind: "space-conflict";
      readonly font: FontName;
      readonly values: readonly { width: number; sources: readonly string[] }[];
    }
  | {
      readonly kind: "unknown-advance";
      readonly font: FontName;
      readonly char: string;
      readonly sources: readonly string[];
    }
  | {
      readonly kind: "overflow";
      readonly font: FontName;
      readonly char: string;
      readonly bearing: number;
      readonly inkWidth: number;
      readonly advance: number;
    };

export interface HarvestedFont {
  readonly height: number;
  /** Glyph art ('#' ink, '.' clear); each row is exactly the glyph's advance wide. */
  readonly glyphs: Readonly<Record<string, readonly string[]>>;
}

export interface HarvestResult {
  readonly fonts: Readonly<Record<FontName, HarvestedFont>>;
  readonly issues: readonly HarvestIssue[];
}

interface Observation {
  readonly rows: readonly string[];
  readonly left: number;
  readonly source: string;
}

interface Pair {
  readonly previous: string;
  readonly next: string;
  /** Left edge of `next` minus left edge of `previous`. */
  readonly distance: number;
  readonly spaces: number;
  readonly source: string;
}

/** Groups `value → sources` in first-seen order. */
class Tally<V> {
  readonly #entries: { value: V; sources: string[] }[] = [];

  add(value: V, source: string): void {
    const key = JSON.stringify(value);
    const entry = this.#entries.find((e) => JSON.stringify(e.value) === key);
    if (!entry) this.#entries.push({ value, sources: [source] });
    else if (!entry.sources.includes(source)) entry.sources.push(source);
  }

  get entries(): readonly { value: V; sources: readonly string[] }[] {
    return this.#entries;
  }
}

/** Splits one run into per-character observations, or reports a segment-count mismatch. */
function readRun(
  sample: RunSample,
  height: number,
  touching: ReadonlyMap<string, number>,
  issues: HarvestIssue[],
): { observations: [string, Observation][]; pairs: Pair[] } | undefined {
  const { run, pixels, source } = sample;
  const left = run.left ?? 0;
  const right = run.right ?? LCD_WIDTH - 1;
  const ink = (x: number, y: number): boolean =>
    (pixels[(run.top + y) * LCD_WIDTH + x] === 1) !== (run.inverted === true);

  const segments: [number, number][] = [];
  for (let x = left; x <= right; x++) {
    let lit = false;
    for (let y = 0; y < height && !lit; y++) lit = ink(x, y);
    if (!lit) continue;
    const last = segments[segments.length - 1];
    if (last && last[1] === x - 1) last[1] = x;
    else segments.push([x, x]);
  }
  const chars = Array.from(run.text);
  const glyphChars = chars.filter((ch) => ch !== " ");
  // Touching pairs: split the first glyph's segment where the second glyph's ink starts.
  for (let i = 0, g = 0; i < chars.length - 1; i++) {
    if (chars[i] === " ") continue;
    const width = touching.get(chars[i]! + chars[i + 1]!);
    const segment = segments[g];
    if (width !== undefined && segment && segment[0] + width <= segment[1]) {
      segments.splice(g, 1, [segment[0], segment[0] + width - 1], [segment[0] + width, segment[1]]);
    }
    g++;
  }
  if (segments.length !== glyphChars.length) {
    issues.push({
      kind: "segment-count",
      source,
      font: run.font,
      text: run.text,
      expected: glyphChars.length,
      found: segments.length,
    });
    return undefined;
  }

  const observations: [string, Observation][] = glyphChars.map((ch, i) => {
    const [x0, x1] = segments[i]!;
    const rows: string[] = [];
    for (let y = 0; y < height; y++) {
      let row = "";
      for (let x = x0; x <= x1; x++) row += ink(x, y) ? "#" : ".";
      rows.push(row);
    }
    return [ch, { rows, left: x0, source }];
  });

  const pairs: Pair[] = [];
  let glyphIndex = -1;
  let spaces = 0;
  for (const ch of chars) {
    if (ch === " ") {
      spaces++;
      continue;
    }
    if (glyphIndex >= 0) {
      pairs.push({
        previous: glyphChars[glyphIndex]!,
        next: ch,
        distance: segments[glyphIndex + 1]![0] - segments[glyphIndex]![0],
        spaces,
        source,
      });
    }
    glyphIndex++;
    spaces = 0;
  }
  return { observations, pairs };
}

export function harvestGlyphs(
  samples: readonly RunSample[],
  overrides: readonly GlyphOverride[],
  heights: Readonly<Record<FontName, number>>,
): HarvestResult {
  const issues: HarvestIssue[] = [];
  const fonts = {} as Record<FontName, HarvestedFont>;

  for (const font of FONT_NAMES) {
    const height = heights[font];
    const bitmaps = new Map<string, Tally<readonly string[]>>();
    const pairs: Pair[] = [];
    const touching = new Map<string, number>();
    for (const o of overrides)
      if (o.kind === "touch" && o.font === font) touching.set(o.pair, o.width);
    for (const sample of samples) {
      if (sample.run.font !== font) continue;
      const read = readRun(sample, height, touching, issues);
      if (!read) continue;
      for (const [ch, observation] of read.observations) {
        if (!bitmaps.has(ch)) bitmaps.set(ch, new Tally());
        bitmaps.get(ch)!.add(observation.rows, observation.source);
      }
      pairs.push(...read.pairs);
    }

    const bearings = new Map<string, number>();
    for (const o of overrides)
      if (o.kind === "bearing" && o.font === font) bearings.set(o.char, o.bearing);
    const bearing = (ch: string): number => bearings.get(ch) ?? 0;

    // Advances: overrides first (tallied as "override"), then every within-word measurement.
    const advances = new Map<string, Tally<number>>();
    const tallyAdvance = (ch: string, value: number, source: string): void => {
      if (!advances.has(ch)) advances.set(ch, new Tally());
      advances.get(ch)!.add(value, source);
    };
    for (const o of overrides) {
      if (o.kind === "advance" && o.font === font) tallyAdvance(o.char, o.advance, "override");
    }
    for (const pair of pairs) {
      if (pair.spaces !== 0) continue;
      tallyAdvance(
        pair.previous,
        pair.distance - bearing(pair.next) + bearing(pair.previous),
        pair.source,
      );
    }
    const advance = new Map<string, number>();
    for (const [ch, tally] of advances) {
      if (tally.entries.length === 1) advance.set(ch, tally.entries[0]!.value);
      else {
        issues.push({
          kind: "advance-conflict",
          font,
          char: ch,
          values: tally.entries.map((e) => ({ advance: e.value, sources: e.sources })),
        });
      }
    }

    const spaceWidths = new Tally<number>();
    for (const pair of pairs) {
      const previousAdvance = advance.get(pair.previous);
      if (pair.spaces === 0 || previousAdvance === undefined) continue;
      const gap = pair.distance - previousAdvance - bearing(pair.next) + bearing(pair.previous);
      spaceWidths.add(gap / pair.spaces, pair.source);
    }

    const glyphs: Record<string, readonly string[]> = {};
    if (spaceWidths.entries.length > 1) {
      issues.push({
        kind: "space-conflict",
        font,
        values: spaceWidths.entries.map((e) => ({ width: e.value, sources: e.sources })),
      });
    } else if (spaceWidths.entries.length === 1) {
      glyphs[" "] = Array.from({ length: height }, () => ".".repeat(spaceWidths.entries[0]!.value));
    }

    for (const ch of [...bitmaps.keys()].sort()) {
      const variants = bitmaps.get(ch)!.entries;
      if (variants.length > 1) {
        issues.push({
          kind: "bitmap-conflict",
          font,
          char: ch,
          variants: variants.map((v) => ({ rows: v.value, sources: v.sources })),
        });
        continue;
      }
      const rows = variants[0]!.value;
      const width = advance.get(ch);
      if (width === undefined) {
        if (!advances.has(ch)) {
          issues.push({ kind: "unknown-advance", font, char: ch, sources: variants[0]!.sources });
        }
        continue;
      }
      const lead = bearing(ch);
      const inkWidth = rows[0]!.length;
      if (lead + inkWidth > width) {
        issues.push({ kind: "overflow", font, char: ch, bearing: lead, inkWidth, advance: width });
        continue;
      }
      glyphs[ch] = rows.map((row) => ".".repeat(lead) + row + ".".repeat(width - lead - inkWidth));
    }
    fonts[font] = { height, glyphs };
  }

  return { fonts, issues };
}

/** One line per issue, for the extractor's failure message. */
export function formatIssue(issue: HarvestIssue): string {
  switch (issue.kind) {
    case "segment-count":
      return `${issue.source}: ${issue.font} "${issue.text}" has ${issue.found} glyph segments, expected ${issue.expected}`;
    case "bitmap-conflict":
      return `${issue.font} '${issue.char}': ${issue.variants.length} different bitmaps (${issue.variants
        .map((v) => `[${v.rows.join("/")}] in ${v.sources.join(", ")}`)
        .join("; ")})`;
    case "advance-conflict":
      return `${issue.font} '${issue.char}': conflicting advances (${issue.values
        .map((v) => `${v.advance} from ${v.sources.join(", ")}`)
        .join("; ")})`;
    case "space-conflict":
      return `${issue.font} space: conflicting widths (${issue.values
        .map((v) => `${v.width} from ${v.sources.join(", ")}`)
        .join("; ")})`;
    case "unknown-advance":
      return `${issue.font} '${issue.char}': unknown advance (only seen at a word end in ${issue.sources.join(", ")})`;
    case "overflow":
      return `${issue.font} '${issue.char}': bearing ${issue.bearing} + ink ${issue.inkWidth} exceeds advance ${issue.advance}`;
  }
}
