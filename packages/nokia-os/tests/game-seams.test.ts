// The Games II seams (plan 24 Task 2): the games holder with one suspended state per game (D10),
// the table of game levels that lists Continue and routes Top score and Level, the game-over
// endings (D11) and Level pages with any number of bars (D14). Snake II runs on all of them.
import { describe, expect, it } from "vite-plus/test";
import {
  createStockGames,
  GAME_LEVELS,
  gameLevelTables,
  powerOffGames,
  powerOnGames,
  type GameLevel,
  type StockGames,
} from "../src/firmware/features/games";
import { stockServices } from "../src/firmware/menu";
import { createMemoryStorage, StockEeprom } from "../src/firmware/eeprom";
import { createMemorySettings, virginSettings, type StockSettings } from "../src/firmware/settings";
import { gameOver } from "../src/widgets/game-over";
import { levelPage } from "../src/widgets/level-bar";
import { snakeGame } from "../src/widgets/snake";
import type { Flow, Widget } from "../src/kit/ui/widgets/flow";
import { flowRig } from "./support/flow-rig.ts";

const holder = (seed = 44530): StockGames => ({ ...createStockGames(), seed: () => seed });

/** The services a feature binding sees, over `games` and virgin settings. */
const services = (games: StockGames, settings = createMemorySettings(virginSettings())) =>
  stockServices({}, settings, games, undefined, undefined, new StockEeprom(createMemoryStorage()));

/** Widgets render without a flow here (models only). */
const NO_FLOW = {} as Flow;

const FAKE_WIDGET: Widget = {
  render: () => ({ kind: "level-bar", bars: "level/snake-1", softkey: "OK" }),
};

/** A level for a game no plan has built yet: Continue opens FAKE_WIDGET. */
const FAKE: GameLevel = {
  number: "8-2",
  newGame: "8-2-1",
  game: "space-impact",
  continue: () => () => FAKE_WIDGET,
  topScore: { number: "8-2-2", row: "top" },
};

describe("the games holder (D10)", () => {
  it("starts with no suspended game and seeds New game from the clock's minutes", () => {
    const games = createStockGames({ clock: () => "10:10", date: () => "13.10.2026" });
    expect(games.suspended).toEqual({});
    expect(games.seed()).toBe(610);
    expect(createStockGames().seed()).toBe(0);
  });

  it("power-off loses every suspended game", () => {
    const games = holder();
    games.suspended.snake = { any: 1 };
    games.suspended["space-impact"] = { any: 2 };
    powerOffGames(games);
    expect(games.suspended).toEqual({});
  });
});

describe("the phone-wide ANSI lifetime (D6)", () => {
  it("keeps the chain across suspension and power-off, resets it only at power-on", () => {
    const games = holder();
    games.ansi.next();
    games.suspended.snake = { board: "snake" };
    games.suspended["space-impact"] = { board: "space" };
    expect(games.ansi.state).toBe(0x3e39e1cc);
    powerOffGames(games);
    expect(games.suspended).toEqual({});
    expect(games.ansi.state).toBe(0x3e39e1cc);
    powerOnGames(games);
    expect(games.ansi.state).toBe(0x7fffffff);
    expect(games.ansi.next()).toBe(15929);
    expect(holder().ansi.state).toBe(0x7fffffff);
  });
});

