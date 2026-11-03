// Plan 32 Phase 0: the engine runs a second firmware. A hand-written three-item tree (About,
// Chat, Games) composed with stock features remounted to its numbers boots, shows its carousel
// and opens the stock Chat and Snake II flows from their new places.
import type { ScreenModel } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { chatFeature } from "../src/firmware/features/chat";
import type { StockFeature } from "../src/firmware/features/feature";
import { gamesFeature } from "../src/firmware/features/games";
import { snakeFeature } from "../src/firmware/features/games-snake";
import { spaceImpactFeature } from "../src/firmware/features/space-impact";
import { noteStylesFeature } from "../src/firmware/features/note-styles";
import { STOCK_TREE, type StockTreeNode } from "../src/firmware/generated/stock-tree";
import { virginSettings } from "../src/firmware/settings";
import { STOCK_FIRMWARE, STOCK_SETTINGS } from "../src/firmware/stock";
import { settingKey, treePaths } from "../src/firmware/tree";
import {
  composeFirmware,
  createFirmwarePhone,
  describeStockScreen,
  remountFeature,
  type Firmware,
} from "../src/index";
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

/** Three carousel items: a reader, the stock Chat leaf at 2, the stock Games subtree at 3. */
const TREE: readonly StockTreeNode[] = [
  {
    number: "1",
    // The carousel icon is looked up by slug (`stockMenuGraphic`): a stock icon's.
    slug: "clock",
    label: "About",
    opens: { kind: "text-pages", pages: [["Lachlan", "builds", "phones."]] },
  },
  renumber(STOCK_TREE.find((node) => node.number === "3")!, "3", "2"),
  renumber(STOCK_GAMES, "8", "3"),
];

/**
 * What the stock handset around the menu reads (boot, standby, calls, sound, lights, clock):
 * every stock setting outside this tree's own, as settings no tree node lists, and every stock
 * EEPROM record. Multi-select marks have no such form, so the handset must not need them.
 */
function handsetSettings(tree: readonly StockTreeNode[]): StockFeature {
  const own = new Set([...treePaths(tree)].map((path) => settingKey(path)));
  const virgin = virginSettings();
  const nodes = new Map([...STOCK_FIRMWARE.treePaths()].map((path) => [settingKey(path), path]));
  const labels = (key: string): readonly string[] => {
    const node = nodes.get(key)?.at(-1);
    const spec = node?.opens;
    if (spec?.kind === "option-list") return spec.options.map((option) => option.label);
    const setter = node === undefined ? undefined : STOCK_FIRMWARE.setterLevel(node.number);
    if (setter !== undefined) {
      return setter.map((slug) => node!.children!.find((child) => child.slug === slug)!.label);
    }
    const code = node === undefined ? undefined : STOCK_SETTINGS.codeSettings[node.number];
    if (code !== undefined) return code;
    const choice = STOCK_SETTINGS.choices.find((entry) => entry.key === key);
    if (choice === undefined) throw new Error(`No labels for "${key}".`);
    return choice.labels;
  };
  // An aliased key (Tones → the active profile's) is listed under its target; list it under its
  // own key too, so the store aliases it again.
  const outside = <T>(table: Readonly<Record<string, T>>) =>
    [
      ...Object.entries(table),
      ...Object.entries(virgin.aliases).flatMap(([key, target]) =>
        target in table ? [[key, table[target]!] as const] : [],
      ),
    ].filter(([key]) => !own.has(key));
  return {
    name: "handset-settings",
    settings: {
      choices: outside(virgin.choices).map(([key, { chosen }]) => ({
        key,
        labels: labels(key),
        chosen,
      })),
      aliases: STOCK_SETTINGS.aliases,
      virginTexts: outside(virgin.texts).map(([key, text]) => ({ key, text })),
      virginNumbers: outside(virgin.numbers).map(([key, value]) => ({ key, value })),
      typedTexts: STOCK_SETTINGS.typedTexts,
    },
    records: STOCK_FIRMWARE.featureRecords,
  };
}

/** The widget timelines are the stock recordings', by stock node: Games' are under 8. */
const GAMES_RECORDINGS: StockFeature = { name: "games-recordings", sameAs: { "3": "8" } };

const FIRMWARE: Firmware = composeFirmware({
  tree: TREE,
  features: [
    remountFeature(chatFeature, "3", "2"),
    remountFeature(gamesFeature, "8", "3"),
    remountFeature(snakeFeature, "8", "3"),
    remountFeature(spaceImpactFeature, "8", "3"),
    GAMES_RECORDINGS,
    // The stock notes' timelines by text (`Done`, `Activated`): no node numbers to move.
    noteStylesFeature,
    handsetSettings(TREE),
  ],
});

/** A rig at standby; New game takes `seed`. */
function rig(seed?: number): Rig {
  const internals = { firmware: FIRMWARE, ...(seed === undefined ? {} : { seed }) };
  const r = createRig({ carrier: "hellotimber", boot: "skip", t9: {} }, internals);
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

  it("opens its own reader screen", () => {
    const r = rig();
    keys(r, "navi wait:1000 navi wait:1000");
    expect(describeStockScreen(r.phone.screen)).toMatchInlineSnapshot(
      `"Lachlan builds phones. [More]"`,
    );
  });

  it("opens Chat from its new place as the stock phone does from 3, and C returns", () => {
    const custom = rig();
    const stock = standbyRig({ t9: {} });
    keys(custom, "navi wait:300 down wait:1000 navi wait:500");
    keys(stock, "navi wait:300 down*2 wait:1000 navi wait:500");
    expect(describeStockScreen(custom.phone.screen)).toBe("Phone number: [Search]");
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
    expect(describeStockScreen(custom.phone.screen)).toBe("Snake II, score 0");
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
        tree: TREE,
        features: [chatFeature, { name: "twice", screens: { "3": chatFeature.screens!["3"]! } }],
      }),
    ).toThrow('Screen "3" is bound by both chat and twice.');
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
