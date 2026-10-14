// Snake II gameplay goldens replayed through the engine (plan 23 Tasks 7-8): each recorded
// game's level, maze and recovered seed (Task 5), and the engine state at every board the golden
// shows, driven by the golden's `input`.
import type { PhoneKey } from "@hellotimber/phone-core";
import { newSnakeGame, snakeKey, snakeRender, stepSnake } from "../../src/games/snake/engine";
import type { SnakeState } from "../../src/games/snake/model";
import { SNAKE_MAZES } from "../../src/resources";
import { loadGolden } from "./goldens";
import { goldenBoards, type TickBoard } from "./snake-decode";
import { INDEX } from "./tree";

export interface SnakeTrace {
  /** The golden id without `game/snake/`. */
  readonly id: string;
  readonly level: number;
  readonly maze: number;
  readonly seed: number;
}

/** Every gameplay golden the engine replays: its level, maze and recovered seed (Task 5). */
export const SNAKE_TRACES: readonly SnakeTrace[] = [
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

/** A golden's `input` by tick, keys in order. */
export function inputByTick(id: string): Map<number, PhoneKey[]> {
  const keys = new Map<number, PhoneKey[]>();
  for (const press of loadGolden(id).input ?? []) {
    keys.set(press.tick, [...(keys.get(press.tick) ?? []), press.key as PhoneKey]);
  }
  return keys;
}

export interface ReplayedBoard extends TickBoard {
  /** The engine's state at the board. */
  readonly state: SnakeState;
  /** The engine's tick: the golden's, plus the ticks a level-175 meal's redraw hid. */
  readonly engineTick: number;
}

/** A trace's engine: `stepTo(n)` presses each tick's keys and steps until tick `n`. */
export function snakeReplay(trace: SnakeTrace) {
  const keys = inputByTick(`game/snake/${trace.id}`);
  let state = newSnakeGame(trace);
  let tick = 0;
  return {
    get state() {
      return state;
    },
    get tick() {
      return tick;
    },
    stepTo(target: number): void {
      for (; tick < target; tick++) {
        state = (keys.get(tick) ?? []).reduce(snakeKey, state);
        state = stepSnake(state).state;
      }
    },
  };
}

const cellsOf = (segments: readonly { x: number; y: number }[]) =>
  segments
    .map((s) => `${s.x},${s.y}`)
    .sort()
    .join(" ");

/**
 * The golden's boards with the engine's state at each. At level 175 (8 ms ticks) a meal's redraw
 * runs into the next tick's, so the frames number one tick fewer after each meal (virgin-meal,
 * virgin-game): the replay catches up by one there.
 */
export function replayBoards(trace: SnakeTrace): ReplayedBoard[] {
  const replay = snakeReplay(trace);
  let lost = 0;
  return goldenBoards(`game/snake/${trace.id}`, SNAKE_MAZES[trace.maze]).map((board) => {
    replay.stepTo(board.tick + lost);
    if (
      trace.level === 175 &&
      cellsOf(snakeRender(replay.state).segments) !== cellsOf(board.board.segments)
    ) {
      lost++;
      replay.stepTo(board.tick + lost);
    }
    return { ...board, state: replay.state, engineTick: replay.tick };
  });
}
