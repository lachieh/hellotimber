// The Snake II game state and what the painter draws from it (plan 23 D1). Pure data: the
// engine (engine.ts) turns one state into the next; nothing here knows about time.
import type { Cell, CreatureKind } from "./rng";

export type { Cell, CreatureKind } from "./rng";

/** A direction of travel. */
export type Heading = "right" | "left" | "up" | "down";

/** A corner by the two cell edges it joins (`up-left`: in from the top, out to the left). */
export type Corner = "up-left" | "up-right" | "down-left" | "down-right";

/**
 * A segment's picture, named as the stock sprites are: heads (mouth closed or open) by heading,
 * tails by the way to the next segment, straights by heading, corners by their edges, and the
 * fat ones drawn where the snake ate.
 */
export type SegmentPicture =
  | `head/${Heading}`
  | `head-open/${Heading}`
  | `tail/${Heading}`
  | `body/${Heading}`
  | `body-fat/${Heading}`
  | `corner/${Corner}`
  | `corner-fat/${Corner}`;

export interface Segment extends Cell {
  /** The heading of the step that reached this cell. */
  readonly heading: Heading;
  readonly picture: SegmentPicture;
}

export interface Creature {
  readonly kind: CreatureKind;
  /** Small: (x, y), (x + 1, y). Large: (x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1). */
  readonly cells: readonly Cell[];
  /**
   * False for the cells a failed spawn leaves in place (RE, UNVERIFIED): no creature is shown,
   * but food keeps out of their rows and columns and a head entering one eats.
   */
  readonly shown: boolean;
  /** The large creature's picture, alternating every step (the small ones keep 1). */
  readonly frame: 1 | 2;
}

/** `blocked`: one blocked step, in the grace (H6). `dead`: the second (H11). */
export type CrashState = "alive" | "blocked" | "dead";

export interface SnakeState {
  readonly level: number;
  /** 0 No maze, 1..5 Maze 1..5. */
  readonly maze: number;
  /** The generator's state. */
  readonly seed: number;
  /** Tail first, head last. */
  readonly segments: readonly Segment[];
  /** Ring slots of the head and the tail, mod 299: the death blink skips a wrapped ring (H11). */
  readonly ring: { readonly head: number; readonly tail: number };
  /** The heading the last step took, the one before it, and the one the next step takes. */
  readonly heading: Heading;
  readonly previous: Heading;
  readonly pending: Heading;
  /** Undefined when no cell was free. */
  readonly food: Cell | undefined;
  readonly creature: Creature | undefined;
  /** +4 per meal while no creature is out; then the creature's steps left (H9). */
  readonly counter: number;
  /** The head is on the food it just ate: the tail stays once on the next step (H7). */
  readonly grow: boolean;
  /** Something was eaten: the next neck is drawn fat (H7, H10). */
  readonly swallow: boolean;
  readonly crash: CrashState;
  /** A u32; the HUD shows its low 16 bits (H16). */
  readonly score: number;
  /** The EEPROM allows the 2x2 creature and none has been eaten this game. */
  readonly largeAllowed: boolean;
  /** Collected large creatures, bits 0..9 (RE, UNVERIFIED: none was eaten in a capture). */
  readonly collected: number;
  /** False while the death blink hides the snake. */
  readonly visible: boolean;
}

export interface SnakeRenderModel {
  readonly maze: number;
  /** Empty while the death blink hides the snake. */
  readonly segments: readonly Segment[];
  readonly food?: Cell;
  readonly creature?: {
    readonly kind: CreatureKind;
    readonly cells: readonly Cell[];
    readonly frame: 1 | 2;
  };
  /** The low 16 bits of the score (H16). */
  readonly score: number;
  /** The creature's steps left, shown beside its HUD icon while it is out. */
  readonly countdown?: number;
}
