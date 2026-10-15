import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { paintWidget } from "../src/display/widgets";
import { noteTimelineId, NOTE_STYLES, optionListNumbering, SCREENS } from "../src/firmware/stock";
import type {
  StockLeafScreen,
  StockResult,
  StockScreenSpec,
} from "../src/firmware/generated/stock-tree";
import { createMemorySettings, virginSettings } from "../src/firmware/settings";
import {
  WIDGET_TIMELINE_BY_NAME,
  WIDGET_TIMELINE_BY_NODE,
  WIDGET_TIMELINES,
  type StockWidgetTimeline,
} from "../src/resources";
import { confirmQuery } from "../src/widgets/confirm";
import type { Flow, Widget } from "../src/widgets/flow";
import { note, type NoteEnd } from "../src/widgets/note";
import { settingOptionList } from "../src/widgets/option-list";
import { progress } from "../src/widgets/progress";
import { expectLcd } from "./support/golden.ts";
import { expectFlowTimeline, flowRig, recordFlow } from "./support/flow-rig.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";
import { indicatorOf, INDEX, optionNode, treePath } from "./support/tree.ts";

function timelineOf(number: string, lines: readonly string[]): StockWidgetTimeline {
  const id = noteTimelineId(WIDGET_TIMELINE_BY_NODE, number, lines);
  const found = id === undefined ? undefined : WIDGET_TIMELINES[id];
  if (found === undefined) throw new Error(`No widget timeline for ${number}.`);
  return found;
}

function named(name: string): StockWidgetTimeline {
  return WIDGET_TIMELINES[WIDGET_TIMELINE_BY_NAME[name]!]!;
}

/** Game menus' Top score returns to its game menu with New game selected (P12). */
function endOf(screen: StockLeafScreen): NoteEnd {
  if (screen.lines[0] === "Top score:") return { select: "new-game" };
  return screen.after === "standby" ? "standby" : "back";
}

/** The widget a leaf screen or result opens, bound as Task 12 will bind it. */
function widgetFor(number: string, screen: StockLeafScreen): Widget {
  switch (screen.kind) {
    case "timed-note":
    case "static-note":
      return note({
        lines: screen.lines,
        timeline: timelineOf(number, screen.lines),
        end: endOf(screen),
      });
    case "progress-note":
      return progress({
        text: screen.lines[0]!,
        softkey: screen.softkey!,
        timeline: timelineOf(number, screen.lines),
      });
    case "confirm-query":
      return confirmQuery({ lines: screen.lines, softkey: screen.softkey!, confirm: () => {} });
    default:
      throw new Error(`${number}: ${screen.kind} is not a Task 10 widget.`);
  }
}

const NOTE_KINDS = new Set(["timed-note", "static-note", "progress-note", "confirm-query"]);

function isNoteScreen(
  screen: StockScreenSpec | StockResult | undefined,
): screen is StockLeafScreen {
  return screen !== undefined && "lines" in screen && NOTE_KINDS.has(screen.kind);
}

/** The golden's last row is the screen the flow returns to, unless it never ends (P7). */
function returns(screen: StockLeafScreen): boolean {
  return screen.kind !== "progress-note" && screen.kind !== "confirm-query";
}

function goldenSpan(id: string): number {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const last = rows[rows.length - 1]!;
  return last.startMs + last.durationMs - rows[golden.triggerFrame as number]!.startMs + 50;
}

const asserted = (suffix: string) =>
  INDEX.filter((e) => e.status === "asserted" && e.id.endsWith(suffix) && e.covers);

describe("notes and progress notes against every asserted .leaf golden that opens one", () => {
  // A leaf a feature binds is its feature's screen (plan 17: Activate's note ends in standby with
  // the profile's line, the kernel's), driven by its plan's scenarios instead.
  const cases = asserted(".leaf").flatMap((entry) => {
    const number = entry.covers![0]!;
    if (SCREENS[number] !== undefined) return [];
    const screen = treePath(number).at(-1)!.opens;
    return isNoteScreen(screen) ? [{ id: entry.id, number, screen }] : [];
  });

  it("covers the information, error, tick, long, Top score and progress notes", () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });

  for (const { id, number, screen } of cases) {
    it(id, () => {
      const rig = flowRig(() => widgetFor(number, screen), indicatorOf(number));
      const recording = recordFlow(rig, goldenSpan(id));
      expectFlowTimeline(recording, loadGolden(id), { returns: returns(screen) });
      if (!returns(screen)) return;
      const end = endOf(screen);
      expect(rig.exits.map((exit) => exit.options)).toEqual([
        end === "back" ? undefined : end === "standby" ? { to: "standby" } : end,
      ]);
    });
  }
});

