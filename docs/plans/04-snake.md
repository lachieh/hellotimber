# Plan 04 — `@hellotimber/snake`: Snake II engine + bitmap rasterizer

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task. If
> this plan contradicts VISION.md contracts or the code, STOP and report.

## Contract deviations

The implementation matches the `@hellotimber/snake` contract in VISION.md
(`createSnake` / `SnakeGame` / `SnakeState` / `SnakeInput` / `renderSnakeFrame` /
`Bitmap`) with these **additive** choices, made because the contract elides them:

1. **`SnakeState` fields are fully specified here** (the contract shows only a comment).
   There is **no `lives` field** even though the contract comment mentions "lives" —
   Snake II on the 3310 is single-life: death goes straight to game over
   (spec §7 "Death"). If `lives` is ever required, VISION.md must change first.
2. **Extra exports:** `tickIntervalMs(speed)` (hosts must agree on tick cadence;
   the engine never reads time) and `MAZE_NAMES` (so hosts can build the maze picker
   menu without hardcoding names).
3. **Extra `SnakeGame` methods:** `pause()` / `resume()` — the 3310 pauses Snake on
   interruptions and resumes via _Games → Continue_; hosts need a way to express that.
4. **`dispatch(input)` also starts an `idle` game and resumes a `paused` one** —
   authentic: "to start a paused game, press any key" (spec §7).

Report these four deviations when the plan is complete.

## Goal

Build `@hellotimber/snake`: a pure-TypeScript, **zero-dependency** (no internal, no
external deps) Snake II rules engine plus a pure rasterizer that turns a `SnakeState`
into an 84×48 1bpp `Bitmap`. Fully deterministic (seeded PRNG, no clocks, no
`Math.random`), fully unit-tested, usable standalone outside this repo. Gameplay
follows `docs/specs/nokia-3310.md` §7: 2/4/6/8-style absolute steering via
`up/down/left/right` inputs, no reversing, wraparound edges, 6 mazes
(No maze/Box/Tunnel/Mill/Rails/Apartment), levels 1–9 with points-per-food = level,
a bonus bug every 5 foods with a 20-tick TTL and a decrementing no-growth score, and
death on self/wall collision followed by a flashing death animation and a Game over
screen.

## Architecture

```
createSnake(opts) ──▶ SnakeGame (closure over mutable SnakeState + PRNG)
                        ├─ dispatch(input)   queue ≤1 turn per tick (no-reverse)
                        ├─ tick()            advance exactly one movement step
                        ├─ pause()/resume()  host-driven interruptions
                        └─ reset()           reseed PRNG, restore initial state

renderSnakeFrame(state) ──▶ Bitmap 84×48   (pure function of state, no game import)
```

| Module           | Responsibility                                                           |
| ---------------- | ------------------------------------------------------------------------ |
| `src/types.ts`   | `Bitmap`, `Cell`, `SnakeInput`, `SnakeStatus`, `SnakeState`, `SnakeGame` |
| `src/prng.ts`    | `mulberry32(seed)` — the only randomness source                          |
| `src/timing.ts`  | `tickIntervalMs(speed)` — level → host tick cadence                      |
| `src/mazes.ts`   | `MAZE_NAMES`, `MAZE_ART` (21×10 string art), `parseMaze(index)`          |
| `src/game.ts`    | `createSnake` — the whole rules engine                                   |
| `src/bitmap.ts`  | bitmap primitives: `createBitmap`, `setPixel`, `fillRect`, `drawArt`     |
| `src/font.ts`    | 3×5 digit font + 5×7 caps glyphs (GAME OVER only), draw helpers          |
| `src/sprites.ts` | 4×4 cell sprites: head, body (solid/notched), food, bonus bug            |
| `src/render.ts`  | `renderSnakeFrame(state)`                                                |
| `src/index.ts`   | public surface (re-exports only)                                         |

**Invariants (enforced by tests):**

- The package imports nothing — not `phone-core`, not `phone-screen`, nothing from npm.
  The `Bitmap` type is **defined locally** (structurally identical to phone-core's; the
  website adapter relies on structural typing, never on a shared import).
- The engine never reads time (`Date`, `performance`, timers) or `Math.random`. The
  host calls `tick()` on its own schedule, using `tickIntervalMs(speed)` as cadence.
- `renderSnakeFrame` never mutates state and works on any plain `SnakeState` object
  (tests construct literals).

## Tech stack

- TypeScript (strict, `verbatimModuleSyntax`), source-exported package — **no build
  step** (AGENTS.md package recipe).
- Vite+ toolchain: tests via `vp test` (Vitest 4 under the hood), node environment,
  imports from `vite-plus/test`. Lint/format/typecheck via `vp check --fix`.
- Runtime dependencies: **none**. Dev dependencies: `typescript`, `vite-plus`
  (catalog versions) only.

**Test commands** (use these in every task):

- From `packages/snake/`: `mise exec -- vp test run`
- From the repo root (everything): `mise exec -- vp run -r test`

## Design constants (normative — all code below conforms)

- **Screen:** 84×48 px, 1bpp, row-major `Uint8Array`, `0` clear / `1` set.
- **Score bar:** top 8 px rows (y 0–7). Score digits top-left at (1,1); bonus
  countdown (when a bonus is live) right-aligned ending at x=82, y=1; a 1px separator
  line spans the full width at y=7.
- **Playfield grid:** 21 columns × 10 rows of 4×4 px cells (84/4 = 21,
  (48−8)/4 = 10). Cell `(cx, cy)` occupies pixels x ∈ [cx·4, cx·4+3],
  y ∈ [8+cy·4, 8+cy·4+3]. **All game state positions are cell coordinates.**
- **Initial state:** snake `[(6,5), (5,5), (4,5)]` (head first), `dir: "right"`,
  `status: "idle"`, `flashOn: true`, score 0. Every maze leaves these cells and the
  cells immediately right of the head free (tested).
- **Determinism:** `createSnake({ speed, maze, seed })`, defaults
  `speed 1, maze 0, seed 1`. All placement uses one mulberry32 PRNG seeded by `seed`;
  placement draws `x = floor(rng()·21)`, `y = floor(rng()·10)` and redraws while the
  cell is occupied (snake/walls/food/bonus as applicable). `reset()` reseeds.
- **Cadence:** `tickIntervalMs(speed) = 600 − clamp(speed,1..9)·55` → level 1 = 545 ms,
  level 5 = 325 ms, level 9 = 105 ms (spec: higher level = faster).
- **Tick order (running):** apply pending turn → compute next head cell with
  wraparound → collision check (walls + body, tail-cell excluded unless eating) →
  on collision enter `dying` → else move; handle food (grow, score += level,
  foodsEaten++, respawn food, every 5th food spawns bonus) or bonus
  (score += current value, no growth) → age bonus (ttl−1, value = max(1, value−1),
  despawn at ttl 0; the spawn tick itself is not aged).
- **Death:** collision tick sets `status "dying"`, `flashOn false`, and returns
  `true`; the next tick toggles `flashOn` to `true` (returns `true`); the tick after
  toggles again and transitions to `"game-over"`, returning `false`. Every later
  `tick()` returns `false`. The snake never occupies the collision cell.
- **Statuses:** `idle | running | paused | dying | game-over`. `dispatch` is ignored
  in `dying`/`game-over`; in `idle`/`paused` it switches to `running` first.
- **Turn queue:** `dispatch` stores at most one `pendingDir` (last input wins);
  inputs equal to the **opposite of the current travel direction** are ignored
  (Nokia no-reverse). The pending turn is applied once, at the start of the next tick.

## Files at completion

```
packages/snake/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── prng.ts
│   ├── timing.ts
│   ├── mazes.ts
│   ├── game.ts
│   ├── bitmap.ts
│   ├── font.ts
│   ├── sprites.ts
│   └── render.ts
└── tests/
    ├── api.test.ts
    ├── prng.test.ts
    ├── mazes.test.ts
    ├── movement.test.ts
    ├── food.test.ts
    ├── bonus.test.ts
    ├── death.test.ts
    ├── bitmap.test.ts
    ├── render.test.ts
    ├── game-over.test.ts
    ├── integration.test.ts
    ├── helpers.ts        (gameplay steering helper — not a test file)
    └── pixels.ts         (expectFrame pixel-assertion helper — not a test file)
```

---

### Task 1 — Scaffold the package and lock the public types

**Files:** `packages/snake/package.json`, `packages/snake/tsconfig.json`,
`packages/snake/vite.config.ts`, `packages/snake/src/types.ts`,
`packages/snake/src/index.ts`, `packages/snake/tests/api.test.ts`

Note: AGENTS.md offers a `vp create` scaffold recipe; this plan writes the files
directly instead (same end state, no cruft to delete). If `vp install` fails to link
the package afterwards, stop and report.

- [ ] Write `packages/snake/package.json`:

  ```json
  {
    "name": "@hellotimber/snake",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "exports": {
      ".": "./src/index.ts",
      "./package.json": "./package.json"
    },
    "scripts": {
      "test": "vp test run"
    },
    "devDependencies": {
      "typescript": "catalog:",
      "vite-plus": "catalog:"
    }
  }
  ```

- [ ] Write `packages/snake/tsconfig.json` (the template from
      `docs/specs/integration-notes.md` §1 — the root tsconfig has no DOM libs):

  ```json
  {
    "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx"],
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "jsx": "react-jsx",
      "lib": ["ES2022", "DOM"],
      "strict": true,
      "verbatimModuleSyntax": true,
      "noEmit": true,
      "skipLibCheck": true,
      "types": ["vite-plus/client"]
    }
  }
  ```

