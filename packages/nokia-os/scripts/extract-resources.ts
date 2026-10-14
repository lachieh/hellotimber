// Derive the stock resources from the committed goldens (plan 13, Task 7, D8):
//
//   mise exec -- vp run @hellotimber/nokia-os#extract-resources
//
// - fonts: glyphs harvested from the text runs in scripts/text-runs.ts (+ glyph-overrides.ts);
// - menu icons: per carousel `.anim` golden, the icon frames cropped to the union ink box of
//   x 0..79, y 20..39, and their timeline (plus the Clock's per-reveal timelines);
// - boot: the full-frame images and timeline of boot/power-on;
// - status: the signal and battery ladders and icons cropped from standby/standby.
//
// Writes src/resources/generated/*.ts. Idempotent. `extractResources` is also run in-process by
// tests/resources.test.ts to prove the committed files are fresh. Runs under Node's type
// stripping: imports only node:* and sibling scripts with .ts extensions.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MENU_SLUGS } from "./capture-set.ts";
import { GLYPH_OVERRIDES } from "./glyph-overrides.ts";
import { findGoldenImage, LCD_WIDTH, parseGolden, type Golden } from "./golden-format.ts";
import {
  formatIssue,
  harvestGlyphs,
  type FontName,
  type HarvestedFont,
  type RunSample,
} from "./harvest-glyphs.ts";
import { FONT_HEIGHTS, TEXT_RUNS } from "./text-runs.ts";

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const GOLDENS_DIR = join(PACKAGE, "goldens");
const GENERATED_DIR = join(PACKAGE, "src/resources/generated");

/** Carousel icon art lives here; the title (and its descenders) sits above y 20. */
const ICON_REGION = { x0: 0, x1: 79, y0: 20, y1: 39 } as const;
/** Constant across an item's frames: the title band. The indicator (y 0..5) may change. */
const TITLE_REGION = { x0: 0, x1: 79, y0: 6, y1: 19 } as const;
/** A recording whose last frame is held at least this long has settled (no loop). */
const SETTLED_MS = 1000;

/** Goldens that give a graphic a timeline for one reveal (Task 4 deviation). */
const REVEAL_GOLDENS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "11-clock": { previous: "menu/revisit.anim", return: "menu/return.anim" },
};

export interface TimelineStepData {
  readonly frame: number;
  readonly durationMs: number;
}

export interface TimelineData {
  readonly steps: readonly TimelineStepData[];
  /** Present when the recording ended in a repeating cycle instead of a held frame. */
  readonly loopFrom?: number;
  /** Set with `loopFrom`: the loop was inferred from a cycle, not observed to settle. */
  readonly loopInferred?: true;
}

export interface MenuIconData {
  /** Top-left of the art on the LCD. */
  readonly x: number;
  readonly y: number;
  readonly frames: readonly (readonly string[])[];
  /** Played when the slot is revealed (the default timeline). */
  readonly timeline: TimelineData;
  /** Timelines for specific reveals, where the firmware's timing differs. */
  readonly reveals?: Readonly<Record<string, TimelineData>>;
}

export interface Sprite {
  readonly x: number;
  readonly y: number;
  readonly art: readonly string[];
}

export interface StatusData {
  /** Top to bottom; level n shows the bottom n bars. */
  readonly signalBars: readonly Sprite[];
  readonly signalIcon: Sprite;
  readonly batteryBars: readonly Sprite[];
  readonly batteryIcon: Sprite;
}

export interface BootData {
  readonly frames: readonly (readonly string[])[];
  readonly timeline: TimelineData;
}

export interface ExtractedResources {
  readonly fonts: Readonly<Record<FontName, HarvestedFont>>;
  readonly menuIcons: Readonly<Record<string, MenuIconData>>;
  readonly boot: BootData;
  readonly status: StatusData;
}

// ---------------------------------------------------------------- pixels

type Region = {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
};

