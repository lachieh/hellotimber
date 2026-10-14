// Derive the stock resources from the committed goldens (plan 13, Task 7, D8):
//
//   mise exec -- vp run @hellotimber/nokia-os#extract-resources
//
// - fonts: glyphs harvested from the text runs in scripts/text-runs.ts (plan 13, by hand) and
//   scripts/generated/tree-text-runs.ts (plan 14, from the corpus OCR), + glyph-overrides.ts;
// - menu icons: per carousel `.anim` golden, the icon frames cropped to the union ink box of
//   x 0..79, y 20..39, and their timeline (plus the Clock's per-reveal timelines);
// - boot: the full-frame images and timeline of boot/power-on, and the hands of
//   boot/security-gate (plan 15);
// - status: the signal and battery ladders and icons cropped from standby/standby;
// - widgets (plan 14): the sprites of scripts/widget-sprites.ts, and the widget timelines of the
//   tree goldens (notes, progress notes, blinking prompts) and of the probes it names (splashes,
//   the notes that follow a key, the game-over screens), aligned on their trigger frame (D8);
// - snake (plan 23): the Snake II pictures, mazes and timing of scripts/snake-resources.ts;
// - sounds (plan 16): the tone programs and volume rules of scripts/sound-programs.ts, from the
//   sound goldens.
//
// Writes src/resources/generated/*.ts. Idempotent. `extractResources` is also run in-process by
// tests/resources.test.ts to prove the committed files are fresh. Runs under Node's type
// stripping: imports only node:*, sibling scripts and import-free generated data, with .ts
// extensions.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MENU_SLUGS } from "./capture-set.ts";
import { TREE_TEXT_RUNS } from "./generated/tree-text-runs.ts";
import { GLYPH_OVERRIDES } from "./glyph-overrides.ts";
import {
  findGoldenImage,
  LCD_WIDTH,
  parseGolden,
  parseTickGolden,
  type Golden,
} from "./golden-format.ts";
import {
  formatIssue,
  harvestGlyphs,
  type FontName,
  type HarvestedFont,
  type RunSample,
} from "./harvest-glyphs.ts";
import { extractSnakeResources, type SnakeResourceData } from "./snake-resources.ts";
import { parseSoundGolden } from "./sound-format.ts";
import { extractSoundResources, type SoundResourceData } from "./sound-programs.ts";
import { FONT_HEIGHTS, TEXT_RUNS } from "./text-runs.ts";
import {
  PROBE_TIMELINES,
  TIMELINE_GROUPS,
  WIDGET_SPRITES,
  type SpriteGroup,
  type TimelineKind,
} from "./widget-sprites.ts";
import {
  STOCK_TREE,
  type StockResult,
  type StockScreenSpec,
  type StockTreeNode,
} from "../src/firmware/generated/stock-tree.ts";

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
  // View all returns to the carousel (plan 14 Task 0); the Reminders icon restarts with its own
  // timing (`tree/10-reminders/10-2.leaf`, not `menu/10-reminders.anim`).
  "10-reminders": { return: "tree/10-reminders/10-2.leaf" },
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
  /** The hands after the power-on code is accepted (boot/security-gate), indexing `frames`. */
  readonly gateHands: TimelineData;
}

/** What one step of a widget timeline shows (plan 14 Task 7). */
export type WidgetFrameData =
  /** The widget's screen with this sprite as its animated element (a note icon, a bar frame). */
  | { readonly kind: "sprite"; readonly sprite: string }
  /** A prompt's screen with its cursor shown, or hidden (`plain`). */
  | { readonly kind: "cursor" }
  | { readonly kind: "plain" }
  | { readonly kind: "blank" }
  /** The whole LCD as captured: a leading frame of another screen (`Opening`, an erase). */
  | { readonly kind: "image"; readonly sprite: string }
  /**
   * A partial draw: the next step's first `bytes` LCD bytes over the previous screen. The LCD is
   * written in 8-row pages, column by column (byte = page × 84 + x).
   */
  | { readonly kind: "cut"; readonly bytes: number }
  /** A partial draw: the next screen outside columns x0..x1 and the previous screen inside. */
  | { readonly kind: "edges"; readonly x0: number; readonly x1: number };

