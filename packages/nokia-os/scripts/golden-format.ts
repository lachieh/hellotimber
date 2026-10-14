// LCD golden fixture format (`*.lcd.txt`): parse, validate and serialize.
//
// Shared by the capture importer (run under Node's type stripping), the tests and the demo, so
// it imports nothing: no node:* modules, no src/ files. See docs/plans/13-nokia-os-foundation.md
// "Golden pipeline" for the format.

export const LCD_WIDTH = 84;
export const LCD_HEIGHT = 48;

const MAGIC = "lcd-golden 1";
const TIMELINE_HEADER = "# frame image start_ms duration_ms lcd    leds";

export type GoldenStatus = "asserted" | `pending:${string}`;
export type LcdMode = "normal" | "inverse" | "blank";
export type TriggerFrame = number | "before-recording";
/** How the acceptance runner drives a generated tree golden (plan 14 D7). */
export type GoldenScenario = "list" | "options" | "open" | "leaf" | "choose";
export const GOLDEN_SCENARIOS: readonly GoldenScenario[] = [
  "list",
  "options",
  "open",
  "leaf",
  "choose",
];

/** Keys a golden's `input` may press: phone-core's PhoneKey names (no import: see above). */
export const INPUT_KEYS: readonly string[] = [
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
  "up",
  "down",
  "navi",
  "c",
  "power",
];

/**
 * One key of a game golden's `input` (plan 23): pressed after the frame of engine tick `tick`
 * (0 = the New game frame) and before tick `tick + 1`. Keys on one tick are pressed in order.
 */
export interface GoldenKeyPress {
  readonly tick: number;
  readonly key: string;
}

export interface GoldenImage {
  readonly name: string;
  /** LCD_WIDTH × LCD_HEIGHT, row-major, one byte per pixel: 1 = lit, 0 = clear. */
  readonly pixels: Uint8Array;
}

export interface GoldenOmission {
  readonly name: string;
  readonly reason: string;
}

export interface GoldenTimelineRow {
  readonly frame: number;
  readonly image: string;
  readonly startMs: number;
  readonly durationMs: number;
  /** The recording stopped during this frame, so `durationMs` is a lower bound (`+`). */
  readonly lowerBound: boolean;
  readonly lcd: LcdMode;
  readonly leds: number;
}

export interface Golden {
  readonly id: string;
  readonly status: GoldenStatus;
  readonly source: string;
  readonly sourceSha256: string;
  readonly triggerFrame?: TriggerFrame;
  readonly note?: string;
  /** Source frames deliberately left out, with the reason. Empty = `omitted: none`. */
  readonly omitted: readonly GoldenOmission[];
  /** Generated tree goldens: the generic scenario, with `covers`. Absent = hand-written scenario. */
  readonly scenario?: GoldenScenario;
  /** Tree node numbers (entries such as `1-8-1`, option choices such as `1-8-1-2`) this golden covers. */
  readonly covers?: readonly string[];
  /** Game goldens (plan 23): the keys pressed, by engine tick. Absent = no keys. */
  readonly input?: readonly GoldenKeyPress[];
  readonly images: readonly GoldenImage[];
  /** Present for timeline fixtures; absent for stills. */
  readonly timeline?: readonly GoldenTimelineRow[];
}

export class GoldenFormatError extends Error {
  readonly file: string;
  readonly line: number;

  constructor(file: string, line: number, message: string) {
    super(`${file}:${line}: ${message}`);
    this.name = "GoldenFormatError";
    this.file = file;
    this.line = line;
  }
}

/** A golden image's name. */
export const IMAGE_NAME = /^[a-z0-9-]+$/;
const ID = /^[a-z0-9][a-z0-9./-]*$/;
const STATUS = /^(asserted|pending:[a-z0-9-]+)$/;
const SHA256 = /^[0-9a-f]{64}$/;
const OMISSION = /^([^,()]+?) \(([^()]+)\)$/;
const INTEGER = /^(0|[1-9][0-9]*)$/;
const LCD_MODES: readonly LcdMode[] = ["normal", "inverse", "blank"];
const MENU_NUMBER = /^[1-9][0-9]*(-[1-9][0-9]*)*$/;

