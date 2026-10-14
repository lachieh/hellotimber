// Generate the harvester's text runs for plan 18's goldens (plan 18 Task 3).
//
//   mise exec -- vp run @hellotimber/nokia-os#messages-text-runs /path/to/nokia-3310
//
// Reads plan 18 Task 0's glyph manifests and OCR (`plan18/glyphs/<face>/manifest.json`,
// `plan18/text.json`), plan 15's OCR (`plan15/text.json`) and their PNGs, and writes
// `scripts/generated/messages-text-runs.ts`: runs per image of every golden in
// `goldens/index/18.json`, registered by `scripts/resource-inputs/18-messages-and-chat.ts`.
//
// - glyph sheets and key cycles: one character per image, from the manifest (the character
//   typed), in the cell band the screen draws it in;
// - every other image: its capture's OCR runs (matched by pixels, plan 14 Task 3's mapping),
//   except runs that `messagesOcrRuns` drops (see there).
//
// Idempotent. Runs under Node's type stripping: imports only node:*, sibling scripts.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseGolden } from "./golden-format.ts";
import { readPlanIndex } from "./golden-index.ts";
import type { TextRun } from "./harvest-glyphs.ts";
import type { GlyphShot } from "./messages-capture-set.ts";
import { decodeLcdPng } from "./png.ts";
import { harvestRuns, type OcrRun } from "./tree-model.ts";

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDENS = join(PACKAGE, "goldens");
const OUT = join(PACKAGE, "scripts/generated/messages-text-runs.ts");

/** Where a glyph sheet's character sits: the editor's first line, the Name: prompt's box. */
export const GLYPH_BANDS: Readonly<Record<"small" | "large", Omit<TextRun, "text">>> = {
  // plan18/glyphs/small: the editor's first text line (small, top 8 from x 1; plan 18 S6).
  small: { font: "small", top: 8, left: 0, right: 83 },
  // plan18/glyphs/large: Add name's entry box (x 0 and x 83 are its frame), large at top 18.
  large: { font: "large", top: 18, left: 1, right: 82 },
};

/** The single-character run of a glyph sheet or key cycle image (none for the space). */
export function glyphRun(face: "small" | "large", char: string): TextRun[] {
  return char === " " ? [] : [{ ...GLYPH_BANDS[face], text: char }];
}

/** OCR reads parts of art (an inverted symbol cell, `text/symbols` use-last-before) as `ı`. */
const ART = /^ı$/;

/** Harvester runs from an image's OCR runs (plan 14's mapping), without art read as `ı`. */
export function messagesOcrRuns(runs: readonly OcrRun[], where: string): TextRun[] {
  return harvestRuns(
    runs.filter((run) => !ART.test(run.text.trim())),
    where,
  );
}

function fail(message: string): never {
  console.error(`messages-text-runs: ${message}`);
  process.exit(1);
}

function pixelKey(pixels: Uint8Array): string {
  return createHash("sha256").update(pixels).digest("hex");
}

/** OCR runs of every captured image under `captures/6.39/<plan>/`, by pixels. */
function ocrByPixels(root: string, plan: string, into: Map<string, OcrRun[]>): void {
  const path = join(root, plan, "text.json");
  if (!existsSync(path)) fail(`missing ${path}: run that plan's Task 0 OCR`);
  const ocr = JSON.parse(readFileSync(path, "utf8")) as Record<string, OcrRun[]>;
  for (const rel of Object.keys(ocr).sort()) {
    const png = join(root, plan, rel);
    if (!existsSync(png)) continue;
    const key = pixelKey(decodeLcdPng(readFileSync(png), png));
    if (!into.has(key)) into.set(key, ocr[rel]!);
  }
}

function manifest(root: string, face: string): readonly GlyphShot[] {
  const path = join(root, "plan18/glyphs", face, "manifest.json");
  if (!existsSync(path)) fail(`missing ${path}: run plan 18 Task 0`);
  return JSON.parse(readFileSync(path, "utf8")) as GlyphShot[];
}

