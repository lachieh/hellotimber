// Plan 30 Task 6: the SIM toolkit as data (D3, D12) and `stockMenuFor` (D5, Task 0 K).
import { describe, expect, it } from "vite-plus/test";
import type { PhoneMenu } from "@hellotimber/phone-core";
import { SIM_CONTENT_TOOLKITS } from "../scripts/capture-sets/30-sim-content.ts";
import { normaliseSim } from "../src/phone-book/sim-card";
import { carouselLabel, normaliseToolkit, rowLabel, toolkitPaths } from "../src/sim/toolkit";
import {
  createStockPhone,
  stockMenu,
  stockMenuFor,
  type StockSimCard,
  type StockSimToolkit,
} from "../src/index";

const MAIN = SIM_CONTENT_TOOLKITS.main as StockSimToolkit;
const text = (t: string) => ({ kind: "text" as const, text: t });
const item = (id: string, label = "Item", steps: unknown[] = [text("Hi")]) => ({
  id,
  label,
  steps,
});
const toolkit = (items: unknown[], title = "SIM services") => ({ title, items });
const card = (tk: unknown): StockSimCard => ({ id: "sim-1", toolkit: tk as StockSimToolkit });

describe("normaliseToolkit (D12)", () => {
  it("accepts Task 0's applet scripts as they are", () => {
    for (const [name, tk] of Object.entries(SIM_CONTENT_TOOLKITS)) {
      expect(normaliseToolkit(tk, "SIM"), name).toEqual(tk);
    }
    expect(normaliseToolkit(undefined, "SIM")).toBeUndefined();
  });

  it("refuses a title the large face cannot draw or whose first word overflows the carousel", () => {
    expect(() => normaliseSim(card(toolkit([item("a")], "Ω")))).toThrow(
      'SIM card "sim-1": toolkit.title has characters the stock large font lacks: "Ω".',
    );
    expect(() => normaliseSim(card(toolkit([item("a")], "Supercalifragilistic")))).toThrow(
      /toolkit.title "Supercalifragilistic": its first word is wider than the carousel's line/,
    );
    expect(() => normaliseSim(card(toolkit([item("a")], "")))).toThrow(
      /toolkit.title must be a non-empty string/,
    );
  });

  it("refuses ids that are not kebab-case or repeat among siblings", () => {
    expect(() => normaliseSim(card(toolkit([item("Info")])))).toThrow(
      'SIM card "sim-1": toolkit.items[0].id "Info" must be kebab-case.',
    );
    expect(() => normaliseSim(card(toolkit([item("a"), item("a")])))).toThrow(
      'SIM card "sim-1": toolkit.items[1].id "a" is used twice in one list.',
    );
    // The same id in another list is fine.
    const nested = item("a", "A", [{ kind: "select", items: [item("a")] }]);
    expect(() => normaliseSim(card(toolkit([nested])))).not.toThrow();
  });

  it("refuses labels, texts and confirms the small face cannot draw, naming the path", () => {
    expect(() => normaliseSim(card(toolkit([item("a", "Δ")])))).toThrow(
      'SIM card "sim-1": toolkit.items[0].label has characters the stock small font lacks: "Δ".',
    );
    expect(() => normaliseSim(card(toolkit([item("a", "A", [text("ok"), text("[x]")])])))).toThrow(
      'SIM card "sim-1": toolkit.items[0].steps[1].text has characters the stock small font lacks: "[", "]".',
    );
    const call = { kind: "call", number: "0412345678", confirm: "Call ~me?" };
    expect(() => normaliseSim(card(toolkit([item("a", "A", [call])])))).toThrow(
      /toolkit.items\[0\].steps\[0\].confirm has characters the stock small font lacks: "~"/,
    );
  });

  it("caps a text page at one proactive command (273 septets)", () => {
    expect(() =>
      normaliseSim(card(toolkit([item("a", "A", [text("a".repeat(273))])]))),
    ).not.toThrow();
    expect(() => normaliseSim(card(toolkit([item("a", "A", [text("a".repeat(274))])])))).toThrow(
      /steps\[0\].text takes 274 septets, more than one command's 273/,
    );
  });

  it("needs steps, 1-255 items per list and lists at most 4 deep", () => {
    expect(() => normaliseSim(card(toolkit([])))).toThrow(
      /toolkit.items must be a non-empty array/,
    );
    expect(() => normaliseSim(card(toolkit([item("a", "A", [])])))).toThrow(
      /toolkit.items\[0\].steps must be a non-empty array/,
    );
    const many = Array.from({ length: 256 }, (_, i) => item(`i${i}`));
    expect(() => normaliseSim(card(toolkit(many)))).toThrow(
      /has 256 items, more than a list's 255/,
    );
    expect(() => normaliseSim(card(toolkit(many.slice(0, 255))))).not.toThrow();
    const nest = (depth: number): unknown =>
      depth === 0
        ? item("leaf")
        : item(`d${depth}`, "D", [{ kind: "select", items: [nest(depth - 1)] }]);
    expect(() => normaliseSim(card(toolkit([nest(3)])))).not.toThrow();
    expect(() => normaliseSim(card(toolkit([nest(4)])))).toThrow(/nests lists deeper than 4/);
  });

  it("checks call numbers by plan 19's rules and step kinds", () => {
    const call = (number: string) => item("a", "A", [{ kind: "call", number }]);
    expect(() => normaliseSim(card(toolkit([call("+61412345678")])))).not.toThrow();
    expect(() => normaliseSim(card(toolkit([call("")])))).toThrow(
      /steps\[0\].number must be a non-empty/,
    );
    expect(() => normaliseSim(card(toolkit([call("0412w5")])))).toThrow(/number "0412w5" must be/);
    expect(() => normaliseSim(card(toolkit([item("a", "A", [{ kind: "tone" }])])))).toThrow(
      /steps\[0\].kind must be "text", "select" or "call"/,
    );
    expect(() =>
      normaliseSim(card(toolkit([item("a", "A", [{ kind: "text", text: "x", clear: "now" }])]))),
    ).toThrow(/steps\[0\].clear must be "user" or "delay"/);
  });

  it("throws from createStockPhone and stockMenuFor alike", () => {
    const bad = card(toolkit([item("Bad")]));
    expect(() => createStockPhone({ carrier: "Orange F", sim: bad })).toThrow(
      /items\[0\].id "Bad"/,
    );
    expect(() => stockMenuFor(bad)).toThrow(/items\[0\].id "Bad"/);
  });
});

