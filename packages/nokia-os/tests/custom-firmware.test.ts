// Plan 32 Phase 0: the engine runs a second firmware. A hand-written three-item tree (About,
// Chat, Games) composed with the stock handset and stock features remounted to its numbers boots,
// shows its carousel (About with its own graphic) and opens the stock Chat and Snake II flows from
// their new places, pixel for pixel as the stock phone draws them.
import { Timeline, type ScreenModel } from "@hellotimber/phone-core";
import { bitmapFromArt } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { chatFeature } from "../src/firmware/features/chat";
import type { StockFeature } from "../src/firmware/features/feature";
import { gamesFeature } from "../src/firmware/features/games";
import { snakeFeature } from "../src/firmware/features/games-snake";
import { spaceImpactFeature } from "../src/firmware/features/space-impact";
import { noteStylesFeature } from "../src/firmware/features/note-styles";
import { STOCK_TREE, type StockTreeNode } from "../src/firmware/generated/stock-tree";
import { STOCK_HANDSET } from "../src/firmware/handset";
import { firmwareRecords } from "../src/firmware/records";
import { settingsRecordKeys, virginSettings } from "../src/firmware/settings";
import { STOCK_FIRMWARE } from "../src/firmware/stock";
import { STOCK_MENU_ICONS, WIDGET_TIMELINE_BY_NODE } from "../src/kit/ui/resources";
import {
  composeFirmware,
  createFirmwarePhone,
  createSyntheticNetwork,
  describeFirmwareScreen,
  remountFeature,
  type Firmware,
  type FirmwareNode,
  type StockSimToolkit,
} from "../src/index";
import { SIM_CONTENT_TOOLKITS } from "../scripts/capture-sets/30-sim-content.ts";
import { keys } from "./support/probes.ts";
import type { Rig } from "./support/rig.ts";
import { createRig, standbyRig } from "./support/rig.ts";

/** `node` and its subtree renumbered from `from` to `to` (a stock subtree at a new place). */
function renumber(node: StockTreeNode, from: string, to: string): StockTreeNode {
  return {
    ...node,
    number: to + node.number.slice(from.length),
    ...(node.children === undefined
      ? {}
      : { children: node.children.map((child) => renumber(child, from, to)) }),
  };
}

const STOCK_GAMES = STOCK_TREE.find((node) => node.number === "8")!;

/** About's carousel graphic: a 3×3 box, then its centre filled, 300 ms each, looping. */
const ABOUT_FRAMES = [
  ["###", "#.#", "###"],
  ["###", "###", "###"],
].map((art) => bitmapFromArt(art));
const ABOUT_GRAPHIC = {
  x: 40,
  y: 26,
  frames: ABOUT_FRAMES,
  timeline: new Timeline(
    [
      { frame: 0, durationMs: 300 },
      { frame: 1, durationMs: 300 },
    ],
    { loopFrom: 0 },
  ),
};

/** Three carousel items: a reader with its own graphic, stock Chat at 2, stock Games at 3. */
const TREE: readonly FirmwareNode[] = [
  {
    number: "1",
    slug: "about",
    label: "About",
    graphic: ABOUT_GRAPHIC,
    opens: { kind: "text-pages", pages: [["Lachlan", "builds", "phones."]] },
  },
  renumber(STOCK_TREE.find((node) => node.number === "3")!, "3", "2"),
  renumber(STOCK_GAMES, "8", "3"),
];

const FIRMWARE: Firmware = composeFirmware({
  handset: STOCK_HANDSET,
  tree: TREE,
  features: [
    remountFeature(chatFeature, "3", "2"),
    remountFeature(gamesFeature, "8", "3"),
    remountFeature(snakeFeature, "8", "3"),
    remountFeature(spaceImpactFeature, "8", "3"),
    // The stock notes' timelines by text (`Done`, `Activated`): no node numbers to move.
    noteStylesFeature,
  ],
});

const describeScreen = (screen: ScreenModel) => describeFirmwareScreen(FIRMWARE, screen);

