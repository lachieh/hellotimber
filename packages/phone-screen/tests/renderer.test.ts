// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ScreenModel } from "@hellotimber/phone-core";
import { Framebuffer, renderScreen } from "../src/index";
import type { ScreenPainter } from "../src/index";
import { createScreenRenderer } from "../src/renderer";

interface FakeImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function stubCanvas2d(): { paints: FakeImageData[] } {
  const paints: FakeImageData[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
    const ctx = {
      createImageData: (w: number, h: number): FakeImageData => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData: (image: FakeImageData): void => {
        // copy so later mutations don't rewrite recorded paints
        paints.push({ ...image, data: new Uint8ClampedArray(image.data) });
      },
    };
    return ctx as unknown as CanvasRenderingContext2D;
  });
  return { paints };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const OFF: ScreenModel = { kind: "off" };
const STANDBY: ScreenModel = { kind: "standby", carrier: "LACHLAN", signal: 4, battery: 4 };

function customFrame(...setPixels: [number, number][]): ScreenModel {
  const pixels = new Uint8Array(84 * 48);
  for (const [x, y] of setPixels) pixels[y * 84 + x] = 1;
  return { kind: "custom", appId: "test", frame: { width: 84, height: 48, pixels } };
}

describe("createScreenRenderer", () => {
  it("owns an 84×48 canvas, scaled by opts.scale", () => {
    stubCanvas2d();
    expect(createScreenRenderer().canvas.width).toBe(84);
    expect(createScreenRenderer().canvas.height).toBe(48);
    const scaled = createScreenRenderer({ scale: 3 });
    expect(scaled.canvas.width).toBe(252);
    expect(scaled.canvas.height).toBe(144);
  });

  it("bumps version and repaints only on visible change", () => {
    const { paints } = stubCanvas2d();
    const r = createScreenRenderer();
    expect(r.version).toBe(0);
    r.render(OFF); // first frame always paints
    expect(r.version).toBe(1);
    expect(paints).toHaveLength(1);
    r.render(OFF); // identical pixels → no paint, no bump
    expect(r.version).toBe(1);
    expect(paints).toHaveLength(1);
    r.render(STANDBY);
    expect(r.version).toBe(2);
    expect(paints).toHaveLength(2);
    r.render(STANDBY);
    expect(r.version).toBe(2);
  });

  it("paints the default green LCD palette", () => {
    const { paints } = stubCanvas2d();
    const r = createScreenRenderer();
    r.render(customFrame([0, 0]));
    const data = paints[0]!.data;
    // pixel (0,0) is set → fg #43523d
    expect([data[0], data[1], data[2], data[3]]).toEqual([0x43, 0x52, 0x3d, 255]);
    // pixel (1,0) is clear → bg #c7f0d8
    expect([data[4], data[5], data[6], data[7]]).toEqual([0xc7, 0xf0, 0xd8, 255]);
  });

  it("honors custom fg/bg colors", () => {
    const { paints } = stubCanvas2d();
    const r = createScreenRenderer({ fg: "#000000", bg: "#ffffff" });
    r.render(customFrame([0, 0]));
    const data = paints[0]!.data;
    expect([data[0], data[1], data[2]]).toEqual([0, 0, 0]);
    expect([data[4], data[5], data[6]]).toEqual([255, 255, 255]);
  });

  it("expands each framebuffer pixel into a scale×scale block", () => {
    const { paints } = stubCanvas2d();
    const r = createScreenRenderer({ scale: 2 });
    r.render(customFrame([0, 0]));
    const { width, data } = paints[0]!;
    expect(width).toBe(168);
    const at = (x: number, y: number): number[] => {
      const i = (y * 168 + x) * 4;
      return [data[i]!, data[i + 1]!, data[i + 2]!];
    };
    const FG = [0x43, 0x52, 0x3d];
    const BG = [0xc7, 0xf0, 0xd8];
    expect(at(0, 0)).toEqual(FG);
    expect(at(1, 0)).toEqual(FG);
    expect(at(0, 1)).toEqual(FG);
    expect(at(1, 1)).toEqual(FG);
    expect(at(2, 0)).toEqual(BG);
    expect(at(0, 2)).toEqual(BG);
  });

  it("renders the boot welcome phase with the configured welcomeText", () => {
    const { paints } = stubCanvas2d();
    const a = createScreenRenderer({ welcomeText: "Hello!" });
    const b = createScreenRenderer({ welcomeText: "Other text" });
    const welcome: ScreenModel = { kind: "boot", phase: "welcome", frame: 0 };
    a.render(welcome);
    b.render(welcome);
    expect(paints[0]!.data).not.toEqual(paints[1]!.data);
  });
});

describe("createScreenRenderer with an injected painter", () => {
  const FG = [0x43, 0x52, 0x3d];
  const BG = [0xc7, 0xf0, 0xd8];
  const canvasPixel = (data: Uint8ClampedArray, i: number): number[] => [
    data[i * 4]!,
    data[i * 4 + 1]!,
    data[i * 4 + 2]!,
  ];

  it("lets the painter control every pixel", () => {
    const { paints } = stubCanvas2d();
    const seen: Array<[Framebuffer, ScreenModel]> = [];
    // Standby lights everything; anything else draws a checkerboard.
    const paint: ScreenPainter = (fb, screen) => {
      seen.push([fb, screen]);
      for (let i = 0; i < fb.pixels.length; i++) {
        fb.pixels[i] = screen.kind === "standby" ? 1 : ((i % 84) + Math.floor(i / 84)) % 2;
      }
    };
    const r = createScreenRenderer({ paint });
    r.render(STANDBY);
    r.render(OFF);
    expect(seen.map(([, screen]) => screen)).toEqual([STANDBY, OFF]);
    expect(seen[0]![0]).toBeInstanceOf(Framebuffer);
    for (let i = 0; i < 84 * 48; i++) {
      expect(canvasPixel(paints[0]!.data, i)).toEqual(FG);
      const lit = ((i % 84) + Math.floor(i / 84)) % 2 === 1;
      expect(canvasPixel(paints[1]!.data, i)).toEqual(lit ? FG : BG);
    }
  });

  it("bumps version only when the painted output changes", () => {
    const { paints } = stubCanvas2d();
    const constant: ScreenPainter = (fb) => {
      fb.clear(0);
      fb.setPixel(3, 4, 1);
    };
    const r = createScreenRenderer({ paint: constant });
    r.render(OFF);
    r.render(STANDBY); // different model, identical output
    expect(r.version).toBe(1);
    expect(paints).toHaveLength(1);
  });

  it("defaults to the existing renderer", () => {
    const { paints } = stubCanvas2d();
    const legacy: ScreenPainter = (fb, screen) =>
      renderScreen(fb, screen, { welcomeText: "Welcome!" });
    for (const screen of [STANDBY, { kind: "boot", phase: "welcome", frame: 0 } as const]) {
      createScreenRenderer().render(screen);
      createScreenRenderer({ paint: legacy }).render(screen);
    }
    expect(paints).toHaveLength(4);
    expect(paints[0]!.data).toEqual(paints[1]!.data);
    expect(paints[2]!.data).toEqual(paints[3]!.data);
  });

  it("rejects paint together with welcomeText at the type level", () => {
    stubCanvas2d();
    const paint: ScreenPainter = (fb) => fb.clear(0);
    // @ts-expect-error welcomeText belongs to the legacy painter only
    createScreenRenderer({ paint, welcomeText: "Hello!" });
    expect(createScreenRenderer({ paint, scale: 2 }).canvas.width).toBe(168);
  });
});
