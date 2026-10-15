// Plan 17 Task 3: the profiles' glyphs, the standby icon and the timings measured from the
// goldens (generated freshness is tests/resources.test.ts's).
import { describe, expect, it } from "vite-plus/test";
import { PROFILE_LINE_DELAY_MS } from "../src/firmware/features/profiles";
import {
  missingStockGlyphs,
  WIDGET_SPRITES,
  WIDGET_TIMELINE_BY_NAME,
  WIDGET_TIMELINE_BY_NODE,
  WIDGET_TIMELINES,
} from "../src/resources";
import { TYPEABLE } from "../src/text/keys";
import { loadGolden } from "./support/goldens.ts";

/** Every name a profile has before a rename: virgin (slot 6's boxes) and factory. */
const DEFAULT_NAMES = ["General", "Silent", "Discreet", "Loud", "(empty)", "\uE000\uE000"];

describe("profile glyphs", () => {
  it("draws every default name in the small, large and thin faces", () => {
    for (const font of ["small", "large", "thin"] as const) {
      for (const name of DEFAULT_NAMES) expect(missingStockGlyphs(name, font), font).toEqual([]);
    }
  });

  it("draws every typeable character in the thin face (the Rename page)", () => {
    expect(missingStockGlyphs([...TYPEABLE].join(""), "thin")).toEqual([]);
  });
});

describe("profile sprites and timelines", () => {
  it("crops the silent icon top left, between the signal icon and the clock", () => {
    const icon = WIDGET_SPRITES["profiles/silent"]!;
    expect({ x: icon.x, y: icon.y, w: icon.bitmap.width, h: icon.bitmap.height }).toEqual({
      x: 7,
      y: 0,
      w: 7,
      h: 6,
    });
  });

  it("times each slot's Activate note from its own recording (tick, then the edges step)", () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const id = WIDGET_TIMELINE_BY_NODE[`12-${n}-1`];
      expect(id, `12-${n}-1`).toBeDefined();
      const timeline = WIDGET_TIMELINES[id!]!;
      expect(timeline.frames.map((f) => f.kind)).toEqual(["sprite", "sprite", "sprite", "edges"]);
    }
    for (const name of ["rename-done", "power-invalid-shortcut"]) {
      expect(WIDGET_TIMELINE_BY_NAME[name], name).toBeDefined();
    }
  });

  it("delays the standby name by the median of its goldens (1898-1913 ms after a note)", () => {
    const delays = ["silent", "discreet", "loud", "empty", "empty-2"].map((slug) => {
      const rows = loadGolden(`profiles/activate-${slug}`).timeline!;
      // Trigger, box, half, tick, edges, standby, then the name.
      return rows[6]!.startMs - rows[5]!.startMs;
    });
    for (const n of [2, 3, 4, 5, 6]) {
      const rows = loadGolden(`tree/12-profiles/12-${n}-1.leaf`).timeline!;
      delays.push(rows[6]!.startMs - rows[5]!.startMs);
    }
    const sorted = [...delays].sort((a, b) => a - b);
    expect(sorted[0]).toBeGreaterThanOrEqual(1898);
    expect(sorted[sorted.length - 1]).toBeLessThanOrEqual(1913);
    expect(PROFILE_LINE_DELAY_MS).toBe(sorted[Math.floor(sorted.length / 2)]);
  });
});
