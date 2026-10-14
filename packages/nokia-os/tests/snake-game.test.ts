// Snake II's game screen (plan 23 Task 10): the session around the engine, driven on a 1 ms
// clock without the kernel (tests/support/flow-rig.ts) and compared with the gameplay goldens:
// ticks, the grace, the death blink, game over, suspend and Continue, and the cues (their sound
// and vibration against the captures: tests/sound-games.test.ts and the `sound/game/*` goldens).
import type { PhoneKey } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { isBoardFrame } from "../scripts/game-capture-set.ts";
import type { StockCue } from "../src/firmware/cues";
import { createMemorySettings, virginSettings } from "../src/firmware/settings";
import { snakeRender, stepSnake } from "../src/games/snake/engine";
import { Framebuffer } from "@hellotimber/phone-screen";
import { paintWidget } from "../src/display/widgets";
import { GAME_CUES, SNAKE_PERIODS } from "../src/resources";
import { gameOver } from "../src/widgets/game-over";
import { snakeGame, SNAKE_SETTINGS, type StockGames } from "../src/widgets/snake";
import { flowRig, type FlowRecording, type FlowRig } from "./support/flow-rig.ts";
import {
  expectGameTimeline,
  gameRows,
  inputByTick,
  snakeReplay,
  SNAKE_TRACES,
  tickSchedule,
  type SnakeTrace,
} from "./support/game.ts";
import { decodeBoard } from "./support/snake-decode.ts";
import { loadGolden } from "./support/goldens.ts";

interface StampedCue {
  readonly cue: StockCue;
  readonly atMs: number;
}

const trace = (id: string): SnakeTrace => SNAKE_TRACES.find((t) => t.id === id)!;

/** A game screen over virgin settings at `level` and `maze`, its New game seeded with `seed`. */
function gameRig(
  options: {
    level?: number;
    maze?: number;
    seed?: number;
    start?: "new" | "continue";
    games?: StockGames;
    settings?: ReturnType<typeof createMemorySettings>;
  } = {},
) {
  const settings = options.settings ?? createMemorySettings(virginSettings());
  if (options.level !== undefined) settings.setNumber(SNAKE_SETTINGS.level, options.level);
  if (options.maze !== undefined) settings.choose(SNAKE_SETTINGS.maze, options.maze);
  const cues: StampedCue[] = [];
  let seeds = 0;
  let rig: FlowRig | undefined;
  const games: StockGames = options.games ?? {
    snake: undefined,
    seed: () => {
      seeds++;
      return options.seed ?? 44530;
    },
    cues: { cue: (cue, atMs) => void cues.push({ cue, atMs }) },
    now: () => rig!.now,
  };
  rig = flowRig(() => snakeGame({ games, settings, start: options.start ?? "new" }));
  return { rig, games, settings, cues, seeds: () => seeds };
}

const press = (rig: FlowRig, key: PhoneKey) => rig.press(key);

/**
 * Records the screen from now (the New game frame) for `durationMs`, pressing the trace's
 * `input` on its ticks (just after each tick's frame), until the flow exits.
 */
function play(rig: FlowRig, t: SnakeTrace, durationMs: number): FlowRecording {
  const input = inputByTick(`game/snake/${t.id}`);
  const last = Math.max(0, ...input.keys());
  const schedule = tickSchedule(t, last + 1);
  const presses = [...input].flatMap(([tick, keys]) =>
    keys.map((key) => ({ atMs: schedule[tick]!, key })),
  );
  const start = rig.now;
  const frames = [{ startMs: 0, pixels: rig.frame() }];
  for (let ms = 1; ms <= durationMs && rig.exits.length === 0; ms++) {
    rig.advance(1);
    for (const p of presses) if (p.atMs === ms && rig.exits.length === 0) press(rig, p.key);
    if (rig.exits.length > 0) break;
    const pixels = rig.frame();
    const last = frames.at(-1)!.pixels;
    // The flow keeps its frame while the model is unchanged: compare pixels only on a new one.
    if (pixels !== last && !same(last, pixels)) frames.push({ startMs: rig.now - start, pixels });
  }
  const exit = rig.exits[0];
  return { frames, ...(exit === undefined ? {} : { exitMs: exit.atMs - start }) };
}

