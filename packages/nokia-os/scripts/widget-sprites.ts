// The stock widgets' art, cropped from the committed goldens (plan 14 Task 7, D8, D13), and the
// probe recordings whose widget timelines later tasks need by name. `extract-resources.ts` crops
// each rectangle and derives every widget timeline from the goldens. Pure data, no imports.

/** Sprites a widget timeline may show, by widget kind (frames of one animated element). */
export type SpriteGroup =
  | "note-icon"
  | "top-score"
  | "progress-bar"
  | "prompt-icon"
  | "mark"
  | "level-bar"
  | "level-snake"
  | "fireworks"
  | "game-over"
  | "splash-8-1"
  | "splash-8-2"
  | "splash-8-3"
  | "splash-8-4";

export interface SpriteCrop {
  readonly id: string;
  readonly group: SpriteGroup;
  readonly golden: string;
  readonly image: string;
  /** Inclusive LCD rectangle. Every sprite of an animated group shares its group's rectangle. */
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

type Rect = Pick<SpriteCrop, "x0" | "x1" | "y0" | "y1">;

/** Note icons: the union of the tick, `!` and octagon boxes; note text never reaches it. */
const NOTE_ICON: Rect = { x0: 63, x1: 83, y0: 1, y1: 23 };
/** Top score's animation grows from the top-right corner (union of its frames). */
const TOP_SCORE: Rect = { x0: 64, x1: 82, y0: 0, y1: 22 };
/** The hatched progress bar. */
const PROGRESS_BAR: Rect = { x0: 0, x1: 83, y0: 7, y1: 14 };
const FULL: Rect = { x0: 0, x1: 83, y0: 0, y1: 47 };

/** One sprite per image, ids `<id>-1`, `<id>-2`, … in the order given. */
function frames(
  id: string,
  group: SpriteGroup,
  golden: string,
  images: readonly string[],
  rect: Rect,
): SpriteCrop[] {
  return images.map((image, i) => ({ id: `${id}-${i + 1}`, group, golden, image, ...rect }));
}

export const WIDGET_SPRITES: readonly SpriteCrop[] = [
  // Confirmation tick in three steps: dotted box, half tick, full tick (Type of view › Name list).
  {
    id: "note/tick-box",
    group: "note-icon",
    golden: "tree/01-phone-book/1-8-1-1.choose",
    image: "c",
    ...NOTE_ICON,
  },
  {
    id: "note/tick-half",
    group: "note-icon",
    golden: "tree/01-phone-book/1-8-1-1.choose",
    image: "d",
    ...NOTE_ICON,
  },
  {
    id: "note/tick",
    group: "note-icon",
    golden: "tree/01-phone-book/1-8-1-1.choose",
    image: "e",
    ...NOTE_ICON,
  },
  // Information: a dotted `!` (Service Nos. › No phone numbers).
  {
    id: "note/info",
    group: "note-icon",
    golden: "tree/01-phone-book/1-2.leaf",
    image: "c",
    ...NOTE_ICON,
  },
  // Error: an octagon (Show call costs › Clear counters › Not allowed).
  {
    id: "note/error",
    group: "note-icon",
    golden: "tree/04-call-register/4-6-3.choose",
    image: "b",
    ...NOTE_ICON,
  },
  // Top score's animation (Snake II › Top score), 11 frames.
  ...frames(
    "top-score",
    "top-score",
    "tree/08-games/8-1-4.leaf",
    ["b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"],
    TOP_SCORE,
  ),
  // The progress bar's 10 frames (Cancel all diverts › Requesting).
  ...frames(
    "progress",
    "progress-bar",
    "tree/07-call-divert/7-6.leaf",
    ["b", "c", "d", "e", "f", "g", "h", "i", "j", "k"],
    PROGRESS_BAR,
  ),
  // Prompt mode icons: the pen of every prompt, `Abc` beside it on text prompts (Search › Name:),
  // the phone book on Speed dials (Key 2:).
  {
    id: "prompt/pen",
    group: "prompt-icon",
    golden: "tree/01-phone-book/1-1.leaf",
    image: "b",
    x0: 1,
    x1: 9,
    y0: 0,
    y1: 5,
  },
  {
    id: "prompt/abc",
    group: "prompt-icon",
    golden: "tree/01-phone-book/1-1.leaf",
    image: "b",
    x0: 14,
    x1: 29,
    y0: 0,
    y1: 5,
  },
  // The lower-case `abc` of a name being edited (Profiles › Silent › Rename).
  {
    id: "prompt/abc-lower",
    group: "prompt-icon",
    golden: "tree/12-profiles/12-2-2-10.leaf",
    image: "b",
    x0: 14,
    x1: 29,
    y0: 0,
    y1: 5,
  },
  {
    id: "prompt/phone-book",
    group: "prompt-icon",
    golden: "tree/01-phone-book/1-9.leaf",
    image: "b",
    x0: 1,
    x1: 16,
    y0: 0,
    y1: 5,
  },
  // Multi-select marks at x 1..5 in the first and third rows (Info service › Languages: All
  // marked, Norsk not).
  {
    id: "mark/on",
    group: "mark",
    golden: "tree/02-messages/2-8-5.options",
    image: "01",
    x0: 1,
    x1: 5,
    y0: 9,
    y1: 13,
  },
  {
    id: "mark/off",
    group: "mark",
    golden: "tree/02-messages/2-8-5.options",
    image: "01",
    x0: 1,
    x1: 5,
    y0: 29,
    y1: 33,
  },
  // Level bars as the virgin EEPROM shows them, per game (Pairs II's two modes share one).
  {
    id: "level/8-1",
    group: "level-bar",
    golden: "tree/08-games/8-1-2.leaf",
    image: "b",
    x0: 5,
    x1: 74,
    y0: 13,
    y1: 36,
  },
  {
    id: "level/8-3",
    group: "level-bar",
    golden: "tree/08-games/8-3-2.leaf",
    image: "b",
    x0: 5,
    x1: 42,
    y0: 22,
    y1: 36,
  },
  {
    id: "level/8-4",
    group: "level-bar",
    golden: "tree/08-games/8-4-1-2.leaf",
    image: "b",
    x0: 5,
    x1: 58,
    y0: 18,
    y1: 36,
  },
  // Snake II's Level page at each stored level 1..9 (plan 23 C1, D11): `min(level, 9)` bars.
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `level/snake-${i + 1}`,
    group: "level-snake" as const,
    golden: `game/snake/level-${i + 1}`,
    image: `${i + 1}`,
    x0: 5,
    x1: 74,
    y0: 13,
    y1: 36,
  })),
  // Game over (plan 23 D13): a new top score's six full-screen fireworks pictures, and the
  // note's first line, `Game over!` (the lines below it carry the score and vary).
  ...frames(
    "fireworks",
    "fireworks",
    "game/snake/bot-long.death",
    ["b", "c", "d", "e", "f", "g"],
    FULL,
  ),
  {
    id: "game-over/title",
    group: "game-over",
    golden: "game/snake/bot-short.death",
    image: "c",
    x0: 0,
    x1: 83,
    y0: 0,
    y1: 16,
  },
  // Game splashes, full frame (P12). Pairs II's image d is a 16 ms partial draw, not a frame.
  ...frames("splash/8-1", "splash-8-1", "probe/games-splash-8-1", ["b", "c", "d", "e", "f"], FULL),
  ...frames(
    "splash/8-2",
    "splash-8-2",
    "probe/games-splash-8-2",
    ["b", "c", "d", "e", "f", "g", "h", "i", "j"],
    FULL,
  ),
  ...frames(
    "splash/8-3",
    "splash-8-3",
    "probe/games-splash-8-3",
    ["b", "c", "d", "e", "f", "g"],
    FULL,
  ),
  ...frames(
    "splash/8-4",
    "splash-8-4",
    "probe/games-splash-8-4",
    ["b", "c", "e", "f", "g", "h", "i", "j", "k"],
    FULL,
  ),
];

