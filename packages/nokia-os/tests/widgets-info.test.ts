import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { paintWidget } from "../src/display/widgets";
import { LEVEL_BARS, promptLayout, SCREENS } from "../src/firmware/stock";
import { settingKey, slugOf } from "../src/firmware/tree";
import type { StockLeafScreen, StockPage } from "../src/firmware/generated/stock-tree";
import { createMemorySettings, virginSettings, type StockSettings } from "../src/firmware/settings";
import { WIDGET_TIMELINE_BY_NODE, WIDGET_TIMELINES } from "../src/resources";
import type { Widget } from "../src/widgets/flow";
import { infoPages, type InfoPage } from "../src/widgets/info-pages";
import { infoScreen } from "../src/widgets/info-screen";
import { levelBar, snakeLevel } from "../src/widgets/level-bar";
import { note } from "../src/widgets/note";
import { OptionListWidget } from "../src/widgets/option-list";
import { promptFromLayout, splitPromptLines } from "../src/widgets/prompt";
import { splash, splashIntro } from "../src/widgets/splash";
import { textPages } from "../src/widgets/text-pages";
import { expectLcd, GAME_TICK_TOLERANCE_MS } from "./support/golden.ts";
import { expectFlowTimeline, flowRig, recordFlow } from "./support/flow-rig.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";
import { indicatorOf, INDEX, treePath } from "./support/tree.ts";

const virgin = (): StockSettings => createMemorySettings(virginSettings());

function goldenSpan(id: string): number {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const last = rows[rows.length - 1]!;
  return last.startMs + last.durationMs - rows[golden.triggerFrame as number]!.startMs + 50;
}

/** The screen the golden shows at its trigger: what the widget must draw first. */
function triggerImage(id: string): string {
  const golden = loadGolden(id);
  return golden.timeline![golden.triggerFrame as number]!.image;
}

/** The info-pages node at `number`, its pages bound to the virgin settings' page values. */
function pagesOf(number: string, settings: StockSettings) {
  const path = treePath(number);
  const spec = path.at(-1)!.opens;
  if (spec.kind !== "info-pages") throw new Error(`${number} is not info pages.`);
  const key = settingKey(path);
  const pages: InfoPage[] = spec.pages.map((page) => ({
    label: page.label,
    softkey: page.softkey,
    value: () => settings.text(`${key}/${slugOf(page.label)}`),
  }));
  return { spec, pages };
}

/** What a page's soft key opens, bound as Task 12 will bind it. */
function pageResult(number: string, page: StockPage, settings: StockSettings): Widget | undefined {
  const result = page.result;
  if (result === undefined) return undefined;
  if (result.kind === "timed-note" && "lines" in result) {
    return note({
      lines: result.lines,
      timeline: WIDGET_TIMELINES[WIDGET_TIMELINE_BY_NODE[number]!]!,
    });
  }
  if (result.kind === "code-prompt" && "lines" in result) {
    return promptFromLayout(promptLayout(number, result.kind)!, result);
  }
  if (number === "4-8-1") {
    // P15: Credit info display opens an On/Off list on its page value.
    const list = { labels: ["On", "Off"], softkey: "OK" };
    const value = settings.text("call-register/prepaid-credit/credit-info-display");
    return new OptionListWidget({
      labels: list.labels,
      softkey: list.softkey,
      opening: value === undefined ? null : list.labels.indexOf(value as "On" | "Off"),
      choose: (_index, flow) => flow.back(),
    });
  }
  if (number === "4-8-4") {
    return infoPages({
      pages: [
        { label: "Last recharge:", value: () => "0", softkey: "Back" },
        { label: "Expiry date:", value: () => "0", softkey: "Back" },
      ],
    });
  }
  throw new Error(`${number}: no binding for a ${result.kind} page result.`);
}

const goldensOf = (pattern: RegExp) =>
  INDEX.filter((e) => e.status === "asserted" && pattern.test(e.id));

