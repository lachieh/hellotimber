import type { PhoneApp } from "@hellotimber/phone-core";
import { tickIntervalMs } from "@hellotimber/snake";
import type { SnakeGame, SnakeInput, SnakeState } from "@hellotimber/snake";
import { describe, expect, it } from "vite-plus/test";
import { snakeApp, snakeInputForKey } from "../src/phone/apps/snake-app";
import type { SnakeTopScoreStore } from "../src/phone/apps/snake-app";

// ── fake SnakeGame: records calls, lets tests script tick() results ──
function fakeGame(overrides: Partial<SnakeState> = {}) {
  const state: SnakeState = {
    cols: 21,
    rows: 10,
    snake: [
      { x: 6, y: 5 },
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ],
    dir: "right",
    pendingDir: null,
    food: { x: 10, y: 5 },
    bonus: null,
    foodsEaten: 0,
    score: 0,
    level: 1,
    maze: 0,
    walls: [],
    status: "idle",
    flashOn: true,
    ...overrides,
  };
  const calls = { dispatch: [] as SnakeInput[], tick: 0, pause: 0, resume: 0, reset: 0 };
  let tickResult = true;
  const game: SnakeGame = {
    get state() {
      return state;
    },
    dispatch(input) {
      calls.dispatch.push(input);
      if (state.status === "idle" || state.status === "paused") state.status = "running";
    },
    tick() {
      calls.tick += 1;
      if (!tickResult) state.status = "game-over";
      return tickResult;
    },
    pause() {
      calls.pause += 1;
      state.status = "paused";
    },
    resume() {
      calls.resume += 1;
      state.status = "running";
    },
    reset() {
      calls.reset += 1;
    },
  };
  return { game, calls, state, endGame: () => (tickResult = false) };
}

function memoryStore(initial = 0): SnakeTopScoreStore & { value: number } {
  const store = {
    value: initial,
    read: () => store.value,
    write: (s: number) => {
      store.value = s;
    },
  };
  return store;
}

function makeApp(fake: ReturnType<typeof fakeGame>, store = memoryStore()) {
  let exited = 0;
  const factory = snakeApp({ createGame: () => fake.game, topScore: store });
  const app: PhoneApp = factory({ exit: () => (exited += 1) });
  return { app, exitCount: () => exited };
}

describe("snakeInputForKey", () => {
  it("maps 2/4/6/8 and the scroll keys; others are null", () => {
    expect(snakeInputForKey("2")).toBe("up");
    expect(snakeInputForKey("4")).toBe("left");
    expect(snakeInputForKey("6")).toBe("right");
    expect(snakeInputForKey("8")).toBe("down");
    expect(snakeInputForKey("up")).toBe("up");
    expect(snakeInputForKey("down")).toBe("down");
    expect(snakeInputForKey("5")).toBeNull();
    expect(snakeInputForKey("navi")).toBeNull();
  });
});

describe("snakeApp", () => {
  it("dispatches on key down only (down starts the idle game, per plan 04)", () => {
    const fake = fakeGame();
    const { app } = makeApp(fake);
    app.onKey({ type: "down", key: "6" });
    app.onKey({ type: "up", key: "6" });
    expect(fake.calls.dispatch).toEqual(["right"]);
    expect(fake.state.status).toBe("running");
  });

  it("accumulates tick deltas against tickIntervalMs(level)", () => {
    const fake = fakeGame({ status: "running", level: 5 });
    const { app } = makeApp(fake);
    const interval = tickIntervalMs(5); // 325 ms
    app.tick(interval - 1);
    expect(fake.calls.tick).toBe(0);
    app.tick(1);
    expect(fake.calls.tick).toBe(1);
    app.tick(interval * 2);
    expect(fake.calls.tick).toBe(3);
  });

  it("does not advance while idle or paused", () => {
    const fake = fakeGame({ status: "paused", level: 1 });
    const { app } = makeApp(fake);
    app.tick(10_000);
    expect(fake.calls.tick).toBe(0);
  });

  it("c pauses the running game and exits to the menu", () => {
    const fake = fakeGame({ status: "running" });
    const { app, exitCount } = makeApp(fake);
    app.onKey({ type: "down", key: "c" });
    expect(fake.calls.pause).toBe(1);
    expect(exitCount()).toBe(1);
  });

  it("non-steering digits resume a paused game (spec §7: any key starts)", () => {
    const fake = fakeGame({ status: "paused" });
    const { app } = makeApp(fake);
    app.onKey({ type: "down", key: "5" });
    expect(fake.calls.resume).toBe(1);
  });

  it("records a beaten top score exactly once when the game ends", () => {
    const fake = fakeGame({ status: "running", level: 1, score: 12 });
    const store = memoryStore(7);
    const { app } = makeApp(fake, store);
    fake.endGame();
    app.tick(tickIntervalMs(1) * 3);
    expect(store.value).toBe(12);
  });

  it("keeps the higher stored score", () => {
    const fake = fakeGame({ status: "running", level: 1, score: 3 });
    const store = memoryStore(99);
    const { app } = makeApp(fake, store);
    fake.endGame();
    app.tick(tickIntervalMs(1));
    expect(store.value).toBe(99);
  });

  it("renders a custom 84×48 frame with appId snake", () => {
    const fake = fakeGame();
    const { app } = makeApp(fake);
    const screen = app.render();
    if (screen.kind !== "custom") throw new Error(`expected custom, got ${screen.kind}`);
    expect(screen.appId).toBe("snake");
    expect(screen.frame.width).toBe(84);
    expect(screen.frame.height).toBe(48);
    expect(screen.frame.pixels).toHaveLength(84 * 48);
  });

  it("pauses on onExit (navigating away)", () => {
    const fake = fakeGame({ status: "running" });
    const { app } = makeApp(fake);
    app.onExit?.();
    expect(fake.calls.pause).toBe(1);
  });

  it("a steering key after game over starts a fresh game", () => {
    const fake = fakeGame({ status: "running", level: 1 });
    const fresh = fakeGame();
    let creations = 0;
    const factory = snakeApp({
      createGame: () => {
        creations += 1;
        return creations === 1 ? fake.game : fresh.game;
      },
      topScore: memoryStore(),
    });
    const app = factory({ exit: () => undefined });
    fake.endGame();
    app.tick(tickIntervalMs(1)); // → game over
    app.onKey({ type: "down", key: "6" });
    expect(creations).toBe(2); // fresh seed, not reset() (Contract deviations 8)
    expect(fresh.calls.dispatch).toEqual(["right"]);
  });
});