/** A rig at standby; New game takes `seed`. */
function rig(seed?: number, sim?: { id: string; toolkit: StockSimToolkit }): Rig {
  const internals = { firmware: FIRMWARE, ...(seed === undefined ? {} : { seed }) };
  const config = {
    carrier: "hellotimber",
    boot: "skip",
    t9: {},
    ...(sim === undefined ? {} : { sim }),
  } as const;
  const r = createRig(config, internals);
  r.press("power", 1000);
  r.advance(1000);
  return r;
}

const carousel = (screen: ScreenModel) =>
  screen.kind === "menu-carousel" ? { label: screen.label, number: screen.menuNumber } : screen;

/** The rig's LCD as text rows (`#` on), so a difference shows where it is. */
function art(rig: Rig): string {
  const { pixels } = rig.paint();
  const rows: string[] = [];
  for (let y = 0; y < 48; y++) {
    let row = "";
    for (let x = 0; x < 84; x++) row += pixels[y * 84 + x] ? "#" : ".";
    rows.push(row);
  }
  return rows.join("\n");
}

describe("a custom firmware", () => {
  it("boots to standby (`createFirmwarePhone`)", () => {
    const phone = createFirmwarePhone(FIRMWARE, { carrier: "hellotimber", boot: "skip", t9: {} });
    let now = 0;
    const until = (end: number) => {
      while (now < end) phone.tick(++now);
    };
    phone.tick(now);
    phone.send({ type: "down", key: "power" });
    until(1000);
    phone.send({ type: "up", key: "power" });
    until(2000);
    expect(phone.screen.kind).toBe("standby");
  });

  it("shows its own carousel, in its order", () => {
    const r = rig();
    keys(r, "navi wait:1000");
    const seen = [carousel(r.phone.screen)];
    for (let i = 0; i < 3; i++) {
      keys(r, "down wait:1000");
      seen.push(carousel(r.phone.screen));
    }
    expect(seen).toEqual([
      { label: "About", number: 1 },
      { label: "Chat", number: 2 },
      { label: "Games", number: 3 },
      { label: "About", number: 1 },
    ]);
  });

  it("draws About's own carousel graphic, frame by frame, and Chat's stock icon", () => {
    const r = rig();
    keys(r, "navi wait:1000");
    /** The 3×3 cells at About's graphic. */
    const cell = () => {
      const { pixels } = r.paint();
      return [0, 1, 2].map((dy) =>
        [0, 1, 2].map((dx) => (pixels[(26 + dy) * 84 + 40 + dx] ? "#" : ".")).join(""),
      );
    };
    const screen = r.phone.screen;
    expect(screen.kind === "menu-carousel" && screen.iconId).toBe("about");
    const seen = new Set<string>();
    for (let t = 0; t < 600; t += 50) {
      seen.add(cell().join("/"));
      r.advance(50);
    }
    expect([...seen].sort()).toEqual(["###/###/###", "###/#.#/###"]);
    // Chat keeps its slug's stock icon: the stock phone's at Chat, pixel for pixel (the rail and
    // the menu number differ: 2 of 3, not 3 of 12).
    const stock = standbyRig({ t9: {} });
    keys(r, "down wait:1000");
    keys(stock, "navi wait:1000 down*2 wait:1000");
    const icon = STOCK_MENU_ICONS.chat!;
    const { width, height } = icon.frames[0]!;
    const region = (rig: Rig) =>
      art(rig)
        .split("\n")
        .slice(icon.y, icon.y + height)
        .map((row) => row.slice(icon.x, icon.x + width));
    expect(region(r)).toEqual(region(stock));
    expect(region(r).join("")).toContain("#");
  });

  it("has no SIM services slot, even with a toolkit SIM", () => {
    expect(FIRMWARE.simServices).toBeUndefined();
    const r = rig(undefined, {
      id: "sim-1",
      toolkit: SIM_CONTENT_TOOLKITS.main as StockSimToolkit,
    });
    keys(r, "navi wait:1000 up wait:1000");
    expect(carousel(r.phone.screen)).toEqual({ label: "Games", number: 3 });
    expect(STOCK_FIRMWARE.simServices).toEqual({ number: 14 });
    expect(STOCK_FIRMWARE.display.unnumberedMenus).toEqual([14]);
  });

  it("opens its own reader screen", () => {
    const r = rig();
    keys(r, "navi wait:1000 navi wait:1000");
    expect(describeScreen(r.phone.screen)).toMatchInlineSnapshot(`"Lachlan builds phones. [More]"`);
  });

  it("opens Chat from its new place as the stock phone does from 3, and C returns", () => {
    const custom = rig();
    const stock = standbyRig({ t9: {} });
    keys(custom, "navi wait:300 down wait:1000 navi wait:500");
    keys(stock, "navi wait:300 down*2 wait:1000 navi wait:500");
    expect(describeScreen(custom.phone.screen)).toBe("Phone number: [Search]");
    expect(art(custom)).toEqual(art(stock));
    keys(custom, "c wait:1000");
    expect(carousel(custom.phone.screen)).toEqual({ label: "Chat", number: 2 });
  });

  it("opens Snake II from Games at 3 as the stock phone does from 8", () => {
    const custom = rig(1234);
    const stock = standbyRig({ t9: {} }, { seed: 1234 });
    const path = "wait:1000 navi wait:3000 navi wait:3000 navi wait:2000";
    keys(custom, `navi wait:300 down*2 ${path}`);
    keys(stock, `navi wait:300 down*7 ${path}`);
    expect(describeScreen(custom.phone.screen)).toBe("Snake II, score 0");
    expect(art(custom)).toEqual(art(stock));
  });

  it("looks its nodes up in its own tree", () => {
    expect(FIRMWARE.treePath("3-1-1").map((node) => node.label)).toEqual([
      "Games",
      "Snake II",
      "New game",
    ]);
    expect(() => FIRMWARE.treePath("8")).toThrow("No tree node 8.");
    expect(FIRMWARE.screens["2"]).toBeDefined();
    expect(FIRMWARE.screens["3"]).toBeUndefined();
  });

  it("throws on a node two features bind, as the stock firmware does", () => {
    expect(() =>
      composeFirmware({
        handset: STOCK_HANDSET,
        tree: TREE,
        features: [chatFeature, { name: "twice", screens: { "3": chatFeature.screens!["3"]! } }],
      }),
    ).toThrow('Screen "3" is bound by both chat and twice.');
  });
});