describe("GAME_LEVELS and their tables (D10)", () => {
  it("lists Snake II and Space impact, with each game's score and Level pages", () => {
    expect(GAME_LEVELS.map(({ number, newGame, game }) => ({ number, newGame, game }))).toEqual([
      { number: "8-1", newGame: "8-1-1", game: "snake" },
      { number: "8-2", newGame: "8-2-1", game: "space-impact" },
    ]);
    const snake = GAME_LEVELS[0]!;
    expect(snake.topScore).toEqual({ number: "8-1-4" });
    expect(snake.level).toBe("8-1-2");
    expect(GAME_LEVELS[1]!.topScore).toEqual({ number: "8-2-2", row: "top" });
    expect(GAME_LEVELS[1]!.level).toBeUndefined();
  });

  it("lists each level's Continue only while its own game is suspended", () => {
    const { leads } = gameLevelTables([GAME_LEVELS[0]!, FAKE]);
    const games = holder();
    const s = services(games);
    expect([leads["8-1"]!.shown(s), leads["8-2"]!.shown(s)]).toEqual([false, false]);
    games.suspended["space-impact"] = {};
    expect([leads["8-1"]!.shown(s), leads["8-2"]!.shown(s)]).toEqual([false, true]);
    games.suspended.snake = {};
    expect([leads["8-1"]!.shown(s), leads["8-2"]!.shown(s)]).toEqual([true, true]);
    expect(leads["8-2"]).toMatchObject({ slug: "continue", label: "Continue" });
    expect(leads["8-2"]!.open(s)()).toBe(FAKE_WIDGET);
  });

  it("returns Top score to Continue while the level's game is suspended, else New game", () => {
    const { noteEnds } = gameLevelTables([GAME_LEVELS[0]!, FAKE]);
    const games = holder();
    const s = services(games);
    const end = (number: string) => {
      const binding = noteEnds[number]!;
      return typeof binding === "function" ? binding(s) : binding;
    };
    expect([end("8-1-4"), end("8-2-2")]).toEqual([
      { select: "new-game" },
      { select: "new-game", row: "top" },
    ]);
    games.suspended.snake = {};
    expect([end("8-1-4"), end("8-2-2")]).toEqual([
      { select: "continue" },
      { select: "new-game", row: "top" },
    ]);
  });

  it("OK on a Level page discards only that level's game and moves to the next entry", () => {
    const { levelStores } = gameLevelTables([GAME_LEVELS[0]!, FAKE]);
    const games = holder();
    const s = services(games);
    expect(levelStores["8-1-2"]!(s)).toBeUndefined();
    games.suspended.snake = {};
    games.suspended["space-impact"] = {};
    expect(levelStores["8-1-2"]!(s)).toBe("mazes");
    expect(games.suspended).toEqual({ "space-impact": {} });
  });

  it("rejects two levels for one game or one node", () => {
    expect(() => gameLevelTables([FAKE, { ...FAKE, number: "8-3", newGame: "8-3-1" }])).toThrow();
    expect(() => gameLevelTables([FAKE, { ...FAKE, game: "bantumi" }])).toThrow();
  });
});

describe("Snake II on the per-game holder (D10)", () => {
  /** A Snake II session over `games`: New game, a few ticks, then Navi. */
  function suspendSnake(games: StockGames, settings: StockSettings) {
    const rig = flowRig(() => snakeGame({ games, settings, start: "new" }));
    rig.advance(1500);
    const board = rig.frame();
    rig.press("navi");
    expect(rig.exits.map((e) => e.options)).toEqual([{ select: "continue", row: "top" }]);
    expect(games.ansi.state).toBe(0x7fffffff);
    return board;
  }

  it("suspending Snake II keeps a suspended Space impact, and Continue resumes Snake's board", () => {
    const settings = createMemorySettings(virginSettings());
    const games = holder();
    const spaceImpact = { board: "space impact" };
    games.suspended["space-impact"] = spaceImpact;
    const board = suspendSnake(games, settings);
    expect(games.suspended["space-impact"]).toBe(spaceImpact);
    expect(games.suspended.snake).toBeDefined();
    const resumed = flowRig(() => snakeGame({ games, settings, start: "continue" }));
    expect(resumed.frame()).toEqual(board);
    expect(games.suspended).toEqual({ "space-impact": spaceImpact });
  });

  it("a Space impact suspended after Snake II leaves Snake's Continue and board alone", () => {
    const settings = createMemorySettings(virginSettings());
    const games = holder();
    const board = suspendSnake(games, settings);
    const snake = games.suspended.snake;
    games.suspended["space-impact"] = { board: "space impact" };
    expect(games.suspended.snake).toBe(snake);
    const { leads } = gameLevelTables(GAME_LEVELS);
    expect(leads["8-1"]!.shown(services(games, settings))).toBe(true);
    const resumed = flowRig(() => snakeGame({ games, settings, start: "continue" }));
    expect(resumed.frame()).toEqual(board);
  });

  it("New game discards only Snake II's suspended game", () => {
    const settings = createMemorySettings(virginSettings());
    const games = holder();
    suspendSnake(games, settings);
    games.suspended["space-impact"] = {};
    flowRig(() => snakeGame({ games, settings, start: "new" }));
    expect(games.suspended).toEqual({ "space-impact": {} });
  });
});