describe("info pages against every asserted info-pages golden", () => {
  const lists = goldensOf(/\.(options|open)$/).filter(
    (e) => treePath(e.covers![0]!).at(-1)!.opens.kind === "info-pages",
  );

  it("covers Show call duration, Show call costs, Prepaid credit and the Score IDs", () => {
    expect(lists.map((e) => e.covers![0])).toEqual(
      expect.arrayContaining(["4-5", "4-6", "4-8", "8-1-5", "8-2-3", "8-4-1-4", "8-4-2-4"]),
    );
  });

  for (const { id, covers } of lists) {
    it(id, () => {
      const number = covers![0]!;
      const { pages } = pagesOf(number, virgin());
      const rig = flowRig(() => infoPages({ pages }), indicatorOf(number));
      loadGolden(id).images.forEach((image, i) => {
        if (i > 0) rig.press("down");
        expectLcd({ pixels: rig.frame() }, { id, image }, `${number}, ▼×${i}`);
      });
    });
  }

  const chosen = goldensOf(/\.choose$/).filter((e) => {
    const number = e.covers![0]!;
    const list = number.split("-").slice(0, -1).join("-");
    return treePath(list).at(-1)!.opens.kind === "info-pages";
  });

  it("covers every page's soft key: Back, a note, a code prompt, a list, more pages", () => {
    expect(chosen.length).toBeGreaterThanOrEqual(9);
  });

  for (const { id, covers } of chosen) {
    it(id, () => {
      const number = covers![0]!;
      const list = number.split("-").slice(0, -1).join("-");
      const index = Number(number.split("-").at(-1)) - 1;
      const settings = virgin();
      const { spec, pages } = pagesOf(list, settings);
      const page = spec.pages[index]!;
      const rig = flowRig(
        () =>
          infoPages({
            pages,
            open: (i) => pageResult(`${list}-${i + 1}`, spec.pages[i]!, settings),
          }),
        indicatorOf(list),
      );
      for (let i = 0; i < index; i++) rig.press("down");
      rig.press("navi");
      // A `Back` page leaves the flow; any other result is drawn by the flow, and so is the
      // return to the pages after a note.
      expectFlowTimeline(recordFlow(rig, goldenSpan(id)), loadGolden(id), {
        returns: page.result === undefined,
      });
    });
  }

  it("probe/prepaid-credit-info-display: the On/Off list continues the indicator (`4-8-1-2`)", () => {
    const id = "probe/prepaid-credit-info-display";
    const settings = virgin();
    const { spec, pages } = pagesOf("4-8", settings);
    const rig = flowRig(
      () => infoPages({ pages, open: (i) => pageResult(`4-8-${i + 1}`, spec.pages[i]!, settings) }),
      indicatorOf("4-8"),
    );
    loadGolden(id).images.forEach((image, i) => {
      if (i > 0) rig.press(i === 1 ? "navi" : "down");
      expectLcd({ pixels: rig.frame() }, { id, image }, `Prepaid credit, Select, ▼×${i - 1}`);
    });
  });

  it("C goes back from any page; ▲ wraps to the last page", () => {
    const { pages } = pagesOf("4-5", virgin());
    const rig = flowRig(() => infoPages({ pages }), indicatorOf("4-5"));
    rig.press("up");
    const fb = new Framebuffer();
    paintWidget(fb, {
      kind: "info-page",
      label: pages.at(-1)!.label,
      index: pages.length - 1,
      count: pages.length,
      indicator: { segments: [4, 5, pages.length], awaitingNext: false },
      softkey: pages.at(-1)!.softkey,
    });
    expect(rig.frame()).toEqual(fb.pixels);
    rig.press("c");
    expect(rig.exits.map((e) => e.options)).toEqual([undefined]);
  });
});

describe("info screen", () => {
  it("tree/01-phone-book/1-8-2.leaf: Memory status; Back and C go back", () => {
    const id = "tree/01-phone-book/1-8-2.leaf";
    const screen = treePath("1-8-2").at(-1)!.opens as StockLeafScreen;
    const make = () => infoScreen({ lines: () => screen.lines, softkey: screen.softkey! });
    const rig = flowRig(make, indicatorOf("1-8-2"));
    expectFlowTimeline(recordFlow(rig, goldenSpan(id)), loadGolden(id), { returns: false });
    for (const key of ["up", "down", "1"] as const) rig.press(key);
    expect(rig.exits).toEqual([]);
    rig.press("navi");
    expect(rig.exits.map((e) => e.options)).toEqual([undefined]);
    const other = flowRig(make);
    other.press("c");
    expect(other.exits).toHaveLength(1);
  });
});