const same = (a: Uint8Array, b: Uint8Array) => a.every((v, i) => v === b[i]);

/** A recording from frame `index` on, its times from that frame. */
function from(recording: FlowRecording, index: number): FlowRecording {
  const origin = recording.frames[index]!.startMs;
  return {
    frames: recording.frames.slice(index).map((f) => ({ ...f, startMs: f.startMs - origin })),
    ...(recording.exitMs === undefined ? {} : { exitMs: recording.exitMs - origin }),
  };
}

/** A No-maze board with the snake hidden: the death blink's first frame. */
const hidden = (pixels: Uint8Array) =>
  isBoardFrame(pixels) && decodeBoard(pixels).segments.length === 0;

describe("New game (H1-H3, D2, D6)", () => {
  for (let level = 1; level <= 9; level++) {
    it(`ticks-l${level}: the start board, the first tick and the period`, () => {
      const t = trace(`ticks-l${level}`);
      const { rig } = gameRig({ level });
      const id = `game/snake/ticks-l${level}`;
      const rows = gameRows(id, level);
      const recording = play(rig, t, rows.at(-1)!.startMs - rows[0]!.startMs + 10);
      expectGameTimeline(recording, id, rows, {});
    });
  }

  it("seeds New game from the phone's games and reads the level and the maze", () => {
    const { rig, seeds } = gameRig({ level: 1, maze: 2 });
    expect(seeds()).toBe(1);
    const golden = loadGolden("game/snake/maze-2");
    const board = golden.timeline![golden.triggerFrame as number]!.image;
    expect(rig.frame()).toEqual(golden.images.find((i) => i.name === board)!.pixels);
  });
});

describe("keys act on key-down (D7)", () => {
  it("turns at the next tick after a key-down; the release does nothing", () => {
    const { rig } = gameRig({ level: 1 });
    rig.session.onKey({ type: "down", key: "2" });
    rig.advance(616);
    const turned = decodeBoard(rig.frame());
    expect(turned.head).toMatchObject({ x: 11, y: 3, heading: "up" });
    rig.session.onKey({ type: "up", key: "2" });
    rig.advance(635);
    expect(decodeBoard(rig.frame()).head).toMatchObject({ x: 11, y: 2, heading: "up" });
  });
});

