import type { Phone, PhoneKey } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import type { StockCue } from "../src/firmware/cues";
import { createStockPhoneWith } from "../src/firmware/phone";
import { createStockPhone, type StockPhoneConfig } from "../src/index";
import { BOOT_TIMELINE } from "../src/resources";

function poweredOn(config: Partial<StockPhoneConfig> = {}): Phone {
  const phone = createStockPhone({ carrier: "Orange F", boot: "skip", ...config });
  phone.tick(0);
  phone.pressKey("power", 1000);
  return phone;
}

/** A powered-on phone on a virtual clock (10 ms ticks), at standby with its timers settled. */
function clocked(config: Partial<StockPhoneConfig> = {}) {
  const phone = poweredOn(config);
  let now = 1000;
  const advance = (ms: number): void => {
    for (const end = now + ms; now < end; ) phone.tick((now = Math.min(now + 10, end)));
  };
  advance(1000);
  return {
    phone,
    advance,
    press: (...keys: PhoneKey[]): void => {
      for (const key of keys) phone.pressKey(key);
    },
  };
}

describe("createStockPhone", () => {
  it("rejects a carrier the small font cannot draw and names the characters", () => {
    expect(() => createStockPhone({ carrier: "Zap & Zone@" })).toThrow(
      'Carrier "Zap & Zone@" has characters the stock small font lacks: "Z", "&", "@".',
    );
    expect(() => createStockPhone({ carrier: "Telstra" })).not.toThrow();
  });

  it("starts powered off; boot: skip reaches standby on power-on", () => {
    const phone = createStockPhone({ carrier: "Telstra", boot: "skip" });
    expect(phone.screen).toEqual({ kind: "off" });
    phone.tick(0);
    phone.pressKey("power", 1000);
    expect(phone.path).toBe("standby");
    expect(phone.screen).toMatchObject({ kind: "standby", carrier: "Telstra" });
  });

  it("boots through the captured boot timeline, then standby", () => {
    const phone = createStockPhone({ carrier: "Orange F" });
    phone.tick(0);
    phone.send({ type: "down", key: "power" });
    phone.tick(800);
    const poweredAt = 800;
    let start = 0;
    for (const step of BOOT_TIMELINE.steps) {
      for (const at of [start, start + step.durationMs - 1]) {
        phone.tick(poweredAt + at);
        expect(phone.screen, `${at} ms`).toEqual({
          kind: "boot",
          phase: "hands",
          frame: step.frame,
        });
      }
      start += step.durationMs;
    }
    phone.tick(poweredAt + BOOT_TIMELINE.durationMs);
    expect(phone.screen).toMatchObject({ kind: "standby" });
  });

  it("keeps the circular rows window: ▲ from Search shows Voice tags on the top row (D3)", () => {
    const phone = poweredOn();
    phone.pressKey("navi");
    phone.pressKey("navi");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 0, windowTop: 0 });
    phone.pressKey("up");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 9, windowTop: 9 });
  });

  it("opens the stock standby ▲/▼ targets: the Search prompt and the Dialled numbers note", () => {
    const up = poweredOn();
    up.pressKey("up");
    expect(up.path).toBe("menu/phone-book/search");
    expect(up.screen).toMatchObject({ kind: "custom", appId: "stock:phone-book/search" });
    const down = poweredOn();
    down.pressKey("down");
    expect(down.path).toBe("menu/call-register/dialled-numbers");
    expect(down.screen).toMatchObject({
      kind: "custom",
      appId: "stock:call-register/dialled-numbers",
    });
  });

  it("drives standby and the Clock pages from the clock and date ports", () => {
    let time = "10:10";
    const phone = poweredOn({ clock: () => time, date: () => "13.10.2026" });
    expect(phone.screen).toMatchObject({ kind: "standby", clock: "10:10" });
    time = "10:11";
    phone.tick(2000);
    expect(phone.screen).toMatchObject({ kind: "standby", clock: "10:11" });
    phone.navigate("menu/clock");
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ kind: "list", presentation: "pages", detail: "10:11" });
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 2, detail: "13.10.2026" });
  });

  it("keeps standby (ladders erased) for 39 ms after Menu and shows the dots for 2948 ms", () => {
    const phone = poweredOn();
    phone.tick(10_000);
    phone.pressKey("navi");
    expect(phone.screen).toMatchObject({ kind: "standby", leaving: true });
    phone.tick(10_038);
    expect(phone.screen).toMatchObject({ kind: "standby", leaving: true });
    phone.tick(10_039);
    expect(phone.screen).toMatchObject({
      kind: "menu-carousel",
      label: "Phone book",
      menuIndicator: { segments: [1], awaitingNext: false, awaitingFirst: true },
    });
    phone.tick(12_947);
    expect(phone.screen).toMatchObject({ menuIndicator: { awaitingFirst: true } });
    phone.tick(12_948);
    expect(phone.screen).toMatchObject({ menuIndicator: { segments: [1], awaitingNext: false } });
    expect(phone.screen).not.toHaveProperty("menuIndicator.awaitingFirst");
  });

  it("lists Call divert's last entry under its kept number 6", () => {
    const phone = poweredOn();
    phone.navigate("menu/call-divert");
    expect(phone.screen).toMatchObject({ kind: "list", itemOrders: [1, 2, 3, 4, 6] });
  });
});