function crop(pixels: Uint8Array, r: Region): string[] {
  const rows: string[] = [];
  for (let y = r.y0; y <= r.y1; y++) {
    let row = "";
    for (let x = r.x0; x <= r.x1; x++) row += pixels[y * LCD_WIDTH + x] === 1 ? "#" : ".";
    rows.push(row);
  }
  return rows;
}

/** Ink bounding box of `pixels` within `r`, or undefined when `r` is blank. */
function inkBox(pixels: Uint8Array, r: Region): Region | undefined {
  let box: { x0: number; x1: number; y0: number; y1: number } | undefined;
  for (let y = r.y0; y <= r.y1; y++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (pixels[y * LCD_WIDTH + x] !== 1) continue;
      if (!box) box = { x0: x, x1: x, y0: y, y1: y };
      else {
        box.x0 = Math.min(box.x0, x);
        box.x1 = Math.max(box.x1, x);
        box.y0 = Math.min(box.y0, y);
        box.y1 = Math.max(box.y1, y);
      }
    }
  }
  return box;
}

function union(a: Region | undefined, b: Region | undefined): Region | undefined {
  if (!a) return b;
  if (!b) return a;
  return {
    x0: Math.min(a.x0, b.x0),
    x1: Math.max(a.x1, b.x1),
    y0: Math.min(a.y0, b.y0),
    y1: Math.max(a.y1, b.y1),
  };
}

// ---------------------------------------------------------------- timelines

/**
 * Merges consecutive equal frames. A recording that ends on a frame held ≥ SETTLED_MS has
 * settled; otherwise the trailing steps must form a repeating cycle, which becomes `loopFrom`.
 */
export function toTimeline(
  rows: readonly { frame: number; durationMs: number }[],
  endsHeld: boolean,
): TimelineData {
  const steps: TimelineStepData[] = [];
  for (const row of rows) {
    const last = steps[steps.length - 1];
    if (last && last.frame === row.frame) {
      steps[steps.length - 1] = { frame: last.frame, durationMs: last.durationMs + row.durationMs };
    } else steps.push({ frame: row.frame, durationMs: row.durationMs });
  }
  if (endsHeld && steps[steps.length - 1]!.durationMs >= SETTLED_MS) return { steps };
  const cycle = inferLoop(steps.map((s) => s.frame));
  if (!cycle) {
    throw new Error(
      `recording neither settles nor ends in a cycle: frames ${steps.map((s) => s.frame).join(",")}`,
    );
  }
  return {
    steps: steps.slice(0, cycle.loopFrom + cycle.period),
    loopFrom: cycle.loopFrom,
    loopInferred: true,
  };
}

/** The earliest `loopFrom` and shortest period whose cycle repeats (at least twice) to the end. */
export function inferLoop(
  frames: readonly number[],
): { loopFrom: number; period: number } | undefined {
  for (let loopFrom = 0; loopFrom < frames.length; loopFrom++) {
    for (let period = 1; loopFrom + 2 * period <= frames.length; period++) {
      let repeats = true;
      for (let i = loopFrom; i + period < frames.length && repeats; i++) {
        repeats = frames[i] === frames[i + period];
      }
      if (repeats) return { loopFrom, period };
    }
  }
  return undefined;
}

// ---------------------------------------------------------------- extraction

function loadGolden(goldensDir: string, id: string): Golden {
  const file = `${id}.lcd.txt`;
  return parseGolden(readFileSync(join(goldensDir, file), "utf8"), file);
}

function harvestFonts(goldensDir: string): Record<FontName, HarvestedFont> {
  const samples: RunSample[] = [];
  for (const [id, images] of Object.entries(TEXT_RUNS)) {
    const golden = loadGolden(goldensDir, id);
    for (const [name, runs] of Object.entries(images)) {
      const { pixels } = findGoldenImage(golden, name);
      for (const run of runs) samples.push({ source: `${id} ${name}`, run, pixels });
    }
  }
  const { fonts, issues } = harvestGlyphs(samples, GLYPH_OVERRIDES, FONT_HEIGHTS);
  if (issues.length > 0) {
    throw new Error(
      `glyph harvest reported ${issues.length} issue(s); fix scripts/text-runs.ts or add a ` +
        `scripts/glyph-overrides.ts entry:\n${issues.map((i) => `  ${formatIssue(i)}`).join("\n")}`,
    );
  }
  return fonts as Record<FontName, HarvestedFont>;
}