/** Widget kinds with a timeline, and the sprite groups their frames are matched against. */
export const TIMELINE_GROUPS = {
  note: ["note-icon", "top-score"],
  progress: ["progress-bar"],
  "game-over": ["fireworks", "game-over"],
  prompt: [],
  "splash-8-1": ["splash-8-1"],
  "splash-8-2": ["splash-8-2"],
  "splash-8-3": ["splash-8-3"],
  "splash-8-4": ["splash-8-4"],
} as const satisfies Readonly<Record<string, readonly SpriteGroup[]>>;

export type TimelineKind = keyof typeof TIMELINE_GROUPS;

/**
 * Probe recordings whose widget timeline has no tree golden: the game splashes (by the game's
 * node), the notes that follow a key inside a widget (by name), and a longer recording of a
 * tree node's progress bar. A probe's timeline starts at
 * its first frame that shows the kind's sprites.
 */
export const PROBE_TIMELINES: readonly {
  readonly golden: string;
  readonly kind: TimelineKind;
  readonly node?: string;
  readonly name?: string;
}[] = [
  { golden: "probe/games-splash-8-1", kind: "splash-8-1", node: "8-1" },
  { golden: "probe/games-splash-8-2", kind: "splash-8-2", node: "8-2" },
  { golden: "probe/games-splash-8-3", kind: "splash-8-3", node: "8-3" },
  { golden: "probe/games-splash-8-4", kind: "splash-8-4", node: "8-4" },
  // P7: Requesting for 10 s on Cancel all diverts. The emulator is deterministic, so this is the
  // 7-6 leaf recording (5.6 s) continued; its bar steps replace the leaf's for node 7-6.
  { golden: "probe/progress-7-6-quit", kind: "progress", node: "7-6" },
  // P7: Quit on Requesting after 10 s, then standby.
  { golden: "probe/progress-7-6-quit", kind: "note", name: "request-not-confirmed" },
  // P8: Ringing volume › Level 5 › OK on the query.
  { golden: "probe/confirm-5-2-5-ok", kind: "note", name: "level-5-done" },
  // P8: Reminders › Erase › All › Yes.
  { golden: "probe/confirm-10-3-2-yes", kind: "note", name: "reminder-memory-empty" },
  // Plan 15 A4: a wrong security code in Restore factory settings' prompt (2904 ms; the other
  // in-menu prompts' 2902-2905 ms), then the empty prompt.
  { golden: "probe/code-wrong-6-4", kind: "note", name: "code-error" },
  // Plan 15 0c: the notes after an accepted security code (bindings `ACCEPT_FLOWS`).
  { golden: "probe/accept-6-3-5-off", kind: "note", name: "phone-security-done" },
  { golden: "probe/accept-6-3-6-1-match", kind: "note", name: "security-code-changed" },
  { golden: "probe/accept-c7-restore", kind: "note", name: "settings-restored" },
  { golden: "probe/accept-4-5-5", kind: "note", name: "timers-cleared" },
  // P5: Menu 1 8, then standby.
  { golden: "probe/shortcut-m1-8", kind: "note", name: "invalid-shortcut" },
  // Plan 23 D13: Game over! / Your score: (the short game), and the fireworks before Game over!
  // / TOP SCORE: (the long game's new top score), each until the game menu returns.
  { golden: "game/snake/bot-short.death", kind: "game-over", name: "game-over-note" },
  { golden: "game/snake/bot-long.death", kind: "game-over", name: "game-over-fireworks" },
];