export interface WidgetTimelineData {
  readonly frames: readonly WidgetFrameData[];
  /** Durations from the trigger frame (D8); the last step lasts until the parent returns. */
  readonly steps: readonly TimelineStepData[];
  /** Progress bars and prompt cursors loop from this step. */
  readonly loopFrom?: number;
}

export interface WidgetData {
  readonly sprites: Readonly<Record<string, Sprite>>;
  readonly timelines: Readonly<Record<string, WidgetTimelineData>>;
  /** Tree node number → timeline id (from the goldens' `covers`; splashes by their game). */
  readonly byNode: Readonly<Record<string, string>>;
  /** Named probe timelines (scripts/widget-sprites.ts `PROBE_TIMELINES`). */
  readonly byName: Readonly<Record<string, string>>;
}

export interface ExtractedResources {
  readonly fonts: Readonly<Record<FontName, HarvestedFont>>;
  readonly menuIcons: Readonly<Record<string, MenuIconData>>;
  readonly boot: BootData;
  readonly status: StatusData;
  readonly widgets: WidgetData;
  readonly snake: SnakeResourceData;
  readonly sounds: SoundResourceData;
}

// ---------------------------------------------------------------- pixels

const FULL_LCD = { x0: 0, x1: 83, y0: 0, y1: 47 } as const;

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
  for (const [id, images] of [...Object.entries(TEXT_RUNS), ...Object.entries(TREE_TEXT_RUNS)]) {
    const golden = loadGolden(goldensDir, id);
    for (const [name, runs] of Object.entries(images)) {
      const { pixels } = findGoldenImage(golden, name);
      for (const run of runs) samples.push({ source: `${id} ${name}`, run, pixels });
    }
  }
  const { fonts, issues } = harvestGlyphs(samples, GLYPH_OVERRIDES, FONT_HEIGHTS);
  if (issues.length > 0) {
    throw new Error(
      `glyph harvest reported ${issues.length} issue(s); fix scripts/text-runs.ts (or the OCR ` +
        `runs' model, scripts/tree-model.ts) or add a ` +
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
  const frames = golden.images.map((image) => crop(image.pixels, FULL_LCD));
  return {
    frames,
    // Every boot step is finite (the last one is held, then standby): no merging, no loop.
    timeline: {
      steps: golden.timeline!.map((row) => ({
        frame: names.indexOf(row.image),
        durationMs: row.durationMs,
      })),
    },
    gateHands: gateHands(loadGolden(goldensDir, "boot/security-gate"), frames),
  };
}

/**
 * The hands after `Code accepted` (plan 15 D9): the trailing rows of boot/security-gate that show
 * boot/power-on's hands images (the same pictures at the gate's regular ≈255 ms steps).
 */
function gateHands(gate: Golden, frames: readonly (readonly string[])[]): TimelineData {
  const byArt = new Map(frames.map((art, i) => [art.join("\n"), i]));
  const blank = byArt.get(frames[0]!.join("\n"));
  const rows = gate.timeline!;
  const steps: TimelineStepData[] = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const art = crop(findGoldenImage(gate, rows[i]!.image).pixels, FULL_LCD).join("\n");
    const frame = byArt.get(art);
    if (frame === undefined || frame === blank) break;
    steps.unshift({ frame, durationMs: rows[i]!.durationMs });
  }
  if (steps.length === 0) throw new Error(`${gate.id}: no boot/power-on hands at its end`);
  return { steps };
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

// ---------------------------------------------------------------- widgets (plan 14 Task 7)

/** Partial draws last at most this long (15-16 ms draws, 8-9 ms erases before standby). */
const PARTIAL_MS = 20;

/** The widget kind a tree node's screen animates with, if any. */
function widgetKind(screen: StockScreenSpec | StockResult): TimelineKind | undefined {
  switch (screen.kind) {
    case "timed-note":
    case "static-note":
      return "note";
    case "progress-note":
      return "progress";
    case "text-input":
    case "number-input":
    case "code-prompt":
      return "prompt";
    default:
      return undefined;
  }
}

/** Every tree node's screen by number, option choices and info pages (undefined: no result). */
function treeScreens(): Map<string, StockScreenSpec | StockResult | undefined> {
  const screens = new Map<string, StockScreenSpec | StockResult | undefined>();
  const visit = (node: StockTreeNode): void => {
    screens.set(node.number, node.opens);
    const spec = node.opens;
    if (spec.kind === "option-list") {
      spec.options.forEach((option, i) => screens.set(`${node.number}-${i + 1}`, option.result));
    } else if (spec.kind === "info-pages") {
      spec.pages.forEach((page, i) => screens.set(`${node.number}-${i + 1}`, page.result));
    }
    for (const child of node.children ?? []) visit(child);
  };
  for (const top of STOCK_TREE) visit(top);
  return screens;
}

const LCD_BYTES = (LCD_WIDTH * 48) / 8;

/** `bytes` such that `shown` is `next`'s first `bytes` LCD bytes over `previous`, if it is. */
function cutOf(previous: Uint8Array, shown: Uint8Array, next: Uint8Array): number | undefined {
  let lastNew = -1;
  let firstOld = LCD_BYTES;
  for (let byte = 0; byte < LCD_BYTES; byte++) {
    const page = Math.floor(byte / LCD_WIDTH);
    const x = byte % LCD_WIDTH;
    for (let y = page * 8; y < page * 8 + 8; y++) {
      const i = y * LCD_WIDTH + x;
      if (previous[i] === next[i]) {
        if (shown[i] !== next[i]) return undefined;
      } else if (shown[i] === next[i]) lastNew = byte;
      else if (shown[i] === previous[i]) firstOld = Math.min(firstOld, byte);
    }
  }
  return lastNew >= 0 && lastNew < firstOld && firstOld < LCD_BYTES ? lastNew + 1 : undefined;
}

/** Columns x0..x1 such that `shown` is `previous` inside them and `next` outside, if it is. */
function edgesOf(
  previous: Uint8Array,
  shown: Uint8Array,
  next: Uint8Array,
): { x0: number; x1: number } | undefined {
  let x0 = LCD_WIDTH;
  let x1 = -1;
  let drawn = 0;
  for (let i = 0; i < shown.length; i++) {
    if (previous[i] === next[i]) {
      if (shown[i] !== next[i]) return undefined;
      continue;
    }
    const x = i % LCD_WIDTH;
    if (shown[i] === previous[i]) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    } else drawn++;
  }
  if (x1 < 0 || drawn === 0) return undefined;
  for (let i = 0; i < shown.length; i++) {
    const x = i % LCD_WIDTH;
    if (previous[i] !== next[i] && x >= x0 && x <= x1 && shown[i] !== previous[i]) return undefined;
  }
  return { x0, x1 };
}

