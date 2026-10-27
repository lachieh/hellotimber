// Plan 21 Task 7: standby's clock (12-hour mark) and indicators (D10) against the plan21 stills.
import type { ScreenModel, StandbyIndicators } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, it } from "vite-plus/test";
import { paintStandby } from "../src/display/standby";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";

function standby(clock: string | undefined, indicators?: StandbyIndicators): Framebuffer {
  const screen: Extract<ScreenModel, { kind: "standby" }> = {
    kind: "standby",
    carrier: "Orange F",
    signal: 4,
    battery: 4,
    ...(clock === undefined ? {} : { clock }),
    ...(indicators === undefined ? {} : { indicators }),
  };
  const fb = new Framebuffer();
  paintStandby(fb, screen);
  return fb;
}

describe("standby's clock and indicators", () => {
  it.each([
    ["clock/settings/format", "24-0005-standby", "00:05"],
    ["clock/settings/format", "24-2359-standby", "23:59"],
    ["clock/settings/format", "12-0005-standby", "12:05 am"],
    ["clock/settings/format", "12-0941-standby", "09:41 am"],
    ["clock/settings/format", "12-1200-standby", "12:00 pm"],
    ["clock/settings/format", "12-1307-standby", "01:07 pm"],
    ["clock/settings/format", "12-2359-standby", "11:59 pm"],
  ] as const)("%s %s", (id, image, clock) => {
    expectLcd(standby(clock), goldenImage(id, image), `${id} ${image}`);
  });

  it.each([
    ["clock/alarm/screens", "standby-icon", "10:10", { alarm: true }],
    ["clock/countdown/screens", "standby-icon", "10:10", { timer: true }],
    ["clock/restore/screens", "before-standby-12h", "11:00 am", { alarm: true, timer: true }],
    ["clock/restore/screens", "before-standby", undefined, { alarm: true, timer: true }],
    ["clock/stopwatch/standby", "b", "10:10", { stopwatch: true }],
  ] as const)("%s %s", (id, image, clock, indicators) => {
    expectLcd(standby(clock, indicators), goldenImage(id, image), `${id} ${image}`);
  });
});