describe("option choices against every asserted .choose golden whose result is a Task 10 widget", () => {
  const cases = asserted(".choose").flatMap((entry) => {
    const number = entry.covers![0]!;
    const list = number.split("-").slice(0, -1).join("-");
    const index = Number(number.split("-").at(-1)) - 1;
    const opens = treePath(list).at(-1)!.opens;
    if (opens.kind !== "option-list" || opens.multi) return [];
    const result = opens.options[index]!.result;
    return isNoteScreen(result) ? [{ id: entry.id, number, list, index, result }] : [];
  });

  it("covers the Done, erased, selected, progress and confirm results", () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });

  for (const { id, number, list, index, result } of cases) {
    it(id, () => {
      const settings = createMemorySettings(virginSettings());
      const { spec, key } = optionNode(list);
      const golden = loadGolden(id);
      const rig = flowRig(
        () =>
          settingOptionList({
            key,
            labels: spec.options.map((option) => option.label),
            softkey: spec.softkey,
            settings,
            numbering: optionListNumbering(list),
            result: () => widgetFor(number, result),
          }),
        indicatorOf(list),
      );
      // ▼ to the option: from the opening value, or from the unset state (P10).
      const opening = settings.choice(key);
      const count = spec.options.length;
      const downs = opening === null ? index + 1 : (index - opening + count) % count;
      for (let i = 0; i < downs; i++) rig.press("down");
      const before = golden.timeline![(golden.triggerFrame as number) - 1]!;
      expectLcd({ pixels: rig.frame() }, goldenImage(id, before.image), `${list} ▼×${downs}`);
      rig.press("navi");
      const recording = recordFlow(rig, goldenSpan(id));
      expectFlowTimeline(recording, golden, { returns: returns(result) });
      expect(settings.choice(key)).toBe(index);
    });
  }
});

describe("probe timelines", () => {
  it("probe/progress-7-6-quit: Quit after 10 s shows Request not confirmed, then standby (P7)", () => {
    const id = "probe/progress-7-6-quit";
    const golden = loadGolden(id);
    const rows = golden.timeline!;
    const rig = flowRig(
      () =>
        progress({
          text: "Requesting",
          softkey: "Quit",
          timeline: WIDGET_TIMELINES["7-6"]!,
          quit: (flow) =>
            flow.replace(
              note({
                lines: ["Request", "not", "confirmed"],
                timeline: named("request-not-confirmed"),
                end: "standby",
              }),
            ),
        }),
      indicatorOf("7-6"),
    );
    // The bar loops through every row up to the key (row 40, 62 ms short of a step).
    const quitRow = rows.findIndex((row) => row.image === "l");
    const origin = rows[1]!.startMs;
    const bar = recordFlow(rig, rows[quitRow]!.startMs - origin);
    expectFlowTimeline(bar, { ...golden, timeline: rows.slice(0, quitRow) }, { returns: false });
    rig.press("navi");
    const after = recordFlow(rig, 4000);
    expectFlowTimeline(
      after,
      { ...golden, timeline: rows.slice(quitRow - 1), triggerFrame: 1 },
      { returns: true },
    );
    expect(rig.exits.map((exit) => exit.options)).toEqual([{ to: "standby" }]);
  });

  it("probe/confirm-5-2-5-ok: OK on the Level 5 query shows Done, then the page (P8)", () => {
    const id = "probe/confirm-5-2-5-ok";
    const golden = loadGolden(id);
    const settings = createMemorySettings(virginSettings());
    const { spec, key } = optionNode("5-2");
    const query = spec.options[4]!.result as StockLeafScreen;
    // Level 5's choice is stored only once the query is confirmed (bound in Task 12).
    const rig = flowRig(
      () =>
        confirmQuery({
          lines: query.lines,
          softkey: query.softkey!,
          confirm: (flow) => {
            settings.choose(key, 4);
            flow.replace(note({ lines: ["Done"], timeline: named("level-5-done") }));
          },
        }),
      indicatorOf("5-2"),
    );
    const rows = golden.timeline!;
    const queryRow = rows.findIndex((row, i) => i > 0 && row.image !== rows[0]!.image);
    expectLcd({ pixels: rig.frame() }, goldenImage(id, rows[queryRow]!.image), "the query");
    rig.press("navi");
    const recording = recordFlow(rig, 3000);
    expectFlowTimeline(
      recording,
      { ...golden, timeline: rows.slice(queryRow), triggerFrame: 1 },
      { returns: true },
    );
    expect(settings.choice(key)).toBe(4);
  });
});

