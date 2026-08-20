import { describe, expect, it } from "vite-plus/test";
import {
  BACKLIGHT_COLOR,
  LCD_GLOW_INTENSITY,
  LEGEND_GLOW_COLOR,
  LEGEND_GLOW_INTENSITY,
  MATERIALS,
  PRINT_DARK,
  PRINT_LIGHT,
  SCREEN_DIM_TINT,
} from "../src/materials";

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
    expect(LEGEND_GLOW_COLOR).toMatch(HEX);
    expect(SCREEN_DIM_TINT).toMatch(HEX);
  });

  it("keeps the NaviKey blue distinct from the grey keys", () => {
    expect(MATERIALS.navi.color).not.toBe(MATERIALS.key.color);
  });

  it("defines valid print colors (dark print on keys, light print on the shell)", () => {
    expect(PRINT_LIGHT).toMatch(HEX);
    expect(PRINT_DARK).toMatch(HEX);
    expect(PRINT_LIGHT).not.toBe(PRINT_DARK);
  });

  it("backlight illuminates the translucent legends rather than the silver caps", () => {
    for (const i of [LEGEND_GLOW_INTENSITY, LCD_GLOW_INTENSITY]) {
      expect(i).toBeGreaterThan(0);
      expect(i).toBeLessThanOrEqual(2);
    }
    expect(LEGEND_GLOW_INTENSITY).toBeLessThanOrEqual(1);
  });
});
