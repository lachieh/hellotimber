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
import { optionListNumbering } from "../src/firmware/stock";
import { createMemorySettings, virginSettings, type StockSettings } from "../src/firmware/settings";
import { StockFlowApplication, type Flow, type Widget } from "../src/widgets/flow";
import { multiSelect } from "../src/widgets/multi-select";
import { OptionListWidget, settingOptionList } from "../src/widgets/option-list";
import { expectLcd } from "./support/golden.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";
import { indicatorOf, INDEX, optionNode, treePath } from "./support/tree.ts";

type ExitOptions = Parameters<ApplicationContext["exit"]>[0];

function paint(model: WidgetModel): Framebuffer {
  const fb = new Framebuffer();
  paintWidget(fb, model);
  return fb;
}

interface Driven {
  readonly session: PhoneApplicationSession;
  readonly exits: ExitOptions[];
  press(key: PhoneKey): void;
  frame(): Uint8Array;
}

function drive(root: () => Widget, indicator: MenuIndicator): Driven {
  const exits: ExitOptions[] = [];
  const context: ApplicationContext = {
    exit: (options) => exits.push(options),
    open: () => {},
    menuIndicator: () => indicator,
  };
  const session = new StockFlowApplication("stock:test", root).createSession(context);
  return {
    session,
    exits,
    press(key) {
      session.onKey({ type: "down", key });
      session.onKey({ type: "up", key });
    },
    frame() {
      const screen: ScreenModel = session.render();
      if (screen.kind !== "custom") throw new Error(`Expected custom, got ${screen.kind}.`);
      return screen.frame.pixels;
    },
  };
}

/** A widget that shows a fixed model; stands in for the note a choice opens. */
class Marker implements Widget {
  constructor(readonly label: string) {}
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
}

function virgin(): StockSettings {
  return createMemorySettings(virginSettings());
}

function optionList(number: string, settings: StockSettings, result?: (i: number) => Widget) {
  const { spec, key } = optionNode(number);
  return () =>
    settingOptionList({
      key,
      labels: spec.options.map((option) => option.label),
      softkey: spec.softkey,
      settings,
      numbering: optionListNumbering(number),
      ...(result === undefined ? {} : { result }),
    });
}

describe("option list painting (literal models against the goldens)", () => {
  it("tree/02-messages/2-7-1-3.options: opens on Maximum time on the top row, ▼ through the wrap", () => {
    const id = "tree/02-messages/2-7-1-3.options";
    const labels = ["1 hour", "6 hours", "24 hours", "72 hours", "1 week", "Maximum time"];
    // Opens on Maximum time (5) on the top row; ▼ wraps to 1 hour, then scrolls at 6 hours.
    const states = [
      [5, 5],
      [0, 5],
      [1, 5],
      [2, 0],
      [3, 1],
      [4, 2],
    ] as const;
    loadGolden(id).images.forEach((image, i) => {
      const [selected, windowTop] = states[i]!;
      const model: WidgetModel = {
        kind: "options",
        items: labels,
        selected,
        windowTop,
        // Message settings › Set n lists show only the option's number.
        indicator: { segments: [selected + 1], awaitingNext: false },
        softkey: "OK",
      };
      expectLcd(paint(model), { id, image }, `selected ${selected}, window ${windowTop}`);
    });
  });

  it("tree/05-tones/5-2.options: unset (no rows, `5-2-0`, Quit), then ▼ from the first level", () => {
    const id = "tree/05-tones/5-2.options";
    const labels = ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5"];
    loadGolden(id).images.forEach((image, i) => {
      const selected = i === 0 ? null : i - 1;
      const model: WidgetModel = {
        kind: "options",
        items: labels,
        selected,
        windowTop: selected === null ? 0 : Math.max(0, selected - 2),
        indicator: { segments: [5, 2, selected === null ? 0 : selected + 1], awaitingNext: false },
        softkey: selected === null ? "Quit" : "OK",
      };
      expectLcd(paint(model), { id, image }, `selected ${selected}`);
    });
  });

  it("tree/02-messages/2-8-5.options: multi-select marks, band from x 8, Mark/Unmark", () => {
    const id = "tree/02-messages/2-8-5.options";
    const { spec } = optionNode("2-8-5");
    const labels = spec.options.map((option) => option.label);
    const marks = spec.options.map((option) => option.marked === true);
    loadGolden(id).images.forEach((image, i) => {
      const selected = i;
      const model: WidgetModel = {
        kind: "multi",
        items: labels,
        marks,
        selected,
        windowTop: Math.max(0, selected - 2),
        indicator: { segments: [2, 8, 5, selected + 1], awaitingNext: false },
        softkey: marks[selected] ? "Unmark" : "Mark",
      };
      expectLcd(paint(model), { id, image }, `selected ${selected}`);
    });
  });
});

