// The Snake II engine (plan 23 Tasks 6-7): rules on hand-built states (H1-H11, H16). Each rule
// was confirmed by Task 0's captures; the trace tests replay the recorded games.
import type { PhoneKey } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import {
  blinkSnake,
  newSnakeGame,
  snakeKey,
  snakeRender,
  stepSnake,
  type SnakeStep,
} from "../src/games/snake/engine";
import type { Heading, Segment, SnakeState } from "../src/games/snake/model";
import { SNAKE_MAZES } from "../src/resources";
import { loadGolden } from "./support/goldens";
import { goldenBoards } from "./support/snake-decode";
import { INDEX } from "./support/tree";

/** A game at 10:10's seed (first food (14, 8)) with the given overrides. */
function game(overrides: Partial<SnakeState> = {}, maze = 0, level = 1): SnakeState {
  return { ...newSnakeGame({ level, maze, seed: 44530 }), ...overrides };
}

/** A straight snake from `cells` (tail first), every segment reached heading `heading`. */
function snake(cells: readonly [number, number][], heading: Heading): Segment[] {
  return cells.map(([x, y], i) => ({
    x,
    y,
    heading,
    picture:
      i === 0 ? `tail/${heading}` : i === cells.length - 1 ? `head/${heading}` : `body/${heading}`,
  }));
}

const cells = (state: SnakeState) => state.segments.map((s) => `${s.x},${s.y}`);
const head = (state: SnakeState) => state.segments.at(-1)!;
const pictures = (state: SnakeState) => state.segments.map((s) => s.picture);

function run(state: SnakeState, steps: number): SnakeStep {
  let result: SnakeStep = { state, cues: [], events: [] };
  for (let i = 0; i < steps; i++) result = stepSnake(result.state);
  return result;
}

const press = (state: SnakeState, ...keys: PhoneKey[]) => keys.reduce(snakeKey, state);

describe("New game (H1, H2)", () => {
  it("lays seven segments from the start cell + 1, heading right, head on the right", () => {
    const state = newSnakeGame({ level: 1, maze: 0, seed: 44530 });
    expect(cells(state)).toEqual(["5,4", "6,4", "7,4", "8,4", "9,4", "10,4", "11,4"]);
    expect(pictures(state)).toEqual([
      "tail/right",
      "body/right",
      "body/right",
      "body/right",
      "body/right",
      "body/right",
      "head/right",
    ]);
    expect([state.heading, state.pending, state.score, state.crash]).toEqual([
      "right",
      "right",
      0,
      "alive",
    ]);
  });

  it("starts each maze from its start cell", () => {
    const starts = [0, 1, 2, 3, 4, 5].map(
      (maze) => cells(newSnakeGame({ level: 1, maze, seed: 44530 }))[0],
    );
    expect(starts).toEqual(["5,4", "5,4", "1,4", "1,5", "5,7", "5,4"]);
  });

  it("places the first food from the seed, retrying wall cells (Maze 1: (14, 8) is wall)", () => {
    expect(newSnakeGame({ level: 1, maze: 0, seed: 44530 }).food).toEqual({ x: 14, y: 8 });
    expect(newSnakeGame({ level: 1, maze: 1, seed: 44530 }).food).toEqual({ x: 12, y: 1 });
  });
});

