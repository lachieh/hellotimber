// Import REF emulator captures as committed LCD golden fixtures.
//
//   mise exec -- vp run @hellotimber/nokia-os#import-captures /path/to/nokia-3310
//
// Executes scripts/capture-set.ts plus the plan 14 tree selection (scripts/tree-capture-set.ts
// over `captures/6.39/tree.json`), writes goldens/<id>.lcd.txt and goldens/index.json, and
// deletes fixtures the tables no longer produce. Idempotent: a second run changes nothing.
// Runs under Node's type stripping: imports only node:* and sibling scripts with .ts extensions.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAPTURE_SET,
  NOT_IMPORTED,
  type CaptureSetEntry,
  type CaptureSource,
  type FrameRange,
  type SourceChoice,
} from "./capture-set.ts";
import {
  parseGolden,
  serializeGolden,
  timelineImageName,
  type Golden,
  type GoldenImage,
  type GoldenTimelineRow,
  type LcdMode,
} from "./golden-format.ts";
import { decodeLcdPng } from "./png.ts";
import {
  probeCaptureSet,
  treeCaptureSet,
  type RecordingFrame,
  type TreeCaptureIo,
  type TreeJson,
} from "./tree-capture-set.ts";

const CAPTURES = "captures/6.39";
const GOLDENS = resolve(dirname(fileURLToPath(import.meta.url)), "../goldens");

interface IndexEntry {
  id: string;
  file: string;
  status: string;
  kind: "still" | "timeline";
  images: number;
  frames: number;
  covers?: readonly string[];
}

interface TimingRow {
  frame: number;
  startMs: number;
  lcd: LcdMode;
  leds: number;
  durationMs: number;
}

const LCD_MODES: Record<string, LcdMode> = { "0": "blank", "2": "normal", "3": "inverse" };

function main(): void {
  const ref = process.argv[2];
  if (!ref) fail("usage: import-captures <REF> (the nokia-3310 capture corpus directory)");
  const root = join(resolve(ref), CAPTURES);
  if (!existsSync(root)) fail(`missing ${root}: pass the nokia-3310 corpus directory as REF`);

  const treePath = join(root, "tree.json");
  if (!existsSync(treePath)) fail(`missing ${treePath}: the plan 14 menu-tree crawl`);
  const tree = JSON.parse(readFileSync(treePath, "utf8")) as TreeJson;
  let treeEntries: CaptureSetEntry[];
  try {
    treeEntries = [...probeCaptureSet(captureIo(root)), ...treeCaptureSet(tree, captureIo(root))];
  } catch (error) {
    return fail((error as Error).message);
  }

  const written = new Set<string>();
  const index: IndexEntry[] = [];
  const fallbacks: string[] = [];
  for (const entry of [...CAPTURE_SET, ...treeEntries]) {
    const choice = chooseSource(root, entry);
    if (!choice) {
      console.log(`skip  ${entry.id} (optional; no capture)`);
      continue;
    }
    if (choice === entry.fallback) {
      fallbacks.push(entry.id);
      console.log(
        `FALLBACK ${entry.id}: ${describe(entry.prefer.source)} missing; using ${describe(choice.source)}`,
      );
    }
    const golden = buildGolden(root, entry, choice);
    const text = serializeGolden(golden);
    parseGolden(text, `${entry.id}.lcd.txt`); // the importer never writes an invalid fixture
    const file = `${entry.id}.lcd.txt`;
    const path = join(GOLDENS, file);
    mkdirSync(dirname(path), { recursive: true });
    writeIfChanged(path, text);
    written.add(path);
    index.push({
      id: golden.id,
      file,
      status: golden.status,
      kind: entry.kind,
      images: golden.images.length,
      frames: golden.timeline ? golden.timeline.length : golden.images.length,
      ...(golden.covers ? { covers: golden.covers } : {}),
    });
  }

  for (const stale of listFixtures(GOLDENS)) {
    if (!written.has(stale)) {
      rmSync(stale);
      console.log(`removed stale ${relative(GOLDENS, stale)}`);
    }
  }
  index.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  writeIfChanged(join(GOLDENS, "index.json"), `${JSON.stringify(index, null, 2)}\n`);

  const asserted = index.filter((e) => e.status === "asserted").length;
  console.log(
    `\n${index.length} fixtures (${asserted} asserted, ${index.length - asserted} pending) in ${relative(process.cwd(), GOLDENS) || "."}`,
  );
  console.log(fallbacks.length ? `fallbacks: ${fallbacks.join(", ")}` : "fallbacks: none");
  console.log("not imported (artefacts / out of scope):");
  for (const [what, why] of Object.entries(NOT_IMPORTED)) console.log(`  ${what}: ${why}`);
}