/** The tree node a `.options`/`.open` golden shows. */
function goldenNumber(id: string): string {
  return /\/([\d-]+)\.(?:options|open)$/.exec(id)![1]!;
}

describe("option list widgets driven against every asserted option-list .options and .open golden", () => {
  const ids = INDEX.filter((e) => e.status === "asserted" && /\.(options|open)$/.test(e.id))
    .map((e) => e.id)
    .filter((id) => treePath(goldenNumber(id)).at(-1)!.opens.kind === "option-list");

  it("covers the single-choice, unset and multi-select goldens", () => {
    expect(ids.filter((id) => id.endsWith(".options")).length).toBeGreaterThanOrEqual(25);
    expect(ids.filter((id) => id.endsWith(".open")).length).toBeGreaterThanOrEqual(25);
  });

  for (const id of ids) {
    it(id, () => {
      const number = goldenNumber(id);
      const { spec, key } = optionNode(number);
      const settings = virgin();
      const root = spec.multi
        ? () =>
            multiSelect({
              key,
              labels: spec.options.map((o) => o.label),
              opening: spec.opening ?? 0,
              settings,
            })
        : optionList(number, settings);
      const flow = drive(root, indicatorOf(number));
      loadGolden(id).images.forEach((image, i) => {
        if (i > 0) flow.press("down");
        expectLcd({ pixels: flow.frame() }, { id, image }, `${number} opened, ▼×${i}`);
      });
    });
  }
});

/** A flow that records what a widget asks of it; `shown` is the widget on top. */
function stubFlow(root: Widget, indicator: MenuIndicator) {
  const stack: Widget[] = [root];
  const exits: ExitOptions[] = [];
  const flow: Flow = {
    push: (widget) => void stack.push(widget),
    replace: (widget) => void stack.splice(stack.length - 1, 1, widget),
    back(levels = 1) {
      stack.length = Math.max(0, stack.length - levels);
      if (stack.length === 0) exits.push(undefined);
    },
    standby: () => void exits.push({ to: "standby" }),
    indicator: () => indicator,
  };
  return {
    exits,
    get shown() {
      return stack.at(-1);
    },
    press(key: PhoneKey) {
      stack.at(-1)!.onKey?.(key, flow);
    },
    /** The top widget's model, which must be a list. */
    model() {
      const model = stack.at(-1)!.render(flow);
      if (model.kind !== "options" && model.kind !== "multi") {
        throw new Error(`Expected a list, got ${model.kind}.`);
      }
      return model;
    },
    rendered: () => stack.at(-1)!.render(flow),
  };
}

function listFlow(number: string, settings: StockSettings, result?: (i: number) => Widget) {
  return stubFlow(optionList(number, settings, result)(), indicatorOf(number));
}

