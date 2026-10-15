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
  MenuEntry,
  MenuIndicator,
  Phone,
  PhoneApplicationSession,
  PhoneConfig,
  ScreenModel,
} from "../src/index";
import { bootedPhone } from "./fixtures";

/** Plan 14 D14 timings, measured from the P5 probes (host config, not kernel constants). */
const OPEN_DELAY_MS = 1460;
const WINDOW_MS = 2948;
const SPLASH_MS = 2560;

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);

/** Records sessions; exits after `endMs` of ticks or on any key-up (a note / splash shape). */
class RecordingApplication extends PhoneApplication {
  readonly keys: KeyEvent[] = [];
  readonly deactivations: DeactivationReason[] = [];
  starts = 0;
  context: ApplicationContext | undefined;

  constructor(
    id: string,
    private readonly endMs: number,
  ) {
    super(id);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    this.starts += 1;
    this.context = context;
    let elapsed = 0;
    return {
      onKey: (event) => {
        this.keys.push(event);
        if (event.type === "up") context.exit();
      },
      tick: (dtMs) => {
        elapsed += dtMs;
        if (elapsed >= this.endMs) context.exit();
      },
      render: (): ScreenModel => ({ kind: "confirm", text: this.id, softkey: "" }),
      onDeactivate: (reason) => this.deactivations.push(reason),
    };
  }
}

function readers(labels: readonly string[], prefix: string): MenuEntry[] {
  return labels.map(
    (label, index) =>
      new ReaderEntry(slug(`${prefix}-${index + 1}`), order(index + 1), label, "Body"),
  );
}

interface Rig {
  phone: Phone;
  invalid: RecordingApplication;
  splash: RecordingApplication;
  speedDials: RecordingApplication;
  shakes: RecordingApplication;
  /** Ticks to the Menu press time + `ms`. */
  at: (ms: number) => void;
}

/** The stock top-level shape: 12 slots, Phone book (10), Games (1-4, 6), Clock, Profiles. */
function stockShapedMenu(
  rig: Omit<Rig, "phone" | "at" | "splash">,
  splash: PhoneApplication,
): PhoneMenu {
  const phoneBook = new SubmenuEntry(
    slug("phone-book"),
    order(1),
    "Phone book",
    new MenuLevel([
      ...readers(
        [
          "Search",
          "Service Nos.",
          "Add name",
          "Erase",
          "Edit",
          "Assign tone",
          "Send b'card",
          "Options",
        ],
        "book",
      ),
      new ApplicationEntry(slug("speed-dials"), order(9), "Speed dials", rig.speedDials),
      new ReaderEntry(slug("voice-tags"), order(10), "Voice tags", "Body"),
    ]),
  );
  const snake = new SubmenuEntry(
    slug("snake"),
    order(1),
    "Snake II",
    new MenuLevel(
      readers(["New game", "Level", "Mazes", "Top score", "Score IDs", "Instructions"], "snake"),
    ),
    undefined,
    { intro: splash },
  );
  const settings = new SubmenuEntry(
    slug("settings"),
    order(6),
    "Settings",
    new MenuLevel([
      new ReaderEntry(slug("sounds"), order(1), "Sounds", "Body"),
      new ReaderEntry(slug("lights"), order(2), "Lights", "Body"),
      new ApplicationEntry(slug("shakes"), order(3), "Shakes", rig.shakes),
    ]),
    undefined,
    { presentation: "pages" },
  );
  const games = new SubmenuEntry(
    slug("games"),
    order(8),
    "Games",
    new MenuLevel([
      snake,
      new ReaderEntry(slug("space-impact"), order(2), "Space impact", "Body"),
      new ReaderEntry(slug("bantumi"), order(3), "Bantumi", "Body"),
      new ReaderEntry(slug("pairs"), order(4), "Pairs II", "Body"),
      settings,
    ]),
  );
  const clock = new SubmenuEntry(
    slug("clock"),
    order(11),
    "Clock",
    new MenuLevel(
      readers(
        [
          "Alarm clock",
          "Clock settings",
          "Date setting",
          "Stopwatch",
          "Countdown timer",
          "Auto update",
        ],
        "clock",
      ),
    ),
    undefined,
    { presentation: "pages" },
  );
  const profiles = new SubmenuEntry(
    slug("profiles"),
    order(12),
    "Profiles",
    new MenuLevel(
      readers(["General", "Silent", "Discreet", "Loud", "My style", "(empty)"], "profile"),
    ),
  );
  const tops: MenuEntry[] = [phoneBook, games, clock, profiles];
  for (const number of [2, 3, 4, 5, 6, 7, 9, 10]) {
    tops.push(new ReaderEntry(slug(`top-${number}`), order(number), `Top ${number}`, "Body"));
  }
  tops.sort((left, right) => left.order.value - right.order.value);
  return new PhoneMenu(
    tops.map((entry) => new TopLevelEntry(entry, new MenuGraphic(entry.slug.value))),
  );
}

