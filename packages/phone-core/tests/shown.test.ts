import { describe, expect, it } from "vite-plus/test";
import {
  ApplicationEntry,
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneApplication,
  PhoneMenu,
  ReaderEntry,
  SubmenuEntry,
  TopLevelEntry,
} from "../src/index";
import type {
  ApplicationContext,
  ExitOptions,
  MenuEntry,
  Phone,
  PhoneApplicationSession,
  PhoneConfig,
  ScreenModel,
  SubmenuOptions,
} from "../src/index";
import { bootedPhone } from "./fixtures";

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);

/**
 * A game: a key-up of `5` sets `suspended` and exits to the level (plan 23 D10: Navi suspends a
 * game and the game menu then shows Continue first); C exits plainly.
 */
class GameApplication extends PhoneApplication {
  context: ApplicationContext | undefined;

  constructor(
    id: string,
    private readonly state: { suspended: boolean },
    private readonly exitOptions: ExitOptions = { select: "continue", row: "top" },
  ) {
    super(id);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    this.context = context;
    return {
      onKey: (event) => {
        if (event.type !== "up") return;
        if (event.key === "5") {
          this.state.suspended = true;
          context.exit(this.exitOptions);
        } else if (event.key === "c") context.exit();
      },
      tick() {},
      render: (): ScreenModel => ({ kind: "confirm", text: this.id, softkey: "" }),
    };
  }
}

const LABELS = ["Level", "Mazes", "Top score", "Score IDs", "Instructions"];

interface Rig {
  phone: Phone;
  state: { suspended: boolean };
  level: SubmenuEntry;
  game: GameApplication;
  /** Ticks the phone `ms` further. */
  tick: (ms?: number) => void;
}

/**
 * Snake II's game menu as plan 23 D10 builds it: Continue (order 1) shown only while a game is
 * suspended, New game (2), then five more entries; Continue opens the level while shown.
 */
function gameMenu(
  state: { suspended: boolean },
  game: PhoneApplication,
  options: Partial<SubmenuOptions> = {},
): { menu: PhoneMenu; level: SubmenuEntry } {
  const cont = new ApplicationEntry(slug("continue"), order(1), "Continue", game);
  const children: MenuEntry[] = [
    cont,
    new ApplicationEntry(slug("new-game"), order(2), "New game", game),
    ...LABELS.map(
      (label, index) =>
        new ReaderEntry(slug(label.toLowerCase().replace(/ /g, "-")), order(index + 3), label, "B"),
    ),
  ];
  const level = new SubmenuEntry(
    slug("snake"),
    order(1),
    "Snake II",
    new MenuLevel(children),
    undefined,
    {
      shown: (child) => child !== cont || state.suspended,
      opening: () => (state.suspended ? cont : undefined),
      ...options,
    },
  );
  const games = new SubmenuEntry(
    slug("games"),
    order(1),
    "Games",
    new MenuLevel([level, new ReaderEntry(slug("space-impact"), order(2), "Space impact", "Body")]),
  );
  const menu = new PhoneMenu([
    new TopLevelEntry(games, new MenuGraphic("games")),
    new TopLevelEntry(
      new ReaderEntry(slug("other"), order(2), "Other", "Body"),
      new MenuGraphic("other"),
    ),
  ]);
  return { menu, level };
}

function rig(config: Partial<PhoneConfig> = {}, options: Partial<SubmenuOptions> = {}): Rig {
  const state = { suspended: false };
  const game = new GameApplication("game", state);
  const { menu, level } = gameMenu(state, game, options);
  const phone = bootedPhone({ menu, ...config });
  let now = 5000;
  phone.tick(now);
  return {
    phone,
    state,
    level,
    game,
    tick: (ms = 10) => {
      now += ms;
      phone.tick(now);
    },
  };
}

function list(phone: Phone): Extract<ScreenModel, { kind: "list" }> {
  const screen = phone.screen;
  if (screen.kind !== "list") throw new Error(`Expected a list, received ${screen.kind}.`);
  return screen;
}

const ALL = ["Continue", "New game", ...LABELS];
const HIDDEN = ["New game", ...LABELS];