describe("movement (H1, H4)", () => {
  it("moves one cell per step: the head steps on, the tail leaves", () => {
    const { state } = run(game(), 1);
    expect(cells(state)).toEqual(["6,4", "7,4", "8,4", "9,4", "10,4", "11,4", "12,4"]);
    expect(pictures(state)).toEqual([
      "tail/right",
      "body/right",
      "body/right",
      "body/right",
      "body/right",
      "body/right",
      "head/right",
    ]);
  });

  it("wraps at every edge without a maze", () => {
    const right = run(
      game({
        segments: snake(
          [
            [18, 2],
            [19, 2],
          ],
          "right",
        ),
      }),
      1,
    ).state;
    expect(head(right)).toMatchObject({ x: 0, y: 2 });
    const left = run(
      game({
        segments: snake(
          [
            [1, 2],
            [0, 2],
          ],
          "left",
        ),
        heading: "left",
        previous: "left",
        pending: "left",
      }),
      1,
    ).state;
    expect(head(left)).toMatchObject({ x: 19, y: 2 });
    const up = run(
      game({
        segments: snake(
          [
            [3, 1],
            [3, 0],
          ],
          "up",
        ),
        heading: "up",
        previous: "up",
        pending: "up",
      }),
      1,
    ).state;
    expect(head(up)).toMatchObject({ x: 3, y: 8 });
    const down = run(
      game({
        segments: snake(
          [
            [3, 7],
            [3, 8],
          ],
          "down",
        ),
        heading: "down",
        previous: "down",
        pending: "down",
      }),
      1,
    ).state;
    expect(head(down)).toMatchObject({ x: 3, y: 0 });
  });

  it("turns at the next step with a corner where the head turned", () => {
    const turned = run(press(game(), "2"), 1).state;
    expect(head(turned)).toMatchObject({ x: 11, y: 3, picture: "head/up" });
    expect(turned.segments.at(-2)).toMatchObject({ x: 11, y: 4, picture: "corner/up-left" });
    const down = run(press(turned, "6"), 1).state;
    expect(down.segments.at(-2)).toMatchObject({ x: 11, y: 3, picture: "corner/down-right" });
  });

  it("names corners by the edges they join, for all eight turns", () => {
    const turns: [Heading, PhoneKey, string][] = [
      ["right", "2", "corner/up-left"],
      ["right", "8", "corner/down-left"],
      ["left", "2", "corner/up-right"],
      ["left", "8", "corner/down-right"],
      ["up", "4", "corner/down-left"],
      ["up", "6", "corner/down-right"],
      ["down", "4", "corner/up-left"],
      ["down", "6", "corner/up-right"],
    ];
    for (const [heading, key, corner] of turns) {
      // Three cells in a line ending at (10, 4), all reached heading `heading`.
      const back = { right: [-1, 0], left: [1, 0], up: [0, 1], down: [0, -1] }[heading];
      const line = [2, 1, 0].map((i): [number, number] => [10 + back[0]! * i, 4 + back[1]! * i]);
      const start = game({
        segments: snake(line, heading),
        heading,
        previous: heading,
        pending: heading,
        food: { x: 0, y: 0 },
      });
      const next = run(press(start, key), 1);
      expect(next.state.segments.at(-2)!.picture, `${heading} then ${key}`).toBe(corner);
    }
  });

  it("re-pictures the new tail by the way to the next segment", () => {
    const turned = run(press(game(), "2"), 6).state;
    expect(turned.segments[0]).toMatchObject({ x: 11, y: 4, picture: "tail/up" });
  });
});

describe("keys (H4, H5)", () => {
  const right = game();
  const up = game({ heading: "up", previous: "up", pending: "up" });
  it.each([
    ["2", "up", "up"],
    ["8", "down", "up"],
    ["4", "right", "left"],
    ["6", "right", "right"],
    ["1", "up", "left"],
    ["3", "up", "right"],
    ["7", "down", "left"],
    ["9", "down", "right"],
    ["#", "down", "right"],
    ["down", "down", "right"],
    ["*", "up", "left"],
    ["up", "up", "left"],
    ["0", "right", "up"],
    ["5", "right", "up"],
  ] as const)("%s: heading right → %s, heading up → %s", (key, fromRight, fromUp) => {
    expect(snakeKey(right, key).pending).toBe(fromRight);
    expect(snakeKey(up, key).pending).toBe(fromUp);
  });

  it("ignores the reverse key; the last key before a step wins", () => {
    expect(snakeKey(right, "4").pending).toBe("right");
    expect(press(right, "2", "8").pending).toBe("down");
    expect(press(right, "2", "4").pending).toBe("up");
    expect(press(right, "8", "2").pending).toBe("up");
  });

  it("judges every key against the current heading, not the pending one", () => {
    // Heading right: 2 makes up pending; # still turns clockwise from right (down).
    expect(press(right, "2", "#").pending).toBe("down");
  });

  it("ignores keys after the death", () => {
    const dead = game({ crash: "dead" });
    expect(snakeKey(dead, "2").pending).toBe("right");
  });
});

