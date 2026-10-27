// The telephone's screens (plan 22; docs/specs/stock/calls.md): standby number entry, Calling,
// the call screen, the ringing screen and the in-call Volume. Each draws over standby's frame: the
// signal and battery ladders and the clock (the ringing screen has no clock, Volume no frame).
import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STATUS_SPRITES, STOCK_FONTS, WIDGET_SPRITES, type StockSprite } from "../../resources";
import { SOFTKEY_TOP } from "../standby";

/** The clock's last digit cell ends here (as standby's). */
const CLOCK_END = 78;

/** The entry's characters end here: the large face's rightmost cell from x 69 (`entry/length/01`). */
const LARGE_END = 77;
const SMALL_END = 78;
/** The large face: 8 characters per line at tops 24 and 9; the small face: 11 at tops 29/20/11. */
const LARGE_PER_LINE = 8;
const LARGE_TOPS = [24, 9] as const;
const SMALL_PER_LINE = 11;
const SMALL_TOPS = [29, 20, 11] as const;
/** The large face shows up to 16 characters; past that the small face, the last 33. */
const LARGE_MAX = 16;
export const ENTRY_SHOWN = 33;

/** Calling's number: thin, 14 per line, right-aligned at tops 29 and 20, the last 28. */
const THIN_PER_LINE = 14;
const THIN_END = 78;
const CALLING_TOPS = [29, 20] as const;
/** The ringing screen's number: thin at top 8 (right-aligned), or two lines from x 8 (15+). */
const RING_TOPS = [8, 17] as const;
const RING_LEFT = 8;

function blit(fb: Framebuffer, sprite: StockSprite | undefined, id: string): void {
  if (sprite === undefined) throw new Error(`No stock widget sprite "${id}".`);
  fb.blitBitmap(sprite.bitmap, sprite.x, sprite.y);
}

const widgetSprite = (fb: Framebuffer, id: string): void => blit(fb, WIDGET_SPRITES[id], id);

/** Standby's frame under the telephone's screens: the ladders, their icons and the clock. */
export function paintStatusFrame(
  fb: Framebuffer,
  { clock, ladders = true }: { readonly clock?: string; readonly ladders?: boolean },
): void {
  if (ladders) {
    for (const sprite of [
      ...STATUS_SPRITES.signalBars,
      STATUS_SPRITES.signalIcon,
      ...STATUS_SPRITES.batteryBars,
      STATUS_SPRITES.batteryIcon,
    ]) {
      fb.blitBitmap(sprite.bitmap, sprite.x, sprite.y);
    }
  }
  if (clock !== undefined) {
    fb.drawText(STOCK_FONTS.digits, clock, CLOCK_END - textWidth(STOCK_FONTS.digits, clock), 0);
  }
}

/** `text` split from its end into lines of `perLine` (the last line full). */
function linesFromEnd(text: string, perLine: number): string[] {
  const lines: string[] = [];
  for (let end = text.length; end > 0; end -= perLine) {
    lines.push(text.slice(Math.max(0, end - perLine), end));
  }
  return lines;
}

/**
 * Dialled characters as standby's number entry (and a call's typed digits) draw them: 1-16 in the
 * large face, 8 a line, the newest line at top 24; 17-33 in the small face, 11 a line at tops
 * 29/20/11; past 33 the last 33. Right-aligned.
 */
export function paintDialled(fb: Framebuffer, text: string): void {
  const shown = text.length > ENTRY_SHOWN ? text.slice(text.length - ENTRY_SHOWN) : text;
  const large = shown.length <= LARGE_MAX;
  const font = large ? STOCK_FONTS.large : STOCK_FONTS.small;
  const lines = linesFromEnd(shown, large ? LARGE_PER_LINE : SMALL_PER_LINE);
  const tops = large ? LARGE_TOPS : SMALL_TOPS;
  const end = large ? LARGE_END : SMALL_END;
  lines.forEach((line, i) => fb.drawText(font, line, end - textWidth(font, line), tops[i]!));
}

function softkey(fb: Framebuffer, label: string): void {
  if (label !== "") fb.drawTextCentered(STOCK_FONTS.small, label, SOFTKEY_TOP);
}

/** Standby number entry (`entry/*`): standby's frame without the operator, the characters, the soft key. */
export interface DialEntryModel {
  readonly kind: "dial-entry";
  readonly text: string;
  readonly softkey: string;
  readonly clock?: string;
}

export function paintDialEntry(fb: Framebuffer, model: DialEntryModel): void {
  paintStatusFrame(fb, model.clock === undefined ? {} : { clock: model.clock });
  paintDialled(fb, model.text);
  softkey(fb, model.softkey);
}

/** What a call screen shows between standby's frame and the soft key. */
export type CallBody =
  /** Calling (`dial/call` b-f): `Calling` and its dots, the number once it shows. */
  | {
      readonly kind: "calling";
      readonly dots: number;
      readonly number?: string;
      readonly name?: string;
    }
  /** `Attempting` / `emergency` / `call` (`dial/number-112`). */
  | { readonly kind: "emergency" }
  /** The call icon (solid, or checkered once ended) and `Call 1` or the caller's name. */
  | {
      readonly kind: "call";
      readonly label: string;
      readonly ended?: boolean;
      readonly muted?: boolean;
    }
  /** Digits typed in the call, laid out as the number entry. */
  | { readonly kind: "digits"; readonly text: string }
  /** Nothing but the frame (the blank redraws between call screens). */
  | { readonly kind: "blank" };

export interface CallModel {
  readonly kind: "call";
  readonly body: CallBody;
  readonly softkey: string;
  readonly clock?: string;
  /** The handset at the top (from Calling's number on). */
  readonly handset: boolean;
  /** False while Volume's first redraw erases the ladders (`in-call/up` b). */
  readonly ladders?: false;
}

