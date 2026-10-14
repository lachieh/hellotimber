import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { paintStockScreen } from "../src/index";
import { BOOT_TIMELINE } from "../src/resources";
import { expectLcd } from "./support/golden.ts";
import { loadGolden } from "./support/goldens.ts";

describe("stock boot", () => {
  const golden = loadGolden("boot/power-on");

  golden.timeline!.forEach((row, i) => {
    it(`boot step ${i} (frame ${BOOT_TIMELINE.steps[i]!.frame}) matches boot/power-on image "${row.image}"`, () => {
      const fb = new Framebuffer();
      fb.clear(1);
      paintStockScreen(fb, { kind: "boot", phase: "hands", frame: BOOT_TIMELINE.steps[i]!.frame });
      expectLcd(
        fb,
        { id: golden.id, image: golden.images.find((im) => im.name === row.image)! },
        `boot step ${i}`,
      );
    });
  });

  it("paints off as a blank LCD", () => {
    const fb = new Framebuffer();
    fb.clear(1);
    paintStockScreen(fb, { kind: "off" });
    expect(fb.pixels.every((p) => p === 0)).toBe(true);
  });

  it("rejects a boot frame the resources do not have", () => {
    expect(() =>
      paintStockScreen(new Framebuffer(), { kind: "boot", phase: "hands", frame: 10 }),
    ).toThrow(/boot frame 10/);
  });
});