/** The frames of an `.anim` golden that show the revealed item: from the trigger, once the title settles. */
function itemRows(
  golden: Golden,
): { pixels: Uint8Array; durationMs: number; lowerBound: boolean }[] {
  const timeline = golden.timeline!;
  const trigger = golden.triggerFrame === "before-recording" ? 0 : (golden.triggerFrame ?? 0);
  const pixelsOf = (i: number) => findGoldenImage(golden, timeline[i]!.image).pixels;
  const title = (i: number) => crop(pixelsOf(i), TITLE_REGION).join("\n");
  const finalTitle = title(timeline.length - 1);
  let first = trigger;
  while (title(first) !== finalTitle) first++;
  const rows = [];
  for (let i = first; i < timeline.length; i++) {
    if (title(i) !== finalTitle) {
      throw new Error(`${golden.id}: frame ${i} changes the title band (icon ink above y 20?)`);
    }
    rows.push({
      pixels: pixelsOf(i),
      durationMs: timeline[i]!.durationMs,
      lowerBound: timeline[i]!.lowerBound,
    });
  }
  return rows;
}

function extractMenuIcons(goldensDir: string): Record<string, MenuIconData> {
  const icons: Record<string, MenuIconData> = {};
  for (const slug of MENU_SLUGS) {
    const sources: [string | undefined, Golden][] = [
      [undefined, loadGolden(goldensDir, `menu/${slug}.anim`)],
      ...Object.entries(REVEAL_GOLDENS[slug] ?? {}).map(([reveal, id]): [string, Golden] => [
        reveal,
        loadGolden(goldensDir, id),
      ]),
    ];
    const perSource = sources.map(([reveal, golden]) => ({ reveal, rows: itemRows(golden) }));

    let box: Region | undefined;
    for (const { rows } of perSource) {
      for (const row of rows) box = union(box, inkBox(row.pixels, ICON_REGION));
    }
    if (!box) throw new Error(`menu/${slug}.anim: no icon ink in x 0..79, y 20..39`);

    const frames: string[][] = [];
    const frameIndex = (pixels: Uint8Array): number => {
      const art = crop(pixels, box!);
      const key = art.join("\n");
      const found = frames.findIndex((f) => f.join("\n") === key);
      if (found >= 0) return found;
      frames.push(art);
      return frames.length - 1;
    };
    const timelines = perSource.map(({ reveal, rows }) => ({
      reveal,
      timeline: toTimeline(
        rows.map((row) => ({ frame: frameIndex(row.pixels), durationMs: row.durationMs })),
        rows[rows.length - 1]!.lowerBound,
      ),
    }));

    const reveals: Record<string, TimelineData> = {};
    for (const { reveal, timeline } of timelines) if (reveal) reveals[reveal] = timeline;
    icons[slug.replace(/^\d\d-/, "")] = {
      x: box.x0,
      y: box.y0,
      frames,
      timeline: timelines[0]!.timeline,
      ...(Object.keys(reveals).length > 0 ? { reveals } : {}),
    };
  }
  return icons;
}

function extractBoot(goldensDir: string): BootData {
  const golden = loadGolden(goldensDir, "boot/power-on");
  const names = golden.images.map((image) => image.name);
  return {
    frames: golden.images.map((image) => crop(image.pixels, { x0: 0, x1: 83, y0: 0, y1: 47 })),
    // Every boot step is finite (the last one is held, then standby): no merging, no loop.
    timeline: {
      steps: golden.timeline!.map((row) => ({
        frame: names.indexOf(row.image),
        durationMs: row.durationMs,
      })),
    },
  };
}