describe("SubmenuOptions.shown", () => {
  it("lists only shown children, numbered by position, without itemOrders", () => {
    const { phone } = rig();
    phone.navigate("menu/games/snake");
    expect(list(phone)).toEqual({
      kind: "list",
      title: "Snake II",
      items: HIDDEN,
      selected: 0,
      softkey: "Select",
      menuIndicator: { segments: [1, 1], awaitingNext: false },
    });
    phone.pressKey("navi");
    expect(phone.path).toBe("menu/games/snake/new-game");
    // New game is the level's first shown child: 1-1-1, not its order 2.
    expect(phone.screen).toMatchObject({ kind: "confirm", text: "game" });
  });

  it("numbers a running application by its position", () => {
    const r = rig();
    r.phone.navigate("menu/games/snake/new-game");
    expect(r.game.context!.menuIndicator!()).toEqual({ segments: [1, 1, 1], awaitingNext: false });
    r.state.suspended = true;
    r.phone.navigate("menu/games/snake/new-game");
    expect(r.game.context!.menuIndicator!()).toEqual({ segments: [1, 1, 2], awaitingNext: false });
  });

  it("skips hidden children with ▲/▼, the wrap included", () => {
    const { phone } = rig();
    phone.navigate("menu/games/snake");
    phone.pressKey("up");
    expect(list(phone).selected).toBe(5);
    expect(list(phone).items[5]).toBe("Instructions");
    phone.pressKey("down");
    expect(list(phone).selected).toBe(0);
    expect(list(phone).items[0]).toBe("New game");
  });

  it("counts only shown children in the rows window", () => {
    const { phone } = rig({ rowsWindow: 3 });
    phone.navigate("menu/games/snake");
    expect(list(phone)).toMatchObject({ selected: 0, windowTop: 0 });
    phone.pressKey("up");
    // Instructions on the top row of a six-item list: ▲ from the first wraps.
    expect(list(phone)).toMatchObject({ selected: 5, windowTop: 5 });
    phone.pressKey("down");
    expect(list(phone)).toMatchObject({ selected: 0, windowTop: 5 });
  });

  it("falls back to the level for a path that lands on a hidden child", () => {
    const { phone } = rig();
    phone.navigate("menu/games/snake/continue");
    expect(phone.path).toBe("menu/games/snake");
    expect(list(phone)).toMatchObject({ items: HIDDEN, selected: 0 });
  });

  it("falls back to the first shown child when opening() returns a hidden one", () => {
    const state = { suspended: false };
    const game = new GameApplication("game", state);
    const { menu, level } = gameMenu(state, game, {
      opening: () => level.children.entries[0],
    });
    const phone = bootedPhone({ menu });
    phone.navigate("menu/games/snake");
    expect(list(phone)).toMatchObject({ items: HIDDEN, selected: 0 });
  });

  it("re-reads shown on every tick: a child that appears emits one snapshot", () => {
    const r = rig();
    r.phone.navigate("menu/games/snake");
    r.phone.pressKey("down");
    const items: string[][] = [];
    r.phone.subscribe((snap) => {
      if (snap.screen.kind === "list") items.push(snap.screen.items);
    });
    r.tick();
    expect(items).toEqual([]);
    r.state.suspended = true;
    r.tick();
    r.tick();
    expect(items).toEqual([ALL]);
    // The selection stays on Level, now third.
    expect(list(r.phone)).toMatchObject({
      selected: 2,
      menuIndicator: { segments: [1, 1], awaitingNext: false },
    });
  });

  it("moves the selection to the first shown child when the selected child is hidden", () => {
    const r = rig({ rowsWindow: 3 });
    r.state.suspended = true;
    r.phone.navigate("menu/games/snake");
    expect(list(r.phone)).toMatchObject({ items: ALL, selected: 0, windowTop: 0 });
    r.state.suspended = false;
    r.tick();
    expect(list(r.phone)).toMatchObject({ items: HIDDEN, selected: 0, windowTop: 0 });
  });

  it("throws, naming the level, when no child is shown", () => {
    const { phone } = rig({}, { shown: () => false });
    expect(() => phone.navigate("menu/games/snake")).toThrow(/snake/);
  });

  it("rejects a shown reader that is not a function", () => {
    const state = { suspended: false };
    expect(() =>
      gameMenu(state, new GameApplication("game", state), { shown: true as never }),
    ).toThrow(/shown/);
  });
});

