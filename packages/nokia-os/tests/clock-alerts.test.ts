// Plan 21: the alerts' painter against the plan21 alert frames (standby layout, D3's family).
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, it } from "vite-plus/test";
import { paintWidget, type AlertModel } from "@hellotimber/nokia-kit/ui/display/widgets";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";

const alert = (m: Omit<AlertModel, "kind">): Framebuffer => {
  const fb = new Framebuffer();
  paintWidget(fb, { kind: "alert", ...m });
  return fb;
};

describe("alert painter", () => {
  it.each([
    [
      "clock/countdown/expire-standby",
      "b",
      {
        clock: "10:10",
        indicators: { timer: true },
        lines: ["Countdown", "time up"],
        align: "block",
        sprites: ["clock/bells-1"],
        softkey: "OK",
      },
    ],
    [
      "reminders/alert-key-snooze",
      "a",
      {
        clock: "10:11",
        lines: ["A"],
        align: "left",
        sprites: ["reminder/alert"],
        softkey: "Snooze",
      },
    ],
    [
      "clock/alarm/ring-factory-standby",
      "d",
      {
        clock: "10:11",
        indicators: { alarm: true },
        lines: ["Alarm!", "10:11"],
        align: "block",
        sprites: ["clock/bells-3"],
        softkey: "Snooze",
      },
    ],
    [
      "clock/alarm/ring-factory-standby",
      "b",
      {
        clock: "10:11",
        indicators: { alarm: true },
        lines: [],
        align: "centre",
        sprites: ["clock/bells-1"],
        softkey: "Snooze",
      },
    ],
    [
      "clock/alarm/ring-factory-key-snooze",
      "b",
      {
        clock: "10:11",
        indicators: { alarm: true },
        lines: ["Snooze", "active"],
        align: "left",
        softkey: "Stop",
      },
    ],
  ] as const)("%s %s", (id, image, model) => {
    expectLcd(alert(model as Omit<AlertModel, "kind">), goldenImage(id, image), `${id} ${image}`);
  });
});