describe("collisions and the grace tick (H1, H6)", () => {
  const boxed = () =>
    game(
      {
        segments: snake(
          [
            [15, 4],
            [16, 4],
            [17, 4],
            [18, 4],
          ],
          "right",
        ),
      },
      1,
    );

  it("blocks on a wall: the snake stands, then dies on the second blocked step", () => {
    const first = stepSnake(boxed());
    expect(first.events).toEqual([{ kind: "crashed" }]);
    expect(first.cues).toEqual([]);
    expect(cells(first.state)).toEqual(cells(boxed()));
    expect(first.state.crash).toBe("blocked");
    const second = stepSnake(first.state);
    expect(second.events).toEqual([{ kind: "died" }]);
    expect(second.cues).toEqual([{ kind: "crash" }, { kind: "vibrate", ms: 480 }]);
    expect(second.state.crash).toBe("dead");
    expect(cells(second.state)).toEqual(cells(boxed()));
    expect(stepSnake(second.state).events).toEqual([]);
  });

  it("saves the snake on a turn during the grace: perpendicular to the blocked heading", () => {
    const blocked = stepSnake(boxed()).state;
    const saved = stepSnake(snakeKey(blocked, "2"));
    expect(saved.events).toEqual([]);
    expect(saved.state.crash).toBe("alive");
    expect(head(saved.state)).toMatchObject({ x: 18, y: 3 });
  });

  it("makes the blocked heading current, so turning back is a reversal and dies", () => {
    // Heading left along row 4 under the body on row 3, 2 turns the snake into its side: blocked,
    // and up becomes the heading the grace key is judged against.
    const segments: Segment[] = [
      { x: 6, y: 3, heading: "right", picture: "tail/right" },
      { x: 7, y: 3, heading: "right", picture: "body/right" },
      { x: 8, y: 3, heading: "right", picture: "body/right" },
      { x: 9, y: 3, heading: "right", picture: "corner/down-left" },
      { x: 9, y: 4, heading: "down", picture: "corner/up-left" },
      { x: 8, y: 4, heading: "left", picture: "body/left" },
      { x: 7, y: 4, heading: "left", picture: "head/left" },
    ];
    const start = game({ segments, heading: "left", previous: "left", pending: "left" });
    const blocked = stepSnake(snakeKey(start, "2"));
    expect(blocked.events).toEqual([{ kind: "crashed" }]);
    expect(blocked.state.heading).toBe("up");
    expect(snakeKey(blocked.state, "8").pending).toBe("up");
    expect(stepSnake(snakeKey(blocked.state, "8")).events).toEqual([{ kind: "died" }]);
    expect(stepSnake(snakeKey(blocked.state, "4")).events).toEqual([]);
  });

  it("dies on the body; the tail's cell is free unless the snake grows this step", () => {
    const ring = (grow: boolean) =>
      game({
        segments: [
          { x: 5, y: 5, heading: "up", picture: "tail/right" },
          { x: 6, y: 5, heading: "right", picture: "corner/down-right" },
          { x: 6, y: 4, heading: "up", picture: "corner/down-left" },
          { x: 5, y: 4, heading: "left", picture: "head/left" },
        ],
        heading: "left",
        previous: "left",
        pending: "down",
        grow,
      });
    expect(stepSnake(ring(false)).events).toEqual([]);
    expect(stepSnake(ring(true)).events).toEqual([{ kind: "crashed" }]);
  });
});

