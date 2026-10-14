import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  framePeriod,
  numberTicks,
  PERIOD_LEVELS,
  type PlayedFrame,
} from "../scripts/game-capture-set.ts";
import {
  LCD_HEIGHT,
  LCD_WIDTH,
  parseGolden,
  parseTickGolden,
  type Golden,
} from "../scripts/golden-format.ts";

const GOLDENS = join(import.meta.dirname, "../goldens");

interface IndexEntry {
  id: string;
  file: string;
  status: string;
  kind: "still" | "timeline" | "ticks";
  images: number;
  frames: number;
  covers?: string[];
  input?: true;
}

const index = JSON.parse(readFileSync(join(GOLDENS, "index.json"), "utf8")) as IndexEntry[];

function fixtureFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return fixtureFiles(path);
    return entry.name.endsWith(".lcd.txt") || entry.name.endsWith(".ticks.txt")
      ? [relative(GOLDENS, path)]
      : [];
  });
}

describe("committed goldens", () => {
  it("has an index sorted by unique id", () => {
    const ids = index.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
  });

  it("indexes every fixture file", () => {
    expect(fixtureFiles(GOLDENS).sort()).toEqual(index.map((entry) => entry.file).sort());
  });

  for (const entry of index.filter((e) => e.kind !== "ticks")) {
    it(`${entry.id} parses, is 84x48 and matches its index entry`, () => {
      const golden = parseGolden(readFileSync(join(GOLDENS, entry.file), "utf8"), entry.file);
      expect(golden.id).toBe(entry.id);
      expect(entry.file).toBe(`${entry.id}.lcd.txt`);
      expect(golden.status).toBe(entry.status);
      expect(golden.images).toHaveLength(entry.images);
      for (const image of golden.images) expect(image.pixels).toHaveLength(LCD_WIDTH * LCD_HEIGHT);
      expect(entry.covers).toEqual(golden.covers);
      expect(entry.input === true).toBe(golden.input !== undefined);
      if (golden.scenario !== undefined) {
        expect(entry.id).toMatch(/^tree\/\d\d-[a-z-]+\/[0-9-]+\.(sub|options|open|leaf|choose)$/);
        expect(golden.covers!.length).toBeGreaterThan(0);
      }
      if (golden.scenario === "leaf" || golden.scenario === "choose") {
        expect(golden.timeline).toBeDefined();
        expect(typeof golden.triggerFrame).toBe("number");
      }
      if (entry.kind === "timeline") {
        expect(golden.timeline).toHaveLength(entry.frames);
        if (golden.status === "asserted") expect(golden.triggerFrame).toBeDefined();
      } else {
        expect(golden.timeline).toBeUndefined();
        expect(entry.frames).toBe(entry.images);
      }
    });
  }

  it("covers no tree node twice with asserted goldens of the same scenario", () => {
    const seen = new Map<string, string>();
    const twice: string[] = [];
    for (const entry of index) {
      if (entry.status !== "asserted" || entry.kind === "ticks") continue;
      const golden = parseGolden(readFileSync(join(GOLDENS, entry.file), "utf8"), entry.file);
      for (const number of golden.covers ?? []) {
        const key = `${golden.scenario} ${number}`;
        const other = seen.get(key);
        if (other !== undefined) twice.push(`${key}: ${other} and ${entry.id}`);
        seen.set(key, entry.id);
      }
    }
    expect(twice).toEqual([]);
  });

  it("names a later plan for every pending fixture", () => {
    const pending = index.filter((entry) => entry.status !== "asserted");
    for (const entry of pending) {
      const plan = /^pending:(\d+)$/.exec(entry.status);
      expect(plan, `${entry.id}: ${entry.status}`).not.toBeNull();
      expect(Number(plan![1])).toBeGreaterThan(13);
    }
  });
});

describe("game goldens (plan 23)", () => {
  const games = index.filter((entry) => entry.id.startsWith("game/"));
  const load = (entry: IndexEntry): Golden =>
    parseGolden(readFileSync(join(GOLDENS, entry.file), "utf8"), entry.file);

  /** The engine ticks a timeline golden shows (numbered as the importer numbers them). */
  function timelineTicks(golden: Golden): number {
    const pixels = new Map(golden.images.map((image) => [image.name, image.pixels]));
    const frames: PlayedFrame[] = golden.timeline!.map((row, frame) => ({
      pixels: pixels.get(row.image)!,
      startMs: row.startMs,
      durationMs: row.durationMs,
      dir: golden.id,
      frame,
    }));
    return numberTicks(frames, framePeriod(frames)).at(-1)?.tick ?? -1;
  }

  for (const entry of games.filter((e) => e.kind !== "ticks")) {
    it(`${entry.id}: trigger frame, tick still names and input ticks`, () => {
      const golden = load(entry);
      if (golden.timeline) {
        expect(typeof golden.triggerFrame).toBe("number");
      } else if (golden.images.some((image) => /^t\d/.test(image.name))) {
        const ticks = golden.images.map((image) => {
          expect(image.name).toMatch(/^t\d{4}$/);
          return Number(image.name.slice(1));
        });
        expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
        expect(new Set(ticks).size).toBe(ticks.length);
      }
      if (golden.input === undefined) return;
      const last = golden.timeline
        ? timelineTicks(golden)
        : Number(golden.images.at(-1)!.name.slice(1));
      for (const press of golden.input)
        expect(press.tick, `${press.tick}:${press.key}`).toBeLessThanOrEqual(last);
    });
  }

  it("has a period fixture covering every level 10..175", () => {
    const entry = games.find((e) => e.kind === "ticks")!;
    expect(entry.file).toBe("game/snake/periods.ticks.txt");
    const fixture = parseTickGolden(readFileSync(join(GOLDENS, entry.file), "utf8"), entry.file);
    expect(fixture.id).toBe(entry.id);
    expect(fixture.status).toBe(entry.status);
    expect(fixture.rows.map((row) => row.level)).toEqual(PERIOD_LEVELS);
    expect(entry.frames).toBe(fixture.rows.length);
  });
});