describe("input prompts against every asserted prompt golden (first screen, cursor blink)", () => {
  const PROMPT_KINDS = new Set(["text-input", "number-input", "code-prompt"]);
  const cases = goldensOf(/\.(leaf|choose)$/).flatMap((entry) => {
    const number = entry.covers![0]!;
    const path = number.split("-");
    const parent = treePath(path.slice(0, -1).join("-") || number).at(-1)!.opens;
    const screen = entry.id.endsWith(".choose")
      ? parent.kind === "option-list"
        ? parent.options[Number(path.at(-1)) - 1]!.result
        : undefined
      : treePath(number).at(-1)!.opens;
    // A prompt a feature implements with no plan 14 layout is that feature's widget (plan 18's
    // number entries, plan 17's Rename), driven by its plan's scenarios.
    if (SCREENS[number] !== undefined && screen !== undefined && "lines" in screen) {
      if (promptLayout(number, screen.kind) === undefined) return [];
    }
    return screen !== undefined && "lines" in screen && PROMPT_KINDS.has(screen.kind)
      ? [{ id: entry.id, number, screen }]
      : [];
  });

  it("covers text, number, time and code prompts", () => {
    expect(cases.length).toBeGreaterThanOrEqual(15);
  });

  for (const { id, number, screen } of cases) {
    it(id, () => {
      const layout = promptLayout(number, screen.kind);
      if (layout === undefined) throw new Error(`${number}: no prompt layout.`);
      const blinkId = WIDGET_TIMELINE_BY_NODE[number];
      const blink = blinkId === undefined ? undefined : WIDGET_TIMELINES[blinkId];
      const rig = flowRig(() => promptFromLayout(layout, screen, blink), indicatorOf(number));
      expectFlowTimeline(recordFlow(rig, goldenSpan(id)), loadGolden(id), { returns: false });
    });
  }

  it("probe/confirm-8-6-4-ok: Club Nokia ID's prompt after its query (P8)", () => {
    const id = "probe/confirm-8-6-4-ok";
    const layout = { icons: ["pen"], entry: "end" } as const;
    for (const [image, blink] of [
      ["c", WIDGET_TIMELINES[WIDGET_TIMELINE_BY_NODE["2-9"]!]!],
      ["d", undefined],
    ] as const) {
      const rig = flowRig(() =>
        promptFromLayout(layout, { lines: ["Club Nokia ID:"], softkey: "OK" }, blink),
      );
      expectLcd({ pixels: rig.frame() }, goldenImage(id, image), `Club Nokia ID, image ${image}`);
    }
  });

  it("C goes back; the soft key, ▲/▼ and digits are inert (D11)", () => {
    const screen = treePath("11-5").at(-1)!.opens as StockLeafScreen;
    const rig = flowRig(() => promptFromLayout(promptLayout("11-5", screen.kind)!, screen));
    const first = rig.frame();
    for (const key of ["navi", "up", "down", "1", "#", "*"] as const) rig.press(key);
    expect(rig.exits).toEqual([]);
    expect(rig.frame()).toEqual(first);
    rig.press("c");
    expect(rig.exits.map((e) => e.options)).toEqual([undefined]);
  });

  it("splits firmware lines into the label and the value", () => {
    expect(splitPromptLines(["Group", "number:"])).toEqual({
      label: ["Group", "number:"],
      value: "",
    });
    expect(splitPromptLines(["Phone number:", "793000333"])).toEqual({
      label: ["Phone number:"],
      value: "793000333",
    });
    expect(splitPromptLines(["Key 2:", "(empty)"]).value).toBe("(empty)");
  });
});

describe("level bars (P12)", () => {
  // Bantumi's and Pairs II's Level pages keep plan 14's static bars until plan 24 measures them.
  for (const number of Object.keys(LEVEL_BARS)) {
    const id = `tree/08-games/${number}.leaf`;
    if (!INDEX.some((e) => e.id === id && e.status === "asserted")) continue;
    it(id, () => {
      const screen = treePath(number).at(-1)!.opens as StockLeafScreen;
      const rig = flowRig(() => levelBar({ bars: LEVEL_BARS[number]!, softkey: screen.softkey! }));
      expectLcd({ pixels: rig.frame() }, goldenImage(id, triggerImage(id)), `${number} Level`);
    });
  }
});

