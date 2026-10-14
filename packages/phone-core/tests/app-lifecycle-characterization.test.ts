import { describe, expect, it } from "vite-plus/test";
import { PhoneApplication } from "../src/index";
import type {
  ApplicationContext,
  DeactivationReason,
  Phone,
  PhoneApplicationSession,
} from "../src/index";
import { bootedPhone } from "./fixtures";

describe("application activation lifecycle", () => {
  it("honors a synchronous context.exit() during creation", () => {
    const reasons: DeactivationReason[] = [];
    class ExitingApplication extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        context.exit();
        return {
          onKey() {},
          tick() {},
          render: () => ({ kind: "confirm", text: "stale", softkey: "" }),
          onDeactivate: (reason) => reasons.push(reason),
        };
      }
    }
    const phone = bootedPhone({}, new ExitingApplication("exiting"));

    phone.navigate("menu/messages/write");

    expect(phone.path).toBe("menu/messages");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Messages" });
    expect(reasons).toEqual(["exit"]);
  });

  it("honors a synchronous context.open() during creation", () => {
    const reasons: DeactivationReason[] = [];
    class Replacement extends PhoneApplication {
      createSession(): PhoneApplicationSession {
        return {
          onKey() {},
          tick() {},
          render: () => ({ kind: "confirm", text: "replacement", softkey: "" }),
        };
      }
    }
    const replacement = new Replacement("replacement");
    class ReplacingApplication extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        context.open(replacement);
        return {
          onKey() {},
          tick() {},
          render: () => ({ kind: "confirm", text: "stale", softkey: "" }),
          onDeactivate: (reason) => reasons.push(reason),
        };
      }
    }
    const phone = bootedPhone({}, new ReplacingApplication("replacing"));

    phone.navigate("menu/messages/write");

    expect(phone.path).toBe("menu/messages/write");
    expect(phone.screen).toMatchObject({ kind: "confirm", text: "replacement" });
    expect(reasons).toEqual(["replace"]);
  });

  it("does not overwrite reentrant navigation after creation returns", () => {
    const reasons: DeactivationReason[] = [];
    let phone: Phone;
    class NavigatingApplication extends PhoneApplication {
      createSession(): PhoneApplicationSession {
        phone.navigate("menu/chat");
        return {
          onKey() {},
          tick() {},
          render: () => ({ kind: "confirm", text: "stale", softkey: "" }),
          onDeactivate: (reason) => reasons.push(reason),
        };
      }
    }
    phone = bootedPhone({}, new NavigatingApplication("navigating"));

    phone.navigate("menu/messages/write");

    expect(phone.path).toBe("menu/chat");
    expect(phone.screen).toMatchObject({ kind: "reader", title: "Chat" });
    expect(reasons).toEqual(["navigate"]);
  });

  it("deactivates a session returned after creation powers the phone off", () => {
    const reasons: DeactivationReason[] = [];
    let phone: Phone;
    class PoweringOffApplication extends PhoneApplication {
      createSession(): PhoneApplicationSession {
        phone.pressKey("power", 1000);
        return {
          onKey() {},
          tick() {},
          render: () => ({ kind: "confirm", text: "stale", softkey: "" }),
          onDeactivate: (reason) => reasons.push(reason),
        };
      }
    }
    phone = bootedPhone({}, new PoweringOffApplication("powering-off"));

    phone.navigate("menu/messages/write");

    expect(phone.path).toBe("standby");
    expect(phone.screen).toEqual({ kind: "off" });
    expect(reasons).toEqual(["power-off"]);
  });

  it("does not show an app error when creation throws after leaving", () => {
    class ExitingBrokenApplication extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        context.exit();
        throw new Error("create failed after exit");
      }
    }
    const phone = bootedPhone({}, new ExitingBrokenApplication("exiting-broken"));

    phone.navigate("menu/messages/write");

    expect(phone.path).toBe("menu/messages");
    expect(phone.screen).toMatchObject({ kind: "list", title: "Messages" });
  });

  it("creates fresh independent sessions across launches and Phone instances", () => {
    let sessions = 0;
    class SessionApplication extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        const id = ++sessions;
        return {
          onKey(event) {
            if (event.type === "up" && event.key === "c") context.exit();
          },
          tick() {},
          render: () => ({ kind: "confirm", text: `Session ${id}`, softkey: "" }),
        };
      }
    }
    const definition = new SessionApplication("sessions");
    const firstPhone = bootedPhone({}, definition);
    const secondPhone = bootedPhone({}, definition);

    firstPhone.navigate("menu/messages/write");
    secondPhone.navigate("menu/messages/write");
    expect(firstPhone.screen).toMatchObject({ text: "Session 1" });
    expect(secondPhone.screen).toMatchObject({ text: "Session 2" });
    firstPhone.pressKey("c");
    firstPhone.navigate("menu/messages/write");
    expect(firstPhone.screen).toMatchObject({ text: "Session 3" });
  });

  it("makes stale contexts permanent no-ops, including a later launch of the same definition", () => {
    const contexts: ApplicationContext[] = [];
    let sessions = 0;
    class SessionApplication extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        contexts.push(context);
        const id = ++sessions;
        return {
          onKey() {},
          tick() {},
          render: () => ({ kind: "confirm", text: `Session ${id}`, softkey: "" }),
        };
      }
    }
    const definition = new SessionApplication("sessions");
    const phone = bootedPhone({}, definition);
    phone.navigate("menu/messages/write");
    phone.navigate("menu/chat");
    phone.navigate("menu/messages/write");

    contexts[0]!.exit();
    contexts[0]!.open(new SessionApplication("other"));
    expect(phone.path).toBe("menu/messages/write");
    expect(phone.screen).toMatchObject({ text: "Session 2" });
  });

  it("applies an active asynchronous context transition through normal phone events", () => {
    let activeContext: ApplicationContext | null = null;
    class AsyncApplication extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        activeContext = context;
        return {
          onKey() {},
          tick() {},
          render: () => ({ kind: "confirm", text: "Active", softkey: "" }),
        };
      }
    }
    const phone = bootedPhone({}, new AsyncApplication("async"));
    const paths: string[] = [];
    phone.on("pathchange", (path) => paths.push(path));
    phone.navigate("menu/messages/write");
    paths.length = 0;

    (activeContext as ApplicationContext | null)?.exit();

    expect(phone.path).toBe("menu/messages");
    expect(paths).toEqual(["menu/messages"]);
  });

  it("deactivates every successful activation exactly once with the right reason", () => {
    const reasons: DeactivationReason[] = [];
    const replacements: DeactivationReason[] = [];
    class Replacement extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        return {
          onKey(event) {
            if (event.type === "up" && event.key === "c") context.exit();
          },
          tick() {},
          render: () => ({ kind: "confirm", text: "replacement", softkey: "" }),
          onDeactivate: (reason) => replacements.push(reason),
        };
      }
    }
    const replacement = new Replacement("replacement");
    class Source extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        return {
          onKey(event) {
            if (event.type === "up" && event.key === "c") context.exit();
            if (event.type === "up" && event.key === "navi") context.open(replacement);
          },
          tick() {},
          render: () => ({ kind: "confirm", text: "source", softkey: "" }),
          onDeactivate: (reason) => reasons.push(reason),
        };
      }
    }
    const phone = bootedPhone({}, new Source("source"));

    phone.navigate("menu/messages/write");
    phone.pressKey("c");
    phone.navigate("menu/messages/write");
    phone.pressKey("navi");
    phone.pressKey("c");
    phone.navigate("menu/messages/write");
    phone.navigate("menu/chat");
    phone.navigate("menu/messages/write");
    phone.pressKey("power", 1000);

    expect(reasons).toEqual(["exit", "replace", "navigate", "power-off"]);
    expect(replacements).toEqual(["exit"]);
  });
});
