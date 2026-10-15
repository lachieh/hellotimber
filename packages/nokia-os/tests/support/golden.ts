// Pixel and timing assertions against LCD goldens, with failure output designed for reading
// in a terminal. See docs/plans/13-nokia-os-foundation.md "Diff helper output".
import {
  findGoldenImage,
  LCD_HEIGHT,
  LCD_WIDTH,
  type Golden,
  type GoldenImage,
} from "../../scripts/golden-format.ts";

// ---------------------------------------------------------------- the fidelity standard
//
// Golden comparisons follow AGENTS.md "Fidelity standard": what a person can perceive. Pixels of
// every settled frame are exact. Timing is measured from a reference (the trigger, or the event a
// check names): an instant `t` ms after it matches within `timingToleranceMs(t)`, one display
// frame (FRAME_MS) for animation steps, growing as 5 % of `t` to LONG_TOLERANCE_MS for holds of
// about a second or longer and the drift of long timelines. A frame shown for less than FRAME_MS,
// in the golden or the recording, is a partial redraw: neither required nor forbidden, as long as
// the frames around it match.

/** One display frame at 60 Hz: the smallest timing difference, and the shortest frame, that counts. */
export const FRAME_MS = 17;
/** The tolerance of an instant a second or more after its reference. */
export const LONG_TOLERANCE_MS = 50;

/**
 * How far an instant `elapsedMs` (the golden's) after its reference may move: 5 % of the elapsed
 * time, at least FRAME_MS (up to 340 ms) and at most LONG_TOLERANCE_MS (from 1000 ms).
 */
export function timingToleranceMs(elapsedMs: number): number {
  return Math.min(LONG_TOLERANCE_MS, Math.max(FRAME_MS, Math.abs(elapsedMs) / 20));
}

/** Whether `actualMs` matches the golden's `goldenMs`, both measured from the same reference. */
export function sameTime(actualMs: number, goldenMs: number): boolean {
  return Math.abs(actualMs - goldenMs) <= timingToleranceMs(goldenMs);
}

/** A frame of a timeline: when it starts and what it shows. */
export interface ShownFrame {
  readonly startMs: number;
  readonly pixels: Uint8Array;
}

/**
 * A golden timeline and a recording (each frame shown until the next one starts, the last until
 * its side's end) without their partial draws: an inner frame shown for less than FRAME_MS is
 * left out unless the other side shows the same picture (`same`), where it pairs with it. After
 * frames left out, one that repeats the frame before them continues it. The first and the last
 * frame of each side always stay.
 */
export function withoutPartialDraws<G extends ShownFrame, A extends ShownFrame>(
  golden: { readonly frames: readonly G[]; readonly endMs: number },
  actual: { readonly frames: readonly A[]; readonly endMs: number },
  same: (golden: Uint8Array, actual: Uint8Array) => boolean = samePixels,
): { golden: G[]; actual: A[] } {
  const settle = <T extends ShownFrame>(
    side: { readonly frames: readonly T[]; readonly endMs: number },
    shownElsewhere: (frame: T) => boolean,
  ): T[] => {
    const out: T[] = [];
    let dropped = false;
    side.frames.forEach((frame, i) => {
      const next = side.frames[i + 1];
      const shownMs = (next?.startMs ?? side.endMs) - frame.startMs;
      if (i > 0 && next !== undefined && shownMs < FRAME_MS && !shownElsewhere(frame)) {
        dropped = true;
        return;
      }
      // Only frames left out between them make two equal frames one: a recording's power-on
      // starts a frame as blank as the one before it.
      if (!(dropped && out.length > 0 && samePixels(out.at(-1)!.pixels, frame.pixels))) {
        out.push(frame);
      }
      dropped = false;
    });
    return out;
  };
  return {
    golden: settle(golden, (g) => actual.frames.some((a) => same(g.pixels, a.pixels))),
    actual: settle(actual, (a) => golden.frames.some((g) => same(g.pixels, a.pixels))),
  };
}

/** Whether two LCD buffers show the same pixels. */
export function samePixels(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** How `expectTimeline` compares frame starts beyond the fidelity standard. */
export interface TimelineTolerance {
  /**
   * Golden rows whose start is not compared: the first redraw after a key pressed ahead of it,
   * whose key-to-redraw latency is not reproduced (plan 14 D8). Their pixels still must match.
   */
  readonly untimedRows?: ReadonlySet<number>;
}

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
 * Compare a recording with a timeline golden after aligning on the transition (plan 13 D9): with
 * `trigger-frame: N` the recording's trigger is matched to golden frame N's start; with
 * `before-recording` the first change (frame 1) is matched and frame 0's duration is not compared.
 * Frame starts and the last frame's end follow the fidelity standard (`timingToleranceMs` from the
 * alignment); partial draws under FRAME_MS on either side are left out (`withoutPartialDraws`).
 */
