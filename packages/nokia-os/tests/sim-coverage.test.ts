// Plan 30 Task 10: SIM content and SIM services' coverage. Nothing waits for plan 30 (only plan
// 22's `*#06#`), no placeholder names it, and Menu 14 (SIM services, added by a toolkit SIM, not
// in the stock tree) is covered by asserted goldens that pass: its carousel slot, its level and
// each kind of SIM screen; the SIM messages by theirs.
import { describe, expect, it } from "vite-plus/test";
import { readPlanIndex } from "../scripts/golden-index.ts";
import { SIM_CONTENT_TOOLKITS } from "../scripts/capture-sets/30-sim-content.ts";
import { PLACEHOLDER_OWNERS } from "../src/firmware/stock";
import { stockMenuFor, type StockSimToolkit } from "../src/index";
import { GOLDENS, INDEX } from "./support/acceptance.ts";
import { SIM_CONTENT_KNOWN_GAPS } from "./support/sim-content.ts";

const OWN = readPlanIndex(GOLDENS, "30");
const PASSING = new Set(
  OWN.filter((e) => e.status === "asserted" && !(e.id in SIM_CONTENT_KNOWN_GAPS)).map((e) => e.id),
);

describe("SIM content and SIM services' coverage (plan 30 Task 10)", () => {
  it("leaves nothing pending for plan 30, and only *#06# for plan 22", () => {
    expect(INDEX.filter((e) => e.status === "pending:30").map((e) => e.id)).toEqual([]);
    expect(OWN.filter((e) => e.status !== "asserted").map((e) => [e.id, e.status])).toEqual([
      ["sim/imei-screen", "pending:22"],
    ]);
    expect(Object.values(PLACEHOLDER_OWNERS)).not.toContain("30");
  });

  it("covers Menu 14 (added by the toolkit, not the stock tree) with goldens that pass", () => {
    const menu = stockMenuFor({
      id: "sim-1",
      toolkit: SIM_CONTENT_TOOLKITS.main as StockSimToolkit,
    });
    expect(menu.paths()).toContain("menu/sim-services");
    for (const id of [
      // The carousel slot: label, 14, the icon; ▲/▼ past it; the titles as labels.
      "sim/stk-carousel-main-up",
      "sim/stk-carousel-main-down-wrap",
      "sim/stk-carousel-main-up-again",
      "sim/stk-carousel-lachlan",
      "sim/stk-carousel-title14",
      // The level: its rows, cut labels, C.
      "sim/stk-level-main-open",
      "sim/stk-level-main-rows",
      "sim/stk-level-main-c",
      // Each kind of SIM screen: text pages, lists (nested), the Wait note.
      "sim/stk-text-short-open",
      "sim/stk-text-text-240-pages",
      "sim/stk-select-list-open",
      "sim/stk-select-nested-level-2",
      "sound/stk/text-open",
    ]) {
      expect(PASSING.has(id), id).toBe(true);
    }
  });

  it("covers the SIM messages: power-on, order, reading, names, erase, capacity, restore", () => {
    for (const prefix of [
      "sim/sms-boot-",
      "sim/sms-order-",
      "sim/sms-read-",
      "sim/sms-erase",
      "sim/sms-slots-10-",
      "sim/sms-slots-30-",
      "sim/sms-restore-",
      "sim/names-digits",
      "sim/names-exact",
    ]) {
      expect(
        [...PASSING].some((id) => id.startsWith(prefix)),
        prefix,
      ).toBe(true);
    }
  });
});
