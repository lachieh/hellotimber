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
  DeactivationReason,
  KeyEvent,
  Phone,
  PhoneApplicationSession,
  ScreenModel,
} from "../src/index";
import { bootedPhone } from "./fixtures";

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);

interface Splash {
  application: PhoneApplication;
  keys: KeyEvent[];
  starts: number;
  deactivations: DeactivationReason[];
  context(): ApplicationContext;
}

/** An intro that ends itself after `durationMs` or on any key-up (the game splash shape). */
function makeSplash(durationMs = 2560): Splash {
  const record: Splash = {
    application: undefined as never,
    keys: [],
    starts: 0,
    deactivations: [],
    context: () => current!,
  };
  let current: ApplicationContext | undefined;
  class SplashApplication extends PhoneApplication {
    createSession(context: ApplicationContext): PhoneApplicationSession {
      record.starts += 1;
      current = context;
      let elapsed = 0;
      return {
        onKey(event) {
          record.keys.push(event);
          if (event.type === "up") context.exit();
        },
        tick(dtMs) {
          elapsed += dtMs;
          if (elapsed >= durationMs) context.exit();
        },
        render: (): ScreenModel => ({
          kind: "custom",
          appId: "splash",
          frame: { width: 84, height: 48, pixels: new Uint8Array(84 * 48) },
        }),
        onDeactivate(reason) {
          record.deactivations.push(reason);
        },
      };
    }
  }
  record.application = new SplashApplication("splash");
  return record;
}

/** Games (rows) > Snake II (rows, intro) > New game / Level / ... */
function gamesMenu(splash: Splash): PhoneMenu {
  const snake = new SubmenuEntry(
    slug("snake"),
    order(1),
    "Snake II",
    new MenuLevel(
      ["New game", "Level", "Mazes", "Top score"].map(
        (label, index) =>
          new ReaderEntry(slug(`game-${index + 1}`), order(index + 1), label, "Body"),
      ),
    ),
    undefined,
    { intro: splash.application },
  );
  return new PhoneMenu([
    new TopLevelEntry(
      new SubmenuEntry(
        slug("games"),
        order(1),
        "Games",
        new MenuLevel([snake, new ReaderEntry(slug("bantumi"), order(2), "Bantumi", "Body")]),
      ),
      new MenuGraphic("games"),
    ),
  ]);
}

function gamesPhone(splash = makeSplash()): Phone {
  const phone = bootedPhone({ menu: gamesMenu(splash) });
  phone.navigate("menu/games");
  return phone;
}

describe("SubmenuOptions.intro", () => {
  it("runs on Select-entry with the level's path, and its exit shows the list", () => {
    const splash = makeSplash();
    const phone = gamesPhone(splash);
    const paths: string[] = [];
    phone.on("pathchange", (path) => paths.push(path));

    phone.pressKey("navi");
    expect(phone.path).toBe("menu/games/snake");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "splash" });
    expect(splash.starts).toBe(1);

    phone.tick(1000 + 2560);
    expect(phone.path).toBe("menu/games/snake");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Snake II", selected: 0 });
    expect(splash.deactivations).toEqual(["exit"]);
    expect(paths).toEqual(["menu/games/snake"]);
  });

  it("gives C and every other key to the intro (any key skips the splash)", () => {
    for (const key of ["c", "down", "navi", "5"] as const) {
      const splash = makeSplash();
      const phone = gamesPhone(splash);
      phone.pressKey("navi");
      phone.pressKey(key);
      expect(splash.keys).toEqual([
        { type: "down", key },
        { type: "up", key },
      ]);
      expect(phone.screen).toMatchObject({ kind: "list", title: "Snake II", selected: 0 });
    }
  });

  it("is skipped by returns from a child and by navigate()", () => {
    const splash = makeSplash();
    const phone = gamesPhone(splash);
    phone.navigate("menu/games/snake");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Snake II" });
    phone.navigate("menu/games/snake/game-2");
    phone.pressKey("c");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Snake II", selected: 1 });
    expect(splash.starts).toBe(0);
  });

  it("is skipped by per-digit shortcuts (they land on the level like a path)", () => {
    const splash = makeSplash();
    const phone = bootedPhone({ menu: gamesMenu(splash) });
    phone.pressKey("navi");
    phone.pressKey("1");
    phone.pressKey("1");
    expect(phone.path).toBe("menu/games/snake");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Snake II" });
    expect(splash.starts).toBe(0);
  });

  it("runs again on every Select-entry", () => {
    const splash = makeSplash();
    const phone = gamesPhone(splash);
    phone.pressKey("navi");
    phone.pressKey("c");
    phone.pressKey("c");
    expect(phone.path).toBe("menu/games");
    phone.pressKey("navi");
    expect(splash.starts).toBe(2);
  });

  it("is deactivated once by power-off and by navigation", () => {
    const off = makeSplash();
    const phone = gamesPhone(off);
    phone.pressKey("navi");
    phone.pressKey("power", 1000);
    expect(phone.screen).toEqual({ kind: "off" });
    expect(off.deactivations).toEqual(["power-off"]);

    const away = makeSplash();
    const other = gamesPhone(away);
    other.pressKey("navi");
    other.navigate("menu/games/bantumi");
    other.tick(10_000);
    expect(away.deactivations).toEqual(["navigate"]);
    expect(other.path).toBe("menu/games/bantumi");
  });

  it("exit({ to: 'standby' }) from an intro leaves the menus", () => {
    const splash = makeSplash();
    const phone = gamesPhone(splash);
    phone.pressKey("navi");
    splash.context().exit({ to: "standby" });
    expect(phone.path).toBe("standby");
    expect(splash.deactivations).toEqual(["exit"]);
  });

  it("exit({ levels: 2 }) from an intro returns to the level's parent", () => {
    const splash = makeSplash();
    const phone = gamesPhone(splash);
    phone.pressKey("navi");
    splash.context().exit({ levels: 2 });
    expect(phone.path).toBe("menu/games");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Games", selected: 0 });
  });

  it("reveals the list at the opening child", () => {
    const splash = makeSplash();
    const snake: SubmenuEntry = new SubmenuEntry(
      slug("snake"),
      order(1),
      "Snake II",
      new MenuLevel([
        new ReaderEntry(slug("new-game"), order(1), "New game", "Body"),
        new ReaderEntry(slug("level"), order(2), "Level", "Body"),
      ]),
      undefined,
      { intro: splash.application, opening: () => snake.children.entries[1] },
    );
    const phone = bootedPhone({
      menu: new PhoneMenu([new TopLevelEntry(snake, new MenuGraphic("snake"))]),
    });
    phone.navigate("menu");
    phone.pressKey("navi");
    phone.pressKey("c");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 1 });
  });

  it("validates the intro definition", () => {
    const splash = makeSplash();
    const own = new ApplicationEntry(slug("own"), order(1), "Own", splash.application);
    expect(
      () =>
        new SubmenuEntry(slug("level"), order(1), "Level", new MenuLevel([own]), undefined, {
          intro: splash.application,
        }),
    ).toThrow(/intro/);
    expect(
      () =>
        new SubmenuEntry(slug("level"), order(1), "Level", new MenuLevel([]), undefined, {
          intro: {} as PhoneApplication,
        }),
    ).toThrow(/intro/);
  });
});
