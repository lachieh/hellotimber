import { describe, expect, it } from "vite-plus/test";
import { Framebuffer } from "../src/framebuffer";
import {
  BATTERY_ICON,
  drawBatteryLevel,
  drawSignalLevel,
  SIGNAL_ICON,
  SMS_ICON,
  VOICEMAIL_ICON,
} from "../src/icons/status";
import { expectPixels } from "./helpers";

describe("reference status sprites", () => {
  it("pins the signal, battery, voicemail, and SMS bitmaps", () => {
    expectPixelsFromBitmap(SIGNAL_ICON, ["#.#.#", ".###.", "..#..", "..#..", "..#..", "..#.."]);
    expectPixelsFromBitmap(BATTERY_ICON, ["..#..", "#####", "#...#", "#...#", "#...#", "#####"]);
    expectPixelsFromBitmap(VOICEMAIL_ICON, [
      ".##...##.",
      "#..#.#..#",
      "#..#.#..#",
      ".##...##.",
      "...###...",
      "..#...#..",
    ]);
    expectPixelsFromBitmap(SMS_ICON, [
      "########",
      "#......#",
      "##....##",
      "#.#..#.#",
      "#..##..#",
      "########",
    ]);
  });

  it("uses integral dimensions and binary pixels", () => {
    for (const sprite of [SIGNAL_ICON, BATTERY_ICON, VOICEMAIL_ICON, SMS_ICON]) {
      expect(Number.isInteger(sprite.width)).toBe(true);
      expect(Number.isInteger(sprite.height)).toBe(true);
      expect(sprite.pixels).toHaveLength(sprite.width * sprite.height);
      expect([...sprite.pixels].every((pixel) => pixel === 0 || pixel === 1)).toBe(true);
    }
  });
});

describe("standby ladders", () => {
  it("always places the 5x6 signal and battery icons at the bottom", () => {
    const fb = new Framebuffer();
    drawSignalLevel(fb, 0);
    drawBatteryLevel(fb, 0);
    expectPixels(fb, 0, 32, "#.#.#\n.###.\n..#..\n..#..\n..#..\n..#..");
    expectPixels(fb, 79, 32, "..#..\n#####\n#...#\n#...#\n#...#\n#####");
  });

  it.each([
    [0, []],
    [1, [[0, 24, 2, 6]]],
    [
      2,
      [
        [0, 24, 2, 6],
        [0, 16, 2, 6],
      ],
    ],
    [
      3,
      [
        [0, 24, 2, 6],
        [0, 16, 2, 6],
        [0, 8, 3, 6],
      ],
    ],
    [
      4,
      [
        [0, 24, 2, 6],
        [0, 16, 2, 6],
        [0, 8, 3, 6],
        [0, 0, 4, 6],
      ],
    ],
  ] as const)("draws signal level %i with unequal six-pixel bars", (level, bars) => {
    const fb = new Framebuffer();
    drawSignalLevel(fb, level);
    expectBarGeometry(fb, bars, 0, 31);
  });

  it.each([
    [0, []],
    [1, [[82, 24, 2, 6]]],
    [
      2,
      [
        [82, 24, 2, 6],
        [82, 16, 2, 6],
      ],
    ],
    [
      3,
      [
        [82, 24, 2, 6],
        [82, 16, 2, 6],
        [81, 8, 3, 6],
      ],
    ],
    [
      4,
      [
        [82, 24, 2, 6],
        [82, 16, 2, 6],
        [81, 8, 3, 6],
        [80, 0, 4, 6],
      ],
    ],
  ] as const)("draws battery level %i mirrored against the outer edge", (level, bars) => {
    const fb = new Framebuffer();
    drawBatteryLevel(fb, level);
    expectBarGeometry(fb, bars, 79, 31);
  });
});

function expectPixelsFromBitmap(
  bitmap: { width: number; height: number; pixels: Uint8Array },
  rows: string[],
): void {
  expect(bitmap.width).toBe(rows[0]!.length);
  expect(bitmap.height).toBe(rows.length);
  expect(
    Array.from(bitmap.pixels, (pixel) => (pixel === 1 ? "#" : "."))
      .join("")
      .match(new RegExp(`.{${bitmap.width}}`, "g")),
  ).toEqual(rows);
}

function expectBarGeometry(
  fb: Framebuffer,
  bars: readonly (readonly [number, number, number, number])[],
  minX: number,
  maxY: number,
): void {
  const expected = new Set<string>();
  for (const [x, y, width, height] of bars) {
    for (let yy = y; yy < y + height; yy++) {
      for (let xx = x; xx < x + width; xx++) expected.add(`${xx},${yy}`);
    }
  }
  for (let y = 0; y <= maxY; y++) {
    for (let x = minX; x < 84; x++) {
      if (minX === 0 && x > 3) break;
      if (minX === 79 && x < 79) continue;
      expect(fb.getPixel(x, y), `${x},${y}`).toBe(expected.has(`${x},${y}`) ? 1 : 0);
    }
  }
}
