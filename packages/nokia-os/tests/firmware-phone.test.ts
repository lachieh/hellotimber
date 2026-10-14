import type { Phone } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { createStockPhone, type StockPhoneConfig } from "../src/index";
import { BOOT_TIMELINE } from "../src/resources";

function poweredOn(config: Partial<StockPhoneConfig> = {}): Phone {
  const phone = createStockPhone({ carrier: "Orange F", boot: "skip", ...config });
  phone.tick(0);
  phone.pressKey("power", 1000);
  return phone;
}

describe("createStockPhone", () => {
  it("rejects a carrier the small font cannot draw and names the characters", () => {
    expect(() => createStockPhone({ carrier: "Zap-1 Zone" })).toThrow(
      'Carrier "Zap-1 Zone" has characters the stock small font lacks: "Z", "-", "1".',
    );
    expect(() => createStockPhone({ carrier: "Telstra" })).not.toThrow();
  });

  it("starts powered off; boot: skip reaches standby on power-on", () => {
    const phone = createStockPhone({ carrier: "Telstra", boot: "skip" });
    expect(phone.screen).toEqual({ kind: "off" });
    phone.tick(0);
    phone.pressKey("power", 1000);
    expect(phone.path).toBe("standby");
    expect(phone.screen).toMatchObject({ kind: "standby", carrier: "Telstra" });
  });

  it("boots through the captured boot timeline, then standby", () => {
    const phone = createStockPhone({ carrier: "Orange F" });
    phone.tick(0);
    phone.send({ type: "down", key: "power" });
    phone.tick(800);
    const poweredAt = 800;
    let start = 0;
    for (const step of BOOT_TIMELINE.steps) {
      for (const at of [start, start + step.durationMs - 1]) {
        phone.tick(poweredAt + at);
        expect(phone.screen, `${at} ms`).toEqual({
          kind: "boot",
          phase: "hands",
          frame: step.frame,
        });
      }
      start += step.durationMs;
    }
    phone.tick(poweredAt + BOOT_TIMELINE.durationMs);
    expect(phone.screen).toMatchObject({ kind: "standby" });
  });

  it("opens the stock standby ▲/▼ targets", () => {
    const up = poweredOn();
    up.pressKey("up");
    expect(up.path).toBe("menu/phone-book/search");
    const down = poweredOn();
    down.pressKey("down");
    expect(down.path).toBe("menu/call-register/dialled-numbers");
  });

  it("drives standby and the Clock pages from the clock and date ports", () => {
    let time = "10:10";
    const phone = poweredOn({ clock: () => time, date: () => "13.10.2026" });
    expect(phone.screen).toMatchObject({ kind: "standby", clock: "10:10" });
    time = "10:11";
    phone.tick(2000);
    expect(phone.screen).toMatchObject({ kind: "standby", clock: "10:11" });
    phone.navigate("menu/clock");
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ kind: "list", presentation: "pages", detail: "10:11" });
    phone.pressKey("down");
    expect(phone.screen).toMatchObject({ kind: "list", selected: 2, detail: "13.10.2026" });
  });

  it("keeps standby (ladders erased) for 39 ms after Menu and shows the dots for 2948 ms", () => {
    const phone = poweredOn();
    phone.tick(10_000);
    phone.pressKey("navi");
    expect(phone.screen).toMatchObject({ kind: "standby", leaving: true });
    phone.tick(10_038);
    expect(phone.screen).toMatchObject({ kind: "standby", leaving: true });
    phone.tick(10_039);
    expect(phone.screen).toMatchObject({
      kind: "menu-carousel",
      label: "Phone book",
      menuIndicator: { segments: [1], awaitingNext: false, awaitingFirst: true },
    });
    phone.tick(12_947);
    expect(phone.screen).toMatchObject({ menuIndicator: { awaitingFirst: true } });
    phone.tick(12_948);
    expect(phone.screen).toMatchObject({ menuIndicator: { segments: [1], awaitingNext: false } });
    expect(phone.screen).not.toHaveProperty("menuIndicator.awaitingFirst");
  });

  it("lists Call divert's last entry under its kept number 6", () => {
    const phone = poweredOn();
    phone.navigate("menu/call-divert");
    expect(phone.screen).toMatchObject({ kind: "list", itemOrders: [1, 2, 3, 4, 6] });
    phone.navigate("standby");
    phone.pressKey("navi");
    phone.pressKey("7");
    phone.pressKey("6");
    expect(phone.path).toBe("menu/call-divert/cancel-all-diverts");
  });
});
