// Minimal PNG decoder for the emulator's LCD captures: indexed colour, 1- or 8-bit depth,
// non-interlaced, filter types 0-4. Anything else is rejected rather than guessed at.
// Runs under Node's type stripping, so it imports only node:* modules.
import { crc32, inflateSync } from "node:zlib";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const LCD_WIDTH = 84;
const LCD_HEIGHT = 48;

export interface IndexedImage {
  readonly width: number;
  readonly height: number;
  /** One palette index per pixel, row-major. */
  readonly indices: Uint8Array;
}

export function decodeIndexedPng(bytes: Uint8Array): IndexedImage {
  if (bytes.length < 8 || SIGNATURE.some((b, i) => bytes[i] !== b)) {
    throw new Error("not a PNG file");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let header: { width: number; height: number; bitDepth: number } | undefined;
  const idat: Uint8Array[] = [];
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const end = offset + 8 + length;
    if (end + 4 > bytes.length) throw new Error(`truncated ${type} chunk`);
    const data = bytes.subarray(offset + 8, end);
    if (crc32(bytes.subarray(offset + 4, end)) !== view.getUint32(end)) {
      throw new Error(`${type} chunk CRC mismatch`);
    }
    if (type === "IHDR") header = readHeader(data);
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    offset = end + 4;
  }
  if (!header) throw new Error("missing IHDR chunk");
  if (idat.length === 0) throw new Error("missing IDAT chunk");
  const raw = inflateSync(Buffer.concat(idat));
  return {
    width: header.width,
    height: header.height,
    indices: unfilter(raw, header.width, header.height, header.bitDepth),
  };
}

/** An 84×48 capture as LCD pixels: palette index 1 is lit (1), everything else clear (0). */
export function decodeLcdPng(bytes: Uint8Array, name: string): Uint8Array {
  const image = decodeIndexedPng(bytes);
  if (image.width !== LCD_WIDTH || image.height !== LCD_HEIGHT) {
    throw new Error(
      `${name}: expected an ${LCD_WIDTH}x${LCD_HEIGHT} LCD capture, got ${image.width}x${image.height}`,
    );
  }
  return image.indices.map((index) => (index === 1 ? 1 : 0));
}

function readHeader(data: Uint8Array): { width: number; height: number; bitDepth: number } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = view.getUint32(0);
  const height = view.getUint32(4);
  const [bitDepth, colorType, compression, filter, interlace] = data.subarray(8, 13);
  if (colorType !== 3) {
    throw new Error(`only indexed-colour PNGs are supported (colour type ${colorType})`);
  }
  if (bitDepth !== 1 && bitDepth !== 8) {
    throw new Error(`only 1- and 8-bit indexed PNGs are supported (bit depth ${bitDepth})`);
  }
  if (compression !== 0 || filter !== 0)
    throw new Error("unknown PNG compression or filter method");
  if (interlace !== 0) throw new Error("interlaced PNGs are not supported");
  return { width, height, bitDepth };
}

function unfilter(raw: Uint8Array, width: number, height: number, bitDepth: number): Uint8Array {
  const stride = Math.ceil((width * bitDepth) / 8);
  const bpp = Math.max(1, bitDepth / 8); // bytes per complete pixel, at least 1 (PNG spec)
  if (raw.length < height * (stride + 1))
    throw new Error("image data is shorter than the header says");
  const indices = new Uint8Array(width * height);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1);
    const filter = raw[start]!;
    const line = raw.slice(start + 1, start + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp]! : 0;
      const b = previous[i]!;
      const c = i >= bpp ? previous[i - bpp]! : 0;
      let predictor: number;
      switch (filter) {
        case 0:
          predictor = 0;
          break;
        case 1:
          predictor = a;
          break;
        case 2:
          predictor = b;
          break;
        case 3:
          predictor = (a + b) >> 1;
          break;
        case 4:
          predictor = paeth(a, b, c);
          break;
        default:
          throw new Error(`unsupported PNG filter type ${filter} on row ${y}`);
      }
      line[i] = (line[i]! + predictor) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      if (bitDepth === 8) indices[y * width + x] = line[x]!;
      else indices[y * width + x] = (line[x >> 3]! >> (7 - (x & 7))) & 1;
    }
    previous = line;
  }
  return indices;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}
