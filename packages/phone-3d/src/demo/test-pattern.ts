export interface TestPattern {
  /** Native 84×48 canvas — the screen texture source. */
  canvas: HTMLCanvasElement;
  /** Increments on every drawFrame(); feed to screenVersion. */
  version: number;
  /** Redraw: alternate checkerboard, bump frame counter, bump version. */
  drawFrame(): void;
}

/** A two-colour LCD, like the real panel and phone-screen's default palette:
 *  mostly background, so the backlight's gradient and the ink's shadow show. */
const LCD_FG = "#43523d";
const LCD_BG = "#c7f0d8";

export function createTestPattern(): TestPattern {
  const canvas = document.createElement("canvas");
  canvas.width = 84;
  canvas.height = 48;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context unavailable");
  let frame = 0;

  const pattern: TestPattern = {
    canvas,
    version: 0,
    drawFrame() {
      ctx.fillStyle = LCD_BG;
      ctx.fillRect(0, 0, 84, 48);
      ctx.fillStyle = LCD_FG;
      // 1px frame inset by one pixel
      ctx.fillRect(1, 1, 82, 1);
      ctx.fillRect(1, 46, 82, 1);
      ctx.fillRect(1, 1, 1, 46);
      ctx.fillRect(82, 1, 1, 46);
      // 2px checkerboard block, alternating each frame
      for (let cy = 0; cy < 8; cy++) {
        for (let cx = 0; cx < 8; cx++) {
          if ((cx + cy + frame) % 2 === 0) ctx.fillRect(5 + cx * 2, 5 + cy * 2, 2, 2);
        }
      }
      // rising bars, like the signal indicator
      for (let i = 0; i < 5; i++) ctx.fillRect(66 + i * 3, 21 - i * 3, 2, 3 + i * 3);
      // frame counter
      ctx.font = "10px monospace";
      ctx.textBaseline = "top";
      ctx.fillText(String(frame).padStart(5, "0"), 26, 27);
      // snap the anti-aliased text to the two LCD colours
      const img = ctx.getImageData(0, 0, 84, 48);
      for (let i = 0; i < img.data.length; i += 4) {
        const ink = img.data[i + 1]! < 150;
        img.data.set(ink ? [0x43, 0x52, 0x3d, 255] : [0xc7, 0xf0, 0xd8, 255], i);
      }
      ctx.putImageData(img, 0, 0);
      frame += 1;
      pattern.version += 1;
    },
  };
  pattern.drawFrame();
  return pattern;
}
