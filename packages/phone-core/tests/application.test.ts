import { describe, expect, it } from "vite-plus/test";
import { EditorApplication, PhoneApplication } from "../src/index";
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

const inertContext: ApplicationContext = {
  exit() {},
  open() {},
};

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
    const target = new EditorApplication("target", { title: "Target" });
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

describe("EditorApplication", () => {
  it("creates fresh independent sessions for every launch", () => {
    const application = new EditorApplication("editor", { title: "Message:" });
    const first = application.createSession(inertContext);
    const second = application.createSession(inertContext);

    press(first, "4");
    press(first, "4");

    expect(first).not.toBe(second);
    expect(first.render()).toMatchObject({ kind: "editor", text: "H" });
    expect(second.render()).toEqual({
      kind: "editor",
      title: "Message:",
      text: "",
      cursor: 0,
      mode: "Abc",
    });
  });

  it("preserves multi-tap, options, limits, and object-based menu context", () => {
    const opened: PhoneApplication[] = [];
    const target = new EditorApplication("target", { title: "Target" });
    const calls: { id: string; text: string }[] = [];
    const application = new EditorApplication("editor", {
      title: "Message:",
      charLimit: 2,
      menu: [
        { id: "send", label: "Send" },
        { id: "clear", label: "Clear text" },
      ],
      onMenu(id, text, context) {
        calls.push({ id, text });
        context.open(target);
      },
    });
    const session = application.createSession({ exit() {}, open: (next) => opened.push(next) });

    press(session, "4");
    press(session, "4");
    press(session, "0");
    press(session, "8"); // blocked by charLimit
    expect(session.render()).toMatchObject({ kind: "editor", text: "H ", limit: 2 });
    press(session, "navi");
    expect(session.render()).toMatchObject({ kind: "list", title: "Options", selected: 0 });
    press(session, "navi");

    expect(calls).toEqual([{ id: "send", text: "H " }]);
    expect(opened).toEqual([target]);
  });

  it("keeps each definition immutable without freezing injected callback dependencies", () => {
    const dependency = { accepted: [] as string[] };
    const application = new EditorApplication("editor", {
      title: "Editor",
      onAccept: (text) => dependency.accepted.push(text),
    });

    expect(Object.isFrozen(application)).toBe(true);
    expect(Object.isFrozen(dependency)).toBe(false);
  });
});