describe("how the 3310 shows a toolkit (Task 0 K)", () => {
  it("labels the carousel with the words of the title that fit its line", () => {
    expect(carouselLabel("SIM services")).toBe("SIM services");
    expect(carouselLabel("LACHLAN")).toBe("LACHLAN");
    expect(carouselLabel("Portfolio menu")).toBe("Portfolio");
  });

  it("cuts a label wider than its row (its ... drawn at the row's end, `…` marks it)", () => {
    expect(rowLabel("Ten chars!")).toBe("Ten chars!");
    expect(rowLabel("Text then call")).toBe("Text then call");
    expect(rowLabel("Sixteen chars ok")).toBe("Sixteen char…");
    expect(rowLabel("Twenty-four characters!!")).toBe("Twenty-four…");
  });

  it("routes the level and each SET UP MENU item", () => {
    expect(toolkitPaths(SIM_CONTENT_TOOLKITS.title14 as StockSimToolkit)).toEqual([
      "menu/sim-services",
      "menu/sim-services/about",
      "menu/sim-services/work",
      "menu/sim-services/contact",
    ]);
  });
});

/** Every entry of a menu: path, label and menu number, depth first. */
function outline(menu: PhoneMenu): string[] {
  return menu.paths().map((path) => {
    const entry = menu.resolve(path)?.at(-1);
    return `${path} ${entry?.label} ${entry?.order.value}`;
  });
}

describe("stockMenuFor (D5)", () => {
  it("is stockMenu for the emulator SIM and any SIM without a toolkit", () => {
    expect(outline(stockMenuFor("sim-1"))).toEqual(outline(stockMenu));
    expect(outline(stockMenuFor({ id: "lachlan-1", phoneBook: { locations: 10 } }))).toEqual(
      outline(stockMenu),
    );
  });

  // The carousel's 13th slot, numbered 14: there is no Menu 13.
  it("adds SIM services as Menu 14, its items in SIM order, labelled by the toolkit's title", () => {
    const menu = stockMenuFor(card(MAIN));
    const paths = menu.paths();
    expect(paths.slice(0, stockMenu.paths().length)).toEqual(stockMenu.paths());
    expect(paths.slice(stockMenu.paths().length)).toEqual(toolkitPaths(MAIN));
    expect(menu.entries).toHaveLength(13);
    const slot = menu.entries[12]!.entry;
    expect([slot.slug.value, slot.order.value, slot.label]).toEqual([
      "sim-services",
      14,
      "SIM services",
    ]);
    expect(menu.resolve("menu/sim-services/text-160")?.at(-1)?.label).toBe("Sixteen chars ok");
    expect(stockMenuFor(card(SIM_CONTENT_TOOLKITS.title14)).entries[12]!.entry.label).toBe(
      "Portfolio",
    );
  });

  it("gives createStockPhone the same Menu 14", () => {
    const phone = createStockPhone({ carrier: "Orange F", boot: "skip", sim: card(MAIN) });
    phone.pressKey("power", 1000);
    phone.tick(3000);
    phone.navigate("menu/sim-services");
    expect(phone.path).toBe("menu/sim-services");
  });
});