/** Ink parts of a status column, top to bottom, split on blank rows. */
function columnParts(pixels: Uint8Array, x0: number, x1: number): Sprite[] {
  const parts: Sprite[] = [];
  let start: number | undefined;
  for (let y = 0; y <= 40; y++) {
    const lit = y < 40 && inkBox(pixels, { x0, x1, y0: y, y1: y }) !== undefined;
    if (lit && start === undefined) start = y;
    if (!lit && start !== undefined) {
      const box = inkBox(pixels, { x0, x1, y0: start, y1: y - 1 })!;
      parts.push({ x: box.x0, y: box.y0, art: crop(pixels, box) });
      start = undefined;
    }
  }
  return parts;
}

function extractStatus(goldensDir: string): StatusData {
  const { pixels } = findGoldenImage(loadGolden(goldensDir, "standby/standby"), "01-standby");
  const signal = columnParts(pixels, 0, 4);
  const battery = columnParts(pixels, 79, 83);
  if (signal.length !== 5 || battery.length !== 5) {
    throw new Error(
      `standby/standby: expected 4 bars and an icon per side, got ${signal.length} and ${battery.length} parts`,
    );
  }
  return {
    signalBars: signal.slice(0, 4),
    signalIcon: signal[4]!,
    batteryBars: battery.slice(0, 4),
    batteryIcon: battery[4]!,
  };
}

export function extractResources(goldensDir: string = GOLDENS_DIR): ExtractedResources {
  return {
    fonts: harvestFonts(goldensDir),
    menuIcons: extractMenuIcons(goldensDir),
    boot: extractBoot(goldensDir),
    status: extractStatus(goldensDir),
  };
}

// ---------------------------------------------------------------- generated files

const HEADER = "// GENERATED by scripts/extract-resources.ts from goldens/ - do not edit";

const TYPES = {
  timeline:
    "{ readonly steps: readonly { readonly frame: number; readonly durationMs: number }[]; readonly loopFrom?: number; readonly loopInferred?: true }",
  sprite: "{ readonly x: number; readonly y: number; readonly art: readonly string[] }",
};

function module(name: string, type: string, value: unknown): string {
  return `${HEADER}\n\nexport const ${name}: ${type} = ${JSON.stringify(value, null, 2)};\n`;
}

export function generatedFiles(resources: ExtractedResources): Record<string, string> {
  return {
    "fonts.ts": module(
      "STOCK_FONT_DATA",
      'Readonly<Record<"small" | "large" | "digits" | "thin", { readonly height: number; readonly glyphs: Readonly<Record<string, readonly string[]>> }>>',
      resources.fonts,
    ),
    "menu-icons.ts": module(
      "MENU_ICON_DATA",
      `Readonly<Record<string, { readonly x: number; readonly y: number; readonly frames: readonly (readonly string[])[]; readonly timeline: ${TYPES.timeline}; readonly reveals?: Readonly<Record<string, ${TYPES.timeline}>> }>>`,
      resources.menuIcons,
    ),
    "boot.ts": module(
      "BOOT_DATA",
      `{ readonly frames: readonly (readonly string[])[]; readonly timeline: ${TYPES.timeline} }`,
      resources.boot,
    ),
    "status.ts": module(
      "STATUS_DATA",
      `{ readonly signalBars: readonly ${TYPES.sprite}[]; readonly signalIcon: ${TYPES.sprite}; readonly batteryBars: readonly ${TYPES.sprite}[]; readonly batteryIcon: ${TYPES.sprite} }`,
      resources.status,
    ),
  };
}

function main(): void {
  if (!existsSync(GOLDENS_DIR)) throw new Error(`missing ${GOLDENS_DIR}`);
  mkdirSync(GENERATED_DIR, { recursive: true });
  for (const [file, text] of Object.entries(generatedFiles(extractResources()))) {
    const path = join(GENERATED_DIR, file);
    if (existsSync(path) && readFileSync(path, "utf8") === text) continue;
    writeFileSync(path, text);
    console.log(`wrote src/resources/generated/${file}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
