// Import REF emulator captures as committed LCD golden fixtures.
//
//   mise exec -- vp run @hellotimber/nokia-os#import-captures /path/to/nokia-3310
//
// Executes every plan's capture set (scripts/capture-sets/index.ts: LCD goldens, tick fixtures and
// sound goldens, plan 25's lights goldens), writes goldens/<id>.lcd.txt, <id>.ticks.txt,
// <id>.sound.txt and <id>.lights.txt and one index
// per plan (goldens/index/<NN>.json, scripts/golden-index.ts), and deletes fixtures and index
// files the sets no longer produce. Idempotent: a second run changes nothing.
// Runs under Node's type stripping: imports only node:* and sibling scripts with .ts extensions.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CaptureIo,
  CaptureSetEntry,
  CaptureSource,
  FrameRange,
  PlanCaptureSet,
  SourceChoice,
} from "./capture-set.ts";
import { captureSets } from "./capture-registry.ts";
import type { GameCaptureIo, GameKeyRow } from "./game-capture-set.ts";
import {
  GOLDEN_INDEX_DIR,
  indexedPlans,
  planIndexPath,
  serializePlanIndex,
  type GoldenIndexEntry,
} from "./golden-index.ts";
import {
  parseGolden,
  parseTickGolden,
  serializeGolden,
  serializeTickGolden,
  timelineImageName,
  type Golden,
  type GoldenImage,
  type GoldenTimelineRow,
  type LcdMode,
  type TickGolden,
} from "./golden-format.ts";
import { parseLightsGolden, serializeLightsGolden, type LightsCaptureIo } from "./lights-format.ts";
import { decodeLcdPng } from "./png.ts";
import type { SoundCaptureIo } from "./sound-capture-set.ts";
import { parseSoundGolden, serializeSoundGolden } from "./sound-format.ts";
import type { RecordingFrame, TreeCaptureIo, TreeJson } from "./tree-capture-set.ts";

