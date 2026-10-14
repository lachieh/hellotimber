// The Snake II engine (plan 23 D1): pure functions from one game state to the next, one call per
// firmware tick. Time is the session's: it calls `stepSnake` at the level's period, the grace
// after a blocked step, and `blinkSnake` along the death steps. The rules follow the RE notes'
// tick order, each confirmed by Task 0's captures (tests/snake-engine.test.ts).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { StockCue } from "../../firmware/cues";
import { SNAKE_DATA } from "../../resources/generated/snake";
import { headingFor, opposite } from "./keys";
import type { Cell, Heading, Segment, SegmentPicture, SnakeRenderModel, SnakeState } from "./model";
import { BOARD_HEIGHT, BOARD_WIDTH, createSnakeRandom, placeCreature, placeFood } from "./rng";

/** Ring slots (the firmware's segment ring, modulus 299). */
const RING = 299;
/** The vibrator's run per meal and at the crash (Task 0 C10). */
export const SNAKE_VIBRATE_MS = 480;

export type SnakeEvent =
  | { readonly kind: "ate"; readonly what: "food" | "creature"; readonly points: number }
  /** The first blocked step: the grace begins (H6). */
  | { readonly kind: "crashed" }
  /** The second blocked step: the death blink begins (H11). */
  | { readonly kind: "died" };

export interface SnakeStep {
  readonly state: SnakeState;
  readonly cues: readonly StockCue[];
  readonly events: readonly SnakeEvent[];
}

export interface SnakeOptions {
  readonly level: number;
  /** 0 No maze, 1..5 Maze 1..5. */
  readonly maze: number;
  /** The generator's state at New game (seed.ts). */
  readonly seed: number;
  /** The EEPROM's large-creature bit; set in the captured phone (Task 0). Default true. */
  readonly largeAllowed?: boolean;
}

const key = (c: Cell) => `${c.x},${c.y}`;

/** The cells of a maze's walls. */
export function wallCells(maze: number): Cell[] {
  const data = SNAKE_DATA.mazes[maze];
  if (!data) throw new Error(`No Snake II maze ${maze}.`);
  const cells: Cell[] = [];
  for (const { x1, y1, x2, y2 } of data.walls) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) cells.push({ x, y });
    }
  }
  return cells;
}

const STEP: Readonly<Record<Heading, Cell>> = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

/** The cell one step along `heading`, wrapping at every edge (H1). */
function ahead(cell: Cell, heading: Heading): Cell {
  return {
    x: (cell.x + STEP[heading].x + BOARD_WIDTH) % BOARD_WIDTH,
    y: (cell.y + STEP[heading].y + BOARD_HEIGHT) % BOARD_HEIGHT,
  };
}

const vertical = (heading: Heading) => heading === "up" || heading === "down";

/** The neck's picture: straight on, or the corner joining the edge it came in by and the one it left by (H7: fat after a meal). */
function neckPicture(previous: Heading, heading: Heading, fat: boolean): SegmentPicture {
  if (previous === heading) return fat ? `body-fat/${heading}` : `body/${heading}`;
  const edges = [opposite(previous), heading];
  const v = edges.find(vertical) as "up" | "down";
  const h = edges.find((e) => !vertical(e)) as "left" | "right";
  return fat ? `corner-fat/${v}-${h}` : `corner/${v}-${h}`;
}

export function newSnakeGame(options: SnakeOptions): SnakeState {
  const start = SNAKE_DATA.mazes[options.maze]?.start;
  if (!start) throw new Error(`No Snake II maze ${options.maze}.`);
  const segments: Segment[] = Array.from({ length: 7 }, (_, i) => ({
    x: start.x + 1 + i,
    y: start.y,
    heading: "right" as const,
    picture: i === 0 ? "tail/right" : i === 6 ? "head/right" : "body/right",
  }));
  const taken = new Set([...wallCells(options.maze), ...segments].map(key));
  const rng = createSnakeRandom(options.seed);
  const food = placeFood(rng, (x, y) => !taken.has(`${x},${y}`), []);
  return {
    level: options.level,
    maze: options.maze,
    seed: rng.seed,
    segments,
    ring: { head: start.x + 7, tail: start.x + 1 },
    heading: "right",
    previous: "right",
    pending: "right",
    food,
    creature: undefined,
    counter: 0,
    grow: false,
    swallow: false,
    crash: "alive",
    score: 0,
    largeAllowed: options.largeAllowed ?? true,
    collected: 0,
    visible: true,
  };
}

/** A key between steps: the pending heading, judged against the current one (H4, H5). */
export function snakeKey(state: SnakeState, phoneKey: PhoneKey): SnakeState {
  if (state.crash === "dead") return state;
  const pending = headingFor(phoneKey, state.heading);
  return pending === undefined ? state : { ...state, pending };
}