describe("Snake II's Level page (plan 23 D11, C1)", () => {
  const KEY = "games/snake/level";
  /** The page over `settings` (virgin: 175), after `downs` ▼ presses. */
  function page(settings: StockSettings = virgin(), downs = 0) {
    const rig = flowRig(() => snakeLevel({ settings, key: KEY, softkey: "OK" }));
    for (let i = 0; i < downs; i++) rig.press("down");
    return { rig, settings };
  }
  const at = (level: number) => {
    const settings = virgin();
    settings.setNumber(KEY, level);
    return page(settings);
  };

  it("tree/08-games/8-1-2.leaf: the virgin level 175 draws nine bars", () => {
    const id = "tree/08-games/8-1-2.leaf";
    expectLcd({ pixels: page().rig.frame() }, goldenImage(id, triggerImage(id)), "virgin Level");
  });

  for (let n = 1; n <= 9; n++) {
    it(`game/snake/level-${n}: ${n} filled bars`, () => {
      const id = `game/snake/level-${n}`;
      expectLcd({ pixels: at(n).rig.frame() }, goldenImage(id, String(n)), `level ${n}`);
    });
  }

  it("game/snake/level-keys-virgin-up: ▲ from 175 changes nothing; 167 ▼ show eight bars", () => {
    const id = "game/snake/level-keys-virgin-up";
    const { rig } = page();
    expectLcd({ pixels: rig.frame() }, goldenImage(id, "virgin"), "virgin");
    rig.press("up");
    expectLcd({ pixels: rig.frame() }, goldenImage(id, "up-from-virgin"), "▲");
    for (let i = 0; i < 166; i++) rig.press("down");
    expectLcd({ pixels: rig.frame() }, goldenImage("game/snake/level-9", "9"), "▲, ▼ ×166");
    rig.press("down");
    expectLcd({ pixels: rig.frame() }, goldenImage(id, "up-then-down-to-8"), "▲, ▼ ×167");
  });

  it("clamps at 1 and, from below 9, at 9", () => {
    const { rig } = at(2);
    rig.press("down");
    rig.press("down");
    expectLcd({ pixels: rig.frame() }, goldenImage("game/snake/level-1", "1"), "2, ▼ ×2");
    for (let i = 0; i < 12; i++) rig.press("up");
    expectLcd({ pixels: rig.frame() }, goldenImage("game/snake/level-9", "9"), "1, ▲ ×12");
    rig.press("navi");
  });

  it("game/snake/level-keys-ok: OK stores the level and goes back", () => {
    const id = "game/snake/level-keys-ok";
    const { rig, settings } = page(virgin(), 170);
    expectLcd({ pixels: rig.frame() }, goldenImage(id, "a"), "175, ▼ ×170");
    expect(settings.number(KEY)).toBe(175);
    rig.press("navi");
    expectFlowTimeline(recordFlow(rig, 100), loadGolden(id), { returns: true });
    expect(rig.exits.map((e) => e.options)).toEqual([undefined]);
    expect(settings.number(KEY)).toBe(5);
  });

  it("game/snake/level-keys-c: C goes back without storing", () => {
    const id = "game/snake/level-keys-c";
    const settings = virgin();
    settings.setNumber(KEY, 5);
    const { rig } = page(settings, 2);
    expectLcd({ pixels: rig.frame() }, goldenImage(id, "a"), "5, ▼ ×2");
    rig.press("c");
    expectFlowTimeline(recordFlow(rig, 100), loadGolden(id), { returns: true });
    expect(settings.number(KEY)).toBe(5);
  });

  it("game/snake/level-keys-hold-up: ▲ acts on key-down and repeats while held", () => {
    const id = "game/snake/level-keys-hold-up";
    const { rig } = at(5);
    rig.session.onKey({ type: "down", key: "up" });
    const recording = recordFlow(rig, 2000);
    rig.session.onKey({ type: "up", key: "up" });
    // The repeat runs 482-496 ms apart: compared with the game tolerance (D6).
    expectFlowTimeline(recording, loadGolden(id), {
      returns: false,
      toleranceMs: GAME_TICK_TOLERANCE_MS,
    });
    rig.advance(1000);
    expect(rig.frame()).toEqual(recording.frames.at(-1)!.pixels);
  });

  it("probe/games-level-keys: ▲ from 175 stays, ▼ gives 174 (nine bars), OK stores it", () => {
    const id = "probe/games-level-keys";
    const { rig, settings } = page();
    rig.press("up");
    rig.press("down");
    expectLcd({ pixels: rig.frame() }, goldenImage(id, triggerImage(id)), "Level, ▲, ▼");
    rig.press("navi");
    expect(rig.exits.map((e) => e.options)).toEqual([undefined]);
    expect(settings.number(KEY)).toBe(174);
  });

  it("probe/games-level-c: C goes back", () => {
    const { rig } = page();
    rig.press("c");
    expect(rig.exits).toHaveLength(1);
  });
});

