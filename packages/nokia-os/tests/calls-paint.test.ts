// Plan 22: the telephone's painters against their goldens' images (literal models).
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, it } from "vite-plus/test";
import { paintWidget, type WidgetModel } from "@hellotimber/nokia-kit/ui/display/widgets";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";

function expectPainted(model: WidgetModel, id: string, image: string): void {
  const fb = new Framebuffer();
  paintWidget(fb, model);
  expectLcd(fb, goldenImage(id, image), `${id} ${image}: ${JSON.stringify(model)}`);
}

/** The 47-character layout string of `entry/length` (Task 0's LAYOUT). */
const LAYOUT = "+1234p5w6*7#8901" + "2345678901234567" + "+0p9w8*7#6543210";

describe("standby number entry", () => {
  it("lays out 1-47 characters in the large and the small face", () => {
    for (let n = 1; n <= 47; n++) {
      const image = String(n).padStart(2, "0");
      expectPainted(
        { kind: "dial-entry", text: LAYOUT.slice(0, n), softkey: "Call", clock: "10:10" },
        "calls/entry-length",
        image,
      );
    }
  });

  it("draws the soft keys", () => {
    expectPainted(
      { kind: "dial-entry", text: "12345", softkey: "Save", clock: "10:10" },
      "calls/entry-softkey-down",
      "01",
    );
    expectPainted(
      { kind: "dial-entry", text: "12345", softkey: "Convert", clock: "10:10" },
      "calls/entry-softkey-down",
      "02",
    );
  });
});

describe("call screens", () => {
  it("draws Calling, its number and dots", () => {
    expectPainted(
      {
        kind: "call",
        body: { kind: "calling", dots: 1 },
        softkey: "End",
        clock: "10:10",
        handset: false,
      },
      "calls/dial-call",
      "b",
    );
    for (const [image, dots] of [
      ["c", 1],
      ["d", 2],
      ["e", 3],
      ["f", 0],
    ] as const) {
      expectPainted(
        {
          kind: "call",
          body: { kind: "calling", dots, number: "0412345678" },
          softkey: "End",
          clock: "10:10",
          handset: true,
        },
        "calls/dial-call",
        image,
      );
    }
  });

  it("draws the blank redraw and the call", () => {
    expectPainted(
      { kind: "call", body: { kind: "blank" }, softkey: "End", clock: "10:10", handset: true },
      "calls/dial-call",
      "g",
    );
    expectPainted(
      {
        kind: "call",
        body: { kind: "call", label: "Call 1" },
        softkey: "End",
        clock: "10:10",
        handset: true,
      },
      "calls/dial-call",
      "h",
    );
    expectPainted(
      {
        kind: "call",
        body: { kind: "call", label: "Call 1", ended: true },
        softkey: "End",
        clock: "10:10",
        handset: true,
      },
      "calls/dial-net-end-connected",
      "i",
    );
  });

  it("draws Attempting emergency call", () => {
    expectPainted(
      { kind: "call", body: { kind: "emergency" }, softkey: "End", clock: "10:10", handset: true },
      "calls/dial-number-112",
      "b",
    );
  });

  it("draws long numbers on two lines", () => {
    expectPainted(
      {
        kind: "call",
        body: { kind: "calling", dots: 1, number: "12345678901234567890" },
        softkey: "End",
        clock: "10:10",
        handset: true,
      },
      "calls/dial-number-twenty",
      "c",
    );
    expectPainted(
      {
        kind: "call",
        body: { kind: "calling", dots: 1, number: "12345678901234567890123456789012" },
        softkey: "End",
        clock: "10:10",
        handset: true,
      },
      "calls/dial-number-thirty-two",
      "c",
    );
  });

  it("draws the ringing screen", () => {
    expectPainted(
      { kind: "ringing", number: "0412345678", calling: true },
      "calls/ring-screen",
      "b",
    );
    expectPainted(
      { kind: "ringing", number: "0412345678", calling: false },
      "calls/ring-screen",
      "c",
    );
    expectPainted(
      { kind: "ringing", number: "12345678901234567890", calling: true },
      "calls/ring-number-12345678901234567890",
      "b",
    );
    expectPainted(
      { kind: "ringing", number: "+61412345678", calling: true },
      "calls/ring-number-plus61412345678",
      "b",
    );
  });

  it("draws Volume", () => {
    expectPainted({ kind: "volume", level: 10 }, "calls/in-call-up", "c");
    expectPainted({ kind: "volume", level: 1 }, "calls/in-call-down-steps", "k");
  });
});
