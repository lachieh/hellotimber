import { describe, expect, it } from "vite-plus/test";
import {
  BACKLIGHT_COLOR,
  LCD_GLOW_INTENSITY,
  LEGEND_GLOW_COLOR,
  LEGEND_GLOW_INTENSITY,
  MATERIALS,
  legendEmission,
  PRINT_DARK,
  PRINT_LIGHT,
  SCREEN_DIM_TINT,
  SCREEN_LIT_PIXEL_TINT,
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
    expect(SCREEN_LIT_PIXEL_TINT).toMatch(HEX);
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
  });
});

/** WCAG relative luminance of a #rrggbb colour (linear sRGB). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("keypad light emission", () => {
  // Before plan 25 the legends and the NaviKey bar glowed #496847 × 0.6, which
  // reads at about a tenth of a real 3310's keypad lights (TODOS.md).
  const before = luminance("#496847") * 0.6;

  it.each(["legend", "naviBar"] as const)("lit %s glows at least 8× the old keypad", (part) => {
    const { color, intensity } = legendEmission(part, true);
    expect(color).toMatch(HEX);
    expect(luminance(color) * intensity).toBeGreaterThanOrEqual(8 * before);
  });

  it.each(["legend", "naviBar"] as const)("unlit %s does not glow", (part) => {
    expect(legendEmission(part, false).intensity).toBe(0);
  });

  it("the legend glow constants are the lit legend emission", () => {
    expect(legendEmission("legend", true)).toEqual({
      color: LEGEND_GLOW_COLOR,
      intensity: LEGEND_GLOW_INTENSITY,
    });
  });
});
