import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { describeScreen, describeWidget } from "../src/ui/display/describe";
import {
  GAME_FRAME_BYTES,
  gameFrame,
  paintWidget,
  type GameFrameModel,
} from "../src/ui/display/widgets";
import { StockFlowApplication } from "../src/ui/widgets/flow";

const WIDTH = 84;
const HEIGHT = 48;

/** A packed frame with ink at the pixel indexes `ink` (row-major, MSB first). */
function packed(ink: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(GAME_FRAME_BYTES);
  for (const index of ink) bytes[index >> 3]! |= 0x80 >> (index & 7);
  return bytes;
}

/** The pixels a painted `model` leaves on a framebuffer that was all ink before. */
function painted(model: GameFrameModel): Uint8Array {
  const fb = new Framebuffer();
  fb.clear(1);
  paintWidget(fb, model);
  return fb.pixels;
}

describe("game-frame", () => {
  it("is the whole LCD in 504 bytes", () => {
    expect(GAME_FRAME_BYTES).toBe((WIDTH * HEIGHT) / 8);
  });

  it("carries the packed frame as base64", () => {
    const bytes = new Uint8Array(GAME_FRAME_BYTES);
    bytes[0] = 0x81;
    bytes[503] = 0x01;
    const frame = Buffer.from(bytes).toString("base64");
    expect(frame).toBe(`gQ${"A".repeat(669)}B`);
    expect(gameFrame(bytes)).toEqual({ kind: "game-frame", frame });
  });

  it("paints every pixel, row-major and MSB first, with no padding between rows", () => {
    // (0,0), (7,0), the row's last pixel, the next row's first (they share byte 10), the last.
    const ink = [0, 7, 83, 84, WIDTH * HEIGHT - 1];
    const expected = new Uint8Array(WIDTH * HEIGHT);
    for (const index of ink) expected[index] = 1;
    expect(painted(gameFrame(packed(ink)))).toEqual(expected);
  });

  it("paints clear pixels too: the frame is the whole screen", () => {
    expect(painted(gameFrame(packed([])))).toEqual(new Uint8Array(WIDTH * HEIGHT));
    const all = new Uint8Array(GAME_FRAME_BYTES).fill(0xff);
    expect(painted(gameFrame(all))).toEqual(new Uint8Array(WIDTH * HEIGHT).fill(1));
  });

  it("round-trips any frame pixel for pixel", () => {
    const ink: number[] = [];
    for (let i = 0; i < WIDTH * HEIGHT; i++) if ((i * 7919) % 5 < 2) ink.push(i);
    const pixels = painted(gameFrame(packed(ink)));
    expect([...pixels].flatMap((value, i) => (value === 1 ? [i] : []))).toEqual(ink);
  });

  it("refuses a frame that is not 504 bytes, packed or as base64", () => {
    expect(() => gameFrame(new Uint8Array(503))).toThrow("504");
    expect(() =>
      paintWidget(new Framebuffer(), { kind: "game-frame", frame: btoa("short") }),
    ).toThrow("504");
    expect(() =>
      paintWidget(new Framebuffer(), { kind: "game-frame", frame: "not base64!" }),
    ).toThrow("base64");
  });

  it("reads as a game screen", () => {
    expect(describeWidget(gameFrame(packed([])))).toBe("Game screen");
  });

  it("is compared by value in a flow: an equal frame keeps the screen, a changed one repaints", () => {
    let bytes = packed([0]);
    const session = new StockFlowApplication("test:game-frame", () => ({
      render: () => gameFrame(bytes),
    })).createSession({
      exit() {},
      open() {
        throw new Error("flows do not open applications");
      },
    });
    const first = session.render();
    expect(describeScreen(first)).toBe("Game screen");
    bytes = packed([0]);
    expect(session.render()).toBe(first);
    bytes = packed([1]);
    const second = session.render();
    expect(second).not.toBe(first);
    if (second.kind !== "custom") throw new Error("a flow shows custom screens");
    expect(second.frame.pixels[0]).toBe(0);
    expect(second.frame.pixels[1]).toBe(1);
  });
});
