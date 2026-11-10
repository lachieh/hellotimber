// The game contract of plan 28 ("Contract changes"): what game code and hosts share. Types only.

import type { GameScreen } from "./screen";

export type GameKey =
  | "up"
  | "down"
  | "*"
  | "#"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9";

/** Plain data (JSON in a user package). `validateManifest` checks structure; the host checks glyphs. */
export interface GameManifest {
  readonly sdk: 1;
  /** Kebab-case: the menu slug and the storage namespace; not a stock Games slug. */
  readonly id: string;
  /** The Games list label (stock small face, one row). */
  readonly name: string;
  /** The game's menu animation (D2). */
  readonly splash: GameSplash;
  /** The game menu in order (D5); the first item is a `play`. */
  readonly menu: readonly GameMenuItem[];
  /** Integers, 1 <= initial <= max; no upper cap (D19). Absent: no Level page, `start.level` is 1. */
  readonly level?: { readonly max: number; readonly initial: number };
  /** Navi/C suspend the game and add Continue (default false: they quit to the game menu). */
  readonly suspend?: boolean;
  /** Default true: `over(score)` shows the stock game-over screens and keeps a top score. */
  readonly scores?: boolean;
  /** Saved bytes the game may keep: 0..MAX_STORAGE_BYTES, default 0. */
  readonly storageBytes?: number;
}

export interface GameSplash {
  /** Packed frames, base64 (504 bytes each); at least one. */
  readonly frames: readonly string[];
  /** At least one step; `ms` a positive integer. Count and length are the game's; any key skips (shell). */
  readonly steps: readonly { readonly frame: number; readonly ms: number }[];
}

export type GameMenuItem =
  | { readonly kind: "play"; readonly slug: string; readonly label: string; readonly mode?: string }
  | { readonly kind: "level" }
  | {
      readonly kind: "choice";
      readonly slug: string;
      readonly label: string;
      readonly options: readonly string[]; // at least one; the stock list scrolls
      readonly initial: number;
    }
  | { readonly kind: "top-score" }
  /** Each page's text wraps in the thin face and continues on the next screen; `\n` breaks a line. */
  | { readonly kind: "instructions"; readonly pages: readonly string[] };

export interface GameStart {
  readonly mode: string; // the play item's mode ("" for none)
  readonly level: number;
  readonly choices: Readonly<Record<string, number>>; // by choice slug
  readonly seed: number; // uint32
  readonly topScore: number;
  readonly storage: Uint8Array; // the saved bytes (<= storageBytes)
}

/** Glyph rows of `#`/`.`; a row's length is the glyph's advance (STOCK_FONT_DATA's shape). */
export interface GameFont {
  readonly height: number;
  readonly glyphs: Readonly<Record<string, readonly string[]>>;
}
export interface GameFonts {
  readonly game: GameFont; // GAME_DIGITS, always
  readonly small?: GameFont;
  readonly large?: GameFont;
  readonly digits?: GameFont;
  readonly thin?: GameFont;
}

export type GameSound =
  | "eat"
  | "crash"
  /** Positive integers; any number of notes (D10). */
  | { readonly notes: readonly { readonly hz: number; readonly ms: number }[] };

export interface GameContext {
  readonly start: GameStart;
  readonly fonts: GameFonts;
  /** The session's seeded generator (mulberry32 over start.seed): a uint32 per call. */
  random(): number;
  sound(sound: GameSound): void;
  vibrate(ms: number): void; // a positive integer
  /** Replaces the saved bytes; false (nothing saved) over storageBytes. */
  save(bytes: Uint8Array): boolean;
  /** Ends the session after the current call; the shell takes over (D5). */
  over(score?: number): void;
}

/**
 * When the game next needs `update` (D4): a delay in ms from the call's time (raised to
 * MIN_WAKE_MS; a fraction rounds up), or null: sleep until a key.
 */
export type GameWake = number | null;

export interface GameInstance {
  /** At session time 0 (New game), then at each requested wake; `nowMs` is exactly the time asked for. */
  update(nowMs: number): GameWake;
  /** A game key went down at `nowMs`. A wake replaces the pending one; undefined (no return) keeps it. */
  keyDown?(key: GameKey, nowMs: number): GameWake | undefined;
  /** As keyDown, for a release (only of keys whose key-down the game got). */
  keyUp?(key: GameKey, nowMs: number): GameWake | undefined;
  /** Called after every update, keyDown and keyUp; the screen keeps the previous frame. */
  draw(screen: GameScreen): void;
}

export interface GameDefinition {
  readonly manifest: GameManifest;
  create(ctx: GameContext): GameInstance;
}

/** What a game module evaluates to: the SDK's helpers arrive as the argument (no imports). */
export type GameFactory = (sdk: GameSdk) => GameDefinition;

export interface GameSdk {
  readonly version: 1;
  readonly GAME_DIGITS: GameFont;
  readonly MIN_WAKE_MS: number;
  createScreen(): GameScreen;
  drawText(
    screen: GameScreen,
    font: GameFont,
    text: string,
    x: number,
    y: number,
    ink?: 0 | 1,
  ): number;
  textWidth(font: GameFont, text: string): number;
  drawNumber(
    screen: GameScreen,
    value: number,
    x: number,
    y: number,
    options?: {
      font?: GameFont;
      scale?: 1 | 2 | 3;
      gap?: number;
      align?: "left" | "right";
      ink?: 0 | 1;
    },
  ): number;
  encodeFrame(screen: GameScreen): string; // base64 of the packed frame (splash building)
}

// --- hosts -----------------------------------------------------------------------------------
/** `at`: the session ms of the call that made the effect. */
export type GameEffect =
  | { readonly kind: "sound"; readonly at: number; readonly sound: GameSound }
  | { readonly kind: "vibrate"; readonly at: number; readonly ms: number }
  | { readonly kind: "save"; readonly at: number; readonly bytes: Uint8Array }
  | { readonly kind: "over"; readonly at: number; readonly score: number | undefined };

/** One running game, driven synchronously by a host (D6). Times are session ms, non-decreasing. */
export interface GameSession {
  /** Runs every wake due at or before `nowMs` (each at its own time), then delivers the key. */
  keyDown(key: GameKey, nowMs: number): void;
  keyUp(key: GameKey, nowMs: number): void;
  /** Runs every wake due at or before `nowMs`, each at its own time. */
  advance(nowMs: number): void;
  /** The session ms of the next wake; null while the game sleeps (remote: or an advance is in flight). */
  wake(): number | null;
  /** The newest packed frame; undefined before the first. Remote sessions lag by the round trip. */
  frame(): Uint8Array | undefined;
  /** Effects since the last drain, in order. */
  drain(): readonly GameEffect[];
  /** Set once the game threw, broke the protocol or a limit, or tripped the watchdog; the session is dead. */
  readonly failure: string | undefined;
  dispose(): void;
}
export interface GameModule {
  readonly manifest: GameManifest;
  /** Creates the instance and runs `update(0)`. */
  start(start: GameStart, fonts: GameFonts): GameSession;
}