describe("a firmware's recordings", () => {
  it("are the stock nodes its remounted features were", () => {
    expect(FIRMWARE.models).toEqual({ "2": "3", "3": "8" });
    expect(FIRMWARE.recordingNumber("3-1-2")).toBe("8-1-2");
    expect(FIRMWARE.recordingNumber("2")).toBe("3");
    expect(FIRMWARE.nodeTimeline("3-1-2")).toBe(STOCK_FIRMWARE.nodeTimeline("8-1-2"));
  });

  it("are none for a node no model covers, whatever stock number it has", () => {
    // 2-9 is the stock Voice mailbox number, with its own recording.
    expect(WIDGET_TIMELINE_BY_NODE["2-9"]).toBeDefined();
    const tree: FirmwareNode[] = [
      {
        number: "2",
        slug: "notes",
        label: "Notes",
        opens: { kind: "submenu", presentation: "rows", softkey: "Select" },
        children: Array.from({ length: 9 }, (_, i) => ({
          number: `2-${i + 1}`,
          slug: `note-${i + 1}`,
          label: `Note ${i + 1}`,
          opens: { kind: "timed-note", lines: ["Done"], after: "back" },
        })),
      },
    ];
    const firmware = composeFirmware({
      handset: STOCK_HANDSET,
      tree,
      features: [noteStylesFeature],
    });
    expect(firmware.recordingNumber("2-9")).toBeUndefined();
    expect(firmware.nodeTimeline("2-9")).toBeUndefined();
    // Its note still plays the text's style.
    expect(firmware.noteTimelineId("2-9", ["Done"])).toBe(
      noteStylesFeature.widgets!.noteStyles!.Done,
    );
  });

  it("follow a chain of remounts to the stock subtree", () => {
    const twice = remountFeature(remountFeature(snakeFeature, "8", "3"), "3", "5-2");
    expect(twice.models).toEqual({ "5-2": "8" });
    const part = remountFeature(remountFeature(snakeFeature, "8", "3"), "3-1", "4");
    expect(part.models).toEqual({ "3": "8", "4": "8-1" });
  });

  it("are the stock firmware's own, through its same-as subtrees", () => {
    expect(STOCK_FIRMWARE.recordingNumber("12-3-2-9-1")).toBe("12-2-2-9-1");
    expect(STOCK_FIRMWARE.recordingNumber("2-9")).toBe("2-9");
    expect(STOCK_FIRMWARE.sameAsNumber("7-2-1")).toBe("7-1-1");
  });

  it("throws on two features that map one subtree to different stock subtrees", () => {
    expect(() =>
      composeFirmware({
        handset: STOCK_HANDSET,
        tree: TREE,
        features: [remountFeature(chatFeature, "3", "2"), remountFeature(snakeFeature, "8", "2")],
      }),
    ).toThrow("maps 2 to stock");
  });
});