describe("food, growth and score (H7, H8, H13, H16)", () => {
  const nearFood = () =>
    game({
      segments: snake(
        [
          [9, 8],
          [10, 8],
          [11, 8],
          [12, 8],
          [13, 8],
        ],
        "right",
      ),
    });

  it("opens the mouth when the cell ahead holds the food", () => {
    const { state } = run(
      game({
        segments: snake(
          [
            [10, 8],
            [11, 8],
            [12, 8],
          ],
          "right",
        ),
      }),
      1,
    );
    expect(head(state).picture).toBe("head-open/right");
  });

  it("eats: score + level, new food, the cues; the tail stays once on the next step", () => {
    const ate = stepSnake(nearFood());
    expect(ate.events).toEqual([{ kind: "ate", what: "food", points: 1 }]);
    expect(ate.cues).toEqual([{ kind: "eat" }, { kind: "vibrate", ms: 480 }]);
    expect(ate.state.score).toBe(1);
    expect(ate.state.food).not.toEqual({ x: 14, y: 8 });
    expect(ate.state.segments).toHaveLength(5);
    const grown = stepSnake(ate.state).state;
    expect(grown.segments).toHaveLength(6);
    expect(cells(grown)[0]).toBe("10,8");
    expect(stepSnake(grown).state.segments).toHaveLength(6);
  });

  it("scores the level per meal", () => {
    const fast = { ...nearFood(), level: 175 };
    expect(stepSnake(fast).state.score).toBe(175);
  });

  it("draws the eaten cell fat once the head leaves it, and keeps it fat down the body", () => {
    const ate = stepSnake(nearFood()).state;
    const after = stepSnake(ate).state;
    expect(after.segments.at(-2)).toMatchObject({ x: 14, y: 8, picture: "body-fat/right" });
    const later = run(after, 3).state;
    expect(later.segments.find((s) => s.x === 14 && s.y === 8)!.picture).toBe("body-fat/right");
  });

  it("draws a fat corner when the head turns off the eaten cell", () => {
    const ate = stepSnake(nearFood()).state;
    const turned = stepSnake(snakeKey(ate, "2")).state;
    expect(turned.segments.at(-2)).toMatchObject({ x: 14, y: 8, picture: "corner-fat/up-left" });
  });

  it("places the new food on the free cells of the board after the move (seed 44530: (19, 7))", () => {
    // bot-long: the first meal at (14, 8) puts the food at (19, 7).
    expect(stepSnake(nearFood()).state.food).toEqual({ x: 19, y: 7 });
  });

  it("shows the score's low 16 bits (H16; the four-digit rendering is the painter's)", () => {
    expect(snakeRender(game({ score: 65536 + 42 })).score).toBe(42);
    expect(snakeRender(game({ score: 105 })).score).toBe(105);
  });
});

