// Plan 30 Task 9: screen text for hosts (D11): every screen a stock phone emits reads as plain
// text, kernel screens from their models and stock widgets from the text their flow attached.
import { afterAll, describe, expect, it } from "vite-plus/test";
import type { ScreenModel } from "@hellotimber/phone-core";
import { readPlanIndex } from "../scripts/golden-index.ts";
import { SIM_CONTENT_TOOLKITS } from "../scripts/capture-sets/30-sim-content.ts";
import { describeWidget } from "@hellotimber/nokia-kit/ui/display/describe";
import type { WidgetModel } from "@hellotimber/nokia-kit/ui/display/widgets";
import { describeStockScreen, type StockSimToolkit } from "../src/index";
import { GOLDENS, scenarioOf } from "./support/acceptance.ts";
import { MESSAGES_KNOWN_GAPS, MESSAGES_SCENARIOS } from "./support/messages.ts";
import { PHONE_BOOK_KNOWN_GAPS, PHONE_BOOK_SCENARIOS } from "./support/phone-book.ts";
import { standbyRig, watchScreens } from "./support/rig.ts";
import { SIM_CONTENT_KNOWN_GAPS, simContentScenarioOf } from "./support/sim-content.ts";

const STANDBY: Extract<ScreenModel, { kind: "standby" }> = {
  kind: "standby",
  carrier: "Orange F",
  signal: 4,
  battery: 4,
};

describe("describeStockScreen: kernel screens", () => {
  it("reads off, boot and standby (operator, profile line, clock, indicators, notice)", () => {
    expect(describeStockScreen({ kind: "off" })).toBe("Off");
    expect(describeStockScreen({ kind: "boot", phase: "hands", frame: 3 })).toBe("Switching on");
    expect(describeStockScreen(STANDBY)).toBe("Standby: Orange F [Menu]");
    expect(
      describeStockScreen({
        ...STANDBY,
        clock: "10:10",
        line: "Silent",
        indicators: { message: true, alarm: true },
        notice: { text: "1\nmessage\nreceived", softkey: "Read" },
      }),
    ).toBe("Standby: Orange F, Silent, 10:10, unread messages, alarm. 1 message received [Read]");
  });

  it("reads the carousel slot, SIM services as Menu 14", () => {
    const slot = {
      kind: "menu-carousel" as const,
      label: "Messages",
      menuNumber: 2,
      total: 12,
      iconId: "messages",
      menuIndicator: { segments: [2], awaitingNext: false },
    };
    expect(describeStockScreen(slot)).toBe("Menu 2: Messages [Select]");
    expect(
      describeStockScreen({
        ...slot,
        label: "SIM services",
        menuNumber: 14,
        position: 13,
        total: 13,
        iconId: "sim-services",
        menuIndicator: { segments: [14], awaitingNext: false },
      }),
    ).toBe("Menu 14: SIM services [Select]");
  });

  it("reads both level presentations: the selected row and its place, or the page and value", () => {
    const rows: ScreenModel = {
      kind: "list",
      title: "Messages",
      items: ["Write messages", "Inbox", "Outbox"],
      selected: 1,
      softkey: "Select",
      menuIndicator: { segments: [2], awaitingNext: false },
    };
    expect(describeStockScreen(rows)).toBe("Messages: Inbox (2 of 3) [Menu 2] [Select]");
    expect(
      describeStockScreen({
        kind: "list",
        title: "Tones",
        items: ["Ringing tone", "Ringing volume"],
        selected: 0,
        softkey: "Select",
        presentation: "pages",
        detail: "Nokia tune",
      }),
    ).toBe("Tones: Ringing tone: Nokia tune [Select]");
  });
});

/**
 * One model of every stock widget kind: a kind without an entry here, or without a describer, is
 * a type error.
 */