/** Timeline image names in first-appearance order: a, b, …, z, aa, ab, … */
export function timelineImageName(index: number): string {
  let name = "";
  let n = index;
  do {
    name = String.fromCharCode(97 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

export function findGoldenImage(golden: Golden, name: string): GoldenImage {
  const image = golden.images.find((candidate) => candidate.name === name);
  if (!image) throw new Error(`${golden.id}: no image "${name}"`);
  return image;
}

// ---------------------------------------------------------------- serialize

export function serializeGolden(golden: Golden): string {
  const out: string[] = [
    MAGIC,
    `id: ${golden.id}`,
    `status: ${golden.status}`,
    `source: ${golden.source}`,
    `source-sha256: ${golden.sourceSha256}`,
  ];
  if (golden.triggerFrame !== undefined) out.push(`trigger-frame: ${golden.triggerFrame}`);
  if (golden.note !== undefined) out.push(`note: ${golden.note}`);
  out.push(
    `omitted: ${
      golden.omitted.length === 0
        ? "none"
        : golden.omitted.map((o) => `${o.name} (${o.reason})`).join(", ")
    }`,
  );
  if (golden.scenario !== undefined || golden.covers !== undefined) {
    out.push(`scenario: ${golden.scenario ?? ""}`, `covers: ${(golden.covers ?? []).join(" ")}`);
  }
  if (golden.input !== undefined) {
    out.push(`input: ${golden.input.map((press) => `${press.tick}:${press.key}`).join(" ")}`);
  }
  out.push("");
  for (const image of golden.images) {
    out.push(`@image ${image.name}`, ...pixelsToRows(image.pixels), "");
  }
  if (golden.timeline) {
    out.push("@timeline", TIMELINE_HEADER);
    for (const row of golden.timeline) {
      const duration = `${row.durationMs}${row.lowerBound ? "+" : ""}`;
      out.push(
        String(row.frame).padEnd(7) +
          row.image.padEnd(6) +
          String(row.startMs).padEnd(9) +
          duration.padEnd(12) +
          row.lcd.padEnd(7) +
          String(row.leds),
      );
    }
    out.push("");
  }
  return out.join("\n");
}

export function pixelsToRows(pixels: Uint8Array): string[] {
  if (pixels.length !== LCD_WIDTH * LCD_HEIGHT) {
    throw new Error(`expected ${LCD_WIDTH * LCD_HEIGHT} pixels, got ${pixels.length}`);
  }
  const rows: string[] = [];
  for (let y = 0; y < LCD_HEIGHT; y++) {
    let row = "";
    for (let x = 0; x < LCD_WIDTH; x++) row += pixels[y * LCD_WIDTH + x] === 1 ? "#" : ".";
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------- parse

export function parseGolden(text: string, file: string): Golden {
  const lines = text.split("\n");
  let index = 0;
  const fail = (lineIndex: number, message: string): never => {
    throw new GoldenFormatError(file, lineIndex + 1, message);
  };
  const at = (i: number): string | undefined => lines[i];

  if (at(0) !== MAGIC) fail(0, `expected "${MAGIC}", got "${at(0) ?? ""}"`);
  index = 1;

  const header = (key: string, optional: boolean): { value: string; line: number } | undefined => {
    const line = at(index) ?? "";
    if (line.startsWith(`${key}: `)) {
      index++;
      return { value: line.slice(key.length + 2), line: index - 1 };
    }
    if (optional) return undefined;
    return fail(index, `expected header "${key}: …", got "${line}"`);
  };

  const id = header("id", false)!;
  if (!ID.test(id.value)) fail(id.line, `id must match ${ID.source}, got "${id.value}"`);
  const status = header("status", false)!;
  if (!STATUS.test(status.value)) {
    fail(status.line, `status must be "asserted" or "pending:<plan>", got "${status.value}"`);
  }
  const source = header("source", false)!;
  const sha = header("source-sha256", false)!;
  if (!SHA256.test(sha.value)) fail(sha.line, "source-sha256 must be 64 lowercase hex digits");
  const trigger = header("trigger-frame", true);
  let triggerFrame: TriggerFrame | undefined;
  if (trigger) {
    if (trigger.value === "before-recording") triggerFrame = "before-recording";
    else if (INTEGER.test(trigger.value)) triggerFrame = Number(trigger.value);
    else {
      fail(
        trigger.line,
        `trigger-frame must be an integer or "before-recording", got "${trigger.value}"`,
      );
    }
  }
  const note = header("note", true);
  const omittedLine = header("omitted", false)!;
  const omitted = parseOmitted(omittedLine.value);
  if (!omitted) fail(omittedLine.line, 'omitted must be "none" or a comma list of "name (reason)"');
  const scenarioLine = header("scenario", true);
  const coversLine = header("covers", true);
  if ((scenarioLine === undefined) !== (coversLine === undefined)) {
    fail(
      scenarioLine ? index : coversLine!.line,
      "scenario and covers must both be present or both absent",
    );
  }
  let scenario: GoldenScenario | undefined;
  let covers: string[] | undefined;
  if (scenarioLine && coversLine) {
    if (!GOLDEN_SCENARIOS.includes(scenarioLine.value as GoldenScenario)) {
      fail(
        scenarioLine.line,
        `scenario must be one of ${GOLDEN_SCENARIOS.join(", ")}, got "${scenarioLine.value}"`,
      );
    }
    scenario = scenarioLine.value as GoldenScenario;
    covers = coversLine.value.split(" ");
    if (!covers.every((number) => MENU_NUMBER.test(number))) {
      fail(
        coversLine.line,
        `covers must be a space-separated list of menu numbers such as 1-8-1, got "${coversLine.value}"`,
      );
    }
    const repeated = covers.find((number, i) => covers!.indexOf(number) !== i);
    if (repeated !== undefined) fail(coversLine.line, `covers lists "${repeated}" twice`);
  }
  const inputLine = header("input", true);
  const input = inputLine ? parseInput(inputLine.value, (m) => fail(inputLine.line, m)) : undefined;
  if (at(index) !== "") fail(index, `expected a blank line after the header, got "${at(index)}"`);
  index++;

  const images: GoldenImage[] = [];
  const imageLines = new Map<string, number>();
  let timeline: GoldenTimelineRow[] | undefined;
  let timelineLines: number[] = [];

  while (index < lines.length) {
    const line = lines[index]!;
    if (line === "") {
      index++;
      continue;
    }
    if (timeline) fail(index, `unexpected content after @timeline: "${line}"`);
    if (line.startsWith("@image ")) {
      const name = line.slice("@image ".length);
      if (!IMAGE_NAME.test(name)) fail(index, `image name must match [a-z0-9-]+, got "${name}"`);
      if (imageLines.has(name)) fail(index, `duplicate image "${name}"`);
      imageLines.set(name, index);
      index++;
      const pixels = new Uint8Array(LCD_WIDTH * LCD_HEIGHT);
      for (let y = 0; y < LCD_HEIGHT; y++, index++) {
        const row = at(index);
        if (row === undefined || row === "" || row.startsWith("@")) {
          fail(index, `image "${name}" has ${y} rows, expected ${LCD_HEIGHT}`);
        }
        if (row!.length !== LCD_WIDTH) {
          fail(index, `image "${name}" row ${y} has ${row!.length} columns, expected ${LCD_WIDTH}`);
        }
        for (let x = 0; x < LCD_WIDTH; x++) {
          const ch = row![x];
          if (ch === "#") pixels[y * LCD_WIDTH + x] = 1;
          else if (ch !== ".") {
            fail(index, `image "${name}" row ${y} column ${x}: expected '#' or '.', got '${ch}'`);
          }
        }
      }
      images.push({ name, pixels });
      continue;
    }
    if (line === "@timeline") {
      index++;
      if (at(index) !== TIMELINE_HEADER) {
        fail(index, `expected the timeline column header "${TIMELINE_HEADER}"`);
      }
      index++;
      timeline = [];
      timelineLines = [];
      while (index < lines.length && lines[index] !== "") {
        timeline.push(parseTimelineRow(lines[index]!, timeline.length, (m) => fail(index, m)));
        timelineLines.push(index);
        index++;
      }
      continue;
    }
    fail(index, `expected "@image <name>" or "@timeline", got "${line}"`);
  }

  if (images.length === 0) fail(index - 1, "a golden needs at least one @image");

  if (timeline) {
    if (timeline.length === 0) fail(index - 1, "@timeline has no frames");
    validateTimeline(timeline, timelineLines, images, imageLines, fail);
  }
  if (triggerFrame !== undefined) {
    if (!timeline) fail(trigger!.line, "trigger-frame requires a @timeline");
    if (typeof triggerFrame === "number" && triggerFrame >= timeline!.length) {
      fail(
        trigger!.line,
        `trigger-frame ${triggerFrame} is outside the timeline (${timeline!.length} frames)`,
      );
    }
  }

  return {
    id: id.value,
    status: status.value as GoldenStatus,
    source: source.value,
    sourceSha256: sha.value,
    ...(triggerFrame !== undefined ? { triggerFrame } : {}),
    ...(note ? { note: note.value } : {}),
    omitted: omitted!,
    ...(scenario !== undefined ? { scenario, covers: covers! } : {}),
    ...(input !== undefined ? { input } : {}),
    images,
    ...(timeline ? { timeline } : {}),
  };
}

const INPUT_PAIR = /^(0|[1-9][0-9]*):(\S+)$/;

function parseInput(value: string, fail: (message: string) => never): GoldenKeyPress[] {
  const out: GoldenKeyPress[] = [];
  for (const pair of value.split(" ")) {
    const match = INPUT_PAIR.exec(pair);
    if (!match) fail(`input must be space-separated <tick>:<key> pairs, got "${value}"`);
    const tick = Number(match![1]);
    const key = match![2]!;
    if (!INPUT_KEYS.includes(key)) {
      fail(`input key must be a phone key (0-9, *, #, up, down, navi, c, power), got "${key}"`);
    }
    const previous = out.at(-1);
    if (previous !== undefined && tick < previous.tick) {
      fail(`input ticks must ascend: ${tick} after ${previous.tick}`);
    }
    out.push({ tick, key });
  }
  return out;
}

function parseOmitted(value: string): GoldenOmission[] | undefined {
  if (value === "none") return [];
  const parts = value.split(/(?<=\)), /);
  const out: GoldenOmission[] = [];
  for (const part of parts) {
    const match = OMISSION.exec(part);
    if (!match) return undefined;
    out.push({ name: match[1]!, reason: match[2]! });
  }
  return out;
}

function parseTimelineRow(
  line: string,
  expectedFrame: number,
  fail: (message: string) => never,
): GoldenTimelineRow {
  const cells = line.trim().split(/\s+/);
  if (cells.length !== 6) fail(`expected 6 timeline columns, got ${cells.length}`);
  const [frameText, image, startText, durationText, lcd, ledsText] = cells as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  if (!INTEGER.test(frameText)) fail(`frame must be an integer, got "${frameText}"`);
  if (Number(frameText) !== expectedFrame)
    fail(`expected frame ${expectedFrame}, got ${frameText}`);
  if (!INTEGER.test(startText)) fail(`start_ms must be an integer, got "${startText}"`);
  const lowerBound = durationText.endsWith("+");
  const durationDigits = lowerBound ? durationText.slice(0, -1) : durationText;
  if (!INTEGER.test(durationDigits) || Number(durationDigits) === 0) {
    fail(`duration_ms must be a positive integer, optionally followed by +, got "${durationText}"`);
  }
  if (!LCD_MODES.includes(lcd as LcdMode)) {
    fail(`lcd must be normal, inverse or blank, got "${lcd}"`);
  }
  if (!/^[0-3]$/.test(ledsText)) fail(`leds must be 0-3, got "${ledsText}"`);
  return {
    frame: expectedFrame,
    image,
    startMs: Number(startText),
    durationMs: Number(durationDigits),
    lowerBound,
    lcd: lcd as LcdMode,
    leds: Number(ledsText),
  };
}

function validateTimeline(
  timeline: readonly GoldenTimelineRow[],
  rowLines: readonly number[],
  images: readonly GoldenImage[],
  imageLines: ReadonlyMap<string, number>,
  fail: (lineIndex: number, message: string) => never,
): void {
  const seen: string[] = [];
  timeline.forEach((row, i) => {
    const line = rowLines[i]!;
    if (!imageLines.has(row.image)) fail(line, `unknown image "${row.image}"`);
    if (!seen.includes(row.image)) {
      const expected = timelineImageName(seen.length);
      if (row.image !== expected) {
        fail(
          line,
          `frame ${row.frame} first shows image "${row.image}", expected "${expected}" (timeline images are named in first-appearance order)`,
        );
      }
      seen.push(row.image);
    }
    if (row.lowerBound && i !== timeline.length - 1) {
      fail(line, "only the last frame's duration may be a lower bound (+)");
    }
    if (i > 0) {
      const previous = timeline[i - 1]!;
      if (row.startMs <= previous.startMs) {
        fail(line, `start_ms ${row.startMs} is not after the previous start ${previous.startMs}`);
      }
      const expectedStart = previous.startMs + previous.durationMs;
      if (row.startMs !== expectedStart) {
        fail(
          line,
          `start_ms ${row.startMs} must equal the previous start + duration (${expectedStart})`,
        );
      }
    }
  });
  for (const image of images) {
    if (!seen.includes(image.name)) {
      fail(imageLines.get(image.name)!, `image "${image.name}" is not used by the timeline`);
    }
  }
}

// ---------------------------------------------------------------- tick fixtures (plan 23)

const TICK_MAGIC = "tick-golden 1";
const TICK_HEADER = "# level first_ms intervals_ms…";

/** One level's ticks: the first tick after the start frame, then each interval (ms). */
export interface TickRow {
  readonly level: number;
  readonly firstMs: number;
  readonly intervalsMs: readonly number[];
}

/** Timing-only fixture (`*.ticks.txt`): tick periods per level, no pixels (plan 23 D6). */
export interface TickGolden {
  readonly id: string;
  readonly status: GoldenStatus;
  readonly source: string;
  readonly sourceSha256: string;
  readonly note?: string;
  readonly rows: readonly TickRow[];
}

export function serializeTickGolden(golden: TickGolden): string {
  const out = [
    TICK_MAGIC,
    `id: ${golden.id}`,
    `status: ${golden.status}`,
    `source: ${golden.source}`,
    `source-sha256: ${golden.sourceSha256}`,
  ];
  if (golden.note !== undefined) out.push(`note: ${golden.note}`);
  out.push("", "@ticks", TICK_HEADER);
  for (const row of golden.rows) {
    out.push(`${String(row.level).padEnd(6)}${[row.firstMs, ...row.intervalsMs].join(" ")}`);
  }
  out.push("");
  return out.join("\n");
}

export function parseTickGolden(text: string, file: string): TickGolden {
  const lines = text.split("\n");
  let index = 0;
  const fail = (lineIndex: number, message: string): never => {
    throw new GoldenFormatError(file, lineIndex + 1, message);
  };
  if (lines[0] !== TICK_MAGIC) fail(0, `expected "${TICK_MAGIC}", got "${lines[0] ?? ""}"`);
  index = 1;
  const header = (key: string, optional: boolean): { value: string; line: number } | undefined => {
    const line = lines[index] ?? "";
    if (line.startsWith(`${key}: `)) {
      index++;
      return { value: line.slice(key.length + 2), line: index - 1 };
    }
    if (optional) return undefined;
    return fail(index, `expected header "${key}: …", got "${line}"`);
  };
  const id = header("id", false)!;
  if (!ID.test(id.value)) fail(id.line, `id must match ${ID.source}, got "${id.value}"`);
  const status = header("status", false)!;
  if (!STATUS.test(status.value)) {
    fail(status.line, `status must be "asserted" or "pending:<plan>", got "${status.value}"`);
  }
  const source = header("source", false)!;
  const sha = header("source-sha256", false)!;
  if (!SHA256.test(sha.value)) fail(sha.line, "source-sha256 must be 64 lowercase hex digits");
  const note = header("note", true);
  if (lines[index] !== "")
    fail(index, `expected a blank line after the header, got "${lines[index]}"`);
  index++;
  if (lines[index] !== "@ticks") fail(index, 'expected "@ticks"');
  index++;
  if (lines[index] !== TICK_HEADER) fail(index, `expected the column header "${TICK_HEADER}"`);
  index++;
  const rows: TickRow[] = [];
  for (; index < lines.length && lines[index] !== ""; index++) {
    const cells = lines[index]!.trim().split(/\s+/);
    const bad = cells.find((cell) => !INTEGER.test(cell));
    if (bad !== undefined) fail(index, `expected integers, got "${bad}"`);
    const [level, first, ...intervals] = cells.map(Number) as [number, number, ...number[]];
    const previous = rows.at(-1);
    if (previous !== undefined && level <= previous.level) {
      fail(index, `levels must ascend: ${level} after ${previous.level}`);
    }
    if (first === undefined || intervals.length < 2) {
      fail(index, "a level needs a first tick and at least two intervals");
    }
    rows.push({ level, firstMs: first, intervalsMs: intervals });
  }
  if (rows.length === 0) fail(index, "@ticks has no rows");
  if (lines.slice(index).some((line) => line !== ""))
    fail(index, "unexpected content after @ticks");
  return {
    id: id.value,
    status: status.value as GoldenStatus,
    source: source.value,
    sourceSha256: sha.value,
    ...(note ? { note: note.value } : {}),
    rows,
  };
}