describe("gameOver(ending) (D11)", () => {
  it("score and top-score end on the game menu's New game, top row", () => {
    for (const ending of [
      { kind: "score", score: "4" },
      { kind: "top-score", score: "70" },
    ] as const) {
      const rig = flowRig(() => gameOver({ ending, select: "new-game" }));
      rig.advance(10000);
      expect(rig.exits.map((e) => e.options)).toEqual([{ select: "new-game", row: "top" }]);
    }
  });

  it("score shows `Your score:`, top-score `TOP SCORE:`, both with the score", () => {
    const label = (kind: "score" | "top-score") => {
      const widget = gameOver({ ending: { kind, score: "12" }, select: "x" });
      return widget.render(NO_FLOW);
    };
    expect(label("score")).toMatchObject({ label: "Your score:", score: "12" });
    expect(label("top-score")).toMatchObject({ label: "TOP SCORE:", score: "12" });
  });

  it("won, draw and lost wait for plan 24b's resources", () => {
    for (const kind of ["won", "draw", "lost"] as const) {
      expect(() => gameOver({ ending: { kind }, select: "new-game" })).toThrow(
        "resource missing (plan 24b)",
      );
    }
  });
});

describe("levelPage (D14)", () => {
  // Synthetic bars over a numeric setting that exists (Snake II's level, virgin 175).
  const KEY = "games/snake/level";
  function page(level: number, max: number, onStore?: () => string | undefined) {
    const settings = createMemorySettings(virginSettings());
    settings.setNumber(KEY, level);
    const widget = levelPage({
      settings,
      key: KEY,
      max,
      bars: "level/snake",
      softkey: "OK",
      ...(onStore === undefined ? {} : { onStore }),
    });
    return { rig: flowRig(() => widget), settings, widget };
  }

  it("a 5-bar page draws min(level, 5) bars", () => {
    expect(page(4, 5).widget.render(NO_FLOW)).toEqual({
      kind: "level-bar",
      bars: "level/snake-4",
      softkey: "OK",
    });
    expect(page(175, 5).widget.render(NO_FLOW)).toMatchObject({ bars: "level/snake-5" });
  });

  it("a 5-bar page clamps ▼ at 1 and ▲ at 5", () => {
    const low = page(3, 5);
    for (let i = 0; i < 4; i++) low.rig.press("down");
    low.rig.press("navi");
    expect(low.settings.number(KEY)).toBe(1);
    const high = page(3, 5);
    for (let i = 0; i < 9; i++) high.rig.press("up");
    high.rig.press("navi");
    expect(high.settings.number(KEY)).toBe(5);
  });

  it("C discards the change; OK stores, runs onStore and selects what it returns", () => {
    const c = page(3, 5);
    c.rig.press("down");
    c.rig.press("c");
    expect(c.settings.number(KEY)).toBe(3);
    const ok = page(3, 7, () => "next");
    ok.rig.press("up");
    ok.rig.press("navi");
    expect(ok.settings.number(KEY)).toBe(4);
    expect(ok.rig.exits.map((e) => e.options)).toEqual([{ select: "next" }]);
  });
});