describe("a firmware whose tree lists none of the handset's settings", () => {
  const about = TREE[0]!;
  const bare = composeFirmware({ handset: STOCK_HANDSET, tree: [about], features: [] });
  const at = { year: 2026, month: 11, day: 3, hour: 9, minute: 30, second: 0 };

  /** The same handset path on a phone running `firmware`: the art and sounds along it. */
  function handsetPath(firmware?: Firmware) {
    const network = createSyntheticNetwork();
    const config = {
      carrier: "hellotimber",
      boot: "skip",
      t9: {},
      network,
      preload: { welcomeNote: "Hello", snakeLevel: 3 },
    } as const;
    const r = createRig(config, firmware === undefined ? {} : { firmware });
    const seen: string[] = [];
    const look = (step: string) => seen.push(`${step}: ${describeScreen(r.phone.screen)}`);
    r.press("power", 1000);
    r.advance(1000);
    look("standby");
    const shown = [art(r)];
    keys(r, "power wait:1000");
    look("power list");
    shown.push(art(r));
    keys(r, "c wait:2500 down wait:1500");
    look("standby down");
    shown.push(art(r));
    keys(r, "c wait:1500");
    network.deliver({ number: "0412345678", text: "Hi", sentAt: at });
    r.advance(3000);
    look("arrival");
    shown.push(art(r));
    keys(r, "c wait:1500");
    network.ring("0412345678");
    r.advance(4000);
    look("ring");
    shown.push(art(r));
    return { seen, shown, sounds: r.sounds };
  }

  it("boots and runs the stock handset from its own registry, as the stock phone does", () => {
    const custom = handsetPath(bare);
    const stock = handsetPath();
    expect(custom.seen).toEqual(stock.seen);
    expect(custom.shown).toEqual(stock.shown);
    expect(custom.sounds).toEqual(stock.sounds);
  });

  it("has the handset's settings and records, and no Snake II level to preload", () => {
    expect(settingsRecordKeys(bare).numbers).toEqual([]);
    expect(firmwareRecords(bare).map((record) => record.name)).toEqual([
      "settings",
      ...STOCK_HANDSET.records.map((record) => record.name),
    ]);
    const virgin = virginSettings(bare);
    expect(virgin.aliases["tones/keypad-tones"]).toBe("profiles/general/personalise/keypad-tones");
    expect(Object.keys(virgin.choices)).toEqual(
      STOCK_HANDSET.settings.choices!.map((choice) => choice.key),
    );
  });

  it("throws on a tree list that differs from the handset's setting it binds", () => {
    const list = STOCK_TREE.find((node) => node.number === "8")!.children!.find(
      (node) => node.slug === "settings",
    )!;
    const sounds = list.children!.find((node) => node.slug === "sounds")!;
    const changed: StockTreeNode = {
      ...sounds,
      opens: { ...(sounds.opens as { kind: "option-list" }), opening: 0 } as never,
    };
    const tree: StockTreeNode[] = [
      { ...STOCK_GAMES, children: [{ ...list, children: [changed] }] },
    ];
    expect(() =>
      virginSettings(composeFirmware({ handset: STOCK_HANDSET, tree, features: [] })),
    ).toThrow('Tree setting "games/settings/sounds" differs from its registered choice.');
  });
});