describe("the crash, the death blink and game over (H6, H11, H14)", () => {
  for (const maze of [1, 3, 4]) {
    it(`maze-${maze}: into the wall, the grace, the blink, Game over!, the menu on New game`, () => {
      const id = `game/snake/maze-${maze}`;
      const { rig, cues } = gameRig({ level: 1, maze });
      const recording = play(rig, trace(`maze-${maze}`), 15_000);
      expectGameTimeline(recording, id, gameRows(id, 1, maze), { returns: true });
      expect(rig.exits.map((e) => e.options)).toEqual([{ select: "new-game", row: "top" }]);
      expect(cues.map((c) => c.cue.kind)).toEqual(["crash", "vibrate"]);
    });
  }

  it("bot-short: Your score: 4 below the top score (45), which stays", () => {
    const id = "game/snake/bot-short.death";
    const { rig, settings } = gameRig({ level: 2 });
    const recording = play(rig, trace("bot-short"), 60_000);
    const first = recording.frames.findIndex((f) => hidden(f.pixels));
    expectGameTimeline(from(recording, first), id, gameRows(id, 2), { returns: true });
    expect(settings.number(SNAKE_SETTINGS.topScore)).toBe(45);
  });

  it("bot-long: a new top score (105) is written and gets the fireworks, without a blink", () => {
    const id = "game/snake/bot-long.death";
    const { rig, settings, cues } = gameRig({ level: 1 });
    const recording = play(rig, trace("bot-long"), 300_000);
    const first = recording.frames.findIndex((f) => !isBoardFrame(f.pixels));
    // The ring has wrapped: the board stands for the whole death (2066 ms) after the crash, and
    // the top score's write (45 ms).
    const crash = cues.find((c) => c.cue.kind === "crash")!.atMs;
    expect(recording.frames[first]!.startMs - crash).toBe(2066 + 45);
    expectGameTimeline(from(recording, first), id, gameRows(id, 1), { returns: true });
    expect(settings.number(SNAKE_SETTINGS.topScore)).toBe(105);
    // The fireworks tune starts 2045 ms after the crash (plan 16 Task 0: sound/game/snake-top-score),
    // 21 ms before the death steps end.
    expect(cues.at(-1)).toEqual({
      cue: { kind: "top-score" },
      atMs: crash + GAME_CUES.topScoreAfterCrashMs,
    });
    expect(cues.filter((c) => c.cue.kind === "top-score")).toHaveLength(1);
  });

  it("cues the fireworks once, at their point of the death, across a suspend (plan 16 D13)", () => {
    const t = trace("bot-long");
    const crash = (() => {
      const { rig, cues } = gameRig({ level: 1 });
      play(rig, t, 300_000);
      return cues.find((c) => c.cue.kind === "crash")!.atMs;
    })();
    const after = GAME_CUES.topScoreAfterCrashMs;
    // Suspended before the fireworks' cue (1000 ms into the death) or after it (2050 ms).
    for (const suspendAt of [1000, 2050]) {
      const first = gameRig({ level: 1 });
      play(first.rig, t, crash + suspendAt);
      first.rig.press("navi");
      expect(first.games.snake?.death, `${suspendAt}`).toBeDefined();
      const cues: StampedCue[] = [];
      let resumed: FlowRig | undefined;
      const games: StockGames = {
        ...first.games,
        cues: { cue: (cue, atMs) => void cues.push({ cue, atMs }) },
        now: () => resumed!.now,
      };
      resumed = flowRig(() => snakeGame({ games, settings: first.settings, start: "continue" }));
      resumed.press("up");
      resumed.advance(3000);
      const fireworks = (list: readonly StampedCue[]) =>
        list.filter((c) => c.cue.kind === "top-score").map((c) => c.atMs);
      const where = `suspended ${suspendAt} ms into the death`;
      if (suspendAt < after) {
        expect(fireworks(first.cues), where).toEqual([]);
        expect(fireworks(cues), where).toEqual([after - suspendAt]);
      } else {
        expect(fireworks(first.cues), where).toEqual([crash + after]);
        expect(fireworks(cues), where).toEqual([]);
      }
    }
  });
});

describe("game-over keys (C12)", () => {
  const over = (topScore: boolean) =>
    flowRig(() => gameOver({ topScore, score: "4", select: "new-game" }));

  it("ignores ▼ and other keys; the screen ends by itself", () => {
    const rig = over(false);
    for (const key of ["down", "up", "5", "#"] as const) press(rig, key);
    expect(rig.exits).toEqual([]);
    rig.advance(3000);
    expect(rig.exits.map((e) => e.options)).toEqual([{ select: "new-game", row: "top" }]);
  });

  it("silences every key it gets (plan 16 Task 0: `sound/game/snake-keys`' 3 on the note)", () => {
    const cues: StampedCue[] = [];
    const games = { cues: { cue: (cue: StockCue, atMs: number) => void cues.push({ cue, atMs }) } };
    let now = 0;
    const rig = flowRig(() =>
      gameOver({
        topScore: false,
        score: "0",
        select: "new-game",
        games: { ...games, now: () => now },
      }),
    );
    now = 120;
    for (const key of ["3", "down", "navi"] as const) press(rig, key);
    expect(cues).toEqual([0, 1, 2].map(() => ({ cue: { kind: "silent-key" }, atMs: 120 })));
  });

  it("skips to the game menu on Navi or C (key-down), during the fireworks or the note", () => {
    for (const key of ["navi", "c"] as const) {
      for (const topScore of [true, false]) {
        const rig = over(topScore);
        rig.advance(500);
        rig.session.onKey({ type: "down", key });
        expect(rig.exits).toEqual([{ atMs: 500, options: { select: "new-game", row: "top" } }]);
      }
    }
  });
});