describe("the whole tree on the stock phone (plan 14 Task 12)", () => {
  it("opens a typed entry 1460 ms after its digit, numbers matched as numbers (D14)", () => {
    const { phone, advance, press } = clocked();
    press("navi");
    advance(100);
    press("7");
    expect(phone.screen).toMatchObject({
      kind: "menu-carousel",
      label: "Call divert",
      opening: true,
    });
    advance(1459);
    expect(phone.path).toBe("menu");
    advance(1);
    expect(phone.path).toBe("menu/call-divert");
    press("6");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 4, opening: true });
    advance(1460);
    expect(phone.path).toBe("menu/call-divert/cancel-all-diverts");
  });

  it("shows Invalid shortcut for digits that match no number, then standby (P5)", () => {
    const { phone, advance, press } = clocked();
    press("navi");
    advance(100);
    press("1", "8");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "stock:invalid-shortcut" });
    // The note's timeline (2903 ms, then 9 ms of partial erase) ends at standby.
    advance(2911);
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "stock:invalid-shortcut" });
    advance(1);
    expect(phone.path).toBe("standby");
  });

  it("stores an option-list choice: Done, then the page shows it (D9)", () => {
    const { phone, advance, press } = clocked();
    phone.navigate("menu/tones");
    press("down");
    expect(phone.screen).toMatchObject({ kind: "list", detail: "Level 1" });
    press("navi", "down", "down", "down", "navi");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "stock:tones/ringing-volume" });
    advance(1500);
    expect(phone.path).toBe("menu/tones");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 1, detail: "Level 3" });
    // The General profile shares the setting (P11); Silent keeps its own.
    phone.navigate("menu/profiles/general/personalise");
    press("down");
    expect(phone.screen).toMatchObject({ kind: "list", detail: "Level 3" });
    phone.navigate("menu/profiles/silent/personalise");
    press("down");
    expect(phone.screen).toMatchObject({ kind: "list", detail: "Level 1" });
  });

  it("stores Level 5 only after its query's OK (P8)", () => {
    const { phone, advance, press } = clocked();
    phone.navigate("menu/tones");
    press("down", "navi", "up", "navi");
    press("c");
    expect(phone.path).toBe("menu/tones/ringing-volume");
    press("c");
    expect(phone.screen).toMatchObject({ kind: "list", detail: "Level 1" });
    press("navi", "up", "navi", "navi");
    advance(1500);
    expect(phone.screen).toMatchObject({ kind: "list", selected: 1, detail: "Level 5" });
  });

  it("sets Info service with its leaves: the note returns to the page, which shows the value", () => {
    const { phone, advance, press } = clocked();
    phone.navigate("menu/messages/info-service");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 1, softkey: "OK" });
    press("up", "navi");
    advance(1500);
    expect(phone.path).toBe("menu/messages");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 7, detail: "On" });
    // The level opens on the stored value.
    press("navi");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 0 });
    press("down", "down", "navi");
    advance(1500);
    expect(phone.screen).toMatchObject({ kind: "list", selected: 7, detail: "Topic index" });
  });

  it("returns two levels after a Set delay choice and after View all (P13, Task 0)", () => {
    const { phone, press } = clocked();
    phone.navigate("menu/call-divert/divert-if-not-answered");
    press("down", "down", "down", "navi", "down", "navi");
    expect(phone.path).toBe("menu/call-divert");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 2 });
    phone.navigate("menu/reminders");
    press("down", "navi");
    expect(phone.path).toBe("menu");
    expect(phone.screen).toMatchObject({ kind: "menu-carousel", label: "Reminders" });
  });

  it("plays a game's splash before its menu; Top score returns with New game selected (P12)", () => {
    const { phone, advance, press } = clocked();
    phone.navigate("menu/games");
    press("navi");
    expect(phone.path).toBe("menu/games/snake");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "stock:intro:games/snake" });
    advance(2600);
    expect(phone.screen).toMatchObject({ kind: "list", title: "Snake II", selected: 0 });
    press("down", "down", "down", "navi");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "stock:games/snake/top-score" });
    advance(6000);
    expect(phone.path).toBe("menu/games/snake");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 0 });
  });

  it("opens game widgets: Level bars, option lists, Score IDs and Instructions", () => {
    const { phone, press } = clocked();
    for (const [downs, slug] of [
      [1, "level"],
      [2, "mazes"],
      [4, "score-ids"],
      [5, "instructions"],
    ] as const) {
      phone.navigate("menu/games/snake");
      for (let i = 0; i < downs; i++) press("down");
      press("navi");
      expect(phone.screen).toMatchObject({ kind: "custom", appId: `stock:games/snake/${slug}` });
      phone.navigate("standby");
    }
  });
});