describe("remountFeature", () => {
  const screen = chatFeature.screens!["3"]!;
  const feature: StockFeature = {
    name: "sample",
    sameAs: { "3-2": "3-1", "13-2": "13-1" },
    placeholders: { "3-*-1": "24", "13-1": "24" },
    screens: { "3": screen, "13": screen, "3-10": screen },
    leads: {
      "3-1": {
        slug: "continue",
        label: "Continue",
        shown: () => true,
        open: () => () => ({}) as never,
      },
    },
    levels: { "3-1": () => ({}) },
    exitsWhen: { "3-4": () => true },
    widgets: {
      promptLayouts: { "3-1-2": { icons: ["pen"], entry: "end" } },
      noteStyles: { Done: "3-1" },
      noteEnds: { "3-1-4": { select: "new-game" }, "3-**": { levels: 2 } },
      noteMoves: { "3-1-4": { down: "level" } },
      exitLevels: { "3-3": 2 },
      setterLevels: { "3-8": ["on", "off"] },
      entryIndicatorLevels: ["3-*", "13"],
      optionListNumbering: { "3-": "parent" },
      levelBars: { "3-3-2": "level/8-3" },
    },
    settings: {
      codeSettings: { "3-5": ["On", "Off"] },
      virginTexts: [
        { key: "a/b", number: "3-6", line: 0 },
        { key: "a/c", text: "x" },
      ],
      virginNumbers: [
        { key: "a/d", number: "13-6", line: 1 },
        { key: "a/e", value: 3 },
      ],
      restoreKeeps: ["a/d"],
    },
  };

  it("moves every node-number key, pattern and value under the prefix, by whole segments", () => {
    const moved = remountFeature(feature, "3", "5-2");
    expect(moved.name).toBe("sample");
    expect(moved.sameAs).toEqual({ "5-2-2": "5-2-1", "13-2": "13-1" });
    expect(moved.placeholders).toEqual({ "5-2-*-1": "24", "13-1": "24" });
    expect(Object.keys(moved.screens!).sort()).toEqual(["13", "5-2", "5-2-10"]);
    expect(moved.screens!["5-2"]).toBe(screen);
    expect(Object.keys(moved.leads!)).toEqual(["5-2-1"]);
    expect(Object.keys(moved.levels!)).toEqual(["5-2-1"]);
    expect(Object.keys(moved.exitsWhen!)).toEqual(["5-2-4"]);
    expect(moved.widgets).toEqual({
      promptLayouts: { "5-2-1-2": { icons: ["pen"], entry: "end" } },
      // Note texts and the recordings they name stay.
      noteStyles: { Done: "3-1" },
      noteEnds: { "5-2-1-4": { select: "new-game" }, "5-2-**": { levels: 2 } },
      noteMoves: { "5-2-1-4": { down: "level" } },
      exitLevels: { "5-2-3": 2 },
      setterLevels: { "5-2-8": ["on", "off"] },
      entryIndicatorLevels: ["5-2-*", "13"],
      optionListNumbering: { "5-2-": "parent" },
      levelBars: { "5-2-3-2": "level/8-3" },
    });
    expect(moved.settings).toEqual({
      codeSettings: { "5-2-5": ["On", "Off"] },
      // Setting keys are slug paths: they stay.
      virginTexts: [
        { key: "a/b", number: "5-2-6", line: 0 },
        { key: "a/c", text: "x" },
      ],
      virginNumbers: [
        { key: "a/d", number: "13-6", line: 1 },
        { key: "a/e", value: 3 },
      ],
      restoreKeeps: ["a/d"],
    });
  });

  it("leaves the feature it copies as it was", () => {
    remountFeature(feature, "3", "5");
    expect(Object.keys(feature.screens!).sort()).toEqual(["13", "3", "3-10"]);
    expect(feature.widgets!.entryIndicatorLevels).toEqual(["3-*", "13"]);
  });

  it("throws on a pattern that reaches the prefix only through a wildcard", () => {
    const wild: StockFeature = { name: "wild", placeholders: { "*-1": "24" } };
    expect(() => remountFeature(wild, "3", "5")).toThrow(
      'wild: pattern "*-1" cannot be remounted from "3".',
    );
    expect(remountFeature(wild, "3-2", "5").placeholders).toEqual({ "*-1": "24" });
  });

  it("composes a remounted stock feature at its new node", () => {
    const moved = remountFeature(snakeFeature, "8", "3");
    expect(Object.keys(moved.screens!).sort()).toEqual(["3-1-1", "3-1-2"]);
    expect(moved.widgets!.noteMoves).toEqual({ "3-1-4": { down: "level" } });
  });
});