const SAMPLES: { readonly [K in WidgetModel["kind"]]: Extract<WidgetModel, { kind: K }> } = {
  "space-impact": {
    kind: "space-impact",
    board: {
      level: 0,
      scroll: 0,
      hud: { lives: 3, weapon: "missile", count: 3, score: 0 },
      sprites: [],
    },
  },
  options: {
    kind: "options",
    items: ["Off", "On"],
    selected: 1,
    windowTop: 0,
    indicator: { segments: [], awaitingNext: false },
    softkey: "OK",
  },
  multi: {
    kind: "multi",
    items: ["A", "B"],
    marks: [true, false],
    selected: 0,
    windowTop: 0,
    indicator: { segments: [], awaitingNext: false },
    softkey: "Mark",
  },
  note: { kind: "note", lines: ["Done"] },
  progress: { kind: "progress", text: ["Opening", "message"], bar: "progress-1", softkey: "" },
  confirm: { kind: "confirm", lines: ["Erase", "message?"], softkey: "OK" },
  "info-page": {
    kind: "info-page",
    label: "Level",
    value: "3",
    index: 0,
    count: 2,
    indicator: { segments: [], awaitingNext: false },
    softkey: "Back",
  },
  "info-screen": { kind: "info-screen", lines: ["No numbers"], softkey: "" },
  prompt: { kind: "prompt", icons: [], label: ["Name:"], cursor: true, softkey: "OK" },
  "level-bar": { kind: "level-bar", bars: "3", softkey: "OK" },
  "text-page": { kind: "text-page", lines: ["Instructions"], softkey: "More" },
  splash: { kind: "splash", frame: { kind: "blank" } } as WidgetModel as never,
  snake: { kind: "snake", board: { maze: 0, segments: [], score: 12 } },
  "game-over": {
    kind: "game-over",
    frame: { kind: "blank" },
    label: "Score:",
    score: "12",
  } as never,
  "game-frame": { kind: "game-frame", frame: "A".repeat(672) },
  "boot-frame": { kind: "boot-frame", frame: 0 },
  "welcome-note": { kind: "welcome-note", text: "Hi" },
  editor: {
    kind: "editor",
    icons: [],
    counter: "158",
    font: "small",
    lines: [{ text: "Hi", top: 7 }],
    softkey: "Options",
  },
  symbols: { kind: "symbols", selected: 0 },
  placeholder: { kind: "placeholder", label: "Calling" },
  calculator: { kind: "calculator", screen: "display", lines: ["0"], softkey: "" } as never,
  alert: { kind: "alert", lines: ["Alarm"], align: "centre", softkey: "Stop" },
  stopwatch: { kind: "stopwatch", text: "00:01.0", softkey: "Stop" },
  composer: { kind: "composer", lines: ["4c1"], cursor: null, counter: "48", softkey: "Options" },
  keyguard: { kind: "keyguard", screen: "now-press", standby: STANDBY } as never,
  "standby-draw": { kind: "standby-draw" },
  "message-list": {
    kind: "message-list",
    rows: [{ label: "Ben", icon: "message/unread" }],
    selected: 0,
    windowTop: 0,
    indicator: { segments: [2, 2, 1], awaitingNext: false },
    softkey: "Read",
  },
  "message-page": {
    kind: "message-page",
    lines: ["Sender:", "Ben", "0400000002"],
    softkey: "Options",
  },
  "name-list": {
    kind: "name-list",
    view: "large",
    name: "Ben",
    number: "0400000002",
    softkey: "Call",
  },
  "service-list": {
    kind: "service-list",
    items: ["Help"],
    selected: 0,
    windowTop: 0,
    softkey: "Call",
  },
  "phone-book-query": {
    kind: "phone-book-query",
    lines: ["Replace", "old ID?"],
    tops: [2, 12],
    softkey: "OK",
  },
  "phone-book-number": { kind: "phone-book-number", number: "0400000002", softkey: "OK" },
  "standby-frame": { kind: "standby-frame", screen: STANDBY, frame: "leaving" },
  "shortcut-choice": { kind: "shortcut-choice", label: "Key 3" },
  "content-list": {
    kind: "content-list",
    rows: ["Template 1"],
    selected: 0,
    windowTop: 0,
    indicator: { segments: [], awaitingNext: false },
    softkey: "Use",
  },
  "service-request": {
    kind: "service-request",
    text: "Requesting",
    bar: "progress-1",
    softkey: "Quit",
  },
  "reminder-view": { kind: "reminder-view", number: 1, text: "Call Ann", softkey: "Options" },
  "dial-entry": { kind: "dial-entry", text: "0412", softkey: "Call" },
  call: {
    kind: "call",
    body: { kind: "call", label: "Call 1" },
    softkey: "Options",
    handset: true,
  },
  "call-entry": { kind: "call-entry", label: "Dialled 1:", number: "0412", softkey: "Options" },
  ringing: { kind: "ringing", number: "0412", calling: true },
  volume: { kind: "volume", level: 5 },
};