- [ ] Write `packages/snake/vite.config.ts`:

  ```ts
  import { defineConfig } from "vite-plus";

  export default defineConfig({
    test: {
      include: ["tests/**/*.test.ts"],
    },
  });
  ```

- [ ] From the repo root run `mise exec -- vp install` to link the new workspace
      member (declared by the existing `packages/*` glob in `pnpm-workspace.yaml`).
- [ ] Write the failing test `packages/snake/tests/api.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import * as snake from "../src/index";
  import type { Cell, SnakeInput, SnakeState } from "../src/index";

  describe("package surface", () => {
    it("module loads", () => {
      expect(typeof snake).toBe("object");
    });

    it("SnakeState has the contracted shape", () => {
      const cell: Cell = { x: 0, y: 0 };
      const input: SnakeInput = "up";
      const s: SnakeState = {
        cols: 21,
        rows: 10,
        snake: [cell],
        dir: "right",
        pendingDir: null,
        food: cell,
        bonus: null,
        foodsEaten: 0,
        score: 0,
        level: 1,
        maze: 0,
        walls: [],
        status: "idle",
        flashOn: true,
      };
      expect(s.status).toBe("idle");
      expect(input).toBe("up");
    });
  });
  ```

- [ ] Run (from `packages/snake/`): `mise exec -- vp test run` — **expect failure**
      (cannot resolve `../src/index`).
- [ ] Write `packages/snake/src/types.ts` — the complete public types:

  ```ts
  /** 1bpp bitmap, row-major, 0 = clear, 1 = set. Structurally identical to
   * phone-core's Bitmap on purpose — defined locally so this package has zero deps. */
  export interface Bitmap {
    width: number;
    height: number;
    pixels: Uint8Array;
  }

  export type SnakeInput = "up" | "down" | "left" | "right";

  export type SnakeStatus = "idle" | "running" | "paused" | "dying" | "game-over";

  /** Playfield cell coordinates: x ∈ [0, cols), y ∈ [0, rows). */
  export interface Cell {
    x: number;
    y: number;
  }

  /** The bonus bug: 1 logical cell, ttl in ticks, value decrements each tick. */
  export interface SnakeBonus {
    cell: Cell;
    ttl: number;
    value: number;
  }

  export interface SnakeState {
    cols: number;
    rows: number;
    /** Head first. */
    snake: Cell[];
    /** Direction of travel applied on the last tick. */
    dir: SnakeInput;
    /** Queued turn for the next tick (last dispatch wins), or null. */
    pendingDir: SnakeInput | null;
    food: Cell;
    bonus: SnakeBonus | null;
    foodsEaten: number;
    score: number;
    /** 1–9; also the points awarded per food. */
    level: number;
    /** Maze index 0–5 (see MAZE_NAMES). */
    maze: number;
    walls: Cell[];
    status: SnakeStatus;
    /** During "dying": whether the snake is visible this frame. */
    flashOn: boolean;
  }

  export interface SnakeGame {
    readonly state: Readonly<SnakeState>;
    dispatch(input: SnakeInput): void;
    /** Advance one movement step; false once the game is over. */
    tick(): boolean;
    reset(): void;
    pause(): void;
    resume(): void;
  }
  ```

- [ ] Write `packages/snake/src/index.ts`:

  ```ts
  export type {
    Bitmap,
    Cell,
    SnakeBonus,
    SnakeGame,
    SnakeInput,
    SnakeState,
    SnakeStatus,
  } from "./types";
  ```

- [ ] Run `mise exec -- vp test run` — **expect pass**.
- [ ] Run `mise exec -- vp check --fix` from the repo root — must pass.
- [ ] Commit: `feat(snake): scaffold package and lock public types`

---

### Task 2 — Seeded PRNG and `tickIntervalMs`

**Files:** `packages/snake/src/prng.ts`, `packages/snake/src/timing.ts`,
`packages/snake/src/index.ts`, `packages/snake/tests/prng.test.ts`