describe("creatures (H9, H10)", () => {
  /** A game whose next step eats the food at (14, 8), with `counter` set. */
  const beforeMeal = (counter: number, overrides: Partial<SnakeState> = {}) =>
    game({
      segments: snake(
        [
          [9, 8],
          [10, 8],
          [11, 8],
          [12, 8],
          [13, 8],
        ],
        "right",
      ),
      counter,
      ...overrides,
    });

  it("counts 4 per meal while none is out and brings one on the fifth meal, countdown 20", () => {
    const fourth = stepSnake(beforeMeal(12)).state;
    expect([fourth.counter, fourth.creature]).toEqual([16, undefined]);
    const fifth = stepSnake(beforeMeal(16));
    expect(fifth.state.counter).toBe(20);
    expect(fifth.state.creature).toMatchObject({ shown: true, frame: 1 });
    const render = snakeRender(fifth.state);
    expect(render.countdown).toBe(20);
    expect(render.creature?.cells).toEqual(fifth.state.creature!.cells);
  });

  it("keeps the creature out of the new food's row and column, and the food out of its", () => {
    const spawned = stepSnake(beforeMeal(16)).state;
    const food = spawned.food!;
    for (const c of spawned.creature!.cells) {
      expect(c.x).not.toBe(food.x);
      expect(c.y).not.toBe(food.y);
    }
  });

  it("counts down one per step and goes when the countdown reaches 0", () => {
    let state = stepSnake(beforeMeal(16)).state;
    for (let left = 19; left >= 1; left--) {
      state = stepSnake(state).state;
      expect(snakeRender(state).countdown).toBe(left);
    }
    state = stepSnake(state).state;
    expect(state.creature).toBeUndefined();
    expect(state.counter).toBe(0);
    expect(snakeRender(state).countdown).toBeUndefined();
  });

  it("does not count meals while a creature is out", () => {
    const creature = {
      kind: 2,
      cells: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ],
      shown: true,
      frame: 1,
    } as const;
    const after = stepSnake(beforeMeal(9, { creature })).state;
    expect(after.counter).toBe(8);
    expect(after.food!.x === 2 || after.food!.x === 3 || after.food!.y === 1).toBe(false);
  });

  it("scores 5 × level + 5 + 2 × the steps left on eating, without growing, with a fat neck", () => {
    const creature = {
      kind: 4,
      cells: [
        { x: 14, y: 8 },
        { x: 15, y: 8 },
      ],
      shown: true,
      frame: 1,
    } as const;
    const start = beforeMeal(11, { creature, food: { x: 3, y: 3 }, level: 9 });
    const ate = stepSnake(start);
    expect(ate.events).toEqual([{ kind: "ate", what: "creature", points: 45 + 5 + 22 }]);
    expect(ate.cues).toEqual([{ kind: "eat" }, { kind: "vibrate", ms: 480 }]);
    expect(ate.state.score).toBe(72);
    expect([ate.state.creature, ate.state.counter, ate.state.grow]).toEqual([undefined, 0, false]);
    const next = stepSnake(ate.state).state;
    expect(next.segments).toHaveLength(5);
    expect(next.segments.at(-2)).toMatchObject({ x: 14, y: 8, picture: "body-fat/right" });
  });

  it("opens the mouth before a creature cell", () => {
    const creature = {
      kind: 0,
      cells: [
        { x: 15, y: 2 },
        { x: 16, y: 2 },
      ],
      shown: true,
      frame: 1,
    } as const;
    const start = game({
      segments: snake(
        [
          [11, 2],
          [12, 2],
          [13, 2],
        ],
        "right",
      ),
      creature,
      counter: 10,
    });
    expect(head(stepSnake(start).state).picture).toBe("head-open/right");
  });

  it("alternates the large creature's two pictures every step", () => {
    const creature = {
      kind: "large",
      cells: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
      ],
      shown: true,
      frame: 1,
    } as const;
    const one = stepSnake(game({ creature, counter: 15 })).state;
    expect(one.creature?.frame).toBe(2);
    expect(stepSnake(one).state.creature?.frame).toBe(1);
  });

  it("eats the large creature once a game: a collected bit, and no large one after (RE, UNVERIFIED)", () => {
    const creature = {
      kind: "large",
      cells: [
        { x: 14, y: 7 },
        { x: 15, y: 7 },
        { x: 14, y: 8 },
        { x: 15, y: 8 },
      ],
      shown: true,
      frame: 1,
    } as const;
    const ate = stepSnake(beforeMeal(5, { creature, food: { x: 3, y: 3 } }));
    expect(ate.events).toEqual([{ kind: "ate", what: "creature", points: 5 + 5 + 10 }]);
    expect(ate.state.largeAllowed).toBe(false);
    expect(ate.state.collected).not.toBe(0);
    expect(ate.state.collected & ~0x3ff).toBe(0);
  });

  it("leaves a failed spawn's cells in place, hidden, with the counter at 0 (RE, UNVERIFIED)", () => {
    // Rows 0-7 full of snake and row 8 the only room: every pair shares the new food's row.
    const path: [number, number][] = [];
    for (let y = 0; y < 8; y++) {
      for (let i = 0; i < 20; i++) path.push([y % 2 === 0 ? i : 19 - i, y]);
    }
    for (let x = 0; x <= 5; x++) path.push([x, 8]);
    const segments: Segment[] = path.map(([x, y], i) => ({
      x,
      y,
      heading: "right",
      picture: i === path.length - 1 ? "head/right" : "body/right",
    }));
    const start = game({ segments, food: { x: 6, y: 8 }, counter: 16, grow: true });
    const after = stepSnake(start).state;
    expect(after.food?.y).toBe(8);
    expect(after.creature).toMatchObject({ shown: false });
    expect([2, 4]).toContain(after.creature!.cells.length);
    expect(after.counter).toBe(0);
    expect(snakeRender(after).creature).toBeUndefined();
    expect(snakeRender(after).countdown).toBeUndefined();
  });
});