function main(): void {
  const ref = process.argv[2];
  if (!ref) fail("usage: messages-text-runs <REF> (the nokia-3310 capture corpus directory)");
  const root = join(resolve(ref), "captures/6.39");
  if (!existsSync(root)) fail(`missing ${root}: pass the nokia-3310 corpus directory as REF`);

  const ocr = new Map<string, OcrRun[]>();
  ocrByPixels(root, "plan18", ocr);
  ocrByPixels(root, "plan15", ocr);
  const small = manifest(root, "small");
  const large = manifest(root, "large");
  const byFile = (shots: readonly GlyphShot[], file: string): GlyphShot => {
    const shot = shots.find((s) => s.file === file);
    if (!shot) fail(`no manifest entry for ${file}`);
    return shot;
  };

  const out: Record<string, Record<string, TextRun[]>> = {};
  for (const entry of readPlanIndex(GOLDENS, "18")) {
    if (entry.kind !== "still" && entry.kind !== "timeline") continue;
    const golden = parseGolden(readFileSync(join(GOLDENS, entry.file), "utf8"), entry.file);
    const images: Record<string, TextRun[]> = {};
    const key = /^text\/key-(\d)-(upper|lower)$/.exec(entry.id);
    for (const image of golden.images) {
      let runs: TextRun[];
      if (entry.id === "glyphs/small" || entry.id === "glyphs/large") {
        const face = entry.id === "glyphs/small" ? "small" : "large";
        runs = glyphRun(face, byFile(face === "small" ? small : large, `${image.name}.png`).char);
      } else if (entry.id === "glyphs/digits") {
        continue; // header specimens: hand-written runs
      } else if (key) {
        const shot = small.find(
          (s) =>
            s.source === "multitap" &&
            s.key === key[1] &&
            s.mode === key[2] &&
            s.press === Number(image.name),
        );
        if (!shot) fail(`${entry.id} ${image.name}: no manifest shot for this press`);
        runs = glyphRun("small", shot.char);
      } else {
        const found = ocr.get(pixelKey(image.pixels));
        if (found === undefined) fail(`${entry.id} image "${image.name}": no OCR'd capture`);
        runs = messagesOcrRuns(found, `${entry.id} ${image.name}`);
      }
      if (runs.length > 0) images[image.name] = runs;
    }
    if (Object.keys(images).length > 0) out[entry.id] = images;
  }

  const text =
    `// GENERATED by scripts/messages-text-runs.ts from goldens/, plan18/glyphs manifests and ` +
    `plan18/plan15 text.json - do not edit\n` +
    `// Text runs of every plan 18 golden image, registered by resource-inputs/18-messages-and-chat.ts.\n` +
    `export const MESSAGES_TEXT_RUNS: Readonly<Record<string, Readonly<Record<string, readonly {\n` +
    `  readonly font: "small" | "large" | "digits" | "thin";\n  readonly text: string;\n` +
    `  readonly top: number;\n  readonly inverted?: boolean;\n  readonly left?: number;\n` +
    `  readonly right?: number;\n}[]>>>> = {\n` +
    Object.entries(out)
      .map(
        ([id, images]) =>
          `  ${JSON.stringify(id)}: {\n` +
          Object.entries(images)
            .map(([name, runs]) => `    ${JSON.stringify(name)}: ${JSON.stringify(runs)},\n`)
            .join("") +
          `  },\n`,
      )
      .join("") +
    `};\n`;
  mkdirSync(dirname(OUT), { recursive: true });
  if (existsSync(OUT) && readFileSync(OUT, "utf8") === text) {
    console.log("messages-text-runs: up to date");
    return;
  }
  writeFileSync(OUT, text);
  console.log(
    `messages-text-runs: ${Object.keys(out).length} goldens, ${Object.values(out).reduce((n, i) => n + Object.keys(i).length, 0)} images`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