- [ ] Write the failing test `packages/snake/tests/prng.test.ts` (the expected
      numbers below are the real mulberry32 outputs — do not alter them):

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { mulberry32 } from "../src/prng";
  import { tickIntervalMs } from "../src/timing";

  describe("mulberry32", () => {
    it("produces a known sequence for seed 1", () => {
      const r = mulberry32(1);
      expect(r()).toBeCloseTo(0.6270739405881613, 12);
      expect(r()).toBeCloseTo(0.002735721180215478, 12);
      expect(r()).toBeCloseTo(0.5274470399599522, 12);
    });

    it("is deterministic per seed", () => {
      const a = mulberry32(123);
      const b = mulberry32(123);
      for (let i = 0; i < 100; i++) expect(a()).toBe(b());
    });

    it("stays in [0, 1)", () => {
      const r = mulberry32(99);
      for (let i = 0; i < 1000; i++) {
        const v = r();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe("tickIntervalMs", () => {
    it("maps levels 1-9 to a decreasing interval", () => {
      expect(tickIntervalMs(1)).toBe(545);
      expect(tickIntervalMs(5)).toBe(325);
      expect(tickIntervalMs(9)).toBe(105);
    });

    it("clamps out-of-range speeds", () => {
      expect(tickIntervalMs(0)).toBe(545);
      expect(tickIntervalMs(99)).toBe(105);
    });
  });
  ```

- [ ] Run `mise exec -- vp test run` (from `packages/snake/`) — **expect failure**.
- [ ] Write `packages/snake/src/prng.ts`:

  ```ts
  /** mulberry32 — tiny deterministic PRNG; the package's only randomness source. */
  export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  ```

- [ ] Write `packages/snake/src/timing.ts`:

  ```ts
  /** Clamp a speed/level option into the Snake II range 1-9. */
  export function clampLevel(speed: number): number {
    return Math.min(9, Math.max(1, Math.floor(speed)));
  }

  /**
   * Host tick cadence for a given level (1-9). The engine never reads time;
   * hosts call game.tick() every tickIntervalMs(speed) milliseconds.
   * 600 - level*55: level 1 = 545 ms ... level 9 = 105 ms (higher = faster).
   */
  export function tickIntervalMs(speed: number): number {
    return 600 - clampLevel(speed) * 55;
  }
  ```

- [ ] Append to `packages/snake/src/index.ts`:

  ```ts
  export { tickIntervalMs } from "./timing";
  ```

  (`mulberry32` and `clampLevel` stay internal — tests import them from `../src/...`
  directly.)

- [ ] Run `mise exec -- vp test run` — **expect pass**.
- [ ] Run `mise exec -- vp check --fix` — must pass.
- [ ] Commit: `feat(snake): add seeded mulberry32 PRNG and tickIntervalMs helper`

---

### Task 3 — Maze data

**Files:** `packages/snake/src/mazes.ts`, `packages/snake/src/index.ts`,
`packages/snake/tests/mazes.test.ts`

Six mazes as 21×10 string art (`#` wall, `.` free). Per spec §7: "No maze" plus Box,
Tunnel, Mill, Rails, Apartment; Box is the authentic perimeter; the other four are
**plausible approximations** of the originals (exact layouts unverified — keep that
comment in the source). Every maze must leave the snake start row clear.

- [ ] Write the failing test `packages/snake/tests/mazes.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { MAZE_ART, MAZE_NAMES, parseMaze } from "../src/mazes";

  describe("mazes", () => {
    it("defines six named mazes", () => {
      expect(MAZE_NAMES).toEqual(["No maze", "Box", "Tunnel", "Mill", "Rails", "Apartment"]);
      expect(MAZE_ART).toHaveLength(6);
    });

    it("every maze is a 21x10 grid of # and .", () => {
      for (const art of MAZE_ART) {
        expect(art).toHaveLength(10);
        for (const row of art) expect(row).toMatch(/^[#.]{21}$/);
      }
    });

    it("has the expected wall counts", () => {
      expect(MAZE_ART.map((_, i) => parseMaze(i).length)).toEqual([0, 58, 24, 18, 34, 76]);
    });

    it("Box is the perimeter", () => {
      const walls = new Set(parseMaze(1).map((c) => `${c.x},${c.y}`));
      expect(walls.has("0,0")).toBe(true);
      expect(walls.has("20,9")).toBe(true);
      expect(walls.has("0,5")).toBe(true);
      expect(walls.has("13,0")).toBe(true);
      expect(walls.has("1,1")).toBe(false);
      expect(walls.has("10,5")).toBe(false);
    });

    it("leaves the snake start row free in every maze", () => {
      for (let m = 0; m < 6; m++) {
        const walls = new Set(parseMaze(m).map((c) => `${c.x},${c.y}`));
        for (const x of [4, 5, 6, 7, 8, 9, 10]) expect(walls.has(`${x},5`)).toBe(false);
      }
    });

    it("out-of-range index falls back to No maze", () => {
      expect(parseMaze(99)).toEqual([]);
    });
  });
  ```

- [ ] Run `mise exec -- vp test run` — **expect failure**.
- [ ] Write `packages/snake/src/mazes.ts`. Copy the grids **exactly** (each row is
      exactly 21 characters; the wall counts in the test were computed from these grids):

  ```ts
  import type { Cell } from "./types";

  export const MAZE_NAMES: readonly string[] = [
    "No maze",
    "Box",
    "Tunnel",
    "Mill",
    "Rails",
    "Apartment",
  ];

  const EMPTY = ".....................";

  /**
   * 21×10 playfield mazes; '#' = wall cell, '.' = free.
   * Box is the authentic Snake II perimeter maze. Tunnel/Mill/Rails/Apartment are
   * plausible approximations of the originals (exact layouts are UNVERIFIED — see
   * docs/specs/nokia-3310.md §7). All mazes keep the snake start row (y=5, x=4..10)
   * free.
   */
  export const MAZE_ART: readonly (readonly string[])[] = [
    // 0 — No maze
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
    // 1 — Box: perimeter wall
    [
      "#####################",
      "#...................#",
      "#...................#",
      "#...................#",
      "#...................#",
      "#...................#",
      "#...................#",
      "#...................#",
      "#...................#",
      "#####################",
    ],
    // 2 — Tunnel: two wall bands form a central corridor, open at the wrap edges
    [
      EMPTY,
      EMPTY,
      EMPTY,
      "######.........######",
      EMPTY,
      EMPTY,
      "######.........######",
      EMPTY,
      EMPTY,
      EMPTY,
    ],
    // 3 — Mill: pinwheel arms, 180°-rotationally symmetric
    [
      EMPTY,
      "......#..............",
      "......#..............",
      "......#......######..",
      EMPTY,
      EMPTY,
      "..######......#......",
      "..............#......",
      "..............#......",
      EMPTY,
    ],
    // 4 — Rails: two long parallel rails
    [
      EMPTY,
      "..#################..",
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      "..#################..",
      EMPTY,
      EMPTY,
    ],
    // 5 — Apartment: perimeter + room dividers with doorways
    [
      "#####################",
      "#.........#.........#",
      "#.........#.........#",
      "#...................#",
      "####...#######...####",
      "#...................#",
      "#.........#.........#",
      "#.........#.........#",
      "#.........#.........#",
      "#####################",
    ],
  ];

  /** Expand a maze's string art into wall cells. Unknown index → No maze. */
  export function parseMaze(index: number): Cell[] {
    const art = MAZE_ART[index] ?? MAZE_ART[0];
    const walls: Cell[] = [];
    art.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === "#") walls.push({ x, y });
      }
    });
    return walls;
  }
  ```

- [ ] Append to `packages/snake/src/index.ts`:

  ```ts
  export { MAZE_NAMES } from "./mazes";
  ```

- [ ] Run `mise exec -- vp test run` — **expect pass**.
- [ ] Run `mise exec -- vp check --fix` — must pass.
- [ ] Commit: `feat(snake): add the six Snake II maze grids`

---

### Task 4 — `createSnake` core: movement, wraparound, turn queue, pause, reset

**Files:** `packages/snake/src/game.ts`, `packages/snake/src/index.ts`,
`packages/snake/tests/movement.test.ts`

This task builds the engine skeleton: deterministic init (including the first food
placement — the PRNG draw order fixed here is what every later expected value relies
on), movement with wraparound, the one-turn-per-tick queue with no-reverse, pause/
resume, and reset. Eating, bonus, and collisions land in Tasks 5–7 by replacing
`tick()` with successively fuller versions.

- [ ] Write the failing test `packages/snake/tests/movement.test.ts` (all expected
      values were computed from the reference algorithm with these exact seeds):

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { createSnake } from "../src/index";

  describe("initial state", () => {
    it("starts idle with a 3-segment snake heading right", () => {
      const g = createSnake({ seed: 1 });
      expect(g.state.status).toBe("idle");
      expect(g.state.snake).toEqual([
        { x: 6, y: 5 },
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ]);
      expect(g.state.dir).toBe("right");
      expect(g.state.pendingDir).toBeNull();
      expect(g.state.cols).toBe(21);
      expect(g.state.rows).toBe(10);
      expect(g.state.score).toBe(0);
      expect(g.state.foodsEaten).toBe(0);
      expect(g.state.level).toBe(1);
      expect(g.state.maze).toBe(0);
      expect(g.state.walls).toEqual([]);
      expect(g.state.bonus).toBeNull();
      expect(g.state.flashOn).toBe(true);
    });

    it("clamps speed and maze options", () => {
      expect(createSnake({ speed: 99 }).state.level).toBe(9);
      expect(createSnake({ speed: -3 }).state.level).toBe(1);
      expect(createSnake({ maze: 1 }).state.walls).toHaveLength(58);
      expect(createSnake({ maze: 99 }).state.maze).toBe(5);
    });

    it("places food deterministically from the seed", () => {
      expect(createSnake({ seed: 1 }).state.food).toEqual({ x: 13, y: 0 });
      expect(createSnake({ seed: 42 }).state.food).toEqual({ x: 12, y: 4 });
      const a = createSnake({ seed: 5 });
      const b = createSnake({ seed: 5 });
      const c = createSnake({ seed: 6 });
      expect(a.state.food).toEqual(b.state.food);
      expect(a.state.food).not.toEqual(c.state.food);
    });

    it("never places food on the snake or walls", () => {
      for (let seed = 1; seed <= 25; seed++) {
        const g = createSnake({ seed, maze: 1 });
        expect(g.state.snake).not.toContainEqual(g.state.food);
        expect(g.state.walls).not.toContainEqual(g.state.food);
      }
    });
  });

  describe("ticking", () => {
    it("does nothing while idle", () => {
      const g = createSnake({ seed: 1 });
      expect(g.tick()).toBe(true);
      expect(g.state.snake[0]).toEqual({ x: 6, y: 5 });
      expect(g.state.status).toBe("idle");
    });

    it("moves one cell per tick once started", () => {
      const g = createSnake({ seed: 1 });
      g.dispatch("right");
      expect(g.state.status).toBe("running");
      expect(g.tick()).toBe(true);
      expect(g.state.snake).toEqual([
        { x: 7, y: 5 },
        { x: 6, y: 5 },
        { x: 5, y: 5 },
      ]);
    });

    it("wraps around the right edge", () => {
      const g = createSnake({ seed: 1 });
      g.dispatch("right");
      for (let i = 0; i < 14; i++) g.tick();
      expect(g.state.snake[0]).toEqual({ x: 20, y: 5 });
      g.tick();
      expect(g.state.snake[0]).toEqual({ x: 0, y: 5 });
    });

    it("wraps around the top edge", () => {
      const g = createSnake({ seed: 1 });
      g.dispatch("up");
      for (let i = 0; i < 5; i++) g.tick();
      expect(g.state.snake[0]).toEqual({ x: 6, y: 0 });
      g.tick();
      expect(g.state.snake[0]).toEqual({ x: 6, y: 9 });
    });
  });

  describe("direction queueing", () => {
    it("ignores reversing into the snake", () => {
      const g = createSnake({ seed: 1 });
      g.dispatch("left"); // starts the game, but reverse of 'right' is ignored
      g.tick();
      expect(g.state.dir).toBe("right");
      expect(g.state.snake[0]).toEqual({ x: 7, y: 5 });
    });

    it("last legal input before the tick wins", () => {
      const g = createSnake({ seed: 1 });
      g.dispatch("up");
      g.dispatch("down"); // legal vs current dir 'right' — replaces 'up'
      g.tick();
      expect(g.state.dir).toBe("down");
      expect(g.state.snake[0]).toEqual({ x: 6, y: 6 });
    });

    it("an illegal reverse does not clobber a queued legal turn", () => {
      const g = createSnake({ seed: 1 });
      g.dispatch("up");
      g.dispatch("left"); // reverse of 'right' — ignored, 'up' stays queued
      g.tick();
      expect(g.state.snake[0]).toEqual({ x: 6, y: 4 });
    });

    it("applies at most one turn per tick", () => {
      const g = createSnake({ seed: 1 });
      g.dispatch("up");
      g.tick();
      expect(g.state.snake[0]).toEqual({ x: 6, y: 4 });
      expect(g.state.pendingDir).toBeNull();
      g.tick();
      expect(g.state.snake[0]).toEqual({ x: 6, y: 3 }); // keeps going up
    });
  });

  describe("pause/resume/reset", () => {
    it("pauses and resumes", () => {
      const g = createSnake({ seed: 1 });
      g.dispatch("right");
      g.tick();
      g.pause();
      expect(g.state.status).toBe("paused");
      expect(g.tick()).toBe(true);
      expect(g.state.snake[0]).toEqual({ x: 7, y: 5 }); // frozen
      g.resume();
      expect(g.state.status).toBe("running");
      g.tick();
      expect(g.state.snake[0]).toEqual({ x: 8, y: 5 });
    });

    it("any dispatch resumes a paused game", () => {
      const g = createSnake({ seed: 1 });
      g.dispatch("right");
      g.tick();
      g.pause();
      g.dispatch("down");
      expect(g.state.status).toBe("running");
    });

    it("reset restores the identical initial state", () => {
      const g = createSnake({ seed: 42 });
      const food0 = { ...g.state.food };
      g.dispatch("up");
      g.tick();
      g.tick();
      g.reset();
      expect(g.state.status).toBe("idle");
      expect(g.state.snake[0]).toEqual({ x: 6, y: 5 });
      expect(g.state.food).toEqual(food0);
      expect(g.state.score).toBe(0);
    });
  });
  ```

- [ ] Run `mise exec -- vp test run` — **expect failure**.
- [ ] Write `packages/snake/src/game.ts`:

  ```ts
  import { parseMaze } from "./mazes";
  import { mulberry32 } from "./prng";
  import { clampLevel } from "./timing";
  import type { Cell, SnakeGame, SnakeInput, SnakeState } from "./types";

  const COLS = 21;
  const ROWS = 10;
  const START_SNAKE: readonly Cell[] = [
    { x: 6, y: 5 },
    { x: 5, y: 5 },
    { x: 4, y: 5 },
  ];
  const DELTAS: Record<SnakeInput, readonly [number, number]> = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };
  const OPPOSITE: Record<SnakeInput, SnakeInput> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };

  export interface SnakeOptions {
    /** Level 1-9: tick cadence via tickIntervalMs() AND points per food. Default 1. */
    speed?: number;
    /** Maze index 0-5 (see MAZE_NAMES). Default 0 (no maze). */
    maze?: number;
    /** PRNG seed for food/bonus placement. Default 1. */
    seed?: number;
  }

  export function createSnake(opts: SnakeOptions = {}): SnakeGame {
    const level = clampLevel(opts.speed ?? 1);
    const maze = Math.min(5, Math.max(0, Math.floor(opts.maze ?? 0)));
    const seed = (opts.seed ?? 1) >>> 0;

    let rng: () => number;
    let state: SnakeState;
    let dyingTicks = 0;

    const key = (c: Cell) => `${c.x},${c.y}`;

    /** Deterministic free-cell placement: PRNG draws, skipping occupied cells.
     * Falls back to a scan, and to null when the board is full. */
    function placeCell(exclude: Cell[]): Cell | null {
      const used = new Set(exclude.map(key));
      for (let i = 0; i < 1000; i++) {
        const x = Math.floor(rng() * COLS);
        const y = Math.floor(rng() * ROWS);
        if (!used.has(`${x},${y}`)) return { x, y };
      }
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (!used.has(`${x},${y}`)) return { x, y };
        }
      }
      return null;
    }

    function init(): void {
      rng = mulberry32(seed);
      const walls = parseMaze(maze);
      state = {
        cols: COLS,
        rows: ROWS,
        snake: START_SNAKE.map((c) => ({ ...c })),
        dir: "right",
        pendingDir: null,
        food: { x: 0, y: 0 }, // replaced just below
        bonus: null,
        foodsEaten: 0,
        score: 0,
        level,
        maze,
        walls,
        status: "idle",
        flashOn: true,
      };
      state.food = placeCell([...state.snake, ...walls]) ?? { x: 0, y: 0 };
      dyingTicks = 0;
    }
    init();

    function tick(): boolean {
      if (state.status === "game-over") return false;
      if (state.status === "idle" || state.status === "paused") return true;
      if (state.pendingDir) {
        if (state.pendingDir !== OPPOSITE[state.dir]) state.dir = state.pendingDir;
        state.pendingDir = null;
      }
      const [dx, dy] = DELTAS[state.dir];
      const head = state.snake[0];
      const next = {
        x: (head.x + dx + COLS) % COLS,
        y: (head.y + dy + ROWS) % ROWS,
      };
      state.snake.unshift(next);
      state.snake.pop();
      return true;
    }

    return {
      get state() {
        return state;
      },
      dispatch(input: SnakeInput): void {
        if (state.status === "dying" || state.status === "game-over") return;
        if (state.status === "idle" || state.status === "paused") {
          state.status = "running"; // Nokia: any key starts/resumes
        }
        if (input === OPPOSITE[state.dir]) return; // no reversing
        state.pendingDir = input; // last input before the tick wins
      },
      pause(): void {
        if (state.status === "running") state.status = "paused";
      },
      resume(): void {
        if (state.status === "paused") state.status = "running";
      },
      tick,
      reset(): void {
        init();
      },
    };
  }
  ```

- [ ] Append to `packages/snake/src/index.ts`:

  ```ts
  export { createSnake } from "./game";
  export type { SnakeOptions } from "./game";
  ```

- [ ] Run `mise exec -- vp test run` — **expect pass**.
- [ ] Run `mise exec -- vp check --fix` — must pass.
- [ ] Commit: `feat(snake): movement, wraparound, turn queue, pause and reset`

---

### Task 5 — Food, growth, scoring

**Files:** `packages/snake/src/game.ts` (replace `tick()`),
`packages/snake/tests/helpers.ts`, `packages/snake/tests/food.test.ts`

- [ ] Write `packages/snake/tests/helpers.ts` — a greedy, wrap-aware steering helper
      used by the food/bonus/death suites (maze 0 only; the snake stays short in these
      tests so greedy steering is always safe):

  ```ts
  import type { Cell, SnakeGame, SnakeInput } from "../src/types";

  const DELTAS: Record<SnakeInput, readonly [number, number]> = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };
  const OPPOSITE: Record<SnakeInput, SnakeInput> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };

  /** Dispatch+tick once, greedily moving the head toward `target`
   * (wrap-aware distance, avoids the snake's own body, never reverses). */
  export function stepToward(game: SnakeGame, target: Cell): void {
    const { cols, rows, snake, dir } = game.state;
    const head = snake[0];
    const dist = (x: number, y: number) => {
      const dx = Math.min((x - target.x + cols) % cols, (target.x - x + cols) % cols);
      const dy = Math.min((y - target.y + rows) % rows, (target.y - y + rows) % rows);
      return dx + dy;
    };
    const body = new Set(snake.slice(0, -1).map((c) => `${c.x},${c.y}`));
    const moves = (Object.keys(DELTAS) as SnakeInput[])
      .filter((m) => m !== OPPOSITE[dir])
      .map((m) => {
        const [dx, dy] = DELTAS[m];
        const nx = (head.x + dx + cols) % cols;
        const ny = (head.y + dy + rows) % rows;
        return { m, d: dist(nx, ny), safe: !body.has(`${nx},${ny}`) };
      })
      .sort((a, b) => Number(b.safe) - Number(a.safe) || a.d - b.d);
    game.dispatch(moves[0].m);
    game.tick();
  }

  /** Drive the snake until its head reaches `target`. Throws if it dies or stalls. */
  export function steerToCell(game: SnakeGame, target: Cell, maxTicks = 400): void {
    for (let i = 0; i < maxTicks; i++) {
      if (game.state.status === "dying" || game.state.status === "game-over") {
        throw new Error("snake died while steering");
      }
      stepToward(game, target);
      const h = game.state.snake[0];
      if (h.x === target.x && h.y === target.y) return;
    }
    throw new Error("failed to reach target");
  }

  /** Steer to the current food and eat it. */
  export function eatNextFood(game: SnakeGame): void {
    steerToCell(game, { ...game.state.food });
  }
  ```

- [ ] Write the failing test `packages/snake/tests/food.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { createSnake } from "../src/index";
  import { eatNextFood } from "./helpers";

  describe("food", () => {
    it("eating grows the snake by one and scores `level` points", () => {
      const g = createSnake({ seed: 1, speed: 2 });
      const food0 = { ...g.state.food };
      expect(food0).toEqual({ x: 13, y: 0 });
      eatNextFood(g);
      expect(g.state.snake[0]).toEqual(food0);
      expect(g.state.snake).toHaveLength(4);
      expect(g.state.score).toBe(2);
      expect(g.state.foodsEaten).toBe(1);
    });

    it("respawns food deterministically, never on the snake", () => {
      const g = createSnake({ seed: 1, speed: 2 });
      eatNextFood(g);
      expect(g.state.food).toEqual({ x: 11, y: 9 });
      expect(g.state.snake).not.toContainEqual(g.state.food);
    });

    it("score scales with level for the same seed", () => {
      const a = createSnake({ seed: 1, speed: 1 });
      const b = createSnake({ seed: 1, speed: 9 });
      eatNextFood(a);
      eatNextFood(b);
      expect(a.state.score).toBe(1);
      expect(b.state.score).toBe(9);
    });

    it("eats several foods in a row and keeps growing", () => {
      const g = createSnake({ seed: 1 });
      for (let i = 0; i < 4; i++) eatNextFood(g);
      expect(g.state.foodsEaten).toBe(4);
      expect(g.state.snake).toHaveLength(7);
      expect(g.state.status).toBe("running");
    });
  });
  ```

- [ ] Run `mise exec -- vp test run` — **expect failure** (no growth/score yet).
- [ ] In `packages/snake/src/game.ts`, replace the whole `tick()` function with:

  ```ts
  function tick(): boolean {
    if (state.status === "game-over") return false;
    if (state.status === "idle" || state.status === "paused") return true;
    if (state.pendingDir) {
      if (state.pendingDir !== OPPOSITE[state.dir]) state.dir = state.pendingDir;
      state.pendingDir = null;
    }
    const [dx, dy] = DELTAS[state.dir];
    const head = state.snake[0];
    const next = {
      x: (head.x + dx + COLS) % COLS,
      y: (head.y + dy + ROWS) % ROWS,
    };
    const eating = next.x === state.food.x && next.y === state.food.y;
    state.snake.unshift(next);
    if (eating) {
      state.score += state.level; // spec: points per food = level
      state.foodsEaten += 1;
      const food = placeCell([...state.snake, ...state.walls]);
      if (food === null) {
        state.status = "game-over"; // board full — nothing left to eat
        return false;
      }
      state.food = food;
    } else {
      state.snake.pop();
    }
    return true;
  }
  ```

- [ ] Run `mise exec -- vp test run` — **expect pass** (movement suite must still pass).
- [ ] Run `mise exec -- vp check --fix` — must pass.
- [ ] Commit: `feat(snake): food eating, growth and level-scaled scoring`

---

### Task 6 — Bonus bug lifecycle

**Files:** `packages/snake/src/game.ts` (replace `tick()`),
`packages/snake/tests/bonus.test.ts`

Per spec §7 (best-guess values, stated there): a bonus bug appears after **every 5th
food**, occupies **1 logical cell** (drawn as a 4×4 bug sprite), lives for **20
ticks**, starts at **value = level × 5** and loses 1 per tick (floor 1); eating it
adds its current value and does **not** grow the snake.

- [ ] Write the failing test `packages/snake/tests/bonus.test.ts` (expected cells/
      values computed from the seed-1 PRNG sequence — do not alter):

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { createSnake } from "../src/index";
  import { eatNextFood, stepToward } from "./helpers";

  function gameWithBonus(speed = 3) {
    const g = createSnake({ seed: 1, speed });
    for (let i = 0; i < 5; i++) eatNextFood(g);
    return g;
  }

  describe("bonus bug", () => {
    it("spawns on the 5th food with ttl 20 and value level*5", () => {
      const g = gameWithBonus();
      expect(g.state.foodsEaten).toBe(5);
      expect(g.state.bonus).toEqual({ cell: { x: 2, y: 4 }, ttl: 20, value: 15 });
    });

    it("does not spawn before the 5th food", () => {
      const g = createSnake({ seed: 1, speed: 3 });
      for (let i = 0; i < 4; i++) eatNextFood(g);
      expect(g.state.bonus).toBeNull();
    });

    it("never spawns on the snake, walls or food", () => {
      const g = gameWithBonus();
      const b = g.state.bonus!;
      expect(g.state.snake).not.toContainEqual(b.cell);
      expect(g.state.food).not.toEqual(b.cell);
    });

    it("counts down ttl and value each tick, value floors at 1", () => {
      const g = gameWithBonus();
      g.tick();
      expect(g.state.bonus).toEqual({ cell: { x: 2, y: 4 }, ttl: 19, value: 14 });
      for (let i = 0; i < 15; i++) g.tick();
      expect(g.state.bonus).toEqual({ cell: { x: 2, y: 4 }, ttl: 4, value: 1 });
    });

    it("expires after 20 ticks, awarding nothing", () => {
      const g = gameWithBonus();
      const score = g.state.score;
      for (let i = 0; i < 20; i++) g.tick();
      expect(g.state.bonus).toBeNull();
      expect(g.state.score).toBe(score);
      expect(g.state.status).toBe("running");
      expect(g.state.foodsEaten).toBe(5);
    });

    it("eating the bonus scores its current value and does not grow", () => {
      const g = gameWithBonus();
      const cell = { ...g.state.bonus!.cell };
      const scoreBefore = g.state.score;
      const lenBefore = g.state.snake.length;
      let lastValue = g.state.bonus!.value;
      for (let i = 0; i < 100 && g.state.bonus; i++) {
        lastValue = g.state.bonus.value;
        stepToward(g, cell);
      }
      expect(g.state.snake[0]).toEqual(cell); // reached it before expiry
      expect(g.state.score).toBe(scoreBefore + lastValue);
      expect(g.state.snake).toHaveLength(lenBefore);
    });
  });
  ```

