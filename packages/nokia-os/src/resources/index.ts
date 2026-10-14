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
import { SNAKE_DATA } from "./generated/snake";
import { STATUS_DATA } from "./generated/status";
import { TEXT_DATA } from "./generated/text";
import { SOUND_DATA } from "./generated/sounds";
import { WIDGET_DATA } from "./generated/widgets";

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
/**
 * The hands after the power-on security code is accepted (`boot/security-gate`, plan 15 D9):
 * the same `BOOT_FRAMES` at the gate's regular ≈255 ms steps, the last held until standby.
 */
export const GATE_HANDS_TIMELINE: Timeline = timeline(BOOT_DATA.gateHands);

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

/** What one step of a stock widget's timeline shows (see scripts/extract-resources.ts). */
export type WidgetFrame = (typeof WIDGET_DATA)["timelines"][string]["frames"][number];

export interface StockWidgetTimeline {
  /** Indexed by the timeline's frames. */
  readonly frames: readonly WidgetFrame[];
  readonly timeline: Timeline;
}

/** Widget art cropped from the goldens (note icons, bars, marks, prompt icons, splashes). */
export const WIDGET_SPRITES: Readonly<Record<string, StockSprite>> = Object.fromEntries(
  Object.entries(WIDGET_DATA.sprites).map(([id, data]) => [id, sprite(data)]),
);

/** Widget timelines by id, aligned on their trigger frame (plan 14 D8). */
export const WIDGET_TIMELINES: Readonly<Record<string, StockWidgetTimeline>> = Object.fromEntries(
  Object.entries(WIDGET_DATA.timelines).map(([id, data]) => [
    id,
    { frames: data.frames, timeline: timeline(data) },
  ]),
);

/** Tree node number → widget timeline id (notes, progress notes, prompt cursors, splashes). */
export const WIDGET_TIMELINE_BY_NODE: Readonly<Record<string, string>> = WIDGET_DATA.byNode;

/** Named widget timelines from probes (`request-not-confirmed`, `invalid-shortcut`, ...). */
export const WIDGET_TIMELINE_BY_NAME: Readonly<Record<string, string>> = WIDGET_DATA.byName;

// ---------------------------------------------------------------- Snake II (plan 23)

/** A direction of travel. */
export type SnakeHeading = "right" | "left" | "up" | "down";
/** A corner by the two cell edges it joins. */
export type SnakeCorner = "up-left" | "up-right" | "down-left" | "down-right";
export type SnakeCreatureKind = 0 | 1 | 2 | 3 | 4 | 5;

const HEADINGS = ["right", "left", "up", "down"] as const satisfies readonly SnakeHeading[];
const CORNERS = [
  "up-left",
  "up-right",
  "down-left",
  "down-right",
] as const satisfies readonly SnakeCorner[];
const KINDS = [0, 1, 2, 3, 4, 5] as const satisfies readonly SnakeCreatureKind[];

/** Every Snake II picture: 4x4 cells, 8x4 creatures and HUD icons, the 8x8 large creature's two
 * pictures, and the 4x5 HUD digits. */
