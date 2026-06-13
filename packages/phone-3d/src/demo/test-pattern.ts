export interface TestPattern {
  /** Native 84×48 canvas — the screen texture source. */
  canvas: HTMLCanvasElement;
  /** Increments on every drawFrame(); feed to screenVersion. */
  version: number;
  /** Redraw: alternate checkerboard, bump frame counter, bump version. */
  drawFrame(): void;
}

export function createTestPattern(): TestPattern {
  const canvas = document.createElement("canvas");
  canvas.width = 84;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  let frame = 0;

  const pattern: TestPattern = {
    canvas,
    version: 0,
    drawFrame() {
      const cell = 6; // 14 × 8 cells
      for (let cy = 0; cy < 48 / cell; cy++) {
        for (let cx = 0; cx < 84 / cell; cx++) {
          ctx.fillStyle = (cx + cy + frame) % 2 === 0 ? "#9bbf3b" : "#2b3a1e";
          ctx.fillRect(cx * cell, cy * cell, cell, cell);
        }
      }
      // Frame counter plate, centered
      ctx.fillStyle = "#9bbf3b";
      ctx.fillRect(22, 18, 40, 12);
      ctx.strokeStyle = "#1c2a12";
      ctx.strokeRect(22.5, 18.5, 39, 11);
      ctx.fillStyle = "#1c2a12";
      ctx.font = "10px monospace";
      ctx.textBaseline = "top";
      ctx.fillText(String(frame).padStart(5, "0"), 26, 19);
      frame += 1;
      pattern.version += 1;
    },
  };
  pattern.drawFrame();
  return pattern;
}
