import type { ScreenModel } from "@hellotimber/phone-core";
import { Framebuffer } from "./framebuffer";
import { renderScreen } from "./render";

export interface ScreenRenderer {
  readonly canvas: HTMLCanvasElement; // 84×48 logical px, scaled by opts.scale
  render(screen: ScreenModel): void; // draw + bump version when output changes
  readonly version: number; // increments on visible change
}

export interface ScreenRendererOptions {
  scale?: number; // default 1: native 84×48 — three.js NearestFilter and CSS
  // image-rendering:pixelated handle upscaling crisply
  fg?: string;
  bg?: string; // default classic green LCD palette
  /** Boot 'welcome' phase text (the boot ScreenModel carries none). Default "Welcome!". */
  welcomeText?: string;
}

const LCD_FG = "#43523d";
const LCD_BG = "#c7f0d8";

function parseHexColor(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match === null) throw new Error(`invalid color '${hex}' — expected #rrggbb`);
  const n = Number.parseInt(match[1]!, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * Create the canvas-backed screen renderer. The ONLY DOM-touching code in
 * this package, and only inside this function — module import stays
 * node-safe for tests and SSR.
 */
export function createScreenRenderer(opts: ScreenRendererOptions = {}): ScreenRenderer {
  const scale = Math.max(1, Math.floor(opts.scale ?? 1));
  const fg = parseHexColor(opts.fg ?? LCD_FG);
  const bg = parseHexColor(opts.bg ?? LCD_BG);
  const welcomeText = opts.welcomeText ?? "Welcome!";

  const fb = new Framebuffer();
  const canvas = document.createElement("canvas");
  canvas.width = fb.width * scale;
  canvas.height = fb.height * scale;
  const maybeCtx = canvas.getContext("2d");
  if (maybeCtx === null) throw new Error("2D canvas context unavailable");
  const ctx: CanvasRenderingContext2D = maybeCtx; // non-null beyond this point
  const image = ctx.createImageData(canvas.width, canvas.height);

  let previous: Uint8Array | null = null;
  let version = 0;

  function paint(): void {
    const data = image.data;
    for (let y = 0; y < fb.height; y++) {
      for (let x = 0; x < fb.width; x++) {
        const color = fb.pixels[y * fb.width + x] === 1 ? fg : bg;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const i = ((y * scale + sy) * canvas.width + x * scale + sx) * 4;
            data[i] = color[0];
            data[i + 1] = color[1];
            data[i + 2] = color[2];
            data[i + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(image, 0, 0); // ctx is a narrowed const — null was thrown above
  }

  function samePixels(a: Uint8Array, b: Uint8Array): boolean {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  return {
    canvas,
    get version(): number {
      return version;
    },
    render(screen: ScreenModel): void {
      renderScreen(fb, screen, { welcomeText });
      if (previous !== null && samePixels(previous, fb.pixels)) return;
      previous ??= new Uint8Array(fb.pixels.length);
      previous.set(fb.pixels);
      paint();
      version += 1;
    },
  };
}
