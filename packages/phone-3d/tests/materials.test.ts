import { describe, expect, it } from "vite-plus/test";
import { BACKLIGHT_COLOR, MATERIALS, SCREEN_DIM_TINT } from "../src/materials";

const HEX = /^#[0-9a-f]{6}$/;

describe("MATERIALS", () => {
  it("uses valid lowercase hex colors and 0–1 PBR params", () => {
    for (const spec of Object.values(MATERIALS)) {
      expect(spec.color).toMatch(HEX);
      expect(spec.roughness).toBeGreaterThanOrEqual(0);
      expect(spec.roughness).toBeLessThanOrEqual(1);
      expect(spec.metalness).toBeGreaterThanOrEqual(0);
      expect(spec.metalness).toBeLessThanOrEqual(1);
    }
    expect(BACKLIGHT_COLOR).toMatch(HEX);
    expect(SCREEN_DIM_TINT).toMatch(HEX);
  });

  it("keeps the NaviKey blue distinct from the grey keys", () => {
    expect(MATERIALS.navi.color).not.toBe(MATERIALS.key.color);
  });
});
