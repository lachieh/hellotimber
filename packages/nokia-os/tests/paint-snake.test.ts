// The Snake II painter (plan 23 Task 8): the engine's render model, painted, equals the goldens
// pixel for pixel. The engine is driven by each golden's recovered seed and `input`
// (tests/support/game.ts), so these tests check the painter, not the rules (Tasks 6-7 did).
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { isBoardFrame } from "../scripts/game-capture-set.ts";
import { findGoldenImage } from "../scripts/golden-format.ts";
import { paintWidget } from "../src/display/widgets";
import { blinkSnake, newSnakeGame, snakeRender, stepSnake } from "../src/games/snake/engine";
import type { SnakeState } from "../src/games/snake/model";
import { lcdMismatch } from "./support/golden.ts";
import { replayBoards, snakeReplay, SNAKE_TRACES, type SnakeTrace } from "./support/game.ts";
import { loadGolden } from "./support/goldens.ts";

function paint(state: SnakeState): Uint8Array {
  const fb = new Framebuffer();
  paintWidget(fb, { kind: "snake", board: snakeRender(state) });
  return fb.pixels;
}

function expectPainted(state: SnakeState, id: string, pixels: Uint8Array, where: string): void {
  const message = lcdMismatch(paint(state), { id, image: { name: where, pixels } }, where);
  if (message !== undefined) throw new Error(message);
}

const trace = (id: string): SnakeTrace => SNAKE_TRACES.find((t) => t.id === id)!;

describe("the board, as the engine renders it", () => {
  for (const t of SNAKE_TRACES) {
    it(`paints every board of ${t.id}`, () => {
      const boards = replayBoards(t);
      expect(boards.length).toBeGreaterThan(0);
      for (const { state, pixels, where } of boards) {
        expectPainted(state, `game/snake/${t.id}`, pixels, where);
      }
    });
  }

  it("covers the HUD's creature icon and countdown, small and large (bot-long's boards)", () => {
    const boards = replayBoards(trace("bot-long"));
    const out = boards.filter((b) => snakeRender(b.state).countdown !== undefined);
    expect(out.length).toBeGreaterThan(10);
    expect(new Set(out.map((b) => snakeRender(b.state).creature!.kind))).toContain("large");
  });

  it("covers the virgin level's score: 0175 after one meal (virgin-meal's boards)", () => {
    const boards = replayBoards(trace("virgin-meal"));
    expect(boards.some((b) => snakeRender(b.state).score === 175)).toBe(true);
  });

  it("paints every board image of the level timelines (ticks-l1..9) but one partial redraw", () => {
    const unpainted: string[] = [];
    for (let level = 1; level <= 9; level++) {
      const id = `ticks-l${level}`;
      const painted = replayBoards(trace(id)).map((b) => b.pixels);
      for (const image of loadGolden(`game/snake/${id}`).images) {
        if (!isBoardFrame(image.pixels)) continue;
        if (!painted.some((p) => p.every((v, i) => v === image.pixels[i]))) {
          unpainted.push(`${id} ${image.name}`);
        }
      }
    }
    // Task 0: some tick redraws come in two bursts; the first is a partial frame, which the
    // engine (whole ticks) does not draw. Level 6's timeline has one.
    expect(unpainted).toEqual(["ticks-l6 c"]);
  });
});

/** The death timelines: the board frames from the crash's shown snake to the game-over screen. */
function blinkFrames(id: string): Uint8Array[] {
  const golden = loadGolden(id);
  const frames = golden.timeline!.map((row) => findGoldenImage(golden, row.image).pixels);
  const over = frames.findIndex(
    (f, i) => i > 0 && !isBoardFrame(f) && isBoardFrame(frames[i - 1]!),
  );
  return frames.slice(0, over).filter(isBoardFrame);
}

/** Steps a replay until the snake dies; the state shows the last board before the blink. */
function dead(state: SnakeState): SnakeState {
  for (let i = 0; i < 2000 && state.crash !== "dead"; i++) state = stepSnake(state).state;
  expect(state.crash).toBe("dead");
  return state;
}

describe("the death blink (H11)", () => {
  const DEATHS: readonly { id: string; game: () => SnakeState }[] = [
    ...[1, 3, 4].map((maze) => ({
      id: `game/snake/maze-${maze}`,
      game: () => newSnakeGame({ level: 1, maze, seed: 44530 }),
    })),
    ...["bot-short", "bot-maze2", "bot-maze3", "bot-grace", "score-8"].map((game) => ({
      id: `game/snake/${game}.death`,
      game: () => {
        const replay = snakeReplay(trace(game));
        const input = loadGolden(`game/snake/${game}`).input ?? [];
        replay.stepTo((input.at(-1)?.tick ?? 0) + 1);
        return replay.state;
      },
    })),
  ];

  for (const { id, game } of DEATHS) {
    it(`paints the snake hidden and shown in turn (${id})`, () => {
      const frames = blinkFrames(id);
      let state = dead(game());
      // The last frame before the blink shows the snake where it died.
      const fromCrash = frames.slice(frames.length - 10);
      expect(fromCrash).toHaveLength(10);
      fromCrash.forEach((pixels, i) => {
        expectPainted(state, id, pixels, `${id} blink frame ${i}`);
        state = blinkSnake(state);
      });
    });
  }

  it("does not blink a snake whose ring wrapped (bot-long.death)", () => {
    const replay = snakeReplay(trace("bot-long"));
    const input = loadGolden("game/snake/bot-long").input ?? [];
    replay.stepTo((input.at(-1)?.tick ?? 0) + 1);
    const state = dead(replay.state);
    const [board] = blinkFrames("game/snake/bot-long.death");
    expectPainted(state, "game/snake/bot-long.death", board!, "bot-long.death frame 0");
    expectPainted(blinkSnake(state), "game/snake/bot-long.death", board!, "after a blink step");
  });
});