describe("option list behaviour", () => {
  it("opens on the stored choice, with the window at it when there are more than 3 options", () => {
    const settings = virgin();
    settings.choose(optionNode("2-7-1-3").key, 2);
    const flow = listFlow("2-7-1-3", settings);
    expect(flow.model()).toMatchObject({ selected: 2, windowTop: 2, softkey: "OK" });
    expect(flow.model().indicator).toEqual({ segments: [3], awaitingNext: false });
  });

  it("opens on the stored choice with the window at 0 when there are 3 options or fewer", () => {
    expect(listFlow("1-8-1", virgin()).model()).toMatchObject({ selected: 2, windowTop: 0 });
  });

  it("OK writes the store and replaces the list with the option's result", () => {
    const settings = virgin();
    const marker = new Marker("chose 0");
    const flow = listFlow("1-8-1", settings, () => marker);
    flow.press("down"); // wraps from Large font to Name list
    flow.press("navi");
    expect(settings.choice(optionNode("1-8-1").key)).toBe(0);
    expect(flow.shown).toBe(marker);
    expect(flow.exits).toEqual([]);
  });

  it("OK without a result widget writes the store and goes back", () => {
    const settings = virgin();
    const flow = listFlow("1-8-1", settings);
    flow.press("up");
    flow.press("navi");
    expect(settings.choice(optionNode("1-8-1").key)).toBe(1);
    expect(flow.exits).toEqual([undefined]);
  });

  it("C goes back without writing", () => {
    const settings = virgin();
    const flow = listFlow("1-8-1", settings);
    flow.press("down");
    flow.press("c");
    expect(settings.choice(optionNode("1-8-1").key)).toBe(2);
    expect(flow.exits).toEqual([undefined]);
  });

  it("unset: no selection, `-0` and Quit; the first ▼ selects the first option, window 0 (P10)", () => {
    const flow = listFlow("5-2", virgin());
    expect(flow.model()).toMatchObject({ selected: null, softkey: "Quit" });
    expect(flow.model().indicator.segments).toEqual([5, 2, 0]);
    flow.press("down");
    expect(flow.model()).toMatchObject({ selected: 0, windowTop: 0, softkey: "OK" });
  });

  it("unset: the first ▲ selects the last option on the top row (P10, `Level 5 / Level 1 / Level 2`)", () => {
    const flow = listFlow("5-2", virgin());
    flow.press("up");
    expect(flow.model()).toMatchObject({ selected: 4, windowTop: 4 });
  });

  it("unset: Quit goes back and the setting stays unset (P10)", () => {
    const settings = virgin();
    const flow = listFlow("5-2", settings);
    flow.press("navi");
    expect(flow.exits).toEqual([undefined]);
    expect(settings.choice(optionNode("5-2").key)).toBeNull();
  });

  it("keeps the window while the selection stays inside it and wraps circularly (D3)", () => {
    const flow = listFlow("2-7-1-3", virgin());
    // Opens on Maximum time (5) with the window at 5: rows 5, 0, 1.
    flow.press("down");
    flow.press("down");
    expect(flow.model()).toMatchObject({ selected: 1, windowTop: 5 });
    flow.press("up");
    flow.press("up");
    expect(flow.model()).toMatchObject({ selected: 5, windowTop: 5 });
    flow.press("up");
    expect(flow.model()).toMatchObject({ selected: 4, windowTop: 4 });
  });

  it("numbers its indicator per list: path, parent level or option only", () => {
    expect(listFlow("1-8-1", virgin()).model().indicator.segments).toEqual([1, 8, 1, 3]);
    expect(listFlow("7-3-4", virgin()).model().indicator.segments).toEqual([7, 3, 0]);
    expect(listFlow("2-7-1-3", virgin()).model().indicator.segments).toEqual([6]);
  });

  it("shows the awaiting indicator as the kernel reports it, without a selection number", () => {
    const typed: MenuIndicator = { segments: [1, 8, 1], awaitingNext: true, typed: "" };
    const flow = stubFlow(optionList("1-8-1", virgin())(), typed);
    expect(flow.model().indicator).toEqual(typed);
  });

  it("reports each ▲/▼ move to `highlight` with the previous selection, never the opening (plan 16)", () => {
    const seen: [number, number | null][] = [];
    const list = (opening: number | null) =>
      stubFlow(
        new OptionListWidget({
          labels: ["Ring ring", "Low", "Mosquito"],
          opening,
          softkey: "OK",
          choose: () => {},
          highlight: (index, previous) => void seen.push([index, previous]),
        }),
        { segments: [5, 1], awaitingNext: false },
      );
    const set = list(1);
    set.model();
    set.press("navi");
    set.press("c");
    expect(seen).toEqual([]);
    const flow = list(1);
    flow.press("down");
    flow.press("up");
    flow.press("1");
    expect(seen).toEqual([
      [2, 1],
      [1, 2],
    ]);
    seen.length = 0;
    list(null).press("down");
    expect(seen).toEqual([[0, null]]);
  });

  it("tells the option list's close hook when the list leaves the flow", () => {
    let closes = 0;
    const widget = new OptionListWidget({
      labels: ["On", "Off"],
      opening: 0,
      softkey: "OK",
      choose: () => {},
      close: () => void closes++,
    });
    widget.close?.();
    expect(closes).toBe(1);
  });

  it("ignores the other keys", () => {
    const settings = virgin();
    const flow = listFlow("1-8-1", settings);
    for (const key of ["1", "#", "*", "0"] as const) flow.press(key);
    expect(flow.model()).toMatchObject({ selected: 2 });
    expect(flow.exits).toEqual([]);
  });
});

