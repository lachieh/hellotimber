import { describe, expect, it } from "vite-plus/test";
import {
  ApplicationEntry,
  createPhone,
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneApplication,
  PhoneMenu,
  ReaderEntry,
  SubmenuEntry,
  Timeline,
  TopLevelEntry,
} from "../src/index";
import type {
  ApplicationContext,
  Phone,
  PhoneApplicationSession,
  PhoneConfig,
  PhoneSnapshot,
} from "../src/index";

const slug = (value: string): MenuSlug => new MenuSlug(value);
const order = (value: number): MenuOrder => new MenuOrder(value);

class ExitOnC extends PhoneApplication {
  createSession(context: ApplicationContext): PhoneApplicationSession {
    return {
      onKey(event) {
        if (event.type === "up" && event.key === "c") context.exit();
      },
      tick() {},
      render: () => ({ kind: "confirm", text: "App", softkey: "" }),
    };
  }
}

/** Plays 0 (100 ms), 1 (50 ms), then settles on 2. */
const ALPHA = new Timeline([
  { frame: 0, durationMs: 100 },
  { frame: 1, durationMs: 50 },
  { frame: 2, durationMs: 30 },
]);
const GAMMA = new Timeline([
  { frame: 0, durationMs: 60 },
  { frame: 1, durationMs: 60 },
]);
const GAMMA_NEXT = new Timeline([
  { frame: 5, durationMs: 40 },
  { frame: 6, durationMs: 40 },
]);
const GAMMA_PREVIOUS = new Timeline([
  { frame: 7, durationMs: 20 },
  { frame: 8, durationMs: 20 },
]);
const GAMMA_RETURN = new Timeline([
  { frame: 9, durationMs: 10 },
  { frame: 3, durationMs: 10 },
]);
/** Loops 1 → 2 → 1 → 2 … after an initial 0. */
const DELTA = new Timeline(
  [
    { frame: 0, durationMs: 10 },
    { frame: 1, durationMs: 10 },
    { frame: 2, durationMs: 10 },
  ],
  { loopFrom: 1 },
);

function animatedMenu(): PhoneMenu {
  return new PhoneMenu([
    new TopLevelEntry(
      new SubmenuEntry(
        slug("alpha"),
        order(1),
        "Alpha",
        new MenuLevel([new ReaderEntry(slug("inner"), order(1), "Inner", "Body")]),
      ),
      new MenuGraphic("alpha", ALPHA),
    ),
    new TopLevelEntry(
      new ReaderEntry(slug("beta"), order(2), "Beta", "Still"),
      new MenuGraphic("beta"),
    ),
    new TopLevelEntry(
      new ApplicationEntry(slug("gamma"), order(3), "Gamma", new ExitOnC("gamma")),
      new MenuGraphic("gamma", GAMMA, {
        reveals: { next: GAMMA_NEXT, previous: GAMMA_PREVIOUS, return: GAMMA_RETURN },
      }),
    ),
    new TopLevelEntry(
      new ReaderEntry(slug("delta"), order(4), "Delta", "Loop"),
      new MenuGraphic("delta", DELTA),
    ),
  ]);
}

/** A booted phone on a virtual clock that only ever advances through `advance`. */
function rig(overrides: Partial<PhoneConfig> = {}): {
  phone: Phone;
  at: () => number;
  advance: (ms: number) => void;
} {
  const phone = createPhone({ menu: animatedMenu(), bootMs: 0, ...overrides });
  let now = 0;
  phone.tick(now);
  phone.pressKey("power", 1000);
  now = 1000;
  return {
    phone,
    at: () => now,
    advance(ms: number) {
      for (let i = 0; i < ms; i++) phone.tick(++now);
    },
  };
}

function iconFrame(phone: Phone): number | undefined {
  const screen = phone.screen;
  if (screen.kind !== "menu-carousel") throw new Error(`not on the carousel: ${screen.kind}`);
  return screen.iconFrame;
}

/** Icon frames seen by a subscriber, with the time each snapshot arrived. */
function watch(phone: Phone, at: () => number): Array<[number, number | undefined]> {
  const seen: Array<[number, number | undefined]> = [];
  phone.subscribe((snap: PhoneSnapshot) => {
    seen.push([at(), snap.screen.kind === "menu-carousel" ? snap.screen.iconFrame : -1]);
  });
  return seen;
}