function isBlank(pixels: Uint8Array): boolean {
  return pixels.every((p) => p === 0);
}

/** The smallest period p (> 0) with frames[i] = frames[i - p] for every i ≥ p, if one exists. */
function periodOf(frames: readonly number[]): number | undefined {
  for (let p = 1; p < frames.length; p++) {
    let repeats = true;
    for (let i = p; i < frames.length && repeats; i++) repeats = frames[i] === frames[i - p];
    if (repeats) return p;
  }
  return undefined;
}

interface Step {
  readonly frame: WidgetFrameData;
  readonly durationMs: number;
  readonly lowerBound: boolean;
}

/** Consecutive steps that show the same frame, merged. */
function merge(steps: readonly Step[]): Step[] {
  const out: Step[] = [];
  for (const step of steps) {
    const last = out[out.length - 1];
    if (last && JSON.stringify(last.frame) === JSON.stringify(step.frame)) {
      out[out.length - 1] = { ...step, durationMs: last.durationMs + step.durationMs };
    } else out.push(step);
  }
  return out;
}

/** Steps → timeline data, frames indexed in first-appearance order. */
function toWidgetTimeline(steps: readonly Step[], loopFrom?: number): WidgetTimelineData {
  const frames: WidgetFrameData[] = [];
  const indexOf = (frame: WidgetFrameData): number => {
    const key = JSON.stringify(frame);
    const found = frames.findIndex((f) => JSON.stringify(f) === key);
    if (found >= 0) return found;
    frames.push(frame);
    return frames.length - 1;
  };
  const out: TimelineStepData[] = steps.map((step) => ({
    frame: indexOf(step.frame),
    durationMs: step.durationMs,
  }));
  return { frames, steps: out, ...(loopFrom === undefined ? {} : { loopFrom }) };
}