function stockRig(overrides: Partial<PhoneConfig> = {}, intro?: PhoneApplication): Rig {
  const apps = {
    invalid: new RecordingApplication("invalid-shortcut", 2900),
    splash: new RecordingApplication("splash", SPLASH_MS),
    speedDials: new RecordingApplication("speed-dials", Infinity),
    shakes: new RecordingApplication("shakes", Infinity),
  };
  const phone = bootedPhone({
    menu: stockShapedMenu(apps, intro ?? apps.splash),
    rowsWindow: 3,
    shortcutWindowMs: WINDOW_MS,
    shortcutEntry: { openDelayMs: OPEN_DELAY_MS, invalid: apps.invalid },
    ...overrides,
  });
  const start = 2000;
  phone.tick(start);
  phone.pressKey("navi");
  return { phone, ...apps, at: (ms) => phone.tick(start + ms) };
}

type ListOrCarousel = Extract<ScreenModel, { kind: "list" | "menu-carousel" }>;

function menuScreen(phone: Phone): ListOrCarousel {
  const screen = phone.screen;
  if (screen.kind !== "list" && screen.kind !== "menu-carousel") {
    throw new Error(`Expected a menu screen, received ${screen.kind}.`);
  }
  return screen;
}

function indicator(phone: Phone): MenuIndicator {
  const screen = menuScreen(phone);
  if (screen.menuIndicator === undefined) throw new Error("Expected a menu indicator.");
  return screen.menuIndicator;
}