- [ ] Run `mise exec -- vp test run` — **expect failure**.
- [ ] In `packages/snake/src/game.ts`, replace the whole `tick()` function with:

  ```ts
  function tick(): boolean {
    if (state.status === "game-over") return false;
    if (state.status === "idle" || state.status === "paused") return true;
    if (state.pendingDir) {
      if (state.pendingDir !== OPPOSITE[state.dir]) state.dir = state.pendingDir;
      state.pendingDir = null;
    }
    const [dx, dy] = DELTAS[state.dir];
    const head = state.snake[0];
    const next = {
      x: (head.x + dx + COLS) % COLS,
      y: (head.y + dy + ROWS) % ROWS,
    };
    const eating = next.x === state.food.x && next.y === state.food.y;
    state.snake.unshift(next);
    let spawnedBonus = false;
    if (eating) {
      state.score += state.level;
      state.foodsEaten += 1;
      const food = placeCell([
        ...state.snake,
        ...state.walls,
        ...(state.bonus ? [state.bonus.cell] : []),
      ]);
      if (food === null) {
        state.status = "game-over";
        return false;
      }
      state.food = food;
      if (state.foodsEaten % 5 === 0) {
        const cell = placeCell([...state.snake, ...state.walls, state.food]);
        if (cell) {
          // a fresh bonus replaces any survivor from the previous batch
          state.bonus = { cell, ttl: 20, value: state.level * 5 };
          spawnedBonus = true;
        }
      }
    } else if (state.bonus && next.x === state.bonus.cell.x && next.y === state.bonus.cell.y) {
      state.score += state.bonus.value; // current countdown value
      state.bonus = null;
      state.snake.pop(); // bonus does NOT grow the snake
    } else {
      state.snake.pop();
    }
    if (state.bonus && !spawnedBonus) {
      state.bonus.ttl -= 1;
      state.bonus.value = Math.max(1, state.bonus.value - 1);
      if (state.bonus.ttl === 0) state.bonus = null;
    }
    return true;
  }
  ```

