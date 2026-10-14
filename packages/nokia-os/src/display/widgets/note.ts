import { Framebuffer, textWidth } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES, type WidgetFrame } from "../../resources";
import { paintStandby } from "../standby";

/** Note text: the large face from x 0, one line per firmware line (`tree/01-phone-book/1-2.leaf`). */
const LINE_TOPS = [3, 18, 33] as const;
const LCD_WIDTH = 84;
/** LCD bytes are 8-row pages written column by column (the `cut` partial draw). */
const PAGE_ROWS = 8;

/** A timed or static note (plan 14 widget catalogue). */
export interface NoteModel {
  readonly kind: "note";
  readonly lines: readonly string[];
  /** The timeline step shown; absent = text only (a static note). */
  readonly frame?: WidgetFrame;
  /** The step after a `cut` frame: what the partial draw is drawing. */
  readonly next?: WidgetFrame;
}

function sprite(id: string) {
  const found = WIDGET_SPRITES[id];
  if (found === undefined) throw new Error(`No stock widget sprite "${id}".`);
  return found;
}

/**
 * The note's own screen for one timeline frame: its lines, plus the frame's sprite (the tick
 * steps, `!`, octagon, Top score's animation). `blank` shows nothing, `image` a captured screen
 * kept whole (the `Opening` before the Inbox note).
 */
function paintNoteScreen(fb: Framebuffer, lines: readonly string[], frame?: WidgetFrame): void {
  if (frame?.kind === "blank") return;
  if (frame?.kind === "image") {
    const { bitmap, x, y } = sprite(frame.sprite);
    fb.blitBitmap(bitmap, x, y);
    return;
  }
  if (lines.length > LINE_TOPS.length) {
    throw new Error(`Note ${JSON.stringify(lines)} has ${lines.length} lines; a note holds 3.`);
  }
  lines.forEach((line, i) => fb.drawText(STOCK_FONTS.large, line, 0, LINE_TOPS[i]!));
  if (frame?.kind === "sprite") {
    const { bitmap, x, y } = sprite(frame.sprite);
    fb.blitBitmap(bitmap, x, y);
  } else if (frame !== undefined) {
    throw new Error(`A note cannot show a "${frame.kind}" frame.`);
  }
}

/**
 * The firmware's partial draws, from the screen shown before (`previous`) toward `target`:
 * `cut` writes the target's first `bytes` LCD bytes over the previous screen (the 15 ms draw
 * before `Done` after Type of view); `edges` shows `target` outside columns x0..x1 and the
 * previous screen inside (the 8-9 ms draw before standby).
 */
export function paintPartial(
  fb: Framebuffer,
  frame: Extract<WidgetFrame, { kind: "cut" | "edges" }>,
  previous: Uint8Array | undefined,
  target: Framebuffer,
): void {
  if (previous !== undefined) fb.pixels.set(previous);
  if (frame.kind === "cut") {
    for (let byte = 0; byte < frame.bytes; byte++) {
      const x = byte % fb.width;
      const top = Math.floor(byte / fb.width) * PAGE_ROWS;
      for (let y = top; y < top + PAGE_ROWS; y++) fb.setPixel(x, y, target.getPixel(x, y));
    }
    return;
  }
  for (let y = 0; y < fb.height; y++) {
    for (let x = 0; x < fb.width; x++) {
      if (x < frame.x0 || x > frame.x1) fb.setPixel(x, y, target.getPixel(x, y));
    }
  }
}

/**
 * Standby as a widget's partial draw sees it: the ladders and icons at the screen's edges (the
 * kernel always reports full signal and battery; the operator and clock lie inside x 5..78).
 */
function standbyEdges(): Framebuffer {
  const fb = new Framebuffer();
  paintStandby(fb, { kind: "standby", carrier: "", signal: 4, battery: 4 });
  return fb;
}

/**
 * A note: large text lines from x 0 at tops 3/18/33 and the icon of its timeline step, or a
 * partial draw over the previous screen (toward the next step, or toward standby for `edges`).
 */
export function paintNote(fb: Framebuffer, model: NoteModel, previous?: Uint8Array): void {
  const { frame, lines } = model;
  if (frame?.kind === "cut" || frame?.kind === "edges") {
    const target = frame.kind === "edges" ? standbyEdges() : new Framebuffer();
    if (frame.kind === "cut") paintNoteScreen(target, lines, model.next);
    paintPartial(fb, frame, previous, target);
    return;
  }
  paintNoteScreen(fb, lines, frame);
}

/**
 * The welcome note at power-on (plan 15 W): the large face from x 1, lines at tops 7 and 22
 * (`boot/welcome-note`, `-long`). A third line at top 37 is UNVERIFIED (the editor takes 36
 * characters; no capture needs three lines).
 */
const WELCOME_X = 1;
const WELCOME_TOPS = [7, 22, 37] as const;

export interface WelcomeNoteModel {
  readonly kind: "welcome-note";
  /** The stored note as typed. */
  readonly text: string;
}

/**
 * The note's lines: words fill a line while they fit and wrap at the space (`Welcome to` /
 * `my phone`, `boot/welcome-note-long`). Characters the large face lacks are left out: the note
 * is user text, so the boot never throws on it (missingStockGlyphs reports them). A word wider
 * than a line breaks where it stops fitting (UNVERIFIED), and lines past the third are dropped.
 */
export function welcomeNoteLines(text: string): string[] {
  const font = STOCK_FONTS.large;
  const width = LCD_WIDTH - WELCOME_X;
  let drawable = "";
  for (const ch of text) if (ch === " " || font.glyphs.has(ch)) drawable += ch;
  const lines: string[] = [];
  let line = "";
  const fits = (candidate: string) => textWidth(font, candidate) <= width;
  for (const word of drawable.split(" ").filter((w) => w.length > 0)) {
    const joined = line === "" ? word : `${line} ${word}`;
    if (fits(joined)) {
      line = joined;
      continue;
    }
    if (line !== "") lines.push(line);
    line = "";
    for (const ch of word) {
      if (line !== "" && !fits(line + ch)) {
        lines.push(line);
        line = "";
      }
      line += ch;
    }
  }
  if (line !== "") lines.push(line);
  return lines.slice(0, WELCOME_TOPS.length);
}

export function paintWelcomeNote(fb: Framebuffer, model: WelcomeNoteModel): void {
  welcomeNoteLines(model.text).forEach((line, i) =>
    fb.drawText(STOCK_FONTS.large, line, WELCOME_X, WELCOME_TOPS[i]!),
  );
}