function fail(message: string): never {
  console.error(`import-captures: ${message}`);
  process.exit(1);
}

function describe(source: CaptureSource): string {
  switch (source.kind) {
    case "shot":
      return source.file;
    case "recording":
    case "scroll":
      return source.dir;
    case "shots":
      return source.files.join(" + ");
    case "composite":
      return source.parts.map((p) => `${p.dir} ${pad3(p.from)}-${pad3(p.to)}`).join(" + ");
  }
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function available(root: string, source: CaptureSource): boolean {
  switch (source.kind) {
    case "shot":
      return existsSync(join(root, source.file));
    case "recording":
      return existsSync(join(root, source.dir, "timings.csv"));
    case "scroll":
      return (
        existsSync(join(root, source.dir)) &&
        readdirSync(join(root, source.dir)).some((f) => /^\d+\.png$/.test(f))
      );
    case "shots":
      return source.files.every((file) => existsSync(join(root, file)));
    case "composite":
      return source.parts.every((p) => existsSync(join(root, p.dir, "timings.csv")));
  }
}

function chooseSource(root: string, entry: CaptureSetEntry): SourceChoice | undefined {
  if (available(root, entry.prefer.source)) return entry.prefer;
  if (entry.fallback && available(root, entry.fallback.source)) return entry.fallback;
  if (entry.optional) return undefined;
  return fail(
    `${entry.id}: no capture at ${describe(entry.prefer.source)}${
      entry.fallback ? ` or ${describe(entry.fallback.source)}` : ""
    }`,
  );
}

function buildGolden(root: string, entry: CaptureSetEntry, choice: SourceChoice): Golden {
  const hash = createHash("sha256");
  const omitted = Object.entries(choice.omitted ?? {}).map(([name, reason]) => ({ name, reason }));
  const base = {
    id: entry.id,
    status: entry.status,
    source: sourceLabel(choice.source),
    ...(choice.triggerFrame !== undefined ? { triggerFrame: choice.triggerFrame } : {}),
    ...(choice.note !== undefined ? { note: choice.note } : {}),
    omitted,
    ...(entry.scenario !== undefined
      ? { scenario: entry.scenario, covers: entry.covers ?? [] }
      : {}),
  };
  const source = choice.source;
  if (entry.kind === "still") {
    let files: { name: string; path: string }[];
    if (source.kind === "shot") {
      files = [
        { name: basename(source.file).replace(/\.png$/, ""), path: join(root, source.file) },
      ];
    } else if (source.kind === "scroll") {
      const omit = new Set(omitted.map((o) => o.name));
      files = readdirSync(join(root, source.dir))
        .filter((f) => /^\d+\.png$/.test(f))
        .sort()
        .map((f) => ({ name: f.replace(/\.png$/, ""), path: join(root, source.dir, f) }))
        .filter((f) => !omit.has(f.name));
      for (const name of omit) {
        if (!existsSync(join(root, source.dir, `${name}.png`))) {
          fail(`${entry.id}: omitted image ${name} does not exist in ${source.dir}`);
        }
      }
    } else if (source.kind === "shots") {
      files = source.files.map((file) => ({
        name: basename(file).replace(/\.png$/, ""),
        path: join(root, file),
      }));
    } else {
      return fail(`${entry.id}: a still needs a shot, shots or scroll source`);
    }
    const images: GoldenImage[] = files.map(({ name, path }) => {
      const bytes = readFileSync(path);
      hash.update(bytes);
      return { name, pixels: decodeLcdPng(bytes, path) };
    });
    return { ...base, sourceSha256: hash.digest("hex"), images };
  }

  let parts: FrameRange[];
  if (source.kind === "recording") parts = [{ dir: source.dir, from: 0, to: Infinity }];
  else if (source.kind === "composite") parts = [...source.parts];
  else return fail(`${entry.id}: a timeline needs a recording or composite source`);

  const images: GoldenImage[] = [];
  const imageByContent = new Map<string, string>();
  const timeline: GoldenTimelineRow[] = [];
  let cursor: number | undefined;
  parts.forEach((part, partIndex) => {
    const csvPath = join(root, part.dir, "timings.csv");
    const rows = parseTimings(readFileSync(csvPath, "utf8"), csvPath);
    const to = Math.min(part.to, rows.length - 1);
    if (part.from > to) fail(`${entry.id}: ${part.dir} has no frames ${part.from}-${part.to}`);
    // Cumulative rounding (D9): round absolute starts, derive durations from neighbours.
    const startAt = (i: number): number =>
      i < rows.length
        ? Math.round(rows[i]!.startMs)
        : Math.round(rows[i - 1]!.startMs + rows[i - 1]!.durationMs);
    const offset = cursor === undefined ? 0 : cursor - startAt(part.from);
    for (let i = part.from; i <= to; i++) {
      const row = rows[i]!;
      const pngPath = join(root, part.dir, `${pad3(i)}.png`);
      const bytes = readFileSync(pngPath);
      hash.update(bytes);
      const pixels = decodeLcdPng(bytes, pngPath);
      const key = Buffer.from(pixels).toString("base64");
      let name = imageByContent.get(key);
      if (name === undefined) {
        name = timelineImageName(images.length);
        imageByContent.set(key, name);
        images.push({ name, pixels });
      }
      const lowerBound = i === rows.length - 1;
      if (lowerBound && partIndex !== parts.length - 1) {
        fail(`${entry.id}: ${part.dir} ends with a cut-off frame but is not the last part`);
      }
      timeline.push({
        frame: timeline.length,
        image: name,
        startMs: startAt(i) + offset,
        durationMs: startAt(i + 1) - startAt(i),
        lowerBound,
        lcd: row.lcd,
        leds: row.leds,
      });
    }
    hash.update(readFileSync(csvPath));
    cursor = startAt(to + 1) + offset;
  });
  return { ...base, sourceSha256: hash.digest("hex"), images, timeline };
}

/** Reads plan 14 captures for the tree selection: recordings by pixel content, scroll names. */
function captureIo(root: string): TreeCaptureIo {
  return {
    recording(dir: string): RecordingFrame[] | undefined {
      const csvPath = join(root, dir, "timings.csv");
      if (!existsSync(csvPath)) return undefined;
      return parseTimings(readFileSync(csvPath, "utf8"), csvPath).map((row) => {
        const pngPath = join(root, dir, `${pad3(row.frame)}.png`);
        const pixels = decodeLcdPng(readFileSync(pngPath), pngPath);
        return {
          image: createHash("sha256").update(pixels).digest("hex"),
          startMs: row.startMs,
          durationMs: row.durationMs,
        };
      });
    },
    scrollImages(dir: string): string[] | undefined {
      if (!existsSync(join(root, dir))) return undefined;
      return readdirSync(join(root, dir))
        .filter((f) => /^\d+\.png$/.test(f))
        .sort()
        .map((f) => f.replace(/\.png$/, ""));
    },
  };
}

function sourceLabel(source: CaptureSource): string {
  if (source.kind === "shots") return source.files.map((f) => `${CAPTURES}/${f}`).join(" + ");
  if (source.kind === "composite") {
    return source.parts
      .map((p) => `${CAPTURES}/${p.dir} ${pad3(p.from)}-${pad3(p.to)}`)
      .join(" + ");
  }
  return `${CAPTURES}/${describe(source)}`;
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function parseTimings(text: string, path: string): TimingRow[] {
  const lines = text.trim().split("\n");
  if (lines[0] !== "frame,start_ms,lcd_mode,leds,duration_ms")
    fail(`${path}: unexpected header "${lines[0]}"`);
  return lines.slice(1).map((line, i) => {
    const cells = line.split(",");
    const lcd = LCD_MODES[cells[2] ?? ""];
    if (cells.length !== 5 || Number(cells[0]) !== i || !lcd)
      fail(`${path}:${i + 2}: bad row "${line}"`);
    return {
      frame: i,
      startMs: Number(cells[1]),
      lcd: lcd!,
      leds: Number(cells[3]),
      durationMs: Number(cells[4]),
    };
  });
}

function listFixtures(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFixtures(path));
    else if (entry.name.endsWith(".lcd.txt")) out.push(path);
  }
  return out;
}

function writeIfChanged(path: string, text: string): void {
  if (existsSync(path) && readFileSync(path, "utf8") === text) return;
  writeFileSync(path, text);
}

main();
