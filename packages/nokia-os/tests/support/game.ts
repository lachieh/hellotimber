// Snake II gameplay goldens replayed through the engine (plan 23 Tasks 7-8): each recorded
// game's level, maze and recovered seed (Task 5), and the engine state at every board the golden
// shows, driven by the golden's `input`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PhoneKey } from "@hellotimber/phone-core";
import { expect } from "vite-plus/test";
import { isBoardFrame } from "../../scripts/game-capture-set.ts";
import { findGoldenImage, LCD_WIDTH, parseTickGolden } from "../../scripts/golden-format.ts";
import { newSnakeGame, snakeKey, snakeRender, stepSnake } from "../../src/games/snake/engine";
import type { SnakeState } from "../../src/games/snake/model";
import {
  SNAKE_FIRST_TICK,
  SNAKE_GRACE_MS,
  SNAKE_MAZES,
  SNAKE_PERIODS,
  WIDGET_SPRITES,
} from "../../src/resources";
import { goto } from "./drive";
import {
  expectLcd,
  expectTimeline,
  lcdMismatch,
  periodToleranceMs,
  timingToleranceMs,
  type RecordedFrame,
  type RecordedTimeline,
} from "./golden";
import { goldenImage, loadGolden } from "./goldens";
import { keys, SNAKE, stills, TAP_MS, timeline } from "./probes";
import { SEED_1010, standbyRig, type Rig } from "./rig";
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

/** How a game timeline row's start is compared (D6). */
export type GameRowTiming =
  /** With the interval from the previous row (ticks; never cumulatively). */
  | { readonly kind: "interval" }
  /** With the time since row `anchor` (the death blink, the game-over note). */
  | { readonly kind: "aligned"; readonly anchor: number }
  /** Pixels and order only (the fireworks pictures after the first). */
  | { readonly kind: "untimed" };

/** One frame of a game timeline and how its start is compared. */
export interface GameRow {
  readonly startMs: number;
  readonly pixels: Uint8Array;
  readonly image: string;
  /** An engine tick's board (the capture may have missed ticks before it, at level 175). */
  readonly tick: boolean;
  readonly timing: GameRowTiming;
}

/**
 * A gameplay timeline's rows from its trigger, as the session must show them (D6). A tick redraw
 * in two bursts counts once, with the first burst's start and the second's pixels. Each row's
 * start is compared by the fidelity standard from its reference: a tick from the row before by
 * `periodToleranceMs` (the game's rhythm), the crash and the game-over screens from the row before
 * by `timingToleranceMs` (never cumulatively); the death steps from
 * the first hidden snake (across the nine captured deaths they run 222-251 ms); the game-over
 * note from the first game-over screen. The fireworks pictures after the first are compared by
 * pixels and order only: their steps differ between recordings by up to 37 ms (62 ms summed),
 * although the sequence takes 2871-2872 ms in both.
 */
export function gameRows(id: string, level: number, maze = 0): GameRow[] {
  const golden = loadGolden(id);
  const trigger = golden.triggerFrame;
  if (!golden.timeline || typeof trigger !== "number") throw new Error(`${id}: not a timeline`);
  const period = SNAKE_PERIODS[level]!;
  const rows: GameRow[] = [];
  let anchor: number | undefined;
  let lastTick: number | undefined;
  let overAt: number | undefined;
  let noteAt: number | undefined;
  for (const row of golden.timeline.slice(trigger)) {
    const pixels = findGoldenImage(golden, row.image).pixels;
    const board = isBoardFrame(pixels);
    const entry = (timing: GameRowTiming, tick = false): GameRow => ({
      startMs: row.startMs,
      pixels,
      image: row.image,
      tick,
      timing,
    });
    if (overAt !== undefined || (!board && (anchor !== undefined || lastTick !== undefined))) {
      // The game-over screens (with no blink, the death begins with them) and the return.
      if (overAt === undefined) {
        overAt = rows.length;
        rows.push(entry({ kind: "interval" }));
      } else if (noteAt === undefined && showsNote(pixels)) {
        noteAt = rows.length;
        rows.push(entry({ kind: "aligned", anchor: overAt }));
      } else if (noteAt === undefined) {
        rows.push(entry({ kind: "untimed" }));
      } else {
        rows.push(entry({ kind: "interval" }));
      }
      continue;
    }
    if (anchor !== undefined) {
      rows.push(entry({ kind: "aligned", anchor }));
      continue;
    }
    if (!board) {
      rows.push(entry({ kind: "interval" }));
      continue;
    }
    const where = `${id} image ${row.image}`;
    if (decodeBoard(pixels, SNAKE_MAZES[maze], where).segments.length === 0) {
      // The death begins: the snake hidden.
      anchor = rows.length;
      rows.push(entry({ kind: "interval" }));
      continue;
    }
    const last = lastTick === undefined ? undefined : rows[lastTick]!;
    if (last && row.startMs - last.startMs < Math.min(20, period / 2)) {
      // The second burst of a split redraw (Task 0): the tick shows these pixels.
      rows[lastTick!] = { ...last, pixels, image: row.image };
      continue;
    }
    lastTick = rows.length;
    rows.push(entry({ kind: "interval" }, true));
  }
  return rows;
}

