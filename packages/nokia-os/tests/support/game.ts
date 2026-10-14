// Snake II gameplay goldens replayed through the engine (plan 23 Tasks 7-8): each recorded
// game's level, maze and recovered seed (Task 5), and the engine state at every board the golden
// shows, driven by the golden's `input`.
import type { PhoneKey } from "@hellotimber/phone-core";
import { expect } from "vite-plus/test";
import { isBoardFrame } from "../../scripts/game-capture-set.ts";
import { findGoldenImage } from "../../scripts/golden-format.ts";
import { newSnakeGame, snakeKey, snakeRender, stepSnake } from "../../src/games/snake/engine";
import type { SnakeState } from "../../src/games/snake/model";
import { SNAKE_FIRST_TICK, SNAKE_GRACE_MS, SNAKE_MAZES, SNAKE_PERIODS } from "../../src/resources";
import {
  GAME_TICK_TOLERANCE_MS,
  lcdMismatch,
  TIMING_TOLERANCE_MS,
  type RecordedFrame,
} from "./golden";
import { loadGolden } from "./goldens";
import { decodeBoard, goldenBoards, type TickBoard } from "./snake-decode";
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

/**
 * The crash interval (the last tick's frame to the first hidden frame) holds two firmware timer
 * events, the blocked tick and the grace tick, each within GAME_TICK_TOLERANCE_MS: the first
 * hidden frame comes 88-110 ms after the blocked tick in the captures, the saving move 93 ms.
 */
export const CRASH_TOLERANCE_MS = 2 * GAME_TICK_TOLERANCE_MS;

/** How a game timeline row's start is compared (D6). */
export type GameRowTiming =
  /** With the interval from the previous row (ticks; never cumulatively). */
  | { readonly kind: "interval"; readonly toleranceMs: number }
  /** With the time since row `anchor` (the death and what follows it). */
  | { readonly kind: "aligned"; readonly anchor: number; readonly toleranceMs: number };

/** One frame of a game timeline and how its start is compared. */
export interface GameRow {
  readonly startMs: number;
  readonly pixels: Uint8Array;
  readonly image: string;
  readonly timing: GameRowTiming;
}

/**
 * A gameplay timeline's rows from its trigger, as the session must show them (D6). A tick redraw
 * in two bursts counts once, with the first burst's start and the second's pixels. Tick
 * intervals allow GAME_TICK_TOLERANCE_MS; the crash interval CRASH_TOLERANCE_MS. The death
 * steps, the game-over screens and the return are aligned on the death's first frame (the
 * first hidden snake, or the game-over screen when the snake does not blink) and allow
 * GAME_TICK_TOLERANCE_MS: across the nine captured deaths the blink steps run 222-251 ms and
 * the note 2925-2954 ms, so ±2 ms does not hold.
 */
export function gameRows(id: string, level: number, maze = 0): GameRow[] {
  const golden = loadGolden(id);
  const trigger = golden.triggerFrame;
  if (!golden.timeline || typeof trigger !== "number") throw new Error(`${id}: not a timeline`);
  const period = SNAKE_PERIODS[level]!;
  const rows: GameRow[] = [];
  let anchor: number | undefined;
  let lastTick: number | undefined;
  for (const row of golden.timeline.slice(trigger)) {
    const pixels = findGoldenImage(golden, row.image).pixels;
    const board = isBoardFrame(pixels);
    const entry = (timing: GameRowTiming): GameRow => ({
      startMs: row.startMs,
      pixels,
      image: row.image,
      timing,
    });
    if (anchor !== undefined) {
      rows.push(entry({ kind: "aligned", anchor, toleranceMs: GAME_TICK_TOLERANCE_MS }));
      continue;
    }
    const hidden =
      board &&
      decodeBoard(pixels, SNAKE_MAZES[maze], `${id} image ${row.image}`).segments.length === 0;
    if (hidden || (!board && lastTick !== undefined)) {
      // The death begins: the snake hidden, or (no blink) the game-over screen.
      anchor = rows.length;
      rows.push(entry({ kind: "interval", toleranceMs: CRASH_TOLERANCE_MS }));
      continue;
    }
    if (board) {
      const last = lastTick === undefined ? undefined : rows[lastTick]!;
      if (last && row.startMs - last.startMs < Math.min(20, period / 2)) {
        // The second burst of a split redraw (Task 0): the tick shows these pixels.
        rows[lastTick!] = { ...last, pixels, image: row.image };
        continue;
      }
      lastTick = rows.length;
      rows.push(entry({ kind: "interval", toleranceMs: GAME_TICK_TOLERANCE_MS }));
      continue;
    }
    rows.push(entry({ kind: "interval", toleranceMs: TIMING_TOLERANCE_MS }));
  }
  return rows;
}

/**
 * Compares a recording made from the trigger with `gameRows`: pixels exactly, starts per each
 * row's timing (D6). With `returns`, the last row is the screen the flow returns to (drawn by
 * the kernel): the flow must exit when it starts.
 */
export function expectGameTimeline(
  recording: { readonly frames: readonly RecordedFrame[]; readonly exitMs?: number },
  id: string,
  rows: readonly GameRow[],
  options: { readonly returns: boolean },
): void {
  const shown = options.returns ? rows.slice(0, -1) : rows;
  const starts = recording.frames.map((f) => f.startMs);
  if (options.returns) {
    expect(recording.frames.length, `${id}: extra frames before the return`).toBe(shown.length);
    expect(recording.exitMs, `${id}: the flow never exited`).toBeDefined();
    starts[shown.length] = recording.exitMs!;
  }
  rows.forEach((row, i) => {
    const context = `${id} image ${row.image} (row ${i} from the trigger)`;
    if (i < shown.length) {
      const frame = recording.frames[i];
      expect(frame, `${context}: never shown`).toBeDefined();
      const mismatch = lcdMismatch(
        frame!.pixels,
        { id, image: { name: row.image, pixels: row.pixels } },
        context,
      );
      if (mismatch !== undefined) throw new Error(mismatch);
    }
    if (i === 0) return;
    const from = row.timing.kind === "interval" ? i - 1 : row.timing.anchor;
    const ours = starts[i]! - starts[from]!;
    const golden = row.startMs - rows[from]!.startMs;
    expect(
      Math.abs(ours - golden),
      `${context}: ${ours} ms after row ${from}, golden ${golden} ms`,
    ).toBeLessThanOrEqual(row.timing.toleranceMs);
  });
}

/**
 * When each engine tick of a replayed game comes, from the New game frame: the first after
 * SNAKE_FIRST_TICK, then one per period, and a grace after a blocked step (D6, H6). Index n is
 * tick n (tick 0, the New game frame, at 0).
 */
export function tickSchedule(trace: SnakeTrace, ticks: number): number[] {
  const keys = inputByTick(`game/snake/${trace.id}`);
  const period = SNAKE_PERIODS[trace.level]!;
  let state = newSnakeGame(trace);
  const times = [0];
  let next = SNAKE_FIRST_TICK[trace.level]!;
  for (let tick = 1; tick <= ticks; tick++) {
    times.push(times[tick - 1]! + next);
    state = (keys.get(tick - 1) ?? []).reduce(snakeKey, state);
    const { state: after, events } = stepSnake(state);
    state = after;
    next = events.some((e) => e.kind === "crashed") ? SNAKE_GRACE_MS : period;
  }
  return times;
}
