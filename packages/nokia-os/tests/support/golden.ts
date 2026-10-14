// Pixel and timing assertions against LCD goldens, with failure output designed for reading
// in a terminal. See docs/plans/13-nokia-os-foundation.md "Diff helper output".
import {
  findGoldenImage,
  LCD_HEIGHT,
  LCD_WIDTH,
  type Golden,
  type GoldenImage,
} from "../../scripts/golden-format.ts";

/** Allowed difference between a frame's aligned golden start and its actual start (D9). */
export const TIMING_TOLERANCE_MS = 2;

const LEGEND =
  "legend: '#' ink in both  '.' clear in both  '+' ink only in actual  '-' ink only in golden";
const WINDOW_PAD = 4;
const MAX_WINDOW_WIDTH = 48;

/** Anything with an 84×48 one-byte-per-pixel buffer, e.g. phone-screen's Framebuffer. */
export interface LcdFrame {
  readonly pixels: Uint8Array;
}

export interface GoldenImageRef {
  readonly id: string;
  readonly image: GoldenImage;
}

export interface RecordedFrame {
  readonly startMs: number;
  readonly pixels: Uint8Array;
}

/** Distinct frames shown while recording, like the capture harness's `record`. */
export interface RecordedTimeline {
  /** When the scenario's trigger (key press, power-on) happened. */
  readonly triggerMs: number;
  /** When recording stopped; bounds how long the last frame was held. */
  readonly endMs: number;
  readonly frames: readonly RecordedFrame[];
}

export function expectLcd(actual: LcdFrame, golden: GoldenImageRef, context: string): void {
  const message = lcdMismatch(actual.pixels, golden, context);
  if (message !== undefined) throw new Error(message);
}