describe("Snake II: New game, suspend and Continue (plan 23 D10, Task 0 C8)", () => {
  /** A powered-on phone with 10:10's seed, at Snake II's game menu (splash skipped). */
  function atSnake(cues: { cue: StockCue; atMs: number }[] = []) {
    const phone = createStockPhoneWith(
      { carrier: "Orange F", boot: "skip" },
      { seed: 44530, cues: { cue: (cue, atMs) => void cues.push({ cue, atMs }) } },
    );
    let now = 0;
    phone.tick(now);
    phone.pressKey("power", 1000);
    const advance = (ms: number): void => {
      for (const end = now + ms; now < end; ) phone.tick((now = Math.min(now + 1, end)));
    };
    const press = (...keys: PhoneKey[]): void => {
      for (const key of keys) {
        phone.send({ type: "down", key });
        advance(1);
        phone.send({ type: "up", key });
        advance(1);
      }
    };
    advance(1000);
    phone.navigate("menu/games/snake");
    return { phone, advance, press, now: () => now };
  }
  const list = (phone: Phone) => {
    const screen = phone.screen;
    if (screen.kind !== "list") throw new Error(`expected a list, got ${screen.kind}`);
    return screen;
  };

  it("lists New game first (8-1-1) and no Continue while no game is suspended", () => {
    const { phone } = atSnake();
    expect(list(phone).items.slice(0, 2)).toEqual(["New game", "Level"]);
    expect(list(phone).items).not.toContain("Continue");
  });

  it("Navi during play suspends: Continue heads the list, selected on the top row (8-1-1)", () => {
    const { phone, advance, press } = atSnake();
    press("navi");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "stock:games/snake/new-game" });
    advance(1500);
    press("navi");
    expect(phone.path).toBe("menu/games/snake");
    const screen = list(phone);
    expect(screen.items).toEqual([
      "Continue",
      "New game",
      "Level",
      "Mazes",
      "Top score",
      "Score IDs",
      "Instructions",
    ]);
    expect(screen).toMatchObject({ selected: 0, windowTop: 0 });
    expect(screen.itemOrders).toBeUndefined();
    press("down");
    expect(list(phone).selected).toBe(1);
  });

  it("Continue resumes the board; C goes to Games and re-entry opens on Continue", () => {
    const { phone, advance, press } = atSnake();
    press("navi");
    advance(1500);
    const board = phone.screen;
    press("c");
    expect(list(phone).items[0]).toBe("Continue");
    press("c");
    expect(phone.path).toBe("menu/games");
    press("navi");
    advance(3000);
    expect(list(phone)).toMatchObject({ title: "Snake II", selected: 0 });
    press("navi");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "stock:games/snake/continue" });
    if (phone.screen.kind !== "custom" || board.kind !== "custom") throw new Error("custom");
    expect(phone.screen.frame.pixels).toEqual(board.frame.pixels);
  });

  it("New game discards the suspended game; power-off loses it, standby keeps it", () => {
    const { phone, advance, press } = atSnake();
    press("navi");
    advance(700);
    press("navi");
    phone.navigate("standby");
    phone.navigate("menu/games/snake");
    expect(list(phone).items[0]).toBe("Continue");
    press("down", "navi");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "stock:games/snake/new-game" });
    press("c");
    expect(list(phone).items[0]).toBe("Continue");
    phone.pressKey("power", 1000);
    advance(10);
    phone.pressKey("power", 1000);
    advance(10);
    phone.navigate("menu/games/snake");
    expect(list(phone).items[0]).toBe("New game");
  });

  it("Top score while suspended returns to Continue; Level OK discards the game (C8)", () => {
    const { phone, advance, press } = atSnake();
    press("navi");
    advance(700);
    press("navi");
    press("down", "down", "down", "down", "navi");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "stock:games/snake/top-score" });
    advance(6000);
    expect(list(phone)).toMatchObject({ selected: 0 });
    expect(list(phone).items[0]).toBe("Continue");
    press("down", "down", "navi");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "stock:games/snake/level" });
    press("navi");
    const screen = list(phone);
    expect(screen.items[0]).toBe("New game");
    expect(screen.items[screen.selected]).toBe("Mazes");
  });

  it("stamps the game's cues with the kernel time", () => {
    const cues: { cue: StockCue; atMs: number }[] = [];
    const { phone, advance, press, now } = atSnake(cues);
    // The virgin level 175 on Maze 1 (No maze is wall-less): set Maze 1, then New game runs
    // straight into the right wall within a second.
    press("down", "down", "navi", "down", "navi");
    advance(3000);
    expect(list(phone).items[list(phone).selected]).toBe("Mazes");
    press("up", "up", "navi");
    expect(phone.screen).toMatchObject({ kind: "custom", appId: "stock:games/snake/new-game" });
    const start = now();
    advance(1000);
    expect(cues.map((c) => c.cue.kind)).toEqual(["crash", "vibrate"]);
    expect(cues[0]!.atMs).toBeGreaterThan(start);
    expect(cues[0]!.atMs).toBeLessThan(start + 1000);
  });
});