describe("note behaviour", () => {
  const done = () => note({ lines: ["Done"], timeline: WIDGET_TIMELINES[NOTE_STYLES.Done!]! });

  it("C dismisses a note at once and the flow goes back (P6)", () => {
    const rig = flowRig(done);
    rig.advance(300);
    rig.press("c");
    expect(rig.exits).toEqual([{ atMs: 300, options: undefined }]);
  });

  it("▼ dismisses a note and selects the next entry in the level returned to (P6)", () => {
    const rig = flowRig(() =>
      note({
        lines: ["Done"],
        timeline: WIDGET_TIMELINES[NOTE_STYLES.Done!]!,
        moves: { up: "speed-dials", down: "memory-status" },
      }),
    );
    rig.advance(300);
    rig.press("down");
    expect(rig.exits.map((exit) => exit.options)).toEqual([{ select: "memory-status" }]);
  });

  it("▲/▼ without neighbours only dismiss", () => {
    const rig = flowRig(done);
    rig.press("up");
    expect(rig.exits.map((exit) => exit.options)).toEqual([undefined]);
  });

  it("Top score returns by itself, or at once on a key, with New game selected (P12)", () => {
    const topScore = () =>
      note({
        lines: ["Top score:", "45"],
        timeline: WIDGET_TIMELINES["8-1-4"]!,
        end: { select: "new-game" },
      });
    const waited = flowRig(topScore);
    waited.advance(10_000);
    expect(waited.exits).toEqual([
      { atMs: WIDGET_TIMELINES["8-1-4"]!.timeline.durationMs, options: { select: "new-game" } },
    ]);
    const keyed = flowRig(topScore);
    keyed.advance(2000);
    keyed.press("c");
    expect(keyed.exits).toEqual([{ atMs: 2000, options: { select: "new-game" } }]);
  });

  it("a note ending at standby leaves the menus (6-2-4-1, D8 edges step)", () => {
    const rig = flowRig(() =>
      note({ lines: ["Done"], timeline: WIDGET_TIMELINES["6-2-4-1"]!, end: "standby" }),
    );
    rig.advance(5000);
    expect(rig.exits.map((exit) => exit.options)).toEqual([{ to: "standby" }]);
  });

  it("a static note stays until a key, then goes back", () => {
    const rig = flowRig(() => note({ lines: ["Top score:", "45"] }));
    rig.advance(60_000);
    expect(rig.exits).toEqual([]);
    const fb = new Framebuffer();
    paintWidget(fb, { kind: "note", lines: ["Top score:", "45"] });
    expect(rig.frame()).toEqual(fb.pixels);
    rig.press("navi");
    expect(rig.exits.map((exit) => exit.options)).toEqual([undefined]);
  });

  it("looks up a node's own timeline before its note style", () => {
    expect(noteTimelineId(WIDGET_TIMELINE_BY_NODE, "1-8-1-1", ["Done"])).toBe("1-8-1-1");
    expect(noteTimelineId(WIDGET_TIMELINE_BY_NODE, "1-8-1-2", ["Done"])).toBe(NOTE_STYLES.Done);
    expect(noteTimelineId(WIDGET_TIMELINE_BY_NODE, "5-9-3-4", ["Timeout", "selected"])).toBe(
      NOTE_STYLES["Timeout selected"],
    );
    expect(noteTimelineId(WIDGET_TIMELINE_BY_NODE, "6-2-1-3", ["Есть!"])).toBeUndefined();
  });

  it("every note style names a generated timeline", () => {
    for (const id of Object.values(NOTE_STYLES)) expect(WIDGET_TIMELINES[id]).toBeDefined();
  });
});

describe("progress note and confirm query behaviour", () => {
  const searching = (quit?: (flow: Flow) => void) => () =>
    progress({
      text: "Searching",
      softkey: "Quit",
      timeline: WIDGET_TIMELINES["6-2-4-2"]!,
      ...(quit === undefined ? {} : { quit }),
    });

  it("loops the bar until a key; C goes back at once (P7)", () => {
    const rig = flowRig(searching());
    rig.advance(30_000);
    expect(rig.exits).toEqual([]);
    rig.press("c");
    expect(rig.exits.map((exit) => exit.options)).toEqual([undefined]);
  });

  it("Quit runs the bound quit; other keys are inert", () => {
    const quits: string[] = [];
    const rig = flowRig(searching(() => quits.push("quit")));
    for (const key of ["up", "down", "1", "#"] as const) rig.press(key);
    expect(quits).toEqual([]);
    rig.press("navi");
    expect(quits).toEqual(["quit"]);
  });

  it("a confirm query: C goes back unchanged, the soft key runs its result (P8)", () => {
    const confirmed: string[] = [];
    const query = () =>
      confirmQuery({
        lines: ["Replace old ID?"],
        softkey: "OK",
        confirm: () => confirmed.push("ok"),
      });
    const cancelled = flowRig(query);
    cancelled.press("c");
    expect(cancelled.exits.map((exit) => exit.options)).toEqual([undefined]);
    expect(confirmed).toEqual([]);
    const accepted = flowRig(query);
    accepted.press("down");
    accepted.press("navi");
    expect(confirmed).toEqual(["ok"]);
    expect(accepted.exits).toEqual([]);
  });

  it("paints each confirm query's first image (P8, P14)", () => {
    const queries: [string, string, readonly string[], string][] = [
      ["probe/confirm-5-2-5-c", "b", ["Select maximum", "volume for", "ringing tone?"], "OK"],
      ["probe/confirm-8-6-4-c", "b", ["Replace old ID?"], "OK"],
      ["probe/confirm-10-3-2-yes", "b", ["Are you", "sure?"], "Yes"],
    ];
    for (const [id, image, lines, softkey] of queries) {
      const fb = new Framebuffer();
      paintWidget(fb, { kind: "confirm", lines, softkey });
      expectLcd(fb, goldenImage(id, image), lines.join(" / "));
    }
  });
});
