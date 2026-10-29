import { describe, expect, it } from "vite-plus/test";
import { PhoneApplication } from "../src/index";
import type {
  ApplicationContext,
  DeactivationReason,
  KeyEvent,
  PhoneApplicationSession,
} from "../src/index";

function press(session: PhoneApplicationSession, key: KeyEvent["key"]): void {
  session.onKey({ type: "down", key });
  session.onKey({ type: "up", key });
}

describe("PhoneApplication contract", () => {
  it("validates definition ids", () => {
    class App extends PhoneApplication {
      createSession(): PhoneApplicationSession {
        return { onKey() {}, tick() {}, render: () => ({ kind: "off" }) };
      }
    }

    const application = new App("diagnostic-id");
    expect(application.id).toBe("diagnostic-id");
    expect(Reflect.set(application, "id", "changed")).toBe(false);
    expect(application.id).toBe("diagnostic-id");
    expect(() => new App(" ")).toThrow(/application id.*non-empty/i);
  });

  it("supports object-based handoff and deactivation reasons", () => {
    const reasons: DeactivationReason[] = [];
    class Target extends PhoneApplication {
      createSession(): PhoneApplicationSession {
        return { onKey() {}, tick() {}, render: () => ({ kind: "off" }) };
      }
    }
    const target = new Target("target");
    class SourceApplication extends PhoneApplication {
      createSession(context: ApplicationContext): PhoneApplicationSession {
        return {
          onKey: (event) => {
            if (event.type === "up" && event.key === "navi") context.open(target);
          },
          tick() {},
          render: () => ({ kind: "off" }),
          onDeactivate: (reason) => reasons.push(reason),
        };
      }
    }
    const opened: PhoneApplication[] = [];
    const source = new SourceApplication("source");
    const session = source.createSession({
      exit() {},
      open: (application) => opened.push(application),
    });

    press(session, "navi");
    session.onDeactivate?.("replace");

    expect(opened).toEqual([target]);
    expect(reasons).toEqual(["replace"]);
  });
});