/** One tick of the firmware's game (the RE notes' "One tick", steps 1-14). */
export function stepSnake(state: SnakeState): SnakeStep {
  if (state.crash === "dead") return { state, cues: [], events: [] };
  // The large creature changes picture at the start of every step (H9).
  if (state.creature?.kind === "large" && state.creature.shown) {
    state = {
      ...state,
      creature: { ...state.creature, frame: state.creature.frame === 1 ? 2 : 1 },
    };
  }
  const heading = state.pending;
  const head = state.segments.at(-1)!;
  const next = ahead(head, heading);

  // Blocked: walls and segments, except the tail's cell unless the snake grows this step (H6).
  const taken = new Set(
    [...wallCells(state.maze), ...(state.grow ? state.segments : state.segments.slice(1))].map(key),
  );
  if (taken.has(key(next))) {
    if (state.crash === "alive") {
      return {
        state: { ...state, heading, crash: "blocked" },
        cues: [],
        events: [{ kind: "crashed" }],
      };
    }
    return {
      state: { ...state, heading, crash: "dead" },
      cues: [{ kind: "crash" }, { kind: "vibrate", ms: SNAKE_VIBRATE_MS }],
      events: [{ kind: "died" }],
    };
  }

  // The tail leaves unless the last step ate; the new tail points at the next segment (H7).
  let segments = [...state.segments];
  let ring = state.ring;
  if (!state.grow) {
    segments = segments.slice(1);
    ring = { ...ring, tail: (ring.tail + 1) % RING };
    const toward = segments[1]?.heading ?? heading;
    segments[0] = { ...segments[0]!, picture: `tail/${toward}` };
  }

  // The head steps on; its mouth opens when the next cell holds the food or a creature (H13).
  // A head entering a creature first clears the creature's cells beyond it, so it stays shut
  // (bot-long, tick 266).
  const beyond = ahead(next, heading);
  const entering = state.creature?.cells.some((c) => key(c) === key(next)) ?? false;
  const open =
    (state.food !== undefined && key(state.food) === key(beyond)) ||
    (!entering && (state.creature?.cells.some((c) => key(c) === key(beyond)) ?? false));
  const neck = segments.length - 1;
  segments[neck] = {
    ...segments[neck]!,
    picture: neckPicture(state.previous, heading, state.swallow),
  };
  segments.push({ ...next, heading, picture: open ? `head-open/${heading}` : `head/${heading}` });
  ring = { ...ring, head: (ring.head + 1) % RING };

  let after: SnakeState = {
    ...state,
    segments,
    ring,
    heading,
    previous: heading,
    swallow: false,
    crash: "alive",
  };
  const cues: StockCue[] = [];
  const events: SnakeEvent[] = [];
  const rng = createSnakeRandom(state.seed);
  const occupied = new Set([...wallCells(state.maze), ...segments].map(key));
  const free = (x: number, y: number) => !occupied.has(`${x},${y}`);

  // A creature: eaten when the head enters one of its cells, else one step less to live (H10).
  const creature = after.creature;
  if (creature?.shown && creature.cells.some((c) => key(c) === key(next))) {
    const points = 5 * after.level + 5 + 2 * after.counter;
    let collected = after.collected;
    if (creature.kind === "large") {
      // The large creature sets a random clear collection bit (RE, UNVERIFIED: never eaten).
      let bit = rng.next() % 10;
      while (collected & (1 << bit) && collected !== 0x3ff) bit = rng.next() % 10;
      collected |= 1 << bit;
    }
    after = {
      ...after,
      creature: undefined,
      counter: 0,
      score: after.score + points,
      swallow: true,
      collected,
      largeAllowed: after.largeAllowed && creature.kind !== "large",
    };
    cues.push({ kind: "eat" }, { kind: "vibrate", ms: SNAKE_VIBRATE_MS });
    events.push({ kind: "ate", what: "creature", points });
  } else if (creature && after.counter > 0) {
    const counter = after.counter - 1;
    after = { ...after, counter, ...(counter === 0 ? { creature: undefined } : {}) };
  }

  // Food: + level, new food, and the tail stays on the next step (H7, H8). While no creature
  // is out the counter gains 4; at 20, with no creature cells in use, one comes (H9).
  const ate = after.food !== undefined && key(after.food) === key(next);
  after = { ...after, grow: ate };
  if (ate) {
    const food = placeFood(rng, free, after.creature?.cells ?? []);
    after = { ...after, food, score: after.score + after.level, swallow: true };
    if (!after.creature?.shown) after = { ...after, counter: after.counter + 4 };
    if (after.creature === undefined && after.counter >= 20) {
      const placed = placeCreature(rng, free, food, after.largeAllowed);
      after = {
        ...after,
        creature: { kind: placed.kind, cells: placed.cells, shown: placed.placed, frame: 1 },
        // A failed spawn leaves its last try's cells and resets the counter (RE, UNVERIFIED).
        counter: placed.placed ? after.counter : 0,
      };
    }
    cues.push({ kind: "eat" }, { kind: "vibrate", ms: SNAKE_VIBRATE_MS });
    events.push({ kind: "ate", what: "food", points: state.level });
  }
  return { state: { ...after, seed: rng.seed }, cues, events };
}

/**
 * One step of the death blink: the snake hidden, then shown, in turn (H11). The firmware walks
 * its ring from the tail's slot to the head's and does nothing when the ring has wrapped (the
 * tail's slot above the head's), so such a snake stands still.
 */
export function blinkSnake(state: SnakeState): SnakeState {
  if (state.crash !== "dead" || state.ring.tail > state.ring.head) return state;
  return { ...state, visible: !state.visible };
}

/** What the painter draws (H16: the score's low 16 bits). */
export function snakeRender(state: SnakeState): SnakeRenderModel {
  const creature = state.creature?.shown ? state.creature : undefined;
  return {
    maze: state.maze,
    segments: state.visible ? state.segments : [],
    ...(state.food ? { food: state.food } : {}),
    ...(creature
      ? {
          creature: { kind: creature.kind, cells: creature.cells, frame: creature.frame },
          countdown: state.counter,
        }
      : {}),
    score: state.score & 0xffff,
  };
}
