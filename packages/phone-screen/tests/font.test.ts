import { expect, it } from "vite-plus/test";
import { createPixelFont, textWidth } from "../src/font/font";

it("validates glyph height and an explicitly supplied fallback", () => {
  expect(() => createPixelFont({ x: ["#"] }, 2, 1)).toThrow(/expected 2/);
  expect(() => createPixelFont({ x: ["#"] }, 1, 1, "?")).toThrow(/fallback/);
});
it("measures variable-width consumer glyphs and rejects unknown input without fallback", () => {
  const font = createPixelFont({ x: ["##"], i: ["#"] }, 1, 2);
  expect(textWidth(font, "")).toBe(0);
  expect(textWidth(font, "xi")).toBe(3);
  expect(textWidth(font, "xi", 2)).toBe(6);
  expect(() => textWidth(font, "?")).toThrow(/unknown glyph/);
});
