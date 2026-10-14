// Plan 18's timings (docs/plans/18-messages-and-chat.md D5, D10): the multi-tap commit, the
// cursor blink, held keys, and the SMS link times, measured on the plan 18 goldens. Times are
// from the trigger frame (the key's first redraw, plan 14 D8) unless a key's hold is measured:
// holds count from the key going down, which is when the recording starts.
//
// Pure: reads goldens only through the injected loader (extract-resources.ts and the tests).
import { findGoldenImage, LCD_WIDTH, type Golden } from "./golden-format.ts";

export interface TextTimingData {
  /** A pending character commits this long after its first redraw (`text/commit`). */
  readonly commitMs: number;
  /** The cursor shows and hides for this long each (`text/blink`). */
  readonly blinkMs: number;
  /** Held C clears the text this long after its first deletion's redraw (`text/delete-hold`). */
  readonly clearAfterDeleteMs: number;
  /** Held # enters 123 (and leaves it) this long after the key goes down (`text/hold-hash`). */
  readonly numberModeHoldMs: number;
  /**
   * A digit key held at least this long (from key-down) inserts its digit instead of the
   * pending letter when the letter commits: 1450 ms keeps the letter, 1475 ms gives the digit
   * (`text/hold-threshold-1450`, `text/hold-threshold-1475`); the bracket is the captured one.
   */
  readonly digitHoldMs: number;
}

export interface MessageTimingData {
  /**
   * `Sending message` lasts this long at least (`sms/send`, the median of Task 0's five sends:
   * 2646.4, 2790.4, 2662.4, 2574.3 and 2754.4 ms; D10). The host may take longer.
   */
  readonly sendLinkMs: number;
  /**
   * An SMS delivered at standby is received this long later (`sms/arrive-1`..`-5`: 2425.4,
   * 2281.3, 2141.3, 2464.4 and 2324.3 ms; their median, D10).
   */
  readonly receiveLinkMs: number;
  /** `Saving message` shows its bar this long before `Message saved` (`sms/save`). */
  readonly savingMs: number;
}

export interface MessagesResourceData {
  readonly text: TextTimingData;
  readonly messages: MessageTimingData;
}

/** The captured hold bracket of a held digit (D5). */
export const DIGIT_HOLD_MS = 1475;

function trigger(golden: Golden): number {
  if (!golden.timeline || typeof golden.triggerFrame !== "number") {
    throw new Error(`${golden.id}: not a triggered timeline`);
  }
  return golden.triggerFrame;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Columns with ink in rows y0..y1. */
function inkColumns(pixels: Uint8Array, y0: number, y1: number): number {
  let columns = 0;
  for (let x = 0; x < LCD_WIDTH; x++) {
    for (let y = y0; y <= y1; y++) {
      if (pixels[y * LCD_WIDTH + x] === 1) {
        columns++;
        break;
      }
    }
  }
  return columns;
}

function region(pixels: Uint8Array, x0: number, x1: number, y0: number, y1: number): string {
  let out = "";
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out += pixels[y * LCD_WIDTH + x];
  return out;
}

/** The first frame from `from` on whose image satisfies `test`. */
function firstFrame(golden: Golden, from: number, test: (pixels: Uint8Array) => boolean): number {
  const rows = golden.timeline!;
  for (let i = from; i < rows.length; i++) {
    if (test(findGoldenImage(golden, rows[i]!.image).pixels)) return i;
  }
  throw new Error(`${golden.id}: no frame after ${from} shows what was measured`);
}

/** The multi-tap and SMS timings, from the plan 18 goldens. */
export function extractMessagesResources(load: (id: string) => Golden): MessagesResourceData {
  const commit = load("text/commit");
  const commitMs = commit.timeline![trigger(commit)]!.durationMs;

  const blink = load("text/blink");
  const blinkMs = median(
    blink
      .timeline!.slice(trigger(blink))
      .filter((row) => !row.lowerBound)
      .map((row) => row.durationMs),
  );

  // Held C on Hello: the first deletion (trigger), then the text line holds only the cursor.
  const hold = load("text/delete-hold");
  const deleted = trigger(hold);
  const cleared = firstFrame(hold, deleted + 1, (pixels) => inkColumns(pixels, 8, 15) <= 1);
  const rows = hold.timeline!;
  const clearAfterDeleteMs = rows[cleared]!.startMs - rows[deleted]!.startMs;

  // Held # in the empty editor: the header's mode text changes to 123.
  const hash = load("text/hold-hash");
  const mode = (pixels: Uint8Array): string => region(pixels, 12, 45, 0, 5);
  const before = mode(findGoldenImage(hash, hash.timeline![0]!.image).pixels);
  const numberMode = firstFrame(hash, 1, (pixels) => mode(pixels) !== before);
  const numberModeHoldMs = hash.timeline![numberMode]!.startMs;

  // Sending message: the bar from the trigger until the first frame without it.
  const send = load("sms/send");
  const bar = (pixels: Uint8Array): boolean =>
    region(pixels, 0, 83, 7, 7) === "1".repeat(LCD_WIDTH);
  const sent = firstFrame(send, trigger(send), (pixels) => !bar(pixels));
  const sendLinkMs = send.timeline![sent]!.startMs - send.timeline![trigger(send)]!.startMs;

  // Arrivals: injected when each recording starts; the notice is the trigger frame.
  const receiveLinkMs = median(
    [1, 2, 3, 4, 5].map((n) => {
      const arrive = load(`sms/arrive-${n}`);
      return arrive.timeline![trigger(arrive)]!.startMs;
    }),
  );

  // Save: the bar's frame of `Saving message`, then the note.
  const save = load("sms/save");
  const saving = firstFrame(save, trigger(save), bar);
  const savingMs = save.timeline![saving]!.durationMs;

  return {
    text: { commitMs, blinkMs, clearAfterDeleteMs, numberModeHoldMs, digitHoldMs: DIGIT_HOLD_MS },
    messages: { sendLinkMs, receiveLinkMs, savingMs },
  };
}