const CAPTURES = "captures/6.39";
const GOLDENS = resolve(dirname(fileURLToPath(import.meta.url)), "../goldens");

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
  const io: CaptureIo = {
    tree: JSON.parse(readFileSync(treePath, "utf8")) as TreeJson,
    frames: captureIo(root),
    game: gameIo(root),
    sound: soundIo(root),
    lights: lightsIo(root),
  };

  const sets = captureSets();
  const written = new Set<string>();
  const indexes = new Map<string, GoldenIndexEntry[]>();
  const fallbacks: string[] = [];
  const write = (plan: string, file: string, text: string, entry: GoldenIndexEntry): void => {
    const path = join(GOLDENS, file);
    if (written.has(path)) fail(`${entry.id}: listed twice`);
    mkdirSync(dirname(path), { recursive: true });
    writeIfChanged(path, text);
    written.add(path);
    indexes.get(plan)!.push(entry);
  };
  // Every set selects its goldens before anything is written.
  let planned: {
    readonly set: PlanCaptureSet;
    readonly lcd: readonly CaptureSetEntry[];
    readonly ticks: ReturnType<NonNullable<PlanCaptureSet["ticks"]>>;
    readonly sounds: ReturnType<NonNullable<PlanCaptureSet["sounds"]>>;
    readonly lights: ReturnType<NonNullable<PlanCaptureSet["lights"]>>;
  }[];
  try {
    planned = sets.map((set) => ({
      set,
      lcd: set.lcd?.(io) ?? [],
      ticks: set.ticks?.(io) ?? [],
      sounds: set.sounds?.(io) ?? [],
      lights: set.lights?.(io) ?? [],
    }));
  } catch (error) {
    return fail((error as Error).message);
  }
  for (const { set, lcd, ticks, sounds, lights } of planned) {
    indexes.set(set.plan, []);
    for (const entry of lcd) {
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
      const file = `${entry.id}.lcd.txt`;
      parseGolden(text, file); // the importer never writes an invalid fixture
      write(set.plan, file, text, {
        id: golden.id,
        file,
        status: golden.status,
        kind: entry.kind,
        images: golden.images.length,
        frames: golden.timeline ? golden.timeline.length : golden.images.length,
        ...(golden.covers ? { covers: golden.covers } : {}),
        ...(golden.input ? { input: true as const } : {}),
      });
    }

    for (const fixture of ticks) {
      const hash = createHash("sha256");
      for (const file of fixture.timings) hash.update(readFileSync(join(root, file)));
      const golden: TickGolden = {
        id: fixture.id,
        status: fixture.status,
        source: fixture.source,
        sourceSha256: hash.digest("hex"),
        note: fixture.note,
        rows: fixture.rows,
      };
      const text = serializeTickGolden(golden);
      const file = `${golden.id}.ticks.txt`;
      parseTickGolden(text, file);
      write(set.plan, file, text, {
        id: golden.id,
        file,
        status: golden.status,
        kind: "ticks",
        images: 0,
        frames: golden.rows.length,
      });
    }

    for (const golden of sounds) {
      const text = serializeSoundGolden(golden);
      const file = `${golden.id}.sound.txt`;
      parseSoundGolden(text, file); // the importer never writes an invalid fixture
      write(set.plan, file, text, {
        id: golden.id,
        file,
        status: golden.status,
        kind: "sound",
        events: golden.rows.length,
      });
    }

    for (const golden of lights) {
      const text = serializeLightsGolden(golden);
      const file = `${golden.id}.lights.txt`;
      parseLightsGolden(text, file); // the importer never writes an invalid fixture
      write(set.plan, file, text, {
        id: golden.id,
        file,
        status: golden.status,
        kind: "lights",
        events: golden.rows.length,
      });
    }
  }

  for (const stale of listFixtures(GOLDENS)) {
    if (!written.has(stale)) {
      rmSync(stale);
      console.log(`removed stale ${relative(GOLDENS, stale)}`);
    }
  }
  mkdirSync(join(GOLDENS, GOLDEN_INDEX_DIR), { recursive: true });
  for (const [plan, entries] of indexes) {
    writeIfChanged(planIndexPath(GOLDENS, plan), serializePlanIndex(entries));
  }
  for (const plan of indexedPlans(GOLDENS)) {
    if (indexes.has(plan)) continue;
    rmSync(planIndexPath(GOLDENS, plan));
    console.log(`removed stale ${GOLDEN_INDEX_DIR}/${plan}.json`);
  }

  const all = [...indexes.values()].flat();
  const asserted = all.filter((e) => e.status === "asserted").length;
  console.log(
    `\n${all.length} fixtures (${asserted} asserted, ${all.length - asserted} pending) in ${relative(process.cwd(), GOLDENS) || "."}`,
  );
  console.log(fallbacks.length ? `fallbacks: ${fallbacks.join(", ")}` : "fallbacks: none");
  console.log("not imported (artefacts / out of scope):");
  for (const set of sets) {
    for (const [what, why] of Object.entries(set.notImported ?? {})) {
      console.log(`  ${what}: ${why}`);
    }
  }
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
    case "frames":
      return `${source.frames.length} frames of ${[...new Set(source.frames.map((f) => f.dir))].join(" + ")}`;
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
    case "frames":
      return source.frames.every((f) => existsSync(join(root, f.dir, `${pad3(f.frame)}.png`)));
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
    ...(entry.input !== undefined ? { input: entry.input } : {}),
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
    } else if (source.kind === "frames") {
      files = source.frames.map((f) => ({
        name: f.name,
        path: join(root, f.dir, `${pad3(f.frame)}.png`),
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

/** Reads plan 23 recordings (pixels) and their keys.csv for the game set. */
function gameIo(root: string): GameCaptureIo {
  return {
    recording(dir: string) {
      const csvPath = join(root, dir, "timings.csv");
      if (!existsSync(csvPath)) return undefined;
      return parseTimings(readFileSync(csvPath, "utf8"), csvPath).map((row) => {
        const pngPath = join(root, dir, `${pad3(row.frame)}.png`);
        return {
          pixels: decodeLcdPng(readFileSync(pngPath), pngPath),
          startMs: row.startMs,
          durationMs: row.durationMs,
        };
      });
    },
    keys(dir: string): GameKeyRow[] | undefined {
      const path = join(root, dir, "keys.csv");
      if (!existsSync(path)) return undefined;
      const lines = readFileSync(path, "utf8").trim().split("\n");
      if (lines[0] !== "tick,key,press_ms") fail(`${path}: unexpected header "${lines[0]}"`);
      return lines.slice(1).map((line, i) => {
        const [tick, key, pressMs] = line.split(",");
        if (key === undefined || pressMs === undefined || !Number.isFinite(Number(pressMs))) {
          fail(`${path}:${i + 2}: bad row "${line}"`);
        }
        return { tick: Number(tick), key: key!, pressMs: Number(pressMs) };
      });
    },
  };
}

/** Reads plan 16 sound recordings: `<dir>.events.csv`, `<dir>/keys.csv`. */
function soundIo(root: string): SoundCaptureIo {
  const text = (path: string): string | undefined =>
    existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : undefined;
  return {
    events: (dir) => text(`${dir}.events.csv`),
    keys: (dir) => text(`${dir}/keys.csv`),
    sha256(dir) {
      const hash = createHash("sha256");
      hash.update(readFileSync(join(root, `${dir}.events.csv`)));
      hash.update(readFileSync(join(root, dir, "keys.csv")));
      return hash.digest("hex");
    },
    list: (dir) =>
      existsSync(join(root, dir))
        ? readdirSync(join(root, dir))
            .filter((f) => f.endsWith(".events.csv"))
            .map((f) => f.slice(0, -".events.csv".length))
        : [],
  };
}

/** Reads plan 25 LED logs: `<dir>.lights.csv`, `<dir>/keys.csv`. */
function lightsIo(root: string): LightsCaptureIo {
  const text = (path: string): string | undefined =>
    existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : undefined;
  return {
    lights: (dir) => text(`${dir}.lights.csv`),
    keys: (dir) => text(`${dir}/keys.csv`),
    sha256(dir) {
      const hash = createHash("sha256");
      hash.update(readFileSync(join(root, `${dir}.lights.csv`)));
      hash.update(readFileSync(join(root, dir, "keys.csv")));
      return hash.digest("hex");
    },
  };
}

function sourceLabel(source: CaptureSource): string {
  if (source.kind === "shots") return source.files.map((f) => `${CAPTURES}/${f}`).join(" + ");
  if (source.kind === "frames") {
    return [...new Set(source.frames.map((f) => f.dir))].map((d) => `${CAPTURES}/${d}`).join(" + ");
  }
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
    else if (/\.(lcd|ticks|sound|lights)\.txt$/.test(entry.name)) out.push(path);
  }
  return out;
}

function writeIfChanged(path: string, text: string): void {
  if (existsSync(path) && readFileSync(path, "utf8") === text) return;
  writeFileSync(path, text);
}

main();