describe("stock shortcut entry (PhoneConfig.shortcutEntry, plan 14 D14)", () => {
  it("Menu 1 waits for a second digit, resolves to 1 at the window end, then opens (P5 m1)", () => {
    const { phone, at } = stockRig();
    at(600);
    phone.pressKey("1");
    // `1` and the dots; the soft key is still shown.
    expect(phone.path).toBe("menu");
    expect(menuScreen(phone)).toMatchObject({ kind: "menu-carousel", menuNumber: 1 });
    expect("opening" in menuScreen(phone)).toBe(false);
    expect(indicator(phone)).toEqual({ segments: [], awaitingNext: true, typed: "1" });

    at(600 + WINDOW_MS - 1);
    expect("opening" in menuScreen(phone)).toBe(false);
    at(600 + WINDOW_MS);
    // Resolved: the soft key goes; the indicator keeps the typed digit.
    expect(menuScreen(phone)).toMatchObject({ kind: "menu-carousel", opening: true });
    expect(indicator(phone)).toEqual({ segments: [], awaitingNext: true, typed: "1" });
    expect(phone.path).toBe("menu");

    at(600 + WINDOW_MS + OPEN_DELAY_MS);
    expect(phone.path).toBe("menu/phone-book");
    expect(menuScreen(phone)).toMatchObject({ kind: "list", title: "Phone book", selected: 0 });
    expect("opening" in menuScreen(phone)).toBe(false);
    expect(indicator(phone)).toEqual({ segments: [1], awaitingNext: true, typed: "" });

    // The window restarted at the resolve; when it ends the index is shown (`1-1`).
    at(600 + 2 * WINDOW_MS);
    expect(indicator(phone)).toEqual({ segments: [1], awaitingNext: false });
  });

  it("Menu 1 2 shows `12` without the soft key, opens Profiles, then `12-` and dots (P5 m1-2)", () => {
    const { phone, at } = stockRig();
    at(600);
    phone.pressKey("1");
    at(1200);
    phone.pressKey("2");
    expect(phone.path).toBe("menu");
    expect(menuScreen(phone)).toMatchObject({
      kind: "menu-carousel",
      menuNumber: 12,
      opening: true,
    });
    expect(indicator(phone)).toEqual({ segments: [12], awaitingNext: false });

    at(1200 + OPEN_DELAY_MS - 1);
    expect(phone.path).toBe("menu");
    at(1200 + OPEN_DELAY_MS);
    expect(phone.path).toBe("menu/profiles");
    expect(menuScreen(phone)).toMatchObject({ kind: "list", selected: 0, windowTop: 0 });
    expect(indicator(phone)).toEqual({ segments: [12], awaitingNext: true, typed: "" });

    at(1200 + WINDOW_MS);
    expect(indicator(phone)).toEqual({ segments: [12], awaitingNext: false });
    expect(phone.screen).toMatchObject({ softkey: "Select" });
  });

  it.each(["8", "9"] as const)(
    "Menu 1 %s matches no number: Invalid shortcut at once, then standby (P5 m1-8, m1-9-c)",
    (digit) => {
      const { phone, invalid, at } = stockRig();
      at(600);
      phone.pressKey("1");
      at(1200);
      phone.pressKey(digit);
      expect(invalid.starts).toBe(1);
      expect(phone.screen).toEqual({ kind: "confirm", text: "invalid-shortcut", softkey: "" });

      at(1200 + 2900);
      expect(phone.path).toBe("standby");
      expect(invalid.deactivations).toEqual(["exit"]);
      // Further digits are not shortcut digits at standby.
      phone.pressKey("2");
      expect(phone.path).toBe("standby");
    },
  );

  it("Menu 1 1 0: Clock opens on time, `11-0` waits, and the window end is Invalid (P5 m1-1-0)", () => {
    const { phone, invalid, at } = stockRig();
    at(600);
    phone.pressKey("1");
    at(1200);
    phone.pressKey("1");
    expect(menuScreen(phone)).toMatchObject({ menuNumber: 11, opening: true });
    at(1800);
    phone.pressKey("0");
    expect(menuScreen(phone)).toMatchObject({ kind: "menu-carousel", opening: true });
    expect(indicator(phone)).toEqual({ segments: [11], awaitingNext: true, typed: "0" });

    at(1200 + OPEN_DELAY_MS);
    expect(phone.path).toBe("menu/clock");
    expect(menuScreen(phone)).toMatchObject({ kind: "list", presentation: "pages", selected: 0 });
    expect(indicator(phone)).toEqual({ segments: [11], awaitingNext: true, typed: "0" });
    expect(invalid.starts).toBe(0);

    at(1800 + WINDOW_MS);
    expect(invalid.starts).toBe(1);
  });

  it("Menu 8 6 opens Games implicitly with Settings on the top row (P5 m8-6)", () => {
    const { phone, at } = stockRig();
    at(600);
    phone.pressKey("8");
    expect(menuScreen(phone)).toMatchObject({
      kind: "menu-carousel",
      menuNumber: 8,
      opening: true,
    });
    expect(indicator(phone)).toEqual({ segments: [8], awaitingNext: false });

    at(1200);
    phone.pressKey("6");
    expect(phone.path).toBe("menu/games");
    // Settings / Snake II / Space impact, no soft key; the painter adds the 6 (`8-6`).
    expect(menuScreen(phone)).toMatchObject({
      kind: "list",
      title: "Games",
      selected: 4,
      windowTop: 4,
      opening: true,
    });
    expect(indicator(phone)).toEqual({ segments: [8], awaitingNext: false });

    at(1200 + OPEN_DELAY_MS);
    expect(phone.path).toBe("menu/games/settings");
    expect(indicator(phone)).toEqual({ segments: [8, 6], awaitingNext: true, typed: "" });
    at(1200 + WINDOW_MS);
    expect(indicator(phone)).toEqual({ segments: [8, 6], awaitingNext: false });
  });

  it("Menu 8 6 3 opens the leaf application with the awaiting indicator (P5 m8-6-3)", () => {
    const { phone, shakes, at } = stockRig();
    at(600);
    phone.pressKey("8");
    at(1200);
    phone.pressKey("6");
    at(1800);
    phone.pressKey("3");
    expect(phone.path).toBe("menu/games/settings");
    expect(menuScreen(phone)).toMatchObject({ presentation: "pages", selected: 2, opening: true });
    expect(indicator(phone)).toEqual({ segments: [8, 6], awaitingNext: false });

    at(1800 + OPEN_DELAY_MS);
    expect(phone.path).toBe("menu/games/settings/shakes");
    expect(shakes.starts).toBe(1);
    expect(shakes.context?.menuIndicator?.()).toEqual({
      segments: [8, 6, 3],
      awaitingNext: true,
      typed: "",
    });
    at(1800 + WINDOW_MS);
    expect(shakes.context?.menuIndicator?.()).toEqual({ segments: [8, 6, 3], awaitingNext: false });
  });

  it("an application the shortcut opened takes the digits typed into it (Menu 9, Menu 2 1)", () => {
    // v6.39: Calculator takes a 5 typed 6 ms after it shows; Write messages takes 4, 5 and 6
    // typed 0.4-4.1 s after it opens, within the window (2026-10-14 probes s2, t1).
    const { phone, speedDials, invalid, at } = stockRig();
    at(600);
    phone.pressKey("1");
    at(600 + WINDOW_MS + OPEN_DELAY_MS);
    at(5600);
    phone.pressKey("9");
    at(5600 + OPEN_DELAY_MS);
    expect(phone.path).toBe("menu/phone-book/speed-dials");
    at(5600 + OPEN_DELAY_MS + 6);
    phone.pressKey("5");
    expect(speedDials.keys).toEqual([
      { type: "down", key: "5" },
      { type: "up", key: "5" },
    ]);
    expect(invalid.starts).toBe(0);
  });

  it("a digit while a leaf is about to open opens it at once and is spent (Menu 9 5)", () => {
    // v6.39: Calculator shows `0` 47 ms after the 5 (probe t2); Write messages opens empty on a
    // 4 typed while it was about to open (probe s1-late).
    const { phone, speedDials, invalid, at } = stockRig();
    at(600);
    phone.pressKey("1");
    at(600 + WINDOW_MS + OPEN_DELAY_MS);
    at(5600);
    phone.pressKey("9");
    at(5600 + 500);
    expect(phone.path).toBe("menu/phone-book");
    phone.pressKey("5");
    expect(phone.path).toBe("menu/phone-book/speed-dials");
    expect(speedDials.starts).toBe(1);
    expect(speedDials.keys).toEqual([]);
    expect(invalid.starts).toBe(0);
    at(5600 + OPEN_DELAY_MS);
    expect(speedDials.starts).toBe(1);
  });

  it("a digit in an open level puts its entry on the top row, then opens it (P5 m1-wait-9)", () => {
    const { phone, speedDials, at } = stockRig();
    at(600);
    phone.pressKey("1");
    at(600 + WINDOW_MS + OPEN_DELAY_MS);
    expect(phone.path).toBe("menu/phone-book");
    at(5600);
    phone.pressKey("9");
    // Speed dials / Voice tags / Search, no soft key.
    expect(menuScreen(phone)).toMatchObject({ selected: 8, windowTop: 8, opening: true });
    expect(phone.path).toBe("menu/phone-book");
    at(5600 + OPEN_DELAY_MS);
    expect(phone.path).toBe("menu/phone-book/speed-dials");
    expect(speedDials.starts).toBe(1);
  });

  it("Menu 8 1 plays the intro first, then the typed state for a window, then the level (P5 m8-1)", () => {
    const { phone, splash, at } = stockRig();
    at(600);
    phone.pressKey("8");
    at(1200);
    phone.pressKey("1");
    expect(splash.starts).toBe(1);
    expect(phone.path).toBe("menu/games/snake");
    expect(phone.screen).toEqual({ kind: "confirm", text: "splash", softkey: "" });

    // The open delay and window fall due during the intro and do not fire.
    at(1200 + SPLASH_MS - 1);
    expect(phone.screen).toMatchObject({ kind: "confirm", text: "splash" });
    at(1200 + SPLASH_MS);
    expect(splash.deactivations).toEqual(["exit"]);
    expect(phone.path).toBe("menu/games");
    expect(menuScreen(phone)).toMatchObject({ title: "Games", selected: 0, opening: true });
    expect(indicator(phone)).toEqual({ segments: [8], awaitingNext: false });

    at(1200 + SPLASH_MS + WINDOW_MS - 1);
    expect(phone.path).toBe("menu/games");
    at(1200 + SPLASH_MS + WINDOW_MS);
    expect(phone.path).toBe("menu/games/snake");
    expect(menuScreen(phone)).toMatchObject({ title: "Snake II", selected: 0 });
    expect(indicator(phone)).toEqual({ segments: [8, 1], awaitingNext: false });
    expect(splash.starts).toBe(1);
  });

  it("Menu 8 1 2: the digit only skips the intro; the level opens on time (P5 m8-1-2)", () => {
    const { phone, splash, at } = stockRig();
    at(600);
    phone.pressKey("8");
    at(1200);
    phone.pressKey("1");
    at(1800);
    phone.pressKey("2");
    expect(splash.keys).toEqual([
      { type: "down", key: "2" },
      { type: "up", key: "2" },
    ]);
    expect(phone.path).toBe("menu/games");
    expect(menuScreen(phone)).toMatchObject({ title: "Games", selected: 0, opening: true });

    at(1200 + OPEN_DELAY_MS);
    expect(phone.path).toBe("menu/games/snake");
    expect(menuScreen(phone)).toMatchObject({ title: "Snake II", selected: 0 });
    expect(indicator(phone)).toEqual({ segments: [8, 1], awaitingNext: true, typed: "" });
    at(1800 + WINDOW_MS);
    expect(indicator(phone)).toEqual({ segments: [8, 1], awaitingNext: false });
    expect(splash.starts).toBe(1);
  });

  it("C on a failed shortcut intro shows the level and ends the shortcut", () => {
    class BrokenSplash extends PhoneApplication {
      createSession(): PhoneApplicationSession {
        throw new Error("splash failed");
      }
    }
    const { phone, at } = stockRig({}, new BrokenSplash("broken-splash"));
    at(600);
    phone.pressKey("8");
    phone.pressKey("1");
    expect(phone.screen).toMatchObject({ kind: "reader", title: "Snake II", lines: ["App error"] });
    phone.pressKey("c");
    expect(phone.path).toBe("menu/games/snake");
    at(600 + 2 * WINDOW_MS);
    expect(phone.path).toBe("menu/games/snake");
    expect(indicator(phone)).toEqual({ segments: [8, 1], awaitingNext: false });
  });

  it("a non-digit key cancels a pending opening and acts normally", () => {
    const { phone, at } = stockRig();
    at(600);
    phone.pressKey("8");
    phone.pressKey("down");
    expect(menuScreen(phone)).toMatchObject({ kind: "menu-carousel", menuNumber: 9 });
    expect("opening" in menuScreen(phone)).toBe(false);
    at(600 + OPEN_DELAY_MS);
    expect(phone.path).toBe("menu");
  });

  it("validates shortcutEntry", () => {
    expect(() =>
      stockRig({ shortcutEntry: { openDelayMs: -1, invalid: new RecordingApplication("x", 1) } }),
    ).toThrow(/openDelayMs/);
    expect(() =>
      stockRig({ shortcutEntry: { openDelayMs: 10, invalid: {} as PhoneApplication } }),
    ).toThrow(/invalid/);
  });
});