describe("suspend and Continue (H15, D10, Task 0 C8)", () => {
  it("Navi or C on key-down keeps the game and opens the game menu on Continue", () => {
    for (const key of ["navi", "c"] as const) {
      const { rig, games } = gameRig({ level: 1 });
      rig.advance(1300);
      rig.session.onKey({ type: "down", key });
      expect(rig.exits.map((e) => e.options)).toEqual([{ select: "continue", row: "top" }]);
      const replay = snakeReplay(trace("ticks-l1"));
      replay.stepTo(2);
      expect(games.snake).toEqual({ state: replay.state });
    }
  });

  it("Navi during the blink suspends the dying game (C12)", () => {
    const { rig, games } = gameRig({ level: 1, maze: 1 });
    play(rig, trace("maze-1"), 5600);
    rig.session.onKey({ type: "down", key: "navi" });
    expect(games.snake?.state.crash).toBe("dead");
    expect(games.snake?.death).toMatchObject({ step: 1 });
  });

  it("Continue redraws the board, stands until a key, and steps one period after it", () => {
    const first = gameRig({ level: 1 });
    first.rig.advance(1300);
    const board = first.rig.frame();
    first.rig.press("navi");
    const suspended = first.games.snake!;

    const { rig, games, seeds } = gameRig({ level: 1, start: "continue", games: first.games });
    expect(seeds()).toBe(0);
    expect(games.snake).toBeUndefined();
    expect(rig.frame()).toEqual(board);
    rig.advance(5000);
    expect(rig.frame()).toEqual(board);
    rig.press("2");
    rig.advance(SNAKE_PERIODS[1]! - 1);
    expect(rig.frame()).toEqual(board);
    rig.advance(1);
    // The key's turn applies, and the game goes on from its own generator (no reseed, C8).
    const next = stepSnake({ ...suspended.state, pending: "up" }).state;
    expect(decodeBoard(rig.frame())).toEqual(decodeBoard(paint(next)));
  });

  it("New game discards the suspended game", () => {
    const first = gameRig({ level: 1 });
    first.rig.advance(1300);
    first.rig.press("navi");
    const { games } = gameRig({ level: 1, games: first.games });
    expect(games.snake).toBeUndefined();
  });
});

function paint(state: Parameters<typeof snakeRender>[0]): Uint8Array {
  const fb = new Framebuffer();
  paintWidget(fb, { kind: "snake", board: snakeRender(state) });
  return fb.pixels;
}

describe("cues (D8)", () => {
  it("stamps a meal's eat and vibrate, and the crash's, with the kernel time of the step", () => {
    const t = trace("bot-short");
    const { rig, cues } = gameRig({ level: 2, seed: t.seed });
    play(rig, t, 60_000);
    const schedule = tickSchedule(t, 40);
    // bot-short eats on ticks 7 and 13, then dies into its body.
    expect(cues.slice(0, 4)).toEqual([
      { cue: { kind: "eat" }, atMs: schedule[7]! },
      { cue: { kind: "vibrate", ms: 480 }, atMs: schedule[7]! },
      { cue: { kind: "eat" }, atMs: schedule[13]! },
      { cue: { kind: "vibrate", ms: 480 }, atMs: schedule[13]! },
    ]);
    expect(cues.slice(4).map((c) => c.cue)).toEqual([
      { kind: "crash" },
      { kind: "vibrate", ms: 480 },
    ]);
  });
});
