// The Snake II game state and what the painter draws from it (plan 23 D1). Pure data: the
// engine (engine.ts) turns one state into the next; nothing here knows about time.
import type { Cell, CreatureKind, Heading, Segment } from "../../../ui/display/widgets/snake";

export type {
  Cell,
  Corner,
  CreatureKind,
  Heading,
  Segment,
  SegmentPicture,
  SnakeRenderModel,
} from "../../../ui/display/widgets/snake";

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