describe("animated menu graphics", () => {
  it("exposes iconFrame only for graphics with a timeline", () => {
    const { phone } = rig();
    phone.pressKey("navi");
    expect(phone.screen).toEqual({
      kind: "menu-carousel",
      label: "Alpha",
      menuNumber: 1,
      total: 4,
      iconId: "alpha",
      iconFrame: 0,
      menuIndicator: { segments: [1], awaitingNext: false, awaitingFirst: true },
    });
    phone.pressKey("down");
    expect(phone.screen).not.toHaveProperty("iconFrame");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", iconId: "beta" });
  });

  it("starts the timeline when the menu is entered and follows it on ticks", () => {
    const { phone, advance } = rig();
    phone.pressKey("navi");
    expect(iconFrame(phone)).toBe(0);
    advance(99);
    expect(iconFrame(phone)).toBe(0);
    advance(1);
    expect(iconFrame(phone)).toBe(1);
    advance(50);
    expect(iconFrame(phone)).toBe(2);
    advance(5000);
    expect(iconFrame(phone)).toBe(2);
  });

  it("notifies exactly when the visible frame changes and goes quiet once settled", () => {
    const { phone, at, advance } = rig();
    const seen = watch(phone, at);
    phone.pressKey("navi");
    advance(1000);
    expect(seen).toEqual([
      [1000, 0],
      [1100, 1],
      [1150, 2],
    ]);
  });

  it("keeps notifying once per frame change while a looping timeline cycles", () => {
    const { phone, at, advance } = rig();
    phone.navigate("menu/delta");
    phone.pressKey("c"); // back to the carousel on Delta
    const seen = watch(phone, at);
    advance(50);
    expect(seen.map(([time, frame]) => [time - 1000, frame])).toEqual([
      [10, 1],
      [20, 2],
      [30, 1],
      [40, 2],
      [50, 1],
    ]);
  });

  it("restarts with the next/previous timelines when ▼/▲ reveal a slot", () => {
    const { phone, advance } = rig();
    phone.pressKey("navi");
    phone.pressKey("down"); // Beta (still)
    advance(500);
    phone.pressKey("down"); // ▼ reveals Gamma
    expect(iconFrame(phone)).toBe(5);
    advance(40);
    expect(iconFrame(phone)).toBe(6);
    phone.pressKey("down"); // Delta
    advance(500);
    phone.pressKey("up"); // ▲ reveals Gamma again
    expect(iconFrame(phone)).toBe(7);
    advance(20);
    expect(iconFrame(phone)).toBe(8);
  });

  it("restarts ▲/▼ on the same graphic even when it had settled", () => {
    const { phone, advance } = rig();
    phone.pressKey("navi");
    advance(1000);
    expect(iconFrame(phone)).toBe(2);
    phone.pressKey("up"); // Delta
    phone.pressKey("down"); // ▼ back onto Alpha: restarts
    expect(iconFrame(phone)).toBe(0);
  });

  it("restarts with the return timeline when C comes back from a submenu", () => {
    const { phone, advance } = rig();
    phone.pressKey("navi");
    advance(1000);
    phone.pressKey("navi"); // into Alpha
    advance(1000);
    phone.pressKey("c");
    expect(phone.path).toBe("menu");
    expect(iconFrame(phone)).toBe(0);
    advance(100);
    expect(iconFrame(phone)).toBe(1);
  });

  it("restarts with the return timeline when an application exits to the carousel", () => {
    const { phone, advance } = rig();
    phone.navigate("menu/gamma");
    expect(phone.screen.kind).toBe("confirm");
    advance(1000);
    phone.pressKey("c"); // the application exits itself
    expect(phone.path).toBe("menu");
    expect(iconFrame(phone)).toBe(9);
    advance(10);
    expect(iconFrame(phone)).toBe(3);
  });

  it("restarts with the enter timeline when navigate('menu') lands on the carousel", () => {
    const { phone, advance } = rig();
    phone.navigate("menu/gamma");
    advance(1000);
    phone.navigate("menu");
    expect(iconFrame(phone)).toBe(0);
    expect(phone.screen).toMatchObject({ iconId: "alpha" });
    advance(100);
    expect(iconFrame(phone)).toBe(1);
  });

  it("does not notify while the carousel is hidden behind a deeper screen", () => {
    const { phone, at, advance } = rig();
    phone.pressKey("navi");
    phone.pressKey("navi"); // into Alpha before its first frame change
    const seen = watch(phone, at);
    advance(1000);
    expect(seen).toEqual([]);
  });
});

describe("menu open delay", () => {
  it("keeps standby on screen, marked leaving, until the carousel opens", () => {
    const { phone, at, advance } = rig({ carrier: "NET", menuOpenDelayMs: 39 });
    const seen: Array<[number, PhoneSnapshot["screen"]]> = [];
    phone.subscribe((snap) => seen.push([at(), snap.screen]));
    phone.pressKey("navi");
    expect(phone.path).toBe("menu");
    advance(200);
    expect(seen.map(([time, screen]) => [time - 1000, screen])).toEqual([
      [
        0,
        {
          kind: "standby",
          carrier: "NET",
          clock: undefined,
          signal: 4,
          battery: 4,
          leaving: true,
        },
      ],
      [39, expect.objectContaining({ kind: "menu-carousel", iconFrame: 0 })],
      // The icon timeline starts when the carousel opens, not at the key press.
      [139, expect.objectContaining({ kind: "menu-carousel", iconFrame: 1 })],
      [189, expect.objectContaining({ kind: "menu-carousel", iconFrame: 2 })],
    ]);
  });

  it("times the shortcut window from the Menu press", () => {
    const { phone, advance } = rig({ menuOpenDelayMs: 39, shortcutWindowMs: 2948 });
    phone.pressKey("navi");
    advance(2947);
    expect(phone.screen).toMatchObject({ menuIndicator: { awaitingFirst: true } });
    advance(1);
    expect(phone.screen).toMatchObject({
      menuIndicator: { segments: [1], awaitingNext: false },
    });
    expect(phone.screen).not.toHaveProperty("menuIndicator.awaitingFirst");
  });

  it("opens at once when a key moves the carousel during the delay", () => {
    const { phone, advance } = rig({ menuOpenDelayMs: 39 });
    phone.pressKey("navi");
    advance(10);
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", iconId: "beta" });
  });

  it("returns to standby when C is pressed during the delay", () => {
    const { phone, advance } = rig({ menuOpenDelayMs: 39 });
    phone.pressKey("navi");
    advance(10);
    phone.pressKey("c");
    expect(phone.path).toBe("standby");
    expect(phone.screen).not.toHaveProperty("leaving");
  });

  it("does not delay path navigation to the menu", () => {
    const { phone } = rig({ menuOpenDelayMs: 39 });
    phone.navigate("menu");
    expect(phone.screen.kind).toBe("menu-carousel");
  });

  it("rejects a negative or fractional delay", () => {
    expect(() => rig({ menuOpenDelayMs: -1 })).toThrow(/menuOpenDelayMs/);
    expect(() => rig({ menuOpenDelayMs: 1.5 })).toThrow(/menuOpenDelayMs/);
  });
});
