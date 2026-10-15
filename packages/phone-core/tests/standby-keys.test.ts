// Plan 19 Task 4: standby keys that open an application (as a standby application) and the
// standby key delay (standby stays on screen with `leaving: true` before the target opens).
import { describe, expect, it } from "vite-plus/test";
import { createPhone, PhoneApplication } from "../src/index";
import type {
  ApplicationContext,
  DeactivationReason,
  KeyEvent,
  PhoneApplicationSession,
} from "../src/index";
import { bootedPhone, TEST_STANDBY_KEYS, testConfig } from "./fixtures";

/** An application that records what reaches it and exposes its context. */
class ListApp extends PhoneApplication {
  readonly keys: KeyEvent[] = [];
  readonly deactivations: DeactivationReason[] = [];
  context: ApplicationContext | undefined;
  sessions = 0;

  createSession(context: ApplicationContext): PhoneApplicationSession {
    this.context = context;
    this.sessions++;
    return {
      onKey: (event) => {
        this.keys.push(event);
        if (event.type === "up" && event.key === "c") context.exit();
      },
      tick: () => {},
      render: () => ({ kind: "confirm", text: "Names", softkey: "Call" }),
      onDeactivate: (reason) => {
        this.deactivations.push(reason);
      },
    };
  }
}

class ThrowingApp extends PhoneApplication {
  createSession(): PhoneApplicationSession {
    throw new Error("broken list");
  }
}

describe("standbyKeys with an application", () => {
  it("runs ▼'s application as a standby application", () => {
    const list = new ListApp("names");
    const phone = bootedPhone({ standbyKeys: { up: TEST_STANDBY_KEYS.up, down: list } });
    phone.pressKey("down");
    expect(phone.screen).toEqual({ kind: "confirm", text: "Names", softkey: "Call" });
    expect(phone.path).toBe("standby");
    expect(list.context!.menuIndicator!()).toEqual({ segments: [], awaitingNext: false });
    phone.pressKey("down");
    expect(list.keys.map((k) => `${k.type} ${k.key}`)).toEqual(["down down", "up down"]);
  });

  it("returns to standby on exit(); levels, select and row throw", () => {
    const list = new ListApp("names");
    const phone = bootedPhone({ standbyKeys: { down: list } });
    phone.pressKey("down");
    const context = list.context!;
    expect(() => context.exit({ levels: 1 })).toThrow(/not available/);
    expect(() => context.exit({ select: "x" })).toThrow(/not available/);
    expect(() => context.exit({ row: "top" })).toThrow(/not available/);
    phone.pressKey("c");
    expect(phone.path).toBe("standby");
    expect(phone.screen).toMatchObject({ kind: "standby" });
    expect(list.deactivations).toEqual(["exit"]);
    phone.pressKey("down");
    expect(list.sessions).toBe(2);
    context.exit({ to: "standby" }); // the old session's context is inert
    expect(phone.screen).toMatchObject({ kind: "confirm" });
  });

  it("still navigates to a path, as before", () => {
    const list = new ListApp("names");
    const phone = bootedPhone({ standbyKeys: { up: TEST_STANDBY_KEYS.up, down: list } });
    phone.pressKey("up");
    expect(phone.path).toBe(TEST_STANDBY_KEYS.up);
    expect(list.sessions).toBe(0);
  });

  it("deactivates the application once on power-off", () => {
    const list = new ListApp("names");
    const phone = bootedPhone({ standbyKeys: { down: list } });
    phone.pressKey("down");
    phone.pressKey("power", 1000);
    expect(phone.screen).toEqual({ kind: "off" });
    expect(list.deactivations).toEqual(["power-off"]);
  });

  it("deactivates the application when navigate() leaves it, even for standby", () => {
    for (const target of ["menu/messages", "standby"]) {
      const list = new ListApp("names");
      const phone = bootedPhone({ standbyKeys: { down: list } });
      phone.pressKey("down");
      phone.navigate(target);
      expect(phone.path, target).toBe(target);
      expect(list.deactivations, target).toEqual(["navigate"]);
      if (target === "standby") expect(phone.screen).toMatchObject({ kind: "standby" });
    }
  });

  it("shows App error when the application fails to start; C returns to standby", () => {
    const phone = bootedPhone({ standbyKeys: { down: new ThrowingApp("broken") } });
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ kind: "reader", lines: ["App error"] });
    expect(phone.path).toBe("standby");
    phone.pressKey("c");
    expect(phone.screen).toMatchObject({ kind: "standby" });
  });
});