describe("death and the ring (H11)", () => {
  const dying = () => {
    const boxed = game(
      {
        segments: snake(
          [
            [15, 4],
            [16, 4],
            [17, 4],
            [18, 4],
          ],
          "right",
        ),
      },
      1,
    );
    return stepSnake(stepSnake(boxed).state).state;
  };

  it("blinks the dead snake: hidden, shown, hidden, …", () => {
    const dead = dying();
    expect(dead.crash).toBe("dead");
    const hidden = blinkSnake(dead);
    expect(snakeRender(hidden).segments).toEqual([]);
    const shown = blinkSnake(hidden);
    expect(snakeRender(shown).segments).toEqual(dead.segments);
    expect(blinkSnake(game())).toEqual(game());
  });

  it("keeps the ring slots: head at start + 7, tail at start + 1, one slot per step, mod 299", () => {
    expect(game().ring).toEqual({ head: 11, tail: 5 });
    expect(newSnakeGame({ level: 1, maze: 2, seed: 1 }).ring).toEqual({ head: 7, tail: 1 });
    expect(run(game(), 3).state.ring).toEqual({ head: 14, tail: 8 });
    expect(stepSnake(game({ ring: { head: 298, tail: 292 } })).state.ring).toEqual({
      head: 0,
      tail: 293,
    });
  });

  it("does not blink a snake whose ring has wrapped (the tail's slot above the head's)", () => {
    const dead = { ...dying(), ring: { head: 9, tail: 271 } };
    expect(blinkSnake(dead)).toBe(dead);
  });
});

