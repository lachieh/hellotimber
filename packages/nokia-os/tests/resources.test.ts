import { SubmenuEntry } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { extractResources, inferLoop, toTimeline } from "../scripts/extract-resources.ts";
import { TEXT_RUNS } from "../scripts/text-runs.ts";
import { missingStockGlyphs, stockMenu } from "../src/index";
import {
  BOOT_FRAMES,
  BOOT_TIMELINE,
  STOCK_FONTS,
  STOCK_MENU_ICONS,
  stockMenuGraphic,
  type StockFontName,
} from "../src/resources";
import { BOOT_DATA } from "../src/resources/generated/boot";
import { STOCK_FONT_DATA } from "../src/resources/generated/fonts";
import { MENU_ICON_DATA } from "../src/resources/generated/menu-icons";
import { STATUS_DATA } from "../src/resources/generated/status";

describe("generated resources", () => {
  it("equal a fresh extraction from the committed goldens", () => {
    expect({
      fonts: STOCK_FONT_DATA,
      menuIcons: MENU_ICON_DATA,
      boot: BOOT_DATA,
      status: STATUS_DATA,
    }).toEqual(extractResources());
  });

  it("have binary glyphs of one height per font", () => {
    for (const [name, font] of Object.entries(STOCK_FONT_DATA)) {
      for (const [ch, rows] of Object.entries(font.glyphs)) {
        expect(rows, `${name} '${ch}'`).toHaveLength(font.height);
        for (const row of rows) {
          expect(row, `${name} '${ch}'`).toMatch(/^[#.]+$/);
          expect(row.length, `${name} '${ch}'`).toBe(rows[0]!.length);
        }
      }
    }
  });

  it("render every transcribed label, value and softkey", () => {
    for (const images of Object.values(TEXT_RUNS)) {
      for (const runs of Object.values(images)) {
        for (const run of runs)
          expect(missingStockGlyphs(run.text, run.font), run.text).toEqual([]);
      }
    }
    for (const softkey of ["Menu", "Select"])
      expect(missingStockGlyphs(softkey, "small")).toEqual([]);
  });

  it("render every stockMenu label: carousel titles in large, level-1 labels in small", () => {
    for (const { entry } of stockMenu.entries) {
      expect(missingStockGlyphs(entry.label, "large"), entry.label).toEqual([]);
      const children = entry instanceof SubmenuEntry ? entry.children.entries : [];
      for (const child of children)
        expect(missingStockGlyphs(child.label, "small"), child.label).toEqual([]);
    }
  });

  it("names missing characters once, in order, and ignores line breaks", () => {
    expect(missingStockGlyphs("Show call\nduration", "small")).toEqual([]);
    expect(missingStockGlyphs("zebra zoo!", "small")).toEqual(["z", "!"]);
    expect(missingStockGlyphs("12", "large" satisfies StockFontName)).toEqual(["1", "2"]);
  });

  it("renders any live time and date: every digit in the standby digits and thin page fonts", () => {
    // The 19:48 and 07:59 captures (Task 11) supply the digits that 10:10 and 13.10.2026 lack.
    expect(missingStockGlyphs("0123456789:", "digits")).toEqual([]);
    expect(missingStockGlyphs("0123456789:.", "thin")).toEqual([]);
  });

  it("has strict fonts: drawing a missing glyph throws", () => {
    const fb = new Framebuffer();
    expect(fb.drawText(STOCK_FONTS.digits, "10:10", 0, 0)).toBe(27);
    expect(() => fb.drawText(STOCK_FONTS.digits, "A", 0, 0)).toThrow(/unknown glyph 'A'/);
  });
});

describe("menu icons", () => {
  // Distinct frames per icon, as recorded by plan 13 Task 0 (menu-anim-long).
  const FRAME_COUNTS: Record<string, number> = {
    "phone-book": 4,
    messages: 14,
    chat: 12,
    "call-register": 12,
    tones: 17,
    settings: 8,
    "call-divert": 11,
    games: 4,
    calculator: 13,
    reminders: 14,
    clock: 8,
    profiles: 4,
  };

  it("has the captured frame count for each of the 12 carousel icons", () => {
    expect(
      Object.fromEntries(Object.entries(STOCK_MENU_ICONS).map(([id, i]) => [id, i.frames.length])),
    ).toEqual(FRAME_COUNTS);
  });

  it("keeps icon art inside x 0..79, y 20..39 and every timeline frame in range", () => {
    for (const [id, icon] of Object.entries(STOCK_MENU_ICONS)) {
      for (const frame of icon.frames) {
        expect(icon.x, id).toBeGreaterThanOrEqual(0);
        expect(icon.y, id).toBeGreaterThanOrEqual(20);
        expect(icon.x + frame.width - 1, id).toBeLessThanOrEqual(79);
        expect(icon.y + frame.height - 1, id).toBeLessThanOrEqual(39);
      }
      const graphic = stockMenuGraphic(id);
      for (const reveal of ["enter", "next", "previous", "return"] as const) {
        for (const step of graphic.timelineFor(reveal)!.steps) {
          expect(step.frame, `${id} ${reveal}`).toBeLessThan(icon.frames.length);
        }
      }
    }
  });

  it("settles every icon on a held frame (no loop) and starts on frame 0", () => {
    for (const [id, data] of Object.entries(MENU_ICON_DATA)) {
      expect(data.timeline.loopFrom, id).toBeUndefined();
      expect(data.timeline.steps[0]!.frame, id).toBe(0);
    }
  });

  it("gives only the Clock per-reveal timelines (previous from ▲, return from C)", () => {
    const withReveals = Object.entries(MENU_ICON_DATA)
      .filter(([, data]) => data.reveals)
      .map(([id, data]) => [id, Object.keys(data.reveals!).sort()]);
    expect(withReveals).toEqual([["clock", ["previous", "return"]]]);
    const clock = stockMenuGraphic("clock");
    expect(clock.timelineFor("next")!.frameAt(1399)).toBe(0);
    expect(clock.timelineFor("next")!.frameAt(1400)).toBe(1);
    expect(clock.timelineFor("previous")!.frameAt(1385)).toBe(1);
    expect(clock.timelineFor("return")!.frameAt(1386)).toBe(1);
  });
});

describe("timeline extraction", () => {
  it("merges repeated frames and keeps a settled recording finite", () => {
    expect(
      toTimeline(
        [
          { frame: 0, durationMs: 100 },
          { frame: 1, durationMs: 50 },
          { frame: 1, durationMs: 50 },
          { frame: 0, durationMs: 2000 },
        ],
        true,
      ),
    ).toEqual({
      steps: [
        { frame: 0, durationMs: 100 },
        { frame: 1, durationMs: 100 },
        { frame: 0, durationMs: 2000 },
      ],
    });
  });

  it("infers a loop when the recording ends cycling", () => {
    expect(inferLoop([0, 1, 2, 1, 2, 1, 2])).toEqual({ loopFrom: 1, period: 2 });
    expect(inferLoop([0, 1, 2])).toBeUndefined();
    expect(
      toTimeline(
        [0, 1, 2, 1, 2].map((frame) => ({ frame, durationMs: 10 })),
        true,
      ),
    ).toEqual({
      steps: [
        { frame: 0, durationMs: 10 },
        { frame: 1, durationMs: 10 },
        { frame: 2, durationMs: 10 },
      ],
      loopFrom: 1,
      loopInferred: true,
    });
    expect(() =>
      toTimeline(
        [
          { frame: 0, durationMs: 10 },
          { frame: 1, durationMs: 10 },
        ],
        true,
      ),
    ).toThrow(/neither settles nor ends in a cycle/);
  });
});

describe("boot", () => {
  it("has ten full frames and the 9888 ms D12 timeline; frame 0 is blank", () => {
    expect(BOOT_FRAMES).toHaveLength(10);
    for (const frame of BOOT_FRAMES) expect([frame.width, frame.height]).toEqual([84, 48]);
    expect(BOOT_FRAMES[0]!.pixels.every((p) => p === 0)).toBe(true);
    expect(BOOT_TIMELINE.durationMs).toBe(9888);
    expect(BOOT_TIMELINE.steps.map((s) => s.frame)).toEqual([0, 1, 0, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(BOOT_TIMELINE.steps.at(-1)!.durationMs).toBe(4231);
  });
});