describe("describeWidget: every stock widget kind", () => {
  for (const [kind, model] of Object.entries(SAMPLES)) {
    it(`reads ${kind}`, () => {
      const text = describeWidget(model as WidgetModel);
      expect(text.trim(), kind).not.toBe("");
    });
  }

  it("says what a note, list, editor and placeholder show", () => {
    expect(describeWidget(SAMPLES.note)).toBe("Note: Done");
    expect(describeWidget(SAMPLES["message-list"])).toBe("Messages: Ben (1 of 1), unread [Read]");
    expect(describeWidget(SAMPLES.editor)).toBe("Editor: Hi (158) [Options]");
    expect(describeWidget(SAMPLES.placeholder)).toBe("Calling (not implemented)");
    expect(describeWidget(SAMPLES.snake)).toBe("Snake II, score 12");
    expect(describeWidget(SAMPLES["game-frame"])).toBe("Game screen");
    expect(describeWidget(SAMPLES["message-page"])).toBe("Sender: Ben 0400000002 [Options]");
  });
});

describe("a phone's screens read as text", () => {
  it("reads a SIM services session: the level, Wait and a text page", () => {
    const rig = standbyRig({
      sim: { id: "sim-1", toolkit: SIM_CONTENT_TOOLKITS.main as StockSimToolkit },
    });
    rig.phone.navigate("menu/sim-services");
    rig.advance(100);
    expect(describeStockScreen(rig.phone.screen)).toBe("SIM services: Ten chars! (1 of 12) [OK]");
    rig.press("down");
    rig.advance(100);
    expect(describeStockScreen(rig.phone.screen)).toBe(
      "SIM services: Sixteen char... (2 of 12) [OK]",
    );
    rig.press("up");
    rig.press("navi");
    expect(describeStockScreen(rig.phone.screen)).toBe("Wait (in progress)");
    rig.advance(100);
    expect(describeStockScreen(rig.phone.screen)).toBe("Hello from the SIM [OK]");
  });
});

/**
 * The property (D11): every screen the asserted goldens' scenarios drive a phone through reads as
 * non-empty text, and every custom frame carries its own (no `Screen of …` fallback). Plan 30's
 * scenarios all, every 10th of plans 14, 18 and 19 (each replays from power-on).
 */
describe("every screen the scenarios emit has a description", () => {
  const screens: { id: string; text: string; kind: string }[] = [];
  let current = "";
  watchScreens((screen) => {
    screens.push({ id: current, text: describeStockScreen(screen), kind: screen.kind });
  });
  afterAll(() => watchScreens(undefined));

  const every = <T>(list: readonly T[], n: number) => list.filter((_, i) => i % n === 0);
  const asserted = (plan: string) =>
    readPlanIndex(GOLDENS, plan).filter((entry) => entry.status === "asserted");
  const runs: { id: string; run: () => void }[] = [
    ...every(
      asserted("14").filter((e) => e.covers !== undefined),
      10,
    ).map((e) => ({ id: e.id, run: scenarioOf({ plan: "14", scenarios: {} }, e.id, e.covers)! })),
    ...every(
      // Glyph sheets paint the fonts without a phone.
      asserted("18").filter(
        (e) =>
          !(e.id in MESSAGES_KNOWN_GAPS) &&
          e.id in MESSAGES_SCENARIOS &&
          !e.id.startsWith("glyphs/"),
      ),
      10,
    ).map((e) => ({ id: e.id, run: () => MESSAGES_SCENARIOS[e.id]!(e.id) })),
    ...every(
      asserted("19").filter(
        (e) => !(e.id in PHONE_BOOK_KNOWN_GAPS) && e.id in PHONE_BOOK_SCENARIOS,
      ),
      10,
    ).map((e) => ({ id: e.id, run: () => PHONE_BOOK_SCENARIOS[e.id]!(e.id) })),
    ...asserted("30")
      .filter((e) => !(e.id in SIM_CONTENT_KNOWN_GAPS))
      .map((e) => ({ id: e.id, run: () => simContentScenarioOf(e.id)(e.id) })),
  ];

  for (const { id, run } of runs) {
    it(
      id,
      () => {
        current = id;
        const from = screens.length;
        run();
        const seen = screens.slice(from);
        expect(seen.length, `${id}: no screens`).toBeGreaterThan(0);
        expect(seen.filter((s) => s.text.trim() === "").map((s) => s.kind)).toEqual([]);
        expect(seen.filter((s) => s.text.startsWith("Screen of ")).map((s) => s.text)).toEqual([]);
      },
      60_000,
    );
  }
});