describe("SubmenuOptions.shown with shortcuts", () => {
  it("matches per-digit shortcuts by position", () => {
    const r = rig();
    r.phone.navigate("standby");
    r.phone.pressKey("navi");
    for (const digit of ["1", "1", "1"] as const) r.phone.pressKey(digit);
    expect(r.phone.path).toBe("menu/games/snake/new-game");

    r.state.suspended = true;
    r.phone.navigate("standby");
    r.phone.pressKey("navi");
    for (const digit of ["1", "1", "2"] as const) r.phone.pressKey(digit);
    expect(r.phone.path).toBe("menu/games/snake/new-game");
  });

  it("matches stock shortcut numbers by position", () => {
    const invalid = new GameApplication("invalid", { suspended: false });
    const r = rig({
      rowsWindow: 3,
      shortcutWindowMs: 3000,
      shortcutEntry: { openDelayMs: 1000, invalid },
    });
    r.phone.navigate("standby");
    r.phone.pressKey("navi");
    for (const digit of ["1", "1", "7"] as const) r.phone.pressKey(digit);
    // Seven numbers do not exist while Continue is hidden.
    expect(r.phone.screen).toMatchObject({ kind: "confirm", text: "invalid" });

    r.phone.navigate("standby");
    r.phone.pressKey("navi");
    for (const digit of ["1", "1", "6"] as const) r.phone.pressKey(digit);
    // The painter appends the selection's position: 1-1-6.
    expect(list(r.phone)).toMatchObject({ items: HIDDEN, selected: 5, opening: true });
    r.tick(1000);
    expect(r.phone.path).toBe("menu/games/snake/instructions");

    r.state.suspended = true;
    r.phone.navigate("standby");
    r.phone.pressKey("navi");
    for (const digit of ["1", "1", "1"] as const) r.phone.pressKey(digit);
    expect(list(r.phone)).toMatchObject({ items: ALL, selected: 0 });
    r.tick(1000);
    expect(r.phone.path).toBe("menu/games/snake/continue");
  });
});

describe("exit({ select }) into a level whose shown children changed", () => {
  it("selects a child that was hidden when the application started (Continue after Navi)", () => {
    const r = rig({ rowsWindow: 3 });
    r.phone.navigate("menu/games/snake");
    r.phone.pressKey("down");
    r.phone.pressKey("up");
    r.phone.pressKey("navi");
    expect(r.phone.path).toBe("menu/games/snake/new-game");
    r.phone.pressKey("5");
    expect(r.phone.path).toBe("menu/games/snake");
    expect(list(r.phone)).toEqual({
      kind: "list",
      title: "Snake II",
      items: ALL,
      selected: 0,
      softkey: "Select",
      menuIndicator: { segments: [1, 1], awaitingNext: false },
      windowTop: 0,
    });
    r.phone.pressKey("down");
    expect(list(r.phone)).toMatchObject({ selected: 1, windowTop: 0 });
  });

  it("places the child on the bottom row by default", () => {
    const state = { suspended: false };
    const game = new GameApplication("game", state, { select: "continue" });
    const { menu } = gameMenu(state, game);
    const phone = bootedPhone({ menu, rowsWindow: 3 });
    phone.navigate("menu/games/snake/new-game");
    phone.pressKey("5");
    // Score IDs / Instructions / Continue.
    expect(list(phone)).toMatchObject({ items: ALL, selected: 0, windowTop: 5 });
  });

  it("throws for a select that names a hidden child", () => {
    const state = { suspended: false };
    const errors: unknown[] = [];
    class Leaving extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        return {
          onKey(event) {
            if (event.type !== "up") return;
            try {
              context.exit({ select: "continue" });
            } catch (error) {
              errors.push(error);
            }
          },
          tick() {},
          render: (): ScreenModel => ({ kind: "confirm", text: "x", softkey: "" }),
        };
      }
    }
    const { menu } = gameMenu(state, new Leaving("leaving"));
    const phone = bootedPhone({ menu });
    phone.navigate("menu/games/snake/new-game");
    phone.pressKey("5");
    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toMatch(/continue/);
  });
});