/** The game-over note's first line, `Game over!` (the fireworks show none). */
function showsNote(pixels: Uint8Array): boolean {
  const title = WIDGET_SPRITES["game-over/title"]!;
  const { width, height, pixels: art } = title.bitmap;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (art[y * width + x] !== pixels[(title.y + y) * LCD_WIDTH + title.x + x]) return false;
    }
  }
  return true;
}

export interface GameTimelineOptions {
  /**
   * The last row is the screen the flow returns to, drawn by the kernel (flow recordings): the
   * flow must exit when it starts.
   */
  readonly returns?: boolean;
  /** Rows whose start is not compared: the first redraw after a key (no key latency, D6). */
  readonly untimed?: ReadonlySet<number>;
  /**
   * The level's period, when the capture may have missed ticks (level 175: one cell per ≈8 ms;
   * a meal's redraw runs into the next tick's, and the emulator drops redraws): a tick row may
   * follow session frames the capture never showed, as many as its interval holds periods.
   */
  readonly missedTicksPeriodMs?: number;
}

/**
 * Compares a recording made from the trigger with `gameRows`: pixels exactly, starts per each
 * row's timing (D6).
 */
export function expectGameTimeline(
  recording: { readonly frames: readonly RecordedFrame[]; readonly exitMs?: number },
  id: string,
  rows: readonly GameRow[],
  options: GameTimelineOptions = {},
): void {
  const shown = options.returns ? rows.slice(0, -1) : rows;
  // The recording's frame matched with each row.
  const matched: number[] = [];
  let next = 0;
  shown.forEach((row, i) => {
    const context = `${id} image ${row.image} (row ${i} from the trigger)`;
    const golden = { id, image: { name: row.image, pixels: row.pixels } };
    let index = next;
    const period = options.missedTicksPeriodMs;
    if (period !== undefined && row.tick && i > 0) {
      const missed = Math.round((row.startMs - rows[i - 1]!.startMs) / period) - 1;
      for (let k = 0; k < missed; k++) {
        const frame = recording.frames[index];
        if (frame === undefined || lcdMismatch(frame.pixels, golden, context) === undefined) break;
        index++;
      }
    }
    const frame = recording.frames[index];
    expect(frame, `${context}: never shown`).toBeDefined();
    const mismatch = lcdMismatch(frame!.pixels, golden, context);
    if (mismatch !== undefined) throw new Error(mismatch);
    matched.push(index);
    next = index + 1;
  });
  const starts = matched.map((index) => recording.frames[index]!.startMs);
  if (options.returns) {
    expect(recording.frames.length, `${id}: extra frames before the return`).toBe(next);
    expect(recording.exitMs, `${id}: the flow never exited`).toBeDefined();
    starts.push(recording.exitMs!);
  }
  rows.forEach((row, i) => {
    if (i === 0 || options.untimed?.has(i) || row.timing.kind === "untimed") return;
    const from = row.timing.kind === "interval" ? i - 1 : row.timing.anchor;
    const ours = starts[i]! - starts[from]!;
    const golden = row.startMs - rows[from]!.startMs;
    expect(
      Math.abs(ours - golden),
      `${id} image ${row.image} (row ${i}): ${ours} ms after row ${from}, golden ${golden} ms`,
    ).toBeLessThanOrEqual(row.tick ? periodToleranceMs(golden) : timingToleranceMs(golden));
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

// ---------------------------------------------------------------- acceptance (Task 11)

/** A rig's recording from its trigger: frames at and after it, timed from it. */
function fromTrigger(recording: RecordedTimeline): RecordedFrame[] {
  return recording.frames
    .filter((frame) => frame.startMs >= recording.triggerMs)
    .map((frame) => ({ ...frame, startMs: frame.startMs - recording.triggerMs }));
}

/** Ticks the rig for `durationMs`, running each action on the ms it is due (in list order). */
function run(rig: Rig, durationMs: number, actions: readonly Action[] = []): void {
  const pending = [...actions].sort((a, b) => a.atMs - b.atMs);
  for (let t = 1; t <= durationMs; t++) {
    rig.advance(1);
    while (pending.length > 0 && pending[0]!.atMs <= t) pending.shift()!.run();
  }
}

interface Action {
  readonly atMs: number;
  readonly run: () => void;
}

/** ▼ presses on the Level page from 175 to `level` (one cell per press, Task 0 C1). */
function lowerLevel(rig: Rig, level: number): void {
  for (let i = level; i < 175; i++) {
    rig.press("down");
    rig.advance(2);
  }
}

/**
 * From standby (seeded with the trace's seed): Snake II's game menu with the trace's maze
 * chosen in Mazes and its level set on the Level page (▼ from the virgin 175, OK), New game
 * highlighted.
 */
function snakeMenu(trace: Pick<SnakeTrace, "level" | "maze" | "seed">): Rig {
  const rig = standbyRig({}, { seed: trace.seed });
  keys(rig, SNAKE);
  if (trace.maze !== 0) keys(rig, `down*2 navi down*${trace.maze} navi wait:4000 up*2`);
  if (trace.level !== 175) {
    keys(rig, "down navi");
    lowerLevel(rig, trace.level);
    keys(rig, "navi up");
  }
  return rig;
}

/** The trace's `input` as actions after New game: each key just after its tick's frame. */
function inputActions(
  rig: Rig,
  trace: SnakeTrace,
  schedule: readonly number[],
  hold?: { readonly ms: number },
): Action[] {
  return [...inputByTick(`game/snake/${trace.id}`)].flatMap(([tick, keys]) =>
    keys.flatMap((key): Action[] =>
      hold === undefined
        ? [{ atMs: schedule[tick]! + 1, run: () => rig.press(key) }]
        : [
            { atMs: schedule[tick]! + 1, run: () => rig.hold(key) },
            { atMs: schedule[tick]! + 1 + hold.ms, run: () => rig.release(key) },
          ],
    ),
  );
}

const lastInputTick = (trace: SnakeTrace): number =>
  Math.max(0, ...inputByTick(`game/snake/${trace.id}`).keys());

const traceOf = (id: string): SnakeTrace => {
  const found = SNAKE_TRACES.find((t) => `game/snake/${t.id}` === id);
  if (found === undefined) throw new Error(`No Snake II trace for ${id}.`);
  return found;
};

/**
 * Tick stills (D5.2): New game, the `input` keys on their ticks, and the screen after each
 * listed tick. `hold` keeps each key down that long (the held-key probes).
 */
function tickStills(id: string, trace: SnakeTrace, hold?: { readonly ms: number }): void {
  const golden = loadGolden(id);
  const ticks = golden.images.map((image) => Number(image.name.slice(1)));
  const last = Math.max(...ticks, lastInputTick(trace));
  const schedule = tickSchedule(trace, last + 1);
  const rig = snakeMenu(trace);
  const shots = new Map<number, Uint8Array>();
  rig.press("navi");
  run(rig, schedule[last]! + 2, [
    ...ticks.map((tick) => ({
      atMs: schedule[tick]! + 1,
      run: () => shots.set(tick, rig.paint().pixels),
    })),
    ...inputActions(rig, trace, schedule, hold),
  ]);
  golden.images.forEach((image) => {
    const tick = Number(image.name.slice(1));
    expectLcd({ pixels: shots.get(tick)! }, { id, image }, `${trace.id}: after tick ${tick}`);
  });
}

/**
 * A timeline from New game (its trigger): `input` keys on their ticks; `untimed` rows follow a
 * key whose redraw latency the session does not reproduce (D6).
 */
function newGameTimeline(
  id: string,
  trace: SnakeTrace,
  options: { readonly untimed?: ReadonlySet<number> } = {},
): void {
  const rows = gameRows(id, trace.level, trace.maze);
  const schedule = tickSchedule(trace, lastInputTick(trace) + 1);
  const rig = snakeMenu(trace);
  const span = rows.at(-1)!.startMs - rows[0]!.startMs + 100;
  const recording = rig.record(span, () => rig.press("navi"), inputActions(rig, trace, schedule));
  expectGameTimeline({ frames: fromTrigger(recording) }, id, rows, {
    ...options,
    ...(trace.level === 175 ? { missedTicksPeriodMs: SNAKE_PERIODS[175]! } : {}),
  });
}

/**
 * Plays `trace` from New game to just after its last `input` key; the rig then shows the frame
 * a death golden starts with.
 */
function toLastKey(trace: SnakeTrace): Rig {
  const last = lastInputTick(trace);
  const schedule = tickSchedule(trace, last + 1);
  const rig = snakeMenu(trace);
  rig.press("navi");
  run(rig, schedule[last]! + 1, inputActions(rig, trace, schedule));
  return rig;
}

/**
 * A death timeline (`bot-*.death`): the game, then from the golden's first screen (the board
 * when the capture's death recording started, after the bot's last key) to the game menu.
 */
function deathTimeline(id: string, game: string): void {
  const trace = traceOf(`game/snake/${game}`);
  const golden = loadGolden(id);
  const rows = gameRows(id, trace.level, trace.maze);
  const first = { id, image: findGoldenImage(golden, golden.timeline![0]!.image) };
  const recording = toLastKey(trace).record(rows.at(-1)!.startMs + 5000);
  const start = recording.frames.findIndex((f) => lcdMismatch(f.pixels, first, id) === undefined);
  expect(start, `${id}: the game never shows its first screen`).toBeGreaterThanOrEqual(0);
  expectGameTimeline({ frames: rebase(recording.frames.slice(start + 1)) }, id, rows);
}

const rebase = (frames: readonly RecordedFrame[]): RecordedFrame[] =>
  frames.map((frame) => ({ ...frame, startMs: frame.startMs - frames[0]!.startMs }));

/**
 * A key during a game's death or game over (C12): the golden's two rows are the screen when the
 * key went down and what followed. The key goes down as long after our showing of row 0 as it
 * did in the capture (`keyMs` after the bot's last key, the golden's note); the row it causes is
 * untimed unless the key is ignored.
 */
function gameOverKey(id: string, game: string, key: PhoneKey, keyMs: number): void {
  const trace = traceOf(`game/snake/${game}`);
  const golden = loadGolden(id);
  const [a, b] = golden.timeline!;
  const before = findGoldenImage(golden, a!.image);
  // Where our death shows row 0's screen nearest the capture's time for it.
  const probe = deathRecording(game);
  const starts = probe.frames
    .filter((f) => lcdMismatch(f.pixels, { id, image: before }, id) === undefined)
    .map((f) => f.startMs - probe.triggerMs);
  expect(starts.length, `${id}: row 0 never shown`).toBeGreaterThan(0);
  const ours = starts.reduce((best, s) =>
    Math.abs(s - a!.startMs) < Math.abs(best - a!.startMs) ? s : best,
  );
  const rig = toLastKey(trace);
  const at = ours + (keyMs - a!.startMs);
  run(rig, at);
  expectLcd(rig.paint(), { id, image: before }, `${id}: when ${key} goes down`);
  const recording = rig.record(b!.startMs - a!.startMs + 200, () => rig.press(key));
  const after = fromTrigger(recording).find(
    (f) => lcdMismatch(f.pixels, { id, image: before }, id) !== undefined,
  );
  expect(after, `${id}: nothing followed ${key}`).toBeDefined();
  expectLcd(after!, goldenImage(id, b!.image), `${id}: after ${key}`);
  if (key === "down") {
    // Ignored: the note ends by itself, when the capture's did.
    const ends = ours + (b!.startMs - a!.startMs) - at;
    expect(Math.abs(after!.startMs - ends), `${id}: the note's end`).toBeLessThanOrEqual(
      timingToleranceMs(ends),
    );
  }
}

const DEATHS = new Map<string, RecordedTimeline>();

/** The game's screens for 10 s from its last key (one play per game, shared). */
function deathRecording(game: string): RecordedTimeline {
  let recording = DEATHS.get(game);
  if (recording === undefined) {
    recording = toLastKey(traceOf(`game/snake/${game}`)).record(10_000);
    DEATHS.set(game, recording);
  }
  return recording;
}

/** The game played to its game menu (after the game-over screens). */
function toGameMenu(game: string): Rig {
  const trace = traceOf(`game/snake/${game}`);
  const rig = toLastKey(trace);
  for (let t = 0; t < 30_000 && rig.phone.path !== "menu/games/snake"; t += 100) rig.advance(100);
  rig.advance(100);
  return rig;
}

/** After a game (C11): the game menu, then Top score's return. */
function afterGame(id: string, game: string): void {
  const rig = toGameMenu(game);
  stills(id, rig, ["", "down*3 navi wait:7000"]);
}

/** After a game (C11): Top score shows the score the game wrote. */
function afterTopScore(id: string, game: string): void {
  const rig = toGameMenu(game);
  keys(rig, "down*3");
  timeline(id, rig, "navi", []);
}

/** A level-1 game suspended with Navi after tick `tick`: the game menu on Continue. */
function suspended(tick = 2): Rig {
  const trace = { level: 1, maze: 0, seed: SEED_1010 };
  const rig = snakeMenu(trace);
  rig.press("navi");
  const period = SNAKE_PERIODS[1]!;
  run(rig, SNAKE_FIRST_TICK[1]! + (tick - 1) * period + 1);
  rig.press("navi");
  rig.advance(TAP_MS);
  return rig;
}

/** Continue (the trigger) on a game suspended after tick 2, then `key` (C8). */
function continueTimeline(id: string, key: PhoneKey): void {
  const golden = loadGolden(id);
  const rows = gameRows(id, 1);
  const rig = suspended();
  const t = golden.triggerFrame as number;
  expectLcd(rig.paint(), goldenImage(id, golden.timeline![t - 1]!.image), `${id}: on Continue`);
  // The board stands until the key; the next tick comes one period after it. The key's time is
  // the capture's (one period before that tick).
  const keyAt = rows[1]!.startMs - rows[0]!.startMs - SNAKE_PERIODS[1]!;
  const recording = rig.record(
    rows.at(-1)!.startMs - rows[0]!.startMs + 100,
    () => rig.press("navi"),
    [{ atMs: keyAt, run: () => rig.press(key) }],
  );
  expectGameTimeline({ frames: fromTrigger(recording) }, id, rows);
}

/** The tick fixture (D6): every level 10..175 set on the Level page, New game, its ticks. */
function periodsScenario(): void {
  const file = "game/snake/periods.ticks.txt";
  const fixture = parseTickGolden(
    readFileSync(join(import.meta.dirname, "../../goldens", file), "utf8"),
    file,
  );
  // One phone, from the virgin level down: New game, Navi, then ▼ on the Level page (OK while
  // suspended discards the game and leaves Mazes selected).
  const rig = standbyRig();
  keys(rig, SNAKE);
  for (const row of [...fixture.rows].reverse()) {
    const span = row.firstMs + row.intervalsMs.reduce((sum, ms) => sum + ms, 0) + 50;
    const frames = fromTrigger(rig.record(span, () => rig.press("navi")));
    const starts = frames.filter((f) => isBoardFrame(f.pixels)).map((f) => f.startMs);
    const where = `level ${row.level}`;
    expect(starts[0], `${where}: the New game frame`).toBe(0);
    expect(Math.abs(starts[1]! - row.firstMs), `${where}: first tick`).toBeLessThanOrEqual(
      timingToleranceMs(row.firstMs),
    );
    // A level whose captured intervals differ among themselves by more than the tolerance (118
    // and 134: two intervals 29 ms apart; 26: a late tick, 17 ms long) cannot come within it of
    // each with one period: there the level's own spread is allowed.
    const spread = Math.max(...row.intervalsMs) - Math.min(...row.intervalsMs);
    row.intervalsMs.forEach((ms, i) => {
      const ours = starts[i + 2]! - starts[i + 1]!;
      const tolerance = Math.max(periodToleranceMs(ms), spread);
      expect(Math.abs(ours - ms), `${where}: interval ${i + 1}`).toBeLessThanOrEqual(tolerance);
    });
    if (row.level === 10) break;
    keys(rig, "navi down*2 navi");
    rig.press("down");
    rig.advance(2);
    keys(rig, "navi up*2");
  }
}

const LEVEL_PAGE = "down navi";

/** The Snake II Level page at `level` (▼ from the virgin 175). */
function levelPage(level: number): Rig {
  const rig = standbyRig();
  keys(rig, `${SNAKE} ${LEVEL_PAGE}`);
  lowerLevel(rig, level);
  return rig;
}

/**
 * Plan 14's `tree/08-games/8-1-1.leaf` (asserted early for plan 23): the virgin New game (level
 * 175), with the game's comparison (D6). Plan 14's acceptance file runs it.
 */
export function newGameLeafScenario(id: string): void {
  const golden = loadGolden(id);
  const rig = standbyRig();
  goto(rig, "8-1-1");
  rig.advance(592);
  expectLcd(rig.paint(), goldenImage(id, golden.timeline![0]!.image), "New game highlighted");
  const rows = gameRows(id, 175);
  const recording = rig.record(rows.at(-1)!.startMs - rows[0]!.startMs + 50, () =>
    rig.press("navi"),
  );
  expectGameTimeline({ frames: fromTrigger(recording) }, id, rows, {
    missedTicksPeriodMs: SNAKE_PERIODS[175]!,
  });
}

export const SNAKE_SCENARIOS: Record<string, (id: string) => void> = {
  // The Level page (C1, D11).
  ...Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [
      `game/snake/level-${n}`,
      (id: string) => expectLcd(levelPage(n).paint(), goldenImage(id, String(n)), `level ${n}`),
    ]),
  ),
  "game/snake/level-keys-virgin-up": (id) => {
    const rig = standbyRig();
    keys(rig, SNAKE);
    stills(id, rig, [LEVEL_PAGE, "up", "down*167"]);
  },
  "game/snake/level-keys-ok": (id) => {
    const rig = levelPage(5);
    timeline(id, rig, "navi");
    keys(rig, "navi");
    expectLcd(rig.paint(), goldenImage("game/snake/level-5", "5"), "reopened: 5");
  },
  "game/snake/level-keys-c": (id) => {
    const rig = levelPage(5);
    keys(rig, "navi navi down*2");
    timeline(id, rig, "c");
    keys(rig, "navi");
    expectLcd(rig.paint(), goldenImage("game/snake/level-5", "5"), "reopened: 5");
  },
  "game/snake/level-keys-hold-up": (id) => {
    const rig = levelPage(5);
    const golden = loadGolden(id);
    const rows = golden.timeline!;
    const last = rows.at(-1)!;
    const span = last.startMs + last.durationMs - rows[1]!.startMs;
    const recording = rig.record(span + 100, () => rig.hold("up"), [
      { atMs: 2000, run: () => rig.release("up") },
    ]);
    expectTimeline(recording, golden, "Level at 5, ▲ held 2 s");
  },

  // New game at every level (D2, D6) and on every maze.
  ...Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => [
      `game/snake/ticks-l${level}`,
      (id: string) => newGameTimeline(id, traceOf(id)),
    ]),
  ),
  "game/snake/periods": () => periodsScenario(),
  ...Object.fromEntries(
    [0, 1, 2, 3, 4, 5].map((maze) => [
      `game/snake/maze-${maze}`,
      (id: string) => newGameTimeline(id, traceOf(id)),
    ]),
  ),
  "game/snake/virgin-meal": (id) => newGameTimeline(id, traceOf(id)),
  "game/snake/virgin-game": (id) => newGameTimeline(id, traceOf(id)),

  // Recorded games: tick stills (bots, seeds, creatures, key probes) and their deaths.
  ...Object.fromEntries(
    SNAKE_TRACES.filter(
      (t) => !/^(ticks-l|maze-|virgin-)/.test(t.id) && !t.id.startsWith("keys-hold-"),
    ).map((t) => [`game/snake/${t.id}`, (id: string) => tickStills(id, t)]),
  ),
  // Held three ticks: the turn comes once (D7).
  "game/snake/keys-hold-2": (id) => tickStills(id, traceOf(id), { ms: 3 * SNAKE_PERIODS[1]! }),
  "game/snake/keys-hold-hash": (id) => tickStills(id, traceOf(id), { ms: 3 * SNAKE_PERIODS[1]! }),
  ...Object.fromEntries(
    ["bot-short", "bot-long", "bot-maze2", "bot-maze3", "bot-grace", "score-8"].map((game) => [
      `game/snake/${game}.death`,
      (id: string) => deathTimeline(id, game),
    ]),
  ),

  // Navi and C during play (C7, C8): the menu comes after the key's redraw latency.
  ...Object.fromEntries(
    ["keys-navi", "keys-c", "keys-c-hold", "pause-nav"].map((name) => [
      `game/snake/${name}`,
      (id: string) => {
        const trace = { ...traceOf("game/snake/ticks-l1"), id: name };
        const hold = name === "keys-c-hold";
        if (!hold) {
          newGameTimeline(id, trace, { untimed: new Set([3]) });
          return;
        }
        // C held for three ticks: the game menu, then standby.
        const rows = gameRows(id, 1);
        const schedule = tickSchedule(trace, 3);
        const rig = snakeMenu(trace);
        const recording = rig.record(
          rows.at(-1)!.startMs - rows[0]!.startMs + 100,
          () => rig.press("navi"),
          inputActions(rig, trace, schedule, { ms: 3 * SNAKE_PERIODS[1]! }),
        );
        expectGameTimeline({ frames: fromTrigger(recording) }, id, rows, {
          untimed: new Set([3]),
        });
      },
    ]),
  ),

  // Suspend and Continue (H15, D10, C8).
  "game/snake/pause-list": (id) => {
    const rig = suspended();
    rig.advance(TAP_MS);
    stills(id, rig, ["", ...Array(8).fill("down")]);
  },
  "game/snake/pause-c": (id) => timeline(id, suspended(), "c"),
  "game/snake/pause-continue": (id) => continueTimeline(id, "6"),
  "game/snake/pause-continue-turn": (id) => continueTimeline(id, "2"),
  "game/snake/pause-new-game": (id) => {
    const rig = suspended();
    keys(rig, "down");
    const golden = loadGolden(id);
    const t = golden.triggerFrame as number;
    expectLcd(rig.paint(), goldenImage(id, golden.timeline![t - 1]!.image), `${id}: New game`);
    const rows = gameRows(id, 1);
    const recording = rig.record(rows.at(-1)!.startMs - rows[0]!.startMs + 100, () =>
      rig.press("navi"),
    );
    expectGameTimeline({ frames: fromTrigger(recording) }, id, rows);
  },
  // The splash plays probe/games-splash-8-1's timeline; Top score tree 8-1-4's.
  "game/snake/pause-reenter": (id) => {
    const rig = suspended();
    keys(rig, "c");
    timeline(id, rig, "navi", []);
  },
  "game/snake/pause-from-standby": (id) => {
    const rig = suspended();
    keys(rig, "c*3 wait:2000 navi down*7 navi");
    timeline(id, rig, "navi", []);
  },
  "game/snake/pause-top-score": (id) => {
    const rig = suspended();
    keys(rig, "down*4");
    timeline(id, rig, "navi", []);
  },
  "game/snake/pause-level": (id) => {
    const rig = suspended();
    stills(id, rig, ["down*2 navi", "up navi"]);
  },

  // Keys during the death and the game-over screens (C12); after the game (C11).
  "game/snake/gameover-blink-navi": (id) => gameOverKey(id, "bot-short", "navi", 1500),
  "game/snake/gameover-fireworks-navi": (id) => gameOverKey(id, "bot-long", "navi", 4000),
  "game/snake/gameover-note-navi": (id) => gameOverKey(id, "bot-long", "navi", 7000),
  "game/snake/gameover-note-down": (id) => gameOverKey(id, "bot-long", "down", 7000),
  "game/snake/after-long": (id) => afterGame(id, "bot-long"),
  "game/snake/after-short": (id) => afterGame(id, "bot-short"),
  "game/snake/after-virgin": (id) => afterGame(id, "virgin-game"),
  "game/snake/after-long-top-score": (id) => afterTopScore(id, "bot-long"),
  "game/snake/after-virgin-top-score": (id) => afterTopScore(id, "virgin-game"),
};
