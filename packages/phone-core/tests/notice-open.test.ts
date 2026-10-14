// Plan 18 Task 4: a standby notice whose Navi opens a standby application (`open`).
import { describe, expect, it } from "vite-plus/test";
import { createPhone, PhoneApplication } from "../src/index";
import type {
  ApplicationContext,
  DeactivationReason,
  KeyEvent,
  PhoneApplicationSession,
} from "../src/index";
import { bootedPhone, testConfig } from "./fixtures";

const NOTICE = { text: "1 message received", softkey: "Read" };

/** An application that records what reaches it and exposes its context. */
class InboxApp extends PhoneApplication {
  readonly keys: KeyEvent[] = [];
  readonly deactivations: DeactivationReason[] = [];
  context: ApplicationContext | undefined;

  createSession(context: ApplicationContext): PhoneApplicationSession {
    this.context = context;
    return {
      onKey: (event) => {
        this.keys.push(event);
        if (event.type === "up" && event.key === "c") context.exit();
      },
      tick: () => {},
      render: () => ({ kind: "confirm", text: "Inbox", softkey: "Read" }),
      onDeactivate: (reason) => {
        this.deactivations.push(reason);
      },
    };
  }
}

class ThrowingApp extends PhoneApplication {
  createSession(): PhoneApplicationSession {
    throw new Error("broken inbox");
  }
}

describe("setNotice({ open })", () => {
  it("runs the application on Navi as a standby application", () => {
    const phone = bootedPhone();
    const inbox = new InboxApp("inbox");
    phone.setNotice({ ...NOTICE, open: inbox });
    expect(phone.screen).toEqual(expect.objectContaining({ kind: "standby", notice: NOTICE }));
    phone.pressKey("navi");
    expect(phone.screen).toEqual({ kind: "confirm", text: "Inbox", softkey: "Read" });
    expect(phone.path).toBe("standby");
    expect(inbox.context!.menuIndicator!()).toEqual({ segments: [], awaitingNext: false });
    phone.pressKey("down");
    expect(inbox.keys.map((k) => `${k.type} ${k.key}`)).toEqual(["down down", "up down"]);
  });

  it("returns to standby on exit(), without the notice", () => {
    const phone = bootedPhone();
    const inbox = new InboxApp("inbox");
    phone.setNotice({ ...NOTICE, open: inbox });
    phone.pressKey("navi");
    phone.pressKey("c");
    expect(phone.path).toBe("standby");
    expect(phone.screen).toMatchObject({ kind: "standby" });
    expect(phone.screen).not.toHaveProperty("notice");
    expect(inbox.deactivations).toEqual(["exit"]);
    phone.pressKey("navi"); // no notice: Menu
    expect(phone.path).toBe("menu");
  });

  it("allows exit to standby but rejects levels, select and row", () => {
    const phone = bootedPhone();
    const inbox = new InboxApp("inbox");
    phone.setNotice({ ...NOTICE, open: inbox });
    phone.pressKey("navi");
    const context = inbox.context!;
    expect(() => context.exit({ levels: 1 })).toThrow(/not available/);
    expect(() => context.exit({ select: "x" })).toThrow(/not available/);
    expect(() => context.exit({ row: "top" })).toThrow(/not available/);
    expect(phone.screen).toMatchObject({ kind: "confirm" });
    context.exit({ to: "standby" });
    expect(phone.screen).toMatchObject({ kind: "standby" });
  });

  it("clears the notice on C without running the application", () => {
    const phone = bootedPhone();
    const inbox = new InboxApp("inbox");
    phone.setNotice({ ...NOTICE, open: inbox });
    phone.pressKey("c");
    expect(phone.screen).not.toHaveProperty("notice");
    expect(inbox.context).toBeUndefined();
  });

  it("rejects a notice with both a path and an application", () => {
    const phone = bootedPhone();
    expect(() =>
      phone.setNotice({ ...NOTICE, path: "menu/messages", open: new InboxApp("inbox") }),
    ).toThrow(/path.*open/);
  });

  it("deactivates the application once on power-off", () => {
    const phone = bootedPhone();
    const inbox = new InboxApp("inbox");
    phone.setNotice({ ...NOTICE, open: inbox });
    phone.pressKey("navi");
    phone.pressKey("power", 1000);
    expect(phone.screen).toEqual({ kind: "off" });
    expect(inbox.deactivations).toEqual(["power-off"]);
  });

  it("deactivates the application when navigate() leaves it, even for standby", () => {
    for (const target of ["menu/messages", "standby"]) {
      const phone = bootedPhone();
      const inbox = new InboxApp("inbox");
      phone.setNotice({ ...NOTICE, open: inbox });
      phone.pressKey("navi");
      phone.navigate(target);
      expect(phone.path, target).toBe(target);
      expect(inbox.deactivations, target).toEqual(["navigate"]);
      if (target === "standby") expect(phone.screen).toMatchObject({ kind: "standby" });
    }
  });

  it("shows the App error reader when the application fails to start; C returns to standby", () => {
    const phone = createPhone(testConfig());
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.setNotice({ ...NOTICE, open: new ThrowingApp("broken") });
    phone.pressKey("navi");
    expect(phone.screen).toMatchObject({ kind: "reader", lines: ["App error"] });
    expect(phone.path).toBe("standby");
    phone.pressKey("c");
    expect(phone.screen).toMatchObject({ kind: "standby" });
  });
});