/** The failure text for `actual` against `golden`, or undefined when every pixel matches. */
export function lcdMismatch(
  actual: Uint8Array,
  golden: GoldenImageRef,
  context: string,
): string | undefined {
  const expected = golden.image.pixels;
  let extra = 0;
  let missing = 0;
  let first: { x: number; y: number } | undefined;
  let minX = LCD_WIDTH;
  let maxX = -1;
  let minY = LCD_HEIGHT;
  let maxY = -1;
  for (let y = 0; y < LCD_HEIGHT; y++) {
    for (let x = 0; x < LCD_WIDTH; x++) {
      const a = actual[y * LCD_WIDTH + x] === 1;
      const g = expected[y * LCD_WIDTH + x] === 1;
      if (a === g) continue;
      if (a) extra++;
      else missing++;
      first ??= { x, y };
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (!first) return undefined;

  const cell = (x: number, y: number): string => {
    const a = actual[y * LCD_WIDTH + x] === 1;
    const g = expected[y * LCD_WIDTH + x] === 1;
    if (a && g) return "#";
    if (a) return "+";
    if (g) return "-";
    return ".";
  };
  const out = [
    `LCD mismatch: ${golden.id} image "${golden.image.name}"`,
    `scenario: ${context}`,
    `${extra + missing} px differ (${extra} extra, ${missing} missing); first at (x=${first.x}, y=${first.y}); differences in x=${minX}..${maxX}, y=${minY}..${maxY}`,
    LEGEND,
    "",
  ];

  if (process.env.LCD_DIFF === "full") {
    out.push("full frame: golden | actual | diff");
    for (let y = 0; y < LCD_HEIGHT; y++) {
      let g = "";
      let a = "";
      let d = "";
      for (let x = 0; x < LCD_WIDTH; x++) {
        g += expected[y * LCD_WIDTH + x] === 1 ? "#" : ".";
        a += actual[y * LCD_WIDTH + x] === 1 ? "#" : ".";
        d += cell(x, y);
      }
      out.push(`${String(y).padStart(2)}  ${g} | ${a} | ${d}`);
    }
    return out.join("\n");
  }

  let x0 = Math.max(0, minX - WINDOW_PAD);
  let x1 = Math.min(LCD_WIDTH - 1, maxX + WINDOW_PAD);
  if (x1 - x0 + 1 > MAX_WINDOW_WIDTH) {
    x0 = 0;
    x1 = LCD_WIDTH - 1;
  }
  const y0 = Math.max(0, minY - WINDOW_PAD);
  const y1 = Math.min(LCD_HEIGHT - 1, maxY + WINDOW_PAD);
  const gutter = " ".repeat(10);
  let tens = "";
  let units = "";
  for (let x = x0; x <= x1; x++) {
    tens += x === x0 || x % 10 === 0 ? String(Math.floor(x / 10)) : " ";
    units += String(x % 10);
  }
  out.push(gutter + tens.trimEnd(), gutter + units);
  for (let y = y0; y <= y1; y++) {
    let row = "";
    for (let x = x0; x <= x1; x++) row += cell(x, y);
    out.push(`${String(y).padStart(6)}    ${row}`);
  }
  out.push(
    `window x=${x0}..${x1}, y=${y0}..${y1} of ${LCD_WIDTH}x${LCD_HEIGHT}; set LCD_DIFF=full to print golden | actual | diff side by side`,
  );
  return out.join("\n");
}

const TABLE_HEADER = " frame image  golden start  actual start       Δ  pixels";

const ms = (value: number): string => value.toFixed(1);
const signed = (value: number): string => (value > 0 ? `+${ms(value)}` : ms(value));

/**
 * Compare a recording with a timeline golden after aligning on the transition (D9): with
 * `trigger-frame: N` the recording's trigger is matched to golden frame N's start; with
 * `before-recording` the first change (frame 1) is matched and frame 0's duration is not compared.
 */
export function expectTimeline(recorded: RecordedTimeline, golden: Golden, context: string): void {
  const rows = golden.timeline;
  if (!rows || golden.triggerFrame === undefined) {
    throw new Error(`${golden.id} is not a timeline golden with a trigger-frame`);
  }
  const beforeRecording = golden.triggerFrame === "before-recording";
  const firstRow = beforeRecording ? 0 : (golden.triggerFrame as number);
  const alignRow = beforeRecording ? 1 : firstRow;
  const actual = beforeRecording
    ? recorded.frames
    : recorded.frames.filter((frame) => frame.startMs >= recorded.triggerMs);
  const goldenOrigin = rows[Math.min(alignRow, rows.length - 1)]!.startMs;
  const actualOrigin = beforeRecording
    ? (recorded.frames[1]?.startMs ?? recorded.frames[0]?.startMs ?? 0)
    : recorded.triggerMs;

  const lines = [TABLE_HEADER];
  let failed = false;
  let firstPixelFailure: string | undefined;
  for (let i = firstRow; i < rows.length; i++) {
    const row = rows[i]!;
    const frame = actual[i - firstRow];
    const goldenStart = row.startMs - goldenOrigin;
    const prefix = `${String(row.frame).padStart(6)} ${row.image.padEnd(5)}${ms(goldenStart).padStart(14)}`;
    if (!frame) {
      failed = true;
      lines.push(
        `${prefix}${"-".padStart(14)}${"-".padStart(8)}  ${"missing".padEnd(7)}  ✗ never shown`,
      );
      continue;
    }
    const actualStart = frame.startMs - actualOrigin;
    const marks: string[] = [];
    const timed = !(beforeRecording && i === 0);
    const delta = actualStart - goldenStart;
    if (timed && Math.abs(delta) > TIMING_TOLERANCE_MS) marks.push("✗ timing");
    const image = findGoldenImage(golden, row.image);
    const mismatch = lcdMismatch(
      frame.pixels,
      { id: golden.id, image },
      `${context}; timeline frame ${row.frame}`,
    );
    if (mismatch !== undefined) {
      marks.push("✗ pixels");
      firstPixelFailure ??= mismatch;
    }
    if (marks.length > 0) failed = true;
    const cells =
      `${prefix}${ms(actualStart).padStart(14)}${(timed ? signed(delta) : "n/a").padStart(8)}  ` +
      `${(mismatch === undefined ? "ok" : "differ").padEnd(7)}  ${marks.join("  ")}`;
    lines.push(cells.trimEnd());
  }

  const last = lastFrameCheck(recorded, actual, rows, firstRow);
  if (!last.ok) failed = true;
  lines.push(` last: ${last.text}  ${last.ok ? "ok" : "✗"}`);

  if (!failed) return;
  const alignment = beforeRecording
    ? "golden frame 1 = first change"
    : `golden frame ${firstRow} = trigger`;
  const out = [
    `Timeline mismatch: ${golden.id} (aligned: ${alignment}; tolerance ±${TIMING_TOLERANCE_MS} ms)`,
    `scenario: ${context}`,
    ...lines,
  ];
  if (firstPixelFailure !== undefined) out.push("", firstPixelFailure);
  throw new Error(out.join("\n"));
}

function lastFrameCheck(
  recorded: RecordedTimeline,
  actual: readonly RecordedFrame[],
  rows: NonNullable<Golden["timeline"]>,
  firstRow: number,
): { text: string; ok: boolean } {
  const lastRow = rows[rows.length - 1]!;
  const index = rows.length - 1 - firstRow;
  const frame = actual[index];
  if (!frame) return { text: "not reached", ok: false };
  const holds = `golden holds ${lastRow.lowerBound ? "≥ " : ""}${lastRow.durationMs} ms`;
  const next = actual[index + 1];
  if (next) {
    const held = next.startMs - frame.startMs;
    const ok = lastRow.lowerBound
      ? held >= lastRow.durationMs - TIMING_TOLERANCE_MS
      : Math.abs(held - lastRow.durationMs) <= TIMING_TOLERANCE_MS;
    return { text: `${holds}; actual changed after ${held} ms`, ok };
  }
  const held = recorded.endMs - frame.startMs;
  // Without a change, an exact duration can never be confirmed; a lower bound needs the
  // recording to run at least that long.
  const ok = lastRow.lowerBound && held >= lastRow.durationMs - TIMING_TOLERANCE_MS;
  return { text: `${holds}; actual held ≥ ${held} ms`, ok };
}