describe("multi-select widget", () => {
  function language(settings: StockSettings) {
    const { spec, key } = optionNode("2-8-5");
    const widget = multiSelect({
      key,
      labels: spec.options.map((o) => o.label),
      opening: spec.opening ?? 0,
      settings,
    });
    return { key, flow: stubFlow(widget, indicatorOf("2-8-5")) };
  }

  it("shows the stored marks and toggles the selected row with the soft key (P14)", () => {
    const settings = virgin();
    const { key, flow } = language(settings);
    const stored = settings.marks(key);
    expect(flow.model()).toMatchObject({ kind: "multi", selected: 0, softkey: "Unmark" });
    expect(flow.model().kind === "multi" && flow.model()).toMatchObject({ marks: stored });
    flow.press("navi");
    expect(flow.model()).toMatchObject({ softkey: "Mark" });
    flow.press("down");
    flow.press("down");
    expect(flow.model()).toMatchObject({ selected: 2, softkey: "Mark" });
    flow.press("navi");
    expect(flow.model()).toMatchObject({ softkey: "Unmark" });
    // Nothing is stored until the change is saved.
    expect(settings.marks(key)).toEqual(stored);
  });

  it("C without a change leaves", () => {
    const { flow } = language(virgin());
    flow.press("navi");
    flow.press("navi");
    flow.press("c");
    expect(flow.exits).toEqual([undefined]);
  });

  it("C after a change asks `Save changes?`; Yes stores the marks and leaves (P14)", () => {
    const settings = virgin();
    const { key, flow } = language(settings);
    const stored = settings.marks(key);
    flow.press("navi");
    flow.press("down");
    flow.press("down");
    flow.press("navi");
    flow.press("c");
    expect(flow.exits).toEqual([]);
    expect(flow.rendered()).toEqual({
      kind: "confirm",
      lines: ["Save", "changes?"],
      softkey: "Yes",
    });
    expectLcd(paint(flow.rendered()), goldenImage("probe/multiselect", "after-c"), "Save changes?");
    flow.press("navi");
    expect(flow.exits).toEqual([undefined]);
    expect(settings.marks(key)).toEqual(
      stored.map((mark, i) => (i === 0 || i === 2 ? !mark : mark)),
    );
  });

  it("probe/multiselect.rec: soft key, ▼, soft key, C through the flow host (P14)", () => {
    const id = "probe/multiselect.rec";
    const { spec, key } = optionNode("2-8-5");
    const settings = virgin();
    const flow = drive(
      () => multiSelect({ key, labels: spec.options.map((o) => o.label), opening: 0, settings }),
      indicatorOf("2-8-5"),
    );
    const steps: [PhoneKey, string][] = [
      ["navi", "b"],
      ["down", "c"],
      ["navi", "d"],
      ["c", "e"],
    ];
    for (const [pressed, image] of steps) {
      flow.press(pressed);
      expectLcd({ pixels: flow.frame() }, goldenImage(id, image), `then ${pressed}`);
    }
  });

  it("C on `Save changes?` leaves without storing (UNVERIFIED)", () => {
    const settings = virgin();
    const { key, flow } = language(settings);
    const stored = settings.marks(key);
    flow.press("navi");
    flow.press("c");
    flow.press("c");
    expect(flow.exits).toEqual([undefined]);
    expect(settings.marks(key)).toEqual(stored);
  });
});