function extractWidgets(goldensDir: string): WidgetData {
  const goldens = new Map<string, Golden>();
  const golden = (id: string): Golden => {
    let found = goldens.get(id);
    if (!found) {
      found = loadGolden(goldensDir, id);
      goldens.set(id, found);
    }
    return found;
  };

  const sprites: Record<string, Sprite> = {};
  const groups = new Map<SpriteGroup, { id: string; region: Region; art: string }[]>();
  for (const entry of WIDGET_SPRITES) {
    if (sprites[entry.id]) throw new Error(`widget sprite "${entry.id}" is listed twice`);
    const art = crop(findGoldenImage(golden(entry.golden), entry.image).pixels, entry);
    if (!art.some((row) => row.includes("#"))) {
      throw new Error(
        `widget sprite "${entry.id}": no ink in ${entry.golden} image "${entry.image}"`,
      );
    }
    sprites[entry.id] = { x: entry.x0, y: entry.y0, art };
    groups.set(entry.group, [
      ...(groups.get(entry.group) ?? []),
      { id: entry.id, region: entry, art: art.join("\n") },
    ]);
  }
  const spriteIn = (pixels: Uint8Array, kind: TimelineKind): string | undefined => {
    for (const group of TIMELINE_GROUPS[kind]) {
      for (const sprite of groups.get(group) ?? []) {
        if (crop(pixels, sprite.region).join("\n") === sprite.art) return sprite.id;
      }
    }
    return undefined;
  };

  /**
   * A widget's steps in a timeline golden, from `start` until the frame that is not the
   * widget's (the parent returning). Before the widget's first sprite, frames are kept as
   * captured; partial draws (≤ PARTIAL_MS) are composites of their neighbours.
   */
  const segment = (
    id: string,
    kind: TimelineKind,
    start: "trigger" | "first-sprite",
    fromFrame?: number,
  ): Step[] => {
    const g = golden(id);
    const rows = g.timeline;
    if (!rows || typeof g.triggerFrame !== "number")
      throw new Error(`${id}: not a triggered timeline`);
    const pixelsOf = (i: number): Uint8Array => findGoldenImage(g, rows[i]!.image).pixels;
    let i = Math.max(g.triggerFrame, fromFrame ?? 0);
    if (start === "first-sprite") {
      while (i < rows.length && spriteIn(pixelsOf(i), kind) === undefined) i++;
    }
    const steps: Step[] = [];
    let shown = false;
    for (; i < rows.length; i++) {
      const row = rows[i]!;
      if (row.image === rows[0]!.image) break;
      const pixels = pixelsOf(i);
      const sprite = spriteIn(pixels, kind);
      let frame: WidgetFrameData | undefined;
      if (sprite !== undefined) {
        frame = { kind: "sprite", sprite };
        shown = true;
      } else if (isBlank(pixels)) frame = { kind: "blank" };
      else if (row.durationMs <= PARTIAL_MS && i > 0 && i + 1 < rows.length) {
        const bytes = cutOf(pixelsOf(i - 1), pixels, pixelsOf(i + 1));
        const edges =
          bytes === undefined ? edgesOf(pixelsOf(i - 1), pixels, pixelsOf(i + 1)) : undefined;
        if (bytes !== undefined) frame = { kind: "cut", bytes };
        else if (edges) frame = { kind: "edges", ...edges };
      }
      if (frame === undefined && !shown) {
        const lead = `capture/${id}/${row.image}`;
        sprites[lead] = { x: 0, y: 0, art: crop(pixels, { x0: 0, x1: 83, y0: 0, y1: 47 }) };
        frame = { kind: "image", sprite: lead };
      }
      if (frame === undefined) break;
      steps.push({ frame, durationMs: row.durationMs, lowerBound: row.lowerBound });
    }
    if (!shown) throw new Error(`${id}: no ${kind} sprite after the trigger`);
    // Progress bars loop until a key; everything else ends by returning to its parent.
    if (i >= rows.length && kind !== "progress") {
      throw new Error(`${id}: the ${kind} never returns to its parent`);
    }
    return steps;
  };

  /** A prompt's blinking cursor: the frames from the trigger, if more than one image shows. */
  const blink = (id: string): Step[] | undefined => {
    const g = golden(id);
    const rows = g.timeline!.slice(g.triggerFrame as number);
    const names = [...new Set(rows.map((row) => row.image))];
    if (names.length === 1) return undefined;
    const ink = (name: string): number =>
      findGoldenImage(g, name).pixels.reduce((n, p) => n + p, 0);
    const plain = names.reduce((a, b) => (ink(b) < ink(a) ? b : a));
    const plainPixels = findGoldenImage(g, plain).pixels;
    for (const name of names) {
      if (name === plain) continue;
      const columns = new Set<number>();
      findGoldenImage(g, name).pixels.forEach((p, i) => {
        if (p !== plainPixels[i]) columns.add(i % LCD_WIDTH);
      });
      if (columns.size !== 1)
        throw new Error(`${id}: image "${name}" is not "${plain}" plus a cursor`);
    }
    return rows.map((row) => ({
      frame: row.image === plain ? { kind: "plain" } : { kind: "cursor" },
      durationMs: row.durationMs,
      lowerBound: row.lowerBound,
    }));
  };

  const timelines: Record<string, WidgetTimelineData> = {};
  const add = (key: string, recorded: readonly Step[], looping: boolean): string => {
    const steps = merge(recorded);
    let data: WidgetTimelineData;
    if (looping) {
      const merged = toWidgetTimeline(steps);
      const period = periodOf(merged.steps.map((step) => step.frame));
      if (period === undefined || period + 1 > merged.steps.length) {
        throw new Error(`${key}: the loop never repeats`);
      }
      if (steps.slice(0, period + 1).some((step) => step.lowerBound)) {
        throw new Error(`${key}: the loop's first cycle is cut short by the recording`);
      }
      // Every step as captured (later cycles drift by a few ms, D8), then the last full cycle
      // repeats. The last recorded step is dropped: the recording's end or a key cut it short.
      const complete = steps.slice(0, -1);
      data = toWidgetTimeline(complete, complete.length - period);
    } else data = toWidgetTimeline(steps);
    const key2 = JSON.stringify(data);
    const existing = Object.entries(timelines).find(([, t]) => JSON.stringify(t) === key2);
    if (existing) return existing[0];
    timelines[key] = data;
    return key;
  };

  const screens = treeScreens();
  const byNode: Record<string, string> = {};
  const index = JSON.parse(readFileSync(join(goldensDir, "index.json"), "utf8")) as {
    id: string;
    status: string;
    kind: string;
    covers?: string[];
  }[];
  for (const entry of index) {
    if (entry.status !== "asserted" || entry.kind !== "timeline" || !entry.covers) continue;
    const kinds = new Set(
      entry.covers.map((number) => {
        if (!screens.has(number)) throw new Error(`${entry.id}: covers unknown node ${number}`);
        const screen = screens.get(number);
        return screen === undefined ? undefined : widgetKind(screen);
      }),
    );
    if (kinds.size !== 1) throw new Error(`${entry.id}: covers nodes of different widget kinds`);
    const kind = [...kinds][0];
    if (kind === undefined) continue;
    let id: string | undefined;
    if (kind === "prompt") {
      const steps = blink(entry.id);
      if (steps) id = add(entry.covers[0]!, steps, true);
    } else id = add(entry.covers[0]!, segment(entry.id, kind, "trigger"), kind === "progress");
    if (id !== undefined) for (const number of entry.covers) byNode[number] = id;
  }

  const byName: Record<string, string> = {};
  for (const probe of PROBE_TIMELINES) {
    const key = probe.node ?? probe.name;
    if (key === undefined)
      throw new Error(`${probe.golden}: a probe timeline needs a node or a name`);
    const looping = probe.kind === "progress";
    const steps = segment(probe.golden, probe.kind, "first-sprite", probe.fromFrame);
    const id = add(key, steps, looping);
    if (probe.node !== undefined) byNode[probe.node] = id;
    if (probe.name !== undefined) byName[probe.name] = id;
  }
  return { sprites, timelines, byNode, byName };
}