const CALLING_LEFT = 6;
const CALLING_TOP = 7;
const CALL_LABEL_LEFT = 17;
const CALL_LABEL_TOP = 8;
const EMERGENCY_TOPS = [7, 16, 25] as const;
const MUTED_LEFT = 6;
const MUTED_TOP = 21;

function paintCallLabel(fb: Framebuffer, text: string): void {
  const font = STOCK_FONTS.thin;
  let label = text;
  const cut = CALL_LABEL_LEFT + textWidth(font, text) > 80;
  if (cut) {
    while (label.length > 0 && CALL_LABEL_LEFT + textWidth(font, label) > 72) {
      label = label.slice(0, -1);
    }
  }
  fb.drawText(font, label, CALL_LABEL_LEFT, CALL_LABEL_TOP);
  if (cut) fb.drawText(font, "...", 72, CALL_LABEL_TOP);
}

export function paintCall(fb: Framebuffer, model: CallModel): void {
  paintStatusFrame(fb, {
    ...(model.clock === undefined ? {} : { clock: model.clock }),
    ladders: model.ladders !== false,
  });
  if (model.handset) widgetSprite(fb, "call/handset");
  const body = model.body;
  switch (body.kind) {
    case "calling": {
      fb.drawText(STOCK_FONTS.small, `Calling${".".repeat(body.dots)}`, CALLING_LEFT, CALLING_TOP);
      if (body.name !== undefined) {
        fb.drawText(STOCK_FONTS.thin, body.name, 6, 16);
      } else if (body.number !== undefined) {
        const number = body.number.slice(-THIN_PER_LINE * CALLING_TOPS.length);
        linesFromEnd(number, THIN_PER_LINE).forEach((line, i) =>
          fb.drawText(
            STOCK_FONTS.thin,
            line,
            THIN_END - textWidth(STOCK_FONTS.thin, line),
            CALLING_TOPS[i]!,
          ),
        );
      }
      break;
    }
    case "emergency":
      ["Attempting", "emergency", "call"].forEach((line, i) =>
        fb.drawText(STOCK_FONTS.thin, line, CALLING_LEFT, EMERGENCY_TOPS[i]!),
      );
      break;
    case "call":
      widgetSprite(fb, body.ended ? "call/icon-ended" : "call/icon");
      paintCallLabel(fb, body.label);
      if (body.muted) fb.drawText(STOCK_FONTS.thin, "Muted", MUTED_LEFT, MUTED_TOP);
      break;
    case "digits":
      paintDialled(fb, body.text);
      break;
    case "blank":
      break;
  }
  softkey(fb, model.softkey);
}

/** The ringing screen (`ring/screen`): the number (or name), `calling` blinking, `Answer`. */
export interface RingingModel {
  readonly kind: "ringing";
  readonly number: string;
  readonly name?: string;
  readonly calling: boolean;
  /** False while Volume's first redraw erases the ladders (`ring/key-up` b). */
  readonly ladders?: false;
}

export function paintRinging(fb: Framebuffer, model: RingingModel): void {
  paintStatusFrame(fb, { ladders: model.ladders !== false });
  if (model.name !== undefined) {
    fb.drawText(STOCK_FONTS.small, model.name, CALLING_LEFT, RING_TOPS[0]);
  } else {
    const number = model.number.replace(/^\+/, "");
    if (number.length <= THIN_PER_LINE) {
      fb.drawText(
        STOCK_FONTS.thin,
        number,
        THIN_END - textWidth(STOCK_FONTS.thin, number),
        RING_TOPS[0],
      );
    } else {
      [number.slice(0, THIN_PER_LINE), number.slice(THIN_PER_LINE, 2 * THIN_PER_LINE)].forEach(
        (line, i) => fb.drawText(STOCK_FONTS.thin, line, RING_LEFT, RING_TOPS[i]!),
      );
    }
  }
  if (model.calling) fb.drawText(STOCK_FONTS.small, "calling", CALLING_LEFT, 28);
  softkey(fb, "Answer");
}

/** In-call Volume (`in-call/down`): `Volume` small at (5, 0) and ten bars, `level` filled. */
export interface VolumeModel {
  readonly kind: "volume";
  readonly level: number;
}

export function paintVolume(fb: Framebuffer, model: VolumeModel): void {
  fb.drawText(STOCK_FONTS.small, "Volume", 5, 0);
  widgetSprite(fb, `volume/${model.level}`);
}

/** The call register's entry view (`register/dialled`): `Dialled 1:` and the number, large. */
export interface CallEntryModel {
  readonly kind: "call-entry";
  readonly label: string;
  readonly number: string;
  readonly softkey: string;
}

/** The entry view's number: large, its last cell ending at x 83 (`register/dialled-21`), 10 a line. */
const ENTRY_NUMBER_END = 84;
const ENTRY_NUMBER_PER_LINE = 10;
const ENTRY_LABEL_TOP = 7;
const ENTRY_NUMBER_TOPS = [24, 15] as const;

export function paintCallEntry(fb: Framebuffer, model: CallEntryModel): void {
  fb.drawText(STOCK_FONTS.small, model.label, 0, ENTRY_LABEL_TOP);
  const number = model.number.slice(-ENTRY_NUMBER_PER_LINE * ENTRY_NUMBER_TOPS.length);
  linesFromEnd(number, ENTRY_NUMBER_PER_LINE).forEach((line, i) =>
    fb.drawText(
      STOCK_FONTS.large,
      line,
      ENTRY_NUMBER_END - textWidth(STOCK_FONTS.large, line),
      ENTRY_NUMBER_TOPS[i]!,
    ),
  );
  softkey(fb, model.softkey);
}