describe("standbyKeyDelayMs", () => {
  /** A booted phone at time `now` (ms). */
  const delayed = (delay: number, down: string | PhoneApplication = new ListApp("names")) => {
    const phone = bootedPhone({
      standbyKeys: { up: TEST_STANDBY_KEYS.up, down },
      standbyKeyDelayMs: delay,
    });
    return phone;
  };

  it("keeps standby on screen with leaving: true for the delay, then opens the target", () => {
    const list = new ListApp("names");
    const phone = delayed(23, list);
    let now = 1000;
    phone.tick(now);
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ kind: "standby", leaving: true });
    expect(phone.path).toBe("standby");
    expect(list.sessions).toBe(0);
    phone.tick((now += 22));
    expect(phone.screen).toMatchObject({ kind: "standby", leaving: true });
    phone.tick((now += 1));
    expect(phone.screen).toEqual({ kind: "confirm", text: "Names", softkey: "Call" });
    expect(list.sessions).toBe(1);
  });

  it("delays a path target too", () => {
    const phone = delayed(23);
    phone.tick(1000);
    phone.pressKey("up");
    expect(phone.path).toBe("standby");
    expect(phone.screen).toMatchObject({ kind: "standby", leaving: true });
    phone.tick(1023);
    expect(phone.path).toBe(TEST_STANDBY_KEYS.up);
  });

  it("does not leave standby for an unknown path", () => {
    const phone = bootedPhone({ standbyKeys: { up: "menu/nowhere" }, standbyKeyDelayMs: 23 });
    phone.tick(1000);
    phone.pressKey("up");
    expect(phone.screen).toMatchObject({ kind: "standby" });
    expect(phone.screen).not.toHaveProperty("leaving");
  });

  it("a key during the delay opens the target at once and goes to it", () => {
    const list = new ListApp("names");
    const phone = delayed(23, list);
    phone.tick(1000);
    phone.pressKey("down");
    phone.send({ type: "down", key: "down" });
    expect(list.sessions).toBe(1);
    expect(phone.screen).toEqual({ kind: "confirm", text: "Names", softkey: "Call" });
    phone.send({ type: "up", key: "down" });
    expect(list.keys.map((k) => `${k.type} ${k.key}`)).toEqual(["down down", "up down"]);
    // C in the delay closes the list it opened (Task 0: standby/lead-c).
    phone.pressKey("c");
    phone.tick(1010);
    phone.pressKey("down");
    phone.pressKey("c");
    expect(list.sessions).toBe(2);
    expect(phone.screen).toMatchObject({ kind: "standby" });
    expect(phone.screen).not.toHaveProperty("leaving");
    phone.tick(1100);
    expect(list.sessions).toBe(2);
  });

  it("opens a path target at once for a key in the delay", () => {
    const phone = delayed(23);
    phone.tick(1000);
    phone.pressKey("up");
    phone.send({ type: "down", key: "down" });
    expect(phone.path).toBe(TEST_STANDBY_KEYS.up);
  });

  it("is cancelled by navigate(); power-off deactivates what it opened", () => {
    const list = new ListApp("names");
    const phone = delayed(23, list);
    phone.tick(1000);
    phone.pressKey("down");
    phone.navigate("menu/messages");
    phone.tick(1100);
    expect(phone.path).toBe("menu/messages");
    expect(list.sessions).toBe(0);
    phone.navigate("standby");
    phone.pressKey("down");
    // The power key is a key in the delay too: the list opens, and the long press powers off.
    phone.pressKey("power", 1000);
    phone.tick(3000);
    expect(phone.screen).toEqual({ kind: "off" });
    expect(list.deactivations).toEqual(["power-off"]);
  });

  it("emits a snapshot when the delay starts and when the target opens", () => {
    const phone = delayed(23);
    phone.tick(1000);
    const kinds: string[] = [];
    phone.subscribe((snapshot) => {
      const kind = `${snapshot.screen.kind}${"leaving" in snapshot.screen ? "+leaving" : ""}`;
      if (kinds.at(-1) !== kind) kinds.push(kind);
    });
    phone.pressKey("down");
    for (let t = 1001; t <= 1030; t++) phone.tick(t);
    expect(kinds).toEqual(["standby+leaving", "confirm"]);
  });

  it("rejects invalid values", () => {
    for (const value of [-1, 1.5, Number.NaN]) {
      expect(() => createPhone(testConfig({ standbyKeyDelayMs: value })), String(value)).toThrow(
        /standbyKeyDelayMs must be a non-negative integer/,
      );
    }
  });

  it("defaults to 0: the target opens on the key", () => {
    const list = new ListApp("names");
    const phone = bootedPhone({ standbyKeys: { down: list } });
    phone.tick(1000);
    phone.pressKey("down");
    expect(list.sessions).toBe(1);
  });
});