export function extractResources(goldensDir: string = GOLDENS_DIR): ExtractedResources {
  return {
    fonts: harvestFonts(goldensDir),
    menuIcons: extractMenuIcons(goldensDir),
    boot: extractBoot(goldensDir),
    status: extractStatus(goldensDir),
    widgets: extractWidgets(goldensDir),
    snake: extractSnakeResources(
      (id) => loadGolden(goldensDir, id),
      (id) => parseTickGolden(readFileSync(join(goldensDir, `${id}.ticks.txt`), "utf8"), id),
    ),
    sounds: extractSoundResources(
      (id) => parseSoundGolden(readFileSync(join(goldensDir, `${id}.sound.txt`), "utf8"), id),
      (
        JSON.parse(readFileSync(join(goldensDir, "index.json"), "utf8")) as {
          id: string;
          kind: string;
        }[]
      )
        .filter((entry) => entry.kind === "sound")
        .map((entry) => entry.id),
    ),
  };
}

// ---------------------------------------------------------------- generated files

const HEADER = "// GENERATED by scripts/extract-resources.ts from goldens/ - do not edit";

const TYPES = {
  timeline:
    "{ readonly steps: readonly { readonly frame: number; readonly durationMs: number }[]; readonly loopFrom?: number; readonly loopInferred?: true }",
  sprite: "{ readonly x: number; readonly y: number; readonly art: readonly string[] }",
  program:
    "{ readonly id: string; readonly steps: readonly { readonly ms: number; readonly buzzer?: { readonly hz: number; readonly volume: number } | null; readonly tone?: { readonly hz: number; readonly volume: number } | null; readonly vibrator?: boolean }[]; readonly loopFrom?: number }",
  widgetTimeline:
    '{ readonly frames: readonly ({ readonly kind: "sprite" | "image"; readonly sprite: string } | { readonly kind: "cursor" | "plain" | "blank" } | { readonly kind: "cut"; readonly bytes: number } | { readonly kind: "edges"; readonly x0: number; readonly x1: number })[]; readonly steps: readonly { readonly frame: number; readonly durationMs: number }[]; readonly loopFrom?: number }',
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
      `{ readonly frames: readonly (readonly string[])[]; readonly timeline: ${TYPES.timeline}; readonly gateHands: ${TYPES.timeline} }`,
      resources.boot,
    ),
    "status.ts": module(
      "STATUS_DATA",
      `{ readonly signalBars: readonly ${TYPES.sprite}[]; readonly signalIcon: ${TYPES.sprite}; readonly batteryBars: readonly ${TYPES.sprite}[]; readonly batteryIcon: ${TYPES.sprite} }`,
      resources.status,
    ),
    "widgets.ts": module(
      "WIDGET_DATA",
      `{ readonly sprites: Readonly<Record<string, ${TYPES.sprite}>>; readonly timelines: Readonly<Record<string, ${TYPES.widgetTimeline}>>; readonly byNode: Readonly<Record<string, string>>; readonly byName: Readonly<Record<string, string>> }`,
      resources.widgets,
    ),
    "sounds.ts": module(
      "SOUND_DATA",
      `{ readonly previewDelayMs: number; readonly messagePreviewDelayMs: number; readonly ringingTones: readonly { readonly name: string; readonly slug: string; readonly program: ${TYPES.program}; readonly firstMarkStep: number; readonly cycleMs?: number; readonly level5At: { readonly note: number; readonly offsetMs: number }; readonly ascendingAt: readonly { readonly note: number; readonly offsetMs: number }[] }[]; readonly volumeTables: Readonly<Record<string, Readonly<Record<string, number>>>>; readonly messageTones: Readonly<Record<string, ${TYPES.program}>>; readonly beepOnceLevels: Readonly<Record<string, number>>; readonly unsetMessageVolumes: Readonly<Record<string, number>>; readonly keypad: { readonly hz: number; readonly levels: Readonly<Record<string, number>>; readonly awakeMs: number; readonly wokenMs: number; readonly sleepAfterMs: number }; readonly noteSounds: Readonly<Record<string, ${TYPES.program}>>; readonly gameCues: { readonly eat: ${TYPES.program}; readonly crash: ${TYPES.program}; readonly topScore: ${TYPES.program}; readonly vibrateMs: number }; readonly bootTone: { readonly atMs: number; readonly program: ${TYPES.program} } }`,
      resources.sounds,
    ),
    "snake.ts": module(
      "SNAKE_DATA",
      "{ readonly sprites: Readonly<Record<string, readonly string[]>>; readonly mazes: readonly { readonly start: { readonly x: number; readonly y: number }; readonly walls: readonly { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }[] }[]; readonly periods: Readonly<Record<number, number>>; readonly firstTick: Readonly<Record<number, number>>; readonly graceMs: number; readonly death: readonly { readonly visible: boolean; readonly durationMs: number }[]; readonly topScoreMs: number }",
      resources.snake,
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
