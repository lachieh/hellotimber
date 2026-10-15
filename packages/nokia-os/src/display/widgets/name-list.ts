// The phone book's name list in its three views, the Assign tone page and Service Nos. (plan 19
// D6, S3; measured on `phone-book/view-*`, `tone-pages`, `service-scroll`).
import { textWidth, type Framebuffer, type PixelFont } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../../resources";
import { paintRail } from "../rail";
import { paintRows } from "../list-rows";
import { SOFTKEY_TOP } from "../standby";

const LCD_WIDTH = 84;

/** Large font: the name in the large face from x 1, broken by character, at tops 7 and 22. */
const LARGE_LEFT = 1;
const LARGE_TOPS = [7, 22] as const;

/**
 * A number in the large face, right-aligned: its last line at top 24, the one before at top 10
 * (Speed dials' View number, `phone-book/speed-view-long`; a name-less entry in Large font,
 * `phone-book/add-no-name` e).
 */
const LARGE_NUMBER_TOPS = [10, 24] as const;
const LARGE_NUMBER_WIDTH = 80;

/** Name, number and the tone page: the name in the small face from x 0 at tops 7 and 16. */
const NAME_TOPS = [7, 16] as const;
/** The value (a number, a tone) right-aligned on the lines below, the last at top 29. */
const VALUE_TOPS = [20, 29] as const;

/** Name list: three full-width rows, text from x 2 at tops 8/18/28 on 10-row bands from y 7. */
const ROW_BAND_TOP = 7;
const ROW_PITCH = 10;
const ROW_TEXT_LEFT = 2;
/**
 * A name wider than its row is cut to end by x 72 and followed by the small face's `...` at
 * x 74 (`phone-book/view-list` down-00 `Abcdefghijklm...`, down-19 `Wwwwwwwww...`).
 */
const ELLIPSIS = "...";
const ELLIPSIS_LEFT = 74;

export type NameListModel =
  /** Large font: the name, or a name-less entry's number (as View number shows it). */
  | {
      readonly kind: "name-list";
      readonly view: "large";
      readonly name: string;
      readonly number?: string;
      readonly softkey: string;
    }
  /** Name, number, and the Assign tone page (`value` the tone). */
  | {
      readonly kind: "name-list";
      readonly view: "page";
      readonly name: string;
      readonly value: string;
      readonly softkey: string;
    }
  /** Name list: the three rows from the window's top, `selected` the inverted one (0-2). */
  | {
      readonly kind: "name-list";
      readonly view: "list";
      readonly rows: readonly string[];
      readonly selected: number;
      readonly softkey: string;
    };

/**
 * The phone book's queries and voice screens: small-face lines from x 0 at their tops, an
 * optional icon, the soft key (`Replace?` / a name at 4/15/25, `Are you` / `sure?` at 2/12,
 * `Please` / `speak now` with its face).
 */
export interface PhoneBookQueryModel {
  readonly kind: "phone-book-query";
  readonly lines: readonly string[];
  readonly tops: readonly number[];
  /** A widget sprite drawn at its captured position. */
  readonly sprite?: string;
  readonly softkey: string;
}

/** `Replace?`, `Erase?` and the like: the query at top 4, the name below it at 15 and 25. */
export function nameQuery(query: string, name: string, softkey = "OK"): PhoneBookQueryModel {
  const lines = [query, ...nameLines(STOCK_FONTS.small, name, LCD_WIDTH).slice(0, 2)];
  return { kind: "phone-book-query", lines, tops: [4, 15, 25].slice(0, lines.length), softkey };
}

export function paintPhoneBookQuery(fb: Framebuffer, model: PhoneBookQueryModel): void {
  model.lines.forEach((line, i) => {
    const top = model.tops[i];
    if (top === undefined) throw new Error(`Query line ${JSON.stringify(line)} has no top.`);
    fb.drawText(STOCK_FONTS.small, line, 0, top);
  });
  if (model.sprite !== undefined) {
    const sprite = WIDGET_SPRITES[model.sprite];
    if (sprite === undefined) throw new Error(`No stock widget sprite "${model.sprite}".`);
    fb.blitBitmap(sprite.bitmap, sprite.x, sprite.y);
  }
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}

/** Service Nos.: plan 14's rows and rail, no icon (`phone-book/service-*`). */
export interface ServiceListModel {
  readonly kind: "service-list";
  readonly items: readonly string[];
  readonly selected: number;
  readonly windowTop: number;
  readonly softkey: string;
}

/**
 * A name's lines of at most `width` columns in `font`: words fill a line while they fit and wrap
 * at the space (`Lisa Ann` / `Wilson`); a word wider than a line breaks by character
 * (`Abcdefghijklm` / `nop`). Word wrap in the small face is UNVERIFIED (no captured name needs it).
 */