/** Every gameplay golden the engine replays: its level, maze and recovered seed (Task 5). */
const TRACES: readonly { id: string; level: number; maze: number; seed: number }[] = [
  { id: "bot-long", level: 1, maze: 0, seed: 44530 },
  { id: "bot-short", level: 2, maze: 0, seed: 44530 },
  { id: "bot-maze2", level: 1, maze: 2, seed: 44530 },
  { id: "bot-maze3", level: 1, maze: 3, seed: 44530 },
  { id: "bot-grace", level: 1, maze: 0, seed: 44530 },
  { id: "pause-bot", level: 1, maze: 0, seed: 44530 },
  { id: "score-8", level: 1, maze: 0, seed: 44530 },
  { id: "seed-1010", level: 1, maze: 0, seed: 44530 },
  { id: "seed-1010-second", level: 1, maze: 0, seed: 44530 },
  { id: "seed-1011", level: 1, maze: 0, seed: 44590 },
  { id: "seed-1200", level: 1, maze: 0, seed: 51130 },
  { id: "seed-1948", level: 1, maze: 0, seed: 13689 },
  { id: "seed-0759", level: 1, maze: 0, seed: 36670 },
  { id: "seed-2359", level: 1, maze: 0, seed: 38909 },
  { id: "seed-0000", level: 1, maze: 0, seed: 7995 },
  { id: "seed-0001", level: 1, maze: 0, seed: 7995 },
  { id: "seed-1010-14102026", level: 1, maze: 0, seed: 10048 },
  { id: "creature-0914", level: 1, maze: 0, seed: 41170 },
  { id: "creature-0956", level: 1, maze: 0, seed: 43690 },
  { id: "creature-1007", level: 1, maze: 0, seed: 44350 },
  { id: "creature-1021", level: 1, maze: 0, seed: 45190 },
  { id: "creature-1035", level: 1, maze: 0, seed: 46030 },
  { id: "creature-1107", level: 1, maze: 0, seed: 47950 },
  { id: "creature-1221", level: 1, maze: 0, seed: 52390 },
  ...INDEX.filter((e) => /^game\/snake\/keys-(right|up|pair|hold)-/.test(e.id)).map((e) => ({
    id: e.id.slice("game/snake/".length),
    level: 1,
    maze: 0,
    seed: 44530,
  })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => ({
    id: `ticks-l${level}`,
    level,
    maze: 0,
    seed: 44530,
  })),
  ...[0, 1, 2, 3, 4, 5].map((maze) => ({ id: `maze-${maze}`, level: 1, maze, seed: 44530 })),
  { id: "virgin-meal", level: 175, maze: 0, seed: 44530 },
  { id: "virgin-game", level: 175, maze: 1, seed: 44530 },
];

describe("trace: the engine replays every gameplay golden (seed and input)", () => {
  for (const { id, level, maze, seed } of TRACES) {
    it(id, () => {
      const golden = loadGolden(`game/snake/${id}`);
      const boards = goldenBoards(`game/snake/${id}`, SNAKE_MAZES[maze]);
      expect(boards.length).toBeGreaterThan(0);
      const keys = new Map<number, PhoneKey[]>();
      for (const press of golden.input ?? []) {
        keys.set(press.tick, [...(keys.get(press.tick) ?? []), press.key as PhoneKey]);
      }
      let state = newSnakeGame({ level, maze, seed });
      let tick = 0;
      const stepTo = (target: number) => {
        for (; tick < target; tick++) {
          state = (keys.get(tick) ?? []).reduce(snakeKey, state);
          state = stepSnake(state).state;
        }
      };
      const cellsOf = (segments: readonly { x: number; y: number }[]) =>
        segments
          .map((s) => `${s.x},${s.y}`)
          .sort()
          .join(" ");
      // At level 175 (8 ms ticks) a meal's redraw runs into the next tick's, so the frames
      // number one tick fewer after each meal (virgin-meal, virgin-game): catch up by one.
      let lost = 0;
      for (const { tick: at, board } of boards) {
        stepTo(at + lost);
        if (level === 175 && cellsOf(snakeRender(state).segments) !== cellsOf(board.segments)) {
          lost++;
          stepTo(at + lost);
        }
        const where = `${id} tick ${at}${lost ? ` (engine tick ${at + lost})` : ""}`;
        const render = snakeRender(state);
        expect(render.score, where).toBe(board.score);
        expect(render.countdown, where).toBe(board.countdown);
        expect(render.food, where).toEqual(board.food);
        expect(
          render.creature && { kind: render.creature.kind, cells: render.creature.cells },
          where,
        ).toEqual(board.creature);
        const decoded = new Map(board.segments.map((s) => [`${s.x},${s.y}`, s.pictures]));
        expect(
          [...render.segments].map((s) => `${s.x},${s.y}`).sort(),
          `${where}: snake cells`,
        ).toEqual([...decoded.keys()].sort());
        for (const s of render.segments) {
          expect(decoded.get(`${s.x},${s.y}`), `${where}: (${s.x}, ${s.y}) ${s.picture}`).toContain(
            s.picture,
          );
        }
      }
    });
  }
});