export function expectTimeline(
  recorded: RecordedTimeline,
  golden: Golden,
  context: string,
  { untimedRows = new Set() }: TimelineTolerance = {},
): void {
  const timeline = golden.timeline;
  if (!timeline || golden.triggerFrame === undefined) {
    throw new Error(`${golden.id} is not a timeline golden with a trigger-frame`);
  }
  const beforeRecording = golden.triggerFrame === "before-recording";
  const firstRow = beforeRecording ? 0 : (golden.triggerFrame as number);
  const alignRow = beforeRecording ? 1 : firstRow;
  const goldenOrigin = timeline[Math.min(alignRow, timeline.length - 1)]!.startMs;
  const lastRow = timeline[timeline.length - 1]!;
  const goldenEnd = lastRow.startMs + lastRow.durationMs - goldenOrigin;
  const actualOrigin = beforeRecording
    ? (recorded.frames[1]?.startMs ?? recorded.frames[0]?.startMs ?? 0)
    : recorded.triggerMs;
  // From the frame before the trigger on both sides, so that a partial draw at the trigger is
  // an inner frame too.
  const fromRow = Math.max(0, firstRow - 1);
  const lead =
    beforeRecording || firstRow === 0
      ? undefined
      : recorded.frames.filter((frame) => frame.startMs < recorded.triggerMs).at(-1);
  const settled = withoutPartialDraws(
    {
      frames: timeline.slice(fromRow).map((row, i) => ({
        ...row,
        index: fromRow + i,
        startMs: row.startMs - goldenOrigin,
        pixels: findGoldenImage(golden, row.image).pixels,
      })),
      endMs: goldenEnd,
    },
    {
      frames: beforeRecording
        ? recorded.frames
        : [
            ...(lead === undefined ? [] : [lead]),
            ...recorded.frames.filter((frame) => frame.startMs >= recorded.triggerMs),
          ],
      endMs: recorded.endMs,
    },
  );
  const rows = settled.golden.filter((row) => row.index >= firstRow);
  const actual = settled.actual.slice(lead === undefined ? 0 : 1);

  const lines = [TABLE_HEADER];
  let failed = false;
  let firstPixelFailure: string | undefined;
  rows.forEach((row, i) => {
    const frame = actual[i];
    const prefix = `${String(row.frame).padStart(6)} ${row.image.padEnd(5)}${ms(row.startMs).padStart(14)}`;
    if (!frame) {
      failed = true;
      lines.push(
        `${prefix}${"-".padStart(14)}${"-".padStart(8)}  ${"missing".padEnd(7)}  ✗ never shown`,
      );
      return;
    }
    const actualStart = frame.startMs - actualOrigin;
    const marks: string[] = [];
    const timed = !(beforeRecording && row.index === 0) && !untimedRows.has(row.index);
    const delta = actualStart - row.startMs;
    if (timed && !sameTime(actualStart, row.startMs)) marks.push("✗ timing");
    const mismatch = lcdMismatch(
      frame.pixels,
      { id: golden.id, image: findGoldenImage(golden, row.image) },
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
  });

  const last = lastFrameCheck(recorded, actual, rows.length - 1, actualOrigin, {
    endMs: goldenEnd,
    lowerBound: lastRow.lowerBound,
  });
  if (!last.ok) failed = true;
  lines.push(` last: ${last.text}  ${last.ok ? "ok" : "✗"}`);

  if (!failed) return;
  const alignment = beforeRecording
    ? "golden frame 1 = first change"
    : `golden frame ${firstRow} = trigger`;
  const out = [
    `Timeline mismatch: ${golden.id} (aligned: ${alignment}; fidelity standard)`,
    `scenario: ${context}`,
    ...lines,
  ];
  if (firstPixelFailure !== undefined) out.push("", firstPixelFailure);
  throw new Error(out.join("\n"));
}

/**
 * Whether the last golden frame ends as the golden's does (`endMs` from the alignment): when the
 * recording changes next, within the fidelity standard (a lower bound: not earlier); when it
 * does not, a lower bound needs the recording to run that long and an exact end is unconfirmed.
 */
function lastFrameCheck(
  recorded: RecordedTimeline,
  actual: readonly RecordedFrame[],
  index: number,
  actualOrigin: number,
  golden: { readonly endMs: number; readonly lowerBound: boolean },
): { text: string; ok: boolean } {
  const frame = actual[index];
  if (!frame) return { text: "not reached", ok: false };
  const ends = `golden ends ${golden.lowerBound ? "≥ " : ""}${ms(golden.endMs)} ms`;
  const tolerance = timingToleranceMs(golden.endMs);
  const next = actual[index + 1];
  if (next) {
    const end = next.startMs - actualOrigin;
    const ok = golden.lowerBound
      ? end >= golden.endMs - tolerance
      : Math.abs(end - golden.endMs) <= tolerance;
    return { text: `${ends}; actual changed at ${ms(end)} ms`, ok };
  }
  const end = recorded.endMs - actualOrigin;
  const ok = golden.lowerBound && end >= golden.endMs - tolerance;
  return { text: `${ends}; actual held to ≥ ${ms(end)} ms`, ok };
}