describe("text pages (Instructions, P12)", () => {
  const NODES = ["8-1-6", "8-2-4", "8-3-3", "8-4-1-5", "8-4-2-5"] as const;
  const pagesOf = (number: string) => {
    const spec = treePath(number).at(-1)!.opens;
    if (spec.kind !== "text-pages") throw new Error(`${number} is not text pages.`);
    return spec.pages;
  };

  for (const number of NODES) {
    it(`probe/games-instructions-${number}: More pages through and cycles to the first`, () => {
      const id = `probe/games-instructions-${number}`;
      const rig = flowRig(() => textPages({ pages: pagesOf(number), softkey: "More" }));
      loadGolden(id).images.forEach((image, i) => {
        if (i > 0) rig.press("navi");
        expectLcd({ pixels: rig.frame() }, { id, image }, `Instructions ${number}, More×${i}`);
      });
    });

    const leaf = `tree/08-games/${number}.leaf`;
    if (INDEX.some((e) => e.id === leaf && e.status === "asserted")) {
      it(leaf, () => {
        const rig = flowRig(() => textPages({ pages: pagesOf(number), softkey: "More" }));
        expectFlowTimeline(recordFlow(rig, goldenSpan(leaf)), loadGolden(leaf), {
          returns: false,
        });
      });
    }
  }

  it("probe/games-instructions-c: More, then C leaves", () => {
    const id = "probe/games-instructions-c";
    const golden = loadGolden(id);
    const rows = golden.timeline!;
    const rig = flowRig(() => textPages({ pages: pagesOf("8-1-6"), softkey: "More" }));
    expectLcd({ pixels: rig.frame() }, goldenImage(id, rows[1]!.image), "first page");
    rig.press("navi");
    expectLcd({ pixels: rig.frame() }, goldenImage(id, rows[2]!.image), "More");
    rig.press("c");
    expect(rig.exits.map((e) => e.options)).toEqual([undefined]);
  });
});

describe("game splashes (P12)", () => {
  for (const game of ["8-1", "8-2", "8-3", "8-4"] as const) {
    it(`probe/games-splash-${game}: plays, then reveals the game menu`, () => {
      const id = `probe/games-splash-${game}`;
      const timeline = WIDGET_TIMELINES[WIDGET_TIMELINE_BY_NODE[game]!]!;
      const rig = flowRig(() => splash(timeline), indicatorOf(game));
      expectFlowTimeline(recordFlow(rig, goldenSpan(id)), loadGolden(id), { returns: true });
      expect(rig.exits.map((e) => e.options)).toEqual([undefined]);
    });
  }

  for (const [key, name] of [
    ["c", "c"],
    ["down", "down"],
    ["navi", "menu"],
  ] as const) {
    it(`probe/games-splash-skip-${name}: the key skips to the game menu at once`, () => {
      const id = `probe/games-splash-skip-${name}`;
      const golden = loadGolden(id);
      const rows = golden.timeline!;
      const keyAt = rows[3]!.startMs - rows[1]!.startMs;
      const rig = flowRig(() => splash(WIDGET_TIMELINES[WIDGET_TIMELINE_BY_NODE["8-1"]!]!));
      // The skip probes' first splash step lasts 252 ms, the 8-1 recording's 248 ms (capture
      // jitter, D8): compare the frames shown, then the key's exit at once.
      const recording = recordFlow(rig, keyAt);
      expect(recording.frames).toHaveLength(2);
      recording.frames.forEach((frame, i) =>
        expectLcd(frame, goldenImage(id, rows[i + 1]!.image), `splash frame ${i + 1}`),
      );
      rig.press(key);
      expect(rig.exits).toEqual([{ atMs: keyAt, options: undefined }]);
    });
  }

  it("splashIntro builds a fresh splash application per entry", () => {
    const timeline = WIDGET_TIMELINES[WIDGET_TIMELINE_BY_NODE["8-1"]!]!;
    const intro = splashIntro("stock:intro:8-1", timeline);
    expect(intro.id).toBe("stock:intro:8-1");
    const exits: unknown[] = [];
    const session = intro.createSession({ exit: (o) => exits.push(o), open: () => {} });
    session.tick(timeline.timeline.durationMs);
    expect(exits).toEqual([undefined]);
  });
});
