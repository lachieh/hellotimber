// Plan 32 Phase 1: the host's signal and battery ports leave the captured standby alone by default.
import type { Phone, StatusLevel } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { createStockPhone, paintStockScreen, type StockPhoneConfig } from "../src/index";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";

function standby(config: Partial<StockPhoneConfig> = {}): Phone {
  const phone = createStockPhone({ carrier: "Orange F", boot: "skip", ...config });
  phone.tick(0);
  phone.pressKey("power", 1000);
  phone.tick(3000);
  return phone;
}

function painted(phone: Phone): Framebuffer {
  const fb = new Framebuffer();
  paintStockScreen(fb, phone.screen);
  return fb;
}

/** Lit pixels in column x over rows y0..y1 (a ladder's bars). */
function lit(fb: Framebuffer, x: number, y0: number, y1: number): number {
  let count = 0;
  for (let y = y0; y <= y1; y++) count += fb.getPixel(x, y);
  return count;
}

describe("signal and battery ports", () => {
  it("keeps full ladders by default and draws the same standby at full levels", () => {
    const plain = standby();
    expect(plain.screen).toMatchObject({ kind: "standby", signal: 4, battery: 4 });
    const full = (): StatusLevel => 4;
    expect(painted(standby({ signal: full, battery: full })).pixels).toEqual(painted(plain).pixels);
  });

  it("paints the captured standby for the full-level model", () => {
    const screen = standby({ signal: () => 4, battery: () => 4 }).screen;
    if (screen.kind !== "standby") throw new Error(screen.kind);
    const fb = new Framebuffer();
    paintStockScreen(fb, { ...screen, clock: "10:10" });
    expectLcd(fb, goldenImage("standby/standby", "01-standby"), "standby at full levels");
  });

  it("drops ladder bars as the host's levels fall, and follows them live", () => {
    let signal: StatusLevel = 4;
    let battery: StatusLevel = 4;
    const phone = standby({ signal: () => signal, battery: () => battery });
    const full = painted(phone);
    signal = 1;
    battery = 0;
    phone.tick(4000);
    expect(phone.screen).toMatchObject({ kind: "standby", signal: 1, battery: 0 });
    const low = painted(phone);
    // The signal ladder sits at x 0-3, the battery ladder from x 80 (keyguard.ts).
    expect(lit(low, 0, 0, 47)).toBeLessThan(lit(full, 0, 0, 47));
    expect(lit(low, 83, 0, 47)).toBeLessThan(lit(full, 83, 0, 47));
  });
});
