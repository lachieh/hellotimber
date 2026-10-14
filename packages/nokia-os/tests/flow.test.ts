import type {
  ApplicationContext,
  MenuIndicator,
  PhoneApplicationSession,
  PhoneKey,
  ScreenModel,
} from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { paintWidget, type WidgetModel } from "../src/display/widgets";
import { StockFlowApplication, type Flow, type Widget } from "../src/widgets/flow";

type ExitOptions = Parameters<ApplicationContext["exit"]>[0];

/** A context that records exits; `indicator` is what the kernel reports for the flow. */
function fakeContext(indicator?: MenuIndicator): ApplicationContext & { exits: ExitOptions[] } {
  const exits: ExitOptions[] = [];
  return {
    exits,
    exit: (options) => exits.push(options),
    open: () => {
      throw new Error("flows do not open applications");
    },
    ...(indicator === undefined ? {} : { menuIndicator: () => indicator }),
  };
}

/** A widget showing `label` as a one-row option list; it logs keys and ticks. */
class Probe implements Widget {
  readonly keys: PhoneKey[] = [];
  elapsed = 0;
  label: string;
  onKeyAction?: (key: PhoneKey, flow: Flow) => void;

  constructor(label: string) {
    this.label = label;
  }

  render(flow: Flow): WidgetModel {
    return {
      kind: "options",
      items: [this.label],
      selected: 0,
      windowTop: 0,
      indicator: flow.indicator(),
      softkey: "OK",
    };
  }

  onKey(key: PhoneKey, flow: Flow): void {
    this.keys.push(key);
    this.onKeyAction?.(key, flow);
  }

  tick(dtMs: number): void {
    this.elapsed += dtMs;
  }
}

function press(session: PhoneApplicationSession, key: PhoneKey): void {
  session.onKey({ type: "down", key });
  session.onKey({ type: "up", key });
}

function custom(screen: ScreenModel): Extract<ScreenModel, { kind: "custom" }> {
  if (screen.kind !== "custom") throw new Error(`Expected a custom screen, got ${screen.kind}.`);
  return screen;
}

function start(root: () => Widget, indicator?: MenuIndicator) {
  const context = fakeContext(indicator);
  const session = new StockFlowApplication("stock:test", root).createSession(context);
  return { context, session };
}

describe("StockFlowApplication", () => {
  it("renders the top widget as a custom frame painted by paintWidget", () => {
    const { session } = start(() => new Probe("Name list"), {
      segments: [1, 8],
      awaitingNext: false,
    });
    const screen = custom(session.render());
    expect(screen.appId).toBe("stock:test");
    const expected = new Framebuffer();
    paintWidget(expected, {
      kind: "options",
      items: ["Name list"],
      selected: 0,
      windowTop: 0,
      indicator: { segments: [1, 8], awaitingNext: false },
      softkey: "OK",
    });
    expect(screen.frame.pixels).toEqual(expected.pixels);
  });

  it("reuses the frame while the model is unchanged and repaints when it changes", () => {
    const probe = new Probe("Name list");
    const { session } = start(() => probe);
    const first = session.render();
    session.tick(10);
    expect(session.render()).toBe(first);
    probe.label = "Large font";
    const second = session.render();
    expect(second).not.toBe(first);
    expect(custom(second).frame.pixels).not.toEqual(custom(first).frame.pixels);
  });

  it("falls back to an empty indicator when the context reports none", () => {
    const probe = new Probe("Name list");
    let seen: MenuIndicator | undefined;
    probe.render = (flow) => {
      seen = flow.indicator();
      return Probe.prototype.render.call(probe, flow);
    };
    start(() => probe).session.render();
    expect(seen).toEqual({ segments: [], awaitingNext: false });
  });

  it("acts on key releases only, and ticks only the top widget", () => {
    const root = new Probe("root");
    const top = new Probe("top");
    root.onKeyAction = (_key, flow) => flow.push(top);
    const { session } = start(() => root);
    session.onKey({ type: "down", key: "navi" });
    expect(root.keys).toEqual([]);
    session.onKey({ type: "up", key: "navi" });
    expect(root.keys).toEqual(["navi"]);
    session.tick(25);
    expect([root.elapsed, top.elapsed]).toEqual([0, 25]);
    press(session, "down");
    expect(top.keys).toEqual(["down"]);
    expect(root.keys).toEqual(["navi"]);
  });

  it("push and back return to the widget below; back on the last widget exits", () => {
    const root = new Probe("root");
    const child = new Probe("child");
    root.onKeyAction = (key, flow) => {
      if (key === "navi") flow.push(child);
      if (key === "c") flow.back();
    };
    child.onKeyAction = (_key, flow) => flow.back();
    const { context, session } = start(() => root);
    press(session, "navi");
    expect(custom(session.render())).toBeDefined();
    press(session, "c"); // child goes back
    expect(context.exits).toEqual([]);
    press(session, "c"); // root goes back: the flow exits
    expect(context.exits).toEqual([undefined]);
  });

  it("replace swaps the top widget, so its back skips the replaced one", () => {
    const root = new Probe("list");
    const note = new Probe("note");
    root.onKeyAction = (_key, flow) => flow.replace(note);
    note.onKeyAction = (_key, flow) => flow.back();
    const { context, session } = start(() => root);
    press(session, "navi");
    press(session, "c");
    expect(context.exits).toEqual([undefined]);
  });

  it("back(levels) past the flow closes enclosing menu levels too", () => {
    const root = new Probe("Set delay");
    root.onKeyAction = (_key, flow) => flow.back(2);
    const { context, session } = start(() => root);
    press(session, "navi");
    expect(context.exits).toEqual([{ levels: 2 }]);
  });

  it("back(levels) within the flow pops that many widgets", () => {
    const pages = new Probe("pages");
    const list = new Probe("list");
    const note = new Probe("note");
    pages.onKeyAction = (_key, flow) => flow.push(list);
    list.onKeyAction = (_key, flow) => flow.push(note);
    note.onKeyAction = (_key, flow) => flow.back(2);
    const { context, session } = start(() => pages);
    press(session, "navi");
    press(session, "navi");
    press(session, "navi");
    expect(context.exits).toEqual([]);
    expect(custom(session.render()).frame.pixels).toEqual(
      custom(start(() => new Probe("pages")).session.render()).frame.pixels,
    );
  });

  it("standby() exits straight to standby", () => {
    const root = new Probe("note");
    root.onKeyAction = (_key, flow) => flow.standby();
    const { context, session } = start(() => root);
    press(session, "c");
    expect(context.exits).toEqual([{ to: "standby" }]);
  });

  it("ignores keys and ticks once it has exited or been deactivated", () => {
    const root = new Probe("root");
    root.onKeyAction = (_key, flow) => flow.back();
    const { context, session } = start(() => root);
    press(session, "c");
    press(session, "c");
    session.tick(5);
    expect(context.exits).toHaveLength(1);
    expect(root.elapsed).toBe(0);

    const other = new Probe("other");
    const second = start(() => other);
    second.session.onDeactivate?.("navigate");
    press(second.session, "c");
    expect(other.keys).toEqual([]);
  });

  it("builds a fresh root widget for every session", () => {
    const made: Probe[] = [];
    const app = new StockFlowApplication("stock:test", () => {
      const probe = new Probe("root");
      made.push(probe);
      return probe;
    });
    app.createSession(fakeContext());
    app.createSession(fakeContext());
    expect(made).toHaveLength(2);
    expect(made[0]).not.toBe(made[1]);
  });
});
