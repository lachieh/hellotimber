// Plan 18c Task 3: the resources its goldens declare (scripts/resource-inputs/18c-*), regenerated
// into src/resources/generated/widgets.ts (tests/resources.test.ts checks their freshness).
import { describe, expect, it } from "vite-plus/test";
import { WIDGET_SPRITES, WIDGET_TIMELINE_BY_NAME } from "../src/resources";

describe("plan 18c resources", () => {
  it("name a timeline for each note its screens show", () => {
    for (const name of [
      "template-saved",
      "smiley-saved",
      "template-erased",
      "smiley-erased",
      "topic-added",
      "topic-saved",
      "topic-erased",
      "service-not-done",
    ]) {
      expect(WIDGET_TIMELINE_BY_NAME[name], name).toBeDefined();
    }
  });

  it("crop the template row icon (6×7, left of the band)", () => {
    const icon = WIDGET_SPRITES["content/template"]!;
    expect([icon.bitmap.width, icon.bitmap.height, icon.x]).toEqual([6, 7, 1]);
  });
});
