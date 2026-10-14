// Stock resources, built from the data that scripts/extract-resources.ts derives from the
// committed goldens (D8). Nothing here is drawn by hand.
import { MenuGraphic, Timeline, type CarouselReveal } from "@hellotimber/phone-core";
import {
  bitmapFromArt,
  createPixelFont,
  type Bitmap,
  type PixelFont,
} from "@hellotimber/phone-screen";
import { BOOT_DATA } from "./generated/boot";
import { STOCK_FONT_DATA } from "./generated/fonts";
import { MENU_ICON_DATA } from "./generated/menu-icons";
import { STATUS_DATA } from "./generated/status";

export type StockFontName = "small" | "large" | "digits" | "thin";

type TimelineData = (typeof BOOT_DATA)["timeline"];

function timeline(data: TimelineData): Timeline {
  return new Timeline(data.steps, data.loopFrom === undefined ? {} : { loopFrom: data.loopFrom });
}

/**
 * The four firmware fonts. Strict: drawing a character a font lacks throws. Each glyph's width
 * is its advance (ink plus spacing), as phone-screen's `Framebuffer.drawText` expects.
 */
export const STOCK_FONTS: Readonly<Record<StockFontName, PixelFont>> = {
  small: createPixelFont(STOCK_FONT_DATA.small.glyphs, STOCK_FONT_DATA.small.height, 0),
  large: createPixelFont(STOCK_FONT_DATA.large.glyphs, STOCK_FONT_DATA.large.height, 0),
  digits: createPixelFont(STOCK_FONT_DATA.digits.glyphs, STOCK_FONT_DATA.digits.height, 0),
  thin: createPixelFont(STOCK_FONT_DATA.thin.glyphs, STOCK_FONT_DATA.thin.height, 0),
};

/**
 * Characters of `text` missing from a stock font, in first-appearance order; [] when the text
 * is renderable. `\n` is a firmware line break (D10), not a glyph, and is never reported.
 */
export function missingStockGlyphs(text: string, font: StockFontName): string[] {
  const glyphs = STOCK_FONTS[font].glyphs;
  const missing: string[] = [];
  for (const ch of text) {
    if (ch !== "\n" && !glyphs.has(ch) && !missing.includes(ch)) missing.push(ch);
  }
  return missing;
}

export interface StockSprite {
  /** Top-left on the LCD. */
  readonly x: number;
  readonly y: number;
  readonly bitmap: Bitmap;
}

export interface StockMenuIcon {
  /** Top-left of every frame on the LCD. */
  readonly x: number;
  readonly y: number;
  /** Indexed by the graphic's timeline frames. */
  readonly frames: readonly Bitmap[];
}

/** Carousel icons by graphic id (the menu slug, e.g. `phone-book`). */
export const STOCK_MENU_ICONS: Readonly<Record<string, StockMenuIcon>> = Object.fromEntries(
  Object.entries(MENU_ICON_DATA).map(([id, icon]) => [
    id,
    { x: icon.x, y: icon.y, frames: icon.frames.map((art) => bitmapFromArt(art)) },
  ]),
);

/** The carousel graphic for `id`, with its captured timeline and per-reveal timelines. */
export function stockMenuGraphic(id: string): MenuGraphic {
  const icon = MENU_ICON_DATA[id];
  if (!icon) throw new Error(`No stock menu icon "${id}".`);
  const reveals: Partial<Record<CarouselReveal, Timeline>> = {};
  for (const [reveal, data] of Object.entries(icon.reveals ?? {})) {
    reveals[reveal as CarouselReveal] = timeline(data);
  }
  return new MenuGraphic(id, timeline(icon.timeline), { reveals });
}

/** Boot: full-frame images, and the timeline whose frames index them (D12 composition). */
export const BOOT_FRAMES: readonly Bitmap[] = BOOT_DATA.frames.map((art) => bitmapFromArt(art));
export const BOOT_TIMELINE: Timeline = timeline(BOOT_DATA.timeline);

function sprite(data: (typeof STATUS_DATA)["signalIcon"]): StockSprite {
  return { x: data.x, y: data.y, bitmap: bitmapFromArt(data.art) };
}

/** Standby status art. Bars are listed top to bottom; level n shows the bottom n bars. */
export const STATUS_SPRITES: {
  readonly signalBars: readonly StockSprite[];
  readonly signalIcon: StockSprite;
  readonly batteryBars: readonly StockSprite[];
  readonly batteryIcon: StockSprite;
} = {
  signalBars: STATUS_DATA.signalBars.map(sprite),
  signalIcon: sprite(STATUS_DATA.signalIcon),
  batteryBars: STATUS_DATA.batteryBars.map(sprite),
  batteryIcon: sprite(STATUS_DATA.batteryIcon),
};
