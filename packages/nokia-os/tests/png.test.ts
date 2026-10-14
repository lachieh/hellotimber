import { deflateSync, crc32 } from "node:zlib";
import { describe, expect, it } from "vite-plus/test";
import { decodeIndexedPng, decodeLcdPng } from "../scripts/png.ts";

// A small PNG encoder for building test inputs: indexed colour, any filter per row.

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

interface EncodeOptions {
  width: number;
  height: number;
  bitDepth: number;
  colorType?: number;
  interlace?: number;
  /** Filter type per row (cycled). */
  filters?: number[];
  indices: number[];
}

function encodePng(options: EncodeOptions): Uint8Array {
  const { width, height, bitDepth, colorType = 3, interlace = 0, filters = [0] } = options;
  const stride = Math.ceil((width * bitDepth) / 8);
  const raw: number[] = [];
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const line = new Uint8Array(stride);
    for (let x = 0; x < width; x++) {
      const value = options.indices[y * width + x]!;
      const bit = x * bitDepth;
      line[bit >> 3]! |= value << (8 - bitDepth - (bit & 7));
    }
    const filter = filters[y % filters.length]!;
    raw.push(filter);
    for (let i = 0; i < stride; i++) {
      const a = i > 0 ? line[i - 1]! : 0;
      const b = previous[i]!;
      const c = i > 0 ? previous[i - 1]! : 0;
      const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter]!;
      raw.push((line[i]! - predictor) & 0xff);
    }
    previous = line;
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([bitDepth, colorType, 0, 0, interlace], 8);
  const palette = new Uint8Array([255, 255, 255, 0, 0, 0, 9, 9, 9]);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("PLTE", palette),
    chunk("IDAT", deflateSync(new Uint8Array(raw))),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Deterministic test pattern with enough variation to exercise every predictor. */
function pattern(width: number, height: number, max: number): number[] {
  return Array.from(
    { length: width * height },
    (_, i) => (i * 7 + ((i / width) | 0) * 3) % (max + 1),
  );
}

describe("png decoder", () => {
  for (const filter of [0, 1, 2, 3, 4]) {
    it(`decodes 1-bit indexed rows with filter ${filter}`, () => {
      const indices = pattern(13, 5, 1);
      const png = encodePng({ width: 13, height: 5, bitDepth: 1, filters: [filter], indices });
      expect(decodeIndexedPng(png)).toEqual({
        width: 13,
        height: 5,
        indices: Uint8Array.from(indices),
      });
    });

    it(`decodes 8-bit indexed rows with filter ${filter}`, () => {
      const indices = pattern(9, 4, 2);
      const png = encodePng({ width: 9, height: 4, bitDepth: 8, filters: [filter], indices });
      expect(decodeIndexedPng(png)).toEqual({
        width: 9,
        height: 4,
        indices: Uint8Array.from(indices),
      });
    });
  }

  it("decodes mixed filters across rows", () => {
    const indices = pattern(20, 10, 1);
    const png = encodePng({
      width: 20,
      height: 10,
      bitDepth: 1,
      filters: [4, 0, 3, 1, 2],
      indices,
    });
    expect(decodeIndexedPng(png).indices).toEqual(Uint8Array.from(indices));
  });

  it("maps palette index 1 to a lit LCD pixel and checks the 84x48 size", () => {
    const indices = Array.from({ length: 84 * 48 }, () => 0);
    indices[0] = 1;
    indices[84 * 47 + 83] = 1;
    indices[5] = 2;
    const lcd = decodeLcdPng(encodePng({ width: 84, height: 48, bitDepth: 8, indices }), "x.png");
    expect(lcd[0]).toBe(1);
    expect(lcd[84 * 47 + 83]).toBe(1);
    expect(lcd[5]).toBe(0);
    expect(lcd.reduce((n, v) => n + v, 0)).toBe(2);
    expect(() =>
      decodeLcdPng(
        encodePng({
          width: 8,
          height: 2,
          bitDepth: 1,
          indices: Array.from({ length: 16 }, () => 0),
        }),
        "small.png",
      ),
    ).toThrow("small.png: expected an 84x48 LCD capture, got 8x2");
  });

  it("rejects interlaced, truecolour, unsupported depths and corrupt data", () => {
    const base = { width: 4, height: 2, indices: Array.from({ length: 8 }, () => 0) };
    expect(() => decodeIndexedPng(encodePng({ ...base, bitDepth: 1, interlace: 1 }))).toThrow(
      "interlaced PNGs are not supported",
    );
    expect(() => decodeIndexedPng(encodePng({ ...base, bitDepth: 8, colorType: 2 }))).toThrow(
      "only indexed-colour PNGs are supported (colour type 2)",
    );
    expect(() => decodeIndexedPng(encodePng({ ...base, bitDepth: 4 }))).toThrow(
      "only 1- and 8-bit indexed PNGs are supported (bit depth 4)",
    );
    expect(() => decodeIndexedPng(new Uint8Array([1, 2, 3]))).toThrow("not a PNG file");
    const corrupt = encodePng({ ...base, bitDepth: 1 });
    corrupt[20] = corrupt[20]! ^ 0xff; // inside IHDR, so its CRC no longer matches
    expect(() => decodeIndexedPng(corrupt)).toThrow("IHDR chunk CRC mismatch");
  });

  it("rejects unknown filter types", () => {
    const png = encodePng({ width: 4, height: 1, bitDepth: 8, indices: [0, 1, 0, 1] });
    expect(decodeIndexedPng(png).indices).toEqual(Uint8Array.from([0, 1, 0, 1]));
    // Signature (8) + IHDR chunk (12 + 13) + PLTE chunk (12 + 9): IDAT starts at byte 54.
    const head = png.subarray(0, 54);
    const idat = chunk("IDAT", deflateSync(new Uint8Array([7, 0, 1, 0, 1])));
    const rebuilt = new Uint8Array([...head, ...idat, ...chunk("IEND", new Uint8Array())]);
    expect(() => decodeIndexedPng(rebuilt)).toThrow("unsupported PNG filter type 7 on row 0");
  });
});