export const SNAKE_SPRITE_IDS = [
  ...HEADINGS.flatMap((h) => [
    `head/${h}` as const,
    `head-open/${h}` as const,
    `tail/${h}` as const,
    `body/${h}` as const,
    `body-fat/${h}` as const,
  ]),
  ...CORNERS.flatMap((c) => [`corner/${c}` as const, `corner-fat/${c}` as const]),
  "food",
  ...KINDS.flatMap((k) => [`creature/${k}` as const, `creature-icon/${k}` as const]),
  "large/1",
  "large/2",
  "large-icon/1",
  "large-icon/2",
  ...([0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((d) => `digit/${d}` as const),
] as const;

export type SnakeSpriteId = (typeof SNAKE_SPRITE_IDS)[number];

/** Snake II pictures cropped from the gameplay goldens (scripts/snake-resources.ts). */
export const SNAKE_SPRITES: Readonly<Record<SnakeSpriteId, Bitmap>> = Object.fromEntries(
  SNAKE_SPRITE_IDS.map((id) => {
    const art = SNAKE_DATA.sprites[id];
    if (!art) throw new Error(`No Snake II sprite "${id}".`);
    return [id, bitmapFromArt(art)];
  }),
) as Record<SnakeSpriteId, Bitmap>;

export interface SnakeWall {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface SnakeMaze {
  /** The cell behind the tail: the snake starts on (x + 1 .. x + 7, y), heading right. */
  readonly start: { readonly x: number; readonly y: number };
  /** Wall segments from cell to cell, drawn as 2-px lines through the cell centres. */
  readonly walls: readonly SnakeWall[];
}

/** No maze, then Maze 1..5, as the Mazes option list orders them. */
export const SNAKE_MAZES: readonly SnakeMaze[] = SNAKE_DATA.mazes;

/** Level (1..175) → engine tick period (ms), as captured (D2). */
export const SNAKE_PERIODS: Readonly<Record<number, number>> = SNAKE_DATA.periods;
/** Level → the first tick's delay after the New game frame (ms). */
export const SNAKE_FIRST_TICK: Readonly<Record<number, number>> = SNAKE_DATA.firstTick;
/** A blocked tick → the grace tick that saves or kills the snake (ms, H6). */
export const SNAKE_GRACE_MS: number = SNAKE_DATA.graceMs;
/** The crash → the game-over screen: the snake hidden and shown in turn (H11). */
export const SNAKE_DEATH_STEPS: readonly {
  readonly visible: boolean;
  readonly durationMs: number;
}[] = SNAKE_DATA.death;
/** A new top score's game-over screen comes this much after the death steps (virgin-game). */
export const SNAKE_TOP_SCORE_MS: number = SNAKE_DATA.topScoreMs;

// ---------------------------------------------------------------- sound (plan 16)

/**
 * The 35 Ringing tone list previews at Level 4 (to each tone's second cycle mark), with the
 * Ringing volume list's first mark, the cycle, Level 5's jump and Ascending's steps
 * (scripts/sound-programs.ts, from the sound goldens).
 */
export const RINGING_TONES = SOUND_DATA.ringingTones;
/** ▲/▼ in a preview list → the preview's first output (ms after the key-down). */
export const PREVIEW_DELAY_MS: number = SOUND_DATA.previewDelayMs;
/** The same for the Message alert tone list. */
export const MESSAGE_PREVIEW_DELAY_MS: number = SOUND_DATA.messagePreviewDelayMs;
/**
 * The buzzer volume register by Ringing volume level and note frequency (D10): Levels 1-4
 * exactly; Level 5 plays Level 4's table up to the tone's `level5At`, then the fifth.
 */
export const VOLUME_RULE = { tables: SOUND_DATA.volumeTables } as const;
/** Ascending: Level 1 first, one level up at each of the tone's `ascendingAt`, capped at the stored level. */
export const ASCENDING_RULE = { startLevel: 1 } as const;
/** Message alert tones at Level 4 (`standard`, `special`, `beep-once`, `ascending`; No tone is silent). */
export const MESSAGE_TONES = SOUND_DATA.messageTones;
/** The message `Beep once` tone's DSP word by Ringing volume level (Levels 2-3 not captured). */
export const BEEP_ONCE_LEVELS: Readonly<Record<string, number>> = SOUND_DATA.beepOnceLevels;
/** Message tones' buzzer volume by frequency while Ringing volume is unset (the virgin EEPROM). */
export const UNSET_MESSAGE_VOLUMES: Readonly<Record<string, number>> =
  SOUND_DATA.unsetMessageVolumes;
/** Keypad tones: 900 Hz at the level's DSP word; awake and woken durations; the DSP's sleep. */
export const KEYPAD_BEEP = SOUND_DATA.keypad;
/** Note text → its warning tone (Warning tones On, D12). */
export const NOTE_SOUNDS = SOUND_DATA.noteSounds;
/** Snake II: the meal, the crash and the top score; the vibrator's run per shake (D13). */
export const GAME_CUES = SOUND_DATA.gameCues;
/** The power-on tone (and the power key's long press): its time into the power-on. */
export const BOOT_TONE = SOUND_DATA.bootTone;

// ---------------------------------------------------------------- text entry and SMS (plan 18)

/**
 * Multi-tap timings measured on the plan 18 goldens (scripts/messages-resources.ts, D5): the
 * commit after a pending character's first redraw, the cursor's blink, held C's clear after the
 * first deletion, held # (from key-down) and a held digit's threshold (from key-down).
 */
export const TEXT_TIMINGS = TEXT_DATA.text;
/**
 * `Sending message`'s shortest duration: the median of five synthetic-cell sends (2574.3-2790.4
 * ms, D10; UNVERIFIED on a live network). A host that settles later extends it.
 */
export const SEND_LINK_MS: number = TEXT_DATA.messages.sendLinkMs;
/** A delivered SMS reaches standby this long later: the median of five (2141.3-2464.4 ms, D10). */
export const RECEIVE_LINK_MS: number = TEXT_DATA.messages.receiveLinkMs;
/** `Saving message` shows its first bar frame this long before `Message saved`. */
export const SAVING_MS: number = TEXT_DATA.messages.savingMs;
