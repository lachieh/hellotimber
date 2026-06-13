import { describe, expect, it } from "vite-plus/test";
import { FONT } from "../src/font/font";
import { Framebuffer } from "../src/framebuffer";
import { HANDS_FRAMES } from "../src/icons/boot";
import { renderBoot } from "../src/render/boot";
import { wrapText, truncate } from "../src/render/layout";
import { regionToArt } from "./helpers";

describe("layout helpers", () => {
  it("truncate keeps short text and ellipsizes long text", () => {
    expect(truncate("Menu", 14)).toBe("Menu");
    expect(truncate("Fourteen chars", 14)).toBe("Fourteen chars");
    expect(truncate("Fifteen chars!!", 14)).toBe("Fifteen chars…");
  });

  it("wrapText greedy-wraps at 14 chars and hard-breaks long words", () => {
    expect(wrapText("hello world")).toEqual(["hello world"]);
    expect(wrapText("the quick brown fox jumps")).toEqual(["the quick", "brown fox", "jumps"]);
    expect(wrapText("antidisestablishmentarianism")).toEqual(["antidisestabli", "shmentarianism"]);
    expect(wrapText("a\nb")).toEqual(["a", "b"]);
  });
});

describe("HANDS_FRAMES", () => {
  it("is 4 frames of 84×30, pairwise distinct", () => {
    expect(HANDS_FRAMES).toHaveLength(4);
    const seen = new Set<string>();
    for (const frame of HANDS_FRAMES) {
      expect(frame.width).toBe(84);
      expect(frame.height).toBe(30);
      expect(frame.pixels.length).toBe(84 * 30);
      seen.add(frame.pixels.join(""));
    }
    expect(seen.size).toBe(4);
  });

  it("hands meet in the middle only in the final frame", () => {
    const mid = 14 * 84 + 40; // row 14, col 40 of the 84-wide frame
    expect(HANDS_FRAMES[0]!.pixels[mid]).toBe(0);
    expect(HANDS_FRAMES[3]!.pixels[mid]).toBe(1);
  });
});

describe("renderBoot", () => {
  it("hands phase: blits the mapped frame and the NOKIA wordmark bottom-right", () => {
    const fb = new Framebuffer();
    renderBoot(fb, { kind: "boot", phase: "hands", frame: 0 }, "Welcome!");
    const expected = new Framebuffer();
    expected.blitBitmap(HANDS_FRAMES[0]!, 0, 4);
    expected.drawText(FONT, "NOKIA", 53, 40); // 82 - textWidth("NOKIA")=29 → x 53
    expect(regionToArt(fb, 0, 0, 84, 48)).toBe(regionToArt(expected, 0, 0, 84, 48));
  });

  it("advances one art frame every 3 model frames and holds the clasp", () => {
    const art = (frame: number): string => {
      const fb = new Framebuffer();
      renderBoot(fb, { kind: "boot", phase: "hands", frame }, "Welcome!");
      return regionToArt(fb, 0, 0, 84, 48);
    };
    expect(art(0)).toBe(art(2));
    expect(art(0)).not.toBe(art(3));
    expect(art(9)).toBe(art(100)); // clamped at the final clasped frame
  });

  it("welcome phase: renders the host welcome text centered", () => {
    const fb = new Framebuffer();
    renderBoot(fb, { kind: "boot", phase: "welcome", frame: 0 }, "Hello!");
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "Hello!", 20); // 1 line → top = (48-8)/2
    expect(regionToArt(fb, 0, 0, 84, 48)).toBe(regionToArt(expected, 0, 0, 84, 48));
  });

  it("welcome phase wraps long text onto centered lines", () => {
    const fb = new Framebuffer();
    renderBoot(fb, { kind: "boot", phase: "welcome", frame: 0 }, "Hello brave new world");
    const expected = new Framebuffer();
    expected.drawTextCentered(FONT, "Hello brave", 16); // 2 lines → top = (48-16)/2
    expected.drawTextCentered(FONT, "new world", 24);
    expect(regionToArt(fb, 0, 0, 84, 48)).toBe(regionToArt(expected, 0, 0, 84, 48));
  });
});