- [ ] Run `mise exec -- vp test run` — **expect pass** (all earlier suites too).
- [ ] Run `mise exec -- vp check --fix` — must pass.
- [ ] Commit: `feat(snake): bonus bug spawn, countdown, scoring and expiry`

---

### Task 7 — Collisions, death animation, game over

**Files:** `packages/snake/src/game.ts` (replace `tick()`),
`packages/snake/tests/death.test.ts`

Collision with a wall cell or the snake's own body enters `dying` (the snake never
occupies the collision cell). The collision tick hides the snake (`flashOn false`)
and returns `true`; the next tick shows it again (`true`); the tick after transitions
to `game-over` and returns `false`. The tail cell is vacated on a non-eating move, so
moving into it is **not** a collision.

- [ ] Write the failing test `packages/snake/tests/death.test.ts` (tick counts
      computed: head starts at x=6, Box east wall at x=20 → 13 free moves, collision on
      tick 14):

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { createSnake } from "../src/index";
  import type { SnakeInput } from "../src/index";
  import { eatNextFood } from "./helpers";

  const CLOCKWISE: Record<SnakeInput, SnakeInput> = {
    right: "down",
    down: "left",
    left: "up",
    up: "right",
  };

  function dyingGame() {
    const g = createSnake({ seed: 1, maze: 1 });
    g.dispatch("right");
    for (let i = 0; i < 14; i++) g.tick();
    return g;
  }

  describe("wall collision", () => {
    it("hits the Box east wall on the 14th tick", () => {
      const g = createSnake({ seed: 1, maze: 1 });
      g.dispatch("right");
      for (let i = 0; i < 13; i++) {
        expect(g.tick()).toBe(true);
        expect(g.state.status).toBe("running");
      }
      expect(g.tick()).toBe(true); // collision tick enters 'dying'
      expect(g.state.status).toBe("dying");
      expect(g.state.snake[0]).toEqual({ x: 19, y: 5 }); // never enters the wall
      expect(g.state.flashOn).toBe(false);
    });
  });

  describe("self collision", () => {
    it("dies when U-turning into its own body", () => {
      const g = createSnake({ seed: 1 });
      eatNextFood(g);
      eatNextFood(g); // length 5 — long enough to turn back into
      for (let i = 0; i < 3; i++) {
        g.dispatch(CLOCKWISE[g.state.dir]);
        g.tick();
      }
      expect(g.state.status).toBe("dying");
      expect(g.state.snake).toHaveLength(5);
    });

    it("moving into the vacating tail cell is safe", () => {
      // length 3: a tight clockwise circle revisits the old tail cell — no death
      const g = createSnake({ seed: 1 });
      g.dispatch("right");
      g.tick();
      for (const turn of ["down", "left", "up"] as const) {
        g.dispatch(turn);
        g.tick();
      }
      expect(g.state.status).toBe("running");
    });
  });

  describe("death sequence", () => {
    it("flashes for two ticks, then game over", () => {
      const g = dyingGame();
      expect(g.state.status).toBe("dying");
      expect(g.state.flashOn).toBe(false);
      expect(g.tick()).toBe(true);
      expect(g.state.flashOn).toBe(true);
      expect(g.tick()).toBe(false);
      expect(g.state.status).toBe("game-over");
      expect(g.tick()).toBe(false); // stays over
    });

    it("ignores input while dying and after game over", () => {
      const g = dyingGame();
      g.dispatch("up");
      expect(g.state.pendingDir).toBeNull();
      g.tick();
      g.tick();
      g.dispatch("up");
      expect(g.state.status).toBe("game-over");
      expect(g.state.pendingDir).toBeNull();
    });

    it("reset starts a fresh game after game over", () => {
      const g = dyingGame();
      g.tick();
      g.tick();
      expect(g.state.status).toBe("game-over");
      g.reset();
      expect(g.state.status).toBe("idle");
      g.dispatch("right");
      expect(g.tick()).toBe(true);
      expect(g.state.snake[0]).toEqual({ x: 7, y: 5 });
    });
  });
  ```

- [ ] Run `mise exec -- vp test run` — **expect failure**.
- [ ] In `packages/snake/src/game.ts`, replace the whole `tick()` function with the
      **final** version (this is the complete shipped engine tick):

  ```ts
  function tick(): boolean {
    if (state.status === "game-over") return false;
    if (state.status === "idle" || state.status === "paused") return true;
    if (state.status === "dying") {
      state.flashOn = !state.flashOn;
      dyingTicks -= 1;
      if (dyingTicks === 0) {
        state.status = "game-over";
        return false;
      }
      return true;
    }
    if (state.pendingDir) {
      if (state.pendingDir !== OPPOSITE[state.dir]) state.dir = state.pendingDir;
      state.pendingDir = null;
    }
    const [dx, dy] = DELTAS[state.dir];
    const head = state.snake[0];
    const next = {
      x: (head.x + dx + COLS) % COLS,
      y: (head.y + dy + ROWS) % ROWS,
    };
    const eating = next.x === state.food.x && next.y === state.food.y;
    // when not eating, the tail vacates its cell this tick — not a collision
    const body = eating ? state.snake : state.snake.slice(0, -1);
    const blocked =
      state.walls.some((c) => c.x === next.x && c.y === next.y) ||
      body.some((c) => c.x === next.x && c.y === next.y);
    if (blocked) {
      state.status = "dying";
      dyingTicks = 2;
      state.flashOn = false; // snake hidden on the collision frame
      return true;
    }
    state.snake.unshift(next);
    let spawnedBonus = false;
    if (eating) {
      state.score += state.level;
      state.foodsEaten += 1;
      const food = placeCell([
        ...state.snake,
        ...state.walls,
        ...(state.bonus ? [state.bonus.cell] : []),
      ]);
      if (food === null) {
        state.status = "game-over";
        return false;
      }
      state.food = food;
      if (state.foodsEaten % 5 === 0) {
        const cell = placeCell([...state.snake, ...state.walls, state.food]);
        if (cell) {
          state.bonus = { cell, ttl: 20, value: state.level * 5 };
          spawnedBonus = true;
        }
      }
    } else if (state.bonus && next.x === state.bonus.cell.x && next.y === state.bonus.cell.y) {
      state.score += state.bonus.value;
      state.bonus = null;
      state.snake.pop();
    } else {
      state.snake.pop();
    }
    if (state.bonus && !spawnedBonus) {
      state.bonus.ttl -= 1;
      state.bonus.value = Math.max(1, state.bonus.value - 1);
      if (state.bonus.ttl === 0) state.bonus = null;
    }
    return true;
  }
  ```

- [ ] Run `mise exec -- vp test run` — **expect pass** (every suite so far).
- [ ] Run `mise exec -- vp check --fix` — must pass.
- [ ] Commit: `feat(snake): wall/self collision, death flash and game over`

---

### Task 8 — Bitmap primitives, 3×5 digit font, cell sprites

**Files:** `packages/snake/src/bitmap.ts`, `packages/snake/src/font.ts`,
`packages/snake/src/sprites.ts`, `packages/snake/tests/pixels.ts`,
`packages/snake/tests/bitmap.test.ts`

- [ ] Write `packages/snake/tests/pixels.ts` — the pixel-assertion helper used by
      every rendering test:

  ```ts
  import { expect } from "vite-plus/test";
  import type { Bitmap } from "../src/types";

  /** Extract a rectangular region as string art ('#' = set, '.' = clear). */
  export function frameRegion(b: Bitmap, x: number, y: number, w: number, h: number): string {
    const rows: string[] = [];
    for (let yy = y; yy < y + h; yy++) {
      let row = "";
      for (let xx = x; xx < x + w; xx++) {
        row += b.pixels[yy * b.width + xx] ? "#" : ".";
      }
      rows.push(row);
    }
    return rows.join("\n");
  }

  /** Assert that a region of the bitmap matches the given string art
   * (leading/trailing whitespace per line is ignored). */
  export function expectFrame(
    b: Bitmap,
    x: number,
    y: number,
    w: number,
    h: number,
    art: string,
  ): void {
    const expected = art
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .join("\n");
    expect(frameRegion(b, x, y, w, h)).toBe(expected);
  }
  ```

- [ ] Write the failing test `packages/snake/tests/bitmap.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { createBitmap, drawArt, fillRect, setPixel } from "../src/bitmap";
  import { FONT_3X5, drawNumber } from "../src/font";
  import {
    SPRITE_BODY_NOTCH,
    SPRITE_BODY_SOLID,
    SPRITE_BONUS,
    SPRITE_FOOD,
    SPRITE_HEAD,
  } from "../src/sprites";
  import { expectFrame } from "./pixels";

  describe("bitmap", () => {
    it("creates an 84x48 zeroed buffer by default", () => {
      const b = createBitmap();
      expect(b.width).toBe(84);
      expect(b.height).toBe(48);
      expect(b.pixels).toHaveLength(84 * 48);
      expect(b.pixels.every((p) => p === 0)).toBe(true);
    });

    it("setPixel clips out-of-bounds writes", () => {
      const b = createBitmap(4, 4);
      setPixel(b, -1, 0);
      setPixel(b, 4, 0);
      setPixel(b, 0, -1);
      setPixel(b, 0, 4);
      expect(b.pixels.every((p) => p === 0)).toBe(true);
      setPixel(b, 3, 3);
      expect(b.pixels[3 * 4 + 3]).toBe(1);
    });

    it("fillRect and drawArt set the right pixels", () => {
      const b = createBitmap(8, 8);
      fillRect(b, 1, 1, 2, 2);
      drawArt(b, 4, 4, ["#.", ".#"]);
      expectFrame(
        b,
        0,
        0,
        8,
        8,
        `
        ........
        .##.....
        .##.....
        ........
        ....#...
        .....#..
        ........
        ........
      `,
      );
    });
  });

  describe("3x5 digit font", () => {
    it("has all ten digits, 3x5 each", () => {
      for (let d = 0; d <= 9; d++) {
        const glyph = FONT_3X5[String(d)];
        expect(glyph).toHaveLength(5);
        for (const row of glyph) expect(row).toMatch(/^[#.]{3}$/);
      }
    });

    it("draws multi-digit numbers with a 1px gap", () => {
      const b = createBitmap(16, 8);
      drawNumber(b, 1, 1, 90);
      expectFrame(
        b,
        1,
        1,
        7,
        5,
        `
        ###.###
        #.#.#.#
        ###.#.#
        ..#.#.#
        ###.###
      `,
      );
    });
  });

  describe("sprites", () => {
    it("are all 4x4", () => {
      for (const s of [
        SPRITE_HEAD,
        SPRITE_BODY_NOTCH,
        SPRITE_BODY_SOLID,
        SPRITE_FOOD,
        SPRITE_BONUS,
      ]) {
        expect(s).toHaveLength(4);
        for (const row of s) expect(row).toMatch(/^[#.]{4}$/);
      }
    });
  });
  ```

- [ ] Run `mise exec -- vp test run` — **expect failure**.
- [ ] Write `packages/snake/src/bitmap.ts`:

  ```ts
  import type { Bitmap } from "./types";

  /** Allocate a zeroed 1bpp bitmap (defaults to the 84×48 Nokia screen). */
  export function createBitmap(width = 84, height = 48): Bitmap {
    return { width, height, pixels: new Uint8Array(width * height) };
  }

  /** Set one pixel; silently clips out-of-bounds coordinates. */
  export function setPixel(b: Bitmap, x: number, y: number): void {
    if (x < 0 || y < 0 || x >= b.width || y >= b.height) return;
    b.pixels[y * b.width + x] = 1;
  }

  export function fillRect(b: Bitmap, x: number, y: number, w: number, h: number): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) setPixel(b, xx, yy);
    }
  }

  /** Stamp string art ('#' = set, anything else = transparent) at (x, y). */
  export function drawArt(b: Bitmap, x: number, y: number, art: readonly string[]): void {
    art.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        if (row[dx] === "#") setPixel(b, x + dx, y + dy);
      }
    });
  }
  ```

- [ ] Write `packages/snake/src/font.ts`:

  ```ts
  import { drawArt } from "./bitmap";
  import type { Bitmap } from "./types";

  /** 3×5 digit font for the score bar (glyphs advance 4px: 3 wide + 1 gap). */
  export const FONT_3X5: Record<string, readonly string[]> = {
    "0": ["###", "#.#", "#.#", "#.#", "###"],
    "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "###", "#..", "###"],
    "3": ["###", "..#", "###", "..#", "###"],
    "4": ["#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "###", "..#", "###"],
    "6": ["###", "#..", "###", "#.#", "###"],
    "7": ["###", "..#", "..#", ".#.", ".#."],
    "8": ["###", "#.#", "###", "#.#", "###"],
    "9": ["###", "#.#", "###", "..#", "###"],
  };

  /** Draw a non-negative integer left-aligned at (x, y) in the 3×5 font. */
  export function drawNumber(b: Bitmap, x: number, y: number, value: number): void {
    const digits = String(Math.max(0, Math.floor(value)));
    for (let i = 0; i < digits.length; i++) {
      drawArt(b, x + i * 4, y, FONT_3X5[digits[i]]);
    }
  }

  /** Pixel width of a number rendered by drawNumber. */
  export function numberWidth(value: number): number {
    return String(Math.max(0, Math.floor(value))).length * 4 - 1;
  }
  ```

- [ ] Write `packages/snake/src/sprites.ts`:

  ```ts
  /** 4×4 cell sprites ('#' = set pixel). The chequered body look comes from
   * alternating solid and notched segments along the snake. */
  export const SPRITE_HEAD: readonly string[] = [
    "####",
    "#..#", // 2px "eye" slot
    "####",
    "####",
  ];

  export const SPRITE_BODY_NOTCH: readonly string[] = ["####", "#..#", "#..#", "####"];

  export const SPRITE_BODY_SOLID: readonly string[] = ["####", "####", "####", "####"];

  export const SPRITE_FOOD: readonly string[] = [
    "....",
    ".##.", // 2×2 centered dot
    ".##.",
    "....",
  ];

  export const SPRITE_BONUS: readonly string[] = [
    ".##.", // bug: round back...
    "####",
    "####",
    "#..#", // ...and legs
  ];
  ```

- [ ] Run `mise exec -- vp test run` — **expect pass**.
- [ ] Run `mise exec -- vp check --fix` — must pass.
- [ ] Commit: `feat(snake): bitmap primitives, 3x5 digit font and cell sprites`

---

### Task 9 — `renderSnakeFrame`: score bar and playfield

**Files:** `packages/snake/src/render.ts`, `packages/snake/src/index.ts`,
`packages/snake/tests/render.test.ts`

Pixel layout (from the design constants): cell `(cx, cy)` → pixel rect
`(cx·4, 8 + cy·4, 4, 4)`. Score at (1,1); bonus countdown right-aligned ending at
x=82 (i.e. drawn at `x = 84 − digits·4`); separator line across y=7. `idle` and
`paused` render exactly like `running` (the host decides how to dress pauses).

- [ ] Write the failing test `packages/snake/tests/render.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { renderSnakeFrame } from "../src/index";
  import type { SnakeState } from "../src/index";
  import { expectFrame, frameRegion } from "./pixels";

  function baseState(partial: Partial<SnakeState> = {}): SnakeState {
    return {
      cols: 21,
      rows: 10,
      snake: [
        { x: 6, y: 5 },
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ],
      dir: "right",
      pendingDir: null,
      food: { x: 13, y: 0 },
      bonus: null,
      foodsEaten: 0,
      score: 0,
      level: 1,
      maze: 0,
      walls: [],
      status: "running",
      flashOn: true,
      ...partial,
    };
  }

  describe("renderSnakeFrame", () => {
    it("returns a fresh 84x48 bitmap and does not mutate state", () => {
      const s = baseState();
      const before = JSON.stringify(s);
      const b = renderSnakeFrame(s);
      expect(b.width).toBe(84);
      expect(b.height).toBe(48);
      expect(b.pixels).toHaveLength(84 * 48);
      expect(JSON.stringify(s)).toBe(before);
      expect(renderSnakeFrame(s)).not.toBe(b);
    });

    it("draws the score top-left and the separator line at y=7", () => {
      const b = renderSnakeFrame(baseState({ score: 90 }));
      expectFrame(
        b,
        1,
        1,
        7,
        5,
        `
        ###.###
        #.#.#.#
        ###.#.#
        ..#.#.#
        ###.###
      `,
      );
      expect(frameRegion(b, 0, 7, 84, 1)).toBe("#".repeat(84));
      // score bar is otherwise empty
      const emptyRows = Array.from({ length: 7 }, () => ".".repeat(8)).join("\n");
      expect(frameRegion(b, 40, 0, 8, 7)).toBe(emptyRows);
    });

    it("draws head, notched and solid body segments at their cells", () => {
      const b = renderSnakeFrame(baseState());
      // head cell (6,5) → px (24,28)
      expectFrame(
        b,
        24,
        28,
        4,
        4,
        `
        ####
        #..#
        ####
        ####
      `,
      );
      // body index 1 (5,5) → notched
      expectFrame(
        b,
        20,
        28,
        4,
        4,
        `
        ####
        #..#
        #..#
        ####
      `,
      );
      // body index 2 (4,5) → solid
      expectFrame(
        b,
        16,
        28,
        4,
        4,
        `
        ####
        ####
        ####
        ####
      `,
      );
    });

    it("draws food as a 2x2 dot in its cell", () => {
      const b = renderSnakeFrame(baseState()); // food (13,0) → px (52,8)
      expectFrame(
        b,
        52,
        8,
        4,
        4,
        `
        ....
        .##.
        .##.
        ....
      `,
      );
    });

    it("draws walls as solid 4x4 blocks", () => {
      const b = renderSnakeFrame(
        baseState({
          walls: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        }),
      );
      expect(frameRegion(b, 0, 8, 8, 4)).toBe(
        ["########", "########", "########", "########"].join("\n"),
      );
    });

    it("draws the bonus bug and its countdown top-right", () => {
      const b = renderSnakeFrame(
        baseState({ bonus: { cell: { x: 10, y: 2 }, ttl: 20, value: 15 } }),
      );
      // bonus cell (10,2) → px (40,16)
      expectFrame(
        b,
        40,
        16,
        4,
        4,
        `
        .##.
        ####
        ####
        #..#
      `,
      );
      // countdown "15" right-aligned: x = 84 - 2*4 = 76
      expectFrame(
        b,
        76,
        1,
        7,
        5,
        `
        .#..###
        ##..#..
        .#..###
        .#....#
        ###.###
      `,
      );
    });

    it("renders idle and paused exactly like running", () => {
      const run = renderSnakeFrame(baseState());
      expect(renderSnakeFrame(baseState({ status: "idle" })).pixels).toEqual(run.pixels);
      expect(renderSnakeFrame(baseState({ status: "paused" })).pixels).toEqual(run.pixels);
    });
  });
  ```

- [ ] Run `mise exec -- vp test run` — **expect failure**.
- [ ] Write `packages/snake/src/render.ts` (the `game-over` branch is a stub until
      Task 10):

  ```ts
  import { createBitmap, drawArt, fillRect } from "./bitmap";
  import { drawNumber, numberWidth } from "./font";
  import {
    SPRITE_BODY_NOTCH,
    SPRITE_BODY_SOLID,
    SPRITE_BONUS,
    SPRITE_FOOD,
    SPRITE_HEAD,
  } from "./sprites";
  import type { Bitmap, Cell, SnakeState } from "./types";

  const SCORE_BAR_H = 8;
  const CELL = 4;

  function cellOrigin(c: Cell): readonly [number, number] {
    return [c.x * CELL, SCORE_BAR_H + c.y * CELL];
  }

  /** Pure rasterizer: SnakeState → 84×48 1bpp Bitmap. Never mutates state. */
  export function renderSnakeFrame(state: SnakeState): Bitmap {
    const b = createBitmap(84, 48);

    if (state.status === "game-over") {
      // completed in Task 10
      return b;
    }

    // — score bar —
    drawNumber(b, 1, 1, state.score);
    if (state.bonus) {
      drawNumber(b, b.width - (numberWidth(state.bonus.value) + 1), 1, state.bonus.value);
    }
    fillRect(b, 0, SCORE_BAR_H - 1, b.width, 1);

    // — playfield —
    for (const w of state.walls) {
      const [x, y] = cellOrigin(w);
      fillRect(b, x, y, CELL, CELL);
    }
    {
      const [x, y] = cellOrigin(state.food);
      drawArt(b, x, y, SPRITE_FOOD);
    }
    if (state.bonus) {
      const [x, y] = cellOrigin(state.bonus.cell);
      drawArt(b, x, y, SPRITE_BONUS);
    }
    const snakeVisible = state.status !== "dying" || state.flashOn;
    if (snakeVisible) {
      state.snake.forEach((c, i) => {
        const [x, y] = cellOrigin(c);
        const sprite = i === 0 ? SPRITE_HEAD : i % 2 === 1 ? SPRITE_BODY_NOTCH : SPRITE_BODY_SOLID;
        drawArt(b, x, y, sprite);
      });
    }
    return b;
  }
  ```

  (Check the countdown x: `84 − (numberWidth(v) + 1)` puts the last glyph column at
  x=82 — for value 15 that is x=76, matching the test.)

- [ ] Append to `packages/snake/src/index.ts`:

  ```ts
  export { renderSnakeFrame } from "./render";
  ```

- [ ] Run `mise exec -- vp test run` — **expect pass**.
- [ ] Run `mise exec -- vp check --fix` — must pass.
- [ ] Commit: `feat(snake): rasterize score bar and playfield to an 84x48 bitmap`

---

### Task 10 — Death flash and the GAME OVER screen

**Files:** `packages/snake/src/font.ts` (append),
`packages/snake/src/render.ts` (replace the game-over stub),
`packages/snake/tests/game-over.test.ts`

The game-over frame replaces everything: no score bar, no playfield — "GAME OVER" in
a minimal 5×7 caps font (only the seven glyphs that text needs are included), with
the final score centered below in the 3×5 digit font. Layout: "GAME OVER" is 9
characters at a 6px advance (5 wide + 1 gap) = 53 px → x = ⌊(84−53)/2⌋ = 15, y = 14.
Score: width = digits·4−1, x = ⌊(84−width)/2⌋, y = 28.

- [ ] Write the failing test `packages/snake/tests/game-over.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { renderSnakeFrame } from "../src/index";
  import type { SnakeState } from "../src/index";
  import { expectFrame, frameRegion } from "./pixels";

  function baseState(partial: Partial<SnakeState> = {}): SnakeState {
    return {
      cols: 21,
      rows: 10,
      snake: [
        { x: 6, y: 5 },
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ],
      dir: "right",
      pendingDir: null,
      food: { x: 13, y: 0 },
      bonus: null,
      foodsEaten: 0,
      score: 0,
      level: 1,
      maze: 0,
      walls: [],
      status: "running",
      flashOn: true,
      ...partial,
    };
  }

  describe("dying flash", () => {
    it("hides the snake when flashOn is false, keeps food visible", () => {
      const b = renderSnakeFrame(baseState({ status: "dying", flashOn: false }));
      // head cell (6,5) → px (24,28): empty
      expectFrame(
        b,
        24,
        28,
        4,
        4,
        `
        ....
        ....
        ....
        ....
      `,
      );
      // food still drawn
      expectFrame(
        b,
        52,
        8,
        4,
        4,
        `
        ....
        .##.
        .##.
        ....
      `,
      );
    });

    it("shows the snake when flashOn is true", () => {
      const b = renderSnakeFrame(baseState({ status: "dying", flashOn: true }));
      expectFrame(
        b,
        24,
        28,
        4,
        4,
        `
        ####
        #..#
        ####
        ####
      `,
      );
    });
  });

  describe("game over screen", () => {
    it("draws GAME OVER centered with no separator or playfield", () => {
      const b = renderSnakeFrame(baseState({ status: "game-over" }));
      // 'G' at x=15
      expectFrame(
        b,
        15,
        14,
        5,
        7,
        `
        .####
        #....
        #....
        #.###
        #...#
        #...#
        .###.
      `,
      );
      // 'R' (last letter) at x = 15 + 8*6 = 63
      expectFrame(
        b,
        63,
        14,
        5,
        7,
        `
        ####.
        #...#
        #...#
        ####.
        #.#..
        #..#.
        #...#
      `,
      );
      // no separator line, no snake
      expect(frameRegion(b, 0, 7, 8, 1)).toBe("........");
      expect(frameRegion(b, 24, 28, 4, 1)).toBe("....");
    });

    it("centers the final score below the text", () => {
      const zero = renderSnakeFrame(baseState({ status: "game-over", score: 0 }));
      // one digit: width 3 → x = 40
      expectFrame(
        zero,
        40,
        28,
        3,
        5,
        `
        ###
        #.#
        #.#
        #.#
        ###
      `,
      );
      const b = renderSnakeFrame(baseState({ status: "game-over", score: 123 }));
      // three digits: width 11 → x = 36
      expectFrame(
        b,
        36,
        28,
        11,
        5,
        `
        .#..###.###
        ##....#...#
        .#..###.###
        .#..#.....#
        ###.###.###
      `,
      );
    });
  });
  ```

- [ ] Run `mise exec -- vp test run` — **expect failure**.
- [ ] Append to `packages/snake/src/font.ts` (5×7 caps glyphs — only the letters in
      "GAME OVER"; a space just advances):

  ```ts
  /** Minimal 5×7 caps font: exactly the glyphs needed for "GAME OVER". */
  export const FONT_5X7: Record<string, readonly string[]> = {
    A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
    M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  };

  /** Draw caps text in the 5×7 font (6px advance; unknown chars/space skip). */
  export function drawText5x7(b: Bitmap, x: number, y: number, text: string): void {
    for (let i = 0; i < text.length; i++) {
      const glyph = FONT_5X7[text[i]];
      if (glyph) drawArt(b, x + i * 6, y, glyph);
    }
  }
  ```

- [ ] In `packages/snake/src/render.ts`, add `drawText5x7` to the existing `./font`
      import and replace the game-over stub:

  ```ts
  if (state.status === "game-over") {
    drawText5x7(b, 15, 14, "GAME OVER"); // 53px wide, centered
    drawNumber(b, Math.floor((b.width - numberWidth(state.score)) / 2), 28, state.score);
    return b;
  }
  ```

- [ ] Run `mise exec -- vp test run` — **expect pass**.
- [ ] Run `mise exec -- vp check --fix` — must pass.
- [ ] Commit: `feat(snake): death flash rendering and GAME OVER screen`

---

### Task 11 — Integration test, README, finish the plan

**Files:** `packages/snake/tests/integration.test.ts`, `packages/snake/README.md`,
`docs/plans/README.md`

- [ ] Write the failing test `packages/snake/tests/integration.test.ts` — a full
      deterministic playthrough using only the public API (tick counts per the death
      suite: 13 running ticks + collision tick + 1 flash tick all return `true`; the
      16th returns `false`):

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { createSnake, renderSnakeFrame, tickIntervalMs } from "../src/index";
  import { expectFrame } from "./pixels";

  describe("full game on the Box maze", () => {
    it("plays from idle to GAME OVER deterministically", () => {
      const g = createSnake({ seed: 1, maze: 1, speed: 4 });
      expect(tickIntervalMs(4)).toBe(380); // host cadence for this game
      g.dispatch("right");
      let ticks = 0;
      while (g.tick()) ticks += 1;
      expect(ticks).toBe(15);
      expect(g.state.status).toBe("game-over");
      expect(g.state.score).toBe(0); // food at (12,7) was never on the path

      const frame = renderSnakeFrame(g.state);
      expectFrame(
        frame,
        15,
        14,
        5,
        7,
        `
        .####
        #....
        #....
        #.###
        #...#
        #...#
        .###.
      `,
      );
      expectFrame(
        frame,
        40,
        28,
        3,
        5,
        `
        ###
        #.#
        #.#
        #.#
        ###
      `,
      );
      expect(g.tick()).toBe(false);
      g.reset();
      expect(g.state.status).toBe("idle");
      expect(g.state.food).toEqual({ x: 12, y: 7 }); // reseeded PRNG
    });
  });
  ```

- [ ] Run `mise exec -- vp test run` — **expect failure** only if anything above
      regressed; if it fails for any other reason, stop and report. Otherwise it passes
      immediately — that is acceptable for this capstone test.
- [ ] Write `packages/snake/README.md`:

  ````markdown
  # @hellotimber/snake

  Nokia Snake II as a pure TypeScript library: a deterministic rules engine plus a
  rasterizer that draws any game state to an 84×48 1-bit bitmap. Zero dependencies,
  no DOM, no timers — the host decides when to tick and where to put the pixels.

  Gameplay follows the original Snake II: 21×10 cell playfield with wraparound
  edges, no reversing, six mazes (No maze, Box, Tunnel, Mill, Rails, Apartment),
  levels 1–9 (faster + more points per food), a bonus bug every 5 foods with a
  countdown value, and a flashing death animation into a GAME OVER screen.

  ## Usage

  ```ts
  import { createSnake, renderSnakeFrame, tickIntervalMs, MAZE_NAMES } from "@hellotimber/snake";

  const game = createSnake({ speed: 9, maze: 1, seed: 1234 });
  game.dispatch("up"); // queue a turn ("up" | "down" | "left" | "right")
  const alive = game.tick(); // advance one step; false once game over
  const frame = renderSnakeFrame(game.state); // { width: 84, height: 48, pixels: Uint8Array }
  setTimeout(step, tickIntervalMs(9)); // host owns the clock (105 ms at level 9)
  ```

  - `createSnake({ speed?, maze?, seed? })` — level 1–9 (default 1), maze 0–5
    (default 0, see `MAZE_NAMES`), PRNG seed (default 1). Same options + same
    inputs ⇒ identical games, byte for byte.
  - `game.state` — plain serializable object (snake cells, food, bonus, score,
    status…). Treat it as read-only.
  - `game.pause()` / `game.resume()` / `game.reset()` — interruptions and restart;
    any `dispatch` also starts an idle game or resumes a paused one.
  - `renderSnakeFrame(state)` — pure function; safe to call at any frame rate.

  ## Play it in a terminal

  Save as `play.mjs` next to a checkout (or with the package installed) and run
  `node play.mjs`. Arrow keys steer, `q` quits:

  ```js
  import { createSnake, renderSnakeFrame, tickIntervalMs } from "@hellotimber/snake";

  const game = createSnake({ speed: 7, maze: 1, seed: Date.now() >>> 0 });
  game.dispatch("right");

  process.stdin.setRawMode(true);
  process.stdin.resume();
  const keys = { "\u001b[A": "up", "\u001b[B": "down", "\u001b[C": "right", "\u001b[D": "left" };
  process.stdin.on("data", (b) => {
    const k = b.toString();
    if (k === "q" || k === "\u0003") process.exit(0);
    if (keys[k]) game.dispatch(keys[k]);
  });

  const timer = setInterval(() => {
    const alive = game.tick();
    const { width, height, pixels } = renderSnakeFrame(game.state);
    let out = "\u001b[H\u001b[2J";
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x++) {
        const top = pixels[y * width + x];
        const bottom = pixels[(y + 1) * width + x];
        out += top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " ";
      }
      out += "\n";
    }
    process.stdout.write(out);
    if (!alive) {
      clearInterval(timer);
      console.log("score:", game.state.score);
      process.stdin.pause();
    }
  }, tickIntervalMs(7));
  ```

  ## Testing

  ```sh
  vp test run   # from packages/snake/ (or `vp run -r test` from the repo root)
  ```

  Everything is deterministic: gameplay tests script exact seeds and assert exact
  cells, scores and pixels.
  ````

- [ ] Run the full verification from the repo root:
  - `mise exec -- vp run -r test` — all packages pass.
  - `mise exec -- vp check --fix` — passes clean.
- [ ] In `docs/plans/README.md`, change plan 04's Status from `not started` to
      `done`.
- [ ] Commit: `feat(snake): integration playthrough test and standalone README`

---

## Done means

- `mise exec -- vp run -r test` and `mise exec -- vp check --fix` pass from the root.
- `packages/snake` has no `dependencies` and imports nothing from other workspace
  packages (`grep -r "from \"@hellotimber" packages/snake/src` returns nothing).
- The public surface exactly covers the VISION contract plus the four deviations
  listed at the top — report those deviations to whoever assigned this plan.
