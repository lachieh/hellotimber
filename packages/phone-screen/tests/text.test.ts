import { expect, it } from "vite-plus/test";
import { createPixelFont } from "../src/font/font";
import { Framebuffer } from "../src/framebuffer";
import { regionToArt } from "./helpers";

const font = createPixelFont({ A: ["#.", "##"], i: ["#", "#"], "?": ["##", "#."] }, 2, 2, "?");
it("draws variable-width glyphs and returns the next x", () => {
  const fb = new Framebuffer();
  expect(fb.drawText(font, "Ai", 0, 0)).toBe(3);
  expect(regionToArt(fb, 0, 0, 3, 2)).toBe(["#.#", "###"].join("\n"));
});
it("scales glyph pixels", () => {
  const fb = new Framebuffer();
  expect(fb.drawText(font, "A", 0, 0, { scale: 2 })).toBe(4);
  expect(regionToArt(fb, 0, 0, 4, 4)).toBe(["##..", "##..", "####", "####"].join("\n"));
});
it("draws inverted text", () => {
  const fb = new Framebuffer();
  fb.fillRect(0, 0, 2, 2, 1);
  fb.drawText(font, "A", 0, 0, { color: 0 });
  expect(regionToArt(fb, 0, 0, 2, 2)).toBe([".#", ".."].join("\n"));
});
it("uses the consumer's fallback glyph", () => {
  const fb = new Framebuffer();
  fb.drawText(font, "~", 0, 0);
  expect(regionToArt(fb, 0, 0, 2, 2)).toBe(["##", "#."].join("\n"));
});
it("centers variable-width text by its pixel width", () => {
  const fb = new Framebuffer();
  fb.drawTextCentered(font, "Ai", 0);
  expect(regionToArt(fb, 39, 0, 5, 2)).toBe([".#.#.", ".###."].join("\n"));
});
it("centers scaled text", () => {
  const fb = new Framebuffer();
  fb.drawTextCentered(font, "Ai", 0, { scale: 2 });
  expect(regionToArt(fb, 39, 0, 6, 4)).toBe(["##..##", "##..##", "######", "######"].join("\n"));
});