export function nameLines(font: PixelFont, text: string, width: number): string[] {
  const lines: string[] = [];
  const fits = (candidate: string) => textWidth(font, candidate) <= width;
  let line = "";
  /** Whether the line holds a word yet (a leading space is kept: ` Lead`, `phone-book/view-sort`). */
  let started = false;
  for (const word of text.split(" ")) {
    const joined = started ? `${line} ${word}` : word;
    started = true;
    if (fits(joined)) {
      line = joined;
      continue;
    }
    if (line !== "") lines.push(line);
    line = "";
    for (const char of word) {
      if (line !== "" && !fits(line + char)) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
  }
  if (line !== "" || lines.length === 0) lines.push(line);
  return lines;
}

/**
 * `text` broken from its end into lines of at most `width` columns, keeping the last `lines`
 * (a long number shows its last digits: `12345` / `67890123456789`).
 */
export function breakFromEnd(
  font: PixelFont,
  text: string,
  width: number,
  lines: number,
): string[] {
  const out: string[] = [];
  let rest = Array.from(text);
  while (rest.length > 0 && out.length < lines) {
    let take = 1;
    while (take < rest.length && textWidth(font, rest.slice(-(take + 1)).join("")) <= width) take++;
    out.unshift(rest.slice(-take).join(""));
    rest = rest.slice(0, -take);
  }
  return out;
}

/**
 * A Name list row's text: undefined when the name fits (its ink by x 83; widths count a glyph's
 * blank column), else the part of it whose ink ends by x 72, before the ellipsis.
 */
export function cutRow(font: PixelFont, name: string): string | undefined {
  if (ROW_TEXT_LEFT + textWidth(font, name) - 1 <= LCD_WIDTH) return undefined;
  const chars = Array.from(name);
  while (chars.length > 0 && ROW_TEXT_LEFT + textWidth(font, chars.join("")) > ELLIPSIS_LEFT) {
    chars.pop();
  }
  return chars.join("");
}

/** A number in the large face, right-aligned on the lines from top 24 up (View number). */
export function paintLargeNumber(fb: Framebuffer, number: string): void {
  const { large } = STOCK_FONTS;
  const lines = breakFromEnd(large, number, LARGE_NUMBER_WIDTH, LARGE_NUMBER_TOPS.length);
  const tops = LARGE_NUMBER_TOPS.slice(LARGE_NUMBER_TOPS.length - lines.length);
  // The last cell's blank column is x 82 (`l24@4-83`: ink to x 81), as plan 18's values.
  lines.forEach((line, i) =>
    fb.drawText(large, line, LCD_WIDTH - 1 - textWidth(large, line), tops[i]!),
  );
}

function icon(fb: Framebuffer): void {
  const sprite = WIDGET_SPRITES["prompt/phone-book"];
  if (sprite === undefined) throw new Error('No stock widget sprite "prompt/phone-book".');
  fb.blitBitmap(sprite.bitmap, sprite.x, sprite.y);
}

export function paintNameList(fb: Framebuffer, model: NameListModel): void {
  const { small, large } = STOCK_FONTS;
  icon(fb);
  if (model.view === "large" && model.name === "" && model.number !== undefined) {
    paintLargeNumber(fb, model.number);
  } else if (model.view === "large") {
    const lines = nameLines(large, model.name, LCD_WIDTH - LARGE_LEFT);
    lines
      .slice(0, LARGE_TOPS.length)
      .forEach((line, i) => fb.drawText(large, line, LARGE_LEFT, LARGE_TOPS[i]!));
  } else if (model.view === "page") {
    const name = nameLines(small, model.name, LCD_WIDTH).slice(0, NAME_TOPS.length);
    name.forEach((line, i) => fb.drawText(small, line, 0, NAME_TOPS[i]!));
    const room = VALUE_TOPS.length - (name.length - 1);
    const value = breakFromEnd(small, model.value, LCD_WIDTH, room);
    const tops = VALUE_TOPS.slice(VALUE_TOPS.length - value.length);
    value.forEach((line, i) =>
      fb.drawText(small, line, LCD_WIDTH - textWidth(small, line), tops[i]!),
    );
  } else {
    model.rows.forEach((row, i) => {
      const top = ROW_BAND_TOP + i * ROW_PITCH;
      const inverted = i === model.selected;
      if (inverted) fb.fillRect(0, top, LCD_WIDTH, ROW_PITCH, 1);
      const color = inverted ? 0 : 1;
      const cut = cutRow(small, row);
      fb.drawText(small, cut ?? row, ROW_TEXT_LEFT, top + 1, { color });
      if (cut !== undefined) fb.drawText(small, ELLIPSIS, ELLIPSIS_LEFT, top + 1, { color });
    });
  }
  fb.drawTextCentered(small, model.softkey, SOFTKEY_TOP);
}

export function paintServiceList(fb: Framebuffer, model: ServiceListModel): void {
  paintRows(fb, model.items, model.selected, model.windowTop);
  paintRail(fb, model.selected, model.items.length);
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
